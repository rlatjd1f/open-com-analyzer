import React, { useState } from 'react';
import type { AppTheme, SerialPortInfo, SerialConfig, ConnectionStatus } from '../types';
import { X, RefreshCw, Cpu, Server, Wifi } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  ports: SerialPortInfo[];
  onRefreshPorts: () => void;
  status: ConnectionStatus;
  initialTab?: 'serial' | 'tcp' | 'virtual' | 'buffer';
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
  ports,
  onRefreshPorts,
  status,
  initialTab = 'serial',
  onConnectSerial,
  onStartTcpServer,
  onConnectTcpClient,
  onStartVirtualDevice,
  onDisconnect,
  maxBufferPackets,
  onMaxBufferChange
}) => {
  const [activeTab, setActiveTab] = useState<'serial' | 'tcp' | 'virtual' | 'buffer'>(initialTab);

  // Serial Form State
  const [selectedPort, setSelectedPort] = useState(ports[0]?.path || '');
  const [baudRate, setBaudRate] = useState(115200);
  const [dataBits, setDataBits] = useState(8);
  const [stopBits, setStopBits] = useState(1);
  const [parity, setParity] = useState<'none' | 'even' | 'odd' | 'mark' | 'space'>('none');
  const [rtscts, setRtscts] = useState(false);

  // TCP Form State
  const [tcpMode, setTcpMode] = useState<'server' | 'client'>('server');
  const [tcpPort, setTcpPort] = useState(121); // Default 121 matching screenshot
  const [tcpHost, setTcpHost] = useState('127.0.0.1');

  // Virtual Device State
  const [virtualMode, setVirtualMode] = useState<'echo' | 'modbus' | 'stream'>('modbus');

  React.useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (ports.length > 0 && !selectedPort) {
      // Pick first USB port or first available
      const usb = ports.find(p => p.isUsb);
      setSelectedPort(usb ? usb.path : ports[0].path);
    }
  }, [ports, selectedPort]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className={`w-full max-w-lg rounded-xl shadow-2xl border overflow-hidden flex flex-col ${
          isRetro
            ? 'bg-[#ece9d8] text-black border-[#808080] font-sans'
            : isDark
            ? 'bg-[#18181b] text-zinc-200 border-zinc-700'
            : 'bg-white text-zinc-800 border-zinc-300'
        }`}
      >
        {/* Header */}
        <div
          className={`px-4 py-2.5 flex items-center justify-between border-b ${
            isRetro
              ? 'bg-[#0a246a] text-white font-bold'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">통신 포트 및 환경 설정</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-75 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          className={`flex border-b text-xs ${
            isRetro
              ? 'bg-[#d4d0c8] border-[#808080]'
              : isDark
              ? 'bg-zinc-900/50 border-zinc-800'
              : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            onClick={() => setActiveTab('serial')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium transition-colors ${
              activeTab === 'serial'
                ? isRetro
                  ? 'bg-[#ece9d8] font-bold border-b-2 border-blue-600'
                  : 'bg-indigo-600 text-white shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Cpu size={14} />
            <span>시리얼 (COM / USB)</span>
          </button>
          <button
            onClick={() => setActiveTab('tcp')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium transition-colors ${
              activeTab === 'tcp'
                ? isRetro
                  ? 'bg-[#ece9d8] font-bold border-b-2 border-blue-600'
                  : 'bg-indigo-600 text-white shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Server size={14} />
            <span>TCP 서버/클라이언트</span>
          </button>
          <button
            onClick={() => setActiveTab('virtual')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium transition-colors ${
              activeTab === 'virtual'
                ? isRetro
                  ? 'bg-[#ece9d8] font-bold border-b-2 border-blue-600'
                  : 'bg-indigo-600 text-white shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <Wifi size={14} />
            <span>가상 시뮬레이터</span>
          </button>
          <button
            onClick={() => setActiveTab('buffer')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 font-medium transition-colors ${
              activeTab === 'buffer'
                ? isRetro
                  ? 'bg-[#ece9d8] font-bold border-b-2 border-blue-600'
                  : 'bg-indigo-600 text-white shadow-sm'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <span>버퍼 한도</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 text-xs">
          {/* TAB 1: SERIAL */}
          {activeTab === 'serial' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold">시리얼 포트 (macOS /dev/cu.*)</label>
                  <button
                    onClick={onRefreshPorts}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:underline"
                  >
                    <RefreshCw size={11} />
                    <span>새로고침</span>
                  </button>
                </div>
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  className={`w-full h-8 px-2 rounded border outline-none font-mono text-xs ${
                    isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                  }`}
                >
                  {ports.length === 0 && (
                    <option value="">감지된 포트 없음 (USB 케이블을 연결하세요)</option>
                  )}
                  {ports.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''} {p.isUsb ? '[USB]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Baud Rate (통신 속도)</label>
                  <select
                    value={baudRate}
                    onChange={(e) => setBaudRate(parseInt(e.target.value, 10))}
                    className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                      isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {[9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600].map((b) => (
                      <option key={b} value={b}>
                        {b} bps
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Data Bits</label>
                  <select
                    value={dataBits}
                    onChange={(e) => setDataBits(parseInt(e.target.value, 10))}
                    className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                      isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                    }`}
                  >
                    {[8, 7, 6, 5].map((d) => (
                      <option key={d} value={d}>
                        {d} Bits
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Parity</label>
                  <select
                    value={parity}
                    onChange={(e) => setParity(e.target.value as any)}
                    className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                      isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                    }`}
                  >
                    <option value="none">None (없음)</option>
                    <option value="even">Even (짝수)</option>
                    <option value="odd">Odd (홀수)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Stop Bits</label>
                  <select
                    value={stopBits}
                    onChange={(e) => setStopBits(parseFloat(e.target.value))}
                    className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                      isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                    }`}
                  >
                    <option value={1}>1 Bit</option>
                    <option value={1.5}>1.5 Bits</option>
                    <option value={2}>2 Bits</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rtscts}
                  onChange={(e) => setRtscts(e.target.checked)}
                  className="accent-indigo-600"
                />
                <span>하드웨어 흐름 제어 (RTS / CTS 사용)</span>
              </label>
            </div>
          )}

          {/* TAB 2: TCP */}
          {activeTab === 'tcp' && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setTcpMode('server')}
                  className={`flex-1 py-1.5 rounded font-semibold border ${
                    tcpMode === 'server'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-black/5 dark:bg-white/5 border-zinc-400/40'
                  }`}
                >
                  TCP Server (서버 대기)
                </button>
                <button
                  onClick={() => setTcpMode('client')}
                  className={`flex-1 py-1.5 rounded font-semibold border ${
                    tcpMode === 'client'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-black/5 dark:bg-white/5 border-zinc-400/40'
                  }`}
                >
                  TCP Client (원격 접속)
                </button>
              </div>

              {tcpMode === 'server' ? (
                <div>
                  <label className="font-semibold block mb-1">
                    서버 수신 포트 (PORT 기본값: 121)
                  </label>
                  <input
                    type="number"
                    value={tcpPort}
                    onChange={(e) => setTcpPort(parseInt(e.target.value, 10) || 121)}
                    className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                      isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                    }`}
                  />
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    * 스크린샷과 동일하게 기본 <b>PORT: 121</b>로 TCP Server를 구동합니다.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="font-semibold block mb-1">원격 서버 IP / 호스트</label>
                    <input
                      type="text"
                      value={tcpHost}
                      onChange={(e) => setTcpHost(e.target.value)}
                      className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">포트</label>
                    <input
                      type="number"
                      value={tcpPort}
                      onChange={(e) => setTcpPort(parseInt(e.target.value, 10) || 121)}
                      className={`w-full h-8 px-2 rounded border outline-none font-mono ${
                        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-300'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VIRTUAL SIMULATOR */}
          {activeTab === 'virtual' && (
            <div className="flex flex-col gap-3">
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                <span className="font-bold">실제 통신 장비가 없어도 즉시 테스트 가능!</span>
                <p className="text-[11px] mt-0.5 opacity-90">
                  송신 데이터(`010600EF000179FF`)를 보내면 시뮬레이터가 반응하여 RX 패킷을 회신합니다.
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1">시뮬레이션 모드 선택</label>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded border border-zinc-400/30">
                    <input
                      type="radio"
                      name="virtualMode"
                      checked={virtualMode === 'modbus'}
                      onChange={() => setVirtualMode('modbus')}
                      className="accent-indigo-600"
                    />
                    <div>
                      <span className="font-semibold">Modbus RTU Slave 에코</span>
                      <p className="text-[10px] text-zinc-500">
                        스크린샷의 01 06 명령에 응답하거나 센서 레지스터 데이터 자동 반환
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded border border-zinc-400/30">
                    <input
                      type="radio"
                      name="virtualMode"
                      checked={virtualMode === 'echo'}
                      onChange={() => setVirtualMode('echo')}
                      className="accent-indigo-600"
                    />
                    <div>
                      <span className="font-semibold">직접 루프백 (Echo)</span>
                      <p className="text-[10px] text-zinc-500">
                        보낸 바이트 데이터를 즉시 그대로 수신 데이터로 반사
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded border border-zinc-400/30">
                    <input
                      type="radio"
                      name="virtualMode"
                      checked={virtualMode === 'stream'}
                      onChange={() => setVirtualMode('stream')}
                      className="accent-indigo-600"
                    />
                    <div>
                      <span className="font-semibold">실시간 센서 패킷 연속 스트리밍</span>
                      <p className="text-[10px] text-zinc-500">
                        1초마다 사인파 센서 데이터 패킷을 자동으로 발생
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BUFFER LIMIT */}
          {activeTab === 'buffer' && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="font-semibold mb-1 block">
                  화면 최대 스크롤 라인 수 (FIFO Ring Buffer)
                </label>
                <p className="text-[11px] text-zinc-500 mb-3">
                  장시간 통신 시 메모리 누수를 방지하고 60fps 부드러운 스크롤을 유지하기 위해 최대 보관 라인 수를 제한합니다. 한도에 도달하면 가장 오래된 맨 위 패킷부터 자동 정리(FIFO)됩니다.
                </p>

                <div className="flex flex-col gap-2">
                  {[
                    { value: 500, label: '500 줄', desc: '초고속 통신 및 초경량 모드' },
                    { value: 1000, label: '1,000 줄 (기본 권장)', desc: '가장 쾌적하고 렉 없는 표준 버퍼 크기' },
                    { value: 2000, label: '2,000 줄', desc: '긴 Modbus 통신 프레임 분석용' },
                    { value: 5000, label: '5,000 줄', desc: '대용량 모니터링용' },
                    { value: 0, label: '무제한 (Unlimited)', desc: '수동으로 화면을 비울 때까지 무제한 보관 (메모리 주의)' }
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                        maxBufferPackets === opt.value
                          ? 'border-indigo-500 bg-indigo-500/10 font-bold'
                          : 'border-zinc-400/30 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="bufferLimit"
                          checked={maxBufferPackets === opt.value}
                          onChange={() => onMaxBufferChange(opt.value)}
                          className="accent-indigo-600"
                        />
                        <span>{opt.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-normal">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`px-4 py-3 flex items-center justify-between border-t ${
            isRetro
              ? 'bg-[#d4d0c8] border-[#808080]'
              : isDark
              ? 'bg-zinc-900 border-zinc-800'
              : 'bg-zinc-50 border-zinc-200'
          }`}
        >
          {status.connected ? (
            <button
              onClick={() => {
                onDisconnect();
                onClose();
              }}
              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm"
            >
              연결 끊기 (Disconnect)
            </button>
          ) : (
            <span className="text-zinc-500 text-xs">상태: 연결 대기</span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded text-xs border ${
                isRetro
                  ? 'border-[#808080] bg-[#e0ded8]'
                  : 'border-zinc-400/40 hover:bg-zinc-500/10'
              }`}
            >
              취소
            </button>

            {activeTab === 'serial' && (
              <button
                onClick={handleSerialConnect}
                disabled={!selectedPort}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-sm"
              >
                시리얼 포트 열기
              </button>
            )}

            {activeTab === 'tcp' && (
              <button
                onClick={handleTcpAction}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm"
              >
                {tcpMode === 'server' ? 'TCP 서버 시작' : 'TCP 서버 접속'}
              </button>
            )}

            {activeTab === 'virtual' && (
              <button
                onClick={handleVirtualAction}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
              >
                가상 시뮬레이터 시작
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
