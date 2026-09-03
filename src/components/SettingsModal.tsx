import React, { useState, useEffect } from 'react';
import type { AppTheme, SerialPortInfo, SerialConfig, ConnectionStatus } from '../types';
import { X, RefreshCw, Cpu, Server, Wifi, Palette, Layers, Check, Moon, Sun, Monitor } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  onThemeChange?: (themeName: AppTheme['name']) => void;
  onThemeColorChange?: (key: 'rxColor' | 'txColor' | 'textColor', color: string) => void;
  ports: SerialPortInfo[];
  onRefreshPorts: () => void;
  status: ConnectionStatus;
  initialTab?: 'tcp' | 'serial' | 'virtual' | 'theme' | 'buffer';
  onConnectSerial: (config: SerialConfig) => void;
  onStartTcpServer: (port: number) => void;
  onConnectTcpClient: (host: string, port: number) => void;
  onStartVirtualDevice: (mode: 'echo' | 'modbus' | 'stream') => void;
  onDisconnect: () => void;
  maxBufferPackets: number;
  onMaxBufferChange: (limit: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  onThemeColorChange,
  ports,
  onRefreshPorts,
  status,
  initialTab = 'tcp',
  onConnectSerial,
  onStartTcpServer,
  onConnectTcpClient,
  onStartVirtualDevice,
  onDisconnect,
  maxBufferPackets,
  onMaxBufferChange
}) => {
  const [activeTab, setActiveTab] = useState<'tcp' | 'serial' | 'virtual' | 'theme' | 'buffer'>(initialTab);

  // Serial Form State
  const [selectedPort, setSelectedPort] = useState(ports[0]?.path || '');
  const [baudRate, setBaudRate] = useState(115200);
  const [dataBits, setDataBits] = useState(8);
  const [stopBits, setStopBits] = useState(1);
  const [parity, setParity] = useState<'none' | 'even' | 'odd' | 'mark' | 'space'>('none');
  const [rtscts, setRtscts] = useState(false);

  // TCP Form State
  const [tcpMode, setTcpMode] = useState<'server' | 'client'>('server');
  const [tcpPort, setTcpPort] = useState(121); // Default 121 matching COM Analyzer standard
  const [tcpHost, setTcpHost] = useState('127.0.0.1');

  // Virtual Device State
  const [virtualMode, setVirtualMode] = useState<'echo' | 'modbus' | 'stream'>('modbus');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (ports.length > 0 && !selectedPort) {
      const usb = ports.find(p => p.isUsb);
      setSelectedPort(usb ? usb.path : ports[0].path);
    }
  }, [ports, selectedPort]);

  // ESC key listener to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  const handleSerialConnect = () => {
    onConnectSerial({
      path: selectedPort,
      baudRate,
      dataBits,
      stopBits,
      parity,
      rtscts
    });
    onClose();
  };

  const handleTcpAction = () => {
    if (tcpMode === 'server') {
      onStartTcpServer(tcpPort);
    } else {
      onConnectTcpClient(tcpHost, tcpPort);
    }
    onClose();
  };

  const handleVirtualAction = () => {
    onStartVirtualDevice(virtualMode);
    onClose();
  };

  const sidebarItems = [
    { id: 'tcp', label: 'TCP 소켓 설정', icon: Server, desc: 'Server (Port: 121) / Client' },
    { id: 'serial', label: '시리얼 포트 (COM)', icon: Cpu, desc: 'USB-to-UART / RS-232 / 485' },
    { id: 'virtual', label: '가상 시뮬레이터', icon: Wifi, desc: 'Modbus RTU / Sensor Stream' },
    { id: 'theme', label: '테마 및 화면', icon: Palette, desc: 'Classic Retro / Dark / Light' },
    { id: 'buffer', label: '버퍼 한도 관리', icon: Layers, desc: 'FIFO 링 버퍼 한도 설정' },
  ] as const;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl h-[520px] rounded-xl shadow-2xl border overflow-hidden flex flex-col ${
          isRetro
            ? 'bg-[#ece9d8] text-black border-[#808080] font-sans'
            : isDark
            ? 'bg-zinc-900 text-zinc-200 border-zinc-700/80 shadow-indigo-950/40'
            : 'bg-white text-zinc-800 border-zinc-200 shadow-zinc-300/60'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3 flex items-center justify-between border-b shrink-0 ${
            isRetro
              ? 'bg-[#0a246a] text-white font-bold'
              : isDark
              ? 'bg-zinc-800/90 border-zinc-700/80'
              : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight">통신 포트 및 환경 설정</span>
            <span className="text-[10px] font-mono opacity-60 ml-2 hidden sm:inline">(ESC 키로 닫기)</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${
              isRetro ? 'hover:bg-red-600 text-white' : 'hover:bg-zinc-700/50 text-zinc-400 hover:text-white'
            }`}
            title="닫기 (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Main Body: Left Sidebar + Right Content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Sidebar Navigation */}
          <div
            className={`w-52 shrink-0 border-r flex flex-col p-2 gap-1 overflow-y-auto ${
              isRetro
                ? 'bg-[#d4d0c8] border-[#808080]'
                : isDark
                ? 'bg-zinc-950/60 border-zinc-800'
                : 'bg-zinc-50/80 border-zinc-200'
            }`}
          >
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider opacity-50 mb-0.5">
              Settings Menu
            </div>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all ${
                    isActive
                      ? isRetro
                        ? 'bg-[#000080] text-white font-bold shadow-sm'
                        : 'bg-indigo-600 text-white font-semibold shadow-md'
                      : isRetro
                      ? 'hover:bg-[#b8b4a8] text-black'
                      : 'hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-white' : isRetro ? 'text-zinc-700' : 'text-zinc-400'} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs truncate">{item.label}</span>
                    <span className={`text-[10px] truncate ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                      {item.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Content Panel */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between text-xs">
            {/* TAB 1: SERIAL */}
            {activeTab === 'serial' && (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-xs">시리얼 포트 (Device Port)</label>
                    <button
                      type="button"
                      onClick={onRefreshPorts}
                      className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={11} /> 새로고침
                    </button>
                  </div>
                  <select
                    value={selectedPort}
                    onChange={(e) => setSelectedPort(e.target.value)}
                    className={`w-full p-2 border rounded font-mono text-xs ${
                      isRetro
                        ? 'bg-white border-[#808080] text-black'
                        : isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-white border-zinc-300'
                    }`}
                  >
                    {ports.length === 0 ? (
                      <option value="">검색된 시리얼 포트가 없습니다 (USB 연결 확인)</option>
                    ) : (
                      ports.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''} {p.isUsb ? '⚡️ USB' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">통신 속도 (Baud Rate)</label>
                    <select
                      value={baudRate}
                      onChange={(e) => setBaudRate(Number(e.target.value))}
                      className={`w-full p-2 border rounded font-mono text-xs ${
                        isRetro
                          ? 'bg-white border-[#808080] text-black'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-zinc-300'
                      }`}
                    >
                      {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((b) => (
                        <option key={b} value={b}>
                          {b.toLocaleString()} bps
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">데이터 비트 (Data Bits)</label>
                    <select
                      value={dataBits}
                      onChange={(e) => setDataBits(Number(e.target.value))}
                      className={`w-full p-2 border rounded font-mono text-xs ${
                        isRetro
                          ? 'bg-white border-[#808080] text-black'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-zinc-300'
                      }`}
                    >
                      {[7, 8].map((db) => (
                        <option key={db} value={db}>
                          {db} Bits
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">패리티 (Parity)</label>
                    <select
                      value={parity}
                      onChange={(e) => setParity(e.target.value as any)}
                      className={`w-full p-2 border rounded font-mono text-xs ${
                        isRetro
                          ? 'bg-white border-[#808080] text-black'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-zinc-300'
                      }`}
                    >
                      <option value="none">None (없음)</option>
                      <option value="even">Even (짝수)</option>
                      <option value="odd">Odd (홀수)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">정지 비트 (Stop Bits)</label>
                    <select
                      value={stopBits}
                      onChange={(e) => setStopBits(Number(e.target.value))}
                      className={`w-full p-2 border rounded font-mono text-xs ${
                        isRetro
                          ? 'bg-white border-[#808080] text-black'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-zinc-300'
                      }`}
                    >
                      <option value={1}>1 Bit</option>
                      <option value={2}>2 Bits</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="rtscts"
                    checked={rtscts}
                    onChange={(e) => setRtscts(e.target.checked)}
                    className="cursor-pointer"
                  />
                  <label htmlFor="rtscts" className="cursor-pointer select-none">
                    하드웨어 흐름 제어 (RTS/CTS) 사용
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: TCP */}
            {activeTab === 'tcp' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block font-semibold mb-1">TCP 동작 모드</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="tcpMode"
                        value="server"
                        checked={tcpMode === 'server'}
                        onChange={() => setTcpMode('server')}
                      />
                      <span>TCP Server (포트 수신 대기)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="tcpMode"
                        value="client"
                        checked={tcpMode === 'client'}
                        onChange={() => setTcpMode('client')}
                      />
                      <span>TCP Client (원격 접속)</span>
                    </label>
                  </div>
                </div>

                {tcpMode === 'client' && (
                  <div>
                    <label className="block font-semibold mb-1">원격 서버 IP 주소</label>
                    <input
                      type="text"
                      value={tcpHost}
                      onChange={(e) => setTcpHost(e.target.value)}
                      placeholder="127.0.0.1"
                      className={`w-full p-2 border rounded font-mono text-xs ${
                        isRetro
                          ? 'bg-white border-[#808080] text-black'
                          : isDark
                          ? 'bg-zinc-800 border-zinc-700 text-white'
                          : 'bg-white border-zinc-300'
                      }`}
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-1">포트 번호 (PORT)</label>
                  <input
                    type="number"
                    value={tcpPort}
                    onChange={(e) => setTcpPort(Number(e.target.value))}
                    className={`w-full p-2 border rounded font-mono text-xs ${
                      isRetro
                        ? 'bg-white border-[#808080] text-black'
                        : isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-white border-zinc-300'
                    }`}
                  />
                  <span className="text-[11px] opacity-70 mt-1 block">
                    * 기본 포트: <b>121</b> (오리지널 COM Analyzer 표준 포트)
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: VIRTUAL DEVICE */}
            {activeTab === 'virtual' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded bg-indigo-50/20 border border-indigo-500/20">
                  <span className="font-semibold text-indigo-400 block mb-1">가상 시뮬레이터란?</span>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    실제 하드웨어나 시리얼 케이블이 연결되어 있지 않아도, 패킷 송수신과 1:1 반응발송, Modbus RTU Slave 에코 동작을 즉시 테스트할 수 있는 내장 시뮬레이터입니다.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold mb-1.5">시뮬레이터 동작 방식 선택</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-2 p-2.5 rounded border cursor-pointer hover:bg-zinc-500/10">
                      <input
                        type="radio"
                        name="virtualMode"
                        value="modbus"
                        checked={virtualMode === 'modbus'}
                        onChange={() => setVirtualMode('modbus')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-semibold">Modbus RTU Slave 에코 모드 (권장)</div>
                        <div className="text-[11px] opacity-70">
                          송신 패킷을 분석하여 올바른 Modbus 응답 프레임과 CRC-16을 계산하여 자동 회신합니다.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 p-2.5 rounded border cursor-pointer hover:bg-zinc-500/10">
                      <input
                        type="radio"
                        name="virtualMode"
                        value="echo"
                        checked={virtualMode === 'echo'}
                        onChange={() => setVirtualMode('echo')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-semibold">Simple Loopback Echo (단순 반향)</div>
                        <div className="text-[11px] opacity-70">보낸 데이터를 그대로 되돌려줍니다.</div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 p-2.5 rounded border cursor-pointer hover:bg-zinc-500/10">
                      <input
                        type="radio"
                        name="virtualMode"
                        value="stream"
                        checked={virtualMode === 'stream'}
                        onChange={() => setVirtualMode('stream')}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-semibold">가상 센서 스트림 (Auto Stream)</div>
                        <div className="text-[11px] opacity-70">1초마다 임의의 센서 패킷을 지속 발송합니다.</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: THEME SELECTION */}
            {activeTab === 'theme' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block font-semibold text-xs mb-2">기본 테마 스타일 선택</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Retro */}
                    <button
                      type="button"
                      onClick={() => onThemeChange && onThemeChange('classic-retro')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                        theme.name === 'classic-retro'
                          ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-500'
                          : 'border-zinc-700/60 hover:bg-zinc-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Monitor size={16} className="text-zinc-500" />
                        {theme.name === 'classic-retro' && <Check size={14} className="text-blue-500" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Classic Retro</div>
                        <div className="text-[10px] opacity-60">오리지널 윈도우 스타일</div>
                      </div>
                    </button>

                    {/* Dark */}
                    <button
                      type="button"
                      onClick={() => onThemeChange && onThemeChange('modern-dark')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                        theme.name === 'modern-dark'
                          ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500'
                          : 'border-zinc-700/60 hover:bg-zinc-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Moon size={16} className="text-indigo-400" />
                        {theme.name === 'modern-dark' && <Check size={14} className="text-indigo-400" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Modern Dark</div>
                        <div className="text-[10px] opacity-60">고대비 딥 다크 테마</div>
                      </div>
                    </button>

                    {/* Light */}
                    <button
                      type="button"
                      onClick={() => onThemeChange && onThemeChange('modern-light')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-2 transition-all ${
                        theme.name === 'modern-light'
                          ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500'
                          : 'border-zinc-700/60 hover:bg-zinc-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Sun size={16} className="text-amber-500" />
                        {theme.name === 'modern-light' && <Check size={14} className="text-amber-500" />}
                      </div>
                      <div>
                        <div className="font-bold text-xs">Modern Light</div>
                        <div className="text-[10px] opacity-60">밝은 라이트 테마</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Color Customization Section */}
                <div className="mt-2 flex flex-col gap-2">
                  <label className="block font-semibold text-xs">패킷 및 텍스트 색상 커스텀</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* RX Color */}
                    <label className="p-2.5 rounded-lg border flex items-center justify-between cursor-pointer hover:bg-zinc-500/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">RX 수신 색상</span>
                        <span className="font-mono text-[10px] opacity-70">{theme.rxColor}</span>
                      </div>
                      <input
                        type="color"
                        value={theme.rxColor}
                        onChange={(e) => onThemeColorChange && onThemeColorChange('rxColor', e.target.value)}
                        className="w-7 h-7 rounded border border-black/30 cursor-pointer bg-transparent"
                      />
                    </label>

                    {/* TX Color */}
                    <label className="p-2.5 rounded-lg border flex items-center justify-between cursor-pointer hover:bg-zinc-500/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">TX 송신 색상</span>
                        <span className="font-mono text-[10px] opacity-70">{theme.txColor}</span>
                      </div>
                      <input
                        type="color"
                        value={theme.txColor}
                        onChange={(e) => onThemeColorChange && onThemeColorChange('txColor', e.target.value)}
                        className="w-7 h-7 rounded border border-black/30 cursor-pointer bg-transparent"
                      />
                    </label>

                    {/* Text / Font Color */}
                    <label className="p-2.5 rounded-lg border flex items-center justify-between cursor-pointer hover:bg-zinc-500/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">기본 글꼴 색상</span>
                        <span className="font-mono text-[10px] opacity-70">{theme.textColor}</span>
                      </div>
                      <input
                        type="color"
                        value={theme.textColor}
                        onChange={(e) => onThemeColorChange && onThemeColorChange('textColor', e.target.value)}
                        className="w-7 h-7 rounded border border-black/30 cursor-pointer bg-transparent"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: BUFFER */}
            {activeTab === 'buffer' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20">
                  <span className="font-semibold text-amber-500 block mb-1">FIFO 링 버퍼 메모리 관리</span>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    시리얼 스트리밍 시 화면에 보관할 최대 패킷(행) 수를 설정합니다. 한도에 도달하면 가장 오래된 데이터부터 자동으로 정리되어 장시간 통신 시에도 항상 60fps 부드러운 스크롤을 유지합니다.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold mb-2">최대 스크롤 한도 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 500, label: '500줄 (가벼운 분석)' },
                      { value: 1000, label: '1,000줄 (기본 권장)' },
                      { value: 2000, label: '2,000줄 (중대형 패킷)' },
                      { value: 5000, label: '5,000줄 (대용량 로그)' },
                      { value: 0, label: '무제한 (모두 보관)' }
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`p-2.5 rounded border flex items-center gap-2 cursor-pointer transition-all ${
                          maxBufferPackets === opt.value
                            ? 'border-indigo-500 bg-indigo-50/10 font-bold'
                            : 'border-zinc-700/50 hover:bg-zinc-500/5'
                        }`}
                      >
                        <input
                          type="radio"
                          name="maxBuffer"
                          checked={maxBufferPackets === opt.value}
                          onChange={() => onMaxBufferChange(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className={`pt-4 border-t flex items-center justify-between mt-auto ${isRetro ? 'border-[#808080]' : 'border-zinc-700/60'}`}>
              <div className="flex items-center gap-2">
                {status.connected && (
                  <button
                    type="button"
                    onClick={() => {
                      onDisconnect();
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all shadow-sm"
                  >
                    현재 연결 끊기 (Disconnect)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3.5 py-1.5 rounded text-xs transition-all ${
                    isRetro
                      ? 'border border-[#808080] bg-[#d4d0c8] active:bg-[#b0aca4]'
                      : 'hover:bg-zinc-700/40 text-zinc-400 hover:text-white'
                  }`}
                >
                  취소 (ESC)
                </button>

                {activeTab === 'serial' && (
                  <button
                    type="button"
                    onClick={handleSerialConnect}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all shadow-md ${
                      isRetro
                        ? 'border-2 border-white bg-[#000080] text-white active:bg-blue-900'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
                    }`}
                  >
                    시리얼 포트 열기
                  </button>
                )}

                {activeTab === 'tcp' && (
                  <button
                    type="button"
                    onClick={handleTcpAction}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all shadow-md ${
                      isRetro
                        ? 'border-2 border-white bg-[#000080] text-white active:bg-blue-900'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
                    }`}
                  >
                    {tcpMode === 'server' ? 'TCP 서버 시작 (Port 121)' : 'TCP 서버 접속'}
                  </button>
                )}

                {activeTab === 'virtual' && (
                  <button
                    type="button"
                    onClick={handleVirtualAction}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all shadow-md ${
                      isRetro
                        ? 'border-2 border-white bg-[#000080] text-white active:bg-blue-900'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
                    }`}
                  >
                    시뮬레이터 시작
                  </button>
                )}

                {(activeTab === 'theme' || activeTab === 'buffer') && (
                  <button
                    type="button"
                    onClick={onClose}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all shadow-md ${
                      isRetro
                        ? 'border-2 border-white bg-[#000080] text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    확인
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
