import React from 'react';
import type { AppTheme } from '../types';
import { Download, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTitle?: string;
  releaseNotes?: string;
  publishedAt?: string;
  assetUrl?: string | null;
  assetName?: string | null;
  assetSize?: number;
  message?: string;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  updateInfo: UpdateInfo | null;
  updateStatus: 'idle' | 'checking' | 'downloading' | 'completed' | 'error';
  downloadProgress: { percent: number; downloaded: number; total: number };
  statusMessage: string;
  onStartUpdate: () => void;
  onCheckForUpdates: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  theme,
  updateInfo,
  updateStatus,
  downloadProgress,
  statusMessage,
  onStartUpdate,
  onCheckForUpdates
}) => {
  if (!isOpen) return null;

  const isRetro = theme.name === 'classic-retro';
  const isDark = theme.name === 'modern-dark';

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col border ${
          isRetro
            ? 'bg-[#d4d0c8] text-black border-[#808080] font-sans'
            : isDark
            ? 'bg-zinc-900 text-zinc-100 border-zinc-700/80 shadow-indigo-950/40'
            : 'bg-white text-zinc-800 border-zinc-200 shadow-zinc-300/50'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b ${
            isRetro
              ? 'bg-[#000080] text-white border-b-2 border-[#808080]'
              : isDark
              ? 'bg-zinc-800/80 border-zinc-700/80'
              : 'bg-indigo-50/70 border-indigo-100 text-indigo-950'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} className={isRetro ? 'text-yellow-300' : 'text-indigo-500'} />
            <span className="font-bold text-sm tracking-tight">
              COM Analyzer 업데이트 관리자
            </span>
          </div>
          {updateStatus !== 'downloading' && (
            <button
              onClick={onClose}
              className={`p-1 rounded transition-colors ${
                isRetro
                  ? 'hover:bg-red-600 text-white'
                  : 'hover:bg-zinc-700/50 text-zinc-400 hover:text-white'
              }`}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {updateStatus === 'checking' && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <RefreshCw size={32} className="animate-spin text-indigo-500" />
              <div className="font-semibold text-sm">GitHub 최신 릴리즈 확인 중...</div>
              <p className="text-xs opacity-70">잠시만 기다려 주세요.</p>
            </div>
          )}

          {updateStatus !== 'checking' && updateInfo && updateInfo.hasUpdate && (
            <>
              {/* Version Banner */}
              <div
                className={`p-3.5 rounded-lg border flex items-center justify-between ${
                  isRetro
                    ? 'bg-white border-[#808080]'
                    : isDark
                    ? 'bg-zinc-800/50 border-zinc-700/60'
                    : 'bg-indigo-50/40 border-indigo-100'
                }`}
              >
                <div>
                  <div className="text-xs opacity-70 font-mono">현재 버전: v{updateInfo.currentVersion}</div>
                  <div className="font-bold text-base text-emerald-500 flex items-center gap-1.5 mt-0.5">
                    <span>최신 버전: {updateInfo.latestVersion}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                      NEW
                    </span>
                  </div>
                </div>
                {updateInfo.assetSize ? (
                  <div className="text-xs font-mono opacity-60 text-right">
                    크기: {formatBytes(updateInfo.assetSize)}
                  </div>
                ) : null}
              </div>

              {/* Release Notes */}
              {updateInfo.releaseNotes && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold opacity-80">업데이트 주요 변경 내역</span>
                  <div
                    className={`max-h-48 overflow-y-auto p-3 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap border ${
                      isRetro
                        ? 'bg-white border-[#808080] text-black'
                        : isDark
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-300'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                    }`}
                  >
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}

              {/* Download Progress Bar */}
              {updateStatus === 'downloading' && (
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono font-semibold">
                    <span className="flex items-center gap-1.5 text-indigo-400 animate-pulse">
                      <Download size={14} /> 다운로드 및 파일 대치 중...
                    </span>
                    <span>
                      {downloadProgress.percent}% ({formatBytes(downloadProgress.downloaded)} / {formatBytes(downloadProgress.total)})
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden bg-zinc-700/30 p-0.5 border border-zinc-600/30">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-150"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                  <p className="text-[11px] opacity-70 text-center mt-1">
                    다운로드가 완료되면 응용 프로그램을 자동으로 대치하고 재실행합니다.
                  </p>
                </div>
              )}

              {/* Completed State */}
              {updateStatus === 'completed' && (
                <div className="py-4 flex flex-col items-center justify-center gap-2 text-center text-emerald-500">
                  <CheckCircle2 size={36} />
                  <div className="font-bold text-sm">업데이트가 성공적으로 완료되었습니다!</div>
                  <p className="text-xs text-zinc-400">새 버전으로 프로그램을 재실행합니다...</p>
                </div>
              )}

              {/* Error State */}
              {updateStatus === 'error' && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{statusMessage || '업데이트 도중 오류가 발생했습니다.'}</span>
                </div>
              )}
            </>
          )}

          {updateStatus !== 'checking' && (!updateInfo || !updateInfo.hasUpdate) && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <CheckCircle2 size={36} className="text-emerald-500" />
              <div className="font-bold text-base">최신 버전을 사용하고 있습니다!</div>
              <p className="text-xs opacity-70 font-mono">
                현재 설치된 버전: v{updateInfo?.currentVersion || '0.0.2'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`px-5 py-3 flex items-center justify-end gap-2 border-t ${
            isRetro
              ? 'bg-[#e0ded8] border-[#808080]'
              : isDark
              ? 'bg-zinc-800/40 border-zinc-800'
              : 'bg-zinc-50 border-zinc-100'
          }`}
        >
          {updateStatus !== 'downloading' && updateStatus !== 'completed' && (
            <>
              {updateInfo?.hasUpdate ? (
                <>
                  <button
                    onClick={onClose}
                    className={`px-3.5 py-1.5 rounded text-xs font-medium transition-all ${
                      isRetro
                        ? 'border border-[#808080] bg-[#d4d0c8] active:bg-[#b0aca4]'
                        : 'hover:bg-zinc-700/40 text-zinc-400 hover:text-white'
                    }`}
                  >
                    나중에 하기
                  </button>
                  <button
                    onClick={onStartUpdate}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                      isRetro
                        ? 'border-2 border-white bg-[#000080] text-white active:bg-blue-900'
                        : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white'
                    }`}
                  >
                    <Download size={14} />
                    <span>지금 원클릭 업데이트</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={onCheckForUpdates}
                    className={`px-3.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isRetro
                        ? 'border border-[#808080] bg-[#d4d0c8]'
                        : 'hover:bg-zinc-700/40 text-indigo-400'
                    }`}
                  >
                    <RefreshCw size={13} /> 다시 확인
                  </button>
                  <button
                    onClick={onClose}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${
                      isRetro
                        ? 'border-2 border-white bg-[#000080] text-white'
                        : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                    }`}
                  >
                    닫기
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
