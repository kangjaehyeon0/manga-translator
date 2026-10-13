import React, { useState, useEffect } from 'react';
import { Loader2, Sparkles, Languages, Type, CheckCircle2, Archive } from 'lucide-react';

export default function TranslationProgress({ isZip = false, pageCount = 0 }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = isZip
    ? [
        { icon: Archive, label: `ZIP 압축 해제 및 ${pageCount > 0 ? `${pageCount}개 ` : ''}만화 이미지 분석 중...` },
        { icon: Languages, label: 'Gemini 3.8 Flash로 페이지별 대사 인식 및 번역 중...' },
        { icon: Type, label: '한글 나눔고딕 식자 합성 및 최종 ZIP 아카이브 생성 중...' },
      ]
    : [
        { icon: Sparkles, label: 'Gemini 3.8 Flash 비전 모델에 이미지 전달 중...' },
        { icon: Languages, label: '말풍선 좌표 감지 및 한국어 대사 번역 중...' },
        { icon: Type, label: '말풍선 배경 마스킹 & 한글 폰트 자동 식자 합성 중...' },
      ];

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStep(1), 2200);
    const timer2 = setTimeout(() => setCurrentStep(2), 5200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

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
          {isZip
            ? `총 ${pageCount > 0 ? `${pageCount}장의 ` : ''}페이지를 순차 분석하고 있습니다. 페이지 수에 따라 잠시 기다려주세요.`
            : 'AI가 말풍선을 정밀 분석하고 자연스러운 한국어로 대사를 채워넣고 있습니다.'}
        </p>
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
