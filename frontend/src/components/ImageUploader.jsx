import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  Zap,
  X,
  ArrowRight,
  Wand2,
  Archive,
  Files,
  Layers,
  Key,
} from 'lucide-react';

export default function ImageUploader({
  selectedFile,
  previewUrl,
  zipDetails,
  onSelectFile,
  onClearFile,
  onStartTranslate,
  isTranslating,
  onLoadSample,
  engine = 'deepl',
  geminiApiKey = '',
  deeplApiKey = '',
  onOpenSettings,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isPacking, setIsPacking] = useState(false);
  const fileInputRef = useRef(null);

  const isDeepL = engine === 'deepl';
  const hasActiveKey = isDeepL
    ? Boolean(deeplApiKey && deeplApiKey.trim())
    : Boolean(geminiApiKey && geminiApiKey.trim());

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    // 1. 단일 ZIP 파일 업로드인 경우
    if (filesArray.length === 1 && (filesArray[0].name.toLowerCase().endsWith('.zip') || filesArray[0].type.includes('zip'))) {
      onSelectFile(filesArray[0]);
      return;
    }

    // 2. 여러 이미지 파일(또는 단일 이미지)인 경우
    const imageFiles = filesArray.filter((f) => {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      return f.type.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    });

    if (imageFiles.length === 0) {
      alert('지원되는 이미지(JPG, PNG, WebP) 또는 ZIP 압축 파일만 업로드할 수 있습니다.');
      return;
    }

    if (imageFiles.length === 1) {
      // 단일 이미지
      onSelectFile(imageFiles[0]);
    } else {
      // 복수 이미지 (2장 이상) -> 브라우저에서 자동 ZIP 묶음 처리
      try {
        setIsPacking(true);
        const zip = new JSZip();
        // 파일명 자연스러운 순서로 정렬
        imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        imageFiles.forEach((f) => {
          zip.file(f.name, f);
        });
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const bundledFile = new File([zipBlob], `manga_bundle_${imageFiles.length}pages.zip`, {
          type: 'application/zip',
        });
        onSelectFile(bundledFile);
      } catch (err) {
        console.error('ZIP 압축 패키징 오류:', err);
        alert('이미지 파일들을 ZIP으로 묶는 중 오류가 발생했습니다.');
      } finally {
        setIsPacking(false);
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const isZip = selectedFile && (
    selectedFile.name.toLowerCase().endsWith('.zip') ||
    selectedFile.type?.includes('zip') ||
    Boolean(zipDetails)
  );

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Upload Box */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center transition-all duration-300 ${
            isDragging
              ? 'border-brand-400 bg-brand-500/10 scale-[1.01] shadow-2xl shadow-brand-500/20'
              : 'border-slate-700/80 hover:border-brand-500/60 bg-slate-900/40 hover:bg-slate-900/80 shadow-xl'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png, image/jpeg, image/jpg, image/webp, .zip, application/zip, application/x-zip-compressed"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600/30 to-accent-500/20 border border-brand-500/30 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-400 transition-all duration-300">
              <Upload className="w-8 h-8 text-brand-400 group-hover:text-brand-300 transition" />
            </div>

            <div className="space-y-1">
              <p className="text-base sm:text-lg font-semibold text-slate-200">
                만화 이미지 파일들 또는 <span className="text-brand-400 font-bold">ZIP 압축 파일</span>을 드래그하여 놓거나{' '}
                <span className="text-brand-400 underline decoration-brand-500/50 underline-offset-4">
                  직접 찾아보기
                </span>
              </p>
              <p className="text-xs text-slate-400">
                단일 이미지(JPG, PNG, WebP) / <strong>여러 장 다중 선택</strong> / <strong>ZIP 압축 파일</strong> 모두 지원
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                isDeepL
                  ? 'bg-accent-500/10 text-accent-300 border-accent-500/30'
                  : 'bg-brand-500/10 text-brand-300 border-brand-500/30'
              }`}>
                {isDeepL ? (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5 text-accent-400" />
                    DeepL NMT 신경망 번역 엔진 활성화
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-brand-400" />
                    Google Gemini 1.5 Flash 비전 엔진 활성화
                  </>
                )}
              </span>

              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <Archive className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                ZIP 대용량 일괄 번역 지원
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                <Files className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                여러 장 동시 선택 지원
              </span>
            </div>

            {/* 빠른 샘플 테스트 버튼 */}
            {onLoadSample && (
              <div className="pt-3" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={onLoadSample}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-brand-500/50 transition-all cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>샘플 만화 컷으로 즉시 체험해보기</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Selected File Card */
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Preview Thumbnail or Zip Icon */}
            <div className="relative group w-full sm:w-48 h-56 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 flex flex-col items-center justify-center p-3">
              {isZip ? (
                <div className="flex flex-col items-center justify-center text-center space-y-2">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="ZIP 첫 페이지 미리보기"
                      className="w-full h-36 object-contain rounded-lg border border-slate-800"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Archive className="w-9 h-9 text-amber-400" />
                    </div>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Layers className="w-3 h-3 mr-1" />
                    {zipDetails?.pageCount ? `${zipDetails.pageCount}개 페이지 감지` : 'ZIP 압축 패키지'}
                  </span>
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="선택된 만화 미리보기"
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-slate-600" />
              )}
            </div>

            {/* File Info & Action */}
            <div className="flex-1 w-full flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                        isZip
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                      }`}>
                        {isZip ? 'ZIP 일괄 번역 모드' : '단일 페이지 번역 모드'}
                      </span>
                      {zipDetails?.pageCount && (
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          총 {zipDetails.pageCount}장
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-sm sm:max-w-md">
                      {selectedFile.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      용량: {formatFileSize(selectedFile.size)} | 유형: {isZip ? 'application/zip' : (selectedFile.type || 'image/jpeg')}
                    </p>
                  </div>

                  <button
                    onClick={onClearFile}
                    disabled={isTranslating}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
                    title="선택 취소"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                      {isDeepL ? (
                        <>
                          <Zap className="w-3.5 h-3.5 text-accent-400" />
                          <span>DeepL API 고품질 신경망 번역 모드</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                          <span>Google Gemini 1.5 Flash 비전 번역 모드</span>
                        </>
                      )}
                    </p>
                    {hasActiveKey ? (
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        ● {isDeepL ? 'DeepL API 키 설정됨' : 'Gemini API 키 설정됨'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                      >
                        ⚠️ {isDeepL ? 'DeepL' : 'Gemini'} API 키 설정 필요
                      </button>
                    )}
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {isDeepL
                      ? '이미지 내 일본어 말풍선과 원문 대사를 추출한 뒤 DeepL 공식 무료 엔드포인트(api-free.deepl.com)로 일괄 번역하여 HTML5 Canvas로 한글 폰트를 식자 합성합니다.'
                      : 'Google Gemini 1.5 Flash 모델이 말풍선 영역(0-1000) 감지와 번역을 수행하며, 무검열(BLOCK_NONE) 및 2초 순차 요청 딜레이 안전장치가 적용됩니다.'}
                  </p>
                </div>
              </div>

              {/* Start Button */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClearFile}
                  disabled={isTranslating}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition disabled:opacity-50"
                >
                  다른 파일 선택
                </button>
                <button
                  type="button"
                  onClick={onStartTranslate}
                  disabled={isTranslating || isPacking}
                  className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition shadow-lg flex items-center space-x-2 disabled:opacity-50 cursor-pointer bg-gradient-to-r from-brand-600 via-indigo-600 to-accent-600 hover:from-brand-500 hover:via-indigo-500 hover:to-accent-500 shadow-brand-500/25"
                >
                  {isDeepL ? (
                    <Zap className="w-4 h-4 text-white" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {isZip
                      ? `${isDeepL ? 'DeepL로' : 'Gemini로'} ZIP 전체 일괄 번역 시작`
                      : `${isDeepL ? 'DeepL로' : 'Gemini로'} 한국어 번역 & 식자 시작`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
