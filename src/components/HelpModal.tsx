import React from 'react';
import type { AppTheme } from '../types';
import { X, BookOpen, Terminal, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, theme }) => {
  if (!isOpen) return null;

  const isDark = theme.name === 'modern-dark';
  const isRetro = theme.name === 'classic-retro';

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
            <BookOpen size={16} />
            <span className="font-semibold text-sm">COM Analyzer for macOS 사용 안내</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-75">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-xs leading-relaxed overflow-y-auto max-h-[70vh]">
          <div className="p-3 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Sparkles size={14} />
              <span>macOS 네이티브 COM Analyzer</span>
            </div>
            <p>
              Windows의 클래식 COM Analyzer를 macOS 환경에 맞게 완벽하게 구현하였습니다.
              Mac의 <b>/dev/cu.*</b> 시리얼 포트와 <b>TCP Server / Client</b> 소켓을 모두 지원합니다.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5">
              <Terminal size={14} />
              <span>주요 기능 가이드</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>
                <b className="text-zinc-200">패킷 바이트 격자 뷰어</b>: 수신(RX: 오렌지)과 송신(TX: 청록) 데이터가 바이트 단위 격자로 시각화됩니다.
              </li>
              <li>
                <b className="text-zinc-200">바이트 인스펙터</b>: 격자의 바이트 위에 마우스를 올리면 인덱스, 16진수, 10진수, ASCII, 타임스탬프가 툴팁으로 표시됩니다.
              </li>
              <li>
                <b className="text-zinc-200">하단 4종 계산기</b>: Sum Check(8/16-bit), CRC-16(Modbus/CCITT), Binary ↔ ASCII 변환기를 즉시 계산하고 원클릭으로 전송창에 적용할 수 있습니다.
              </li>
              <li>
                <b className="text-zinc-200">가상 디바이스 시뮬레이터</b>: 실제 하드웨어 없이도 [통신 설정] → [가상 시뮬레이터]를 통해 Modbus 및 에코 통신을 즉시 테스트할 수 있습니다.
              </li>
            </ul>
          </div>

          <div className="border-t border-zinc-400/20 pt-2">
            <h4 className="font-bold text-sm mb-1">단축키 안내</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="flex justify-between p-1.5 rounded bg-black/5 dark:bg-white/5">
                <span>Enter</span>
                <span className="text-zinc-400">보내는 데이터 즉시 전송</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-black/5 dark:bg-white/5">
                <span>Space</span>
                <span className="text-zinc-400">화면 일시정지 (PAUSE)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t flex justify-end bg-black/5 dark:bg-white/5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
