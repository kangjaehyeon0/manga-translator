/**
 * HTML5 Canvas 기반 클라이언트 식자(Typesetting) 엔진
 * 백엔드 서버 없이 브라우저 Canvas API만으로 말풍선 마스킹 및 자동 텍스트 식자를 수행합니다.
 */

/**
 * Image 소스를 HTMLImageElement로 비동기 로드
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrlToRevoke = null;

    img.onload = () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      resolve(img);
    };

    img.onerror = (err) => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      console.error('[CanvasTypesetter] 이미지 로드 실패:', err);
      reject(new Error('이미지를 캔버스에 로드하지 못했습니다.'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      objectUrlToRevoke = URL.createObjectURL(source);
      img.src = objectUrlToRevoke;
    } else {
      reject(new Error('지원하지 않는 이미지 소스 형식입니다.'));
    }
  });
}

/**
 * 말풍선 박스 주변 모서리 픽셀 색상을 샘플링하여 배경색 추정
 */
export function sampleBackgroundColor(ctx, x1, y1, x2, y2, canvasWidth, canvasHeight) {
  const w = x2 - x1;
  const h = y2 - y1;

  if (w <= 6 || h <= 6) return '#ffffff';

  try {
    const samplePoints = [
      [Math.min(x1 + 4, x2 - 1), Math.min(y1 + 4, y2 - 1)],
      [Math.max(x2 - 5, x1), Math.min(y1 + 4, y2 - 1)],
      [Math.min(x1 + 4, x2 - 1), Math.max(y2 - 5, y1)],
      [Math.max(x2 - 5, x1), Math.max(y2 - 5, y1)],
      [Math.floor(x1 + w / 2), Math.min(y1 + 4, y2 - 1)],
      [Math.floor(x1 + w / 2), Math.max(y2 - 5, y1)],
    ];

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let validCount = 0;

    for (const [px, py] of samplePoints) {
      if (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight) {
        const pixelData = ctx.getImageData(px, py, 1, 1).data;
        totalR += pixelData[0];
        totalG += pixelData[1];
        totalB += pixelData[2];
        validCount++;
      }
    }

    if (validCount === 0) return '#ffffff';

    const avgR = Math.round(totalR / validCount);
    const avgG = Math.round(totalG / validCount);
    const avgB = Math.round(totalB / validCount);
    const brightness = (avgR + avgG + avgB) / 3;

    // 말풍선 배경이 밝은 경우(밝기 160 초과) 해당 색상 사용, 그렇지 않으면 순백색(#ffffff)
    if (brightness > 160) {
      return `rgb(${avgR}, ${avgG}, ${avgB})`;
    }
    return '#ffffff';
  } catch (err) {
    return '#ffffff';
  }
}

/**
 * 주어진 maxWidth에 맞춰 한국어/영문 텍스트를 자연스럽게 줄바꿈
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      lines.push('');
      continue;
    }

    let currentLine = '';
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= maxWidth) {
        currentLine = testLine;
      } else {
        // 단어 자체가 너무 긴 경우 한 글자씩 분할
        if (!currentLine) {
          let charLine = '';
          for (let j = 0; j < word.length; j++) {
            const ch = word[j];
            const testCharLine = charLine + ch;
            if (ctx.measureText(testCharLine).width <= maxWidth) {
              charLine = testCharLine;
            } else {
              if (charLine) lines.push(charLine);
              charLine = ch;
            }
          }
          currentLine = charLine;
        } else {
          lines.push(currentLine);
          // 다음 줄에서 단어 재검사
          if (ctx.measureText(word).width <= maxWidth) {
            currentLine = word;
          } else {
            let charLine = '';
            for (let j = 0; j < word.length; j++) {
              const ch = word[j];
              const testCharLine = charLine + ch;
              if (ctx.measureText(testCharLine).width <= maxWidth) {
                charLine = testCharLine;
              } else {
                if (charLine) lines.push(charLine);
                charLine = ch;
              }
            }
            currentLine = charLine;
          }
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [text];
}

/**
 * 박스 가용 영역에 최적으로 들어맞는 폰트 크기 및 줄바꿈 결과 탐색
 */
