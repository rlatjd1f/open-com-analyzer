import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { AppTheme, Packet } from '../types';
import { Send, Play, Square, Zap, Star, Clock, Trash2, Plus, ChevronDown, Edit3, Wrench } from 'lucide-react';
import { PacketBuilderModal } from './PacketBuilderModal';

interface FavoritePacket {
  id: string;
  label?: string;
  data: string;
  format: 'hex' | 'ascii';
  isFavorite: boolean;
  timestamp: number;
}

const DEFAULT_PRESETS: FavoritePacket[] = [
  {
    id: 'preset-modbus-read',
    label: 'Modbus RTU 읽기 (01 03)',
    data: '01 03 00 00 00 0A C5 CD',
    format: 'hex',
    isFavorite: true,
    timestamp: 1
  },
  {
    id: 'preset-modbus-write',
    label: 'Modbus RTU 쓰기 (01 06)',
    data: '01 06 00 01 00 01 19 CA',
    format: 'hex',
    isFavorite: true,
    timestamp: 2
  },
  {
    id: 'preset-ping',
    label: 'Ping 통신 테스트 (ASCII)',
    data: 'PING',
    format: 'ascii',
    isFavorite: true,
    timestamp: 3
  }
];

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

  // Frequent Packets Dropdown State
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState('');
  const [packetList, setPacketList] = useState<FavoritePacket[]>(() => {
    try {
      const saved = localStorage.getItem('com_analyzer_frequent_packets');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return DEFAULT_PRESETS;
  });

  const favoritesRef = useRef<HTMLDivElement>(null);
  
  // Save frequent packets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('com_analyzer_frequent_packets', JSON.stringify(packetList));
    } catch (e) {}
  }, [packetList]);

  // Close dropdown on outside click or ESC
  useEffect(() => {
    if (!isFavoritesOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (favoritesRef.current && !favoritesRef.current.contains(e.target as Node)) {
        setIsFavoritesOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFavoritesOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFavoritesOpen]);

  // Packet Builder Modal State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

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

  // Add packet to history
  const recordSentPacket = (sendData: string, sendFormat: 'hex' | 'ascii') => {
    const trimmed = sendData.trim();
    if (!trimmed) return;

    setPacketList((prev) => {
      // Find existing
      const existingIdx = prev.findIndex(p => p.data === trimmed && p.format === sendFormat);
      if (existingIdx >= 0) {
        // Update timestamp & keep favorite flag
        const existing = prev[existingIdx];
        const updated = { ...existing, timestamp: Date.now() };
        const next = [...prev];
        next.splice(existingIdx, 1);
        return [updated, ...next];
      } else {
        // Add new recent item
        const newItem: FavoritePacket = {
          id: `pkt-${Date.now()}`,
          data: trimmed,
          format: sendFormat,
          isFavorite: false,
          timestamp: Date.now()
        };
        // Keep favorites + up to 20 recents
        const favorites = prev.filter(p => p.isFavorite);
        const recents = prev.filter(p => !p.isFavorite).slice(0, 19);
        return [newItem, ...favorites, ...recents];
      }
    });
  };

  const handleSend = () => {
    if (!data.trim()) return;
    onSend(data, format);
    recordSentPacket(data, format);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleApplyPacket = (pkt: FavoritePacket) => {
    setData(pkt.data);
    setFormat(pkt.format);
    setIsFavoritesOpen(false);
  };

  const handleSendSpecificPacket = (pkt: FavoritePacket) => {
    setData(pkt.data);
    setFormat(pkt.format);
    onSend(pkt.data, pkt.format);
    recordSentPacket(pkt.data, pkt.format);
    setIsFavoritesOpen(false);
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPacketList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))
    );
  };

  const handleDeletePacket = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPacketList((prev) => prev.filter((p) => p.id !== id));
  };

  const handleStartEditAlias = (pkt: FavoritePacket, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAliasId(pkt.id);
    setEditingAliasValue(pkt.label || '');
  };

  const handleSaveAlias = (id: string) => {
    const trimmed = editingAliasValue.trim();
    setPacketList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, label: trimmed || undefined } : p))
    );
    setEditingAliasId(null);
  };

  const handleAddCurrentAsFavorite = () => {
    const trimmed = data.trim();
    if (!trimmed) {
      alert('먼저 입력창에 보낼 패킷 데이터를 입력해주세요.');
      return;
    }
    const newItemId = `fav-${Date.now()}`;
    const newItem: FavoritePacket = {
      id: newItemId,
      label: undefined,
      data: trimmed,
      format,
      isFavorite: true,
      timestamp: Date.now()
    };
    // Prepend to list, removing duplicate data
    setPacketList((prev) => [newItem, ...prev.filter((p) => p.data !== trimmed)]);
    // Automatically open inline alias editor for this new item
    setEditingAliasId(newItemId);
    setEditingAliasValue('');
  };

  // 1. Auto repeat timer
  useEffect(() => {
    if (autoRepeat) {
      setRxTriggerEnabled(false);
      lastProcessedRxId.current = null;
      timerRef.current = setInterval(() => {
        if (dataRef.current.trim()) {
          onSendRef.current(dataRef.current, formatRef.current);
          recordSentPacket(dataRef.current, formatRef.current);
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

    if (lastRxPacket.id === lastProcessedRxId.current) return;
    lastProcessedRxId.current = lastRxPacket.id;

    const toSend = dataRef.current;
    const fmt = formatRef.current;
    const delay = rxTriggerDelayRef.current;

    if (delay > 0) {
      const dTimer = setTimeout(() => {
        onSendRef.current(toSend, fmt);
        recordSentPacket(toSend, fmt);
      }, delay);
      return () => clearTimeout(dTimer);
    } else {
      onSendRef.current(toSend, fmt);
      recordSentPacket(toSend, fmt);
    }
  }, [lastRxPacket, rxTriggerEnabled]);

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  const favoritePackets = useMemo(() => packetList.filter(p => p.isFavorite), [packetList]);
  const recentPackets = useMemo(() => packetList.filter(p => !p.isFavorite), [packetList]);

  return (
    <div
      className={`px-3 py-1.5 flex items-center gap-2 border-t text-xs select-none relative ${
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

      {/* "자주 사용하는 데이터" Dropdown Trigger Button */}
      <div className="relative shrink-0" ref={favoritesRef}>
        <button
          type="button"
          onClick={() => setIsFavoritesOpen(!isFavoritesOpen)}
          className={`px-2.5 py-1 rounded font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm ${
            isFavoritesOpen
              ? isRetro
                ? 'bg-[#000080] text-white font-bold'
                : 'bg-indigo-600 text-white'
              : isRetro
              ? 'border-2 border-outset border-[#ffffff] bg-[#d4d0c8] text-black active:border-inset hover:bg-zinc-200'
              : isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700'
              : 'bg-white hover:bg-zinc-100 text-amber-600 border border-zinc-300'
          }`}
          title="자주 사용하는 패킷 프리셋 및 최근 전송 기록"
        >
          <Star size={13} className={isFavoritesOpen ? 'fill-current' : 'text-amber-500 fill-amber-500'} />
          <span>자주 쓰는 데이터</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${isFavoritesOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Popover */}
        {isFavoritesOpen && (
          <div
            className={`absolute bottom-full left-0 mb-2 w-96 rounded-xl shadow-2xl border overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              isRetro
                ? 'bg-[#ece9d8] text-black border-[#808080] font-sans'
                : isDark
                ? 'bg-zinc-900 text-zinc-100 border-zinc-700/80 shadow-indigo-950/50'
                : 'bg-white text-zinc-800 border-zinc-200 shadow-zinc-300/60'
            }`}
          >
            {/* Popover Header */}
            <div
              className={`px-3.5 py-2.5 flex items-center justify-between border-b shrink-0 ${
                isRetro
                  ? 'bg-[#0a246a] text-white font-bold'
                  : isDark
                  ? 'bg-zinc-800/90 border-zinc-700/80'
                  : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                <span>자주 사용하는 패킷 & 최근 기록</span>
              </div>
              <button
                type="button"
                onClick={handleAddCurrentAsFavorite}
                className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 font-semibold transition-all ${
                  isRetro
                    ? 'bg-white text-black hover:bg-zinc-200'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
                title="현재 입력창의 데이터를 즐겨찾기에 등록합니다"
              >
                <Plus size={11} /> 현재값 즐겨찾기 추가
              </button>
            </div>

            {/* List Body */}
            <div className="max-h-72 overflow-y-auto p-2 flex flex-col gap-2.5 text-xs">
              {/* 1. Favorites Section */}
              {favoritePackets.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 px-1.5 py-0.5 flex items-center gap-1">
                    <Star size={11} className="fill-amber-500" /> 즐겨찾기 / 프리셋 ({favoritePackets.length})
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {favoritePackets.map((pkt) => (
                      <div
                        key={pkt.id}
                        onClick={() => handleApplyPacket(pkt)}
                        className={`p-2 rounded-lg border group cursor-pointer flex items-center justify-between gap-2 transition-all ${
                          isRetro
                            ? 'bg-white border-[#808080] hover:bg-blue-50'
                            : isDark
                            ? 'bg-zinc-800/60 border-zinc-700/70 hover:bg-zinc-800 hover:border-indigo-500/60'
                            : 'bg-zinc-50 border-zinc-200 hover:bg-indigo-50/50 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {editingAliasId === pkt.id ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                autoFocus
                                value={editingAliasValue}
                                onChange={(e) => setEditingAliasValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAlias(pkt.id);
                                  if (e.key === 'Escape') setEditingAliasId(null);
                                }}
                                placeholder="별칭/설명 입력 (예: 밸브 열기)..."
                                className={`w-full px-2 py-0.5 text-xs rounded border outline-none font-sans ${
                                  isRetro
                                    ? 'bg-white text-black border-[#808080]'
                                    : 'bg-zinc-900 text-white border-zinc-600'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAlias(pkt.id)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-600 text-white shrink-0 hover:bg-indigo-500"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAliasId(null)}
                                className="px-1.5 py-0.5 text-[10px] rounded hover:bg-zinc-500/20 shrink-0"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <>
                              {pkt.label ? (
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="font-semibold text-xs text-indigo-400 truncate">
                                    {pkt.label}
                                  </span>
                                </div>
                              ) : null}
                              <div className="font-mono text-xs truncate opacity-90">
                                {pkt.data}
                              </div>
                            </>
                          )}
                        </div>

                        {editingAliasId !== pkt.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                              pkt.format === 'hex'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {pkt.format}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleStartEditAlias(pkt, e)}
                              className="p-1 rounded hover:bg-zinc-500/20 text-zinc-400 hover:text-indigo-400 transition-colors"
                              title="별칭(이름) 수정"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(pkt.id, e)}
                              className="p-1 rounded text-amber-400 hover:scale-110 transition-transform"
                              title="즐겨찾기 해제"
                            >
                              <Star size={13} className="fill-amber-400" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendSpecificPacket(pkt);
                              }}
                              className="p-1 rounded hover:bg-indigo-600 hover:text-white transition-colors text-zinc-400"
                              title="즉시 전송"
                            >
                              <Send size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePacket(pkt.id, e)}
                              className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="즐겨찾기 삭제"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Recent Packets Section */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 px-1.5 py-0.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> 최근 전송 내역 ({recentPackets.length})
                  </span>
                  {recentPackets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPacketList(prev => prev.filter(p => p.isFavorite))}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      최근기록 비우기
                    </button>
                  )}
                </div>

                {recentPackets.length === 0 ? (
                  <div className="p-4 text-center text-xs opacity-50 font-sans">
                    최근 전송한 데이터가 없습니다.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 mt-1">
                    {recentPackets.map((pkt) => (
                      <div
                        key={pkt.id}
                        onClick={() => handleApplyPacket(pkt)}
                        className={`p-2 rounded-lg border group cursor-pointer flex items-center justify-between gap-2 transition-all ${
                          isRetro
                            ? 'bg-white border-[#808080] hover:bg-blue-50'
                            : isDark
                            ? 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                            : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {editingAliasId === pkt.id ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                autoFocus
                                value={editingAliasValue}
                                onChange={(e) => setEditingAliasValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveAlias(pkt.id);
                                  if (e.key === 'Escape') setEditingAliasId(null);
                                }}
                                placeholder="별칭/설명 입력 (예: 센서 요청)..."
                                className={`w-full px-2 py-0.5 text-xs rounded border outline-none font-sans ${
                                  isRetro
                                    ? 'bg-white text-black border-[#808080]'
                                    : 'bg-zinc-900 text-white border-zinc-600'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAlias(pkt.id)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-600 text-white shrink-0 hover:bg-indigo-500"
                              >
                                저장
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAliasId(null)}
                                className="px-1.5 py-0.5 text-[10px] rounded hover:bg-zinc-500/20 shrink-0"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <>
                              {pkt.label ? (
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="font-semibold text-xs text-indigo-400 truncate">
                                    {pkt.label}
                                  </span>
                                </div>
                              ) : null}
                              <div className="font-mono text-xs truncate opacity-90">
                                {pkt.data}
                              </div>
                            </>
                          )}
                        </div>

                        {editingAliasId !== pkt.id && (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                              pkt.format === 'hex'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {pkt.format}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleStartEditAlias(pkt, e)}
                              className="p-1 rounded hover:bg-zinc-500/20 text-zinc-500 hover:text-indigo-400 transition-colors"
                              title="별칭(이름) 추가/수정"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(pkt.id, e)}
                              className="p-1 rounded text-zinc-500 hover:text-amber-400 transition-colors"
                              title="즐겨찾기에 등록"
                            >
                              <Star size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePacket(pkt.id, e)}
                              className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer helper */}
            <div
              className={`px-3 py-1.5 text-[10px] opacity-60 border-t flex items-center justify-between ${
                isRetro ? 'bg-[#d4d0c8] border-[#808080]' : isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
              }`}
            >
              <span>클릭 시 입력창에 적용됩니다</span>
              <span>ESC 키로 닫기</span>
            </div>
          </div>
        )}
      </div>

      {/* "패킷 생성기" Modal Trigger Button */}
      <button
        type="button"
        onClick={() => setIsBuilderOpen(true)}
        className={`px-2.5 py-1 rounded font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 ${
          isRetro
            ? 'border-2 border-outset border-[#ffffff] bg-[#d4d0c8] text-black active:border-inset hover:bg-zinc-200'
            : isDark
            ? 'bg-zinc-800 hover:bg-zinc-700 text-indigo-400 border border-zinc-700'
            : 'bg-white hover:bg-zinc-100 text-indigo-600 border border-zinc-300'
        }`}
        title="Modbus 및 표준 프레임 패킷 생성 마법사 & 공학용 진수 변환기"
      >
        <Wrench size={13} className="text-amber-500" />
        <span>패킷 생성기</span>
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

      {/* Packet Builder & Multi-Radix Calculator Modal */}
      <PacketBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        theme={theme}
        onApplyToSend={(dataStr, fmt) => {
          setData(dataStr);
          setFormat(fmt);
        }}
        onDirectSend={(dataStr, fmt) => {
          setData(dataStr);
          setFormat(fmt);
          onSend(dataStr, fmt);
          recordSentPacket(dataStr, fmt);
        }}
        onAddToFavorites={(dataStr, fmt, label) => {
          const newItem: FavoritePacket = {
            id: `fav-${Date.now()}`,
            label,
            data: dataStr,
            format: fmt,
            isFavorite: true,
            timestamp: Date.now()
          };
          setPacketList((prev) => [newItem, ...prev.filter((p) => p.data !== dataStr)]);
        }}
      />
    </div>
  );
};
