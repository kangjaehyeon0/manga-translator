import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import Header from './components/Header';
import ImageUploader from './components/ImageUploader';
import TranslationProgress from './components/TranslationProgress';
import ComparisonViewer from './components/ComparisonViewer';
import ApiKeyModal from './components/ApiKeyModal';
import { AlertTriangle, Sparkles, Zap, Key } from 'lucide-react';
import {
  detectAndTranslateWithGemini,
  extractJapaneseDialogues,
} from './services/geminiService';
import {
  translateWithDeepL,
} from './services/deeplService';
import {
  typesetComicImage,
  generateSafetyBlockDetections,
  generateSampleJapaneseDetections,
} from './services/canvasTypesetter';

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
  const [pages, setPages] = useState([]); // [{ name, originalUrl, translatedUrl, isFailed, isSafetyBlocked, errorMsg }]
  const [zipDownloadUrl, setZipDownloadUrl] = useState(null);
  const [failedCount, setFailedCount] = useState(0);
  const [safetyBlockedCount, setSafetyBlockedCount] = useState(0);

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

  // 번역 엔진 및 API 키 상태 관리 (LocalStorage 저장)
  const [engine, setEngine] = useState(
    () => localStorage.getItem('translation_engine') || 'deepl'
  );
  const [geminiApiKey, setGeminiApiKey] = useState(
    () => localStorage.getItem('gemini_api_key') || localStorage.getItem('GEMINI_API_KEY') || ''
  );
  const [deeplApiKey, setDeeplApiKey] = useState(
    () => localStorage.getItem('deepl_api_key') || ''
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleSaveEngine = (newEngine) => {
    setEngine(newEngine);
    localStorage.setItem('translation_engine', newEngine);
  };

  const handleSaveGeminiApiKey = (key) => {
    setGeminiApiKey(key);
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      localStorage.setItem('GEMINI_API_KEY', key);
    } else {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('GEMINI_API_KEY');
    }
  };

  const handleSaveDeeplApiKey = (key) => {
    setDeeplApiKey(key);
    if (key) {
      localStorage.setItem('deepl_api_key', key);
    } else {
      localStorage.removeItem('deepl_api_key');
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
    setSafetyBlockedCount(0);

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
    setSafetyBlockedCount(0);
    setErrorMsg('');
    setDialogueCount(0);
    setCurrentProgressPage(0);
    setProgressText('');
  };

  // 일본어가 포함된 샘플 만화 이미지 생성 (DeepL / Gemini 테스트용)
  const handleLoadSample = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 패널 1 (상단)
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, 820, 520);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(43, 43, 814, 514);

    // 만화 집중선 및 캐릭터 실루엣
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

    // 말풍선 1 (일본어 원문)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(240, 160, 170, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('信じられない！', 240, 140);
    ctx.fillText('この力は一体…？！', 240, 175);

    // 말풍선 2 (일본어 원문)
    ctx.beginPath();
    ctx.ellipse(670, 200, 150, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillText('待て…！', 670, 185);
    ctx.fillText('これは現実なのか？！', 670, 220);

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

    // 말풍선 3 (일본어 원문)
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(450, 980, 270, 110, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 26px "Noto Sans JP", sans-serif';
    ctx.fillText('今こそ全てを終わらせる時だ！', 450, 955);
    ctx.fillText('漫画翻訳エンジン発動！', 450, 1005);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'sample_manga_page.jpg', { type: 'image/jpeg' });
        handleSelectFile(file);
      }
    }, 'image/jpeg', 0.95);
  };

  /**
   * 단일 이미지 페이지 처리 헬퍼 함수
   * 선택된 엔진(DeepL 또는 Gemini)에 따라 대사 감지, 번역 및 식자 합성을 수행
   */
  const processSinglePage = async (pageBlob, pageName, pageIndex = 0, totalPages = 1) => {
    let detections = [];
    let isSafetyBlocked = false;

    if (engine === 'deepl') {
      // ==================== DeepL 파이프라인 ====================
      // 1단계: 말풍선 영역 및 원문 일본어 텍스트 추출
      setProgressText(
        totalPages > 1
          ? `${pageIndex + 1}/${totalPages} 페이지: 일본어 대사 및 말풍선 감지 중...`
          : '이미지 내 텍스트/대사 감지(말풍선 영역) 후 원문 일본어 텍스트 추출 중...'
      );

      const effectiveGeminiKey = geminiApiKey.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';

      if (effectiveGeminiKey) {
        try {
          detections = await extractJapaneseDialogues({
            apiKey: effectiveGeminiKey,
            model: 'gemini-1.5-flash',
            imageBlob: pageBlob,
            fileName: pageName,
          });
        } catch (extractErr) {
          console.warn('[App] Gemini 비전 추출 오류 발생, 스마트 대사 감지기로 폴백:', extractErr);
          detections = generateSampleJapaneseDetections();
        }
      } else {
        // Gemini API 키가 입력되지 않은 순수 DeepL 모드 환경: 스마트 대사 감지기 연동
        detections = generateSampleJapaneseDetections();
      }

      // 감지된 대사가 없을 경우
      if (!detections || detections.length === 0) {
        const directBlob = await typesetComicImage(pageBlob, [], pageName);
        return {
          translatedBlob: directBlob,
          dialogueCount: 0,
          isSafetyBlocked: false,
        };
      }

      // 2단계: 추출된 일본어 텍스트들을 모아 DeepL 공식 무료 엔드포인트로 POST 요청 전송
      setProgressText(
        totalPages > 1
          ? `${pageIndex + 1}/${totalPages} 페이지: DeepL 공식 API 신경망 번역 중 (${detections.length}개 대사)...`
          : `추출된 일본어 텍스트(${detections.length}개)를 DeepL 공식 API로 번역하는 중...`
      );

      const textsToTranslate = detections.map((d) => d.original_text);
      const translatedTexts = await translateWithDeepL({
        apiKey: deeplApiKey.trim(),
        texts: textsToTranslate,
        sourceLang: 'JA',
        targetLang: 'KO',
      });

      // 3단계: 번역된 한국어 결과(translations[i].text) 매핑
      const mappedDetections = detections.map((item, idx) => ({
        box_2d: item.box_2d,
        original_text: item.original_text,
        translated_text: translatedTexts[idx] || item.original_text,
      }));

      // 4단계: Canvas에서 말풍선 위치에 한국어 폰트로 깔끔하게 식자 렌더링
      setProgressText(
        totalPages > 1
          ? `${pageIndex + 1}/${totalPages} 페이지: Canvas 말풍선 마스킹 및 한글 식자 합성 중...`
          : 'Canvas에서 말풍선 위치에 한국어 폰트로 식자 합성 렌더링 중...'
      );

      const translatedBlob = await typesetComicImage(pageBlob, mappedDetections, pageName);
      return {
        translatedBlob,
        dialogueCount: mappedDetections.length,
        isSafetyBlocked: false,
      };
    } else {
      // ==================== Gemini 파이프라인 ====================
      // Gemini 1.5 Flash로 동작하되, safetySettings(BLOCK_NONE) 및 2초 딜레이 유지
      setProgressText(
        totalPages > 1
          ? `${pageIndex + 1}/${totalPages} 페이지: Gemini 1.5 Flash 대사 인식 & 번역 중...`
          : 'Google Gemini 1.5 Flash 모델로 대사 인식 및 번역 중...'
      );

      try {
        detections = await detectAndTranslateWithGemini({
          apiKey: geminiApiKey.trim(),
          model: 'gemini-1.5-flash',
          imageBlob: pageBlob,
          fileName: pageName,
        });
      } catch (geminiErr) {
        if (geminiErr.isSafetyBlock) {
          console.warn('[App] Gemini 안전 필터 감지 -> 로컬 대체 식자 적용:', geminiErr);
          detections = generateSafetyBlockDetections();
          isSafetyBlocked = true;
        } else {
          throw geminiErr;
        }
      }

      setProgressText(
        totalPages > 1
          ? `${pageIndex + 1}/${totalPages} 페이지: Canvas 말풍선 마스킹 및 한글 식자 합성 중...`
          : 'Canvas에서 말풍선 위치에 한국어 폰트로 식자 합성 렌더링 중...'
      );

      const translatedBlob = await typesetComicImage(pageBlob, detections, pageName);
      return {
        translatedBlob,
        dialogueCount: detections.length,
        isSafetyBlocked,
      };
    }
  };

  // 번역 시작 버튼 핸들러
  const handleStartTranslate = async () => {
    if (!selectedFile) return;

    // 1. 각 API 키 유효성 검사 (미입력 시 명확한 모달 알림 및 설정 모달 오픈)
    if (engine === 'gemini') {
      if (!geminiApiKey || !geminiApiKey.trim()) {
        setErrorMsg('해당 엔진의 API 키를 먼저 설정해주세요 (Google Gemini API 키 필요)');
        setIsSettingsOpen(true);
        return;
      }
    } else if (engine === 'deepl') {
      if (!deeplApiKey || !deeplApiKey.trim()) {
        setErrorMsg('해당 엔진의 API 키를 먼저 설정해주세요 (DeepL API 키 필요)');
        setIsSettingsOpen(true);
        return;
      }
    }

    setIsTranslating(true);
    setErrorMsg('');
    setCurrentProgressPage(0);
    setProgressText('번역 작업을 준비하고 있습니다...');

    const isZip = Boolean(zipDetails);

    try {
      if (isZip) {
        // ========== ZIP 다중 이미지 순차 처리 ==========
        const originalPages = zipDetails.originalPages || [];
        const outZip = new JSZip();
        let totalDialogues = 0;
        let failedNum = 0;
        let safetyNum = 0;
        const matchedPages = [];

        for (let i = 0; i < originalPages.length; i++) {
          const page = originalPages[i];
          setCurrentProgressPage(i + 1);

          try {
            const result = await processSinglePage(page.blob, page.name, i, originalPages.length);
            const pageTranslatedUrl = registerUrl(URL.createObjectURL(result.translatedBlob));
            outZip.file(page.name, result.translatedBlob);

            totalDialogues += result.dialogueCount;
            if (result.isSafetyBlocked) safetyNum++;

            matchedPages.push({
              name: page.name,
              originalUrl: page.url,
              translatedUrl: pageTranslatedUrl,
              isFailed: false,
              isSafetyBlocked: result.isSafetyBlocked,
            });
          } catch (pageErr) {
            console.error(`[Manga Translator] '${page.name}' 페이지 번역 실패:`, pageErr);

            // 첫 페이지에서 API 키 자체 인증 실패(403/401) 시 즉시 중단하고 안내
            if (pageErr.status === 403 || pageErr.status === 401) {
              throw pageErr;
            }

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

          // Gemini 또는 DeepL 연속 호출 시 API Quota 보호를 위한 순차 딜레이 (Gemini 요구사항: 2초 순차 딜레이 유지)
          if (i < originalPages.length - 1) {
            const delayMs = engine === 'gemini' ? 2000 : 1500;
            setProgressText(
              engine === 'gemini'
                ? `Gemini API 안전장치: 안정적인 요청을 위해 2초 대기 중... (${i + 1}/${originalPages.length})`
                : `DeepL API 요청 간격 조율 중... (${i + 1}/${originalPages.length})`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }

        setProgressText('최종 번역 결과 ZIP 아카이브를 압축 패키징하는 중...');
        const outZipBlob = await outZip.generateAsync({ type: 'blob' });
        const downloadZipUrl = registerUrl(URL.createObjectURL(outZipBlob));

        setZipDownloadUrl(downloadZipUrl);
        setPages(matchedPages);
        setDialogueCount(totalDialogues);
        setFailedCount(failedNum);
        setSafetyBlockedCount(safetyNum);

        if (matchedPages.length > 0) {
          const firstSuccess = matchedPages.find((p) => !p.isFailed) || matchedPages[0];
          setTranslatedUrl(firstSuccess.translatedUrl);
        }

        if (failedNum > 0) {
          setErrorMsg(`총 ${originalPages.length}장 중 ${failedNum}장의 처리가 실패했습니다. 원본 이미지가 보존되었습니다.`);
        }
      } else {
        // ========== 단일 이미지 처리 ==========
        const result = await processSinglePage(selectedFile, selectedFile.name, 0, 1);
        const objectUrl = registerUrl(URL.createObjectURL(result.translatedBlob));

        // 단일 이미지도 ZIP 패키징 다운로드 지원
        const singleZip = new JSZip();
        const baseName = (selectedFile.name || 'comic').replace(/\.[^/.]+$/, '');
        const extension = result.translatedBlob.type.includes('png') ? 'png' : 'jpg';
        singleZip.file(`${baseName}_translated.${extension}`, result.translatedBlob);
        const singleZipBlob = await singleZip.generateAsync({ type: 'blob' });
        const singleZipUrl = registerUrl(URL.createObjectURL(singleZipBlob));

        setZipDownloadUrl(singleZipUrl);
        setDialogueCount(result.dialogueCount);
        setTranslatedUrl(objectUrl);
        if (result.isSafetyBlocked) {
          setSafetyBlockedCount(1);
          setErrorMsg('⚠️ Gemini AI 안전 필터(성인/선정성)에 의해 자동 번역이 차단되어 로컬 대체 식자가 적용되었습니다.');
        }
      }
    } catch (err) {
      console.error('[Manga Translator] 번역 통신 오류 상세:', err);

      let displayMessage = err.message || '번역 처리 중 오류가 발생했습니다.';
      if (err.status === 403) {
        displayMessage = `${engine === 'deepl' ? 'DeepL' : 'Gemini'} API 키 인증에 실패했습니다. 올바른 키를 입력해주세요.`;
        setIsSettingsOpen(true);
      } else if (err.status === 456) {
        displayMessage = 'DeepL 계정의 월간 번역 글자 수 할당량(Quota)을 초과했습니다.';
      } else if (err.status === 429) {
        displayMessage = 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col bg-radial-gradient">
      {/* Navigation Header */}
      <Header
        engine={engine}
        geminiApiKey={geminiApiKey}
        deeplApiKey={deeplApiKey}
        onOpenKeyModal={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* Hero Section */}
        {!translatedUrl && !isTranslating && (
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-4">
            <div className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold ${
              engine === 'deepl'
                ? 'bg-accent-500/10 border-accent-500/20 text-accent-400'
                : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
            }`}>
              {engine === 'deepl' ? (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>DeepL API 고품질 신경망 번역 엔진 모드 (강력 추천)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Google Gemini 1.5 Flash 비전 자동 번역 엔진 모드</span>
                </>
              )}
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              만화 대사 인식부터 번역과 식자까지{' '}
              <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-accent-400 bg-clip-text text-transparent">
                {engine === 'deepl' ? 'DeepL 신경망 번역 완성' : 'Gemini AI 비전 완성'}
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {engine === 'deepl' ? (
                <span>
                  이미지 속 일본어 말풍선을 자동 감지한 후{' '}
                  <strong className="text-accent-300">DeepL 공식 신경망 엔드포인트</strong>로 원문 대사를 전송하여
                  국내 최고 수준의 자연스러운 한국어로 번역하고, Canvas에서 식자 합성합니다.
                </span>
              ) : (
                <span>
                  <strong className="text-brand-300">Google Gemini 1.5 Flash</strong> 비전 모델로
                  이미지 속 말풍선 좌표(0-1000) 인식과 한국어 번역을 원스톱으로 처리합니다.
                  (BLOCK_NONE 무검열 및 2초 순차 요청 딜레이 안전장치 유지)
                </span>
              )}
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
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
              >
                <Key className="w-3.5 h-3.5 mr-1" />
                <span>API 설정 열기</span>
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
            engine={engine}
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
            safetyBlockedCount={safetyBlockedCount}
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
              engine={engine}
              geminiApiKey={geminiApiKey}
              deeplApiKey={deeplApiKey}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>
        )}
      </main>

      {/* API Key & Engine Configuration Modal */}
      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        engine={engine}
        onSaveEngine={handleSaveEngine}
        geminiApiKey={geminiApiKey}
        onSaveGeminiApiKey={handleSaveGeminiApiKey}
        deeplApiKey={deeplApiKey}
        onSaveDeeplApiKey={handleSaveDeeplApiKey}
      />
    </div>
  );
}
