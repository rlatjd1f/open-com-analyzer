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
  Activity,
  Sparkles,
  Database
} from 'lucide-react';
import {
  analyzePacket,
  guessModbusDataType,
  decodeRegisterPayload,
  type ParsedPacketResult,
  type PacketField,
  type HeuristicTypeGuess,
  type DecodedRegisterRow
} from '../utils/packetParser';
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
  const [copiedRegs, setCopiedRegs] = useState(false);
  const [copiedRegIndex, setCopiedRegIndex] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<PacketField | null>(null);

  // Register Payload Decoder Settings State
  const [unitSize, setUnitSize] = useState<2 | 4 | 8>(4);
  const [dataType, setDataType] = useState<string>('float32');
  const [byteOrder, setByteOrder] = useState<string>('ABCD');

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

  // Heuristic Type Guess for Register Payload
  const typeGuess = useMemo<HeuristicTypeGuess | null>(() => {
    if (!analysis?.registerPayload || analysis.registerPayload.length === 0) return null;
    return guessModbusDataType(analysis.registerPayload);
  }, [analysis?.registerPayload]);

  // Auto-initialize register format settings based on heuristic guess when packet opens
  useEffect(() => {
    if (typeGuess) {
      setUnitSize(typeGuess.unitSize);
      setDataType(typeGuess.dataType);
      setByteOrder(typeGuess.byteOrder);
    }
  }, [typeGuess]);

  // Handle unit size changes & auto-adjust data type / byte order to sensible defaults
  const handleUnitSizeChange = (newSize: 2 | 4 | 8) => {
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
    return decodeRegisterPayload(analysis.registerPayload, unitSize, dataType, byteOrder, 0);
  }, [analysis?.registerPayload, unitSize, dataType, byteOrder]);

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
      })
    ];

    if (decodedRegisters.length > 0) {
      lines.push(``);
      lines.push(`[레지스터 디코딩 (${unitSize}B 단위 / ${dataType} / ${byteOrder})]`);
      decodedRegisters.forEach((row) => {
        lines.push(`${row.registerRangeLabel} (${row.byteOffsetLabel}): ${row.formattedValue} [HEX: ${row.hex}]`);
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
      `레지스터\t오프셋\tHEX\t값(${dataType})`,
      ...decodedRegisters.map((r) => `${r.registerRangeLabel}\t${r.byteOffsetLabel}\t${r.hex}\t${r.formattedValue}`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className={`relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-lg shadow-2xl overflow-hidden border ${
          isRetro
            ? 'bg-[#d4d0c8] text-black border-[#808080]'
            : isDark
            ? 'bg-[#18181b] text-zinc-100 border-zinc-700 shadow-zinc-950/50'
            : 'bg-white text-zinc-800 border-zinc-300 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b select-none shrink-0 ${
            isRetro
              ? 'bg-[#000080] text-white'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-slate-100 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
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

          {/* ------------------------------------------------------------- */}
          {/* REGISTER PAYLOAD DECODER SECTION (2B / 4B / 8B / Float / Int) */}
          {/* ------------------------------------------------------------- */}
          {analysis?.registerPayload && analysis.registerPayload.length >= 2 && (
            <div
              className={`p-3.5 rounded-lg border space-y-3 ${
                isRetro
                  ? 'bg-[#ece9d8] border-[#808080] shadow-sm'
                  : isDark
                  ? 'bg-zinc-900/90 border-indigo-500/30 shadow-md'
                  : 'bg-indigo-50/40 border-indigo-200 shadow-xs'
              }`}
            >
              {/* Section Header & Heuristic Auto-Detect Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-indigo-500 dark:text-indigo-400" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    레지스터 페이로드 단위별 값 분석 (Register Data Decoder)
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 font-bold border border-indigo-500/20">
                    총 {analysis.registerPayload.length}B ({Math.floor(analysis.registerPayload.length / 2)}개 레지스터)
                  </span>
                </div>

                {typeGuess && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 shadow-2xs">
                      <Sparkles size={12} className="shrink-0" />
                      <span>추천: {typeGuess.label}</span>
                    </span>
                    {(unitSize !== typeGuess.unitSize || dataType !== typeGuess.dataType || byteOrder !== typeGuess.byteOrder) && (
                      <button
                        onClick={() => {
                          setUnitSize(typeGuess.unitSize);
                          setDataType(typeGuess.dataType);
                          setByteOrder(typeGuess.byteOrder);
                        }}
                        className="text-[11px] px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        추천 적용
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Controls Bar: Unit Size, Data Type, Byte Order */}
              <div
                className={`p-2.5 rounded border flex flex-wrap items-center justify-between gap-3 text-xs ${
                  isRetro
                    ? 'bg-white border-[#808080]'
                    : isDark
                    ? 'bg-zinc-950/80 border-zinc-800'
                    : 'bg-white border-zinc-200'
                }`}
              >
                {/* 1. Unit Size Selector (2B / 4B / 8B) */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 select-none">단위 크기:</span>
                  <div className="inline-flex rounded-md p-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <button
                      onClick={() => handleUnitSizeChange(2)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        unitSize === 2
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      2B (16-bit)
                    </button>
                    <button
                      onClick={() => handleUnitSizeChange(4)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        unitSize === 4
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      4B (32-bit)
                    </button>
                    <button
                      onClick={() => handleUnitSizeChange(8)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        unitSize === 8
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      8B (64-bit)
                    </button>
                  </div>
                </div>

                {/* 2. Data Type Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 select-none">표시 형식:</span>
                  <select
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value)}
                    className={`h-7 px-2 font-mono text-xs rounded border outline-none font-bold cursor-pointer ${
                      isRetro
                        ? 'bg-white text-black border-[#808080]'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                        : 'bg-zinc-50 text-zinc-900 border-zinc-300'
                    }`}
                  >
                    {unitSize === 2 && (
                      <>
                        <option value="uint16">UInt16 (부호없는 정수, 0~65535)</option>
                        <option value="int16">Int16 (부호있는 정수, -32768~32767)</option>
                        <option value="hex">HEX (16진수, 0x0000)</option>
                        <option value="binary">Binary (2진수 비트)</option>
                      </>
                    )}
                    {unitSize === 4 && (
                      <>
                        <option value="float32">Float32 (IEEE 754 32비트 실수)</option>
                        <option value="uint32">UInt32 (32비트 정수)</option>
                        <option value="int32">Int32 (32비트 부호 정수)</option>
                        <option value="hex">HEX (32비트 16진수)</option>
                      </>
                    )}
                    {unitSize === 8 && (
                      <>
                        <option value="float64">Double (IEEE 754 64비트 실수)</option>
                        <option value="uint64">UInt64 (64비트 정수)</option>
                        <option value="int64">Int64 (64비트 부호 정수)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Byte Order / Endianness Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 select-none">순서 (Endian):</span>
                  <select
                    value={byteOrder}
                    onChange={(e) => setByteOrder(e.target.value)}
                    className={`h-7 px-2 font-mono text-xs rounded border outline-none font-bold cursor-pointer ${
                      isRetro
                        ? 'bg-white text-black border-[#808080]'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
                        : 'bg-zinc-50 text-zinc-900 border-zinc-300'
                    }`}
                  >
                    {unitSize === 2 && (
                      <>
                        <option value="AB">AB (Big-Endian 표준)</option>
                        <option value="BA">BA (Little-Endian / Byte Swap)</option>
                      </>
                    )}
                    {unitSize === 4 && (
                      <>
                        <option value="ABCD">ABCD (Big-Endian 표준)</option>
                        <option value="CDAB">CDAB (Word-Swap / Modicon)</option>
                        <option value="BADC">BADC (Byte-Swap)</option>
                        <option value="DCBA">DCBA (Little-Endian)</option>
                      </>
                    )}
                    {unitSize === 8 && (
                      <>
                        <option value="ABCDEFGH">ABCDEFGH (Big-Endian 표준)</option>
                        <option value="GHEFCDAB">GHEFCDAB (Word-Swap)</option>
                        <option value="HGFEDCBA">HGFEDCBA (Little-Endian)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Batch Copy Registers Button */}
                <button
                  onClick={handleCopyAllRegisters}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all shadow-2xs cursor-pointer ${
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
                  {copiedRegs ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedRegs ? '전체 복사됨!' : '디코딩 표 복사'}</span>
                </button>
              </div>

              {/* Decoded Registers Grid / Table */}
              <div
                className={`max-h-60 overflow-y-auto rounded border font-mono text-xs ${
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
                      className={`border-b text-[11px] font-bold ${
                        isRetro
                          ? 'bg-[#ece9d8] text-black border-[#808080]'
                          : isDark
                          ? 'bg-zinc-900 text-zinc-400 border-zinc-800'
                          : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                      }`}
                    >
                      <th className="py-1.5 px-3 w-12 text-center">No</th>
                      <th className="py-1.5 px-3 w-36">레지스터 번호</th>
                      <th className="py-1.5 px-3 w-28">바이트 오프셋</th>
                      <th className="py-1.5 px-3 w-36">HEX</th>
                      <th className="py-1.5 px-3">변환 값 ({dataType.toUpperCase()})</th>
                      <th className="py-1.5 px-3 w-16 text-center">복사</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                    {decodedRegisters.map((row) => (
                      <tr
                        key={row.index}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-zinc-900/60 text-zinc-300' : 'hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-center text-zinc-400">{row.index + 1}</td>
                        <td className="py-1.5 px-3 font-bold text-indigo-500 dark:text-indigo-400">
                          {row.registerRangeLabel}
                        </td>
                        <td className="py-1.5 px-3 text-amber-500 dark:text-amber-400">{row.byteOffsetLabel}</td>
                        <td className="py-1.5 px-3 font-semibold text-zinc-500 dark:text-zinc-400">{row.hex}</td>
                        <td className="py-1.5 px-3 font-bold text-emerald-600 dark:text-emerald-400 text-[13px]">
                          {row.formattedValue}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            onClick={() => handleCopySingleRegister(row.formattedValue, row.index)}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                            title="값 복사"
                          >
                            {copiedRegIndex === row.index ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} className="text-zinc-400 hover:text-zinc-200" />
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
          className={`flex items-center justify-between px-4 py-3 border-t select-none flex-wrap gap-2 shrink-0 ${
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
