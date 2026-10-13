import os
import requests
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = Path(__file__).resolve().parent / "fonts"
DEFAULT_FONT_PATH = FONTS_DIR / "NanumGothic-Bold.ttf"

# 나눔고딕 폰트 다운로드 URL (Google Fonts 공식 raw 저장소)
NANUM_FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Bold.ttf"

# Windows 기본 Fallback 폰트 목록
WINDOWS_FALLBACK_FONTS = [
    r"C:\Windows\Fonts\malgunbd.ttf",   # 맑은 고딕 Bold
    r"C:\Windows\Fonts\malgun.ttf",     # 맑은 고딕
    r"C:\Windows\Fonts\gulim.ttc",      # 굴림
]


def ensure_font_available() -> Path:
    """한글 폰트가 사용 가능한지 확인하고 필요 시 다운로드하거나 fallback 반환"""
    FONTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. 로컬 캐시 확인
    if DEFAULT_FONT_PATH.exists() and DEFAULT_FONT_PATH.stat().st_size > 10000:
        return DEFAULT_FONT_PATH

    # 2. Windows 기본 폰트 확인
    for fallback in WINDOWS_FALLBACK_FONTS:
        if os.path.exists(fallback):
            return Path(fallback)

    # 3. 나눔고딕 다운로드 시도
    try:
        print(f"[Font] Downloading NanumGothic from {NANUM_FONT_URL}...")
        resp = requests.get(NANUM_FONT_URL, timeout=10)
        if resp.status_code == 200 and len(resp.content) > 10000:
            DEFAULT_FONT_PATH.write_bytes(resp.content)
            print("[Font] NanumGothic downloaded successfully.")
            return DEFAULT_FONT_PATH
    except Exception as e:
        print(f"[Font] Failed to download font: {e}")

    # 최종 fallback (기본)
    return DEFAULT_FONT_PATH


def get_font(size: int) -> ImageFont.FreeTypeFont:
    """지정된 크기의 ImageFont 인스턴스 반환"""
    font_path = ensure_font_available()
    try:
        return ImageFont.truetype(str(font_path), size=size)
    except Exception as e:
        print(f"[Font] Error loading font {font_path}: {e}")
        try:
            return ImageFont.truetype("malgun.ttf", size=size)
        except Exception:
            return ImageFont.load_default()


