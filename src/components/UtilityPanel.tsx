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
  asciiToBytes
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

  // 3. Binary -> ASCII state
  const [binToAsciiInput, setBinToAsciiInput] = useState('');

  // 4. ASCII -> Binary state
  const [asciiToBinInput, setAsciiToBinInput] = useState('');

  const [copiedCol, setCopiedCol] = useState<number | null>(null);

  const handleCopy = (text: string, colIdx: number) => {
    if (!text || text === '-') return;
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

  // 3. Compute Binary -> ASCII
  const binToAsciiResult = React.useMemo(() => {
    if (!binToAsciiInput.trim()) return '-';
    try {
      const bytes = hexStringToBytes(binToAsciiInput);
      if (bytes.length === 0) return '-';
      return bytesToAscii(bytes);
    } catch {
      return 'ERR';
    }
  }, [binToAsciiInput]);

  // 4. Compute ASCII -> Binary
  const asciiToBinResult = React.useMemo(() => {
    if (!asciiToBinInput.trim()) return '-';
    try {
      const bytes = asciiToBytes(asciiToBinInput);
      if (bytes.length === 0) return '-';
      return bytesToHexString(bytes);
    } catch {
      return 'ERR';
    }
  }, [asciiToBinInput]);

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

      {/* Column 3: Binary -> ASCII */}
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
          Binary -{'>'} ASCII
        </button>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
          <span>Binary (HEX) 입력</span>
        </div>
        <input
          type="text"
          value={binToAsciiInput}
          onChange={(e) => setBinToAsciiInput(e.target.value)}
          placeholder="예: 48656C6C6F"
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
            onClick={() => handleCopy(binToAsciiResult, 3)}
            className="hover:text-indigo-400 flex items-center gap-0.5"
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
          <span className="truncate">{binToAsciiResult}</span>
          <button
            onClick={() => onApplyToSend(binToAsciiResult)}
            className="ml-1 text-zinc-400 hover:text-indigo-400"
            title="전송창에 적용"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Column 4: ASCII -> Binary */}
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
          ASCII -{'>'} Binary
        </button>
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
          <span>ASCII 텍스트 입력</span>
        </div>
        <input
          type="text"
          value={asciiToBinInput}
          onChange={(e) => setAsciiToBinInput(e.target.value)}
          placeholder="예: Hello"
          className={`h-6 px-1.5 font-mono text-xs rounded border outline-none ${
            isRetro
              ? 'bg-white text-black border-[#808080]'
              : isDark
              ? 'bg-zinc-800 text-zinc-100 border-zinc-700'
              : 'bg-zinc-50 text-zinc-900 border-zinc-300'
          }`}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5 mt-0.5">
          <span>RESULT (HEX)</span>
          <button
            onClick={() => handleCopy(asciiToBinResult.replace(/\s+/g, ''), 4)}
            className="hover:text-indigo-400 flex items-center gap-0.5"
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
              ? 'bg-zinc-950 text-purple-400 border-zinc-800'
              : 'bg-zinc-100 text-purple-600 border-zinc-300'
          }`}
        >
          <span className="truncate">{asciiToBinResult}</span>
          <button
            onClick={() => onApplyToSend(asciiToBinResult.replace(/\s+/g, ''))}
            className="ml-1 text-zinc-400 hover:text-indigo-400"
            title="전송창에 적용"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
