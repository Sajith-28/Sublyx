# CaptionAI - Tanglish Video Captions

CaptionAI is a robust, local-first web application that automatically transcribes and transliterates Tamil and English videos into timestamped Tanglish (and English) captions.

## Features
- **Local & Private:** Uses `faster-whisper` and Silero VAD for local transcription (no data leaves your machine).
- **Intelligent Transliteration:** Converts Tamil script to natural, colloquial Tanglish using a custom rule-based engine and dictionary lookups.
- **Multilingual Support:** Handles English code-switching natively.
- **Gemini Polish (Optional):** Optional free-tier Gemini API integration to polish transliteration into native-sounding casual phrases.
- **Export Options:** Download SRT, WebVTT, or Plain Text.

## Prerequisites

- **Python 3.10+**
- **Node.js 20+**
- **FFmpeg:** Ensure `ffmpeg` is installed and available in your system PATH.
- **Docker** (Optional, for containerized deployment)

## Setup & Running Locally

### 1. Backend Setup

Open a terminal and navigate to the `backend` directory:

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
# source venv/bin/activate  # On Mac/Linux

pip install -r requirements.txt
```

Run the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```
*Note: The first time you process a video, the Whisper model (large-v3) will be downloaded locally. This may take some time depending on your internet connection.*

### 2. Frontend Setup

Open a new terminal and navigate to the `frontend` directory:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Docker Deployment

You can run the entire stack using Docker Compose:

```bash
docker-compose up --build
```
- The frontend will run on port `5173`
- The backend will run on port `8000`

## Architecture Highlights
- **Transcription:** `faster-whisper` (CTranslate2 port of OpenAI Whisper large-v3)
- **VAD:** Silero VAD for chunking long audio files to avoid memory limits and boundary errors.
- **Database:** Defaults to local SQLite via `aiosqlite`. Can easily switch to MongoDB by setting the `DATABASE_URL` environment variable.
- **Frontend:** React, TypeScript, Vite, TailwindCSS v4, Lucide Icons.

## Notes
- To use the optional Gemini Polish pass, you will need a valid Google Gemini API key. The key is only stored locally in your browser's LocalStorage and is sent securely with each job request.
