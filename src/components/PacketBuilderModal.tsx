import React, { useState, useMemo, useEffect } from 'react';
import type { AppTheme } from '../types';
import {
  X,
  Wrench,
  Layers,
  Cpu,
  Calculator,
  Copy,
  Check,
  Send,
  Plus,
  Sparkles
} from 'lucide-react';
import {
  hexStringToBytes,
  bytesToHexString,
  bytesToAscii,
  asciiToBytes,
  calculateSumCheck8,
  calculateSumCheck16,
  calculateXorLrc,
  calculateCrc16Modbus,
  calculateCrc16Ccitt,
  calculateCrc32,
  convertFromRadix,
  type RadixValues
} from '../utils/crc';

interface PacketBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  onApplyToSend: (data: string, format: 'hex' | 'ascii') => void;
  onDirectSend?: (data: string, format: 'hex' | 'ascii') => void;
  onAddToFavorites?: (data: string, format: 'hex' | 'ascii', label?: string) => void;
}

export const PacketBuilderModal: React.FC<PacketBuilderModalProps> = ({
  isOpen,
  onClose,
  theme,
  onApplyToSend,
  onDirectSend,
  onAddToFavorites
}) => {
  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  // Active Main Tab: 'modbus' | 'custom'
  const [activeTab, setActiveTab] = useState<'modbus' | 'custom'>('modbus');

  // --- 1. Modbus State ---
  const [slaveId, setSlaveId] = useState<number>(1);
  const [functionCode, setFunctionCode] = useState<number>(3); // 03 Read Holding Registers
  const [startAddress, setStartAddress] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(10);
  const [singleValue, setSingleValue] = useState<number>(0);
  const [modbusCrcOrder, setModbusCrcOrder] = useState<'lsb' | 'msb'>('lsb');

  // --- 2. Custom Standard Frame State ---
  // A. Header
  const [headerBytesCount, setHeaderBytesCount] = useState<number>(1); // 0, 1, 2, 3, 4
  const [headerHex, setHeaderHex] = useState<string>('02'); // STX

  // B. Payload
  const [payloadFormat, setPayloadFormat] = useState<'hex' | 'ascii'>('hex');
  const [payloadFixedLength, setPayloadFixedLength] = useState<number>(0); // 0 = Auto/Variable
  const [payloadText, setPayloadText] = useState<string>('01 02 03 04');

  // C. CRC / Checksum
  const [checksumType, setChecksumType] = useState<'none' | 'sum8' | 'sum16' | 'xor' | 'crc16-modbus' | 'crc16-ccitt' | 'crc32'>('crc16-modbus');
  const [checksumEndian, setChecksumEndian] = useState<'lsb' | 'msb'>('lsb');
  const [checksumScope, setChecksumScope] = useState<'all' | 'payload-only'>('all');

  // D. Tail / End
  const [tailBytesCount, setTailBytesCount] = useState<number>(1); // 0, 1, 2
  const [tailHex, setTailHex] = useState<string>('03'); // ETX

  // --- 3. Radix Calculator State ---
  const [activeRadix, setActiveRadix] = useState<'hex' | 'dec' | 'oct' | 'bin'>('dec');
  const [radixInputs, setRadixInputs] = useState<RadixValues>({
    hex: '0A',
    dec: '10',
    oct: '12',
    bin: '0000 1010'
  });

  const [copied, setCopied] = useState(false);

  // Close with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // --- Radix Calculation Synchronizer ---
  const handleRadixChange = (val: string, radix: 'hex' | 'dec' | 'oct' | 'bin') => {
    setActiveRadix(radix);
    const result = convertFromRadix(val, radix);
    // Keep user's exact typed string in active field for fluid typing
    setRadixInputs({
      ...result,
      [radix]: val
    });
  };

  // --- Modbus Packet Assembler ---
  const modbusResult = useMemo(() => {
    const bytes: number[] = [];
    bytes.push(slaveId & 0xFF);
    bytes.push(functionCode & 0xFF);
    bytes.push((startAddress >> 8) & 0xFF);
    bytes.push(startAddress & 0xFF);

    if (functionCode === 5 || functionCode === 6) {
      bytes.push((singleValue >> 8) & 0xFF);
      bytes.push(singleValue & 0xFF);
    } else {
      bytes.push((quantity >> 8) & 0xFF);
      bytes.push(quantity & 0xFF);
    }

    const payloadBytes = new Uint8Array(bytes);
    const crc = calculateCrc16Modbus(payloadBytes);
    const crcLow = crc & 0xFF;
    const crcHigh = (crc >> 8) & 0xFF;

    if (modbusCrcOrder === 'lsb') {
      bytes.push(crcLow);
      bytes.push(crcHigh);
    } else {
      bytes.push(crcHigh);
      bytes.push(crcLow);
    }

    const hexStr = bytesToHexString(bytes);
    const asciiStr = bytesToAscii(bytes);

    return {
      bytes,
      hexStr,
      asciiStr,
      crcHex: `${crcLow.toString(16).toUpperCase().padStart(2, '0')} ${crcHigh.toString(16).toUpperCase().padStart(2, '0')}`
    };
  }, [slaveId, functionCode, startAddress, quantity, singleValue, modbusCrcOrder]);

  // --- Custom Standard Frame Assembler ---
  const customResult = useMemo(() => {
    // 1. Header Bytes
    let headerArr: number[] = [];
    if (headerBytesCount > 0) {
      const rawH = hexStringToBytes(headerHex);
      headerArr = Array.from(rawH).slice(0, headerBytesCount);
      while (headerArr.length < headerBytesCount) {
        headerArr.push(0);
      }
    }

    // 2. Payload Bytes
    let payloadArr: number[] = [];
    if (payloadFormat === 'hex') {
      payloadArr = Array.from(hexStringToBytes(payloadText));
    } else {
      payloadArr = Array.from(asciiToBytes(payloadText));
    }

    if (payloadFixedLength > 0) {
      if (payloadArr.length > payloadFixedLength) {
        payloadArr = payloadArr.slice(0, payloadFixedLength);
      } else {
        while (payloadArr.length < payloadFixedLength) {
          payloadArr.push(0);
        }
      }
    }

    // 3. Compute Checksum
    let checksumArr: number[] = [];
    const targetForCrc = checksumScope === 'all'
      ? new Uint8Array([...headerArr, ...payloadArr])
      : new Uint8Array(payloadArr);

    if (checksumType === 'sum8') {
      const sum8 = calculateSumCheck8(targetForCrc);
      checksumArr = [sum8];
    } else if (checksumType === 'sum16') {
      const sum16 = calculateSumCheck16(targetForCrc);
      const low = sum16 & 0xFF;
      const high = (sum16 >> 8) & 0xFF;
      checksumArr = checksumEndian === 'lsb' ? [low, high] : [high, low];
    } else if (checksumType === 'xor') {
      const xor = calculateXorLrc(targetForCrc);
      checksumArr = [xor];
    } else if (checksumType === 'crc16-modbus') {
      const crc = calculateCrc16Modbus(targetForCrc);
      const low = crc & 0xFF;
      const high = (crc >> 8) & 0xFF;
      checksumArr = checksumEndian === 'lsb' ? [low, high] : [high, low];
    } else if (checksumType === 'crc16-ccitt') {
      const crc = calculateCrc16Ccitt(targetForCrc);
      const low = crc & 0xFF;
      const high = (crc >> 8) & 0xFF;
      checksumArr = checksumEndian === 'lsb' ? [low, high] : [high, low];
    } else if (checksumType === 'crc32') {
      const crc32 = calculateCrc32(targetForCrc);
      const b0 = crc32 & 0xFF;
      const b1 = (crc32 >> 8) & 0xFF;
      const b2 = (crc32 >> 16) & 0xFF;
      const b3 = (crc32 >> 24) & 0xFF;
      checksumArr = checksumEndian === 'lsb' ? [b0, b1, b2, b3] : [b3, b2, b1, b0];
    }

    // 4. Tail Bytes
    let tailArr: number[] = [];
    if (tailBytesCount > 0) {
      const rawT = hexStringToBytes(tailHex);
      tailArr = Array.from(rawT).slice(0, tailBytesCount);
      while (tailArr.length < tailBytesCount) {
        tailArr.push(0);
      }
    }

    const fullBytes = [...headerArr, ...payloadArr, ...checksumArr, ...tailArr];
    const hexStr = bytesToHexString(fullBytes);
    const asciiStr = bytesToAscii(fullBytes);

    return {
      headerArr,
      payloadArr,
      checksumArr,
      tailArr,
      fullBytes,
      hexStr,
      asciiStr
    };
  }, [
    headerBytesCount,
    headerHex,
    payloadFormat,
    payloadFixedLength,
    payloadText,
    checksumType,
    checksumEndian,
    checksumScope,
    tailBytesCount,
    tailHex
  ]);

  // Current active packet result
  const currentPacket = activeTab === 'modbus' ? modbusResult : customResult;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentPacket.hexStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleApply = () => {
    onApplyToSend(currentPacket.hexStr, 'hex');
    onClose();
  };

  const handleDirectSendClick = () => {
    if (onDirectSend) {
      onDirectSend(currentPacket.hexStr, 'hex');
      onClose();
    }
  };

  const handleAddFavoriteClick = () => {
    const label = activeTab === 'modbus'
      ? `Modbus FC${functionCode.toString().padStart(2, '0')} (Addr: ${startAddress})`
      : `Frame (${'fullBytes' in currentPacket ? currentPacket.fullBytes.length : currentPacket.bytes.length}B)`;
    if (onAddToFavorites) {
      onAddToFavorites(currentPacket.hexStr, 'hex', label);
    }
    onClose();
  };

  // Insert Radix result into current active input
  const handleInsertRadixToPayload = (hexVal: string) => {
    const clean = hexVal.replace(/[^0-9a-fA-F]/g, '');
    if (!clean) return;
    if (activeTab === 'custom') {
      if (payloadFormat === 'hex') {
        setPayloadText((prev) => (prev ? `${prev.trim()} ${clean}` : clean));
      } else {
        setPayloadText((prev) => prev + bytesToAscii(hexStringToBytes(clean)));
      }
    } else {
      const parsedNum = parseInt(clean, 16);
      if (!isNaN(parsedNum)) {
        setQuantity(parsedNum);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl shadow-2xl overflow-hidden border ${
          isRetro
            ? 'bg-[#ece9d8] border-[#808080] text-black font-sans'
            : isDark
            ? 'bg-[#12141c] border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        {/* 1. Modal Header Bar */}
        <div
          className={`px-4 py-3 flex items-center justify-between border-b ${
            isRetro
              ? 'bg-[#000080] text-white'
              : isDark
              ? 'bg-zinc-900/90 border-zinc-800 text-white'
              : 'bg-zinc-50 border-zinc-200 text-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-amber-400" />
            <span className="font-bold text-sm tracking-tight">패킷 생성기 (Packet Builder)</span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/20 dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('modbus')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'modbus'
                  ? isRetro
                    ? 'bg-white text-black shadow-xs font-bold'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Cpu size={13} />
              <span>Modbus RTU / ASCII</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'custom'
                  ? isRetro
                    ? 'bg-white text-black shadow-xs font-bold'
                    : 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>표준 프레임 (Custom Frame)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* TAB 1: MODBUS BUILDER */}
          {activeTab === 'modbus' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Slave ID */}
                <div className={`p-3 rounded-lg border ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <label className="block font-semibold mb-1">국번 (Slave ID)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={247}
                      value={slaveId}
                      onChange={(e) => setSlaveId(Math.max(1, Math.min(247, parseInt(e.target.value) || 1)))}
                      className="w-full p-1.5 border rounded font-mono text-xs bg-transparent"
                    />
                    <span className="font-mono text-[11px] opacity-60">0x{slaveId.toString(16).toUpperCase().padStart(2, '0')}</span>
                  </div>
                </div>

                {/* Function Code */}
                <div className={`p-3 rounded-lg border md:col-span-2 ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <label className="block font-semibold mb-1">기능 코드 (Function Code)</label>
                  <select
                    value={functionCode}
                    onChange={(e) => setFunctionCode(parseInt(e.target.value))}
                    className="w-full p-1.5 border rounded font-mono text-xs bg-transparent"
                  >
                    <option value={1}>01 (0x01) - Read Coils</option>
                    <option value={2}>02 (0x02) - Read Discrete Inputs</option>
                    <option value={3}>03 (0x03) - Read Holding Registers</option>
                    <option value={4}>04 (0x04) - Read Input Registers</option>
                    <option value={5}>05 (0x05) - Write Single Coil</option>
                    <option value={6}>06 (0x06) - Write Single Register</option>
                    <option value={15}>15 (0x0F) - Write Multiple Coils</option>
                    <option value={16}>16 (0x10) - Write Multiple Registers</option>
                  </select>
                </div>

                {/* CRC Byte Order */}
                <div className={`p-3 rounded-lg border ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <label className="block font-semibold mb-1">CRC-16 엔디안</label>
                  <div className="flex items-center gap-2 mt-1">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="modbusCrc"
                        checked={modbusCrcOrder === 'lsb'}
                        onChange={() => setModbusCrcOrder('lsb')}
                      />
                      <span>LSB First (표준)</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="modbusCrc"
                        checked={modbusCrcOrder === 'msb'}
                        onChange={() => setModbusCrcOrder('msb')}
                      />
                      <span>MSB</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Address & Quantity Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Start Address */}
                <div className={`p-3 rounded-lg border ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold">시작 주소 (Start Address)</label>
                    <span className="font-mono text-[11px] opacity-70">
                      HEX: 0x{startAddress.toString(16).toUpperCase().padStart(4, '0')}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={65535}
                    value={startAddress}
                    onChange={(e) => setStartAddress(Math.max(0, Math.min(65535, parseInt(e.target.value) || 0)))}
                    className="w-full p-2 border rounded font-mono text-xs bg-transparent"
                    placeholder="예: 0"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {[0, 100, 1000, 40001].map((addr) => (
                      <button
                        key={addr}
                        type="button"
                        onClick={() => setStartAddress(addr)}
                        className="px-2 py-0.5 rounded border text-[10px] hover:bg-zinc-500/10 font-mono"
                      >
                        {addr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity / Single Value */}
                <div className={`p-3 rounded-lg border ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold">
                      {functionCode === 5 || functionCode === 6 ? '설정 값 (Value)' : '요청 개수 (Quantity)'}
                    </label>
                    <span className="font-mono text-[11px] opacity-70">
                      HEX: 0x{(functionCode === 5 || functionCode === 6 ? singleValue : quantity).toString(16).toUpperCase().padStart(4, '0')}
                    </span>
                  </div>
                  {functionCode === 5 || functionCode === 6 ? (
                    <input
                      type="number"
                      min={0}
                      max={65535}
                      value={singleValue}
                      onChange={(e) => setSingleValue(Math.max(0, Math.min(65535, parseInt(e.target.value) || 0)))}
                      className="w-full p-2 border rounded font-mono text-xs bg-transparent"
                      placeholder="예: 1"
                    />
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={125}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(125, parseInt(e.target.value) || 1)))}
                      className="w-full p-2 border rounded font-mono text-xs bg-transparent"
                      placeholder="예: 10"
                    />
                  )}
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 8, 10, 20].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => (functionCode === 5 || functionCode === 6 ? setSingleValue(q) : setQuantity(q))}
                        className="px-2 py-0.5 rounded border text-[10px] hover:bg-zinc-500/10 font-mono"
                      >
                        {q}개
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM STANDARD FRAME BUILDER */}
          {activeTab === 'custom' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* 1. HEADER CONFIG */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-amber-500">1. 헤더 (Header)</span>
                      <select
                        value={headerBytesCount}
                        onChange={(e) => setHeaderBytesCount(parseInt(e.target.value))}
                        className="px-1.5 py-0.5 border rounded text-[11px] font-mono bg-transparent"
                      >
                        <option value={0}>0B (없음)</option>
                        <option value={1}>1 바이트</option>
                        <option value={2}>2 바이트</option>
                        <option value={3}>3 바이트</option>
                        <option value={4}>4 바이트</option>
                      </select>
                    </div>

                    {headerBytesCount > 0 && (
                      <input
                        type="text"
                        value={headerHex}
                        onChange={(e) => setHeaderHex(e.target.value)}
                        placeholder="예: 02 또는 AA 55"
                        className="w-full p-1.5 border rounded font-mono text-xs bg-transparent uppercase"
                      />
                    )}
                  </div>

                  {headerBytesCount > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <button
                        type="button"
                        onClick={() => { setHeaderBytesCount(1); setHeaderHex('02'); }}
                        className="px-1.5 py-0.5 rounded border text-[10px] hover:bg-zinc-500/10"
                      >
                        STX (02)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setHeaderBytesCount(2); setHeaderHex('AA 55'); }}
                        className="px-1.5 py-0.5 rounded border text-[10px] hover:bg-zinc-500/10"
                      >
                        AA 55
                      </button>
                    </div>
                  )}
                </div>

                {/* 2. PAYLOAD CONFIG */}
                <div className={`p-3 rounded-lg border md:col-span-2 flex flex-col justify-between ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-indigo-400">2. 페이로드 (Payload)</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={payloadFixedLength}
                          onChange={(e) => setPayloadFixedLength(parseInt(e.target.value))}
                          className="px-1.5 py-0.5 border rounded text-[11px] font-mono bg-transparent"
                        >
                          <option value={0}>가변 길이 (Auto)</option>
                          <option value={2}>2 바이트 고정</option>
                          <option value={4}>4 바이트 고정</option>
                          <option value={8}>8 바이트 고정</option>
                          <option value={16}>16 바이트 고정</option>
                        </select>
                        <div className="flex items-center border rounded overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setPayloadFormat('hex')}
                            className={`px-2 py-0.5 text-[10px] font-bold ${payloadFormat === 'hex' ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-500/20'}`}
                          >
                            HEX
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayloadFormat('ascii')}
                            className={`px-2 py-0.5 text-[10px] font-bold ${payloadFormat === 'ascii' ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-500/20'}`}
                          >
                            ASCII
                          </button>
                        </div>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={payloadText}
                      onChange={(e) => setPayloadText(e.target.value)}
                      placeholder={payloadFormat === 'hex' ? '예: 01 02 03 04' : '예: HELLO'}
                      className="w-full p-2 border rounded font-mono text-xs bg-transparent"
                    />
                  </div>

                  <span className="text-[10px] opacity-60 mt-1 block">
                    * 페이로드 길이: {customResult.payloadArr.length} 바이트
                  </span>
                </div>

                {/* 3. TAIL / END CONFIG */}
                <div className={`p-3 rounded-lg border flex flex-col justify-between ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-emerald-500">4. 종료 (Tail)</span>
                      <select
                        value={tailBytesCount}
                        onChange={(e) => setTailBytesCount(parseInt(e.target.value))}
                        className="px-1.5 py-0.5 border rounded text-[11px] font-mono bg-transparent"
                      >
                        <option value={0}>0B (없음)</option>
                        <option value={1}>1 바이트</option>
                        <option value={2}>2 바이트</option>
                      </select>
                    </div>

                    {tailBytesCount > 0 && (
                      <input
                        type="text"
                        value={tailHex}
                        onChange={(e) => setTailHex(e.target.value)}
                        placeholder="예: 03 또는 0D 0A"
                        className="w-full p-1.5 border rounded font-mono text-xs bg-transparent uppercase"
                      />
                    )}
                  </div>

                  {tailBytesCount > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <button
                        type="button"
                        onClick={() => { setTailBytesCount(1); setTailHex('03'); }}
                        className="px-1.5 py-0.5 rounded border text-[10px] hover:bg-zinc-500/10"
                      >
                        ETX (03)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTailBytesCount(2); setTailHex('0D 0A'); }}
                        className="px-1.5 py-0.5 rounded border text-[10px] hover:bg-zinc-500/10"
                      >
                        CRLF (\r\n)
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. CRC / CHECKSUM CONFIG */}
              <div className={`p-3 rounded-lg border ${isRetro ? 'bg-white border-[#808080]' : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400">3. 체크섬 / CRC (자동 계산)</span>
                    <select
                      value={checksumType}
                      onChange={(e: any) => setChecksumType(e.target.value)}
                      className="px-2 py-1 border rounded text-xs font-mono bg-transparent font-semibold"
                    >
                      <option value="none">없음 (0B)</option>
                      <option value="sum8">Checksum-8 (1B)</option>
                      <option value="sum16">Sum-16 (2B)</option>
                      <option value="xor">XOR / LRC (1B)</option>
                      <option value="crc16-modbus">CRC-16 Modbus (2B)</option>
                      <option value="crc16-ccitt">CRC-16 CCITT (2B)</option>
                      <option value="crc32">CRC-32 IEEE 802.3 (4B)</option>
                    </select>
                  </div>

                  {checksumType !== 'none' && (
                    <div className="flex items-center gap-4 text-[11px]">
                      {/* Scope */}
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-70">계산 범위:</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="crcScope"
                            checked={checksumScope === 'all'}
                            onChange={() => setChecksumScope('all')}
                          />
                          <span>헤더+페이로드</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="crcScope"
                            checked={checksumScope === 'payload-only'}
                            onChange={() => setChecksumScope('payload-only')}
                          />
                          <span>페이로드만</span>
                        </label>
                      </div>

                      {/* Endian */}
                      {(checksumType === 'sum16' || checksumType.startsWith('crc')) && (
                        <div className="flex items-center gap-1.5">
                          <span className="opacity-70">엔디안:</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="customCrcEndian"
                              checked={checksumEndian === 'lsb'}
                              onChange={() => setChecksumEndian('lsb')}
                            />
                            <span>LSB First</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="customCrcEndian"
                              checked={checksumEndian === 'msb'}
                              onChange={() => setChecksumEndian('msb')}
                            />
                            <span>MSB First</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REAL-TIME VISUAL PACKET PREVIEW & BREAKDOWN */}
          <div
            className={`p-3.5 rounded-lg border ${
              isRetro
                ? 'bg-[#15213b] text-white border-[#808080]'
                : isDark
                ? 'bg-zinc-950 border-indigo-500/40 shadow-inner'
                : 'bg-indigo-50/70 border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs flex items-center gap-1 text-indigo-400">
                <Sparkles size={13} />
                완성된 패킷 미리보기 (총 {'fullBytes' in currentPacket ? currentPacket.fullBytes.length : currentPacket.bytes.length} 바이트)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-all text-white"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copied ? '복사됨' : 'HEX 복사'}</span>
              </button>
            </div>

            {/* Visual Frame Block Breakdown */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs mb-2">
              {activeTab === 'modbus' ? (
                <>
                  <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    ID: 0x{slaveId.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                  <span className="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/40 text-blue-300">
                    FC: 0x{functionCode.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                  <span className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                    Addr: 0x{startAddress.toString(16).toUpperCase().padStart(4, '0')}
                  </span>
                  <span className="px-2 py-1 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300">
                    {functionCode === 5 || functionCode === 6 ? 'Val' : 'Qty'}: 0x{(functionCode === 5 || functionCode === 6 ? singleValue : quantity).toString(16).toUpperCase().padStart(4, '0')}
                  </span>
                  <span className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                    CRC: {modbusResult.crcHex}
                  </span>
                </>
              ) : (
                <>
                  {customResult.headerArr.length > 0 && (
                    <span className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                      HDR: {bytesToHexString(customResult.headerArr)}
                    </span>
                  )}
                  {customResult.payloadArr.length > 0 && (
                    <span className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                      DATA: {bytesToHexString(customResult.payloadArr)}
                    </span>
                  )}
                  {customResult.checksumArr.length > 0 && (
                    <span className="px-2 py-1 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">
                      CRC: {bytesToHexString(customResult.checksumArr)}
                    </span>
                  )}
                  {customResult.tailArr.length > 0 && (
                    <span className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                      TAIL: {bytesToHexString(customResult.tailArr)}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Raw HEX String Display */}
            <div className="p-2 rounded bg-black/40 border border-white/10 font-mono text-sm tracking-widest text-emerald-400 select-all font-bold">
              {currentPacket.hexStr || '(비어 있음)'}
            </div>
          </div>

          {/* 4. RADIX CALCULATOR (HEX / DEC / OCT / BIN) */}
          <div
            className={`p-3.5 rounded-lg border ${
              isRetro
                ? 'bg-white border-[#808080]'
                : isDark
                ? 'bg-zinc-900/70 border-zinc-800'
                : 'bg-zinc-50 border-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Calculator size={14} className="text-amber-500" />
                <span>공학용 실시간 다중 진수 변환기 (Radix Converter)</span>
              </div>
              <span className="text-[11px] opacity-60">
                어느 진수 칸에 입력하셔도 나머지 진수가 실시간 동기화됩니다
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* 16진수 HEX */}
              <div className={`p-2 rounded border ${activeRadix === 'hex' ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-700/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] text-amber-400">16진수 (HEX)</span>
                  <button
                    type="button"
                    onClick={() => handleInsertRadixToPayload(radixInputs.hex)}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                    title="패킷에 이 바이트 추가"
                  >
                    <Plus size={10} /> 패킷에 추가
                  </button>
                </div>
                <input
                  type="text"
                  value={radixInputs.hex}
                  onChange={(e) => handleRadixChange(e.target.value, 'hex')}
                  onFocus={() => setActiveRadix('hex')}
                  placeholder="예: 0A 1F"
                  className="w-full p-1.5 rounded border font-mono text-xs bg-transparent uppercase font-bold"
                />
              </div>

              {/* 10진수 DEC */}
              <div className={`p-2 rounded border ${activeRadix === 'dec' ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-700/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] text-blue-400">10진수 (DEC)</span>
                  <button
                    type="button"
                    onClick={() => handleInsertRadixToPayload(radixInputs.hex)}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                    title="패킷에 이 바이트 추가"
                  >
                    <Plus size={10} /> 패킷에 추가
                  </button>
                </div>
                <input
                  type="text"
                  value={radixInputs.dec}
                  onChange={(e) => handleRadixChange(e.target.value, 'dec')}
                  onFocus={() => setActiveRadix('dec')}
                  placeholder="예: 10"
                  className="w-full p-1.5 rounded border font-mono text-xs bg-transparent font-bold"
                />
              </div>

              {/* 8진수 OCT */}
              <div className={`p-2 rounded border ${activeRadix === 'oct' ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-700/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] text-purple-400">8진수 (OCT)</span>
                  <button
                    type="button"
                    onClick={() => handleInsertRadixToPayload(radixInputs.hex)}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                    title="패킷에 이 바이트 추가"
                  >
                    <Plus size={10} /> 패킷에 추가
                  </button>
                </div>
                <input
                  type="text"
                  value={radixInputs.oct}
                  onChange={(e) => handleRadixChange(e.target.value, 'oct')}
                  onFocus={() => setActiveRadix('oct')}
                  placeholder="예: 12"
                  className="w-full p-1.5 rounded border font-mono text-xs bg-transparent font-bold"
                />
              </div>

              {/* 2진수 BIN */}
              <div className={`p-2 rounded border ${activeRadix === 'bin' ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-700/50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] text-emerald-400">2진수 (BIN)</span>
                  <button
                    type="button"
                    onClick={() => handleInsertRadixToPayload(radixInputs.hex)}
                    className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                    title="패킷에 이 바이트 추가"
                  >
                    <Plus size={10} /> 패킷에 추가
                  </button>
                </div>
                <input
                  type="text"
                  value={radixInputs.bin}
                  onChange={(e) => handleRadixChange(e.target.value, 'bin')}
                  onFocus={() => setActiveRadix('bin')}
                  placeholder="예: 0000 1010"
                  className="w-full p-1.5 rounded border font-mono text-[11px] bg-transparent font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. Modal Footer Action Bar */}
        <div
          className={`px-4 py-3 border-t flex items-center justify-between ${
            isRetro
              ? 'bg-[#d4d0c8] border-[#808080]'
              : isDark
              ? 'bg-zinc-900/90 border-zinc-800'
              : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-3.5 py-1.5 rounded text-xs transition-all ${
              isRetro
                ? 'border border-[#808080] bg-[#ece9d8] active:bg-[#b0aca4]'
                : 'hover:bg-zinc-700/40 text-zinc-400 hover:text-white'
            }`}
          >
            닫기 (ESC)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddFavoriteClick}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isRetro
                  ? 'border border-[#808080] bg-[#ffffff] hover:bg-zinc-100 text-black'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700'
              }`}
            >
              <Plus size={13} />
              <span>즐겨찾기에 등록</span>
            </button>

            {onDirectSend && (
              <button
                type="button"
                onClick={handleDirectSendClick}
                className={`px-3.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                  isRetro
                    ? 'border-2 border-white bg-[#008080] text-white active:bg-teal-900'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white'
                }`}
              >
                <Send size={13} />
                <span>즉시 전송</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApply}
              className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isRetro
                  ? 'border-2 border-white bg-[#000080] text-white active:bg-blue-900'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
              }`}
            >
              <Check size={14} />
              <span>보내는 데이터로 적용</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
