import io
import os
import re
import zipfile
import base64
import logging
from typing import Optional
from fastapi import FastAPI, File, UploadFile, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from PIL import Image
from pathlib import Path
from dotenv import load_dotenv

from translator import detect_and_translate_comic
from typesetter import typeset_comic_image

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("manga-translator")

app = FastAPI(
    title="Comic Manga Translation & Typesetting API",
    description="만화 이미지의 대사를 인식하여 한국어로 번역 및 식자 합성하는 API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    """서버 상태 및 API 키 설정 여부 확인"""
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    env_key = os.getenv("GEMINI_API_KEY", "").strip()
    default_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    return {
        "status": "healthy",
        "has_api_key": bool(env_key),
        "model": default_model,
        "supported_models": [
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "desc": "기본값, 빠르고 안정적"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "desc": "정밀 번역"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "desc": "초고속 차세대"},
        ],
        "free_mode_supported": True,
    }


def natural_sort_key(s: str):
    """사람이 인식하는 번호 순서(01, 02, 10)대로 파일명을 정렬하는 키"""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


@app.post("/api/translate")
async def translate_comic(
    file: UploadFile = File(...),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    x_gemini_model: Optional[str] = Header(None, alias="X-Gemini-Model"),
    x_free_mode: Optional[str] = Header(None, alias="X-Free-Mode"),
):
    """
    만화 이미지(JPG/PNG/WEBP) 또는 이미지들이 압축된 ZIP 파일을 업로드받아
    선택한 Gemini 모델(또는 무료 모드)을 통해 대사를 번역 및 식자 합성하여 반환합니다.
    - 단일 이미지: JPG 바이너리 반환 (image/jpeg)
    - ZIP 압축 파일: 번역된 이미지들이 담긴 ZIP 바이너리 반환 (application/zip)
    """
    filename = file.filename or "uploaded"
    is_zip = filename.lower().endswith(".zip") or file.content_type in [
        "application/zip",
        "application/x-zip-compressed",
        "multipart/x-zip",
    ]
    is_free = (x_free_mode or "").strip().lower() in ["true", "1", "yes"]

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="빈 파일이 업로드되었습니다."
        )

    # 1. ZIP 압축 파일 일괄 처리
    if is_zip:
        try:
            in_zip_io = io.BytesIO(file_bytes)
            if not zipfile.is_zipfile(in_zip_io):
                raise ValueError("유효한 ZIP 파일 형식이 아닙니다.")

            with zipfile.ZipFile(in_zip_io, "r") as in_zip:
                # 유효한 이미지 확장자만 필터링 (숨김 파일 및 맥 시스템 폴더 제외)
                valid_extensions = (".jpg", ".jpeg", ".png", ".webp")
                all_entries = []
                for zip_info in in_zip.infolist():
                    name = zip_info.filename
                    # 한글 파일명 cp437 인코딩 보정 시도
                    if not (zip_info.flag_bits & 0x800):
                        try:
                            name = name.encode('cp437').decode('cp949')
                        except Exception:
                            try:
                                name = name.encode('cp437').decode('utf-8')
                            except Exception:
                                pass
                    
                    if (not name.startswith("__MACOSX")
                        and not os.path.basename(name).startswith(".")
                        and not zip_info.is_dir()
                        and name.lower().endswith(valid_extensions)):
                        all_entries.append((zip_info, name))

                # 자연스러운 페이지 번호 순서로 정렬
                all_entries.sort(key=lambda item: natural_sort_key(item[1]))

                if not all_entries:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="ZIP 파일 안에 처리 가능한 이미지(JPG, PNG, WebP)가 없습니다."
                    )

                logger.info(f"[ZIP Batch] Total {len(all_entries)} images found in {filename} (Model: {x_gemini_model}, Free: {is_free}).")

                # 결과 ZIP 생성
                out_zip_io = io.BytesIO()
                total_dialogues = 0
                failed_pages = []

                with zipfile.ZipFile(out_zip_io, "w", compression=zipfile.ZIP_DEFLATED) as out_zip:
                    for idx, (zip_info, clean_name) in enumerate(all_entries, 1):
                        logger.info(f"[ZIP Batch] Processing ({idx}/{len(all_entries)}): {clean_name}")
                        try:
                            raw_img_bytes = in_zip.read(zip_info.filename)
                            pil_img = Image.open(io.BytesIO(raw_img_bytes))

                            # MIME 타입 추정
                            ext = os.path.splitext(clean_name)[1].lower()
                            mime_type = "image/png" if ext == ".png" else "image/jpeg"

                            # 1) 번역
                            detections = detect_and_translate_comic(
                                image_bytes=raw_img_bytes,
                                mime_type=mime_type,
                                api_key=x_gemini_api_key,
                                model_name=x_gemini_model,
                                is_free_mode=is_free,
                            )
                            total_dialogues += len(detections)

                            # 2) 식자 합성
                            typeset_img = typeset_comic_image(pil_img, detections)

                            # 3) JPG로 인코딩하여 출력 ZIP에 저장
                            out_img_io = io.BytesIO()
                            typeset_img.save(out_img_io, format="JPEG", quality=95)

                            base_name = os.path.splitext(os.path.basename(clean_name))[0]
                            out_filename = f"{base_name}_translated.jpg"
                            out_zip.writestr(out_filename, out_img_io.getvalue())
                        except Exception as page_err:
                            logger.error(f"[ZIP Batch] Error on page {clean_name}: {page_err}", exc_info=True)
                            failed_pages.append(os.path.basename(clean_name))
                            # 페이지 처리 실패 시 원본 그대로 보존 (failed_ 접두사)
                            out_zip.writestr(f"failed_{os.path.basename(clean_name)}", raw_img_bytes)

            from urllib.parse import quote
            safe_filename = filename if filename.lower().endswith('.zip') else f"{filename}.zip"
            encoded_fn = quote(f"translated_{safe_filename}")
            out_zip_bytes = out_zip_io.getvalue()
            return Response(
                content=out_zip_bytes,
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_fn}; filename=\"translated_{safe_filename}\"",
                    "X-Dialogue-Count": str(total_dialogues),
                    "X-Total-Pages": str(len(all_entries)),
                    "X-Failed-Count": str(len(failed_pages)),
                    "X-Is-Zip": "true",
                    "X-Applied-Model": x_gemini_model or "gemini-1.5-flash",
                    "X-Used-Mode": "free" if is_free else "api",
                    "Access-Control-Expose-Headers": "Content-Disposition, X-Dialogue-Count, X-Total-Pages, X-Failed-Count, X-Is-Zip, X-Applied-Model, X-Used-Mode",
                }
            )
        except HTTPException:
            raise
        except Exception as zip_err:
            logger.error(f"ZIP batch translation error: {zip_err}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"ZIP 파일 일괄 번역 중 오류가 발생했습니다: {str(zip_err)}"
            )

    # 2. 단일 이미지 파일 처리
    if not (file.content_type and file.content_type.startswith("image/")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일(JPG, PNG 등) 또는 ZIP 압축 파일만 업로드할 수 있습니다."
        )

    try:
        pil_image = Image.open(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"유효하지 않은 이미지 파일입니다: {e}"
        )

    mime_type = file.content_type or "image/jpeg"

    # Gemini AI 말풍선 인식 및 한국어 번역 (또는 무료 모드)
    try:
        detections = detect_and_translate_comic(
            image_bytes=file_bytes,
            mime_type=mime_type,
            api_key=x_gemini_api_key,
            model_name=x_gemini_model,
            is_free_mode=is_free,
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Translation pipeline error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"번역 및 식자 처리 중 오류가 발생했습니다: {str(e)}"
        )

    # 식자 합성
    try:
        translated_pil = typeset_comic_image(pil_image, detections)
    except Exception as e:
        logger.error(f"Typesetting synthesis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"식자 이미지 렌더링 중 오류가 발생했습니다: {str(e)}"
        )

    output_io = io.BytesIO()
    translated_pil.save(output_io, format="JPEG", quality=95)
    output_bytes = output_io.getvalue()

    return Response(
        content=output_bytes,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": "inline; filename=translated.jpg",
            "X-Dialogue-Count": str(len(detections)),
            "X-Is-Zip": "false",
            "X-Applied-Model": x_gemini_model or "gemini-1.5-flash",
            "X-Used-Mode": "free" if is_free else "api",
            "Access-Control-Expose-Headers": "X-Dialogue-Count, X-Is-Zip, X-Applied-Model, X-Used-Mode",
        }
    )


@app.post("/api/translate-data")
async def translate_comic_with_metadata(
    file: UploadFile = File(...),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-Api-Key"),
    x_gemini_model: Optional[str] = Header(None, alias="X-Gemini-Model"),
    x_free_mode: Optional[str] = Header(None, alias="X-Free-Mode"),
):
    """
    디버그 및 풍부한 UI를 위해 번역 결과 이미지(Base64)와
    감지된 말풍선/대사 메타데이터 JSON을 함께 반환하는 보조 엔드포인트.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드할 수 있습니다."
        )

    is_free = (x_free_mode or "").strip().lower() in ["true", "1", "yes"]
    image_bytes = await file.read()
    pil_image = Image.open(io.BytesIO(image_bytes))
    mime_type = file.content_type or "image/jpeg"

    detections = detect_and_translate_comic(
        image_bytes=image_bytes,
        mime_type=mime_type,
        api_key=x_gemini_api_key,
        model_name=x_gemini_model,
        is_free_mode=is_free,
    )

    translated_pil = typeset_comic_image(pil_image, detections)

    output_io = io.BytesIO()
    translated_pil.save(output_io, format="JPEG", quality=95)
    translated_b64 = base64.b64encode(output_io.getvalue()).decode("utf-8")

    return JSONResponse({
        "success": True,
        "dialogue_count": len(detections),
        "dialogues": detections,
        "model": x_gemini_model or "gemini-1.5-flash",
        "free_mode": is_free,
        "image_data_url": f"data:image/jpeg;base64,{translated_b64}",
    })


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