def sample_background_color(image: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    """
    박스 모서리 부근의 배경색을 샘플링하여 말풍선 배경색을 추정.
    대부분의 만화 말풍선은 흰색 또는 아주 밝은 회색이므로 기본값 (255, 255, 255) 적용.
    """
    x1, y1, x2, y2 = box
    w = x2 - x1
    h = y2 - y1

    # 박스가 너무 작으면 흰색 반환
    if w <= 4 or h <= 4:
        return (255, 255, 255)

    try:
        # 네 모서리 안쪽 2~4px 위치 샘플링
        sample_pts = [
            (min(x1 + 3, x2 - 1), min(y1 + 3, y2 - 1)),
            (max(x2 - 4, x1), min(y1 + 3, y2 - 1)),
            (min(x1 + 3, x2 - 1), max(y2 - 4, y1)),
            (max(x2 - 4, x1), max(y2 - 4, y1)),
            (x1 + w // 2, min(y1 + 3, y2 - 1)),
            (x1 + w // 2, max(y2 - 4, y1)),
        ]
        rgb_img = image.convert("RGB")
        colors = [rgb_img.getpixel(pt) for pt in sample_pts if 0 <= pt[0] < image.width and 0 <= pt[1] < image.height]
        if not colors:
            return (255, 255, 255)

        avg_r = sum(c[0] for c in colors) // len(colors)
        avg_g = sum(c[1] for c in colors) // len(colors)
        avg_b = sum(c[2] for c in colors) // len(colors)

        # 밝은 색(말풍선)이면 해당 색 채택, 어두우면 255, 255, 255
        brightness = (avg_r + avg_g + avg_b) / 3
        if brightness > 180:
            return (avg_r, avg_g, avg_b)
        else:
            return (255, 255, 255)
    except Exception:
        return (255, 255, 255)


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """
    주어진 최대 너비(max_width)에 맞춰 텍스트를 자연스럽게 줄바꿈.
    어절(단어) 단위 및 글자(음절) 단위 자동 분할 지원.
    """
    lines = []
    paragraphs = text.split("\n")

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        current_line = ""
        for word in words:
            candidate = f"{current_line} {word}".strip() if current_line else word
            bbox = font.getbbox(candidate)
            w = bbox[2] - bbox[0]

            if w <= max_width:
                current_line = candidate
            else:
                # 단어 자체가 max_width를 초과하는 경우 글자 단위로 분할
                if not current_line:
                    char_line = ""
                    for ch in word:
                        ch_cand = char_line + ch
                        ch_bbox = font.getbbox(ch_cand)
                        if (ch_bbox[2] - ch_bbox[0]) <= max_width:
                            char_line = ch_cand
                        else:
                            if char_line:
                                lines.append(char_line)
                            char_line = ch
                    if char_line:
                        current_line = char_line
                else:
                    lines.append(current_line)
                    # 새 줄에서 단어 처리
                    wb = font.getbbox(word)
                    if (wb[2] - wb[0]) <= max_width:
                        current_line = word
                    else:
                        # 긴 단어 분할
                        char_line = ""
                        for ch in word:
                            ch_cand = char_line + ch
                            ch_bbox = font.getbbox(ch_cand)
                            if (ch_bbox[2] - ch_bbox[0]) <= max_width:
                                char_line = ch_cand
                            else:
                                if char_line:
                                    lines.append(char_line)
                                char_line = ch
                        current_line = char_line

        if current_line:
            lines.append(current_line)

    return lines if lines else [text]


def find_best_font_and_lines(
    text: str,
    max_w: int,
    max_h: int,
    min_size: int = 11,
    max_size: int = 48
) -> tuple[ImageFont.FreeTypeFont, list[str], int, int]:
    """
    주어진 박스 가용 영역에 알맞은 최적 폰트 크기 및 줄바꿈 결과 탐색.
    (font, lines, total_width, total_height) 반환
    """
    best_font = get_font(min_size)
    best_lines = [text]
    best_w = max_w
    best_h = max_h

    # 폰트 크기를 큰 값부터 줄여가며 가장 잘 들어맞는 크기 탐색
    for size in range(max_size, min_size - 1, -2):
        font = get_font(size)
        lines = wrap_text(text, font, max_w)
        if not lines:
            continue

        # 라인 높이 및 간격 계산
        line_heights = []
        line_widths = []
        for line in lines:
            bbox = font.getbbox(line)
            line_w = bbox[2] - bbox[0]
            line_h = bbox[3] - bbox[1]
            line_widths.append(line_w)
            line_heights.append(line_h)

        line_spacing = int(size * 0.25)
        total_h = sum(line_heights) + line_spacing * (len(lines) - 1)
        max_line_w = max(line_widths) if line_widths else 0

        if max_line_w <= max_w and total_h <= max_h:
            return font, lines, max_line_w, total_h

    # 맞지 않더라도 최소 폰트 크기 적용
    min_font = get_font(min_size)
    min_lines = wrap_text(text, min_font, max_w)
    return min_font, min_lines, max_w, max_h


def typeset_comic_image(
    image: Image.Image,
    detections: list[dict]
) -> Image.Image:
    """
    만화 이미지에 번역 대사 식자(Typesetting) 합성
    1. 각 대사 박스 마스킹 (배경 지우기)
    2. 한글 번역 텍스트 자동 줄바꿈 & 폰트 크기 최적화 렌더링
    """
    # RGB 변환 (합성용 사본)
    result_image = image.convert("RGB").copy()
    draw = ImageDraw.Draw(result_image)
    width, height = result_image.size

    for item in detections:
        box_2d = item.get("box_2d")
        translated_text = item.get("translated_text", "").strip()

        if not box_2d or len(box_2d) != 4 or not translated_text:
            continue

        ymin, xmin, ymax, xmax = box_2d

        # 0~1000 정규화 좌표 -> 실제 픽셀 변환
        x1 = max(0, int(xmin * width / 1000.0))
        y1 = max(0, int(ymin * height / 1000.0))
        x2 = min(width, int(xmax * width / 1000.0))
        y2 = min(height, int(ymax * height / 1000.0))

        box_w = x2 - x1
        box_h = y2 - y1

        if box_w <= 8 or box_h <= 8:
            continue

        # 1. 말풍선 배경색 샘플링 및 마스킹
        bg_color = sample_background_color(result_image, (x1, y1, x2, y2))
        corner_radius = min(10, box_w // 5, box_h // 5)

        # 둥근 사각형으로 자연스럽게 텍스트 영역 마스킹
        try:
            draw.rounded_rectangle(
                [x1, y1, x2, y2],
                radius=corner_radius,
                fill=bg_color
            )
        except Exception:
            draw.rectangle([x1, y1, x2, y2], fill=bg_color)

        # 2. 식자(Typesetting) - 패딩 고려
        pad_x = max(4, int(box_w * 0.08))
        pad_y = max(4, int(box_h * 0.08))
        avail_w = max(10, box_w - pad_x * 2)
        avail_h = max(10, box_h - pad_y * 2)

        # 박스 크기에 비례한 최대 폰트 크기 지정
        max_font_size = min(42, max(14, int(avail_h * 0.55)))
        font, lines, text_w, text_h = find_best_font_and_lines(
            translated_text,
            avail_w,
            avail_h,
            min_size=11,
            max_size=max_font_size
        )

        # 라인별 높이 측정
        line_metrics = []
        for line in lines:
            bbox = font.getbbox(line)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            line_metrics.append((w, h))

        line_spacing = int(font.size * 0.25)
        total_text_h = sum(m[1] for m in line_metrics) + line_spacing * max(0, len(lines) - 1)

        # 수직 중앙 정렬
        current_y = y1 + pad_y + max(0, (avail_h - total_text_h) // 2)

        # 각 줄 렌더링 (가운데 정렬 + 고가독성 흰색 스트로크)
        for (line, (lw, lh)) in zip(lines, line_metrics):
            line_x = x1 + pad_x + max(0, (avail_w - lw) // 2)

            # 가독성을 위한 또렷한 텍스트 (스트로크)
            draw.text(
                (line_x, current_y),
                line,
                font=font,
                fill=(15, 15, 15),
                stroke_width=2,
                stroke_fill=(255, 255, 255)
            )
            current_y += lh + line_spacing

    return result_image
