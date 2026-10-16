import React from 'react';
import { Sparkles, Zap, CheckCircle, AlertCircle, Key, Settings } from 'lucide-react';

export default function Header({
  engine = 'deepl',
  geminiApiKey = '',
  deeplApiKey = '',
  onOpenKeyModal,
}) {
  const isDeepL = engine === 'deepl';
  const hasActiveKey = isDeepL
    ? Boolean(deeplApiKey && deeplApiKey.trim())
    : Boolean(geminiApiKey && geminiApiKey.trim());

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
              <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
                isDeepL
                  ? 'bg-accent-500/10 text-accent-300 border-accent-500/30'
                  : 'bg-brand-500/10 text-brand-300 border-brand-500/30'
              }`}>
                {isDeepL ? (
                  <>
                    <Zap className="w-3 h-3 text-accent-400 mr-0.5" />
                    <span>DeepL API</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-brand-400 mr-0.5" />
                    <span>Gemini 1.5 Flash</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              만화 대사 자동 인식 & 한국어 고품질 식자(Typesetting) 합성 시스템
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenKeyModal}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border cursor-pointer ${
              hasActiveKey
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 shadow-sm'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse shadow-sm'
            }`}
            title="번역 엔진 및 API 키 설정 열기"
          >
            {hasActiveKey ? (
              <>
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isDeepL ? 'DeepL 키 연동됨' : 'Gemini 키 연동됨'}</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-0.5 flex-shrink-0" />
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>{isDeepL ? 'DeepL API 키 설정 필요' : 'Gemini API 키 설정 필요'}</span>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 ml-0.5 flex-shrink-0" />
              </>
            )}
          </button>

          <button
            onClick={onOpenKeyModal}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            title="엔진 및 API 설정"
            aria-label="설정"
          >
            <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
          </button>
        </div>
      </div>
    </header>
  );
}
