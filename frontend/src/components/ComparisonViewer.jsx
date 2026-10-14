import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  RotateCcw,
  Columns,
  SplitSquareVertical,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Archive,
  Layers,
  FileImage,
  AlertTriangle,
  Info,
} from 'lucide-react';

export default function ComparisonViewer({
  originalUrl,
  translatedUrl,
  dialogueCount,
  onReset,
  // ZIP / Multi-Page 지원 props
  pages = [],
  zipDownloadUrl = null,
  zipFileName = 'translated_comics.zip',
  failedCount = 0,
  safetyBlockedCount = 0,
}) {
  const isMultiPage = pages && pages.length > 0;
  const [pageIndex, setPageIndex] = useState(0);
  const [viewMode, setViewMode] = useState('sideBySide'); // 'sideBySide' | 'slider'
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const sliderContainerRef = useRef(null);

  // 현재 표시할 이미지 정보
  const currentPage = isMultiPage ? pages[pageIndex] : null;
  const activeOriginalUrl = isMultiPage ? currentPage?.originalUrl : originalUrl;
  const activeTranslatedUrl = isMultiPage ? currentPage?.translatedUrl : translatedUrl;
  const activePageName = isMultiPage ? currentPage?.name : 'translated.jpg';
  const isCurrentPageFailed = isMultiPage && currentPage?.isFailed;
  const isCurrentPageSafetyBlocked = isMultiPage && currentPage?.isSafetyBlocked;

  // 슬라이더 드래그 핸들러
  const handleSliderMove = (clientX) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleMouseDown = () => setIsDraggingSlider(true);
  const handleTouchStart = () => setIsDraggingSlider(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDraggingSlider(false);
    const handleMouseMove = (e) => {
      if (isDraggingSlider) handleSliderMove(e.clientX);
    };
    const handleTouchMove = (e) => {
      if (isDraggingSlider && e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDraggingSlider]);

  // 키보드 좌우 방향키로 페이지 넘김 지원
  useEffect(() => {
    if (!isMultiPage) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' && pageIndex > 0) {
        setPageIndex((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && pageIndex < pages.length - 1) {
        setPageIndex((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMultiPage, pageIndex, pages.length]);

  // 단일 페이지 다운로드
  const handleDownloadSingle = () => {
    if (!activeTranslatedUrl) return;
    const a = document.createElement('a');
    a.href = activeTranslatedUrl;
    const cleanName = activePageName ? activePageName.replace(/\.[^/.]+$/, '') : 'translated_page';
    a.download = `${cleanName}_translated.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 전체 ZIP 다운로드
  const handleDownloadZip = () => {
    if (!zipDownloadUrl) return;
    const a = document.createElement('a');
    a.href = zipDownloadUrl;
    a.download = zipFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Toolbar */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>식자 합성 완료</span>
          </span>

          {dialogueCount !== undefined && (
            <span className="text-xs text-slate-400 font-medium">
              감지된 총 대사: <strong className="text-white">{dialogueCount}개</strong>
            </span>
          )}

          {isMultiPage && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>총 {pages.length}개 페이지</span>
            </span>
          )}

          {failedCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{failedCount}개 페이지 실패 (원본 유지)</span>
            </span>
          )}

          {safetyBlockedCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{safetyBlockedCount}개 페이지 안전 필터 감지 (로컬 대체 식자 적용)</span>
            </span>
          )}
        </div>

        {/* View Mode & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center space-x-1">
            <button
              onClick={() => setViewMode('sideBySide')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'sideBySide'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>좌우 비교</span>
            </button>
            <button
              onClick={() => setViewMode('slider')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'slider'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>슬라이더 비교</span>
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>새 번역</span>
          </button>

          {/* Multi-Page ZIP: 전체 ZIP 다운로드 */}
          {zipDownloadUrl && (
            <button
              onClick={handleDownloadZip}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-md shadow-amber-600/25 transition cursor-pointer"
              title="번역 완료된 전체 이미지를 압축된 ZIP 파일로 다운로드합니다"
            >
              <Archive className="w-4 h-4" />
              <span>전체 ZIP 다운로드</span>
            </button>
          )}

          {/* 단일 페이지 다운로드 */}
          <button
            onClick={handleDownloadSingle}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition cursor-pointer ${
              zipDownloadUrl
                ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/25'
            }`}
            title="현재 화면에 보이는 페이지만 JPG 이미지로 다운로드합니다"
          >
            <Download className="w-4 h-4" />
            <span>{isMultiPage ? '현재 페이지 다운로드' : '번역 이미지 다운로드'}</span>
          </button>
        </div>
      </div>

      {/* Partial Failure Warning Banner */}
      {failedCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-3 shadow-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1 leading-relaxed space-y-1">
            <p>
              <strong className="text-amber-100">일부 페이지 처리 안내:</strong> 전체 {pages.length}장 중 <strong>{failedCount}개 페이지</strong>의 번역 처리에 실패하여 원본 이미지가 그대로 유지되었습니다. ZIP 파일 내에도 원본 상태로 안전하게 보존되었습니다.
            </p>
            {pages.some((p) => p.errorMsg) && (
              <div className="p-2 bg-slate-950/80 rounded-lg text-[11px] font-mono text-amber-300 border border-amber-500/20 break-all">
                ⚠️ API 오류 사유: {pages.find((p) => p.errorMsg)?.errorMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Page No-Dialogue Banner */}
      {!isMultiPage && dialogueCount === 0 && (
        <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs flex items-center space-x-2.5">
          <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span>이미지 내에서 감지된 말풍선 대사가 없습니다 (원본 이미지 보존).</span>
        </div>
      )}

      {/* Multi-Page Pagination Bar */}
      {isMultiPage && (
        <div className="glass-panel rounded-2xl p-3 px-5 flex items-center justify-between gap-4 border border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="이전 페이지 (단축키: ←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm font-bold text-white px-2">
              <span className="text-brand-400">{pageIndex + 1}</span> / {pages.length} 페이지
            </div>
            <button
              onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
              disabled={pageIndex === pages.length - 1}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="다음 페이지 (단축키: →)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden sm:flex items-center text-xs text-slate-400 truncate max-w-md gap-2">
            <FileImage className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">파일명: {activePageName}</span>
            {isCurrentPageFailed && (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  번역 실패
                </span>
                {currentPage?.errorMsg && (
                  <span className="text-[10px] text-amber-400/90 font-mono truncate max-w-[180px]" title={currentPage.errorMsg}>
                    ({currentPage.errorMsg})
                  </span>
                )}
              </div>
            )}
            {isCurrentPageSafetyBlocked && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <AlertTriangle className="w-3 h-3 mr-1 text-rose-400" />
                안전 필터 감지 (로컬 대체 식자 적용)
              </span>
            )}
          </div>

          {/* Quick Page Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-xs py-1">
            {pages.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPageIndex(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold flex-shrink-0 transition relative ${
                  pageIndex === idx
                    ? 'bg-brand-600 text-white shadow-md'
                    : p.isFailed
                    ? 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/40'
                    : p.isSafetyBlocked
                    ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white'
                }`}
                title={
                  p.isFailed
                    ? `${idx + 1}페이지: 번역 실패 (원본 유지)`
                    : p.isSafetyBlocked
                    ? `${idx + 1}페이지: 안전 필터 감지 (로컬 대체 식자)`
                    : `${idx + 1}페이지`
                }
              >
                {idx + 1}
                {p.isFailed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
                )}
                {p.isSafetyBlocked && !p.isFailed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-400 ring-2 ring-slate-950" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Comparison Area */}
      {viewMode === 'sideBySide' ? (
        /* Side by Side Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Original */}
          <div className="glass-panel rounded-3xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                원본 이미지
              </span>
              <span className="text-[11px] text-slate-400">
                {isMultiPage ? `Page ${pageIndex + 1}` : 'Original Manga'}
              </span>
            </div>
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center min-h-[450px]">
              {activeOriginalUrl ? (
                <img
                  src={activeOriginalUrl}
                  alt="원본 만화"
                  className="w-full h-auto max-h-[75vh] object-contain select-none"
                />
              ) : (
                <div className="text-xs text-slate-400">원본 이미지 로드 중...</div>
              )}
            </div>
          </div>

          {/* Right: Translated */}
          <div className={`glass-panel rounded-3xl p-4 flex flex-col space-y-3 ${
            isCurrentPageFailed ? 'border-amber-500/40' : 'border-brand-500/30'
          }`}>
            <div className="flex items-center justify-between px-2">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 ${
                isCurrentPageFailed ? 'text-amber-400' : 'text-brand-400'
              }`}>
                {isCurrentPageFailed ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>번역 실패 (원본 보존됨)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>한국어 번역본 (식자 완료)</span>
                  </>
                )}
              </span>
              <span className="text-[11px] text-slate-500">
                {isCurrentPageFailed ? 'Original Kept' : 'Korean Typeset'}
              </span>
            </div>
            <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center min-h-[450px]">
              {activeTranslatedUrl ? (
                <img
                  src={activeTranslatedUrl}
                  alt="번역된 만화"
                  className="w-full h-auto max-h-[75vh] object-contain select-none"
                />
              ) : (
                <div className="text-xs text-slate-400">번역 이미지 로드 중...</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Slider Comparison Mode */
        <div className="glass-panel rounded-3xl p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-slate-400 font-medium">
              슬라이더를 좌우로 드래그하여 원본과 번역본을 실시간 비교해보세요.
            </span>
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-slate-400">◀ 원본 (Original)</span>
              <span className={isCurrentPageFailed ? 'text-amber-400 font-semibold' : 'text-brand-400 font-semibold'}>
                {isCurrentPageFailed ? '번역 실패 (원본 보존) ▶' : '번역본 (Korean) ▶'}
              </span>
            </div>
          </div>

          <div
            ref={sliderContainerRef}
            className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-ew-resize select-none min-h-[500px] flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Translated Image (Bottom Layer) */}
            {activeTranslatedUrl && (
              <img
                src={activeTranslatedUrl}
                alt="번역된 만화"
                className="w-full h-auto max-h-[80vh] object-contain pointer-events-none"
              />
            )}

            {/* Original Image (Top Layer, Clipped) */}
            {activeOriginalUrl && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={activeOriginalUrl}
                  alt="원본 만화"
                  className="w-full h-full max-h-[80vh] object-contain pointer-events-none"
                  style={{
                    width: sliderContainerRef.current ? `${sliderContainerRef.current.clientWidth}px` : '100%',
                    maxWidth: 'none',
                  }}
                />
              </div>
            )}

            {/* Divider Line & Handle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-slate-900 shadow-xl flex items-center justify-center text-xs font-bold">
                ↔
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
