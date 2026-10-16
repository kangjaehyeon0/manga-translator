import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Zap,
  Globe,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Key,
} from 'lucide-react';
import { testDeepLConnection } from '../services/deeplService';

export default function ApiKeyModal({
  isOpen,
  onClose,
  engine = 'deepl',
  onSaveEngine,
  geminiApiKey = '',
  onSaveGeminiApiKey,
  deeplApiKey = '',
  onSaveDeeplApiKey,
}) {
  const [selectedEngine, setSelectedEngine] = useState(engine || 'deepl');
  const [inputGeminiKey, setInputGeminiKey] = useState(geminiApiKey || '');
  const [inputDeeplKey, setInputDeeplKey] = useState(deeplApiKey || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }

  useEffect(() => {
    setSelectedEngine(engine || 'deepl');
    setInputGeminiKey(geminiApiKey || '');
    setInputDeeplKey(deeplApiKey || '');
    setTestResult(null);
  }, [isOpen, engine, geminiApiKey, deeplApiKey]);

  if (!isOpen) return null;

  const handleTestDeepL = async () => {
    if (!inputDeeplKey.trim()) {
      setTestResult({ ok: false, message: '테스트할 DeepL API 키를 먼저 입력해주세요.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testDeepLConnection(inputDeeplKey.trim());
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || 'DeepL API 서버 연결에 실패했습니다.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanGemini = inputGeminiKey.trim();
    const cleanDeepl = inputDeeplKey.trim();

    // 1. LocalStorage 영구 저장 (명세 준수: translation_engine, gemini_api_key, deepl_api_key)
    localStorage.setItem('translation_engine', selectedEngine);
    if (cleanGemini) {
      localStorage.setItem('gemini_api_key', cleanGemini);
      // 기존 호환성 유지
      localStorage.setItem('GEMINI_API_KEY', cleanGemini);
    } else {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('GEMINI_API_KEY');
    }

    if (cleanDeepl) {
      localStorage.setItem('deepl_api_key', cleanDeepl);
    } else {
      localStorage.removeItem('deepl_api_key');
    }

    // 2. 부모 컴포넌트 상태 동기화
    if (onSaveEngine) onSaveEngine(selectedEngine);
    if (onSaveGeminiApiKey) onSaveGeminiApiKey(cleanGemini);
    if (onSaveDeeplApiKey) onSaveDeeplApiKey(cleanDeepl);

    onClose();
  };

  const handleClearCurrentKey = () => {
    if (selectedEngine === 'gemini') {
      setInputGeminiKey('');
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('GEMINI_API_KEY');
      if (onSaveGeminiApiKey) onSaveGeminiApiKey('');
    } else {
      setInputDeeplKey('');
      localStorage.removeItem('deepl_api_key');
      if (onSaveDeeplApiKey) onSaveDeeplApiKey('');
    }
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-brand-500/10 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-500/20 via-indigo-500/20 to-accent-500/20 text-brand-400 border border-brand-500/30">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              번역 엔진 및 API 키 설정
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              원하는 번역 엔진을 선택하고 각 엔진의 API 키를 입력하여 사용할 수 있습니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. 번역 엔진 선택 탭/라디오 카드 */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>번역 엔진 선택 (Translation Engine)</span>
              <span className="text-[11px] text-brand-400 font-normal">원클릭 전환 가능</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 옵션 A: Google Gemini */}
              <div
                onClick={() => {
                  setSelectedEngine('gemini');
                  setTestResult(null);
                }}
                className={`relative cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
                  selectedEngine === 'gemini'
                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/15'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${
                      selectedEngine === 'gemini' ? 'bg-brand-500/20 text-brand-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-white">Google Gemini</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    비전 자동 번역
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  말풍선 좌표 인식과 일본어 번역을 Gemini 1.5 Flash 모델이 한 번에 처리합니다.
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400">엔진: Gemini 1.5 Flash</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedEngine === 'gemini'
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : 'border-slate-600'
                  }`}>
                    {selectedEngine === 'gemini' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* 옵션 B: DeepL API (강력 추천) */}
              <div
                onClick={() => {
                  setSelectedEngine('deepl');
                  setTestResult(null);
                }}
                className={`relative cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between ${
                  selectedEngine === 'deepl'
                    ? 'border-accent-500 bg-accent-500/10 shadow-lg shadow-accent-500/15'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-lg ${
                      selectedEngine === 'deepl' ? 'bg-accent-500/20 text-accent-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-white">DeepL API</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-accent-500/30 to-brand-500/30 text-accent-300 border border-accent-500/40">
                    강력 추천
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  고품질 신경망 텍스트 번역으로 만화 대사를 원어민처럼 자연스럽게 한국어로 번역합니다.
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400">신경망 NMT 번역</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedEngine === 'deepl'
                      ? 'border-accent-500 bg-accent-500 text-white'
                      : 'border-slate-600'
                  }`}>
                    {selectedEngine === 'deepl' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 선택한 엔진에 따라 API 키 입력 필드 동적 전환 */}
          {selectedEngine === 'gemini' ? (
            /* Gemini API 키 입력 영역 */
            <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-brand-500/30 transition-all animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span>Google Gemini API 키</span>
                  <span className="text-rose-400 font-bold">*</span>
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-brand-400 hover:text-brand-300 hover:underline flex items-center space-x-1"
                >
                  <span>Google AI Studio 키 발급</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <input
                type="password"
                value={inputGeminiKey}
                onChange={(e) => setInputGeminiKey(e.target.value)}
                placeholder="AI Studio에서 발급받은 Gemini API 키를 입력하세요 (AIzaSy...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 font-mono transition focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />

              <div className="space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
                <p>
                  • Google AI Studio에서 발급받은 무료 API 키를 지원합니다.
                </p>
                <p className="text-brand-300/90">
                  • <strong>안전장치 유지:</strong> Gemini 1.5 Flash 모델, BLOCK_NONE 무검열 설정 및 2초 순차 요청 딜레이가 자동 적용됩니다.
                </p>
              </div>
            </div>
          ) : (
            /* DeepL API 키 입력 영역 */
            <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-accent-500/30 transition-all animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-accent-400" />
                  <span>DeepL API 키</span>
                  <span className="text-rose-400 font-bold">*</span>
                </label>
                <a
                  href="https://www.deepl.com/your-account/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-accent-400 hover:text-accent-300 hover:underline flex items-center space-x-1"
                >
                  <span>DeepL 계정 키 관리</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex space-x-2">
                <input
                  type="password"
                  value={inputDeeplKey}
                  onChange={(e) => {
                    setInputDeeplKey(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 font-mono transition focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
                />

                <button
                  type="button"
                  onClick={handleTestDeepL}
                  disabled={isTesting || !inputDeeplKey.trim()}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  title="DeepL API 서버와 정상 통신 가능한지 테스트합니다"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-accent-400' : 'text-slate-400'}`} />
                  <span>{isTesting ? '확인 중...' : '연결 테스트'}</span>
                </button>
              </div>

              {/* DeepL 테스트 결과 배너 */}
              {testResult && (
                <div
                  className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 border transition-all ${
                    testResult.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{testResult.ok ? 'DeepL 연결 성공' : '연결 실패'}</p>
                    <p className="mt-0.5 text-[11px] opacity-90">{testResult.message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1 text-[11px] text-slate-400 leading-relaxed">
                <p>
                  • <strong className="text-slate-200">DeepL 공식 무료 계정 키(:fx로 끝나는 키)를 지원합니다.</strong>
                </p>
                <p>
                  • DeepL 공식 무료 엔드포인트(<code>https://api-free.deepl.com/v2/translate</code>)로 직접 전송되어 최상의 번역 퀄리티를 제공합니다.
                </p>
              </div>
            </div>
          )}

          {/* 3. 모달 하단 버튼 */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-800">
            <div>
              {((selectedEngine === 'gemini' && inputGeminiKey) ||
                (selectedEngine === 'deepl' && inputDeeplKey)) && (
                <button
                  type="button"
                  onClick={handleClearCurrentKey}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>현재 키 초기화</span>
                </button>
              )}
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-accent-600 hover:from-brand-500 hover:via-indigo-500 hover:to-accent-500 transition shadow-lg shadow-brand-600/30 cursor-pointer"
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
