/**
 * manga-image-translator 백엔드 API 연동 서비스
 * 
 * 외부 서버(Google Colab, ngrok, 로컬 등)에 실행 중인
 * manga-image-translator API 엔드포인트와 통신하여
 * 만화 이미지의 대사 인식, 번역 및 식자 합성을 처리합니다.
 */

/**
 * 백엔드 URL 문자열을 정규화합니다.
 * @param {string} url 
 * @returns {string} 끝의 슬래시(/)가 제거된 정규화된 URL
 */
export function normalizeBackendUrl(url) {
  if (!url) return '';
  let trimmed = url.trim();
  // 끝에 있는 슬래시들 제거
  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed;
}

/**
 * 백엔드 서버의 활성화 및 연결 상태를 테스트합니다.
 * @param {string} backendUrl 
 * @returns {Promise<{ ok: boolean, message: string, status?: number }>}
 */
export async function testBackendConnection(backendUrl) {
  const cleanUrl = normalizeBackendUrl(backendUrl);
  if (!cleanUrl) {
    return { ok: false, message: '백엔드 서버 주소를 입력해주세요.' };
  }

  const testEndpoints = [
    cleanUrl,
    `${cleanUrl}/`,
    `${cleanUrl}/api/health`,
    `${cleanUrl}/ping`,
    `${cleanUrl}/health`,
  ];

  for (const endpoint of testEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': '69420',
          'bypass-tunnel-reminder': 'true',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 서버가 응답하면 (200~499 사이면 서버가 살아있음을 의미)
      if (res.status < 500) {
        return {
          ok: true,
          status: res.status,
          message: `서버 연결 성공 (상태 코드: ${res.status})`,
        };
      }
    } catch (err) {
      // 다음 엔드포인트 시도
    }
  }

  return {
    ok: false,
    message: '백엔드 서버에 연결할 수 없습니다. 주소 및 실행 여부를 확인해주세요.',
  };
}

/**
 * manga-image-translator 백엔드 서버로 단일 이미지를 전송하여 식자된 이미지를 받아옵니다.
 * 
 * 전송 규격 (FormData multipart/form-data):
 * - file: 이미지 Blob/File
 * - target_lang: "KOR" (기본값)
 * - detector: "default"
 * - direction: "auto"
 * 
 * 엔드포인트: {backend_url}/run 또는 {backend_url}/translate
 * 
 * @param {Object} options
 * @param {string} options.backendUrl 백엔드 서버 베이스 URL
 * @param {Blob|File} options.imageBlob 번역할 원본 이미지
 * @param {string} [options.fileName] 파일 이름
 * @param {string} [options.targetLang="KOR"] 목표 언어 (기본값 KOR)
 * @param {string} [options.detector="default"] 감지기 모델 (기본값 default)
 * @param {string} [options.direction="auto"] 텍스트 방향 (기본값 auto)
 * @returns {Promise<Blob>} 식자 완료된 바이너리 이미지 Blob
 */
