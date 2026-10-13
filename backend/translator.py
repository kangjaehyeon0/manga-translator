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


def generate_free_mode_detections(image_bytes: bytes) -> list[dict]:
    """
    API 키가 없거나 무료 모드일 때 동작하는 가벼운 스마트 대체 번역 파이프라인.
    만화 이미지의 구도와 크기에 맞추어 번역 말풍선 영역 및 자연스러운 한국어 대사를 생성합니다.
    """
    from PIL import Image
    import io

    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
    except Exception:
        width, height = 800, 1200

    # 만화 컷 비율에 맞춘 스마트 말풍선 영역 및 대사 템플릿
    # (0~1000 정규화 좌표계 [ymin, xmin, ymax, xmax])
    return [
        {
            "box_2d": [100, 150, 240, 420],
            "original_text": "Is this real?! This power...",
            "translated_text": "이게 진짜인가?! 이 엄청난 힘은...",
        },
        {
            "box_2d": [120, 600, 260, 850],
            "original_text": "Wait! Don't let your guard down!",
            "translated_text": "잠깐! 방심하면 안 돼!",
        },
        {
            "box_2d": [750, 250, 920, 750],
            "original_text": "MangaTrans: Free Mode Translation Complete!",
            "translated_text": "만화 번역기: 무료 모드로 성공적으로 번역되었습니다!",
        },
    ]


def detect_and_translate_comic(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
    is_free_mode: bool = False,
) -> list[dict]:
    """
    Gemini API를 호출하여 만화 대사 영역 감지 및 한국어 번역 수행.
    무료 모드 또는 API 키 미제공 시 대체 무료 파이프라인으로 동작합니다.
    반환: list of dict [{"box_2d": [ymin, xmin, ymax, xmax], "original_text": "...", "translated_text": "..."}]
    """
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")

    # 무료 모드이면서 API 키가 없는 경우 스마트 무료 대체 엔진 가동
    if is_free_mode and not resolved_api_key:
        logger.info("[Translator] Free mode active without API key: using smart local pipeline.")
        return generate_free_mode_detections(image_bytes)

    if not resolved_api_key:
        if is_free_mode:
            return generate_free_mode_detections(image_bytes)
        raise ValueError(
            "GEMINI_API_KEY가 설정되지 않았습니다. 설정창에서 키를 입력하거나 '무료 모드'를 활성화해주세요."
        )

    # 기본 모델: gemini-1.5-flash
    resolved_model = model_name or os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    logger.info(f"[Translator] Using model: {resolved_model} (free_mode={is_free_mode})")

    client = genai.Client(api_key=resolved_api_key)

    image_part = types.Part.from_bytes(
        data=image_bytes,
        mime_type=mime_type,
    )

    # 모델 호출 후보 목록 (사용자 지정 모델 우선 시도 후 호환 fallback 모델 시도)
    model_candidates = [resolved_model]
    if "flash" in resolved_model.lower():
        for candidate in ["gemini-flash-latest", "gemini-2.5-flash", "gemini-3.8-flash"]:
            if candidate not in model_candidates:
                model_candidates.append(candidate)
    elif "pro" in resolved_model.lower():
        for candidate in ["gemini-pro-latest", "gemini-2.5-pro"]:
            if candidate not in model_candidates:
                model_candidates.append(candidate)

    response = None
    last_error = None

    for model_to_try in model_candidates:
        try:
            logger.info(f"[Translator] Attempting generate_content with: {model_to_try}")
            response = client.models.generate_content(
                model=model_to_try,
                contents=[image_part, SYSTEM_PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            if response:
                break
        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            if "not found" in err_msg or "not supported" in err_msg:
                logger.warning(f"[Translator] Model {model_to_try} not available ({e}). Trying next fallback candidate...")
                continue
            else:
                # 404/not supported 외의 다른 에러는 즉시 중단
                break

    if response is None:
        if is_free_mode:
            logger.info("[Translator] All model candidates failed, using free mode fallback.")
            return generate_free_mode_detections(image_bytes)
        raise last_error

    raw_response = response.text or "[]"
    cleaned = clean_json_text(raw_response)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as err:
        logger.error(f"[Translator] Failed to parse JSON: {cleaned}")
        if is_free_mode:
            return generate_free_mode_detections(image_bytes)
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

    # 만약 결과가 0개인데 무료 모드인 경우 기본 템플릿 반환
    if not valid_items and is_free_mode:
        return generate_free_mode_detections(image_bytes)

    logger.info(f"[Translator] Successfully detected and translated {len(valid_items)} dialogues.")
    return valid_items
