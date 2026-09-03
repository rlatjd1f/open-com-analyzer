import React, { useState, useRef, useEffect } from 'react';
import type { Packet, AppTheme } from '../types';

interface PacketGridProps {
  packets: Packet[];
  rxDisplayMode: 'ascii' | 'binary';
  txDisplayMode: 'ascii' | 'binary';
  theme: AppTheme;
  autoScroll: boolean;
}

export const PacketGrid: React.FC<PacketGridProps> = ({
  packets,
  rxDisplayMode,
  txDisplayMode,
  theme,
  autoScroll
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredByte, setHoveredByte] = useState<{
    byte: number;
    idx: number;
    direction: 'rx' | 'tx';
    timestamp: number;
  } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Format timestamp to HH:mm:ss.SSS
  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const sss = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${sss}`;
  };

  // Auto scroll down to bottom when new packets arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [packets.length, autoScroll]);

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden w-full">
      {/* Scrollable Packet Stream Container */}
      <div
        ref={containerRef}
        className={`flex-1 p-2 overflow-y-auto w-full h-full flex flex-col gap-1.5 ${
          isRetro
            ? 'bg-[#5b6e99] border-2 border-[#808080]'
            : theme.name === 'modern-dark'
            ? 'bg-[#0f1117] border border-zinc-800/80'
            : 'bg-[#f1f5f9] border border-zinc-200'
        }`}
      >
        {packets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 py-12 select-none">
            <span className="font-mono text-sm font-semibold mb-1">
              데이터 송수신 대기중...
            </span>
            <span className="text-xs opacity-75">
              송신 데이터를 전송하거나 통신 포트를 연결하면 실시간 패킷이 시간과 함께 표시됩니다.
            </span>
          </div>
        ) : (
          packets.map((pkt, pktIdx) => {
            const isRx = pkt.direction === 'rx';
            const displayMode = isRx ? rxDisplayMode : txDisplayMode;
            const bgColor = isRx ? theme.rxColor : theme.txColor;

            return (
              <div
                key={pkt.id || pktIdx}
                className={`flex items-start gap-2 p-1.5 rounded transition-all ${
                  isRetro
                    ? 'bg-[#435388]/60 border border-[#6b7fa9]/50 shadow-sm'
                    : isDark
                    ? 'bg-zinc-900/60 border border-zinc-800/80 shadow-sm hover:bg-zinc-900/90'
                    : 'bg-white/80 border border-zinc-200/80 shadow-sm hover:bg-white'
                }`}
              >
                {/* 1. Left Fixed-Width Column: Timestamp [HH:mm:ss.SSS] + RX/TX + Length */}
                <div className="w-[215px] min-w-[215px] max-w-[215px] shrink-0 flex items-center justify-between pt-0.5 select-none pr-2 border-r border-white/20 dark:border-zinc-700/60">
                  {/* Timestamp HH:mm:ss.SSS */}
                  <span
                    className={`font-mono text-[12px] font-bold px-1.5 py-0.5 rounded text-center tracking-tight ${
                      isRetro
                        ? 'bg-black/40 text-white border border-white/20'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        : 'bg-zinc-100 text-zinc-800 border border-zinc-300'
                    }`}
                  >
                    {formatTimestamp(pkt.timestamp)}
                  </span>

                  {/* RX / TX Badge */}
                  <span
                    style={{ backgroundColor: bgColor }}
                    className="w-7 text-center font-extrabold text-[11px] text-black py-0.5 rounded uppercase shadow-sm"
                  >
                    {isRx ? 'RX' : 'TX'}
                  </span>

                  {/* High-Contrast Byte Count Badge */}
                  <span
                    className={`min-w-[44px] px-1.5 py-0.5 rounded font-mono text-[11px] font-bold text-center tracking-tight shadow-sm ${
                      isRetro
                        ? 'bg-[#15213b] text-[#55f2ff] border border-[#6d8bc9]'
                        : isDark
                        ? 'bg-zinc-950 text-amber-400 border border-zinc-700'
                        : 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    }`}
                  >
                    {pkt.length} B
                  </span>
                </div>

                {/* 2. Right Column: Perfectly Aligned Square Byte Cells */}
                <div className="flex-1 flex flex-wrap items-center gap-[3px] min-w-0">
                  {pkt.bytes.map((b, byteIdx) => {
                    let text = '';
                    if (displayMode === 'ascii') {
                      text = b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
                    } else {
                      text = b.toString(16).toUpperCase().padStart(2, '0');
                    }

                    return (
                      <div
                        key={byteIdx}
                        onMouseEnter={(e) => {
                          setHoveredByte({
                            byte: b,
                            idx: byteIdx + 1,
                            direction: pkt.direction,
                            timestamp: pkt.timestamp
                          });
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverPos({ x: rect.left, y: rect.bottom + 4 });
                        }}
                        onMouseLeave={() => setHoveredByte(null)}
                        style={{
                          backgroundColor: bgColor,
                          color: theme.textColor
                        }}
                        className={`w-7 h-7 aspect-square rounded-[2px] flex items-center justify-center font-mono font-bold text-[13px] tracking-tight leading-none shadow-sm cursor-pointer select-none transition-transform hover:scale-110 hover:z-10 hover:ring-2 hover:ring-white/90 ${
                          isRetro ? 'border border-black/20' : 'border border-black/10'
                        }`}
                      >
                        {text}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hover Inspector Tooltip */}
      {hoveredByte && hoverPos && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded bg-zinc-900/95 text-white border border-zinc-700 shadow-2xl text-[11px] font-mono flex items-center gap-3 backdrop-blur-md"
          style={{
            left: Math.min(window.innerWidth - 240, Math.max(10, hoverPos.x - 40)),
            top: hoverPos.y
          }}
        >
          <span
            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
              hoveredByte.direction === 'rx' ? 'bg-amber-500 text-black' : 'bg-cyan-500 text-black'
            }`}
          >
            {hoveredByte.direction.toUpperCase()}
          </span>
          <div>
            <span className="text-zinc-400">HEX: </span>
            <span className="text-amber-300 font-bold">
              0x{hoveredByte.byte.toString(16).toUpperCase().padStart(2, '0')}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">DEC: </span>
            <span>{hoveredByte.byte}</span>
          </div>
          <div>
            <span className="text-zinc-400">ASCII: </span>
            <span className="text-emerald-300">
              {hoveredByte.byte >= 32 && hoveredByte.byte <= 126
                ? String.fromCharCode(hoveredByte.byte)
                : '.'}
            </span>
          </div>
          <div>
            <span className="text-zinc-400">OFFSET: </span>
            <span className="text-zinc-300">#{hoveredByte.idx}</span>
          </div>
        </div>
      )}
    </div>
  );
};
