# ResearchAI — Intelligent Document Analysis SaaS Platform

ResearchAI is a secure, enterprise-grade, vector-powered document analysis platform that enables academic researchers, engineers, and analysts to upload large PDF documents, textbooks, and code repositories to extract summaries, key metrics, recommendations, and structured research reports in seconds.

The application is structured as a decoupled full-stack architecture with a FastAPI backend and a Vite React SPA frontend, supporting secure session authentication, dynamic user profile management, multi-tier subscriptions (Stripe & Razorpay payment widgets), and comprehensive administrative controls.

---

## 🏗️ System Architecture

```
                    ┌──────────────────┐
                    │  Vite React SPA  │
                    │    (Frontend)    │
                    └────────┬─────────┘
                             │ HTTPS API / Event Streams
                             ▼
                    ┌──────────────────┐
                    │  FastAPI Server  │
                    │    (Backend)     │
                    └────────┬─────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │    SQLite DB    │               │  Chroma Vector  │
   │ (Metadata/Auth) │               │   (Embeddings)  │
   └─────────────────┘               └─────────────────┘
```

The system components interact as follows:
1. **Vite React Frontend**: A premium, responsive Single Page Application built with React 19, Vite 8, and Tailwind CSS v4. It handles user authentication, workspace management, document uploading, and real-time streaming response rendering.
2. **FastAPI Backend**: Acts as the central gateway. It routes API requests, validates JWT sessions, processes document chunking, coordinates the ChromaDB embedding pipelines, and communicates with LLM providers.
3. **ChromaDB**: Holds the high-dimensional vector embeddings generated for document text chunks using Google Gemini's `gemini-embedding-001` model.
4. **SQLite DB**: Manages structured platform data (user credentials, sessions, chats, messages, and reports) with optimized relational indexes and WAL mode.

---

## 📂 Folder Structure

```
AI-Research-Assistant/
├── README.md               # Master project documentation
├── render.yaml             # Render infrastructure configuration
├── Backend/                 # Python FastAPI backend services
│   ├── main.py              # Central entry point and API route controller
│   ├── database.py          # SQLite database schema, connections, indexes, and WAL setup
│   ├── llm_service.py       # Direct Gemini API SDK integration and Groq fallbacks
│   ├── embeddings_service.py # Google Gemini vector embedding batch generator
│   ├── chunk_service.py     # Text chunking logic
│   ├── file_parser.py       # Multi-format document parser (PDF, Office, Notebooks, CSV, Code, Media)
│   ├── auth_service.py      # Password hashing, salting, and session handling
│   ├── cleanup.py           # Automated system cleanup and migration script
│   ├── clear_db.py          # Database purge script
│   ├── requirements.txt     # Python backend library dependencies
│   ├── .env.example         # Template for backend server configuration
│   └── .env                 # Local backend secret keys (Git ignored)
└── Frontend/                # Vite React client SPA
    ├── index.html           # Main entry point with pre-rendered SEO content
    ├── package.json         # Node package configuration and dependencies
    ├── vite.config.js       # Vite build configurations
    ├── netlify.toml         # Netlify deployment and SPA redirect overrides
    ├── .env.example         # Template for frontend client configuration
    ├── .env                 # Local frontend settings (Git ignored)
    └── src/
        ├── main.jsx         # React bootstrapping and DOM mounting
        ├── App.jsx          # App root component mounting HomeGPT
        ├── HomeGPT.jsx      # Workspace UI controller, authentication forms, billing workflows
        └── index.css        # Global CSS variables, Light/Dark themes, animations
```

---

## 🔑 Environment Variables Guide

### Backend Configuration (`Backend/.env`)

Copy `Backend/.env.example` to `Backend/.env` and configure:

* **`GEMINI_API_KEY`**: Your Google AI Studio API key. Used to generate 768-dimension vector embeddings (`gemini-embedding-001`) and direct text generation fallback (`gemini-2.5-flash`).
* **`OPENROUTER_API_KEY`**: Your OpenRouter API key (`sk-or-v1-...`). Used as the primary LLM provider.
* **`OPENROUTER_MODEL`**: The target AI model to use on OpenRouter (defaults to `google/gemini-2.5-flash`).
* **`GROQ_API_KEY`**: Your Groq Console API key (used as a secondary fallback).
* **`SECRET_KEY`**: Cryptographic secret key for session signatures.
* **`FRONTEND_URL`**: HTTP address of your deployed frontend client (e.g. `http://localhost:5173` or your Vercel URL) to handle CORS dynamically.
* **`DATABASE_URL`**: (Optional) PostgreSQL database connection string (e.g. Neon, AWS RDS). Defaults to local SQLite (`research_assistant.db`) if omitted.

