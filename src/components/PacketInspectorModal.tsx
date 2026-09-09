import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Packet, AppTheme } from '../types';
import {
  analyzePacket,
  guessModbusDataType,
  decodeRegisterPayload,
  decodeMixedRegisterPayload,
  type ParsedPacketResult,
  type PacketField,
  type HeuristicTypeGuess,
  type DecodedRegisterRow
} from '../utils/packetParser';
import { findPairedPacket, type PacketPairInfo } from '../utils/packetPairing';
import { hexStringToBytes } from '../utils/crc';
import {
  X,
  Copy,
  Check,
  Search,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Database,
  Terminal,
  Layers,
  ArrowUpRight,
  Sparkles,
  FileText,
  Clock,
  ArrowRightLeft,
  Send,
  Download
} from 'lucide-react';

interface PacketInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  packet: Packet | null;
  allPackets?: Packet[];
  onApplyToSend?: (data: string, format: 'hex' | 'ascii') => void;
}

interface PacketInspectPaneProps {
  packet: Packet;
  theme: AppTheme;
  isRetro: boolean;
  isDark: boolean;
  isDual: boolean;
  role: 'tx' | 'rx' | 'standalone' | 'req' | 'res';
  customRoleTitle?: string;
  onApplyToSend?: (data: string, format: 'hex' | 'ascii') => void;
}

/**
 * Splits a hex string into chunks of 8 bytes per line to prevent mid-byte breaks
 * and provide clean, fixed 8-byte rows (e.g. for Register Data).
 */
const splitHexInto8ByteLines = (hexStr: string): string[] => {
  if (!hexStr) return [];
  const tokens = hexStr.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 8) {
    return [tokens.join(' ')];
  }
  const lines: string[] = [];
  for (let i = 0; i < tokens.length; i += 8) {
    lines.push(tokens.slice(i, i + 8).join(' '));
  }
  return lines;
};

/**
 * High-contrast, vibrant palette for packet field identification.
 * Ensures every individual field gets a uniquely distinct color.
 */
interface FieldColorConfig {
  dotClass: string;
  streamClass: string;
}

