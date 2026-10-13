import os
import re
import json
import logging
from typing import Optional
from google import genai
from google.genai import types
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert manga/comic translator and typesetter AI.
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
Do not wrap with markdown if possible, return strictly valid JSON."""


def clean_json_text(raw_text: str) -> str:
    """마크다운 코드블록이나 불필요한 공백을 제거하여 순수 JSON 텍스트 추출"""
    text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text


def detect_and_translate_comic(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
) -> list[dict]:
    """
    Gemini API를 호출하여 만화 대사 영역 감지 및 한국어 번역 수행.
    반환: list of dict [{"box_2d": [ymin, xmin, ymax, xmax], "original_text": "...", "translated_text": "..."}]
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
    if not resolved_api_key:
        raise ValueError(
            "GEMINI_API_KEY가 설정되지 않았습니다. backend/.env 파일에 키를 입력하거나 요청 헤더에 전달해주세요."
        )

    resolved_model = model_name or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    logger.info(f"[Translator] Using model: {resolved_model}")

    client = genai.Client(api_key=resolved_api_key)

    image_part = types.Part.from_bytes(
        data=image_bytes,
        mime_type=mime_type,
    )

    try:
        response = client.models.generate_content(
            model=resolved_model,
            contents=[image_part, SYSTEM_PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
    except Exception as e:
        logger.error(f"[Translator] Gemini API Call failed with model {resolved_model}: {e}")
        # 혹시 모델명 관련 에러인 경우 fallback 모델 시도 (예: gemini-2.5-flash / gemini-1.5-flash)
        if "not found" in str(e).lower() or "not supported" in str(e).lower():
            fallback_model = "gemini-2.5-flash"
            logger.info(f"[Translator] Retrying with fallback model: {fallback_model}")
            response = client.models.generate_content(
                model=fallback_model,
                contents=[image_part, SYSTEM_PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
        else:
            raise e

    raw_response = response.text or "[]"
    cleaned = clean_json_text(raw_response)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as err:
        logger.error(f"[Translator] Failed to parse JSON: {cleaned}")
        raise ValueError(f"AI 모델 응답을 JSON으로 파싱할 수 없습니다: {err}")

    # 응답이 딕셔너리(예: {"dialogues": [...]})인 경우 처리
    if isinstance(data, dict):
        for key in ["dialogues", "results", "translations", "items"]:
            if key in data and isinstance(data[key], list):
                data = data[key]
                break
        else:
            data = [data]

    if not isinstance(data, list):
        data = []

    # 좌표 검증 및 정제
    valid_items = []
    for item in data:
        if not isinstance(item, dict):
            continue
        box = item.get("box_2d")
        text = item.get("translated_text", "")
        if (
            isinstance(box, list)
            and len(box) == 4
            and all(isinstance(coord, (int, float)) for coord in box)
            and text
        ):
            # 좌표 클램핑 (0~1000)
            ymin, xmin, ymax, xmax = [max(0, min(1000, int(c))) for c in box]
            if ymax > ymin and xmax > xmin:
                valid_items.append({
                    "box_2d": [ymin, xmin, ymax, xmax],
                    "original_text": item.get("original_text", ""),
                    "translated_text": text.strip(),
                })

    logger.info(f"[Translator] Successfully detected and translated {len(valid_items)} dialogues.")
    return valid_items
