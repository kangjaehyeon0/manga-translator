/**
 * Gemini API 클라이언트 직접 통신 서비스
 * Google Generative Language 공식 REST API 규격에 맞춰 브라우저에서 직접 호출합니다.
 */

export const DEFAULT_PROMPT = `Extract Japanese text from speech bubbles with coordinates [ymin, xmin, ymax, xmax] scaled 0-1000, and translate to Korean. Output valid JSON array only.
Format:
[
  {
    "box_2d": [ymin, xmin, ymax, xmax],
    "original_text": "원문 텍스트",
    "translated_text": "자연스러운 한국어 번역 대사"
  }
]`;

/**
 * File 또는 Blob을 순수 Base64 데이터 및 MimeType으로 안전하게 변환
 * Data URL 헤더("data:image/...;base64,")를 반드시 제거하고 순수 base64 문자열만 반환
 */
export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('이미지 파일 데이터를 읽어오지 못했습니다.'));
        return;
      }

      // 1. Data URL 헤더 분리 및 순수 Base64 문자열 추출
      const commaIndex = result.indexOf(',');
      let base64Data = commaIndex !== -1 ? result.slice(commaIndex + 1) : result;
      // 공백 및 줄바꿈 완전 제거
      base64Data = base64Data.replace(/[\r\n\s]/g, '');

      // 2. MIME 타입 추출 및 Gemini API 지원 포맷으로 정규화
      let mimeType = 'image/jpeg';
      const headerMatch = result.match(/^data:([^;]+);base64,/);
      if (headerMatch) {
        mimeType = headerMatch[1].toLowerCase().trim();
      } else if (blob.type) {
        mimeType = blob.type.toLowerCase().trim();
      }

      // Google Gemini API는 image/jpg를 거부하므로 image/jpeg로 통일
      if (mimeType === 'image/jpg' || !mimeType.startsWith('image/')) {
        mimeType = 'image/jpeg';
      }

      resolve({
        mimeType,
        base64Data,
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Gemini 응답 텍스트로부터 JSON 데이터(배열)를 매우 안전하고 유연하게 파싱
 */
export function parseGeminiJsonResponse(rawText) {
  if (!rawText || !rawText.trim()) return [];

  let text = rawText.trim();

  // 1. 마크다운 코드 블록(```json ... ```) 제거
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 2. 최외곽 JSON 배열([ ... ]) 또는 객체({ ... }) 추출
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    text = text.slice(firstBracket, lastBracket + 1);
  } else {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }
  }

  // 3. JSON 파싱 시도 (느슨한 정제 포함)
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    try {
      const sanitized = text
        .replace(/,\s*([\]}])/g, '$1') // 후행 콤마 제거
        .replace(/[\u0000-\u001F]+/g, ' '); // 제어 문자 제거
      parsed = JSON.parse(sanitized);
    } catch (finalErr) {
      console.warn('[Gemini Parse Fallback] 정규 파싱 실패, 원본 텍스트:', text);
      return [];
    }
  }

  // 4. 배열 구조로 정규화
  let items = [];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    for (const key of ['dialogues', 'translations', 'results', 'boxes', 'data', 'items']) {
      if (Array.isArray(parsed[key])) {
        items = parsed[key];
        break;
      }
    }
    if (items.length === 0 && (parsed.box_2d || parsed.box || parsed.coordinates)) {
      items = [parsed];
    }
  }

  // 5. 각 항목 정규화 ({ box_2d: [ymin, xmin, ymax, xmax], original_text, translated_text })
  return items
    .map((item) => {
      let box = item.box_2d || item.box || item.bbox || item.coordinates;
      if (!Array.isArray(box) || box.length !== 4) {
        if (box && typeof box === 'object') {
          box = [
            box.ymin ?? box.y1 ?? 0,
            box.xmin ?? box.x1 ?? 0,
            box.ymax ?? box.y2 ?? 0,
            box.xmax ?? box.x2 ?? 0,
          ];
        } else {
          return null;
        }
      }

      // 0~1000 범위 정수 보정
      const box_2d = box.map((v) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0))));

      const original_text = String(item.original_text || item.text || item.japanese || item.original || '');
      const translated_text = String(item.translated_text || item.translation || item.korean || item.translated || original_text);

      if (!translated_text && !original_text) return null;

      return {
        box_2d,
        original_text,
        translated_text,
      };
    })
    .filter(Boolean);
}

/**
 * Gemini 비전 모델을 직접 호출하여 만화 말풍선 인식 및 한국어 번역 수행
 * @param {Object} params
 * @param {string} params.apiKey - 사용자 Gemini API 키
 * @param {string} [params.model] - 모델명 (기본: gemini-1.5-flash)
 * @param {Blob|File} params.imageBlob - 만화 이미지 Blob 또는 File
 * @returns {Promise<Array<{box_2d: number[], original_text: string, translated_text: string}>>}
 */
