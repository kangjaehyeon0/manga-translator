import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, Languages, Type, CheckCircle2, Archive } from 'lucide-react';

export default function TranslationProgress({
  isZip = false,
  pageCount = 0,
  currentPage = 0,
  progressText = '',
  selectedModel = 'gemini-3.5-flash',
  isFreeMode = false,
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const modelLabel = isFreeMode ? '무료 로컬 엔진' : selectedModel;

  const steps = isZip
    ? [
        { icon: Archive, label: `ZIP 압축 해제 및 ${pageCount > 0 ? `${pageCount}개 ` : ''}만화 이미지 분석` },
        { icon: Languages, label: `${modelLabel} 대사 인식 및 한국어 번역` },
        { icon: Type, label: 'HTML5 Canvas 한글 나눔고딕 식자 합성 및 ZIP 생성' },
      ]
    : [
        { icon: Sparkles, label: `${modelLabel}에 이미지 전달 및 말풍선 감지` },
        { icon: Languages, label: '말풍선 좌표 정밀 분석 및 감정선 번역' },
        { icon: Type, label: 'HTML5 Canvas 배경 마스킹 & 한글 자동 식자 합성' },
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
        <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl animate-pulse"></div>
        <div className="absolute inset-0 rounded-full border-2 border-brand-500/30 animate-ping opacity-25"></div>
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-accent-600 p-[2px]">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white tracking-tight">
          {isZip ? 'ZIP 일괄 만화 번역 & 식자 합성 진행 중' : '만화 번역 및 식자 합성 진행 중'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-400">
          {progressText ||
            (isZip
              ? `총 ${pageCount > 0 ? `${pageCount}장의 ` : ''}페이지를 순차 분석하고 있습니다.`
              : '브라우저에서 직접 AI 대사 분석 및 고품질 한글 식자를 합성하고 있습니다.')}
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
                className="bg-gradient-to-r from-brand-500 to-accent-500 h-2 transition-all duration-300 rounded-full"
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
