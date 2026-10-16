import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, Languages, Type, CheckCircle2, Archive, Zap } from 'lucide-react';

export default function TranslationProgress({
  isZip = false,
  pageCount = 0,
  currentPage = 0,
  progressText = '',
  engine = 'deepl',
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const isDeepL = engine === 'deepl';

  const steps = isZip
    ? [
        {
          icon: Archive,
          label: `ZIP 압축 해제 및 ${pageCount > 0 ? `${pageCount}개 ` : ''}만화 이미지 분석`,
        },
        {
          icon: isDeepL ? Zap : Sparkles,
          label: isDeepL
            ? '말풍선 원문 추출 및 DeepL 공식 신경망 번역 (JA → KO)'
            : 'Gemini 1.5 Flash 비전 모델 대사 감지 및 번역 (BLOCK_NONE)',
        },
        {
          icon: Type,
          label: 'HTML5 Canvas 한국어 폰트 식자 합성 및 최종 ZIP 패키징',
        },
      ]
    : [
        {
          icon: Languages,
          label: '만화 이미지 말풍선 영역 및 일본어 원문 대사 감지',
        },
        {
          icon: isDeepL ? Zap : Sparkles,
          label: isDeepL
            ? 'DeepL API 공식 엔드포인트 신경망 번역 전송'
            : 'Gemini 1.5 Flash 비전 AI 번역 처리 (안전장치 적용)',
        },
        {
          icon: Type,
          label: 'Canvas 말풍선 마스킹 및 고품질 한글 폰트 식자 렌더링',
        },
      ];

  useEffect(() => {
    if (currentPage > 0 && pageCount > 0) {
      if (currentPage >= pageCount) {
        setCurrentStep(2);
      } else if (currentPage > 1) {
        setCurrentStep(1);
      }
    } else {
      const timer1 = setTimeout(() => setCurrentStep(1), 1500);
      const timer2 = setTimeout(() => setCurrentStep(2), 3500);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [currentPage, pageCount]);

  return (
    <div className="w-full max-w-xl mx-auto my-12 p-8 glass-panel rounded-3xl text-center space-y-6 shadow-2xl shadow-brand-500/10">
      {/* Central Spinner & Pulse Rings */}
      <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full blur-xl animate-pulse ${
          isDeepL ? 'bg-accent-500/20' : 'bg-brand-500/20'
        }`}></div>
        <div className={`absolute inset-0 rounded-full border-2 animate-ping opacity-25 ${
          isDeepL ? 'border-accent-500/30' : 'border-brand-500/30'
        }`}></div>
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-600 p-[2px]">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Loader2 className={`w-10 h-10 animate-spin ${
              isDeepL ? 'text-accent-400' : 'text-brand-400'
            }`} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800">
          {isDeepL ? (
            <>
              <Zap className="w-3.5 h-3.5 text-accent-400" />
              <span className="text-accent-300">DeepL 신경망 번역 파이프라인</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-brand-300">Gemini 1.5 Flash 비전 파이프라인</span>
            </>
          )}
        </div>

        <h3 className="text-xl font-bold text-white tracking-tight">
          {isZip ? 'ZIP 일괄 만화 번역 & 식자 진행 중' : '만화 번역 및 식자 진행 중'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-400">
          {progressText ||
            (isZip
              ? `총 ${pageCount > 0 ? `${pageCount}장의 ` : ''}페이지를 순차적으로 번역 및 식자하고 있습니다.`
              : 'AI 대사 분석 및 한국어 식자 합성을 진행하고 있습니다.')}
        </p>

        {isZip && pageCount > 0 && (
          <div className="pt-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>진행률</span>
              <span className="font-semibold text-brand-300">
                {currentPage} / {pageCount} 페이지 ({Math.round(((currentPage || 1) / pageCount) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-500 via-indigo-500 to-accent-500 h-2 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(5, Math.min(100, Math.round(((currentPage || 1) / pageCount) * 100)))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="space-y-3 pt-2 text-left">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = currentStep > idx;
          const isCurrent = currentStep === idx;

          return (
            <div
              key={idx}
              className={`flex items-center space-x-3 p-3 rounded-xl border transition-all duration-300 ${
                isCurrent
                  ? 'bg-brand-500/10 border-brand-500/30 text-white'
                  : isDone
                  ? 'bg-slate-900/40 border-slate-800 text-slate-300'
                  : 'bg-transparent border-transparent text-slate-600'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : isCurrent
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'bg-slate-800 text-slate-600'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse' : ''}`} />
                )}
              </div>
              <span className="text-xs font-medium">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
