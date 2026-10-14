/**
 * Gemini API 클라이언트 직접 통신 서비스
 * 백엔드 서버 없이 브라우저에서 Google Generative Language API로 직접 호출합니다.
 */

export const SYSTEM_PROMPT = `You are an expert manga/comic translator and typesetter AI.
Analyze the provided comic/manga page carefully.
Task:
1. Detect all speech bubbles, narration boxes, and dialogue text in the image.
2. For each detected text area, find the tight 2D bounding box enclosing the text area inside the bubble:
   Format: [ymin, xmin, ymax, xmax] (normalized integers from 0 to 1000).
   Ensure: 0 <= ymin < ymax <= 1000 and 0 <= xmin < xmax <= 1000.
3. Extract the original text accurately.
4. Translate each text into natural, fluent, and emotive Korean appropriate for comic dialogues and sound effects.

Output MUST be a JSON array of objects with this schema:
[
  {
    "box_2d": [ymin, xmin, ymax, xmax],
    "original_text": "Original text string",
    "translated_text": "자연스러운 한국어 번역 대사"
  }
]
Return strictly valid JSON only.`;

/**
 * File 또는 Blob을 Base64 데이터 및 MimeType으로 변환
 */
export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // "data:image/jpeg;base64,AAAA..." 형태에서 base64 데이터만 분리
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
      if (match) {
        resolve({
          mimeType: match[1],
          base64Data: match[2],
        });
      } else {
        // 기본 이미지 mimeType 적용
        const parts = dataUrl.split(',');
        resolve({
          mimeType: blob.type || 'image/jpeg',
          base64Data: parts[1] || '',
        });
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 마크다운 코드 블록(```json ... ```) 또는 앞뒤 공백을 정제하여 순수 JSON 문자열 반환
 */
export function cleanJsonText(rawText) {
  if (!rawText) return '[]';
  let text = rawText.trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    text = match[1].trim();
  }
  return text;
}

/**
 * Gemini 비전 모델을 직접 호출하여 만화 말풍선 인식 및 한국어 번역 수행
 * @param {Object} params
 * @param {string} params.apiKey - 사용자 Gemini API 키
 * @param {string} params.model - 선택된 모델 (예: gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro)
 * @param {Blob|File} params.imageBlob - 만화 이미지 Blob 또는 File
 * @returns {Promise<Array<{box_2d: number[], original_text: string, translated_text: string}>>}
 */
export async function detectAndTranslateWithGemini({ apiKey, model, imageBlob }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API 키가 입력되지 않았습니다. 설정에서 API 키를 입력하거나 무료 모드를 사용해주세요.');
  }

  const cleanKey = apiKey.trim();
  const selectedModel = model || 'gemini-1.5-flash';

  // 1. 이미지를 Base64로 인코딩
  const { mimeType, base64Data } = await blobToBase64(imageBlob);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: SYSTEM_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
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

    // 콘솔에 구체적인 에러 객체 출력
    console.error('[Gemini API Detailed Error]', {
      status: response.status,
      statusText: response.statusText,
      model: selectedModel,
      errorDetails,
      endpoint: endpoint.replace(cleanKey, '***API_KEY***'),
    });

    throw apiError;
  }

  const responseData = await response.json();

  try {
    const rawContentText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContentText) {
      console.warn('[Gemini API Warning] 모델 응답에 텍스트 내용이 없습니다:', responseData);
      return [];
    }

    const cleanedJson = cleanJsonText(rawContentText);
    const parsed = JSON.parse(cleanedJson);

    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed && Array.isArray(parsed.dialogues)) {
      return parsed.dialogues;
    } else {
      console.warn('[Gemini API Warning] 예상치 못한 응답 포맷:', parsed);
      return [];
    }
  } catch (parseErr) {
    console.error('[Gemini Response JSON Parse Error]', parseErr, responseData);
    const err = new Error('Gemini 모델이 반환한 응답을 JSON으로 변환할 수 없습니다.');
    err.originalError = parseErr;
    err.rawResponse = responseData;
    throw err;
  }
}
