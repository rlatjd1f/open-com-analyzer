import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { AppTheme, Packet } from '../types';
import { Send, Play, Square, Zap } from 'lucide-react';

interface SendPanelProps {
  theme: AppTheme;
  onSend: (raw: string, format: 'hex' | 'ascii') => void;
  onInsertData: string;
  lastRxPacket: Packet | null;
}

export const SendPanel: React.FC<SendPanelProps> = ({
  theme,
  onSend,
  onInsertData,
  lastRxPacket
}) => {
  const [data, setData] = useState('');
  const [format, setFormat] = useState<'hex' | 'ascii'>('hex');
  
  // 1. Interval Repeat Mode
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const timerRef = useRef<any>(null);

  // 2. Reactive RX Trigger Mode (RX 수신 1건마다 => 대응되는 1회 자동 발송 유지)
  const [rxTriggerEnabled, setRxTriggerEnabled] = useState(false);
  const [rxTriggerDelayMs, setRxTriggerDelayMs] = useState(0);
  const lastProcessedRxId = useRef<string | null>(null);

  // Keep latest refs for safe async execution without closure stalls
  const dataRef = useRef(data);
  const formatRef = useRef(format);
  const onSendRef = useRef(onSend);
  const rxTriggerDelayRef = useRef(rxTriggerDelayMs);

  useEffect(() => {
    dataRef.current = data;
    formatRef.current = format;
    onSendRef.current = onSend;
    rxTriggerDelayRef.current = rxTriggerDelayMs;
  }, [data, format, onSend, rxTriggerDelayMs]);

  // Update when user clicks "Apply to Send" from utilities
  useEffect(() => {
    if (onInsertData) {
      setData(onInsertData);
    }
  }, [onInsertData]);

  // Calculate byte count dynamically
  const byteCount = useMemo(() => {
    if (format === 'hex') {
      const clean = data.replace(/[^0-9a-fA-F]/g, '');
      return Math.floor(clean.length / 2);
    } else {
      return new TextEncoder().encode(data).length;
    }
  }, [data, format]);

  const handleSend = () => {
    if (!data.trim()) return;
    onSend(data, format);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // 1. Auto repeat timer
  useEffect(() => {
    if (autoRepeat) {
      setRxTriggerEnabled(false);
      lastProcessedRxId.current = null;
      timerRef.current = setInterval(() => {
        if (dataRef.current.trim()) {
          onSendRef.current(dataRef.current, formatRef.current);
        }
      }, Math.max(50, intervalMs));
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRepeat, intervalMs]);

  // Toggle Reactive RX Trigger
  const handleToggleRxTrigger = () => {
    if (!rxTriggerEnabled) {
      if (!data.trim()) {
        alert('먼저 보낼 데이터를 입력해주세요.');
        return;
      }
      setAutoRepeat(false);
      // Mark current last RX packet as already processed so historical packets won't trigger immediately
      lastProcessedRxId.current = lastRxPacket ? lastRxPacket.id : null;
      setRxTriggerEnabled(true);
    } else {
      setRxTriggerEnabled(false);
      lastProcessedRxId.current = null;
    }
  };

  // 2. Reactive RX Trigger: Every time a NEW distinct RX packet arrives, send exactly 1 time!
  useEffect(() => {
    if (!rxTriggerEnabled || !lastRxPacket || !dataRef.current.trim()) return;

    // Check if this specific RX packet ID was already processed
    if (lastRxPacket.id === lastProcessedRxId.current) return;

    // Record this packet ID immediately so re-renders or delay timers cannot duplicate sending
    lastProcessedRxId.current = lastRxPacket.id;

    const toSend = dataRef.current;
    const fmt = formatRef.current;
    const delay = rxTriggerDelayRef.current;

    if (delay > 0) {
      const dTimer = setTimeout(() => {
        onSendRef.current(toSend, fmt);
      }, delay);
      return () => clearTimeout(dTimer);
    } else {
      onSendRef.current(toSend, fmt);
    }
  }, [lastRxPacket, rxTriggerEnabled]);

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  return (
    <div
      className={`px-3 py-1.5 flex items-center gap-2 border-t text-xs select-none ${
        isRetro
          ? 'bg-[#ece9d8] text-black border-[#808080]'
          : isDark
          ? 'bg-[#18181b] text-zinc-300 border-zinc-800'
          : 'bg-[#f4f4f5] text-zinc-700 border-zinc-200'
      }`}
    >
      {/* "보내는 데이터" Action Button */}
      <button
        onClick={handleSend}
        className={`px-3 py-1 rounded font-semibold text-xs transition-all active:scale-95 flex items-center gap-1 shrink-0 ${
          isRetro
            ? 'border-2 border-outset border-[#ffffff] bg-[#d4d0c8] text-black active:border-inset'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
        }`}
      >
        <Send size={12} />
        <span>보내는 데이터</span>
      </button>

      {/* Main Send Input Box */}
      <div className="flex-1 relative flex items-center min-w-0">
        <input
          type="text"
          value={data}
          onChange={(e) => setData(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={format === 'hex' ? '예: 01 06 00 EF 00 01 79 FF' : 'ASCII 텍스트를 입력하세요...'}
          className={`w-full h-8 px-2 pr-12 font-mono text-sm rounded border outline-none transition-all ${
            isRetro
              ? 'bg-white text-black border-[#808080] shadow-inner'
              : isDark
              ? 'bg-zinc-900 text-zinc-100 border-zinc-700 focus:border-indigo-500'
              : 'bg-white text-zinc-900 border-zinc-300 focus:border-indigo-500'
          }`}
        />

        {/* Byte count badge */}
        <div
          className={`absolute right-1 px-2 py-0.5 rounded font-mono font-bold text-xs pointer-events-none ${
            isRetro
              ? 'text-zinc-700 bg-zinc-200 border border-zinc-400'
              : isDark
              ? 'text-indigo-400 bg-indigo-950/50 border border-indigo-800/40'
              : 'text-indigo-600 bg-indigo-50 border border-indigo-200'
          }`}
          title="바이트 수"
        >
          {byteCount}
        </div>
      </div>

      {/* Format Switcher: HEX / ASCII */}
      <div
        className={`flex rounded p-0.5 border shrink-0 ${
          isRetro
            ? 'border-[#808080] bg-[#d4d0c8]'
            : isDark
            ? 'border-zinc-700 bg-zinc-900'
            : 'border-zinc-300 bg-zinc-200'
        }`}
      >
        <button
          onClick={() => setFormat('hex')}
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
            format === 'hex'
              ? 'bg-indigo-600 text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          HEX
        </button>
        <button
          onClick={() => setFormat('ascii')}
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
            format === 'ascii'
              ? 'bg-indigo-600 text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          ASCII
        </button>
      </div>

      {/* Option 1: Reactive Mode (RX 수신 1건마다 => 대응되는 1회 자동 응답 발송 유지) */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-zinc-300 dark:border-zinc-700">
        <button
          onClick={handleToggleRxTrigger}
          className={`p-1.5 rounded flex items-center gap-1 text-[11px] font-semibold transition-all ${
            rxTriggerEnabled
              ? 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.5)] animate-pulse'
              : isRetro
              ? 'bg-[#d4d0c8] border border-[#808080] hover:bg-zinc-200'
              : 'bg-zinc-500/10 hover:bg-zinc-500/20'
          }`}
          title="RX 패킷이 수신될 때마다 1:1로 현재 데이터를 1회씩 자동 응답 발송합니다"
        >
          <Zap size={12} className={rxTriggerEnabled ? 'fill-white' : ''} />
          <span>{rxTriggerEnabled ? 'RX 반응발송 ON' : 'RX 반응발송'}</span>
        </button>
        <div className="flex items-center gap-1" title="RX 수신 후 응답 지연 시간 (ms)">
          <input
            type="number"
            value={rxTriggerDelayMs}
            onChange={(e) => setRxTriggerDelayMs(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className={`w-11 h-7 px-1 text-center font-mono text-[11px] rounded border outline-none ${
              isRetro
                ? 'bg-white text-black border-[#808080]'
                : isDark
                ? 'bg-zinc-900 text-zinc-100 border-zinc-700'
                : 'bg-white text-zinc-800 border-zinc-300'
            }`}
          />
          <span className="text-[10px] text-zinc-500">ms</span>
        </div>
      </div>

      {/* Option 2: Interval Repeat Timer Mode (주기적 반복 전송) */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1 border-l border-zinc-300 dark:border-zinc-700">
        <button
          onClick={() => {
            const next = !autoRepeat;
            setAutoRepeat(next);
            if (next) {
              setRxTriggerEnabled(false);
              lastProcessedRxId.current = null;
            }
          }}
          className={`p-1.5 rounded flex items-center gap-1 text-[11px] font-semibold transition-all ${
            autoRepeat
              ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(225,29,72,0.5)] animate-pulse'
              : isRetro
              ? 'bg-[#d4d0c8] border border-[#808080] hover:bg-zinc-200'
              : 'bg-zinc-500/10 hover:bg-zinc-500/20'
          }`}
          title="지정한 주기(ms)마다 데이터를 자동으로 반복 전송"
        >
          {autoRepeat ? <Square size={12} /> : <Play size={12} />}
          <span>{autoRepeat ? '정지' : '주기전송'}</span>
        </button>
        <div className="flex items-center gap-1" title="반복 전송 주기 (ms)">
          <input
            type="number"
            value={intervalMs}
            onChange={(e) => setIntervalMs(Math.max(10, parseInt(e.target.value, 10) || 100))}
            className={`w-14 h-7 px-1 text-center font-mono text-[11px] rounded border outline-none ${
              isRetro
                ? 'bg-white text-black border-[#808080]'
                : isDark
                ? 'bg-zinc-900 text-zinc-100 border-zinc-700'
                : 'bg-white text-zinc-800 border-zinc-300'
            }`}
          />
          <span className="text-[10px] text-zinc-500">ms</span>
        </div>
      </div>
    </div>
  );
};
