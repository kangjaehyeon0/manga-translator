import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import TranslationProgress from './components/TranslationProgress';
import ComparisonViewer from './components/ComparisonViewer';
import ApiKeyModal from './components/ApiKeyModal';
import { AlertTriangle, Sparkles, BookOpen, Cpu, ShieldCheck } from 'lucide-react';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [translatedUrl, setTranslatedUrl] = useState(null);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ZIP / 멀티페이지 관련 상태
  const [zipDetails, setZipDetails] = useState(null); // { pageCount, originalPages: [{ name, url, blob }] }
  const [pages, setPages] = useState([]); // [{ name, originalUrl, translatedUrl }]
  const [zipDownloadUrl, setZipDownloadUrl] = useState(null);
  const [failedCount, setFailedCount] = useState(0);

  // Object URL 추적 (메모리 정리용)
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

  // API Key State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [serverHasKey, setServerHasKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // 서버 상태 및 키 설정 여부 확인
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.has_api_key) {
          setServerHasKey(true);
        }
      })
      .catch((err) => {
        console.warn('Backend health check warning:', err);
      });
  }, []);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('GEMINI_API_KEY', key);
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
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
        console.error('ZIP 파싱 오류:', err);
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
    ctx.fillText("The power is overwhelming!", 230, 180);

    ctx.beginPath();
    ctx.ellipse(680, 200, 140, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillText("Wait...", 680, 185);
    ctx.fillText("Is this real?!", 680, 220);

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
    ctx.fillText("Antigravity Translation System Go!", 450, 1005);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'sample_manga_page.jpg', { type: 'image/jpeg' });
        handleSelectFile(file);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleStartTranslate = async () => {
    if (!selectedFile) return;

    // API 키 확인
    if (!apiKey && !serverHasKey) {
      setIsKeyModalOpen(true);
      setErrorMsg('번역을 시작하려면 Gemini API 키가 필요합니다. 상단 또는 팝업에서 키를 입력해주세요.');
      return;
    }

    setIsTranslating(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const headers = {};
      if (apiKey) {
        headers['X-Gemini-Api-Key'] = apiKey;
      }

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      if (!response.ok) {
        let errText = '번역 요청에 실패했습니다.';
        try {
          const errData = await response.json();
          errText = errData.detail || errText;
        } catch (_) {
          errText = await response.text();
        }
        throw new Error(errText);
      }

      // 응답 헤더 확인
      const countHeader = response.headers.get('X-Dialogue-Count');
      if (countHeader) {
        setDialogueCount(parseInt(countHeader, 10) || 0);
      }

      const failedHeader = response.headers.get('X-Failed-Count');
      const failedNum = failedHeader ? parseInt(failedHeader, 10) || 0 : 0;
      setFailedCount(failedNum);

      const isZipResponse =
        response.headers.get('X-Is-Zip') === 'true' ||
        selectedFile.name.toLowerCase().endsWith('.zip') ||
        Boolean(zipDetails);

      const blob = await response.blob();

      if (isZipResponse) {
        // ZIP 응답 언팩 처리
        const downloadZipUrl = registerUrl(URL.createObjectURL(blob));
        setZipDownloadUrl(downloadZipUrl);

        try {
          const outZip = await JSZip.loadAsync(blob);
          const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
          const outEntries = [];

          outZip.forEach((relativePath, entry) => {
            if (!entry.dir && !relativePath.startsWith('__MACOSX') && !relativePath.split('/').pop().startsWith('.')) {
              const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
              if (validExtensions.includes(ext)) {
                outEntries.push(entry);
              }
            }
          });

          // 파일명 자연스러운 순서로 정렬
          outEntries.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          );

          const matchedPages = [];
          const origList = zipDetails?.originalPages || [];

          for (let i = 0; i < outEntries.length; i++) {
            const outEntry = outEntries[i];
            const cleanName = outEntry.name.split('/').pop();
            const isFailed = cleanName.startsWith('failed_') || cleanName.startsWith('error_');
            const outBlob = await outEntry.async('blob');
            const transUrl = registerUrl(URL.createObjectURL(outBlob));
            const origItem = origList[i] || origList[0];

            matchedPages.push({
              name: cleanName.replace(/^(failed_|error_)/, ''),
              originalUrl: origItem?.url || transUrl,
              translatedUrl: transUrl,
              isFailed,
            });
          }

          setPages(matchedPages);
          if (matchedPages.length > 0) {
            setTranslatedUrl(matchedPages[0].translatedUrl);
          }
        } catch (zipErr) {
          console.error('번역된 ZIP 파일 언팩 실패:', zipErr);
          // 언팩 실패 시에도 다운로드 URL은 유지
          setTranslatedUrl(downloadZipUrl);
        }
      } else {
        // 단일 이미지
        const objectUrl = registerUrl(URL.createObjectURL(blob));
        setTranslatedUrl(objectUrl);
      }
    } catch (err) {
      console.error('Translation error:', err);
      setErrorMsg(err.message || '번역 처리 중 오류가 발생했습니다.');
    } finally {
      setIsTranslating(false);
    }
  };

  const isZip = selectedFile && (
    selectedFile.name.toLowerCase().endsWith('.zip') ||
    selectedFile.type?.includes('zip') ||
    Boolean(zipDetails)
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-radial-gradient">
      {/* Navigation Header */}
      <Header
        hasApiKey={Boolean(apiKey || serverHasKey)}
        onOpenKeyModal={() => setIsKeyModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        {!translatedUrl && !isTranslating && (
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next-Gen Comic Typesetting with Gemini 3.8 Flash</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              만화 대사 인식부터 번역과 식자까지{' '}
              <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-accent-400 bg-clip-text text-transparent">
                원클릭 완성
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Google Gemini 3.8 Flash 비전 모델이 말풍선 영역(0~1000)을 정밀 탐지하고,
              원문 대사를 자연스러운 한국어로 번역한 후 나눔고딕으로 완벽하게 합성합니다.
              <br />
              <strong className="text-brand-300">ZIP 대용량 압축 파일 및 이미지 다중 선택 일괄 번역</strong> 완벽 지원!
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
            </div>
            {errorMsg.includes('API') && (
              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-xs font-medium transition"
              >
                API 키 입력하기
              </button>
            )}
          </div>
        )}

        {/* State 1: Translation In Progress */}
        {isTranslating && <TranslationProgress isZip={isZip} pageCount={zipDetails?.pageCount} />}

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

        {/* State 3: File Upload Area */}
        {!isTranslating && !translatedUrl && (
          <ImageUploader
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            zipDetails={zipDetails}
            onSelectFile={handleSelectFile}
            onClearFile={handleClearFile}
            onStartTranslate={handleStartTranslate}
            isTranslating={isTranslating}
            onLoadSample={handleLoadSample}
          />
        )}

        {/* Features Info Cards (하단 안내) */}
        {!isTranslating && !translatedUrl && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mt-16 pt-10 border-t border-slate-800/80">
            <div className="glass-card p-5 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Gemini 3.8 Flash Vision</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                정규화 좌표([ymin, xmin, ymax, xmax]) 기반 2D 바운딩 박스를 통해 말풍선 위치를 오차 없이 감지합니다.
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">ZIP 일괄 번역 & 다중 선택</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                만화 여러 권 또는 수십 장의 페이지를 ZIP으로 압축하거나 다중 선택하여 한 번에 번역하고 일괄 다운로드합니다.
              </p>
            </div>

            <div className="glass-card p-5 rounded-2xl space-y-2">
              <div className="w-9 h-9 rounded-xl bg-accent-500/10 text-accent-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">Pillow 자동 식자 렌더링</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                말풍선 배경 샘플링 마스킹 및 박스 너비/높이에 맞춘 폰트 크기 자동 계산 & 줄바꿈 합성을 수행합니다.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 py-6 text-center text-xs text-slate-400">
        <p>© 2026 MangaTrans • Powered by Google Gemini 3.8 Flash & FastAPI</p>
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        currentKey={apiKey}
        onSaveKey={handleSaveApiKey}
        serverHasKey={serverHasKey}
      />
    </div>
  );
}