export async function detectAndTranslateWithGemini({ apiKey, model, imageBlob }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API 키가 입력되지 않았습니다. 설정에서 API 키를 입력하거나 무료 모드를 사용해주세요.');
  }

  const cleanKey = apiKey.trim();

  // 모델명 정규화 (유효한 공식 모델명만 허용, 그렇지 않으면 gemini-1.5-flash로 강제)
  let targetModel = 'gemini-1.5-flash';
  if (model && (model === 'gemini-1.5-pro' || model === 'gemini-2.0-flash')) {
    targetModel = model;
  }

  // 1. 이미지를 순수 Base64 데이터 및 MimeType으로 변환 (Data URL 헤더 완전 제거)
  const { mimeType, base64Data } = await blobToBase64(imageBlob);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  // 2. Google Gemini 공식 API 정확한 규격의 Request Payload 구성
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: DEFAULT_PROMPT,
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    safetySettings: [
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (netErr) {
    console.error('[Gemini API Network Error] 구글 엔드포인트 통신 실패:', netErr);
    const err = new Error(`Google Gemini 서버 연결 실패: 브라우저 네트워크 또는 인터넷 연결을 확인해주세요. (${netErr.message})`);
    err.originalError = netErr;
    throw err;
  }

  if (!response.ok) {
    let errorDetails = null;
    let errorMessage = `Gemini API 요청 실패 (HTTP ${response.status} ${response.statusText})`;

    try {
      errorDetails = await response.json();
      if (errorDetails?.error?.message) {
        errorMessage = `Gemini API 오류 [${response.status}]: ${errorDetails.error.message}`;
      }
    } catch (_) {
      try {
        errorMessage = await response.text();
      } catch (_) {}
    }

    const apiError = new Error(errorMessage);
    apiError.status = response.status;
    apiError.statusText = response.statusText;
    apiError.details = errorDetails;

    console.error('[Gemini API Detailed Error]', {
      status: response.status,
      statusText: response.statusText,
      model: targetModel,
      errorDetails,
      endpoint: endpoint.replace(cleanKey, '***API_KEY***'),
    });

    throw apiError;
  }

  const responseData = await response.json();

  // 1. promptFeedback 레벨의 안전 필터 차단 검사 (SAFETY Block)
  const promptFeedback = responseData?.promptFeedback;
  if (promptFeedback?.blockReason) {
    const blockReason = promptFeedback.blockReason;
    const safetyRatings = promptFeedback.safetyRatings || [];
    const ratingSummary = safetyRatings
      .map((r) => `${r.category}: ${r.probability}`)
      .join(', ');

    console.warn('[Gemini API Safety Block] 프롬프트가 안전 정책에 의해 차단되었습니다:', {
      blockReason,
      safetyRatings,
      responseData,
    });

    const safetyError = new Error(
      `Gemini AI 안전 필터 차단 (Prompt Block): 사유=${blockReason} [${ratingSummary || '성인/선정성/안전성 필터'}]`
    );
    safetyError.isSafetyBlock = true;
    safetyError.blockReason = blockReason;
    safetyError.safetyRatings = safetyRatings;
    safetyError.rawResponse = responseData;
    throw safetyError;
  }

  // 2. candidate 레벨의 finishReason 안전 필터 차단 검사
  const candidate = responseData?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (finishReason === 'SAFETY') {
    const safetyRatings = candidate?.safetyRatings || [];
    const ratingSummary = safetyRatings
      .map((r) => `${r.category}: ${r.probability}`)
      .join(', ');

    console.warn('[Gemini API Safety Block] 이미지 분석 결과가 안전 정책(선정성/폭력성 등)으로 차단되었습니다:', {
      finishReason,
      safetyRatings,
      responseData,
    });

    const safetyError = new Error(
      `Gemini AI 안전 필터 차단 (Candidate Block): finishReason=${finishReason} [${ratingSummary || '성인/선정성 필터'}]`
    );
    safetyError.isSafetyBlock = true;
    safetyError.finishReason = finishReason;
    safetyError.safetyRatings = safetyRatings;
    safetyError.rawResponse = responseData;
    throw safetyError;
  }

  // 3. 응답 텍스트 추출 및 파싱
  const parts = candidate?.content?.parts || [];
  const textContent = parts
    .map((p) => p.text || '')
    .filter(Boolean)
    .join('\n');

  if (!textContent.trim()) {
    console.warn('[Gemini API Warning] 모델 응답에 텍스트 내용이 없습니다:', responseData);
    return [];
  }

  const detections = parseGeminiJsonResponse(textContent);
  return detections;
}
