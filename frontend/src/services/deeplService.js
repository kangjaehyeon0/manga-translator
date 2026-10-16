/**
 * DeepL API 클라이언트 통신 서비스
 * DeepL 공식 무료 엔드포인트(api-free.deepl.com)를 통한 고품질 인공신경망 번역을 수행합니다.
 */

// DeepL 공식 무료 엔드포인트
export const DEEPL_FREE_API_URL = 'https://api-free.deepl.com/v2/translate';

// 브라우저 CORS 차단 대비 Vite 개발 서버 프록시 엔드포인트
export const DEEPL_PROXY_API_URL = '/api-deepl/v2/translate';

/**
 * DeepL API로 일본어 대사 텍스트 목록을 전송하여 한국어로 일괄 번역
 * @param {Object} params
 * @param {string} params.apiKey - DeepL API 키 (예: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx)
 * @param {string[]} params.texts - 번역할 일본어 텍스트 배열
 * @param {string} [params.sourceLang='JA'] - 출발어 (기본: JA)
 * @param {string} [params.targetLang='KO'] - 도착어 (기본: KO)
 * @returns {Promise<string[]>} 번역된 한국어 텍스트 배열
 */
export async function translateWithDeepL({
  apiKey,
  texts = [],
  sourceLang = 'JA',
  targetLang = 'KO',
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('DeepL API 키가 입력되지 않았습니다. 설정에서 DeepL API 키를 입력해주세요.');
  }

  if (!texts || texts.length === 0) {
    return [];
  }

  const cleanKey = apiKey.trim();
  const requestBody = {
    text: texts,
    source_lang: sourceLang,
    target_lang: targetLang,
  };

  const headers = {
    'Authorization': `DeepL-Auth-Key ${cleanKey}`,
    'Content-Type': 'application/json',
  };

  let response = null;
  let usedProxy = false;

  // 1차 시도: DeepL 공식 무료 엔드포인트로 직접 POST 요청
  try {
    response = await fetch(DEEPL_FREE_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (directErr) {
    console.warn('[DeepL Service] 공식 엔드포인트 직접 호출 실패 (CORS 등 감지), 프록시 엔드포인트로 재시도합니다:', directErr);
    // 2차 시도: Vite 프록시 엔드포인트로 자동 폴백 재시도
    try {
      response = await fetch(DEEPL_PROXY_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      usedProxy = true;
    } catch (proxyErr) {
      console.error('[DeepL Service] 프록시 통신 실패:', proxyErr);
      const networkError = new Error(
        `DeepL API 통신에 실패했습니다: 브라우저 CORS 차단 또는 네트워크 연결을 확인해주세요. (${proxyErr.message})`
      );
      networkError.isConnectionFailed = true;
      throw networkError;
    }
  }

  if (!response.ok) {
    let errorDetails = null;
    let errorMessage = `DeepL API 요청 실패 (HTTP ${response.status} ${response.statusText})`;

    try {
      errorDetails = await response.json();
      if (errorDetails?.message) {
        errorMessage = `DeepL API 오류 [${response.status}]: ${errorDetails.message}`;
      }
    } catch (_) {
      try {
        errorMessage = await response.text();
      } catch (_) {}
    }

    if (response.status === 403) {
      errorMessage = 'DeepL API 키가 올바르지 않거나 권한이 없습니다. (:fx로 끝나는 무료 계정 키인지 확인해주세요)';
    } else if (response.status === 456) {
      errorMessage = 'DeepL 계정의 월간 번역 글자 수 할당량(Quota)을 초과했습니다.';
    } else if (response.status === 400) {
      errorMessage = `DeepL 요청 형식이 잘못되었습니다. (${errorMessage})`;
    } else if (response.status === 429) {
      errorMessage = 'DeepL 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    }

    const apiError = new Error(errorMessage);
    apiError.status = response.status;
    apiError.statusText = response.statusText;
    apiError.details = errorDetails;
    throw apiError;
  }

  const responseData = await response.json();
  const translations = responseData?.translations || [];

  return translations.map((t) => t.text || '');
}

/**
 * DeepL API 키 연결 및 정상 동작 확인 테스트 함수
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function testDeepLConnection(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, message: '테스트할 DeepL API 키를 입력해주세요.' };
  }

  const cleanKey = apiKey.trim();
  if (!cleanKey.endsWith(':fx') && !cleanKey.includes('-')) {
    // 경고하지만 테스트는 진행
  }

  try {
    const results = await translateWithDeepL({
      apiKey: cleanKey,
      texts: ['こんにちは', 'ありがとう'],
      sourceLang: 'JA',
      targetLang: 'KO',
    });

    if (results && results.length > 0) {
      return {
        ok: true,
        message: `API 키 인증 성공! 테스트 번역: "${results[0]}" (${results.length}건 처리)`,
      };
    }

    return { ok: false, message: 'DeepL 응답에 번역 결과가 없습니다.' };
  } catch (err) {
    return {
      ok: false,
      message: err.message || 'DeepL API 연결에 실패했습니다. 키를 다시 확인해주세요.',
    };
  }
}
