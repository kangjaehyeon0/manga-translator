import React from 'react';
import { Sparkles, Key, CheckCircle, AlertCircle } from 'lucide-react';

export default function Header({ hasApiKey, onOpenKeyModal }) {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 sm:px-8 py-3.5">
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
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              AI 만화 말풍선 인식 & 한국어 식자(Typesetting) 합성 엔진
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenKeyModal}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
              hasApiKey
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
            }`}
            title="Gemini API Key 설정"
          >
            <Key className="w-3.5 h-3.5" />
            <span>API 키 {hasApiKey ? '연결됨' : '설정 필요'}</span>
            {hasApiKey ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 ml-0.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
