import React from 'react';
import { Sparkles, Server, CheckCircle, AlertCircle, Globe } from 'lucide-react';

export default function Header({
  backendUrl = '',
  onOpenKeyModal,
}) {
  const hasBackendUrl = Boolean(backendUrl && backendUrl.trim());

  // URL에서 호스트명만 간결하게 추출 (UI 배너용)
  let displayHost = '';
  if (hasBackendUrl) {
    try {
      const parsed = new URL(backendUrl.startsWith('http') ? backendUrl : `http://${backendUrl}`);
      displayHost = parsed.host || backendUrl;
    } catch (_) {
      displayHost = backendUrl.length > 24 ? backendUrl.slice(0, 24) + '...' : backendUrl;
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 sm:px-8 py-3.5 backdrop-blur-md bg-slate-950/80">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-500 p-[1px] shadow-lg shadow-brand-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-brand-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white tracking-tight">MangaTrans</h1>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 text-[11px] font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/30 rounded-full">
                <span>manga-image-translator</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI 만화 말풍선 인식 & 한국어 식자(Typesetting) 합성 웹 인터페이스
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenKeyModal}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 border ${
              hasBackendUrl
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
            }`}
            title="백엔드 API 서버 URL 설정 열기"
          >
            {hasBackendUrl ? (
              <>
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[150px] sm:max-w-[200px] truncate">
                  서버: {displayHost}
                </span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-0.5 flex-shrink-0" />
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>백엔드 주소 설정 필요</span>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 ml-0.5 flex-shrink-0" />
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
