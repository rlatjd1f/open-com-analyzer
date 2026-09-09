import React, { useState } from 'react';
import type { AppTheme } from '../types';
import {
  calculateSumCheck8,
  calculateSumCheck16,
  calculateCrc16Modbus,
  calculateCrc16Ccitt,
  hexStringToBytes,
  bytesToHexString,
  bytesToAscii,
  asciiToBytes,
  hexToFloat32,
  float32ToHex
} from '../utils/crc';
import { ArrowUpRight, Copy, Check } from 'lucide-react';

interface UtilityPanelProps {
  theme: AppTheme;
  onApplyToSend: (val: string) => void;
}

export const UtilityPanel: React.FC<UtilityPanelProps> = ({
  theme,
  onApplyToSend
}) => {
  // 1. Sum Check state
  const [sumInput, setSumInput] = useState('');
  const [sumMode, setSumMode] = useState<'hex' | 'ascii'>('hex');

  // 2. CRC-16 Check state
  const [crcInput, setCrcInput] = useState('');
  const [crcAlgorithm, setCrcAlgorithm] = useState<'modbus' | 'ccitt'>('modbus');

  // 3. HEX <-> ASCII state
  const [asciiInput, setAsciiInput] = useState('');
  const [asciiMode, setAsciiMode] = useState<'hexToAscii' | 'asciiToHex'>('hexToAscii');

  // 4. IEEE-754 Float32 <-> HEX state
  const [floatInput, setFloatInput] = useState('');
  const [floatMode, setFloatMode] = useState<'hexToFloat' | 'floatToHex'>('hexToFloat');
  const [floatEndian, setFloatEndian] = useState<'ABCD' | 'CDAB'>('ABCD');

  const [copiedCol, setCopiedCol] = useState<number | null>(null);

  const handleCopy = (text: string, colIdx: number) => {
    if (!text || text === '-' || text === 'ERR') return;
    navigator.clipboard.writeText(text);
    setCopiedCol(colIdx);
    setTimeout(() => setCopiedCol(null), 1500);
  };

  // 1. Compute Sum Check
  const sumResult = React.useMemo(() => {
    if (!sumInput.trim()) {
      return { s8Hex: '', s16Hex: '', display: '-' };
    }
    try {
      const bytes = sumMode === 'hex' ? hexStringToBytes(sumInput) : asciiToBytes(sumInput);
      if (bytes.length === 0) return { s8Hex: '', s16Hex: '', display: '-' };
      const s8 = calculateSumCheck8(bytes);
      const s16 = calculateSumCheck16(bytes);
      return {
        s8Hex: s8.toString(16).toUpperCase().padStart(2, '0'),
        s16Hex: s16.toString(16).toUpperCase().padStart(4, '0'),
        display: `8B: 0x${s8.toString(16).toUpperCase().padStart(2, '0')} | 16B: 0x${s16.toString(16).toUpperCase().padStart(4, '0')}`
      };
    } catch {
      return { s8Hex: '', s16Hex: '', display: 'ERR' };
    }
  }, [sumInput, sumMode]);

  // 2. Compute CRC-16
  const crcResult = React.useMemo(() => {
    if (!crcInput.trim()) {
      return { hex: '', display: '-', fullPacketWithCrc: '' };
    }
    try {
      const bytes = hexStringToBytes(crcInput);
      if (bytes.length === 0) return { hex: '', display: '-', fullPacketWithCrc: '' };
      if (crcAlgorithm === 'modbus') {
        const crc = calculateCrc16Modbus(bytes);
        const low = (crc & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        const high = ((crc >> 8) & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        return {
          hex: `${low}${high}`, // Modbus standard: LSB first
          display: `${low} ${high} (0x${crc.toString(16).toUpperCase().padStart(4, '0')})`,
          fullPacketWithCrc: `${crcInput.replace(/\s+/g, '')}${low}${high}`
        };
      } else {
        const crc = calculateCrc16Ccitt(bytes);
        const hex = crc.toString(16).toUpperCase().padStart(4, '0');
        return {
          hex,
          display: `0x${hex}`,
          fullPacketWithCrc: `${crcInput.replace(/\s+/g, '')}${hex}`
        };
      }
    } catch {
      return { hex: '', display: 'ERR', fullPacketWithCrc: '' };
    }
  }, [crcInput, crcAlgorithm]);

  // 3. Compute HEX <-> ASCII
  const asciiResult = React.useMemo(() => {
    if (!asciiInput.trim()) return { display: '-', applyVal: '' };
    try {
      if (asciiMode === 'hexToAscii') {
        const bytes = hexStringToBytes(asciiInput);
        if (bytes.length === 0) return { display: '-', applyVal: '' };
        const text = bytesToAscii(bytes);
        return { display: text, applyVal: text };
      } else {
        const bytes = asciiToBytes(asciiInput);
        if (bytes.length === 0) return { display: '-', applyVal: '' };
        const hex = bytesToHexString(bytes);
        return { display: hex, applyVal: hex.replace(/\s+/g, '') };
      }
    } catch {
      return { display: 'ERR', applyVal: '' };
    }
  }, [asciiInput, asciiMode]);

  // 4. Compute IEEE-754 Float32 <-> HEX
  const floatResult = React.useMemo(() => {
    if (!floatInput.trim()) return { display: '-', applyVal: '', rawHex: '' };
    try {
      if (floatMode === 'hexToFloat') {
        const { float32, formatted, fullHexPadded } = hexToFloat32(floatInput, floatEndian);
        if (float32 === null) return { display: 'ERR', applyVal: '', rawHex: '' };
        return {
          display: `${formatted} (HEX: ${fullHexPadded})`,
          applyVal: fullHexPadded.replace(/\s+/g, ''),
          rawHex: fullHexPadded
        };
      } else {
        const val = parseFloat(floatInput);
        if (isNaN(val)) return { display: 'ERR', applyVal: '', rawHex: '' };
        const { hexFormatted, hex } = float32ToHex(val, floatEndian);
        return {
          display: hexFormatted,
          applyVal: hex,
          rawHex: hexFormatted
        };
      }
    } catch {
      return { display: 'ERR', applyVal: '', rawHex: '' };
    }
  }, [floatInput, floatMode, floatEndian]);

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-2.5 border-t select-none ${
        isRetro
          ? 'bg-[#ece9d8] text-black border-[#808080]'
          : isDark
          ? 'bg-[#18181b] text-zinc-300 border-zinc-800'
          : 'bg-[#f4f4f5] text-zinc-700 border-zinc-200'
      }`}
    >
      {/* Column 1: Sum Check */}
      <div
        className={`flex flex-col gap-1 p-2 rounded border ${
          isRetro ? 'bg-[#d4d0c8] border-[#ffffff] shadow-sm' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
        }`}
      >
        <button
          className={`py-0.5 rounded font-bold text-xs text-center ${
            isRetro
              ? 'bg-[#e0ded8] border border-[#808080] shadow-sm text-black'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}
        >
          Sum Check
        </button>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
          <span>{sumMode === 'hex' ? 'HEX 입력' : 'ASCII 입력'}</span>
          <button
            onClick={() => setSumMode(sumMode === 'hex' ? 'ascii' : 'hex')}
            className="hover:underline text-indigo-400"
          >
            [모드전환]
          </button>
        </div>
        <input
          type="text"
          value={sumInput}
          onChange={(e) => setSumInput(e.target.value)}
          placeholder="데이터 입력..."
          className={`h-6 px-1.5 font-mono text-xs rounded border outline-none ${
            isRetro
              ? 'bg-white text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
              : 'bg-zinc-50 text-zinc-900 border-zinc-300'
          }`}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5 mt-0.5">
          <span>RESULT</span>
          <button
            onClick={() => handleCopy(sumResult.s8Hex, 1)}
            className="hover:text-indigo-400 flex items-center gap-0.5"
            title="8-bit 체크섬 복사"
          >
            {copiedCol === 1 ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          </button>
        </div>
        <div
          className={`h-6 px-1.5 font-mono text-xs flex items-center justify-between rounded border font-semibold ${
            isRetro
              ? 'bg-[#ffffff] text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-950 text-emerald-400 border-zinc-800'
              : 'bg-zinc-100 text-emerald-600 border-zinc-300'
          }`}
        >
          <span className="truncate">{sumResult.display}</span>
          <button
            onClick={() => onApplyToSend(sumInput + sumResult.s8Hex)}
            className="ml-1 text-zinc-400 hover:text-indigo-400"
            title="체크섬을 덧붙여 전송창으로 복사"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Column 2: CRC-16 Check */}
      <div
        className={`flex flex-col gap-1 p-2 rounded border ${
          isRetro ? 'bg-[#d4d0c8] border-[#ffffff] shadow-sm' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
        }`}
      >
        <button
          className={`py-0.5 rounded font-bold text-xs text-center ${
            isRetro
              ? 'bg-[#e0ded8] border border-[#808080] shadow-sm text-black'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}
        >
          CRC-16 Check
        </button>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
          <span>Binary (HEX) 입력</span>
          <button
            onClick={() => setCrcAlgorithm(crcAlgorithm === 'modbus' ? 'ccitt' : 'modbus')}
            className="hover:underline text-indigo-400"
          >
            [{crcAlgorithm === 'modbus' ? 'Modbus' : 'CCITT'}]
          </button>
        </div>
        <input
          type="text"
          value={crcInput}
          onChange={(e) => setCrcInput(e.target.value)}
          placeholder="예: 010600EF0001"
          className={`h-6 px-1.5 font-mono text-xs rounded border outline-none ${
            isRetro
              ? 'bg-white text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
              : 'bg-zinc-50 text-zinc-900 border-zinc-300'
          }`}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5 mt-0.5">
          <span>RESULT (LSB first)</span>
          <button
            onClick={() => handleCopy(crcResult.hex, 2)}
            className="hover:text-indigo-400 flex items-center gap-0.5"
            title="CRC 복사"
          >
            {copiedCol === 2 ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          </button>
        </div>
        <div
          className={`h-6 px-1.5 font-mono text-xs flex items-center justify-between rounded border font-semibold ${
            isRetro
              ? 'bg-[#ffffff] text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-950 text-amber-400 border-zinc-800'
              : 'bg-zinc-100 text-amber-600 border-zinc-300'
          }`}
        >
          <span className="truncate">{crcResult.display}</span>
          <button
            onClick={() => onApplyToSend(crcResult.fullPacketWithCrc)}
            className="ml-1 text-zinc-400 hover:text-indigo-400"
            title="전체 패킷 + CRC를 전송창에 적용"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Column 3: HEX <-> ASCII */}
      <div
        className={`flex flex-col gap-1 p-2 rounded border ${
          isRetro ? 'bg-[#d4d0c8] border-[#ffffff] shadow-sm' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
        }`}
      >
        <button
          onClick={() => setAsciiMode(asciiMode === 'hexToAscii' ? 'asciiToHex' : 'hexToAscii')}
          className={`py-0.5 rounded font-bold text-xs text-center transition-colors cursor-pointer ${
            isRetro
              ? 'bg-[#e0ded8] border border-[#808080] shadow-sm text-black hover:bg-white'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
          }`}
          title="클릭 시 HEX ↔ ASCII 모드 전환"
        >
          {asciiMode === 'hexToAscii' ? 'HEX → ASCII 변환' : 'ASCII → HEX 변환'}
        </button>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
          <span>{asciiMode === 'hexToAscii' ? 'HEX 바이너리 입력' : 'ASCII 텍스트 입력'}</span>
          <button
            onClick={() => setAsciiMode(asciiMode === 'hexToAscii' ? 'asciiToHex' : 'hexToAscii')}
            className="hover:underline text-indigo-400 font-bold cursor-pointer"
          >
            [{asciiMode === 'hexToAscii' ? 'ASCII→HEX' : 'HEX→ASCII'}]
          </button>
        </div>
        <input
          type="text"
          value={asciiInput}
          onChange={(e) => setAsciiInput(e.target.value)}
          placeholder={asciiMode === 'hexToAscii' ? '예: 48 65 6C 6C 6F' : '예: Hello'}
          className={`h-6 px-1.5 font-mono text-xs rounded border outline-none ${
            isRetro
              ? 'bg-white text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
              : 'bg-zinc-50 text-zinc-900 border-zinc-300'
          }`}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5 mt-0.5">
          <span>RESULT ({asciiMode === 'hexToAscii' ? 'ASCII' : 'HEX'})</span>
          <button
            onClick={() => handleCopy(asciiResult.display, 3)}
            className="hover:text-indigo-400 flex items-center gap-0.5 cursor-pointer"
            title="결과 복사"
          >
            {copiedCol === 3 ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          </button>
        </div>
        <div
          className={`h-6 px-1.5 font-mono text-xs flex items-center justify-between rounded border font-semibold ${
            isRetro
              ? 'bg-[#ffffff] text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-950 text-cyan-400 border-zinc-800'
              : 'bg-zinc-100 text-cyan-600 border-zinc-300'
          }`}
        >
          <span className="truncate">{asciiResult.display}</span>
          <button
            onClick={() => asciiResult.applyVal && onApplyToSend(asciiResult.applyVal)}
            className="ml-1 text-zinc-400 hover:text-indigo-400 cursor-pointer"
            title="전송창에 적용"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Column 4: IEEE-754 Float32 <-> HEX / ASCII */}
      <div
        className={`flex flex-col gap-1 p-2 rounded border ${
          isRetro ? 'bg-[#d4d0c8] border-[#ffffff] shadow-sm' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
        }`}
      >
        <button
          onClick={() => setFloatMode(floatMode === 'hexToFloat' ? 'floatToHex' : 'hexToFloat')}
          className={`py-0.5 rounded font-bold text-xs text-center transition-colors cursor-pointer ${
            isRetro
              ? 'bg-[#e0ded8] border border-[#808080] shadow-sm text-black hover:bg-white'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
          }`}
          title="클릭 시 HEX ↔ Float(ASCII) 모드 전환"
        >
          {floatMode === 'hexToFloat' ? 'HEX → Float32 변환' : 'ASCII(실수) → Float32 HEX 변환'}
        </button>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
          <span>{floatMode === 'hexToFloat' ? 'HEX 입력 (예: 3F C0)' : 'ASCII 실수 입력 (예: 1.5)'}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFloatEndian(floatEndian === 'ABCD' ? 'CDAB' : 'ABCD')}
              className="hover:underline text-amber-500 font-bold cursor-pointer"
              title="바이트/워드 순서 전환 (ABCD / CDAB)"
            >
              [{floatEndian}]
            </button>
            <button
              onClick={() => setFloatMode(floatMode === 'hexToFloat' ? 'floatToHex' : 'hexToFloat')}
              className="hover:underline text-indigo-400 font-bold cursor-pointer"
            >
              [{floatMode === 'hexToFloat' ? 'ASCII→HEX' : 'HEX→Float'}]
            </button>
          </div>
        </div>
        <input
          type="text"
          value={floatInput}
          onChange={(e) => setFloatInput(e.target.value)}
          placeholder={floatMode === 'hexToFloat' ? '예: 3F C0 또는 3FC00000' : '예: 1.5'}
          className={`h-6 px-1.5 font-mono text-xs rounded border outline-none ${
            isRetro
              ? 'bg-white text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
              : 'bg-zinc-50 text-zinc-900 border-zinc-300'
          }`}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5 mt-0.5">
          <span>RESULT ({floatMode === 'hexToFloat' ? 'Float32 실수' : 'HEX 바이트'})</span>
          <button
            onClick={() => handleCopy(floatResult.display.split(' ')[0], 4)}
            className="hover:text-indigo-400 flex items-center gap-0.5 cursor-pointer"
            title="결과 복사"
          >
            {copiedCol === 4 ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          </button>
        </div>
        <div
          className={`h-6 px-1.5 font-mono text-xs flex items-center justify-between rounded border font-semibold ${
            isRetro
              ? 'bg-[#ffffff] text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-950 text-emerald-400 border-zinc-800'
              : 'bg-zinc-100 text-emerald-600 border-zinc-300'
          }`}
        >
          <span className="truncate">{floatResult.display}</span>
          <button
            onClick={() => floatResult.applyVal && onApplyToSend(floatResult.applyVal)}
            className="ml-1 text-zinc-400 hover:text-indigo-400 cursor-pointer"
            title="전송창에 적용"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
export default UtilityPanel;
