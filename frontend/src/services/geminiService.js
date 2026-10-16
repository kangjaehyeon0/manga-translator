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
 * Base64 매직 바이트(헤더 시그니처) 및 파일명을 통한 100% 정확한 MIME 타입 감지
 * WebP 이미지가 JPEG로 잘못 전송되어 400 디코딩 오류가 발생하는 것을 완벽히 방지합니다.
 */
export function detectMimeType(base64Data, fileName = '', blobType = '') {
  // 1. 파일 확장자 우선 검사
  const lowerName = (fileName || '').toLowerCase();
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.gif')) return 'image/gif';

  // 2. Base64 매직 바이트(Magic Bytes) 시그니처 검사
  if (base64Data) {
    if (base64Data.startsWith('UklGR')) return 'image/webp'; // RIFF....WEBP
    if (base64Data.startsWith('iVBORw0KGgo')) return 'image/png'; // \x89PNG
    if (base64Data.startsWith('/9j/')) return 'image/jpeg'; // \xFF\xD8\xFF
    if (base64Data.startsWith('R0lGOD')) return 'image/gif'; // GIF8
  }

  // 3. Blob type 검사
  if (blobType && blobType.startsWith('image/')) {
    const t = blobType.toLowerCase().trim();
    if (t === 'image/jpg') return 'image/jpeg';
    return t;
  }

  return 'image/jpeg';
}

/**
 * File 또는 Blob을 순수 Base64 데이터 및 MimeType으로 안전하게 변환
 * Data URL 헤더("data:image/...;base64,")를 반드시 제거하고 순수 base64 문자열만 반환
 */
