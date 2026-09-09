import type { Packet } from '../types';
import { analyzePacket, type ParsedPacketResult } from './packetParser';
import { hexStringToBytes } from './crc';

export interface PacketPairInfo {
  // Chronological / Logical order: left is Request (First), right is Response (Second)
  leftPacket: Packet;
  rightPacket: Packet;
  leftAnalysis: ParsedPacketResult;
  rightAnalysis: ParsedPacketResult;
  leftRole: 'req' | 'res';
  rightRole: 'req' | 'res';

  txPacket: Packet;
  rxPacket: Packet;
  txAnalysis: ParsedPacketResult;
  rxAnalysis: ParsedPacketResult;

  // 'tx-first': user sent request (TX) -> received response (RX). Left is TX, Right is RX.
  // 'rx-first': user received request (RX) -> sent response (TX). Left is RX, Right is TX.
  flowOrder: 'tx-first' | 'rx-first';
  latencyMs: number;
  matchReason: string;
}

/**
 * Given a packet (either TX or RX) and the full packet history,
 * finds its matching counterpart (TX -> RX or RX -> TX) in both directions (forward and backward).
 */
export function findPairedPacket(
  currentPacket: Packet,
  allPackets?: Packet[]
): PacketPairInfo | null {
  if (!currentPacket || !allPackets || allPackets.length < 2) {
    return null;
  }

  // 1. Find index of current packet
  let currentIndex = allPackets.findIndex((p) => p.id === currentPacket.id);
  if (currentIndex === -1) {
    // Fallback find by timestamp and hex
    currentIndex = allPackets.findIndex(
      (p) => p.timestamp === currentPacket.timestamp && p.hex === currentPacket.hex
    );
  }
  if (currentIndex === -1) {
    // Second fallback: find by matching hex and direction closest to timestamp
    currentIndex = allPackets.findIndex(
      (p) => p.direction === currentPacket.direction && p.hex === currentPacket.hex
    );
  }
  if (currentIndex === -1) return null;

  const currentBytes = currentPacket.bytes && currentPacket.bytes.length > 0
    ? Array.from(currentPacket.bytes)
    : Array.from(hexStringToBytes(currentPacket.hex || ''));
  if (currentBytes.length === 0) return null;

  const currentAnalysis = analyzePacket(currentBytes);
  const targetDirection = currentPacket.direction === 'tx' ? 'rx' : 'tx';

  // 2. Collect candidate packets of the opposite direction (both forward and backward!)
  interface Candidate {
    packet: Packet;
    index: number;
    distanceMs: number;
    indexDiff: number;
    isForward: boolean;
  }

  const candidates: Candidate[] = [];
  const MAX_SEARCH_RANGE = 40;

  // Search forward (packets after current)
  for (let i = currentIndex + 1; i < Math.min(allPackets.length, currentIndex + MAX_SEARCH_RANGE + 1); i++) {
    const p = allPackets[i];
    if (p.direction === targetDirection) {
      candidates.push({
        packet: p,
        index: i,
        distanceMs: Math.abs(p.timestamp - currentPacket.timestamp),
        indexDiff: Math.abs(i - currentIndex),
        isForward: true
      });
    }
  }

  // Search backward (packets before current)
  for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - MAX_SEARCH_RANGE); i--) {
    const p = allPackets[i];
    if (p.direction === targetDirection) {
      candidates.push({
        packet: p,
        index: i,
        distanceMs: Math.abs(currentPacket.timestamp - p.timestamp),
        indexDiff: Math.abs(i - currentIndex),
        isForward: false
      });
    }
  }

  if (candidates.length === 0) return null;

  // 3. Score and evaluate each candidate
  let bestCandidate: { candidate: Candidate; analysis: ParsedPacketResult; matchScore: number; reason: string } | null = null;

  for (const cand of candidates) {
    const candBytes = cand.packet.bytes && cand.packet.bytes.length > 0
      ? Array.from(cand.packet.bytes)
      : Array.from(hexStringToBytes(cand.packet.hex || ''));
    if (candBytes.length === 0) continue;

    const candAnalysis = analyzePacket(candBytes);

    let score = 0;
    let reason = '';

    // A. Modbus TCP Match by Transaction ID (TID)
    if (currentAnalysis.protocol === 'modbus-tcp' && candAnalysis.protocol === 'modbus-tcp') {
      if (currentBytes.length >= 7 && candBytes.length >= 7) {
        const curTid = (currentBytes[0] << 8) | currentBytes[1];
        const candTid = (candBytes[0] << 8) | candBytes[1];
        if (curTid === candTid) {
          score += 120;
          reason = `Modbus TCP TID(0x${curTid.toString(16).toUpperCase()}) 일치`;
        }
      }
    }

    // B. Modbus RTU / TCP Match by Slave ID & Function Code
    if (currentAnalysis.isModbus && candAnalysis.isModbus) {
      if (currentAnalysis.slaveOrUnitId !== undefined && candAnalysis.slaveOrUnitId !== undefined) {
        if (currentAnalysis.slaveOrUnitId === candAnalysis.slaveOrUnitId) {
          score += 60;
          if (currentAnalysis.functionCode !== undefined && candAnalysis.functionCode !== undefined) {
            const isSameFc = currentAnalysis.functionCode === candAnalysis.functionCode;
            const isExc = (currentAnalysis.functionCode | 0x80) === candAnalysis.functionCode ||
                          (candAnalysis.functionCode | 0x80) === currentAnalysis.functionCode;
            if (isSameFc || isExc) {
              score += 50;
              const fcHex = `0x${currentAnalysis.functionCode.toString(16).toUpperCase().padStart(2, '0')}`;
              reason = isExc
                ? `Modbus 국번 #${currentAnalysis.slaveOrUnitId} FC ${fcHex} 예외 응답 매칭`
                : `Modbus 국번 #${currentAnalysis.slaveOrUnitId} FC ${fcHex} 요청-응답 매칭`;
            }
          }
        }
      }
    }

    // C. Request vs Response temporal direction alignment
    if (currentAnalysis.messageType && candAnalysis.messageType) {
      if (currentAnalysis.messageType === 'request' && (candAnalysis.messageType === 'response' || candAnalysis.messageType === 'exception')) {
        if (cand.isForward) {
          score += 40;
        } else {
          score -= 30;
        }
      } else if ((currentAnalysis.messageType === 'response' || currentAnalysis.messageType === 'exception') && candAnalysis.messageType === 'request') {
        if (!cand.isForward) {
          score += 40;
        } else {
          score -= 30;
        }
      }
    }

    // D. Immediate adjacent index bonus
    if (cand.indexDiff === 1) {
      score += 50;
      if (!reason) reason = '인접 송수신 패킷 매칭';
    } else if (cand.indexDiff <= 3) {
      score += 30;
      if (!reason) reason = '인접 송수신 패킷 매칭';
    } else if (cand.indexDiff <= 10) {
      score += 15;
    }

    // E. Time proximity bonus (within 10 seconds)
    if (cand.distanceMs <= 500) {
      score += 35;
    } else if (cand.distanceMs <= 2000) {
      score += 25;
    } else if (cand.distanceMs <= 5000) {
      score += 15;
    } else if (cand.distanceMs <= 10000) {
      score += 5;
    } else {
      score -= 20;
    }

    if (!reason) {
      reason = '송수신 연계 패킷 매칭';
    }

    if (!bestCandidate || score > bestCandidate.matchScore) {
      bestCandidate = { candidate: cand, analysis: candAnalysis, matchScore: score, reason };
    }
  }

  if (!bestCandidate || bestCandidate.matchScore < 20) return null;

  const matchedPacket = bestCandidate.candidate.packet;
  const matchedAnalysis = bestCandidate.analysis;
  const matchedIndex = bestCandidate.candidate.index;

  const txPacket = currentPacket.direction === 'tx' ? currentPacket : matchedPacket;
  const txAnalysis = currentPacket.direction === 'tx' ? currentAnalysis : matchedAnalysis;
  const txIndex = currentPacket.direction === 'tx' ? currentIndex : matchedIndex;

  const rxPacket = currentPacket.direction === 'rx' ? currentPacket : matchedPacket;
  const rxAnalysis = currentPacket.direction === 'rx' ? currentAnalysis : matchedAnalysis;
  const rxIndex = currentPacket.direction === 'rx' ? currentIndex : matchedIndex;

  // 4. Determine Flow Order:
  // - "내가 응답 패킷을 주는 경우": RX(요청)가 먼저 들어오고 TX(응답)를 나중에 준 경우 -> 왼쪽: RX, 오른쪽: TX
  // - "내가 요청 패킷을 전송하는 경우": TX(요청)를 먼저 보내고 RX(응답)를 나중에 받은 경우 -> 왼쪽: TX, 오른쪽: RX
  let flowOrder: 'tx-first' | 'rx-first' = 'tx-first';

  if (rxAnalysis.messageType === 'request' && (txAnalysis.messageType === 'response' || txAnalysis.messageType === 'exception')) {
    flowOrder = 'rx-first';
  } else if (txAnalysis.messageType === 'request' && (rxAnalysis.messageType === 'response' || rxAnalysis.messageType === 'exception')) {
    flowOrder = 'tx-first';
  } else {
    // Chronological order: if RX came before TX in log/time, user is responding (rx-first)
    const rxCameFirst = rxIndex !== -1 && txIndex !== -1 ? rxIndex < txIndex : rxPacket.timestamp <= txPacket.timestamp;
    flowOrder = rxCameFirst ? 'rx-first' : 'tx-first';
  }

  const latencyMs = Math.max(0, Math.abs(rxPacket.timestamp - txPacket.timestamp));

  if (flowOrder === 'tx-first') {
    // 내가 요청 패킷을 전송한 경우 (Master): 왼쪽 TX(요청), 오른쪽 RX(응답)
    return {
      leftPacket: txPacket,
      rightPacket: rxPacket,
      leftAnalysis: txAnalysis,
      rightAnalysis: rxAnalysis,
      leftRole: 'req',
      rightRole: 'res',
      txPacket,
      rxPacket,
      txAnalysis,
      rxAnalysis,
      flowOrder: 'tx-first',
      latencyMs,
      matchReason: bestCandidate.reason
    };
  } else {
    // 내가 응답 패킷을 주는 경우 (Slave): 왼쪽 RX(요청), 오른쪽 TX(응답)
    return {
      leftPacket: rxPacket,
      rightPacket: txPacket,
      leftAnalysis: rxAnalysis,
      rightAnalysis: txAnalysis,
      leftRole: 'req',
      rightRole: 'res',
      txPacket,
      rxPacket,
      txAnalysis,
      rxAnalysis,
      flowOrder: 'rx-first',
      latencyMs,
      matchReason: bestCandidate.reason
    };
  }
}
