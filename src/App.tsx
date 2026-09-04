import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { MenuBar } from './components/MenuBar';
import { PacketGrid } from './components/PacketGrid';
import { ControlSidebar } from './components/ControlSidebar';
import { SendPanel } from './components/SendPanel';
import { UtilityPanel } from './components/UtilityPanel';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { UpdateModal, type UpdateInfo } from './components/UpdateModal';
import {
  type Packet,
  type ConnectionStatus,
  type SerialPortInfo,
  type SerialConfig,
  type AppTheme,
  APP_VERSION
} from './types';

const CANDIDATE_PORTS = [4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010];

export const App: React.FC = () => {
  // --- States ---
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    info: '연결 대기중'
  });
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [rxCount, setRxCount] = useState(0);
  const [txCount, setTxCount] = useState(0);

  // Settings and Modes
  const [rxMode, setRxMode] = useState<'ascii' | 'binary'>('binary');
  const [txMode, setTxMode] = useState<'ascii' | 'binary'>('binary');
  const [dlgState, setDlgState] = useState<'top' | 'middle' | 'bottom'>('middle');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);

  const [rxBlinking, setRxBlinking] = useState(false);
  const [txBlinking, setTxBlinking] = useState(false);
  const [lastRxPacket, setLastRxPacket] = useState<Packet | null>(null);

  // Buffer Limit State (Persisted in localStorage, Default: 1,000 packets)
  const [maxBufferPackets, setMaxBufferPackets] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('com_analyzer_buffer_limit');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
    } catch (e) {}
    return 1000;
  });

  const maxBufferPacketsRef = useRef(maxBufferPackets);
  useEffect(() => {
    maxBufferPacketsRef.current = maxBufferPackets;
    try {
      localStorage.setItem('com_analyzer_buffer_limit', String(maxBufferPackets));
    } catch (e) {}
  }, [maxBufferPackets]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'tcp' | 'serial' | 'virtual' | 'theme' | 'buffer'>('tcp');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [insertedData, setInsertedData] = useState('');

  // Auto-Update States
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'completed' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, downloaded: 0, total: 0 });
  const [updateStatusMessage, setUpdateStatusMessage] = useState('');

  // Theme (Persisted in localStorage)
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('com_analyzer_theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name && parsed.rxColor && parsed.txColor) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved theme:', e);
    }
    return {
      name: 'modern-light',
      rxColor: '#f59e0b',
      txColor: '#06b6d4',
      textColor: '#000000'
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('com_analyzer_theme', JSON.stringify(theme));
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  }, [theme]);

  const wsRef = useRef<WebSocket | null>(null);
  const portIndexRef = useRef(0);
  const reconnectTimerRef = useRef<any>(null);
  const rxBlinkTimer = useRef<any>(null);
  const txBlinkTimer = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevStatusRef = useRef<ConnectionStatus | null>(null);

  const addSystemLog = useCallback((message: string) => {
    const sysPacket: Packet = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      direction: 'system',
      bytes: [],
      hex: '',
      ascii: message,
      length: 0,
      timestamp: Date.now(),
      source: 'system'
    };
    setPackets((prev) => {
      const updated = [...prev, sysPacket];
      if (maxBufferPackets > 0 && updated.length > maxBufferPackets) {
        return updated.slice(updated.length - maxBufferPackets);
      }
      return updated;
    });
  }, [maxBufferPackets]);

  const addSystemLogRef = useRef(addSystemLog);
  useEffect(() => {
    addSystemLogRef.current = addSystemLog;
  }, [addSystemLog]);

  // --- WebSocket Connection ---
  const connectWebSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const port = CANDIDATE_PORTS[portIndexRef.current % CANDIDATE_PORTS.length];
    try {
      const ws = new WebSocket(`ws://localhost:${port}`);
      wsRef.current = ws;
      let didOpen = false;

      ws.onopen = () => {
        didOpen = true;
        console.log(`Connected to COM Analyzer backend on port ${port}`);
        ws.send(JSON.stringify({ action: 'LIST_PORTS' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'STATUS_UPDATE': {
              const newStatus: ConnectionStatus = msg.status;
              const prev = prevStatusRef.current;
              if (prev && prev.connected && !newStatus.connected) {
                if (prev.type === 'tcp-server') {
                  addSystemLogRef.current(`TCP 서버 연결이 종료되었습니다. (PORT: ${prev.port || 121})`);
                } else if (prev.type === 'tcp-client') {
                  addSystemLogRef.current('TCP 클라이언트 연결이 종료되었습니다.');
                } else if (prev.type === 'serial') {
                  addSystemLogRef.current('시리얼 포트 연결이 종료되었습니다.');
                } else if (prev.type === 'virtual') {
                  addSystemLogRef.current('가상 시뮬레이터가 종료되었습니다.');
                } else {
                  addSystemLogRef.current('통신 연결이 정상적으로 종료되었습니다.');
                }
              }
              prevStatusRef.current = newStatus;
              setStatus(newStatus);
              break;
            }

            case 'PORT_LIST':
              setPorts(msg.ports || []);
              break;

            case 'DATA_PACKET': {
              if (isFrozen) return;

              const { direction, bytes: newBytes, hex, ascii, length, timestamp, source } = msg;

              // Update counters & throttled blinker
              if (direction === 'rx') {
                setRxCount((prev) => prev + length);
                setRxBlinking(true);
                clearTimeout(rxBlinkTimer.current);
                rxBlinkTimer.current = setTimeout(() => setRxBlinking(false), 70);
              } else {
                setTxCount((prev) => prev + length);
                setTxBlinking(true);
                clearTimeout(txBlinkTimer.current);
                txBlinkTimer.current = setTimeout(() => setTxBlinking(false), 70);
              }

              // Create packet object
              const newPacket: Packet = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                direction,
                bytes: newBytes,
                hex,
                ascii,
                length,
                timestamp,
                source
              };

              if (direction === 'rx') {
                setLastRxPacket(newPacket);
              }

              // Append to full packet log with FIFO limit
              setPackets((prev) => {
                const limit = maxBufferPacketsRef.current;
                const next = [...prev, newPacket];
                if (limit > 0 && next.length > limit) {
                  return next.slice(next.length - limit);
                }
                return next;
              });
              break;
            }

            case 'UPDATE_CHECK_RESULT': {
              setUpdateInfo(msg);
              setUpdateStatus('idle');
              if (msg.hasUpdate) {
                setIsUpdateModalOpen(true);
              }
              break;
            }

            case 'UPDATE_CHECK_ERROR': {
              setUpdateStatus('error');
              setUpdateStatusMessage(msg.message || '업데이트 확인 실패');
              break;
            }

            case 'UPDATE_STATUS': {
              setUpdateStatus(msg.status);
              setUpdateStatusMessage(msg.message || '');
              break;
            }

            case 'UPDATE_PROGRESS': {
              setDownloadProgress({
                percent: msg.percent || 0,
                downloaded: msg.downloaded || 0,
                total: msg.total || 0
              });
              break;
            }

            case 'UPDATE_ERROR': {
              setUpdateStatus('error');
              setUpdateStatusMessage(msg.message || '업데이트 진행 중 오류 발생');
              break;
            }

            case 'ERROR':
              alert(msg.message);
              break;
          }
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!didOpen) {
          portIndexRef.current = (portIndexRef.current + 1) % CANDIDATE_PORTS.length;
          reconnectTimerRef.current = setTimeout(connectWebSocket, 150);
        } else {
          console.log('Backend connection closed, retrying in 2s...');
          reconnectTimerRef.current = setTimeout(connectWebSocket, 2000);
        }
      };

      ws.onerror = () => {};
    } catch (err) {
      console.error(`Failed to init WS on port ${port}:`, err);
      portIndexRef.current = (portIndexRef.current + 1) % CANDIDATE_PORTS.length;
      reconnectTimerRef.current = setTimeout(connectWebSocket, 200);
    }
  }, [isFrozen]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Keyboard shortcuts & System Menu events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+N or Ctrl+N opens a new window
      if ((e.metaKey || e.ctrlKey) && (e.key === 'n' || e.code === 'KeyN')) {
        e.preventDefault();
        window.open(window.location.href, '_blank', 'width=1200,height=800');
        return;
      }

      // Cmd+, or Ctrl+, opens Settings
      if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        setSettingsTab('tcp');
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // Cmd+K or Ctrl+K clears screen buffer
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.code === 'KeyK')) {
        e.preventDefault();
        setPackets([]);
        setRxCount(0);
        setTxCount(0);
        return;
      }

      // Space to toggle freeze (when not in an input)
      if (e.code === 'Space' && (e.target === document.body || (e.target as HTMLElement).tagName !== 'INPUT')) {
        e.preventDefault();
        setIsFrozen((prev) => !prev);
      }
    };

    const handleOpenSettingsEvent = () => {
      setSettingsTab('tcp');
      setIsSettingsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('OPEN_SETTINGS', handleOpenSettingsEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('OPEN_SETTINGS', handleOpenSettingsEvent);
    };
  }, []);

  // --- Actions ---
  const handleSend = (raw: string, format: 'hex' | 'ascii') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('백엔드 서비스와 연결되지 않았습니다. 서버 상태를 확인해주세요.');
      return;
    }
    wsRef.current.send(
      JSON.stringify({
        action: 'SEND_DATA',
        raw,
        format
      })
    );
  };

  const handleConnectSerial = (config: SerialConfig) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'OPEN_SERIAL', config }));
    }
  };

  const handleStartTcpServer = (port: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'START_TCP_SERVER', port }));
    }
  };

  const handleConnectTcpClient = (host: string, port: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'CONNECT_TCP_CLIENT', host, port }));
    }
  };

  const handleStartVirtual = (mode: 'echo' | 'modbus' | 'stream') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'START_VIRTUAL', mode }));
    }
  };

  const handleDisconnect = () => {
    if (status.connected) {
      if (status.type === 'tcp-server') {
        addSystemLog(`TCP 서버 연결이 종료되었습니다. (PORT: ${status.port || 121})`);
      } else if (status.type === 'tcp-client') {
        addSystemLog('TCP 클라이언트 연결이 종료되었습니다.');
      } else if (status.type === 'serial') {
        addSystemLog('시리얼 포트 연결이 종료되었습니다.');
      } else if (status.type === 'virtual') {
        addSystemLog('가상 시뮬레이터가 종료되었습니다.');
      } else {
        addSystemLog('통신 연결이 정상적으로 종료되었습니다.');
      }
    }
    prevStatusRef.current = { connected: false, type: null, info: '연결되지 않음' };
    setStatus({ connected: false, type: null, info: '연결되지 않음' });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'DISCONNECT' }));
    }
  };

  const handleRefreshPorts = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'LIST_PORTS' }));
    }
  };

  const handleClearScreen = () => {
    setPackets([]);
    setRxCount(0);
    setTxCount(0);
  };

  const handleSaveLog = () => {
    if (packets.length === 0) {
      alert('저장할 패킷 데이터가 없습니다.');
      return;
    }
    let content = `COM ANALYZER PACKET LOG (${new Date().toLocaleString()})\n`;
    content += `========================================================\n\n`;
    packets.forEach((p, idx) => {
      const time = new Date(p.timestamp).toISOString().split('T')[1].slice(0, 12);
      if (p.direction === 'system') {
        content += `[#${idx + 1}] [${time}] [SYSTEM] ${p.ascii}\n\n`;
      } else {
        content += `[#${idx + 1}] [${time}] [${p.direction.toUpperCase()}] (${p.length}B) HEX: ${p.hex}\n`;
        content += `    ASCII: ${p.ascii}\n\n`;
      }
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `com_analyzer_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (packets.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }
    let csv = 'Index,Timestamp,Direction,Length,Hex,ASCII\n';
    packets.forEach((p, idx) => {
      csv += `${idx + 1},${p.timestamp},${p.direction},${p.length},"${p.hex}","${p.ascii.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packets_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenLog = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const cleanHex = text.replace(/[^0-9a-fA-F]/g, '');
        if (cleanHex.length >= 2) {
          const byteArr: number[] = [];
          for (let i = 0; i < cleanHex.length; i += 2) {
            byteArr.push(parseInt(cleanHex.substr(i, 2), 16));
          }
          const loadedPkt: Packet = {
            id: `loaded-${Date.now()}`,
            direction: 'rx',
            bytes: byteArr,
            hex: cleanHex,
            ascii: byteArr.map(b => b >= 32 && b <= 126 ? String.fromCharCode(b) : '.').join(''),
            length: byteArr.length,
            timestamp: Date.now()
          };
          setPackets([loadedPkt]);
          setRxCount(byteArr.length);
          alert(`${byteArr.length} 바이트 데이터를 로드했습니다.`);
        } else {
          alert('유효한 16진수 데이터를 찾을 수 없습니다.');
        }
      } catch (err) {
        alert('파일을 읽는 도중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCheckForUpdates = useCallback((manual = false) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setUpdateStatus('checking');
      if (manual) setIsUpdateModalOpen(true);
      wsRef.current.send(JSON.stringify({ action: 'CHECK_FOR_UPDATES' }));
    }
  }, []);

  const handleStartUpdate = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && updateInfo?.assetUrl) {
      setUpdateStatus('downloading');
      setDownloadProgress({ percent: 0, downloaded: 0, total: 0 });
      wsRef.current.send(JSON.stringify({ action: 'START_UPDATE', assetUrl: updateInfo.assetUrl }));
    }
  };

  // Background update check 3 seconds after startup
  useEffect(() => {
    const timer = setTimeout(() => {
      handleCheckForUpdates(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [handleCheckForUpdates]);

  const handleThemeColorChange = (key: 'rxColor' | 'txColor' | 'textColor', color: string) => {
    setTheme((prev) => ({ ...prev, [key]: color }));
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden select-none ${
        theme.name === 'classic-retro'
          ? 'bg-[#ece9d8] text-black font-sans'
          : theme.name === 'modern-dark'
          ? 'bg-[#090a0f] text-zinc-100'
          : 'bg-zinc-100 text-zinc-900'
      }`}
    >
      {/* Hidden File Input for Open */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.hex,.bin,.csv,.log"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* 1. Title Bar */}
      <TitleBar
        status={status}
        theme={theme}
        onThemeChange={(name) =>
          setTheme((prev) => ({
            ...prev,
            name,
            rxColor: name === 'classic-retro' ? '#FF9900' : '#f59e0b',
            txColor: name === 'classic-retro' ? '#008080' : '#06b6d4',
            textColor: name === 'classic-retro' ? '#000000' : '#000000'
          }))
        }
        onOpenSettings={() => {
          setSettingsTab('tcp');
          setIsSettingsOpen(true);
        }}
        onNewWindow={() => window.open(window.location.href, '_blank', 'width=1200,height=800')}
        rxCount={rxCount}
        txCount={txCount}
        rxBlinking={rxBlinking}
        txBlinking={txBlinking}
        appVersion={`v${APP_VERSION}`}
      />

      {/* 2. Menu Bar */}
      <MenuBar
        theme={theme}
        onNewWindow={() => window.open(window.location.href, '_blank', 'width=1200,height=800')}
        onOpenSettings={(tab) => {
          setSettingsTab(tab || 'tcp');
          setIsSettingsOpen(true);
        }}
        onDisconnect={handleDisconnect}
        onClearScreen={handleClearScreen}
        onSaveLog={handleSaveLog}
        onOpenLog={handleOpenLog}
        onExportCsv={handleExportCsv}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
        isFrozen={isFrozen}
        onToggleFreeze={() => setIsFrozen(!isFrozen)}
        onOpenProtocolHelp={() => setIsHelpOpen(true)}
        onCheckUpdate={() => handleCheckForUpdates(true)}
      />

      {/* 3. Main Center: Packet Grid Viewer + Right Control Sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <PacketGrid
          packets={packets}
          rxDisplayMode={rxMode}
          txDisplayMode={txMode}
          theme={theme}
          autoScroll={autoScroll}
        />

        <ControlSidebar
          totalBytesCount={rxCount + txCount}
          packetCount={packets.length}
          maxBufferPackets={maxBufferPackets}
          onMaxBufferChange={setMaxBufferPackets}
          onClear={handleClearScreen}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
          dlgState={dlgState}
          onDlgStateChange={setDlgState}
          rxMode={rxMode}
          onRxModeChange={setRxMode}
          txMode={txMode}
          onTxModeChange={setTxMode}
          theme={theme}
          onPrint={handlePrint}
          onSave={handleSaveLog}
          onOpen={handleOpenLog}
          status={status}
          onStartTcpServer={handleStartTcpServer}
          onConnectTcpClient={handleConnectTcpClient}
          onDisconnect={handleDisconnect}
        />
      </div>

      {/* 4. Bottom Send Panel */}
      <SendPanel
        theme={theme}
        onSend={handleSend}
        onInsertData={insertedData}
        lastRxPacket={lastRxPacket}
      />

      {/* 5. Bottom 4-Column Utility Panel */}
      <UtilityPanel
        theme={theme}
        onApplyToSend={(val) => setInsertedData(val)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={(name) =>
          setTheme((prev) => ({
            ...prev,
            name,
            rxColor: name === 'classic-retro' ? '#FF9900' : '#f59e0b',
            txColor: name === 'classic-retro' ? '#008080' : '#06b6d4',
            textColor: name === 'classic-retro' ? '#000000' : '#000000'
          }))
        }
        onThemeColorChange={handleThemeColorChange}
        ports={ports}
        onRefreshPorts={handleRefreshPorts}
        status={status}
        initialTab={settingsTab}
        onConnectSerial={handleConnectSerial}
        onStartTcpServer={handleStartTcpServer}
        onConnectTcpClient={handleConnectTcpClient}
        onStartVirtualDevice={handleStartVirtual}
        onDisconnect={handleDisconnect}
        maxBufferPackets={maxBufferPackets}
        onMaxBufferChange={setMaxBufferPackets}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        theme={theme}
      />

      {/* Update Modal */}
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        theme={theme}
        updateInfo={updateInfo}
        updateStatus={updateStatus}
        downloadProgress={downloadProgress}
        statusMessage={updateStatusMessage}
        onStartUpdate={handleStartUpdate}
        onCheckForUpdates={() => handleCheckForUpdates(true)}
      />
    </div>
  );
};
export default App;