### Frontend Configuration (`Frontend/.env`)

Copy `Frontend/.env.example` to `Frontend/.env` and configure:

* **`VITE_API_URL`**: HTTP address of your running backend API (e.g., `http://localhost:8000` locally, or your deployed Render URL).

---

## 🚀 Installation & Local Setup

### 1. Perform Repository Clean-up
Run the automated cleanup script to delete old duplicates and obsolete files:
```bash
python Backend/cleanup.py
```

### 2. Backend Server Setup
Open a terminal in the `Backend` directory:
```bash
cd Backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload
```
The server will start running on `http://127.0.0.1:8000`. The SQLite database will be initialized automatically.

### 3. Frontend Client Setup
Open a new terminal in the `Frontend` directory:
```bash
cd Frontend
npm install
npm run dev
```
The client will start running on `http://localhost:5173` and will correctly communicate with your local backend.

---

## 📡 API Documentation

### Authentication & Profile Endpoints
* **`POST /auth/register`**: Register a new user account and initialize workspace.
* **`POST /auth/login`**: Authenticate credentials. Returns session cookie and token. Supports 2FA check.
* **`POST /auth/logout`**: Expire and clear session credentials.
* **`GET /auth/me`**: Get authenticated profile details.
* **`PUT /profile/update`**: Update name/email fields.
* **`POST /profile/change-password`**: Update account password.
* **`DELETE /profile/delete-account`**: Purge user data and delete account.

### Workspace & Document Endpoints
* **`GET /chats`**: List user workspace chats. Filterable by tag and status.
* **`POST /chats`**: Create a new empty chat workspace.
* **`PUT /chats/{chat_id}`**: Rename chat title, update status, or add tag keywords.
* **`DELETE /chats/{chat_id}`**: Delete workspace chat and clear associated Chroma DB vectors.
* **`POST /upload`**: Stream document (up to 10 GB), extract text, parse chunks, and batch embeddings.
* **`POST /chats/{chat_id}/ask`**: Query workspace using RAG. Returns server-sent events stream (SSE).

### Report & Administrative Endpoints
* **`POST /reports`**: Compile a detailed structured research report using workspace document context.
* **`GET /reports`**: List all compiled research reports.
* **`PUT /reports/{report_id}`**: Modify report attributes (rename, favorite status).
* **`DELETE /reports/{report_id}`**: Soft-delete report from history.
* **`POST /reports/{report_id}/duplicate`**: Create an independent duplicate copy of a report.
* **`GET /admin/stats`**: Query system aggregate metrics (total users, reports, queries).
* **`GET /admin/users`**: List registered user profiles (Admin only).
* **`POST /contact`**: Submit inquiry to support system.

---

## 🌐 Production Deployment Guide

### Backend Deployment (Render / Docker)
1. **Create Web Service**: Connect your GitHub repository to Render (or use the included `render.yaml` / `Dockerfile`).
2. **Configure Environment**:
   - Environment: `Python` (or `Docker`)
   - Build Command: `pip install -r Backend/requirements.txt`
   - Start Command: `cd Backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**: Add all parameters from `Backend/.env.example` under the Environment tab.
4. **Persistent Disk (Recommended for SQLite & ChromaDB)**:
   - Attach a Persistent Disk in Render.
   - Name it `chroma-data` and mount it to `/data` (size: 5 GB).
   - The backend automatically redirects database saves to `/data/research_assistant.db` and `/data/chroma_db` on Render, ensuring data persists between server rebuilds.
   - Alternatively, configure `DATABASE_URL` pointing to Neon, AWS RDS, or managed PostgreSQL.

### Frontend Deployment (Vercel / Netlify)
1. **Create Site**: Connect your GitHub repository to Vercel or Netlify.
2. **Build Settings**:
   - Root / Base Directory: `Frontend`
   - Build Command: `npm run build`
   - Output / Publish Directory: `dist`
3. **Environment Variables**: Add `VITE_API_URL` pointing to your deployed backend API (e.g. `https://your-api.onrender.com`).
4. **Deploy**: Click Deploy. The included `vercel.json` and `netlify.toml` configurations handle client-side routing and security headers automatically.

