import React, { useState, useEffect } from 'react';
import { X, Server, Globe, ExternalLink, ShieldCheck, Trash2, Cpu, Zap, Check, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { testBackendConnection, normalizeBackendUrl } from '../services/mangaBackendService';

export const GEMINI_MODELS = [
  {
    id: 'manga-image-translator',
    name: 'manga-image-translator (외부 서버)',
    desc: 'Google Colab / 로컬 GPU 기반 고성능 식자 엔진',
    badge: '추천',
  },
];

export default function ApiKeyModal({
  isOpen,
  onClose,
  backendUrl = '',
  onSaveBackendUrl,
  targetLang = 'KOR',
  onSaveTargetLang,
  detector = 'default',
  onSaveDetector,
  direction = 'auto',
  onSaveDirection,
}) {
  const [inputUrl, setInputUrl] = useState(backendUrl || '');
  const [selectedTargetLang, setSelectedTargetLang] = useState(targetLang || 'KOR');
  const [selectedDetector, setSelectedDetector] = useState(detector || 'default');
  const [selectedDirection, setSelectedDirection] = useState(direction || 'auto');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }

  useEffect(() => {
    setInputUrl(backendUrl || '');
    setTestResult(null);
  }, [backendUrl, isOpen]);

  useEffect(() => {
    setSelectedTargetLang(targetLang || 'KOR');
  }, [targetLang]);

  useEffect(() => {
    setSelectedDetector(detector || 'default');
  }, [detector]);

  useEffect(() => {
    setSelectedDirection(direction || 'auto');
  }, [direction]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const cleanUrl = normalizeBackendUrl(inputUrl);
    if (!cleanUrl) {
      setTestResult({ ok: false, message: '테스트할 백엔드 주소를 입력해주세요.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testBackendConnection(cleanUrl);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || '서버 연결에 실패했습니다. CORS 또는 서버 상태를 확인해주세요.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanUrl = normalizeBackendUrl(inputUrl);
    if (onSaveBackendUrl) {
      onSaveBackendUrl(cleanUrl);
    }
    if (onSaveTargetLang) {
      onSaveTargetLang(selectedTargetLang);
    }
    if (onSaveDetector) {
      onSaveDetector(selectedDetector);
    }
    if (onSaveDirection) {
      onSaveDirection(selectedDirection);
    }
    onClose();
  };

  const handleClear = () => {
    setInputUrl('');
    setTestResult(null);
    if (onSaveBackendUrl) {
      onSaveBackendUrl('');
    }
  };

  const handleApplyLocalDefault = () => {
    setInputUrl('http://localhost:5003');
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900/95 border border-slate-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl shadow-brand-500/10 max-h-[92vh] overflow-y-auto">
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
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">만화 번역 서버 및 API 설정</h3>
            <p className="text-xs text-slate-400">
              외부 manga-image-translator 백엔드(Google Colab / ngrok / 로컬) 연동 주소를 설정합니다.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. 백엔드 API 주소 입력 필드 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-brand-400" />
                <span>백엔드 API 주소 (Backend URL)</span>
                <span className="text-rose-400 font-bold">*</span>
              </label>

              <button
                type="button"
                onClick={handleApplyLocalDefault}
                className="text-[11px] text-brand-400 hover:text-brand-300 hover:underline flex items-center space-x-1"
              >
                <span>로컬 기본값 (5003번)</span>
              </button>
            </div>

            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => {
                    setInputUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="예: http://localhost:5003 또는 https://xxxx.ngrok-free.app"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-sm text-white placeholder-slate-500 font-mono transition focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !inputUrl.trim()}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-brand-400' : 'text-slate-400'}`} />
                <span>{isTesting ? '연결 중...' : '연결 확인'}</span>
              </button>
            </div>

            {/* 연결 테스트 결과 메시지 배너 */}
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
                  <p className="font-semibold">{testResult.ok ? '서버 응답 확인됨' : '연결 실패'}</p>
                  <p className="mt-0.5 text-[11px] opacity-90">{testResult.message}</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-400 leading-relaxed">
              * Google Colab에서 <code>manga-image-translator</code>를 실행한 뒤 부여받은{' '}
              <strong className="text-slate-200">ngrok 터널링 주소</strong> 또는 로컬 실행 주소(<code>http://localhost:5003</code>)를 입력하세요.
            </p>
          </div>

          {/* 2. Colab / ngrok 안내 팁 카드 */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center space-x-2 text-brand-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <span>Google Colab & ngrok 외부 서버 연동 안내</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              웹 프론트엔드가 자체 번역 로직 대신 설정된 외부 주소의 <code className="text-brand-300">/run</code> 또는 <code className="text-brand-300">/translate</code> 엔드포인트로
              이미지를 직접 전송(Multipart Form-data)하여 GPU로 번역 및 식자된 이미지를 받아옵니다.
            </p>
            <div className="text-[11px] text-slate-400 pt-1">
              • <strong>전송 규격:</strong> file (이미지), target_lang="KOR", detector="default", direction="auto"
            </div>
          </div>

          {/* 3. 번역 세부 옵션 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                목표 언어 (Target Lang)
              </label>
              <select
                value={selectedTargetLang}
                onChange={(e) => setSelectedTargetLang(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="KOR">KOR (한국어)</option>
                <option value="ENG">ENG (영어)</option>
                <option value="JPN">JPN (일본어)</option>
                <option value="CHS">CHS (중국어 간체)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                감지기 (Detector)
              </label>
              <select
                value={selectedDetector}
                onChange={(e) => setSelectedDetector(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="default">default (기본 모델)</option>
                <option value="auto">auto</option>
                <option value="ctd">ctd (만화 전용)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                텍스트 방향 (Direction)
              </label>
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="auto">auto (자동 감지)</option>
                <option value="vertical">vertical (세로쓰기)</option>
                <option value="horizontal">horizontal (가로쓰기)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-800">
            <div className="flex items-center space-x-2">
              {inputUrl && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>초기화</span>
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
