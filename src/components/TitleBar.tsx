import React from 'react';
import type { ConnectionStatus, AppTheme } from '../types';
import { Moon, Sun, Monitor, Settings, CopyPlus } from 'lucide-react';

interface TitleBarProps {
  status: ConnectionStatus;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme['name']) => void;
  onOpenSettings: () => void;
  onNewWindow: () => void;
  rxCount: number;
  txCount: number;
  appVersion?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  status,
  theme,
  onThemeChange,
  onOpenSettings,
  onNewWindow,
  rxCount,
  txCount,
  appVersion = 'v0.0.2'
}) => {
  // Title text matching the classic app format
  let titleText = 'COM ANALYZER';
  if (status.connected) {
    if (status.type === 'tcp-server') {
      titleText = `COM ANALYZER , TCP SERVER설정: PORT:${status.port || 121} , 접속자 수:${status.clientCount ?? 0} - Analyzer`;
    } else if (status.type === 'serial') {
      titleText = `COM ANALYZER , SERIAL: ${status.info} - Analyzer`;
    } else if (status.type === 'virtual') {
      titleText = `COM ANALYZER , 가상 디바이스 시뮬레이터 - Analyzer`;
    } else {
      titleText = `COM ANALYZER , ${status.info} - Analyzer`;
    }
  } else {
    titleText = 'COM ANALYZER - Analyzer (연결 대기중)';
  }

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className={`h-9 flex items-center justify-between pl-[74px] pr-3 select-none text-xs border-b transition-colors ${
        isRetro
          ? 'bg-[#d4d0c8] text-black border-[#808080] font-sans'
          : isDark
          ? 'bg-[#18181b]/90 text-zinc-300 border-zinc-800 backdrop-blur-md'
          : 'bg-[#f4f4f5]/90 text-zinc-700 border-zinc-200 backdrop-blur-md'
      }`}
    >
      {/* Left: App Title & Version Badge */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-semibold tracking-tight truncate max-w-md ${isRetro ? 'font-bold' : ''}`}>
          {titleText}
        </span>
        <span
          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm shrink-0 select-none ${
            isRetro
              ? 'bg-[#15213b] text-[#55f2ff] border border-[#6d8bc9]'
              : isDark
              ? 'bg-zinc-800 text-indigo-400 border border-zinc-700/80'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}
        >
          {appVersion}
        </span>
      </div>

      {/* Center: Live Stats Badges */}
      <div className="hidden md:flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              status.connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-zinc-400'
            }`}
          />
          <span className="font-mono text-[11px] font-semibold">
            {status.connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <div className="h-3 w-[1px] bg-zinc-400/30" />
        <span className="font-mono text-[11px] text-amber-500">
          RX: <b>{rxCount.toLocaleString()}</b> B
        </span>
        <span className="font-mono text-[11px] text-cyan-500">
          TX: <b>{txCount.toLocaleString()}</b> B
        </span>
      </div>

      {/* Right: New Window, Theme Switcher & Settings Quick Action */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center gap-1"
      >
        {/* New Window Button */}
        <button
          onClick={onNewWindow}
          className={`p-1.5 rounded transition-all flex items-center gap-1 text-[11px] font-medium ${
            isRetro
              ? 'border border-[#808080] bg-[#e0ded8] active:bg-[#c0beb8]'
              : 'hover:bg-zinc-500/10 active:scale-95 text-emerald-500 dark:text-emerald-400'
          }`}
          title="새 창 열기 (Cmd + N)"
        >
          <CopyPlus size={13} />
          <span className="hidden sm:inline">새 창</span>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={() => {
            if (theme.name === 'modern-dark') onThemeChange('modern-light');
            else if (theme.name === 'modern-light') onThemeChange('classic-retro');
            else onThemeChange('modern-dark');
          }}
          className={`p-1.5 rounded transition-all flex items-center gap-1 text-[11px] ${
            isRetro
              ? 'border border-[#808080] bg-[#e0ded8] active:bg-[#c0beb8]'
              : 'hover:bg-zinc-500/10 active:scale-95'
          }`}
          title="테마 변경 (다크 / 라이트 / 클래식 레트로)"
        >
          {theme.name === 'modern-dark' && <Moon size={13} className="text-indigo-400" />}
          {theme.name === 'modern-light' && <Sun size={13} className="text-amber-500" />}
          {theme.name === 'classic-retro' && <Monitor size={13} className="text-zinc-600" />}
          <span className="hidden sm:inline font-mono">
            {theme.name === 'modern-dark' ? 'Dark' : theme.name === 'modern-light' ? 'Light' : 'Retro'}
          </span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className={`p-1.5 rounded flex items-center gap-1 text-[11px] ${
            isRetro
              ? 'border border-[#808080] bg-[#e0ded8] active:bg-[#c0beb8]'
              : 'hover:bg-zinc-500/10 active:scale-95 text-indigo-400'
          }`}
          title="통신 및 포트 설정 (Cmd + ,)"
        >
          <Settings size={13} />
          <span className="hidden sm:inline">설정</span>
        </button>
      </div>
    </div>
  );
};
