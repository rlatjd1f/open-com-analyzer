import React, { useRef } from 'react';
import type { AppTheme, ConnectionStatus } from '../types';
import { Printer, Save, FolderOpen, ArrowDown, Trash2 } from 'lucide-react';

interface ControlSidebarProps {
  totalBytesCount: number;
  packetCount: number;
  maxBufferPackets: number;
  onMaxBufferChange: (limit: number) => void;
  onClear: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  dlgState: 'top' | 'middle' | 'bottom';
  onDlgStateChange: (state: 'top' | 'middle' | 'bottom') => void;
  rxMode: 'ascii' | 'binary';
  onRxModeChange: (mode: 'ascii' | 'binary') => void;
  txMode: 'ascii' | 'binary';
  onTxModeChange: (mode: 'ascii' | 'binary') => void;
  theme: AppTheme;
  onThemeColorChange: (key: 'rxColor' | 'txColor' | 'textColor', color: string) => void;
  onPrint: () => void;
  onSave: () => void;
  onOpen: () => void;
  status: ConnectionStatus;
  rxBlinking: boolean;
  txBlinking: boolean;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  totalBytesCount,
  packetCount,
  maxBufferPackets,
  onMaxBufferChange,
  onClear,
  autoScroll,
  onToggleAutoScroll,
  dlgState,
  onDlgStateChange,
  rxMode,
  onRxModeChange,
  txMode,
  onTxModeChange,
  theme,
  onThemeColorChange,
  onPrint,
  onSave,
  onOpen,
  status,
  rxBlinking,
  txBlinking
}) => {
  const rxColorInputRef = useRef<HTMLInputElement>(null);
  const txColorInputRef = useRef<HTMLInputElement>(null);
  const textColorInputRef = useRef<HTMLInputElement>(null);

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  return (
    <div
      className={`w-[152px] flex flex-col p-2 gap-2 text-xs select-none border-l overflow-y-auto shrink-0 ${
        isRetro
          ? 'bg-[#ece9d8] text-black border-[#808080] font-sans'
          : isDark
          ? 'bg-[#18181b] text-zinc-300 border-zinc-800'
          : 'bg-[#fafafa] text-zinc-700 border-zinc-200'
      }`}
    >
      {/* 1. Scroll & Buffer Limit Status Box */}
      <div className="flex flex-col gap-1.5 border rounded p-2 bg-black/5 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-500 font-bold">STREAM</span>
          <span className="font-mono font-bold text-[11px] text-indigo-500">
            {totalBytesCount.toLocaleString()} B
          </span>
        </div>

        {/* Buffer Count & Limit */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-500 font-bold">BUFFER</span>
          <span className="font-mono text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
            {packetCount} / {maxBufferPackets === 0 ? '∞' : maxBufferPackets.toLocaleString()}
          </span>
        </div>

        {/* Buffer Limit Quick Selector (Full Width, No Overflow) */}
        <div className="flex flex-col gap-1 pt-1.5 border-t border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-semibold">버퍼 한도</span>
            <span className="text-[9px] font-mono text-zinc-400">
              {maxBufferPackets === 0 ? '무제한' : `${maxBufferPackets.toLocaleString()}행`}
            </span>
          </div>
          <select
            value={maxBufferPackets}
            onChange={(e) => onMaxBufferChange(parseInt(e.target.value, 10))}
            className={`w-full font-mono text-[10px] font-medium px-1.5 py-1 rounded border outline-none cursor-pointer ${
              isRetro
                ? 'bg-white text-black border-[#808080]'
                : isDark
                ? 'bg-zinc-900 text-zinc-200 border-zinc-700'
                : 'bg-white text-zinc-800 border-zinc-300'
            }`}
          >
            <option value={500}>500개 (가벼움)</option>
            <option value={1000}>1,000개 (기본)</option>
            <option value={2000}>2,000개</option>
            <option value={5000}>5,000개</option>
            <option value={0}>무제한 (All)</option>
          </select>
        </div>

        {/* Auto Scroll Toggle */}
        <button
          onClick={onToggleAutoScroll}
          className={`w-full py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
            autoScroll
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              : 'bg-zinc-400/20 text-zinc-500 hover:bg-zinc-400/30'
          }`}
          title="신규 데이터 수신 시 자동으로 화면 아래로 스크롤"
        >
          <ArrowDown size={11} className={autoScroll ? 'animate-bounce' : ''} />
          <span>{autoScroll ? '자동스크롤 ON' : '자동스크롤 OFF'}</span>
        </button>

        {/* Clear Buffer Button */}
        <button
          onClick={onClear}
          className={`w-full py-1 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-all ${
            isRetro
              ? 'border border-[#808080] bg-[#e0ded8] active:bg-[#c0beb8]'
              : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
          }`}
          title="현재 화면의 패킷 버퍼 비우기"
        >
          <Trash2 size={11} />
          <span>화면 지우기</span>
        </button>
      </div>

      {/* 2. Dlg 상태 Group Box */}
      <fieldset className={`border rounded p-1.5 ${isRetro ? 'border-[#808080]' : 'border-zinc-400/40'}`}>
        <legend className="px-1 text-[11px] font-semibold opacity-90">Dlg 상태</legend>
        <div className="flex flex-col gap-1 mt-0.5 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="dlgState"
              checked={dlgState === 'top'}
              onChange={() => onDlgStateChange('top')}
              className="accent-blue-600"
            />
            <span>Top</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="dlgState"
              checked={dlgState === 'middle'}
              onChange={() => onDlgStateChange('middle')}
              className="accent-blue-600"
            />
            <span>Middle</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="dlgState"
              checked={dlgState === 'bottom'}
              onChange={() => onDlgStateChange('bottom')}
              className="accent-blue-600"
            />
            <span>Bottom</span>
          </label>
        </div>
      </fieldset>

      {/* 3. RX 데이터 Group Box */}
      <fieldset className={`border rounded p-1.5 ${isRetro ? 'border-[#808080]' : 'border-zinc-400/40'}`}>
        <legend className="px-1 text-[11px] font-semibold opacity-90">RX 데이터</legend>
        <div className="flex flex-col gap-1 mt-0.5 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="rxMode"
              checked={rxMode === 'ascii'}
              onChange={() => onRxModeChange('ascii')}
              className="accent-blue-600"
            />
            <span>ASCII</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="rxMode"
              checked={rxMode === 'binary'}
              onChange={() => onRxModeChange('binary')}
              className="accent-blue-600"
            />
            <span>Binary (16진수)</span>
          </label>
        </div>
      </fieldset>

      {/* 4. TX 데이터 Group Box */}
      <fieldset className={`border rounded p-1.5 ${isRetro ? 'border-[#808080]' : 'border-zinc-400/40'}`}>
        <legend className="px-1 text-[11px] font-semibold opacity-90">TX 데이터</legend>
        <div className="flex flex-col gap-1 mt-0.5 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="txMode"
              checked={txMode === 'ascii'}
              onChange={() => onTxModeChange('ascii')}
              className="accent-blue-600"
            />
            <span>ASCII</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="txMode"
              checked={txMode === 'binary'}
              onChange={() => onTxModeChange('binary')}
              className="accent-blue-600"
            />
            <span>Binary (16진수)</span>
          </label>
        </div>
      </fieldset>

      {/* 5. 색상 설정 (RX, TX, Text) */}
      <fieldset className={`border rounded p-1.5 ${isRetro ? 'border-[#808080]' : 'border-zinc-400/40'}`}>
        <legend className="px-1 text-[11px] font-semibold opacity-90">색상 설정</legend>
        <div className="flex flex-col gap-1 mt-0.5">
          {/* RX Color */}
          <button
            onClick={() => rxColorInputRef.current?.click()}
            className="w-full flex items-center justify-between px-1.5 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[11px]"
          >
            <span>RX 색상</span>
            <div
              className="w-4 h-4 rounded border border-black/30 shadow-inner"
              style={{ backgroundColor: theme.rxColor }}
            />
          </button>
          <input
            ref={rxColorInputRef}
            type="color"
            value={theme.rxColor}
            onChange={(e) => onThemeColorChange('rxColor', e.target.value)}
            className="hidden"
          />

          {/* TX Color */}
          <button
            onClick={() => txColorInputRef.current?.click()}
            className="w-full flex items-center justify-between px-1.5 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[11px]"
          >
            <span>TX 색상</span>
            <div
              className="w-4 h-4 rounded border border-black/30 shadow-inner"
              style={{ backgroundColor: theme.txColor }}
            />
          </button>
          <input
            ref={txColorInputRef}
            type="color"
            value={theme.txColor}
            onChange={(e) => onThemeColorChange('txColor', e.target.value)}
            className="hidden"
          />

          {/* Text Color */}
          <button
            onClick={() => textColorInputRef.current?.click()}
            className="w-full flex items-center justify-between px-1.5 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 text-[11px]"
          >
            <span>글꼴 색상</span>
            <div
              className="w-4 h-4 rounded border border-black/30 shadow-inner"
              style={{ backgroundColor: theme.textColor }}
            />
          </button>
          <input
            ref={textColorInputRef}
            type="color"
            value={theme.textColor}
            onChange={(e) => onThemeColorChange('textColor', e.target.value)}
            className="hidden"
          />
        </div>
      </fieldset>

      {/* 6. Utility Action Buttons */}
      <div className="flex flex-col gap-1 mt-auto">
        <button
          onClick={onPrint}
          className={`w-full py-1.5 rounded flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all ${
            isRetro
              ? 'border-2 border-outset border-[#ffffff] bg-[#d4d0c8] text-black active:border-inset'
              : 'bg-zinc-500/10 hover:bg-zinc-500/20'
          }`}
        >
          <Printer size={12} />
          <span>화면 인쇄</span>
        </button>

        <button
          onClick={onSave}
          className={`w-full py-1.5 rounded flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all ${
            isRetro
              ? 'border-2 border-outset border-[#ffffff] bg-[#d4d0c8] text-black active:border-inset'
              : 'bg-zinc-500/10 hover:bg-zinc-500/20'
          }`}
        >
          <Save size={12} />
          <span>로그 저장</span>
        </button>

        <button
          onClick={onOpen}
          className={`w-full py-1.5 rounded flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all ${
            isRetro
              ? 'border-2 border-outset border-[#ffffff] bg-[#d4d0c8] text-black active:border-inset'
              : 'bg-zinc-500/10 hover:bg-zinc-500/20'
          }`}
        >
          <FolderOpen size={12} />
          <span>로그 열기</span>
        </button>
      </div>

      {/* 7. Live LED Blinker Indicators */}
      <div className="pt-2 border-t flex items-center justify-around">
        {/* Status LED */}
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`w-3.5 h-3.5 rounded-full border shadow-sm transition-colors ${
              status.connected
                ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                : 'bg-zinc-400 border-zinc-500 opacity-60'
            }`}
          />
          <span className="text-[10px] font-bold text-zinc-500">STAT</span>
        </div>

        {/* RX Blinker */}
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`w-3.5 h-3.5 rounded-full border shadow-sm transition-all duration-75 ${
              rxBlinking
                ? 'bg-amber-400 border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-110'
                : 'bg-zinc-400 border-zinc-500 opacity-40'
            }`}
          />
          <span className="text-[10px] font-bold text-zinc-500">RX</span>
        </div>

        {/* TX Blinker */}
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`w-3.5 h-3.5 rounded-full border shadow-sm transition-all duration-75 ${
              txBlinking
                ? 'bg-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.9)] scale-110'
                : 'bg-zinc-400 border-zinc-500 opacity-40'
            }`}
          />
          <span className="text-[10px] font-bold text-zinc-500">TX</span>
        </div>
      </div>
    </div>
  );
};
