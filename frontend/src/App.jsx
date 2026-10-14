import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import TranslationProgress from './components/TranslationProgress';
import ComparisonViewer from './components/ComparisonViewer';
import ApiKeyModal, { GEMINI_MODELS } from './components/ApiKeyModal';
import { AlertTriangle, Sparkles, BookOpen, Cpu, ShieldCheck, Zap } from 'lucide-react';
import { detectAndTranslateWithGemini } from './services/geminiService';
import { typesetComicImage, generateFreeModeDetections } from './services/canvasTypesetter';

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

  // API Key 및 모델, 무료 모드 State (백엔드 통신 없음 - 100% 브라우저 로컬 스토리지 보관)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('GEMINI_MODEL') || 'gemini-1.5-flash'
  );
  const [isFreeMode, setIsFreeMode] = useState(
    () => localStorage.getItem('MANGA_FREE_MODE') === 'true'
  );
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('GEMINI_API_KEY', key);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
  };

  const handleSaveModel = (model) => {
    setSelectedModel(model);
    if (model) {
      localStorage.setItem('GEMINI_MODEL', model);
    }
  };

  const handleToggleFreeMode = (enabled) => {
    setIsFreeMode(enabled);
    localStorage.setItem('MANGA_FREE_MODE', enabled ? 'true' : 'false');
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

  // 100% 브라우저(클라이언트) 내부 번역 및 식자 합성 파이프라인
  const handleStartTranslate = async () => {
    if (!selectedFile) return;

    // 무료 모드가 아닌 경우 API 키 입력 필수 확인
    if (!isFreeMode && !apiKey.trim()) {
      setIsKeyModalOpen(true);
      setErrorMsg('번역을 시작하려면 Gemini API 키를 입력하거나, 무료 모드를 켜주세요.');
      return;
    }

    setIsTranslating(true);
    setErrorMsg('');
    setCurrentProgressPage(0);
    setProgressText('번역 작업을 시작합니다...');

    const isZip = Boolean(zipDetails);

    try {
      if (isZip) {
        // ========== ZIP 다중 페이지 브라우저 클라이언트 일괄 처리 ==========
        const originalPages = zipDetails.originalPages || [];
        const outZip = new JSZip();
        let totalDialogues = 0;
        let failedNum = 0;
        const matchedPages = [];

        for (let i = 0; i < originalPages.length; i++) {
          const page = originalPages[i];
          setCurrentProgressPage(i + 1);
          setProgressText(`${i + 1} / ${originalPages.length} 페이지 번역 및 식자 합성 중...`);

          if (isFreeMode) {
            // 무료 모드: 로컬 캔버스 합성 파이프라인
            const detections = generateFreeModeDetections();
            const translatedBlob = await typesetComicImage(page.blob, detections);
            outZip.file(page.name, translatedBlob);
            const pageTranslatedUrl = registerUrl(URL.createObjectURL(translatedBlob));
            totalDialogues += detections.length;

            matchedPages.push({
              name: page.name,
              originalUrl: page.url,
              translatedUrl: pageTranslatedUrl,
              isFailed: false,
            });
          } else {
            // Gemini 모드: 공식 API 직접 호출 및 Canvas 식자
            try {
              const detections = await detectAndTranslateWithGemini({
                apiKey,
                model: selectedModel,
                imageBlob: page.blob,
              });

              const translatedBlob = await typesetComicImage(page.blob, detections);
              outZip.file(page.name, translatedBlob);
              const pageTranslatedUrl = registerUrl(URL.createObjectURL(translatedBlob));
              totalDialogues += detections.length;

              matchedPages.push({
                name: page.name,
                originalUrl: page.url,
                translatedUrl: pageTranslatedUrl,
                isFailed: false,
              });
            } catch (pageErr) {
              console.error(`[Manga Translator] '${page.name}' 페이지 처리 중 오류 발생:`, pageErr);
              failedNum++;
              outZip.file(`failed_${page.name}`, page.blob);

              matchedPages.push({
                name: page.name,
                originalUrl: page.url,
                translatedUrl: page.url,
                isFailed: true,
              });
            }
          }
        }

        setProgressText('최종 번역 결과 ZIP 아카이브를 패키징하는 중...');
        const outZipBlob = await outZip.generateAsync({ type: 'blob' });
        const downloadZipUrl = registerUrl(URL.createObjectURL(outZipBlob));

        setZipDownloadUrl(downloadZipUrl);
        setPages(matchedPages);
        setDialogueCount(totalDialogues);
        setFailedCount(failedNum);

        if (matchedPages.length > 0) {
          setTranslatedUrl(matchedPages[0].translatedUrl);
        }
      } else {
        // ========== 단일 이미지 브라우저 클라이언트 처리 ==========
        setProgressText(
          isFreeMode
            ? '무료 모드로 로컬 Canvas 식자 합성 중...'
            : `${selectedModel}로 만화 대사 및 말풍선 감지 중...`
        );

        let detections;
        if (isFreeMode) {
          // 무료 모드: 가상 말풍선 및 대사 생성
          detections = generateFreeModeDetections();
        } else {
          // Gemini 모드: Google 공식 엔드포인트 직접 호출
          detections = await detectAndTranslateWithGemini({
            apiKey,
            model: selectedModel,
            imageBlob: selectedFile,
          });
        }

        setProgressText('말풍선 배경 마스킹 및 한글 폰트 자동 식자 합성 중...');
        const translatedBlob = await typesetComicImage(selectedFile, detections);
        const objectUrl = registerUrl(URL.createObjectURL(translatedBlob));

        setDialogueCount(detections.length);
        setTranslatedUrl(objectUrl);
      }
    } catch (err) {
      // 3. 처리 실패 시 개발자 콘솔(console.error)에 실제 구체적 에러 객체 출력
      console.error('[Manga Translator] 번역 처리 중 상세 오류 객체:', {
        message: err.message,
        status: err.status,
        statusText: err.statusText,
        details: err.details,
        error: err,
        stack: err.stack,
      });

      let displayMessage = err.message || '번역 처리 중 오류가 발생했습니다.';
      if (err.status === 403 || err.status === 400) {
        displayMessage = `${displayMessage} (Gemini API 키가 올바른지 확인해주세요.)`;
      } else if (err.status === 429) {
        displayMessage = 'Gemini API 호출 한도(Quota)를 초과했습니다. 잠시 후 다시 시도하거나 무료 모드를 사용해주세요.';
      }

      setErrorMsg(displayMessage);
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

  const currentModelObj = GEMINI_MODELS.find((m) => m.id === selectedModel) || GEMINI_MODELS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-radial-gradient">
      {/* Navigation Header */}
      <Header
        hasApiKey={Boolean(apiKey)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
        selectedModel={selectedModel}
        isFreeMode={isFreeMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        {!translatedUrl && !isTranslating && (
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Comic Typesetting with {isFreeMode ? '무료 로컬 엔진' : currentModelObj.name}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              만화 대사 인식부터 번역과 식자까지{' '}
              <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-accent-400 bg-clip-text text-transparent">
                100% 브라우저 완성
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {isFreeMode ? (
                <span className="text-emerald-400 font-medium">
                  ⚡ 무료 모드 활성화 중: 백엔드 서버 없이 브라우저 HTML5 Canvas만으로 즉시 번역 & 식자 합성 체험이 가능합니다.
                </span>
              ) : (
                <span>
                  브라우저에서 Google Gemini API 공식 엔드포인트로 직접 연결하여 말풍선 영역(0~1000)을 정밀 감지하고,
                  HTML5 Canvas에서 원문 대사를 나눔고딕으로 완벽하게 식자 합성합니다.
                </span>
              )}
              <br />
              <strong className="text-brand-300">
                서버 설치 불필요 • ZIP 대용량 압축 파일 및 이미지 일괄 번역 지원!
              </strong>
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="max-w-4xl mx-auto mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-200">처리 오류</p>
              <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed">{errorMsg}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                * 상세한 네트워크 및 API 오류 내용은 브라우저 개발자 도구 콘솔(F12)을 확인해주세요.
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  handleToggleFreeMode(true);
                  setErrorMsg('');
                }}
                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-medium transition"
              >
                무료 모드로 전환
              </button>
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-medium transition"
              >
                설정 열기
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
            selectedModel={selectedModel}
            isFreeMode={isFreeMode}
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
            />
          </div>
        )}
      </main>

      {/* API Key & Model Configuration Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        currentKey={apiKey}
        onSaveKey={handleSaveApiKey}
        currentModel={selectedModel}
        onSaveModel={handleSaveModel}
        isFreeMode={isFreeMode}
        onToggleFreeMode={handleToggleFreeMode}
      />
    </div>
  );
}
