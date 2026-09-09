import type { Packet } from '../types';
import { analyzePacket, type ParsedPacketResult } from './packetParser';
import { hexStringToBytes } from './crc';

export interface PacketPairInfo {
  txPacket: Packet;
  rxPacket: Packet;
  txAnalysis: ParsedPacketResult;
  rxAnalysis: ParsedPacketResult;
  latencyMs: number;
  matchReason: string;
}

/**
 * Given a packet (either TX or RX) and the full packet history,
 * finds its matching counterpart (TX -> RX response, or RX -> TX request).
 */
export function findPairedPacket(
  currentPacket: Packet,
  allPackets?: Packet[]
): PacketPairInfo | null {
  if (!currentPacket || !allPackets || allPackets.length < 2) {
    return null;
  }

  const currentIndex = allPackets.findIndex((p) => p.id === currentPacket.id);
  if (currentIndex === -1) return null;

  const currentBytes = currentPacket.bytes && currentPacket.bytes.length > 0
    ? Array.from(currentPacket.bytes)
    : Array.from(hexStringToBytes(currentPacket.hex || ''));
  if (currentBytes.length === 0) return null;

  const currentAnalysis = analyzePacket(currentBytes);

  if (currentPacket.direction === 'tx') {
    // Current is TX (Request): Search forward for matching RX (Response)
    const MAX_LOOKAHEAD = 20;
    const MAX_TIME_WINDOW_MS = 5000; // 5 seconds max response window

    for (let i = currentIndex + 1; i < Math.min(allPackets.length, currentIndex + MAX_LOOKAHEAD + 1); i++) {
      const candidate = allPackets[i];
      if (candidate.timestamp - currentPacket.timestamp > MAX_TIME_WINDOW_MS) break;

      if (candidate.direction === 'rx') {
        const candidateBytes = candidate.bytes && candidate.bytes.length > 0
          ? Array.from(candidate.bytes)
          : Array.from(hexStringToBytes(candidate.hex || ''));
        if (candidateBytes.length === 0) continue;

        const candidateAnalysis = analyzePacket(candidateBytes);
        const match = matchTxAndRx(currentBytes, currentAnalysis, candidateBytes, candidateAnalysis);
        if (match.isMatch) {
          return {
            txPacket: currentPacket,
            rxPacket: candidate,
            txAnalysis: currentAnalysis,
            rxAnalysis: candidateAnalysis,
            latencyMs: Math.max(0, candidate.timestamp - currentPacket.timestamp),
            matchReason: match.reason
          };
        }
      }
    }
  } else if (currentPacket.direction === 'rx') {
    // Current is RX (Response): Search backward for matching TX (Request)
    const MAX_LOOKBACK = 20;
    const MAX_TIME_WINDOW_MS = 5000;

    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - MAX_LOOKBACK); i--) {
      const candidate = allPackets[i];
      if (currentPacket.timestamp - candidate.timestamp > MAX_TIME_WINDOW_MS) break;

      if (candidate.direction === 'tx') {
        const candidateBytes = candidate.bytes && candidate.bytes.length > 0
          ? Array.from(candidate.bytes)
          : Array.from(hexStringToBytes(candidate.hex || ''));
        if (candidateBytes.length === 0) continue;

        const candidateAnalysis = analyzePacket(candidateBytes);
        const match = matchTxAndRx(candidateBytes, candidateAnalysis, currentBytes, currentAnalysis);
        if (match.isMatch) {
          return {
            txPacket: candidate,
            rxPacket: currentPacket,
            txAnalysis: candidateAnalysis,
            rxAnalysis: currentAnalysis,
            latencyMs: Math.max(0, currentPacket.timestamp - candidate.timestamp),
            matchReason: match.reason
          };
        }
      }
    }
  }

  return null;
}

function matchTxAndRx(
  txBytes: number[],
  txAnalysis: ParsedPacketResult,
  rxBytes: number[],
  rxAnalysis: ParsedPacketResult
): { isMatch: boolean; reason: string } {
  // 1. Modbus TCP Matching (by TID & Unit ID & FC)
  if (txAnalysis.protocol === 'modbus-tcp' && rxAnalysis.protocol === 'modbus-tcp') {
    if (txBytes.length >= 7 && rxBytes.length >= 7) {
      const txTid = (txBytes[0] << 8) | txBytes[1];
      const rxTid = (rxBytes[0] << 8) | rxBytes[1];
      const txUnit = txBytes[6];
      const rxUnit = rxBytes[6];
      const txFc = txBytes[7];
      const rxFc = rxBytes[7];

      if (txTid === rxTid) {
        return {
          isMatch: true,
          reason: `Modbus TCP TID(0x${txTid.toString(16).toUpperCase()}) 일치`
        };
      }
      if (txUnit === rxUnit && (txFc === rxFc || (txFc | 0x80) === rxFc)) {
        return {
          isMatch: true,
          reason: `Modbus TCP 국번 #${txUnit} 기능코드 0x${txFc.toString(16).toUpperCase().padStart(2, '0')} 일치`
        };
      }
    }
  }

  // 2. Modbus RTU Matching (by Slave ID & Function Code / Exception Code)
  if (txAnalysis.protocol === 'modbus-rtu' && rxAnalysis.protocol === 'modbus-rtu') {
    if (
      txAnalysis.slaveOrUnitId !== undefined &&
      rxAnalysis.slaveOrUnitId !== undefined &&
      txAnalysis.functionCode !== undefined &&
      rxAnalysis.functionCode !== undefined
    ) {
      const isSameSlave = txAnalysis.slaveOrUnitId === rxAnalysis.slaveOrUnitId;
      const isSameFc = txAnalysis.functionCode === rxAnalysis.functionCode;
      const isExceptionFc = (txAnalysis.functionCode | 0x80) === rxAnalysis.functionCode;

      if (isSameSlave && (isSameFc || isExceptionFc)) {
        const fcHex = `0x${txAnalysis.functionCode.toString(16).toUpperCase().padStart(2, '0')}`;
        return {
          isMatch: true,
          reason: isExceptionFc
            ? `Modbus RTU 국번 #${txAnalysis.slaveOrUnitId} FC ${fcHex} 예외 응답 매칭`
            : `Modbus RTU 국번 #${txAnalysis.slaveOrUnitId} FC ${fcHex} 요청-응답 매칭`
        };
      } else {
        // If both are identified as Modbus RTU but slave or FC do not match, do not pair
        return { isMatch: false, reason: '국번 또는 기능코드 불일치' };
      }
    }
  }

  // 3. If one is Modbus and the other is not, not a pair
  if (txAnalysis.isModbus !== rxAnalysis.isModbus) {
    return { isMatch: false, reason: '프로토콜 종류 불일치' };
  }

  // 4. Fallback for Generic/Raw frame: sequential match
  return {
    isMatch: true,
    reason: '인접 송수신 순차 매칭'
  };
}
