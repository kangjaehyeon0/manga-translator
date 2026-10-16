import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import TranslationProgress from './components/TranslationProgress';
import ComparisonViewer from './components/ComparisonViewer';
import ApiKeyModal from './components/ApiKeyModal';
import { AlertTriangle, Sparkles, Server, Globe } from 'lucide-react';
import { translateMangaImage, normalizeBackendUrl } from './services/mangaBackendService';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [translatedUrl, setTranslatedUrl] = useState(null);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 진행 상태 세부 정보
  const [currentProgressPage, setCurrentProgressPage] = useState(0);
  const [progressText, setProgressText] = useState('');

  // ZIP / 멀티페이지 관련 상태
  const [zipDetails, setZipDetails] = useState(null); // { pageCount, originalPages: [{ name, url, blob }] }
  const [pages, setPages] = useState([]); // [{ name, originalUrl, translatedUrl, isFailed }]
  const [zipDownloadUrl, setZipDownloadUrl] = useState(null);
  const [failedCount, setFailedCount] = useState(0);

  // Object URL 추적 (메모리 누수 방지용)
  const createdUrlsRef = useRef([]);
  const registerUrl = (url) => {
    if (url && !createdUrlsRef.current.includes(url)) {
      createdUrlsRef.current.push(url);
    }
    return url;
  };
  const revokeAllUrls = () => {
    createdUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {}
    });
    createdUrlsRef.current = [];
  };

  // 백엔드 API URL 및 전송 설정 상태 관리 (LocalStorage 저장)
  const [backendUrl, setBackendUrl] = useState(
    () => localStorage.getItem('MANGA_BACKEND_URL') || ''
  );
  const [targetLang, setTargetLang] = useState(
    () => localStorage.getItem('MANGA_TARGET_LANG') || 'KOR'
  );
  const [detector, setDetector] = useState(
    () => localStorage.getItem('MANGA_DETECTOR') || 'default'
  );
  const [direction, setDirection] = useState(
    () => localStorage.getItem('MANGA_DIRECTION') || 'auto'
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSaveBackendUrl = (url) => {
    const clean = normalizeBackendUrl(url);
    setBackendUrl(clean);
    if (clean) {
      localStorage.setItem('MANGA_BACKEND_URL', clean);
    } else {
      localStorage.removeItem('MANGA_BACKEND_URL');
    }
  };

  const handleSaveTargetLang = (lang) => {
    setTargetLang(lang);
    localStorage.setItem('MANGA_TARGET_LANG', lang);
  };

  const handleSaveDetector = (det) => {
    setDetector(det);
    localStorage.setItem('MANGA_DETECTOR', det);
  };

  const handleSaveDirection = (dir) => {
    setDirection(dir);
    localStorage.setItem('MANGA_DIRECTION', dir);
  };

  const handleSelectFile = async (file) => {
    revokeAllUrls();
    setSelectedFile(file);
    setErrorMsg('');
    setTranslatedUrl(null);
    setPages([]);
    setZipDownloadUrl(null);
    setZipDetails(null);
    setFailedCount(0);

    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type?.includes('zip');

    if (isZip) {
      try {
        const zip = await JSZip.loadAsync(file);
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const imageEntries = [];

        zip.forEach((relativePath, entry) => {
          if (!entry.dir && !relativePath.startsWith('__MACOSX') && !relativePath.split('/').pop().startsWith('.')) {
            const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
            if (validExtensions.includes(ext)) {
              imageEntries.push(entry);
            }
          }
        });

        // 파일명 자연스러운 순서로 정렬
        imageEntries.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        if (imageEntries.length === 0) {
          setErrorMsg('선택하신 ZIP 압축 파일 안에 처리 가능한 이미지(JPG, PNG, WebP)가 없습니다.');
          return;
        }

        // 이미지 blob 및 object url 추출
        const originalPages = [];
        for (let i = 0; i < imageEntries.length; i++) {
          const entry = imageEntries[i];
          const blob = await entry.async('blob');
          const cleanName = entry.name.split('/').pop();
          const url = registerUrl(URL.createObjectURL(blob));
          originalPages.push({ name: cleanName, url, blob });
        }

        setZipDetails({
          pageCount: originalPages.length,
          originalPages,
        });

        // 첫 번째 페이지를 미리보기로 설정
        setPreviewUrl(originalPages[0].url);
      } catch (err) {
        console.error('[Manga Translator] ZIP 파싱 오류 상세:', err);
        setErrorMsg('ZIP 파일 형식을 읽는 중 오류가 발생했습니다. 정상적인 압축 파일인지 확인해주세요.');
      }
    } else {
      // 단일 이미지
      const url = registerUrl(URL.createObjectURL(file));
      setPreviewUrl(url);
    }
  };

  const handleClearFile = () => {
    revokeAllUrls();
    setSelectedFile(null);
    setPreviewUrl(null);
    setTranslatedUrl(null);
    setPages([]);
    setZipDownloadUrl(null);
    setZipDetails(null);
    setFailedCount(0);
    setErrorMsg('');
    setDialogueCount(0);
    setCurrentProgressPage(0);
    setProgressText('');
  };

  // 샘플 만화 이미지 생성
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 패널 테두리 스타일
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;

    // 패널 1 (상단)
    ctx.strokeRect(40, 40, 820, 520);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(43, 43, 814, 514);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(450, 420, 160, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(450, 300);
      ctx.lineTo(40 + i * 43, 40);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(230, 160, 160, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("I can't believe this!", 230, 145);
    ctx.fillText('The power is overwhelming!', 230, 180);

    ctx.beginPath();
    ctx.ellipse(680, 200, 140, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillText('Wait...', 680, 185);
    ctx.fillText('Is this real?!', 680, 220);

    // 패널 2 (하단)
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 600, 820, 560);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(43, 603, 814, 554);

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(450, 780, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(450, 980, 260, 110, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText("Let's finish this now!", 450, 955);
    ctx.fillText('Manga Translation Engine!', 450, 1005);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'sample_manga_page.jpg', { type: 'image/jpeg' });
        handleSelectFile(file);
      }
    }, 'image/jpeg', 0.95);
  };

  // 외부 manga-image-translator 백엔드 API 연동 파이프라인
  const handleStartTranslate = async () => {
    if (!selectedFile) return;

    // 1. 백엔드 주소 유효성 검사
    const cleanBackendUrl = normalizeBackendUrl(backendUrl);
    if (!cleanBackendUrl) {
      setErrorMsg('백엔드 서버 주소를 확인해주세요 (Google Colab 또는 로컬 서버 실행 필요)');
      setIsSettingsOpen(true);
      return;
    }

    setIsTranslating(true);
    setErrorMsg('');
    setCurrentProgressPage(0);
    setProgressText('백엔드 서버에 연결하여 번역 작업을 준비하고 있습니다...');

    const isZip = Boolean(zipDetails);

    try {
      if (isZip) {
        // ========== ZIP 다중 이미지 순차 백엔드 전송 및 교체 ==========
        const originalPages = zipDetails.originalPages || [];
        const outZip = new JSZip();
        let failedNum = 0;
        const matchedPages = [];

        for (let i = 0; i < originalPages.length; i++) {
          const page = originalPages[i];
          setCurrentProgressPage(i + 1);
          setProgressText(
            `${i + 1} / ${originalPages.length} 페이지 번역 중... (${page.name} 백엔드 전송)`
          );

          try {
            // 백엔드 엔드포인트({backend_url}/run 또는 {backend_url}/translate)로 이미지 전송
            const translatedBlob = await translateMangaImage({
              backendUrl: cleanBackendUrl,
              imageBlob: page.blob,
              fileName: page.name,
              targetLang,
              detector,
              direction,
            });

            // 반환받은 식자 완료된 바이너리 이미지(Blob)를 결과 뷰어와 최종 ZIP 다운로드 파일에 교체
            const pageTranslatedUrl = registerUrl(URL.createObjectURL(translatedBlob));
            outZip.file(page.name, translatedBlob);

            matchedPages.push({
              name: page.name,
              originalUrl: page.url,
              translatedUrl: pageTranslatedUrl,
              isFailed: false,
            });
          } catch (pageErr) {
            console.error(`[Manga Translator] '${page.name}' 페이지 백엔드 번역 실패:`, {
              fileName: page.name,
              error: pageErr,
              status: pageErr.status,
              statusText: pageErr.statusText,
              details: pageErr.details,
            });

            // 첫 페이지에서 서버 연결 자체가 실패(Failed to fetch)한 경우 즉시 중단하고 안내
            if (pageErr.isConnectionFailed || pageErr.isBackendUrlMissing) {
              throw pageErr;
            }

            // 개별 페이지 오류 시 원본 보존 및 실패 플래그 설정
            failedNum++;
            outZip.file(`failed_${page.name}`, page.blob);

            matchedPages.push({
              name: page.name,
              originalUrl: page.url,
              translatedUrl: page.url,
              isFailed: true,
              errorMsg: pageErr.message,
            });
          }
        }

        setProgressText('최종 번역 결과 ZIP 아카이브를 패키징하는 중...');
        const outZipBlob = await outZip.generateAsync({ type: 'blob' });
        const downloadZipUrl = registerUrl(URL.createObjectURL(outZipBlob));

        setZipDownloadUrl(downloadZipUrl);
        setPages(matchedPages);
        setDialogueCount(matchedPages.length - failedNum);
        setFailedCount(failedNum);

        if (matchedPages.length > 0) {
          // 첫 번째 성공한 페이지 또는 첫 페이지를 뷰어에 표시
          const firstSuccess = matchedPages.find((p) => !p.isFailed) || matchedPages[0];
          setTranslatedUrl(firstSuccess.translatedUrl);
        }

        if (failedNum > 0) {
          setErrorMsg(`총 ${originalPages.length}장 중 ${failedNum}장의 처리가 실패했습니다. 원본 이미지가 보존되었습니다.`);
        }
      } else {
        // ========== 단일 이미지 백엔드 전송 및 식자 교체 ==========
        setProgressText('manga-image-translator 백엔드로 이미지 전송 및 번역/식자 처리 중...');

        const translatedBlob = await translateMangaImage({
          backendUrl: cleanBackendUrl,
          imageBlob: selectedFile,
          fileName: selectedFile.name,
          targetLang,
          detector,
          direction,
        });

        // 식자 완료된 바이너리 이미지(Blob)를 결과 뷰어에 연결
        const objectUrl = registerUrl(URL.createObjectURL(translatedBlob));

        // 단일 이미지도 ZIP 패키징 다운로드 지원
        const singleZip = new JSZip();
        const baseName = (selectedFile.name || 'comic').replace(/\.[^/.]+$/, '');
        const extension = translatedBlob.type.includes('png') ? 'png' : 'jpg';
        singleZip.file(`${baseName}_translated.${extension}`, translatedBlob);
        const singleZipBlob = await singleZip.generateAsync({ type: 'blob' });
        const singleZipUrl = registerUrl(URL.createObjectURL(singleZipBlob));

        setZipDownloadUrl(singleZipUrl);
        setDialogueCount(1);
        setTranslatedUrl(objectUrl);
      }
    } catch (err) {
      console.error('[Manga Translator] 백엔드 통신 오류 상세 객체:', {
        message: err.message,
        status: err.status,
        statusText: err.statusText,
        details: err.details,
        isConnectionFailed: err.isConnectionFailed,
        isBackendUrlMissing: err.isBackendUrlMissing,
        error: err,
        stack: err.stack,
      });

      // 백엔드 주소가 비어있거나 서버 연결에 실패할 경우 지정된 명확한 에러 안내
      if (err.isConnectionFailed || err.isBackendUrlMissing || err.name === 'TypeError' || err.message?.includes('Failed to fetch')) {
        setErrorMsg('백엔드 서버 주소를 확인해주세요 (Google Colab 또는 로컬 서버 실행 필요)');
        setIsSettingsOpen(true);
      } else {
        setErrorMsg(err.message || '번역 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsTranslating(false);
      setProgressText('');
    }
  };

  const isZip =
    selectedFile &&
    (selectedFile.name.toLowerCase().endsWith('.zip') ||
      selectedFile.type?.includes('zip') ||
      Boolean(zipDetails));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-radial-gradient">
      {/* Navigation Header */}
      <Header
        backendUrl={backendUrl}
        onOpenKeyModal={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        {!translatedUrl && !isTranslating && (
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
              <Server className="w-3.5 h-3.5" />
              <span>manga-image-translator 외부 고성능 식자 백엔드 연동</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              만화 대사 인식부터 번역과 식자까지{' '}
              <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-accent-400 bg-clip-text text-transparent">
                외부 AI 서버 연동 완성
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Google Colab 또는 로컬 환경(ngrok)에 실행 중인{' '}
              <strong className="text-brand-300">manga-image-translator</strong> 서버와 통신하여,
              원문 말풍선을 자동 감지·지우고 한국어(KOR) 고품질 식자가 합성된 이미지를 받아옵니다.
              <br />
              <strong className="text-slate-200">
                단일 이미지 및 ZIP 대용량 압축 파일 순차 일괄 처리 지원!
              </strong>
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="max-w-4xl mx-auto mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">안내 및 처리 오류</p>
              <p className="text-xs sm:text-sm text-rose-300 font-medium mt-0.5 leading-relaxed">
                {errorMsg}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                * 상세한 네트워크 응답 및 에러 상태는 브라우저 개발자 도구 콘솔(F12)에 기록되었습니다.
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
              >
                백엔드 설정 열기
              </button>
            </div>
          </div>
        )}

        {/* State 1: Translation In Progress */}
        {isTranslating && (
          <TranslationProgress
            isZip={isZip}
            pageCount={zipDetails?.pageCount}
            currentPage={currentProgressPage}
            progressText={progressText}
            backendUrl={backendUrl}
          />
        )}

        {/* State 2: Result Comparison Viewer */}
        {!isTranslating && translatedUrl && (
          <ComparisonViewer
            originalUrl={previewUrl}
            translatedUrl={translatedUrl}
            dialogueCount={dialogueCount}
            onReset={handleClearFile}
            pages={pages}
            zipDownloadUrl={zipDownloadUrl}
            zipFileName={`translated_${selectedFile?.name || 'manga.zip'}`}
            failedCount={failedCount}
            safetyBlockedCount={0}
          />
        )}

        {/* State 3: Upload & Config Interface */}
        {!isTranslating && !translatedUrl && (
          <div className="space-y-6">
            <ImageUploader
              selectedFile={selectedFile}
              previewUrl={previewUrl}
              onSelectFile={handleSelectFile}
              onClearFile={handleClearFile}
              onStartTranslate={handleStartTranslate}
              onLoadSample={handleLoadSample}
              zipPageCount={zipDetails?.pageCount}
              backendUrl={backendUrl}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Backend API Configuration Modal */}
      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backendUrl={backendUrl}
        onSaveBackendUrl={handleSaveBackendUrl}
        targetLang={targetLang}
        onSaveTargetLang={handleSaveTargetLang}
        detector={detector}
        onSaveDetector={handleSaveDetector}
        direction={direction}
        onSaveDirection={handleSaveDirection}
      />
    </div>
  );
}
