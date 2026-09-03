import React, { useState } from 'react';
import type { AppTheme, ConnectionStatus } from '../types';
import { Printer, ArrowDown, Trash2, Server, Power } from 'lucide-react';

interface ControlSidebarProps {
  totalBytesCount: number;
  packetCount: number;
  maxBufferPackets: number;
  onMaxBufferChange: (limit: number) => void;
  onClear: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  dlgState: 'top' | 'middle' | 'bottom';
  onDlgStateChange: (state: 'top' | 'middle' | 'bottom') => void;
  rxMode: 'ascii' | 'binary';
  onRxModeChange: (mode: 'ascii' | 'binary') => void;
  txMode: 'ascii' | 'binary';
  onTxModeChange: (mode: 'ascii' | 'binary') => void;
  theme: AppTheme;
  onPrint: () => void;
  status: ConnectionStatus;
  onStartTcpServer: (port: number) => void;
  onConnectTcpClient: (host: string, port: number) => void;
  onDisconnect: () => void;
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
  onPrint,
  status,
  onStartTcpServer,
  onConnectTcpClient,
  onDisconnect
}) => {
  // Quick TCP settings local state (Default empty, remembered in localStorage)
  const [quickTcpMode, setQuickTcpMode] = useState<'server' | 'client'>('server');
  const [quickTcpPort, setQuickTcpPort] = useState<string>(() => {
    try {
      return localStorage.getItem('com_analyzer_last_tcp_port') || '';
    } catch (e) {
      return '';
    }
  });
  const [quickTcpHost, setQuickTcpHost] = useState<string>(() => {
    try {
      return localStorage.getItem('com_analyzer_last_tcp_host') || '127.0.0.1';
    } catch (e) {
      return '127.0.0.1';
    }
  });

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  const isTcpConnected = status.connected && (status.type === 'tcp-server' || status.type === 'tcp-client');

  const handleQuickTcpAction = () => {
    if (status.connected) {
      onDisconnect();
    } else {
      const portNum = parseInt(quickTcpPort, 10);
      if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
        alert('포트 번호를 입력해주세요 (예: 121).');
        return;
      }
      try {
        localStorage.setItem('com_analyzer_last_tcp_port', quickTcpPort);
        localStorage.setItem('com_analyzer_last_tcp_host', quickTcpHost);
      } catch (e) {}

      if (quickTcpMode === 'server') {
        onStartTcpServer(portNum);
      } else {
        if (!quickTcpHost.trim()) {
          alert('접속할 IP 주소를 입력해주세요 (예: 127.0.0.1).');
          return;
        }
        onConnectTcpClient(quickTcpHost.trim(), portNum);
      }
    }
  };

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

        {/* Buffer Limit Quick Selector (Full Width) */}
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

        {/* Clear Buffer Screen Button */}
        <button
          onClick={onClear}
          className={`w-full py-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${
            isRetro
              ? 'border border-[#808080] bg-[#d4d0c8] active:bg-[#b0aca4] text-red-700'
              : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
          }`}
          title="화면 버퍼 초기화 (Cmd+K)"
        >
          <Trash2 size={11} />
          <span>화면 지우기</span>
        </button>
      </div>

      {/* 2. TCP 빠른 설정 Group Box (Quick TCP Control) */}
      <fieldset className={`border rounded p-1.5 ${isRetro ? 'border-[#808080]' : 'border-zinc-400/40'}`}>
        <legend className="px-1 text-[11px] font-semibold opacity-90 flex items-center gap-1">
          <Server size={11} className="text-indigo-400" />
          <span>TCP 간편 설정</span>
        </legend>
        <div className="flex flex-col gap-1.5 mt-0.5 text-[11px]">
          {/* Mode Switcher */}
          <div className="flex rounded border overflow-hidden p-0.5 bg-black/5 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setQuickTcpMode('server')}
              className={`flex-1 py-0.5 text-[10px] font-bold rounded transition-all ${
                quickTcpMode === 'server'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              서버
            </button>
            <button
              type="button"
              onClick={() => setQuickTcpMode('client')}
              className={`flex-1 py-0.5 text-[10px] font-bold rounded transition-all ${
                quickTcpMode === 'client'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              클라이언트
            </button>
          </div>

          {/* Port input */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-zinc-500 font-mono">PORT</span>
            <input
              type="number"
              value={quickTcpPort}
              onChange={(e) => setQuickTcpPort(e.target.value)}
              placeholder="예: 121"
              className={`w-16 h-6 px-1.5 text-right font-mono text-[11px] font-bold rounded border outline-none ${
                isRetro
                  ? 'bg-white text-black border-[#808080]'
                  : isDark
                  ? 'bg-zinc-900 text-zinc-100 border-zinc-700'
                  : 'bg-white text-zinc-800 border-zinc-300'
              }`}
            />
          </div>

          {/* IP Host input if client */}
          {quickTcpMode === 'client' && (
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-zinc-500 font-mono">IP</span>
              <input
                type="text"
                value={quickTcpHost}
                onChange={(e) => setQuickTcpHost(e.target.value)}
                placeholder="127.0.0.1"
                className={`w-20 h-6 px-1 text-right font-mono text-[10px] rounded border outline-none ${
                  isRetro
                    ? 'bg-white text-black border-[#808080]'
                    : isDark
                    ? 'bg-zinc-900 text-zinc-100 border-zinc-700'
                    : 'bg-white text-zinc-800 border-zinc-300'
                }`}
              />
            </div>
          )}

          {/* Status and Action Button */}
          {isTcpConnected ? (
            <div className="flex flex-col gap-1 mt-0.5">
              <div className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] flex items-center justify-between font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {status.type === 'tcp-server' ? `PORT ${status.port || 121}` : '접속됨'}
                </span>
                <span>{status.type === 'tcp-server' ? `${status.clientCount ?? 0}명` : ''}</span>
              </div>
              <button
                type="button"
                onClick={onDisconnect}
                className="w-full py-1 rounded font-bold text-[10px] bg-red-600 hover:bg-red-500 text-white transition-all shadow-xs"
              >
                연결 종료
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleQuickTcpAction}
              className={`w-full py-1 rounded font-bold text-[10px] flex items-center justify-center gap-1 transition-all shadow-sm ${
                isRetro
                  ? 'border-2 border-outset border-white bg-[#000080] text-white active:bg-blue-900'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
              }`}
            >
              <Power size={11} />
              <span>{quickTcpMode === 'server' ? '서버 구동' : '원격 접속'}</span>
            </button>
          )}
        </div>
      </fieldset>

      {/* 3. Dlg 상태 Group Box */}
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

      {/* 4. RX 데이터 Group Box */}
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

      {/* 5. TX 데이터 Group Box */}
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

      {/* 6. Action Utility Buttons */}
      <div className="flex flex-col gap-1 pt-1 mt-auto">
        <button
          onClick={onPrint}
          className={`w-full py-1.5 rounded flex items-center justify-center gap-1 font-medium text-[11px] transition-all ${
            isRetro
              ? 'border border-[#808080] bg-[#d4d0c8] active:bg-[#b0aca4]'
              : 'hover:bg-zinc-700/40 border border-zinc-700/60 text-zinc-300'
          }`}
          title="화면 인쇄 (Print)"
        >
          <Printer size={12} />
          <span>화면 인쇄</span>
        </button>
      </div>
    </div>
  );
};
