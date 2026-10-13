# ⚡ MangaTrans - Gemini 3.8 Flash 만화 번역 & 식자 합성 풀스택 서비스

Google Gemini 3.8 Flash 비전 모델을 활용하여 만화/웹툰 이미지 속 말풍선 대사를 감지하고, 자연스러운 한국어로 번역한 후 원본 이미지에 자동 식자(Typesetting) 합성하는 풀스택 웹 애플리케이션입니다.

---

## 🌟 주요 기능

1. **AI 기반 말풍선 탐지 & 번역 (`gemini-3.8-flash`)**
   - 이미지 내 대사 영역의 정규화된 2D 바운딩 박스 `[ymin, xmin, ymax, xmax]`(0~1000)를 정확히 탐지합니다.
   - 문맥에 맞는 매끄럽고 생생한 만화 대화체 한국어로 번역합니다.
2. **정교한 식자(Typesetting) 합성 파이프라인 (Pillow / PIL)**
   - **배경 마스킹(Inpainting)**: 말풍선 내부 텍스트 영역을 주변 배경색 샘플링 및 부드러운 라운드 사각형으로 지웁니다.
   - **스마트 폰트 크기 & 줄바꿈 조절**: 박스 너비와 높이에 최적화된 글자 크기를 자동 계산하여 어절/음절 단위로 자연스럽게 줄바꿈합니다.
   - **고가독성 렌더링**: 나눔고딕 볼드 / 맑은 고딕 볼드 폰트와 외곽선(Stroke) 처리를 적용하여 만화 특유의 선명한 식자를 구현합니다.
3. **인터랙티브 웹 프론트엔드 (React + Vite + Tailwind CSS)**
   - 드래그 앤 드롭 및 파일 선택 지원 (JPG, PNG, WebP).
   - 즉시 테스트 가능한 **샘플 만화 컷 생성기** 탑재.
   - 다단계 로딩 인디케이터 (비전 분석 ➔ 번역 ➔ 식자 합성).
   - **Side-by-Side(좌우 나란히 비교)** 및 **Split Slider(인터랙티브 슬라이더 비교)** 뷰어 제공.
   - 번역 완료 이미지 원클릭 다운로드 기능.
   - 브라우저 상에서 편리하게 API 키를 입력/저장할 수 있는 모달 지원.

---

## 📁 프로젝트 구조

```
번역/
├── backend/
│   ├── main.py              # FastAPI 서버 진입점 및 /api/translate 엔드포인트
│   ├── translator.py        # google-genai SDK 연동 및 말풍선 감지/번역
│   ├── typesetter.py        # Pillow 기반 마스킹 & 한글 폰트 자동 줄바꿈/식자 렌더링
│   ├── requirements.txt     # Python 패키지 의존성
│   ├── .env                 # 환경변수 설정 파일 (API 키 설정)
│   ├── .env.example         # 환경변수 템플릿
│   └── fonts/               # 폰트 캐시 디렉터리 (NanumGothic-Bold.ttf 자동 다운로드)
├── frontend/
│   ├── index.html           # HTML 진입점 (Pretendard 폰트 포함)
│   ├── package.json         # React, Vite, Tailwind CSS 패키지
│   ├── vite.config.js       # Vite 설정 및 /api 프록시 연동
│   ├── tailwind.config.js   # Tailwind 스타일 설정
│   └── src/
│       ├── App.jsx          # 메인 애플리케이션 컴포넌트
│       ├── index.css        # 스타일시트 및 글래스모피즘
│       └── components/
│           ├── Header.jsx              # 상단 네비게이션 & API 키 상태
│           ├── ImageUploader.jsx       # 드래그 앤 드롭 & 파일 미리보기 & 샘플 생성
│           ├── TranslationProgress.jsx # 단계별 로딩 인디케이터
│           ├── ComparisonViewer.jsx    # 좌우 비교 & 슬라이더 비교 뷰어
│           └── ApiKeyModal.jsx         # Gemini API 키 설정 모달
├── run_all.bat              # 풀스택 전체 원클릭 동시 실행 스크립트
├── run_backend.bat          # 백엔드 서버 원클릭 실행 스크립트
├── run_frontend.bat         # 프론트엔드 개발 서버 원클릭 실행 스크립트
└── README.md                # 실행 가이드 및 프로젝트 문서
```

---

## 🚀 빠른 시작 (원클릭 실행)

### 방법 1. 원클릭 배치 파일 실행 (가장 추천)
프로젝트 루트 폴더에서:
- **`run_all.bat`** 파일을 더블클릭하면 백엔드와 프론트엔드가 각각 새 창으로 자동 실행됩니다.
  - 백엔드 주소: `http://localhost:8000`
  - 프론트엔드 웹 UI: `http://localhost:5173`

---

## 🛠️ 수동 실행 가이드

### 1. 환경변수 설정 (`.env`)
`backend/.env` 파일을 열고 본인의 Google Gemini API 키를 입력합니다.
([Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 발급 가능)

```env
# backend/.env
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.8-flash
PORT=8000
```
> **참고**: `.env`에 키를 넣지 않더라도, 웹 화면 우측 상단의 **[API 키 설정]** 버튼을 통해 브라우저에서 직접 입력하여 사용할 수도 있습니다.

### 2. 백엔드 실행
터미널을 열고 다음 명령어를 실행합니다:

```powershell
# 가상환경 활성화
backend\venv\Scripts\activate

# 패키지 설치 (최초 1회)
pip install -r backend/requirements.txt

# 백엔드 서버 실행
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 프론트엔드 실행
새 터미널을 열고 다음 명령어를 실행합니다:

```powershell
cd frontend

# 패키지 설치 (최초 1회)
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

---

## 📡 API 엔드포인트 명세

### `POST /api/translate`
만화 이미지를 업로드받아 한국어 대사로 식자 합성된 최종 JPG 바이너리를 반환합니다.

- **Request**:
  - `Content-Type`: `multipart/form-data`
  - `file`: 업로드할 이미지 파일 (JPG/PNG/WEBP)
  - `Header`: `X-Gemini-Api-Key` (선택 사항: 클라이언트 키 오버라이드)
- **Response**:
  - `Content-Type`: `image/jpeg`
  - `Headers`:
    - `Content-Disposition`: `inline; filename=translated.jpg`
    - `X-Dialogue-Count`: 감지 및 번역된 대사 개수

### `GET /api/health`
서버 상태 및 환경변수 API 키 등록 여부를 확인합니다.

---

## 💡 식자(Typesetting) 세부 구현 특징

- **자동 폰트 폴백(Fallback)**:
  1. `backend/fonts/NanumGothic-Bold.ttf`가 없을 경우 Google Fonts 저장소에서 자동 다운로드
  2. 네트워크 제한 환경 시 Windows 내장 `C:\Windows\Fonts\malgunbd.ttf`(맑은 고딕 볼드) 자동 폴백
- **외곽선(Stroke) 렌더링**:
  어두운 배경이나 다양한 톤의 만화 원고에서도 텍스트가 묻히지 않도록 글자 주변에 미세한 흰색 스트로크(`stroke_width=2`, `stroke_fill=(255,255,255)`)를 자동으로 입혀 식자 품질을 극대화합니다.
