# Sublyx - AI Video Captioning

Sublyx is a robust, SaaS-grade web application that automatically transcribes and transliterates Tamil and English videos into timestamped Tanglish (and English) captions using state-of-the-art AI models.

## Features
- **Whisper Large-V3 Transcription:** Uses OpenAI's most precise Whisper model via Groq Cloud for crystal-clear speech recognition.
- **Llama 3.3 70B Translation:** Powered by the massive 70-Billion parameter Llama model for flawless Tamil-to-English and Tamil-to-Tanglish conversion.
- **Intelligent Transliteration:** Converts Tamil script to natural, colloquial Tanglish with extreme precision.
- **Multilingual Support:** Handles English code-switching natively.
- **Export Options:** Download SRT, WebVTT, or Plain Text.
- **3D Premium UI:** Built with React Three Fiber, Framer Motion, and Tailwind CSS for a stunning visual experience.

## Tech Stack

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Framer Motion (micro-animations)
- React Three Fiber + Drei (3D background)
- Lucide Icons

### Backend
- FastAPI (Python)
- Whisper Large-V3 (via Groq Cloud API)
- Llama 3.3 70B Versatile (via Groq Cloud API)
- MongoDB Atlas / SQLite (database)
- FFmpeg (audio extraction)

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

Create a `.env` file in the `backend` directory:

```env
TRANSCRIBE_BACKEND=groq
GROQ_API_KEY=your_groq_api_key_here
MONGO_URI=your_mongodb_uri_here
MONGO_DB_NAME=sublyx
```

Run the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

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
- **Transcription:** Whisper Large-V3 (via Groq Cloud — zero-temperature deterministic mode)
- **Translation:** Llama 3.3 70B Versatile (via Groq Cloud — JSON structured output)
- **Database:** MongoDB Atlas or local SQLite via `aiosqlite`.
- **Frontend:** React 19, TypeScript, Vite, TailwindCSS v4, Framer Motion, React Three Fiber.