const FIELD_PALETTES: FieldColorConfig[] = [
  { dotClass: 'bg-blue-500', streamClass: 'bg-blue-950/80 text-blue-300 border border-blue-500/70' },
  { dotClass: 'bg-cyan-400', streamClass: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/70' },
  { dotClass: 'bg-purple-400', streamClass: 'bg-purple-950/80 text-purple-300 border border-purple-500/70' },
  { dotClass: 'bg-amber-400', streamClass: 'bg-amber-950/80 text-amber-300 border border-amber-500/70' },
  { dotClass: 'bg-emerald-400', streamClass: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/70' },
  { dotClass: 'bg-orange-400', streamClass: 'bg-orange-950/80 text-orange-300 border border-orange-500/70' },
  { dotClass: 'bg-pink-400', streamClass: 'bg-pink-950/80 text-pink-300 border border-pink-500/70' },
  { dotClass: 'bg-teal-400', streamClass: 'bg-teal-950/80 text-teal-300 border border-teal-500/70' },
  { dotClass: 'bg-rose-400', streamClass: 'bg-rose-950/80 text-rose-300 border border-rose-500/70' },
  { dotClass: 'bg-indigo-400', streamClass: 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/70' },
  { dotClass: 'bg-sky-400', streamClass: 'bg-sky-950/80 text-sky-300 border border-sky-500/70' },
  { dotClass: 'bg-lime-400', streamClass: 'bg-lime-950/80 text-lime-300 border border-lime-500/70' },
  { dotClass: 'bg-violet-400', streamClass: 'bg-violet-950/80 text-violet-300 border border-violet-500/70' },
  { dotClass: 'bg-fuchsia-400', streamClass: 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/70' }
];

const TAG_COLOR_MAP: Record<string, FieldColorConfig> = {
  blue: { dotClass: 'bg-blue-500', streamClass: 'bg-blue-950/80 text-blue-300 border border-blue-500/70' },
  cyan: { dotClass: 'bg-cyan-400', streamClass: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/70' },
  purple: { dotClass: 'bg-purple-400', streamClass: 'bg-purple-950/80 text-purple-300 border border-purple-500/70' },
  amber: { dotClass: 'bg-amber-400', streamClass: 'bg-amber-950/80 text-amber-300 border border-amber-500/70' },
  emerald: { dotClass: 'bg-emerald-400', streamClass: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/70' },
  orange: { dotClass: 'bg-orange-400', streamClass: 'bg-orange-950/80 text-orange-300 border border-orange-500/70' },
  pink: { dotClass: 'bg-pink-400', streamClass: 'bg-pink-950/80 text-pink-300 border border-pink-500/70' },
  teal: { dotClass: 'bg-teal-400', streamClass: 'bg-teal-950/80 text-teal-300 border border-teal-500/70' },
  rose: { dotClass: 'bg-rose-500', streamClass: 'bg-rose-950/80 text-rose-300 border border-rose-500/70' },
  indigo: { dotClass: 'bg-indigo-400', streamClass: 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/70' },
  sky: { dotClass: 'bg-sky-400', streamClass: 'bg-sky-950/80 text-sky-300 border border-sky-500/70' },
  lime: { dotClass: 'bg-lime-400', streamClass: 'bg-lime-950/80 text-lime-300 border border-lime-500/70' },
  violet: { dotClass: 'bg-violet-400', streamClass: 'bg-violet-950/80 text-violet-300 border border-violet-500/70' },
  fuchsia: { dotClass: 'bg-fuchsia-400', streamClass: 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-500/70' }
};

const getFieldColor = (tagColor?: string, fieldIndex: number = 0): FieldColorConfig => {
  if (tagColor && TAG_COLOR_MAP[tagColor]) {
    return TAG_COLOR_MAP[tagColor];
  }
  return FIELD_PALETTES[fieldIndex % FIELD_PALETTES.length];
};

const PacketInspectPane: React.FC<PacketInspectPaneProps> = ({
  packet,
  theme,
  isRetro,
  isDark,
  isDual,
  role,
  customRoleTitle,
  onApplyToSend
}) => {
  const [copiedHex, setCopiedHex] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedRegs, setCopiedRegs] = useState(false);
  const [copiedRegIndex, setCopiedRegIndex] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<PacketField | null>(null);

  // Register Payload Decoder Settings State
  const [unitSize, setUnitSize] = useState<2 | 4 | 8 | 'mixed'>('mixed');
  const [dataType, setDataType] = useState<string>('float32');
  const [byteOrder, setByteOrder] = useState<string>('ABCD');

  // Normalize packet bytes
  const packetBytes = useMemo<number[]>(() => {
    if (!packet) return [];
    if (packet.bytes && packet.bytes.length > 0) {
      return Array.from(packet.bytes);
    }
    if (packet.hex) {
      return Array.from(hexStringToBytes(packet.hex));
    }
    return [];
  }, [packet]);

  // Decode packet structure
  const analysis = useMemo<ParsedPacketResult | null>(() => {
    if (!packet || packetBytes.length === 0) return null;
    return analyzePacket(packetBytes);
  }, [packet, packetBytes]);

  // Heuristic Type Guess for Register Payload
  const typeGuess = useMemo<HeuristicTypeGuess | null>(() => {
    if (!analysis?.registerPayload || analysis.registerPayload.length === 0) return null;
    return guessModbusDataType(analysis.registerPayload);
  }, [analysis?.registerPayload]);

  // Auto-initialize register format settings based on heuristic guess when packet opens
  useEffect(() => {
    if (typeGuess) {
      setDataType(typeGuess.dataType);
      setByteOrder(typeGuess.byteOrder);
    }
  }, [typeGuess]);

  // Handle unit size changes
  const handleUnitSizeChange = (newSize: 2 | 4 | 8 | 'mixed') => {
    setUnitSize(newSize);
    if (newSize === 2) {
      setDataType('uint16');
      setByteOrder('AB');
    } else if (newSize === 4) {
      setDataType('float32');
      setByteOrder('ABCD');
    } else if (newSize === 8) {
      setDataType('float64');
      setByteOrder('ABCDEFGH');
    }
  };

  // Decode Register Rows
  const decodedRegisters = useMemo<DecodedRegisterRow[]>(() => {
    if (!analysis?.registerPayload || analysis.registerPayload.length === 0) return [];
    if (unitSize === 'mixed') {
      const preferredEndian = (byteOrder === 'CDAB' ? 'CDAB' : 'ABCD') as 'ABCD' | 'CDAB';
      return decodeMixedRegisterPayload(analysis.registerPayload, preferredEndian, 0);
    }
    return decodeRegisterPayload(analysis.registerPayload, unitSize, dataType, byteOrder, 0);
  }, [analysis?.registerPayload, unitSize, dataType, byteOrder]);

  const rawHexStr = packetBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const sss = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${sss}`;
  };

  const handleCopyHex = () => {
    if (!rawHexStr) return;
    navigator.clipboard.writeText(rawHexStr);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 1500);
  };

  const handleCopyReport = () => {
    if (!analysis) return;
    const isRx = packet.direction === 'rx';
    const lines = [
      `=== [패킷 분석 리포트 - ${isRx ? 'RX 수신' : 'TX 송신'}] ===`,
      `방향: ${isRx ? 'RX (수신)' : 'TX (송신)'}`,
      `시간: ${formatTimestamp(packet.timestamp)}`,
      `크기: ${packetBytes.length} Bytes`,
      `프로토콜: ${analysis.protocolLabel}`,
      `요약: ${analysis.summary}`,
      ``,
      `[필드 세부 구조]`,
      ...analysis.fields.map((f, i) => {
        const range = f.byteRange[0] === f.byteRange[1] ? `[${f.byteRange[0]}]` : `[${f.byteRange[0]}..${f.byteRange[1]}]`;
        const val = f.dec !== undefined ? ` (값: ${f.dec})` : '';
        return `${i + 1}. ${range} ${f.name}: 0x${f.hex.replace(/\s+/g, '')}${val} - ${f.description}`;
      })
    ];

    if (decodedRegisters.length > 0) {
      lines.push(``);
      lines.push(
        unitSize === 'mixed'
          ? `[레지스터 디코딩 (지능형 자동 복합 / 실수순서: ${byteOrder})]`
          : `[레지스터 디코딩 (${unitSize}B 단위 / ${dataType} / ${byteOrder})]`
      );
      decodedRegisters.forEach((row) => {
        const typeInfo = row.typeBadge ? ` [${row.typeBadge}]` : '';
        lines.push(`${row.registerRangeLabel} (${row.byteOffsetLabel}): ${row.formattedValue}${typeInfo} [HEX: ${row.hex}]`);
      });
    }

    lines.push(``);
    lines.push(`[원문 HEX]`);
    lines.push(rawHexStr);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 1500);
  };

  const handleCopyAllRegisters = () => {
    if (decodedRegisters.length === 0) return;
    const lines = [
      `레지스터\t오프셋\t타입\tHEX\t값`,
      ...decodedRegisters.map((r) => `${r.registerRangeLabel}\t${r.byteOffsetLabel}\t${r.typeBadge || `${unitSize}B`}\t${r.hex}\t${r.formattedValue}`)
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedRegs(true);
    setTimeout(() => setCopiedRegs(false), 1500);
  };

  const handleCopySingleRegister = (val: string, idx: number) => {
    navigator.clipboard.writeText(val);
    setCopiedRegIndex(idx);
    setTimeout(() => setCopiedRegIndex(null), 1200);
  };

  const isRx = packet.direction === 'rx';

  return (
    <div className={`flex flex-col ${isDual ? 'gap-3' : 'gap-3.5'}`}>
      {/* Pane Sub-header: Direction & Key Stats (Line 1) + Action Buttons (Line 2) */}
      <div
        className={`flex flex-col gap-2 p-2.5 rounded-lg border select-none ${
          isRetro
            ? 'bg-white border-[#808080]'
            : isDark
            ? isRx
              ? 'bg-emerald-950/20 border-emerald-800/40'
              : 'bg-indigo-950/20 border-indigo-800/40'
            : isRx
            ? 'bg-emerald-50/70 border-emerald-200'
            : 'bg-indigo-50/70 border-indigo-200'
        }`}
      >
        {/* Line 1: Direction & Key Stats */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            style={{
              backgroundColor: isRx ? theme.rxColor : theme.txColor,
              color: theme.textColor || '#000'
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black uppercase shadow-2xs shrink-0"
          >
            {isRx ? <Download size={12} /> : <Send size={12} />}
            <span>
              {customRoleTitle || (
                role === 'req'
                  ? (isRx ? 'RX (수신 요청)' : 'TX (송신 요청)')
                  : role === 'res'
                  ? (isRx ? 'RX (수신 응답)' : 'TX (송신 응답)')
                  : role === 'tx'
                  ? 'TX (송신 요청)'
                  : role === 'rx'
                  ? 'RX (수신 응답)'
                  : isRx ? 'RX (수신)' : 'TX (송신)'
              )}
            </span>
          </span>

          <span
            className={`font-mono text-xs px-2 py-0.5 rounded shrink-0 ${
              isRetro
                ? 'bg-black/10 text-black'
                : isDark
                ? 'bg-zinc-800/90 text-zinc-300 border border-zinc-700'
                : 'bg-white text-zinc-700 border border-zinc-300'
            }`}
          >
            {formatTimestamp(packet.timestamp)}
          </span>

          <span
            className={`font-mono text-xs px-2 py-0.5 rounded font-bold shrink-0 ${
              isRetro
                ? 'bg-[#15213b] text-[#55f2ff]'
                : isDark
                ? 'bg-zinc-950 text-amber-400 border border-zinc-700'
                : 'bg-white text-amber-600 border border-amber-200'
            }`}
          >
            {packetBytes.length} Bytes
          </span>

          {analysis && (
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold border shrink-0 ${
                analysis.protocol === 'modbus-tcp'
                  ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                  : analysis.protocol === 'modbus-rtu'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
              }`}
            >
              {analysis.protocolLabel}
            </span>
          )}
        </div>

        {/* Line 2: Action Buttons */}
        <div
          className={`flex items-center justify-start gap-1.5 pt-1.5 border-t ${
            isRetro
              ? 'border-[#808080]/30'
              : isDark
              ? 'border-zinc-800/60'
              : 'border-zinc-200'
          }`}
        >
          <button
            onClick={handleCopyHex}
            className={`px-2.5 py-1 rounded transition-all text-xs flex items-center gap-1 cursor-pointer ${
              copiedHex
                ? 'bg-emerald-600 text-white'
                : isRetro
                ? 'bg-[#ece9d8] border border-[#808080] hover:bg-white text-black'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
            title="HEX 데이터 복사"
          >
            {copiedHex ? <Check size={12} /> : <Copy size={12} />}
            <span className="text-[11px] font-bold font-sans">HEX 복사</span>
          </button>

          <button
            onClick={handleCopyReport}
            className={`px-2.5 py-1 rounded transition-all text-xs flex items-center gap-1 cursor-pointer ${
              copiedReport
                ? 'bg-emerald-600 text-white'
                : isRetro
                ? 'bg-[#ece9d8] border border-[#808080] hover:bg-white text-black'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
            title="분석 리포트 복사"
          >
            {copiedReport ? <Check size={12} /> : <FileText size={12} />}
            <span className="text-[11px] font-bold font-sans">리포트 복사</span>
          </button>

          {onApplyToSend && (
            <button
              onClick={() => onApplyToSend(rawHexStr, 'hex')}
              className={`px-2.5 py-1 rounded transition-all text-xs flex items-center gap-1 cursor-pointer ${
                isRetro
                  ? 'bg-[#000080] text-white hover:bg-blue-900'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs'
              }`}
              title="전송창에 패킷 넣기"
            >
              <ArrowUpRight size={12} />
              <span className="text-[11px] font-bold font-sans">전송창에 적용</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Banner */}
      {analysis && (
        <div
          className={`p-2.5 rounded-md border flex items-start gap-2.5 shadow-2xs ${
            analysis.isValidCrc === false
              ? isDark
                ? 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                : 'bg-rose-50 border-rose-200 text-rose-800'
              : analysis.protocol === 'modbus-tcp'
              ? isDark
                ? 'bg-sky-950/30 border-sky-800/60 text-sky-200'
                : 'bg-sky-50 border-sky-200 text-sky-900'
              : analysis.protocol === 'modbus-rtu'
              ? isDark
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : isDark
              ? 'bg-zinc-900/80 border-zinc-700/80 text-zinc-200'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {analysis.isValidCrc === false ? (
              <ShieldAlert size={18} className="text-rose-400" />
            ) : analysis.isModbus ? (
              <ShieldCheck size={18} className="text-emerald-400" />
            ) : (
              <Activity size={18} className="text-indigo-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xs flex items-center gap-2 flex-wrap">
              <span>{analysis.summary}</span>
              {analysis.isValidCrc === true && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-500/30">
                  CRC-16 정상
                </span>
              )}
              {analysis.isValidCrc === false && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  CRC-16 불일치
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Frame Field Breakdown Table */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
            <Layers size={13} className="text-indigo-400" />
            프레임 필드 구조 분석 (Field Breakdown)
          </span>
          <span className="text-xs opacity-70">총 {analysis?.fields.length || 0}개 필드</span>
        </div>

        <div
          className={`rounded border overflow-hidden ${
            isRetro
              ? 'bg-white border-[#808080]'
              : isDark
              ? 'bg-zinc-900/80 border-zinc-800'
              : 'bg-white border-zinc-200 shadow-2xs'
          }`}
        >
          <table className="w-full text-left text-xs sm:text-[13px] border-collapse font-mono">
            <thead>
              <tr
                className={`border-b select-none text-[11px] sm:text-xs font-bold ${
                  isRetro
                    ? 'bg-[#ece9d8] text-black border-[#808080]'
                    : isDark
                    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}
              >
                <th className="py-2 px-2.5 w-10 text-center">No</th>
                <th className="py-2 px-2.5 w-20 text-center">오프셋</th>
                <th className="py-2 px-3 whitespace-nowrap min-w-[170px]">필드명</th>
                <th className="py-2 px-2.5 w-20 text-center whitespace-nowrap">길이</th>
                <th className="py-2 px-3 min-w-[210px]">HEX</th>
                <th className="py-2 px-3 min-w-[150px]">파싱 값</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {analysis?.fields.map((field, idx) => {
                const isSelected = selectedField?.name === field.name;
                const rangeStr =
                  field.byteRange[0] === field.byteRange[1]
                    ? `[${field.byteRange[0]}]`
                    : `[${field.byteRange[0]}..${field.byteRange[1]}]`;
                const byteLen = field.bytes ? field.bytes.length : field.byteRange[1] - field.byteRange[0] + 1;
                const hexLines = splitHexInto8ByteLines(field.hex);

                const fieldColor = getFieldColor(field.tagColor, idx);

                return (
                  <tr
                    key={idx}
                    onClick={() => setSelectedField(field)}
                    title={field.description}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-950/40 text-indigo-200'
                          : 'bg-indigo-50 text-indigo-900'
                        : isDark
                        ? 'hover:bg-zinc-800/50 text-zinc-300'
                        : 'hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <td className="py-2 px-2.5 text-center text-zinc-400 align-top">{idx + 1}</td>
                    <td className="py-2 px-2.5 text-center font-bold text-amber-500 dark:text-amber-400 align-top whitespace-nowrap">
                      {rangeStr}
                    </td>
                    <td className="py-2 px-3 font-semibold font-sans align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ${fieldColor.dotClass}`}
                        />
                        <span className="whitespace-nowrap">{field.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-center font-mono font-bold text-cyan-600 dark:text-cyan-400 align-top whitespace-nowrap">
                      {byteLen} Byte
                    </td>
                    <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400 align-top font-mono whitespace-nowrap leading-relaxed">
                      {hexLines.map((line, lineIdx) => (
                        <div key={lineIdx} className="tracking-wide">
                          {line}
                        </div>
                      ))}
                    </td>
                    <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-semibold align-top whitespace-nowrap min-w-[150px]">
                      {field.dec !== undefined && field.dec !== '' ? String(field.dec) : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER PAYLOAD DECODER SECTION (2B / 4B / 8B / Float / Int) */}
      {analysis?.registerPayload && analysis.registerPayload.length >= 2 && (
        <div
          className={`p-3 rounded-lg border space-y-2.5 ${
            isRetro
              ? 'bg-[#ece9d8] border-[#808080] shadow-sm'
              : isDark
              ? 'bg-zinc-900/90 border-indigo-500/30 shadow-md'
              : 'bg-indigo-50/40 border-indigo-200 shadow-xs'
          }`}
        >
          {/* Section Header & Heuristic Auto-Detect Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Database size={15} className="text-indigo-500 dark:text-indigo-400" />
              <span className="font-bold text-xs uppercase tracking-wider">
                레지스터 데이터 디코더
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 font-bold border border-indigo-500/20">
                {analysis.registerPayload.length}B ({Math.floor(analysis.registerPayload.length / 2)}개 레지스터)
              </span>
            </div>

            {typeGuess && (
              <div className="flex items-center gap-1 text-xs">
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/30">
                  <Sparkles size={11} className="shrink-0" />
                  <span>추천: {typeGuess.label}</span>
                </span>
                {(unitSize !== typeGuess.unitSize || dataType !== typeGuess.dataType || byteOrder !== typeGuess.byteOrder) && (
                  <button
                    onClick={() => {
                      setUnitSize(typeGuess.unitSize);
                      setDataType(typeGuess.dataType);
                      setByteOrder(typeGuess.byteOrder);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-bold transition-all cursor-pointer"
                  >
                    적용
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Controls Bar: Unit Size, Data Type, Byte Order */}
          <div
            className={`p-2 rounded border flex flex-wrap items-center justify-between gap-2 text-xs ${
              isRetro
                ? 'bg-white border-[#808080]'
                : isDark
                ? 'bg-zinc-950/80 border-zinc-800'
                : 'bg-white border-zinc-200'
            }`}
          >
            {/* Unit Size Selector */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-500 dark:text-zinc-400 text-[11px] select-none">크기:</span>
              <div className="inline-flex rounded p-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px]">
                <button
                  onClick={() => handleUnitSizeChange('mixed')}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    unitSize === 'mixed'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                  title="2B 정수와 4B 부동소수점(Float)을 바이트 패턴에 따라 지능형으로 자동 분할 분석"
                >
                  <Sparkles size={10} />
                  <span>자동복합</span>
                </button>
                <button
                  onClick={() => handleUnitSizeChange(2)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    unitSize === 2
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  2B
                </button>
                <button
                  onClick={() => handleUnitSizeChange(4)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    unitSize === 4
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  4B
                </button>
                <button
                  onClick={() => handleUnitSizeChange(8)}
                  className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    unitSize === 8
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  8B
                </button>
              </div>
            </div>

            {/* Data Type Selector (Only in manual 2B / 4B / 8B modes) */}
            {unitSize !== 'mixed' && (
              <div className="flex items-center gap-1">
                <span className="font-bold text-zinc-500 dark:text-zinc-400 text-[11px] select-none">형식:</span>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value)}
                className={`h-6 px-1.5 font-mono text-[11px] rounded border outline-none font-bold cursor-pointer ${
                  isRetro
                    ? 'bg-white text-black border-[#808080]'
                    : isDark
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                    : 'bg-zinc-50 text-zinc-900 border-zinc-300'
                }`}
              >
                {unitSize === 2 && (
                  <>
                    <option value="uint16">UInt16 (정수 0~65535)</option>
                    <option value="int16">Int16 (부호정수)</option>
                    <option value="hex">HEX (16진수)</option>
                    <option value="binary">Binary (2진수)</option>
                  </>
                )}
                {unitSize === 4 && (
                  <>
                    <option value="float32">Float32 (IEEE 754 실수)</option>
                    <option value="uint32">UInt32 (32비트 정수)</option>
                    <option value="int32">Int32 (부호 정수)</option>
                    <option value="hex">HEX (32비트)</option>
                  </>
                )}
                {unitSize === 8 && (
                  <>
                    <option value="float64">Double (64비트 실수)</option>
                    <option value="uint64">UInt64 (64비트 정수)</option>
                    <option value="int64">Int64 (부호 정수)</option>
                  </>
                )}
              </select>
            </div>
          )}

            {/* Endianness Selector */}
            <div className="flex items-center gap-1">
              <span className="font-bold text-zinc-500 dark:text-zinc-400 text-[11px] select-none">
                {unitSize === 'mixed' ? '실수순서:' : '순서:'}
              </span>
              <select
                value={byteOrder}
                onChange={(e) => setByteOrder(e.target.value)}
                className={`h-6 px-1.5 font-mono text-[11px] rounded border outline-none font-bold cursor-pointer ${
                  isRetro
                    ? 'bg-white text-black border-[#808080]'
                    : isDark
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                    : 'bg-zinc-50 text-zinc-900 border-zinc-300'
                }`}
              >
                {unitSize === 'mixed' && (
                  <>
                    <option value="ABCD">ABCD (Big-Endian Float)</option>
                    <option value="CDAB">CDAB (Word-Swap Float)</option>
                  </>
                )}
                {unitSize === 2 && (
                  <>
                    <option value="AB">AB (Big-Endian)</option>
                    <option value="BA">BA (Little-Endian)</option>
                  </>
                )}
                {unitSize === 4 && (
                  <>
                    <option value="ABCD">ABCD (Big-Endian)</option>
                    <option value="CDAB">CDAB (Word-Swap)</option>
                    <option value="BADC">BADC (Byte-Swap)</option>
                    <option value="DCBA">DCBA (Little-Endian)</option>
                  </>
                )}
                {unitSize === 8 && (
                  <>
                    <option value="ABCDEFGH">ABCDEFGH (표준)</option>
                    <option value="GHEFCDAB">GHEFCDAB (Word-Swap)</option>
                    <option value="HGFEDCBA">HGFEDCBA (Little-Endian)</option>
                  </>
                )}
              </select>
            </div>

            {/* Batch Copy Button */}
            <button
              onClick={handleCopyAllRegisters}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                copiedRegs
                  ? 'bg-emerald-600 text-white'
                  : isRetro
                  ? 'bg-[#d4d0c8] border border-[#808080] text-black hover:bg-white'
                  : isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300'
              }`}
              title="전체 디코딩 레지스터 표를 TSV 텍스트로 복사"
            >
              {copiedRegs ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedRegs ? '복사됨' : '표 복사'}</span>
            </button>
          </div>

          {/* Decoded Registers Table */}
          <div
            className={`max-h-52 overflow-y-auto rounded border font-mono text-xs ${
              isRetro
                ? 'bg-white border-[#808080]'
                : isDark
                ? 'bg-zinc-950 border-zinc-800'
                : 'bg-white border-zinc-200'
            }`}
          >
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 select-none">
                <tr
                  className={`border-b text-[10px] font-bold ${
                    isRetro
                      ? 'bg-[#ece9d8] text-black border-[#808080]'
                      : isDark
                      ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}
                >
                  <th className="py-1 px-2 w-10 text-center">No</th>
                  <th className="py-1 px-2 w-24">레지스터</th>
                  <th className="py-1 px-2 w-20">오프셋</th>
                  <th className="py-1 px-2 w-24">타입</th>
                  <th className="py-1 px-2 w-28">HEX</th>
                  <th className="py-1 px-2">
                    변환 값 {unitSize === 'mixed' ? '(지능형 판별)' : `(${dataType.toUpperCase()})`}
                  </th>
                  <th className="py-1 px-2 w-10 text-center">복사</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 text-[11px]">
                {decodedRegisters.map((row) => (
                  <tr
                    key={row.index}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-zinc-900/60 text-zinc-300' : 'hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <td className="py-1 px-2 text-center text-zinc-400">{row.index + 1}</td>
                    <td className="py-1 px-2 font-bold text-indigo-500 dark:text-indigo-400 whitespace-nowrap">
                      {row.registerRangeLabel}
                    </td>
                    <td className="py-1 px-2 text-amber-500 dark:text-amber-400 whitespace-nowrap">{row.byteOffsetLabel}</td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      {row.typeBadge ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                            row.unitSize === 4
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                          }`}
                        >
                          {row.typeBadge}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[10px] font-mono">
                          {unitSize}B
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 font-semibold text-zinc-500 dark:text-zinc-400 font-mono whitespace-nowrap">{row.hex}</td>
                    <td className="py-1 px-2 font-bold text-emerald-600 dark:text-emerald-400">
                      {row.formattedValue}
                    </td>
                    <td className="py-1 px-2 text-center">
                      <button
                        onClick={() => handleCopySingleRegister(row.formattedValue, row.index)}
                        className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="값 복사"
                      >
                        {copiedRegIndex === row.index ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} className="text-zinc-400 hover:text-zinc-200" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Byte Visualizer Grid & Hex Dump */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
          <Terminal size={13} className="text-cyan-400" />
          바이트 스트림 맵 (Byte Stream Visualizer)
        </span>

        <div
          className={`p-2.5 rounded border font-mono text-xs ${
            isRetro
              ? 'bg-black text-[#55f2ff] border-[#808080]'
              : isDark
              ? 'bg-zinc-950 border-zinc-800'
              : 'bg-zinc-900 text-zinc-100 border-zinc-300'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1">
            {packetBytes.map((b, idx) => {
              const matchingFieldIndex = analysis?.fields.findIndex(
                (f) => idx >= f.byteRange[0] && idx <= f.byteRange[1]
              );
              const matchingField = matchingFieldIndex !== undefined && matchingFieldIndex >= 0
                ? analysis?.fields[matchingFieldIndex]
                : undefined;
              const isHighlighted = selectedField
                ? idx >= selectedField.byteRange[0] && idx <= selectedField.byteRange[1]
                : false;

              const fieldColor = matchingField
                ? getFieldColor(matchingField.tagColor, matchingFieldIndex)
                : null;

              return (
                <div
                  key={idx}
                  onClick={() => matchingField && setSelectedField(matchingField)}
                  title={`오프셋: [${idx}]\nHEX: 0x${b.toString(16).toUpperCase().padStart(2, '0')}\nDEC: ${b}\nASCII: ${
                    b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'
                  }\n필드: ${matchingField?.name || 'Unknown'}`}
                  className={`group relative flex flex-col items-center justify-center p-0.5 rounded min-w-[28px] cursor-pointer transition-all ${
                    isHighlighted
                      ? 'ring-2 ring-indigo-400 bg-indigo-600 text-white scale-110 z-10 shadow-lg'
                      : fieldColor
                      ? `${fieldColor.streamClass} hover:scale-105`
                      : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:scale-105'
                  }`}
                >
                  <span className="text-[8px] opacity-50 font-sans">{idx}</span>
                  <span className="font-bold text-[11px]">{b.toString(16).toUpperCase().padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>

          {/* ASCII Equivalent Line */}
          <div className="mt-2 pt-1.5 border-t border-zinc-800 text-[10px] text-zinc-400 flex items-center gap-1.5">
            <span className="text-zinc-500 select-none">ASCII:</span>
            <span className="text-emerald-400 font-bold tracking-widest break-all">
              {packetBytes.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PacketInspectorModal: React.FC<PacketInspectorModalProps> = ({
  isOpen,
  onClose,
  theme,
  packet,
  allPackets,
  onApplyToSend
}) => {
  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  // 1. Detect Paired Packet (TX ↔ RX)
  const pairInfo = useMemo<PacketPairInfo | null>(() => {
    if (!packet || !allPackets) return null;
    return findPairedPacket(packet, allPackets);
  }, [packet, allPackets]);

  // 2. View mode state: 'dual' | 'left' | 'right'
  const [viewMode, setViewMode] = useState<'dual' | 'left' | 'right'>('dual');
  const prevPacketIdRef = useRef<string | null>(null);

  // Reset viewMode to 'dual' only when opening the modal or selecting a completely different packet to inspect
  useEffect(() => {
    if (!isOpen) {
      prevPacketIdRef.current = null;
      return;
    }
    if (packet && packet.id !== prevPacketIdRef.current) {
      prevPacketIdRef.current = packet.id;
      setViewMode('dual');
    }
  }, [isOpen, packet?.id]);

  // Close modal on ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !packet) return null;

  const isDualActive = !!pairInfo && viewMode === 'dual';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className={`relative w-full ${
          isDualActive ? 'w-[97vw] max-w-[1780px] h-[93vh]' : 'max-w-5xl max-h-[94vh]'
        } flex flex-col rounded-lg shadow-2xl overflow-hidden border transition-all duration-200 ${
          isRetro
            ? 'bg-[#d4d0c8] text-black border-[#808080]'
            : isDark
            ? 'bg-[#18181b] text-zinc-100 border-zinc-700 shadow-zinc-950/50'
            : 'bg-white text-zinc-800 border-zinc-300 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b select-none shrink-0 gap-3 flex-wrap ${
            isRetro
              ? 'bg-[#000080] text-white'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-slate-100 border-slate-200'
          }`}
        >
          {/* Title & Pairing Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Search size={18} className={isRetro ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'} />
            <span className="font-bold text-sm tracking-wide">
              {isDualActive
                ? pairInfo?.flowOrder === 'rx-first'
                  ? 'RX ⇄ TX 연계 패킷 통합 분석기 (Dual Inspector)'
                  : 'TX ⇄ RX 연계 패킷 통합 분석기 (Dual Inspector)'
                : '패킷 프로토콜 상세 분석기 (Packet Inspector)'}
            </span>

            {/* Paired Status & RTT Latency Badge */}
            {pairInfo && (
              <>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <ArrowRightLeft size={12} />
                  <span>연계 패킷 매핑</span>
                </span>

                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-2xs"
                  title={`응답 지연시간 (RTT): ${pairInfo.latencyMs}ms\n매칭 사유: ${pairInfo.matchReason}`}
                >
                  <Clock size={12} />
                  <span>RTT: +{pairInfo.latencyMs}ms</span>
                </span>
              </>
            )}
          </div>

          {/* Center/Right: View Mode Selector (Dual / Left / Right) */}
          <div className="flex items-center gap-2">
            {pairInfo && (
              <div
                className={`inline-flex rounded p-0.5 border text-xs font-semibold ${
                  isRetro
                    ? 'bg-[#ece9d8] border-[#808080]'
                    : isDark
                    ? 'bg-zinc-950 border-zinc-700'
                    : 'bg-white border-zinc-300 shadow-2xs'
                }`}
              >
                <button
                  onClick={() => setViewMode('dual')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
                    viewMode === 'dual'
                      ? isRetro
                        ? 'bg-[#000080] text-white font-bold'
                        : 'bg-indigo-600 text-white font-bold shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                  title="요청과 응답을 좌우로 나란히 비교"
                >
                  <ArrowRightLeft size={12} />
                  <span>
                    {pairInfo.flowOrder === 'rx-first' ? 'RX+TX 듀얼 비교' : 'TX+RX 듀얼 비교'}
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('left')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
                    viewMode === 'left'
                      ? isRetro
                        ? 'bg-[#000080] text-white font-bold'
                        : 'bg-indigo-600 text-white font-bold shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                  title={pairInfo.flowOrder === 'rx-first' ? 'RX 수신 요청 패킷만 보기' : 'TX 송신 요청 패킷만 보기'}
                >
                  {pairInfo.flowOrder === 'rx-first' ? (
                    <>
                      <Download size={11} />
                      <span>RX 요청만</span>
                    </>
                  ) : (
                    <>
                      <Send size={11} />
                      <span>TX 요청만</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setViewMode('right')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all cursor-pointer ${
                    viewMode === 'right'
                      ? isRetro
                        ? 'bg-[#000080] text-white font-bold'
                        : 'bg-indigo-600 text-white font-bold shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200'
                      : 'text-zinc-600 hover:text-black'
                  }`}
                  title={pairInfo.flowOrder === 'rx-first' ? 'TX 송신 응답 패킷만 보기' : 'RX 수신 응답 패킷만 보기'}
                >
                  {pairInfo.flowOrder === 'rx-first' ? (
                    <>
                      <Send size={11} />
                      <span>TX 응답만</span>
                    </>
                  ) : (
                    <>
                      <Download size={11} />
                      <span>RX 응답만</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className={`p-1.5 rounded hover:bg-black/20 transition-colors cursor-pointer ${
                isRetro ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
              }`}
              title="닫기 (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Left and Right Independent Scroll Areas */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {pairInfo ? (
            viewMode === 'dual' ? (
              <div className="h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
                {/* Left: Request (Stimulus) Pane - Independent Scroll Area */}
                <div className="h-full overflow-y-auto p-3 sm:p-4 lg:pr-3">
                  <PacketInspectPane
                    packet={pairInfo.leftPacket}
                    theme={theme}
                    isRetro={isRetro}
                    isDark={isDark}
                    isDual={true}
                    role="req"
                    customRoleTitle={
                      pairInfo.flowOrder === 'rx-first' ? 'RX (수신 요청)' : 'TX (송신 요청)'
                    }
                    onApplyToSend={onApplyToSend}
                  />
                </div>

                {/* Right: Response Pane - Independent Scroll Area */}
                <div className="h-full overflow-y-auto p-3 sm:p-4 lg:pl-3">
                  <PacketInspectPane
                    packet={pairInfo.rightPacket}
                    theme={theme}
                    isRetro={isRetro}
                    isDark={isDark}
                    isDual={true}
                    role="res"
                    customRoleTitle={
                      pairInfo.flowOrder === 'rx-first' ? 'TX (송신 응답)' : 'RX (수신 응답)'
                    }
                    onApplyToSend={onApplyToSend}
                  />
                </div>
              </div>
            ) : viewMode === 'left' ? (
              <div className="h-full overflow-y-auto p-3 sm:p-4">
                <PacketInspectPane
                  packet={pairInfo.leftPacket}
                  theme={theme}
                  isRetro={isRetro}
                  isDark={isDark}
                  isDual={false}
                  role="req"
                  customRoleTitle={
                    pairInfo.flowOrder === 'rx-first' ? 'RX (수신 요청)' : 'TX (송신 요청)'
                  }
                  onApplyToSend={onApplyToSend}
                />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-3 sm:p-4">
                <PacketInspectPane
                  packet={pairInfo.rightPacket}
                  theme={theme}
                  isRetro={isRetro}
                  isDark={isDark}
                  isDual={false}
                  role="res"
                  customRoleTitle={
                    pairInfo.flowOrder === 'rx-first' ? 'TX (송신 응답)' : 'RX (수신 응답)'
                  }
                  onApplyToSend={onApplyToSend}
                />
              </div>
            )
          ) : (
            /* Standalone Single Packet */
            <div className="h-full overflow-y-auto p-3 sm:p-4">
              <PacketInspectPane
                packet={packet}
                theme={theme}
                isRetro={isRetro}
                isDark={isDark}
                isDual={false}
                role="standalone"
                onApplyToSend={onApplyToSend}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-4 py-2.5 border-t select-none shrink-0 ${
            isRetro
              ? 'bg-[#ece9d8] border-[#808080]'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          <div className="text-xs opacity-70 flex items-center gap-2">
            {pairInfo && (
              <span className="hidden sm:inline">
                매칭 정보: {pairInfo.matchReason} (RTT: +{pairInfo.latencyMs}ms)
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
              isRetro
                ? 'bg-[#d4d0c8] border border-[#808080] hover:bg-white text-black'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
            }`}
          >
            닫기 (ESC)
          </button>
        </div>
      </div>
    </div>
  );
};

export default PacketInspectorModal;
