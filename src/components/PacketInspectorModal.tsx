import React, { useState, useMemo, useEffect } from 'react';
import type { AppTheme, Packet } from '../types';
import {
  X,
  Search,
  Check,
  Copy,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Layers,
  FileText,
  Terminal,
  Activity
} from 'lucide-react';
import { analyzePacket, type ParsedPacketResult, type PacketField } from '../utils/packetParser';
import { hexStringToBytes } from '../utils/crc';

interface PacketInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  packet: Packet | null;
  onApplyToSend?: (data: string, format: 'hex' | 'ascii') => void;
}

export const PacketInspectorModal: React.FC<PacketInspectorModalProps> = ({
  isOpen,
  onClose,
  theme,
  packet,
  onApplyToSend
}) => {
  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  const [copiedHex, setCopiedHex] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [selectedField, setSelectedField] = useState<PacketField | null>(null);

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

  if (!isOpen || !packet) return null;

  // Format timestamp
  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const sss = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${sss}`;
  };

  const rawHexStr = packetBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

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
      `=== [패킷 분석 리포트] ===`,
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
      }),
      ``,
      `[원문 HEX]`,
      rawHexStr
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 1500);
  };

  const isRx = packet.direction === 'rx';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden border ${
          isRetro
            ? 'bg-[#d4d0c8] text-black border-[#808080]'
            : isDark
            ? 'bg-[#18181b] text-zinc-100 border-zinc-700 shadow-zinc-950/50'
            : 'bg-white text-zinc-800 border-zinc-300 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b select-none ${
            isRetro
              ? 'bg-[#000080] text-white'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <Search size={18} className={isRetro ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'} />
            <span className="font-bold text-sm tracking-wide">패킷 프로토콜 상세 분석기 (Packet Inspector)</span>

            {/* Direction Badge */}
            <span
              style={{
                backgroundColor: isRx ? theme.rxColor : theme.txColor,
                color: theme.textColor || '#000'
              }}
              className="px-2 py-0.5 rounded text-xs font-black uppercase shadow-xs ml-2"
            >
              {isRx ? 'RX (수신)' : 'TX (송신)'}
            </span>

            {/* Timestamp */}
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded ${
                isRetro
                  ? 'bg-black/30 text-white'
                  : isDark
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  : 'bg-white text-zinc-700 border border-zinc-300'
              }`}
            >
              {formatTimestamp(packet.timestamp)}
            </span>

            {/* Length Badge */}
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded font-bold ${
                isRetro
                  ? 'bg-[#15213b] text-[#55f2ff]'
                  : isDark
                  ? 'bg-zinc-950 text-amber-400 border border-zinc-700'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              {packetBytes.length} Bytes
            </span>

            {/* Protocol Badge */}
            {analysis && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-bold border ${
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

          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-black/20 transition-colors ${
              isRetro ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary Banner */}
          {analysis && (
            <div
              className={`p-3 rounded-md border flex items-start gap-3 shadow-xs ${
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
                  <ShieldAlert size={20} className="text-rose-400" />
                ) : analysis.isModbus ? (
                  <ShieldCheck size={20} className="text-emerald-400" />
                ) : (
                  <Activity size={20} className="text-indigo-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                  <span>{analysis.summary}</span>
                  {analysis.isValidCrc === true && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-normal border border-emerald-500/30">
                      CRC-16 Modbus 정상
                    </span>
                  )}
                  {analysis.isValidCrc === false && (
                    <span className="text-[11px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                      CRC-16 불일치 (손상 가능성)
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {analysis.protocol === 'modbus-tcp' &&
                    'MBAP 헤더(7B: TID/ProtoID/Length/UnitID)와 Modbus PDU 페이로드가 완벽히 분석되었습니다.'}
                  {analysis.protocol === 'modbus-rtu' &&
                    '슬레이브 국번(1B), 기능 코드(1B), 데이터 필드 및 16비트 CRC 체크섬(LSB First) 구조입니다.'}
                  {analysis.protocol === 'custom-frame' &&
                    '표준 Modbus 시그니처가 없거나 STX/ETX 형태의 일반 시리얼/TCP 데이터 프레임입니다.'}
                </div>
              </div>
            </div>
          )}

          {/* Decoded Fields Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                <Layers size={14} className="text-indigo-400" />
                프레임 필드 구조 분석 (Field Breakdown)
              </span>
              <span className="text-[11px] opacity-60">총 {analysis?.fields.length || 0}개 필드 식별됨</span>
            </div>

            <div
              className={`rounded border overflow-hidden ${
                isRetro
                  ? 'bg-white border-[#808080]'
                  : isDark
                  ? 'bg-zinc-900/80 border-zinc-800'
                  : 'bg-white border-zinc-200 shadow-xs'
              }`}
            >
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr
                    className={`border-b select-none text-[11px] font-bold ${
                      isRetro
                        ? 'bg-[#ece9d8] text-black border-[#808080]'
                        : isDark
                        ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}
                  >
                    <th className="py-1.5 px-3 w-12 text-center">No</th>
                    <th className="py-1.5 px-3 w-24 text-center">오프셋</th>
                    <th className="py-1.5 px-3 w-44">필드명</th>
                    <th className="py-1.5 px-3 w-36">HEX</th>
                    <th className="py-1.5 px-3 w-32">파싱 값 (DEC/의미)</th>
                    <th className="py-1.5 px-3">설명 및 표준 규격</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {analysis?.fields.map((field, idx) => {
                    const isSelected = selectedField?.name === field.name;
                    const rangeStr =
                      field.byteRange[0] === field.byteRange[1]
                        ? `[${field.byteRange[0]}]`
                        : `[${field.byteRange[0]}..${field.byteRange[1]}]`;

                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedField(field)}
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
                        <td className="py-2 px-3 text-center text-zinc-400">{idx + 1}</td>
                        <td className="py-2 px-3 text-center font-bold text-amber-500 dark:text-amber-400">
                          {rangeStr}
                        </td>
                        <td className="py-2 px-3 font-semibold font-sans flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              field.tagColor === 'rose'
                                ? 'bg-rose-500'
                                : field.tagColor === 'emerald'
                                ? 'bg-emerald-500'
                                : field.tagColor === 'amber'
                                ? 'bg-amber-500'
                                : field.tagColor === 'blue'
                                ? 'bg-blue-500'
                                : 'bg-zinc-500'
                            }`}
                          />
                          <span>{field.name}</span>
                        </td>
                        <td className="py-2 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                          {field.hex}
                        </td>
                        <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                          {field.dec !== undefined ? String(field.dec) : '-'}
                        </td>
                        <td className="py-2 px-3 font-sans text-xs text-zinc-500 dark:text-zinc-400">
                          {field.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Byte Visualizer Grid & Hex Dump */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-80">
              <Terminal size={14} className="text-cyan-400" />
              바이트 스트림 맵 (Byte Stream Visualizer)
            </span>

            <div
              className={`p-3 rounded border font-mono text-xs ${
                isRetro
                  ? 'bg-black text-[#55f2ff] border-[#808080]'
                  : isDark
                  ? 'bg-zinc-950 border-zinc-800'
                  : 'bg-zinc-900 text-zinc-100 border-zinc-300'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {packetBytes.map((b, idx) => {
                  const matchingField = analysis?.fields.find(
                    (f) => idx >= f.byteRange[0] && idx <= f.byteRange[1]
                  );
                  const isHighlighted = selectedField
                    ? idx >= selectedField.byteRange[0] && idx <= selectedField.byteRange[1]
                    : false;

                  return (
                    <div
                      key={idx}
                      onClick={() => matchingField && setSelectedField(matchingField)}
                      title={`오프셋: [${idx}]\nHEX: 0x${b.toString(16).toUpperCase().padStart(2, '0')}\nDEC: ${b}\nASCII: ${
                        b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'
                      }\n필드: ${matchingField?.name || 'Unknown'}`}
                      className={`group relative flex flex-col items-center justify-center p-1 rounded min-w-[32px] cursor-pointer transition-all ${
                        isHighlighted
                          ? 'ring-2 ring-indigo-400 bg-indigo-600 text-white scale-110 z-10 shadow-lg'
                          : matchingField?.tagColor === 'rose'
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-700/60 hover:scale-105'
                          : matchingField?.tagColor === 'emerald'
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 hover:scale-105'
                          : matchingField?.tagColor === 'amber'
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-700/60 hover:scale-105'
                          : matchingField?.tagColor === 'blue'
                          ? 'bg-sky-950/70 text-sky-300 border border-sky-700/60 hover:scale-105'
                          : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:scale-105'
                      }`}
                    >
                      <span className="text-[9px] opacity-50 font-sans">{idx}</span>
                      <span className="font-bold text-[12px]">{b.toString(16).toUpperCase().padStart(2, '0')}</span>
                    </div>
                  );
                })}
              </div>

              {/* ASCII Equivalent Line */}
              <div className="mt-3 pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
                <span className="text-zinc-500 select-none">ASCII:</span>
                <span className="text-emerald-400 font-bold tracking-widest break-all">
                  {packetBytes.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-t select-none flex-wrap gap-2 ${
            isRetro
              ? 'bg-[#ece9d8] border-[#808080]'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Copy HEX */}
            <button
              onClick={handleCopyHex}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs ${
                copiedHex
                  ? 'bg-emerald-600 text-white'
                  : isRetro
                  ? 'bg-[#d4d0c8] border border-[#808080] hover:bg-white text-black'
                  : isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  : 'bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300'
              }`}
            >
              {copiedHex ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedHex ? '전체 HEX 복사됨!' : '전체 HEX 복사'}</span>
            </button>

            {/* Copy Report */}
            <button
              onClick={handleCopyReport}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs ${
                copiedReport
                  ? 'bg-emerald-600 text-white'
                  : isRetro
                  ? 'bg-[#d4d0c8] border border-[#808080] hover:bg-white text-black'
                  : isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                  : 'bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300'
              }`}
            >
              {copiedReport ? <Check size={14} /> : <FileText size={14} />}
              <span>{copiedReport ? '리포트 복사됨!' : '분석 리포트 복사'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onApplyToSend && (
              <button
                onClick={() => {
                  onApplyToSend(rawHexStr, 'hex');
                  onClose();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs ${
                  isRetro
                    ? 'bg-[#000080] text-white hover:bg-[#0000a0]'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <ArrowUpRight size={14} />
                <span>전송창에 패킷 넣기</span>
              </button>
            )}

            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
                isRetro
                  ? 'bg-[#d4d0c8] border border-[#808080] hover:bg-white text-black'
                  : isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                  : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
              }`}
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
