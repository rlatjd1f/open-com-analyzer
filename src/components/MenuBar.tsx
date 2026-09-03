import React, { useState, useRef, useEffect } from 'react';
import type { AppTheme } from '../types';

interface MenuBarProps {
  theme: AppTheme;
  onNewWindow: () => void;
  onOpenSettings: (initialTab?: 'serial' | 'tcp' | 'virtual' | 'buffer') => void;
  onDisconnect?: () => void;
  onClearScreen: () => void;
  onSaveLog: () => void;
  onOpenLog: () => void;
  onExportCsv: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  isFrozen: boolean;
  onToggleFreeze: () => void;
  onOpenProtocolHelp: () => void;
  onCheckUpdate: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  theme,
  onNewWindow,
  onOpenSettings,
  onDisconnect,
  onClearScreen,
  onSaveLog,
  onOpenLog,
  onExportCsv,
  autoScroll,
  onToggleAutoScroll,
  isFrozen,
  onToggleFreeze,
  onOpenProtocolHelp,
  onCheckUpdate
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    {
      id: 'file',
      label: '파일',
      options: [
        { label: '새 창 열기 (New Window)', shortcut: 'Cmd+N', action: onNewWindow },
        { type: 'separator', divider: true },
        { label: '패킷 로그 저장 (.txt)', action: onSaveLog },
        { label: 'CSV 데이터 내보내기 (.csv)', action: onExportCsv },
        { label: '로그 파일 열기...', action: onOpenLog },
        { divider: true },
        { label: '화면 버퍼 초기화', shortcut: 'Cmd+K', action: onClearScreen }
      ]
    },
    {
      id: 'comm',
      label: '통신 설정',
      options: [
        { label: 'TCP 소켓 설정...', action: () => onOpenSettings('tcp') },
        { label: '시리얼 (COM 포트) 설정...', action: () => onOpenSettings('serial') },
        { label: '가상 장치 시뮬레이터...', action: () => onOpenSettings('virtual') },
        { type: 'separator', divider: true },
        { label: '현재 통신 연결 종료 (Disconnect)', action: () => onDisconnect && onDisconnect() }
      ]
    },
    {
      id: 'display',
      label: '화면설정',
      options: [
        { label: autoScroll ? '✓ 자동 스크롤 켜짐' : '  자동 스크롤 꺼짐', action: onToggleAutoScroll },
        { label: isFrozen ? '✓ 화면 일시정지 (PAUSE)' : '  실시간 수신 모드', action: onToggleFreeze }
      ]
    },
    {
      id: 'screenState',
      label: '화면상태',
      options: [
        { label: '화면 모두 지우기', action: onClearScreen },
        { label: '일시정지 토글 (Space)', action: onToggleFreeze }
      ]
    },
    {
      id: 'protocol',
      label: '프로토콜',
      options: [
        { label: 'Modbus RTU 분석 가이드', action: onOpenProtocolHelp },
        { label: 'CRC-16 Modbus (0xA001)', action: () => {} },
        { label: 'Sum Check 8/16-bit', action: () => {} }
      ]
    },
    {
      id: 'micom',
      label: '마이컴',
      options: [
        { label: 'STM32 / ESP32 기본 보드레이트 (115200)', action: () => onOpenSettings('serial') },
        { label: 'Arduino 기본 보드레이트 (9600)', action: () => onOpenSettings('serial') }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      options: [
        { label: '업데이트 확인...', action: onCheckUpdate },
        { type: 'separator', divider: true },
        { label: 'COM Analyzer v0.0.7 정보', action: onOpenProtocolHelp },
        { label: '단축키 안내', action: onOpenProtocolHelp }
      ]
    }
  ];

  return (
    <div
      ref={menuRef}
      className={`relative h-6 flex items-center px-2 text-[11px] border-b select-none z-40 ${
        isRetro
          ? 'bg-[#ece9d8] text-black border-[#aca899]'
          : isDark
          ? 'bg-[#18181b] text-zinc-300 border-zinc-800'
          : 'bg-[#fafafa] text-zinc-700 border-zinc-200'
      }`}
    >
      {menuItems.map(menu => (
        <div key={menu.id} className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
            onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
            className={`px-2 py-0.5 rounded cursor-default transition-colors ${
              activeMenu === menu.id
                ? isRetro
                  ? 'bg-[#316ac5] text-white'
                  : 'bg-indigo-600 text-white'
                : isRetro
                ? 'hover:bg-[#316ac5] hover:text-white'
                : 'hover:bg-zinc-500/15'
            }`}
          >
            {menu.label}
          </button>

          {activeMenu === menu.id && (
            <div
              className={`absolute left-0 top-full mt-0.5 min-w-[200px] shadow-xl py-1 rounded-sm border z-50 ${
                isRetro
                  ? 'bg-[#ffffff] text-black border-[#808080]'
                  : isDark
                  ? 'bg-[#27272a] text-zinc-200 border-zinc-700'
                  : 'bg-white text-zinc-800 border-zinc-200'
              }`}
            >
              {menu.options.map((opt: any, idx) => {
                if (opt.divider) {
                  return (
                    <div
                      key={idx}
                      className={`my-1 border-t ${
                        isRetro ? 'border-[#aca899]' : isDark ? 'border-zinc-700' : 'border-zinc-200'
                      }`}
                    />
                  );
                }
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      opt.action();
                      setActiveMenu(null);
                    }}
                    className={`w-full text-left px-3 py-1 text-[11px] flex items-center justify-between ${
                      isRetro
                        ? 'hover:bg-[#316ac5] hover:text-white'
                        : isDark
                        ? 'hover:bg-indigo-600 hover:text-white'
                        : 'hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
