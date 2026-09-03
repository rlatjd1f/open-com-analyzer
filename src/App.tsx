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

  // Buffer Limit State (Default: 1,000 packets)
  const [maxBufferPackets, setMaxBufferPackets] = useState(1000);
  const maxBufferPacketsRef = useRef(maxBufferPackets);
  useEffect(() => {
    maxBufferPacketsRef.current = maxBufferPackets;
  }, [maxBufferPackets]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'serial' | 'tcp' | 'virtual' | 'buffer'>('serial');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [insertedData, setInsertedData] = useState('');

  // Auto-Update States
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'completed' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, downloaded: 0, total: 0 });
  const [updateStatusMessage, setUpdateStatusMessage] = useState('');

  // Theme
  const [theme, setTheme] = useState<AppTheme>({
    name: 'classic-retro', // Default to matching screenshot's authentic analyzer aesthetic
    rxColor: '#FF9900',
    txColor: '#008080',
    textColor: '#000000'
  });

  const wsRef = useRef<WebSocket | null>(null);
  const rxBlinkTimer = useRef<any>(null);
  const txBlinkTimer = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- WebSocket Connection ---
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket('ws://localhost:4001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to COM Analyzer backend');
        ws.send(JSON.stringify({ action: 'LIST_PORTS' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'STATUS_UPDATE':
              setStatus(msg.status);
              break;

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
        console.log('Backend connection closed, retrying in 2s...');
        setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = (err) => {
        console.warn('Backend WS error:', err);
      };
    } catch (err) {
      console.error('Failed to init WS:', err);
    }
  }, [isFrozen]);

  useEffect(() => {
    connectWebSocket();
    return () => {
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
        setSettingsTab('serial');
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
      setSettingsTab('serial');
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
      content += `[#${idx + 1}] [${time}] [${p.direction.toUpperCase()}] (${p.length}B) HEX: ${p.hex}\n`;
      content += `    ASCII: ${p.ascii}\n\n`;
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
          setSettingsTab('serial');
          setIsSettingsOpen(true);
        }}
        onNewWindow={() => window.open(window.location.href, '_blank', 'width=1200,height=800')}
        rxCount={rxCount}
        txCount={txCount}
        appVersion={`v${APP_VERSION}`}
      />

      {/* 2. Menu Bar */}
      <MenuBar
        theme={theme}
        onNewWindow={() => window.open(window.location.href, '_blank', 'width=1200,height=800')}
        onOpenSettings={(tab) => {
          setSettingsTab(tab || 'serial');
          setIsSettingsOpen(true);
        }}
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
          onThemeColorChange={handleThemeColorChange}
          onPrint={handlePrint}
          onSave={handleSaveLog}
          onOpen={handleOpenLog}
          status={status}
          rxBlinking={rxBlinking}
          txBlinking={txBlinking}
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
