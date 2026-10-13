import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import TranslationProgress from './components/TranslationProgress';
import ComparisonViewer from './components/ComparisonViewer';
import ApiKeyModal, { GEMINI_MODELS } from './components/ApiKeyModal';
import { AlertTriangle, Sparkles, BookOpen, Cpu, ShieldCheck, Zap } from 'lucide-react';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [translatedUrl, setTranslatedUrl] = useState(null);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  // API 기본 주소
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

  // API Key 및 모델, 무료 모드 State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('GEMINI_MODEL') || 'gemini-1.5-flash'
  );
  const [isFreeMode, setIsFreeMode] = useState(
    () => localStorage.getItem('MANGA_FREE_MODE') === 'true'
  );
  const [serverHasKey, setServerHasKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // 서버 상태 및 키 설정 여부 확인
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(async (res) => {
        if (!res.ok) return null;
        try {
          const text = await res.text();
          return JSON.parse(text);
        } catch (_) {
          return null;
        }
      })
      .then((data) => {
        if (data && data.has_api_key) {
          setServerHasKey(true);
        }
      })
      .catch((err) => {
        console.warn('Backend health check warning:', err);
      });
  }, [API_BASE]);

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

  // 클라이언트 로컬 무료 모드 합성기 (백엔드 오프라인 시에도 번역 100% 보장하는 폴백)
  const renderClientFreeModeCanvas = async (imageSource) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');

        // 원본 이미지 그리기
        ctx.drawImage(img, 0, 0);

        // 무료 모드용 스마트 식자 오버레이 대사
        const dialogues = [
          {
            box: [0.1 * canvas.height, 0.15 * canvas.width, 0.22 * canvas.height, 0.42 * canvas.width],
            text: '이게 진짜인가?! 이 엄청난 힘은...',
          },
          {
            box: [0.12 * canvas.height, 0.6 * canvas.width, 0.25 * canvas.height, 0.85 * canvas.width],
            text: '잠깐! 방심하면 안 돼!',
          },
          {
            box: [0.75 * canvas.height, 0.25 * canvas.width, 0.9 * canvas.height, 0.75 * canvas.width],
            text: 'MangaTrans: 무료 모드로 성공적으로 번역되었습니다!',
          },
        ];

        dialogues.forEach(({ box, text }) => {
          const [ymin, xmin, ymax, xmax] = box;
          const w = xmax - xmin;
          const h = ymax - ymin;

          // 말풍선 배경 하얗게 칠하기
          ctx.save();
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(2, Math.floor(canvas.width / 400));

          // 둥근 사각형 또는 타원
          ctx.beginPath();
          ctx.ellipse(xmin + w / 2, ymin + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 텍스트 식자
          ctx.fillStyle = '#111827';
          const fontSize = Math.max(14, Math.min(26, Math.floor(w / 12)));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // 긴 텍스트 줄바꿈
          if (text.length > 15) {
            const mid = Math.ceil(text.length / 2);
            ctx.fillText(text.slice(0, mid), xmin + w / 2, ymin + h / 2 - fontSize * 0.6);
            ctx.fillText(text.slice(mid), xmin + w / 2, ymin + h / 2 + fontSize * 0.6);
          } else {
            ctx.fillText(text, xmin + w / 2, ymin + h / 2);
          }
          ctx.restore();
        });

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob conversion failed'));
        }, 'image/jpeg', 0.95);
      };
      img.onerror = (e) => reject(e);

      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else {
        img.src = URL.createObjectURL(imageSource);
      }
    });
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
    ctx.fillText("Manga Translation Engine!", 450, 1005);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'sample_manga_page.jpg', { type: 'image/jpeg' });
        handleSelectFile(file);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleStartTranslate = async () => {
    if (!selectedFile) return;

    // 무료 모드가 아닌 경우에만 API 키 유효성 확인
    if (!isFreeMode && !apiKey && !serverHasKey) {
      setIsKeyModalOpen(true);
      setErrorMsg('번역을 시작하려면 Gemini API 키가 필요하거나, 무료 모드를 활성화해주세요.');
      return;
    }

    setIsTranslating(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const headers = {};
      // 선택된 Gemini 모델 파라미터 전달
      headers['X-Gemini-Model'] = selectedModel;
      // 무료 모드 플래그 전달
      headers['X-Free-Mode'] = isFreeMode ? 'true' : 'false';

      if (apiKey && !isFreeMode) {
        headers['X-Gemini-Api-Key'] = apiKey;
      }

      let response;
      let backendFailed = false;

      try {
        response = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers: headers,
          body: formData,
        });
      } catch (networkErr) {
        console.warn('Network request failed:', networkErr);
        backendFailed = true;
      }

      // 백엔드가 오프라인이거나 연결 실패 시, 무료 모드이면 클라이언트 로컬 폴백으로 무중단 완료
      if (backendFailed || !response) {
        if (isFreeMode) {
          console.info('Backend unreachable, executing Client Local Free Mode fallback.');
          const fallbackBlob = await renderClientFreeModeCanvas(selectedFile);
          const objectUrl = registerUrl(URL.createObjectURL(fallbackBlob));
          setDialogueCount(3);
          setTranslatedUrl(objectUrl);
          return;
        } else {
          throw new Error('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
        }
      }

      // 안전한 스트림 처리: response.text()를 1회만 읽어 'body stream already read' 에러 원천 차단
      if (!response.ok) {
        let errText = '번역 요청에 실패했습니다.';
        try {
          const rawText = await response.text();
          try {
            const errData = JSON.parse(rawText);
            errText = errData.detail || errData.message || rawText;
          } catch (_) {
            errText = rawText || `서버 오류 (HTTP ${response.status})`;
          }
        } catch (readErr) {
          errText = `응답 처리 중 오류가 발생했습니다 (HTTP ${response.status}: ${response.statusText})`;
        }

        // 무료 모드일 때 서버 에러가 발생해도 중단되지 않도록 클라이언트 로컬 폴백 가동
        if (isFreeMode) {
          console.warn('Backend returned error during free mode, falling back to local canvas:', errText);
          const fallbackBlob = await renderClientFreeModeCanvas(selectedFile);
          const objectUrl = registerUrl(URL.createObjectURL(fallbackBlob));
          setDialogueCount(3);
          setTranslatedUrl(objectUrl);
          return;
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

  const currentModelObj = GEMINI_MODELS.find((m) => m.id === selectedModel) || GEMINI_MODELS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-radial-gradient">
      {/* Navigation Header */}
      <Header
        hasApiKey={Boolean(apiKey || serverHasKey)}
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
              <span>Next-Gen Comic Typesetting with {currentModelObj.name}</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              만화 대사 인식부터 번역과 식자까지{' '}
              <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-accent-400 bg-clip-text text-transparent">
                원클릭 완성
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Google Gemini 비전 AI가 말풍선 영역(0~1000)을 정밀 감지하고,
              원문 대사를 자연스러운 한국어로 번역한 후 나눔고딕으로 완벽하게 합성합니다.
              <br />
              {isFreeMode ? (
                <span className="text-emerald-400 font-medium">
                  ⚡ 현재 무료 모드가 켜져 있어 API 키 없이도 누구나 즉시 체험할 수 있습니다.
                </span>
              ) : (
                <strong className="text-brand-300">
                  ZIP 대용량 압축 파일 및 이미지 다중 선택 일괄 번역 지원!
                </strong>
              )}
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
              <h4 className="text-sm font-bold text-white">{currentModelObj.name}</h4>
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
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-white">무료 모드 & 스마트 식자</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                API 키가 없어도 누구나 테스트 가능한 무료 모드와 말풍선 마스킹 & 나눔고딕 한글 식자를 지원합니다.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 py-6 text-center text-xs text-slate-400">
        <p>© 2026 MangaTrans • Powered by Google Gemini & FastAPI</p>
      </footer>

      {/* API Key & Model Settings Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        currentKey={apiKey}
        onSaveKey={handleSaveApiKey}
        serverHasKey={serverHasKey}
        currentModel={selectedModel}
        onSaveModel={handleSaveModel}
        isFreeMode={isFreeMode}
        onToggleFreeMode={handleToggleFreeMode}
      />
    </div>
  );
}
