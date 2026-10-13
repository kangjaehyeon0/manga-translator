import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, ShieldCheck, Trash2, Cpu, Zap, Check } from 'lucide-react';

export const GEMINI_MODELS = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (기본값)',
    desc: '빠르고 안정적 • 권장 모델',
    badge: '추천',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro (정밀 번역)',
    desc: '복잡한 만화 및 고품질 번역',
    badge: '고품질',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    desc: '최신 초고속 비전 아키텍처',
    badge: 'New',
  },
];

export default function ApiKeyModal({
  isOpen,
  onClose,
  currentKey,
  onSaveKey,
  serverHasKey,
  currentModel = 'gemini-1.5-flash',
  onSaveModel,
  isFreeMode = false,
  onToggleFreeMode,
}) {
  const [inputKey, setInputKey] = useState(currentKey || '');
  const [selectedModel, setSelectedModel] = useState(currentModel || 'gemini-1.5-flash');
  const [freeModeActive, setFreeModeActive] = useState(isFreeMode);

  useEffect(() => {
    setInputKey(currentKey || '');
  }, [currentKey]);

  useEffect(() => {
    setSelectedModel(currentModel || 'gemini-1.5-flash');
  }, [currentModel]);

  useEffect(() => {
    setFreeModeActive(isFreeMode);
  }, [isFreeMode]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveKey(inputKey.trim());
    if (onSaveModel) onSaveModel(selectedModel);
    if (onToggleFreeMode) onToggleFreeMode(freeModeActive);
    onClose();
  };

  const handleClear = () => {
    setInputKey('');
    onSaveKey('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-slate-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-brand-500/10 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-500/20 to-indigo-500/20 text-brand-400 border border-brand-500/30">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">번역 설정 및 모델 관리</h3>
            <p className="text-xs text-slate-400">Gemini 비전 모델과 API 키 및 무료 모드를 설정합니다.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. 무료 모드 토글 카드 */}
          <div className={`p-4 rounded-xl border transition-all duration-200 ${
            freeModeActive
              ? 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-1.5 rounded-lg ${freeModeActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-white">무료 모드 (API 키 미사용)</span>
                    {freeModeActive && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    API 키 없이도 스마트 로컬/대체 번역 엔진으로 즉시 번역 체험 가능
                  </p>
                </div>
              </div>

              {/* 스위치 토글 버튼 */}
              <button
                type="button"
                onClick={() => setFreeModeActive(!freeModeActive)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  freeModeActive ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    freeModeActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {freeModeActive && (
              <div className="mt-3 pt-3 border-t border-emerald-500/20 text-xs text-emerald-300/90 leading-relaxed flex items-start space-x-1.5">
                <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-400" />
                <span>
                  무료 모드가 켜져 있습니다. API 키 없이도 번역 프로세스가 멈추지 않고 완료됩니다.
                </span>
              </div>
            )}
          </div>

          {/* 2. Gemini 모델 선택 옵션 */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Gemini 모델 선택</span>
              <span className="text-[11px] font-normal text-slate-400">선택 시 API 파라미터로 동적 전달</span>
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition cursor-pointer appearance-none pr-10"
              >
                {GEMINI_MODELS.map((model) => (
                  <option key={model.id} value={model.id} className="bg-slate-900 text-white">
                    {model.name} — {model.desc}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* 선택된 모델 상세 배너 */}
            <div className="mt-2 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <div>
                <span className="font-mono text-brand-400 font-semibold">{selectedModel}</span>
                <span className="text-slate-400 ml-2">
                  {GEMINI_MODELS.find((m) => m.id === selectedModel)?.desc}
                </span>
              </div>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {GEMINI_MODELS.find((m) => m.id === selectedModel)?.badge}
              </span>
            </div>
          </div>

          {/* 3. API 키 입력 */}
          <div className={freeModeActive ? 'opacity-50 pointer-events-none select-none transition-opacity' : 'transition-opacity'}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-brand-400" />
                <span>Google Gemini API 키</span>
              </label>
              {freeModeActive && (
                <span className="text-[11px] text-emerald-400 font-medium">
                  (무료 모드 활성화로 비활성화됨)
                </span>
              )}
            </div>

            {/* Server key notice */}
            {serverHasKey && !freeModeActive && (
              <div className="mb-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                <p className="leading-snug">
                  서버 .env에 <code className="font-mono bg-emerald-950/60 px-1 py-0.5 rounded">GEMINI_API_KEY</code>가 등록되어 있습니다. 비워두면 서버 키가 자동 사용됩니다.
                </p>
              </div>
            )}

            <input
              type="password"
              value={inputKey}
              disabled={freeModeActive}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder={
                freeModeActive
                  ? '무료 모드가 활성화되어 API 키가 필요하지 않습니다.'
                  : serverHasKey
                  ? '서버 기본 키 사용 중 (원하는 경우 개별 키 입력)'
                  : 'AIzaSy...'
              }
              className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border text-sm text-white placeholder-slate-500 font-mono transition focus:outline-none ${
                freeModeActive
                  ? 'border-slate-800 bg-slate-950/40 cursor-not-allowed'
                  : 'border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
              }`}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              * 입력한 키는 브라우저 로컬 스토리지에만 보관되며 안전하게 보호됩니다.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-800">
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
              {inputKey && !freeModeActive && (
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
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition shadow-lg shadow-brand-600/30"
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