export async function translateMangaImage({
  backendUrl,
  imageBlob,
  fileName = 'manga.jpg',
  targetLang = 'KOR',
  detector = 'default',
  direction = 'auto',
}) {
  const cleanUrl = normalizeBackendUrl(backendUrl);

  if (!cleanUrl) {
    const error = new Error('백엔드 서버 주소를 확인해주세요 (Google Colab 또는 로컬 서버 실행 필요)');
    error.isBackendUrlMissing = true;
    throw error;
  }

  // FormData 구성
  const formData = new FormData();
  formData.append('file', imageBlob, fileName);
  formData.append('target_lang', targetLang || 'KOR');
  formData.append('detector', detector || 'default');
  formData.append('direction', direction || 'auto');

  // 호출할 엔드포인트 후보들 (/run 우선, 404 시 /translate 폴백)
  const candidateUrls = [
    `${cleanUrl}/run`,
    `${cleanUrl}/translate`,
  ];

  let lastError = null;

  for (let i = 0; i < candidateUrls.length; i++) {
    const endpointUrl = candidateUrls[i];
    console.info(`[Manga Translator] 백엔드 요청 전송 중 -> ${endpointUrl} (파일: ${fileName}, 목표언어: ${targetLang})`);

    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          // ngrok 무료 도메인 경고 페이지를 건너뛰기 위한 헤더
          'ngrok-skip-browser-warning': '69420',
          'bypass-tunnel-reminder': 'true',
        },
        body: formData,
      });

      // 404인 경우 다음 엔드포인트 후보(/translate) 시도
      if (response.status === 404 && i < candidateUrls.length - 1) {
        console.warn(`[Manga Translator] ${endpointUrl} 경로가 404입니다. 대안 엔드포인트 ${candidateUrls[i + 1]} 로 재시도합니다.`);
        continue;
      }

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorText = await response.text();
          errorDetail = errorText;
        } catch (_) {}

        console.error('[Manga Translator] 백엔드 응답 실패 상세:', {
          endpoint: endpointUrl,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorDetail,
        });

        const error = new Error(
          `백엔드 번역 실패 [HTTP ${response.status} ${response.statusText}]: ${errorDetail || '서버 내부 오류'}`
        );
        error.status = response.status;
        error.statusText = response.statusText;
        error.details = errorDetail;
        throw error;
      }

      // 응답 Content-Type 파악
      const contentType = response.headers.get('content-type') || '';

      // JSON으로 응답하는 특수 백엔드인 경우(에러 메시지나 base64 또는 텍스트) 방어 처리
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.error) {
          throw new Error(`백엔드 오류: ${json.error}`);
        }
        // base64 이미지가 반환된 경우
        if (json.image_base64 || json.image) {
          const b64Data = (json.image_base64 || json.image).replace(/^data:image\/\w+;base64,/, '');
          const byteCharacters = atob(b64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let k = 0; k < byteCharacters.length; k++) {
            byteNumbers[k] = byteNumbers.charCodeAt(k);
          }
          const byteArray = new Uint8Array(byteNumbers);
          return new Blob([byteArray], { type: 'image/jpeg' });
        }
        // 다운로드 URL이 반환된 경우
        if (json.result_url || json.url) {
          const imgUrl = json.result_url || json.url;
          const imgRes = await fetch(imgUrl);
          return await imgRes.blob();
        }
      }

      // 일반적인 manga-image-translator 응답: 식자 완료된 바이너리 이미지 Blob
      const resultBlob = await response.blob();
      if (!resultBlob || resultBlob.size === 0) {
        throw new Error('백엔드로부터 수신한 이미지 데이터가 비어있습니다.');
      }

      console.info(
        `[Manga Translator] '${fileName}' 식자 이미지 수신 성공 (${resultBlob.size} bytes, type: ${resultBlob.type || contentType})`
      );

      // MIME 타입이 명시되지 않은 경우 기본 image/jpeg 부여
      const finalType = resultBlob.type || contentType || 'image/jpeg';
      return new Blob([resultBlob], { type: finalType });

    } catch (err) {
      lastError = err;
      // 네트워크 레벨 실패(서버 미실행, CORS, URL 오타 등)인 경우
      if (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        console.error('[Manga Translator] 백엔드 서버 네트워크 연결 실패:', {
          endpoint: endpointUrl,
          message: err.message,
          error: err,
        });
        const connError = new Error('백엔드 서버 주소를 확인해주세요 (Google Colab 또는 로컬 서버 실행 필요)');
        connError.isConnectionFailed = true;
        connError.originalError = err;
        throw connError;
      }

      // 이미 HTTP 에러 객체인 경우 그대로 던지기
      if (err.status) {
        throw err;
      }
    }
  }

  throw lastError || new Error('백엔드 서버와 통신할 수 없습니다.');
}