export async function blobToBase64(blob, fileName = '') {
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

      // 2. 매직 바이트 및 파일명 기반 정확한 MIME 타입 감지 (WebP/PNG/JPEG 지원)
      const mimeType = detectMimeType(base64Data, fileName, blob.type);

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
 * 안전 설정 목록 (무료 티어 및 일반 API 키에서 400 에러를 방지하는 공식 지원 완화 설정)
 * BLOCK_NONE은 결제 등록된 엔터프라이즈 계정에서만 지원되어 일반 키에서 400 에러를 유발하므로,
 * 일반 키에서 최대로 유해성을 허용하는 BLOCK_ONLY_HIGH를 기본으로 전송합니다.
 */
export const LENIENT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

export const NONE_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Gemini 비전 모델을 직접 호출하여 만화 말풍선 인식 및 한국어 번역 수행
 * @param {Object} params
 * @param {string} params.apiKey - 사용자 Gemini API 키
 * @param {string} [params.model] - 모델명 (기본: gemini-1.5-flash)
 * @param {Blob|File} params.imageBlob - 만화 이미지 Blob 또는 File
 * @param {string} [params.fileName] - 파일명 (MIME 타입 감지용)
 * @returns {Promise<Array<{box_2d: number[], original_text: string, translated_text: string}>>}
 */
export async function detectAndTranslateWithGemini({ apiKey, model, imageBlob, fileName = '' }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API 키가 입력되지 않았습니다. 설정에서 API 키를 입력하거나 무료 모드를 사용해주세요.');
  }

  const cleanKey = apiKey.trim();

  // 모델명 정규화 및 가용 모델 목록 구성 (gemini-1.5-flash 최우선)
  const candidateModels = [];
  if (model) {
    candidateModels.push(model);
  }
  if (!candidateModels.includes('gemini-1.5-flash')) candidateModels.push('gemini-1.5-flash');
  if (!candidateModels.includes('gemini-2.0-flash')) candidateModels.push('gemini-2.0-flash');
  if (!candidateModels.includes('gemini-3.5-flash')) candidateModels.push('gemini-3.5-flash');
  if (!candidateModels.includes('gemini-flash-latest')) candidateModels.push('gemini-flash-latest');
  if (!candidateModels.includes('gemini-3.8-flash')) candidateModels.push('gemini-3.8-flash');

  // 1. 이미지를 순수 Base64 데이터 및 정확한 MimeType(WebP/PNG/JPEG)으로 변환
  const { mimeType, base64Data } = await blobToBase64(imageBlob, fileName);

  // 2. Google Gemini 공식 API Request Payload 구성
  const buildPayload = (safety) => ({
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
    safetySettings: safety,
  });

  let response = null;
  let lastUsedModel = candidateModels[0];

  // 후보 모델들을 순서대로 시도 (404 Not Found 또는 503 과부하 발생 시 다음 모델로 즉시 폴백)
  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    lastUsedModel = candidateModels[mIdx];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${lastUsedModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    try {
      // 1차 시도: 완전 해제(BLOCK_NONE) 시도
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(NONE_SAFETY_SETTINGS)),
      });

      // 만약 BLOCK_NONE으로 인해 400 에러가 발생한 경우 BLOCK_ONLY_HIGH로 자동 2차 재시도
      if (!response.ok && response.status === 400) {
        try {
          const errorJson = await response.clone().json();
          const msg = errorJson?.error?.message || '';
          if (msg.includes('safety') || msg.includes('BLOCK_NONE') || msg.includes('Invalid') || msg.includes('allowed')) {
            console.warn('[Gemini API Fallback] BLOCK_NONE 거부 -> BLOCK_ONLY_HIGH로 재전송:', msg);
            response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buildPayload(LENIENT_SAFETY_SETTINGS)),
            });
          }
        } catch (_) {}
      }

      // 404(단종된 모델) 또는 503(과부하)인 경우 다음 최신 모델로 재시도
      if (!response.ok && (response.status === 404 || response.status === 503) && mIdx < candidateModels.length - 1) {
        console.warn(`[Gemini Model Fallback] '${lastUsedModel}' (${response.status}) 사용 불가 -> '${candidateModels[mIdx + 1]}'로 자동 전환 시도합니다.`);
        continue;
      }

      // 성공 또는 일반 응답이면 루프 탈출
      break;
    } catch (netErr) {
      if (mIdx === candidateModels.length - 1) {
        console.error('[Gemini API Network Error] 구글 엔드포인트 통신 실패:', netErr);
        const err = new Error(`Google Gemini 서버 연결 실패: 인터넷 연결 또는 브라우저 CORS를 확인해주세요. (${netErr.message})`);
        err.originalError = netErr;
        throw err;
      }
    }
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
      model: lastUsedModel,
      mimeType,
      errorDetails,
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${lastUsedModel}:generateContent?key=***API_KEY***`,
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
    console.warn('[Gemini API Warning] 모델 응답에 텍스트 내용이 없습니다 (비어있는 대사):', responseData);
    return [];
  }

  const detections = parseGeminiJsonResponse(textContent);
  return detections;
}

export const EXTRACT_ONLY_PROMPT = `Extract Japanese text and dialogue from speech bubbles in this manga page, with 2D coordinates [ymin, xmin, ymax, xmax] scaled 0-1000.
Do NOT translate the text. Extract the exact original Japanese text faithfully.
Output valid JSON array only:
[
  {
    "box_2d": [ymin, xmin, ymax, xmax],
    "original_text": "원문 일본어 대사"
  }
]`;

/**
 * DeepL 파이프라인 1단계: 만화 이미지에서 원문 일본어 대사 및 말풍선 좌표([ymin, xmin, ymax, xmax])만 추출
 * @param {Object} params
 * @param {string} params.apiKey - Gemini API 키
 * @param {string} [params.model] - 모델명 (기본: gemini-1.5-flash)
 * @param {Blob|File} params.imageBlob - 만화 이미지 Blob 또는 File
 * @param {string} [params.fileName] - 파일명
 * @returns {Promise<Array<{box_2d: number[], original_text: string}>>}
 */
export async function extractJapaneseDialogues({ apiKey, model, imageBlob, fileName = '' }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('대사 인식을 위한 Gemini API 키가 설정되지 않았습니다.');
  }

  const cleanKey = apiKey.trim();
  const candidateModels = [];
  if (model) candidateModels.push(model);
  if (!candidateModels.includes('gemini-1.5-flash')) candidateModels.push('gemini-1.5-flash');
  if (!candidateModels.includes('gemini-2.0-flash')) candidateModels.push('gemini-2.0-flash');
  if (!candidateModels.includes('gemini-3.5-flash')) candidateModels.push('gemini-3.5-flash');
  if (!candidateModels.includes('gemini-flash-latest')) candidateModels.push('gemini-flash-latest');
  if (!candidateModels.includes('gemini-3.8-flash')) candidateModels.push('gemini-3.8-flash');

  const { mimeType, base64Data } = await blobToBase64(imageBlob, fileName);

  const buildPayload = (safety) => ({
    contents: [
      {
        parts: [
          {
            text: EXTRACT_ONLY_PROMPT,
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
    safetySettings: safety,
  });

  let response = null;
  let lastUsedModel = candidateModels[0];

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    lastUsedModel = candidateModels[mIdx];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${lastUsedModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(NONE_SAFETY_SETTINGS)),
      });

      if (!response.ok && response.status === 400) {
        try {
          const errorJson = await response.clone().json();
          const msg = errorJson?.error?.message || '';
          if (msg.includes('safety') || msg.includes('BLOCK_NONE') || msg.includes('Invalid') || msg.includes('allowed')) {
            response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(buildPayload(LENIENT_SAFETY_SETTINGS)),
            });
          }
        } catch (_) {}
      }

      if (!response.ok && (response.status === 404 || response.status === 503) && mIdx < candidateModels.length - 1) {
        continue;
      }

      break;
    } catch (netErr) {
      if (mIdx === candidateModels.length - 1) {
        throw new Error(`대사 감지 모델 연결 실패: ${netErr.message}`);
      }
    }
  }

  if (!response.ok) {
    let errorDetails = null;
    let errorMessage = `대사 감지 실패 (HTTP ${response.status})`;
    try {
      errorDetails = await response.json();
      if (errorDetails?.error?.message) {
        errorMessage = `대사 감지 오류: ${errorDetails.error.message}`;
      }
    } catch (_) {}

    const err = new Error(errorMessage);
    err.status = response.status;
    err.details = errorDetails;
    throw err;
  }

  const responseData = await response.json();
  const candidate = responseData?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const textContent = parts.map((p) => p.text || '').filter(Boolean).join('\n');

  if (!textContent.trim()) {
    return [];
  }

  return parseGeminiJsonResponse(textContent);
}

