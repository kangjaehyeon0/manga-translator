import React, { useState } from 'react';
import { X, Key, ExternalLink, ShieldCheck, Trash2 } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, currentKey, onSaveKey, serverHasKey }) {
  const [inputKey, setInputKey] = useState(currentKey || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveKey(inputKey.trim());
    onClose();
  };

  const handleClear = () => {
    setInputKey('');
    onSaveKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl shadow-brand-500/10">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Google Gemini API 키 설정</h3>
            <p className="text-xs text-slate-400">gemini-3.8-flash 모델 호출에 사용됩니다.</p>
          </div>
        </div>

        {/* Server key notice */}
        {serverHasKey && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-semibold">서버 .env 키가 감지되었습니다.</p>
              <p className="text-emerald-400/80 mt-0.5">
                아래 입력창을 비워두면 서버의 .env에 저장된 <code className="font-mono bg-emerald-950/60 px-1 py-0.5 rounded">GEMINI_API_KEY</code>를 자동으로 사용합니다.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              API 키 (Client Override)
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder={serverHasKey ? "서버 기본 키 사용 중 (선택 입력)" : "AIzaSy..."}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-mono"
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              * 입력한 키는 브라우저 로컬 스토리지에만 저장되며 외부로 유출되지 않습니다.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-brand-400 hover:text-brand-300 hover:underline"
            >
              <span>API 키 무료 발급받기</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <div className="flex space-x-2">
              {inputKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>지우기</span>
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition shadow-md shadow-brand-600/30"
              >
                저장하기
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