export function findBestFontAndLines(ctx, text, maxW, maxH, minSize = 11, maxSize = 42) {
  const fontFamily = "'Nanum Gothic', 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";

  // 큰 폰트 크기부터 점진적으로 줄이며 최적 크기 탐색
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `bold ${size}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxW);
    if (!lines || lines.length === 0) continue;

    const lineSpacing = Math.round(size * 0.28);
    const lineHeight = Math.round(size * 1.15);
    const totalH = lines.length * lineHeight + (lines.length - 1) * lineSpacing;

    // 모든 줄이 maxW를 초과하지 않는지 확인
    let fitsWidth = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxW) {
        fitsWidth = false;
        break;
      }
    }

    if (fitsWidth && totalH <= maxH) {
      return { fontSize: size, lines, lineHeight, lineSpacing, totalH };
    }
  }

  // 최소 폰트 크기 적용
  ctx.font = `bold ${minSize}px ${fontFamily}`;
  const fallbackLines = wrapText(ctx, text, maxW);
  const fallbackLineHeight = Math.round(minSize * 1.15);
  const fallbackLineSpacing = Math.round(minSize * 0.28);
  const fallbackTotalH = fallbackLines.length * fallbackLineHeight + (fallbackLines.length - 1) * fallbackLineSpacing;

  return {
    fontSize: minSize,
    lines: fallbackLines,
    lineHeight: fallbackLineHeight,
    lineSpacing: fallbackLineSpacing,
    totalH: fallbackTotalH,
  };
}

/**
 * 무료 모드용 가상 대사 및 좌표 생성
 */
export function generateFreeModeDetections() {
  return [
    {
      box_2d: [120, 120, 260, 480],
      original_text: '[GUEST MODE] Speech bubble detected!',
      translated_text: '[게스트/무료 모드] 만화 대사 영역 감지 완료!',
    },
    {
      box_2d: [140, 560, 280, 880],
      original_text: 'Canvas offline typesetting complete!',
      translated_text: '브라우저 Canvas 로컬 엔진으로 식자 합성 완료!',
    },
    {
      box_2d: [760, 160, 920, 840],
      original_text: 'Enter Gemini API Key to activate AI translation!',
      translated_text: '상단 [API 키 설정]에서 Gemini 키를 입력하면 AI 자동 번역이 활성화됩니다!',
    },
  ];
}

/**
 * Gemini AI 안전 필터(SAFETY Block) 차단 시 대체 식자 데이터 생성
 * 성인/선정성/민감성 검열로 인해 AI 응답이 거부되었을 때 원본 이미지에 로컬 대체 식자를 적용합니다.
 */
export function generateSafetyBlockDetections() {
  return [
    {
      box_2d: [100, 120, 240, 880],
      original_text: '[Gemini Safety Filter Blocked]',
      translated_text: '⚠️ [안내] Gemini AI 안전 필터(선정성/민감도)에 의해 자동 번역이 차단되었습니다.',
    },
    {
      box_2d: [760, 140, 910, 860],
      original_text: '[Local Typesetting Fallback Applied]',
      translated_text: '✨ [로컬 엔진] 원본 이미지를 유지하며 대체 식자를 합성하여 ZIP에 보존했습니다.',
    },
  ];
}

/**
 * 만화 이미지에 대사 감지 결과(detections)를 식자 합성(Typesetting)하여 Blob 생성
 * @param {Blob|File|string} imageSource - 원본 이미지
 * @param {Array<{box_2d: number[], translated_text: string}>} detections - 말풍선 및 번역 대사 목록
 * @returns {Promise<Blob>} 합성 완료된 이미지 Blob
 */
export async function typesetComicImage(imageSource, detections = [], fileName = '') {
  const img = await loadImage(imageSource);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. 원본 이미지 캔버스에 그리기
  ctx.drawImage(img, 0, 0, width, height);

  // 2. 검출된 각 말풍선 영역 마스킹 & 한글 대사 식자
  for (const item of detections) {
    const box2d = item?.box_2d;
    const text = (item?.translated_text || '').trim();

    if (!box2d || box2d.length !== 4 || !text) continue;

    const [ymin, xmin, ymax, xmax] = box2d;

    // 0~1000 정규화 좌표를 실제 캔버스 픽셀 좌표로 변환
    const x1 = Math.max(0, Math.floor((xmin * width) / 1000));
    const y1 = Math.max(0, Math.floor((ymin * height) / 1000));
    const x2 = Math.min(width, Math.ceil((xmax * width) / 1000));
    const y2 = Math.min(height, Math.ceil((ymax * height) / 1000));

    const boxW = x2 - x1;
    const boxH = y2 - y1;

    if (boxW <= 8 || boxH <= 8) continue;

    // 말풍선 배경색 샘플링
    const bgColor = sampleBackgroundColor(ctx, x1, y1, x2, y2, width, height);

    // 1단계: 말풍선 영역 마스킹 (타원 또는 둥근 사각형으로 원문 대사 덮기)
    ctx.save();
    ctx.fillStyle = bgColor;

    const radius = Math.min(12, Math.floor(boxW / 5), Math.floor(boxH / 5));
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x1, y1, boxW, boxH, radius);
      ctx.fill();
    } else {
      ctx.fillRect(x1, y1, boxW, boxH);
    }
    ctx.restore();

    // 2단계: 최적 폰트 크기 및 줄바꿈 계산 (여백 패딩 8% 적용)
    const padX = Math.max(4, Math.floor(boxW * 0.08));
    const padY = Math.max(4, Math.floor(boxH * 0.08));
    const availW = Math.max(10, boxW - padX * 2);
    const availH = Math.max(10, boxH - padY * 2);

    const maxFontSize = Math.min(42, Math.max(14, Math.floor(availH * 0.5)));
    const { fontSize, lines, lineHeight, lineSpacing, totalH } = findBestFontAndLines(
      ctx,
      text,
      availW,
      availH,
      11,
      maxFontSize
    );

    // 3단계: 식자 텍스트 드로잉 (중앙 정렬 + 고가독성 흰색 스트로크 외곽선)
    ctx.save();
    const fontFamily = "'Nanum Gothic', 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const startY = y1 + padY + Math.max(0, Math.floor((availH - totalH) / 2));
    const centerX = x1 + padX + Math.floor(availW / 2);

    let currentY = startY + Math.floor(lineHeight / 2);

    for (const line of lines) {
      // 가독성을 위한 또렷한 흰색 외곽선 (텍스트 스트로크)
      ctx.lineWidth = Math.max(2, Math.min(4, Math.floor(fontSize * 0.18)));
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(line, centerX, currentY);

      // 본문 텍스트 (짙은 슬레이트 블랙)
      ctx.fillStyle = '#0f172a';
      ctx.fillText(line, centerX, currentY);

      currentY += lineHeight + lineSpacing;
    }
    ctx.restore();
  }

  // 3. Blob으로 변환 (WebP/PNG/JPEG 원본 형식 유지)
  let outputMime = 'image/jpeg';
  const lowerName = (fileName || '').toLowerCase();
  if (lowerName.endsWith('.webp')) outputMime = 'image/webp';
  else if (lowerName.endsWith('.png')) outputMime = 'image/png';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // 브라우저가 특정 MIME을 지원하지 않을 때 JPEG로 폴백
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) resolve(fallbackBlob);
              else reject(new Error('Canvas 이미지를 Blob으로 변환하지 못했습니다.'));
            },
            'image/jpeg',
            0.95
          );
        }
      },
      outputMime,
      0.95
    );
  });
}
