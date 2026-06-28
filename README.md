# ResearchAI — Intelligent Document Analysis SaaS Platform

ResearchAI is a secure, enterprise-grade, vector-powered document analysis platform that enables academic researchers, engineers, and analysts to upload large PDF documents, textbooks, and code repositories to extract summaries, key metrics, recommendations, and structured research reports in seconds.

The application is structured as a decoupled full-stack architecture with a FastAPI backend and a Vite React SPA frontend, supporting secure JWT authentication, optional 2FA, detailed workspace tagging, and full credit card / UPI subscription payments via Razorpay.

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
1. **Vite React Frontend**: A premium, responsive Single Page Application. It handles user authentication, workspace management, document uploading, and real-time streaming response render.
2. **FastAPI Backend**: Acts as the central gateway. It routes API requests, validates JWT sessions, processes document chunking, coordinates the ChromaDB embedding pipelines, and communicates with LLM providers (OpenRouter/Groq).
3. **ChromaDB**: Holds the high-dimensional vector embeddings generated for document text chunks using Google Gemini embedding models, allowing semantic similarity searches.
4. **SQLite DB**: Manages structured platform data (user credentials, 2FA settings, chat session lists, message history logs, generated reports, and support inquiry logs).

---

## 📂 Folder Structure

```
AI-Research-Assistant/
├── README.md               # Master project documentation
├── Backend/                 # Python FastAPI backend services
│   ├── main.py              # Central entry point and API route controller
│   ├── database.py          # SQLite database schema, connections, and migrations
│   ├── llm_service.py       # OpenRouter and Groq text generation clients
│   ├── embeddings_service.py # Google Gemini vector embedding batch generator
│   ├── chunk_service.py     # Sliding window chunking logic for text sources
│   ├── pdf_service.py       # Local PDF extraction utils
│   ├── auth_service.py      # Password hashing, salting, and session JWT handling
│   ├── requirements.txt     # Python backend library dependencies
│   ├── .env.example         # Template for backend server configuration
│   └── .env                 # Local backend secret keys (Git ignored)
└── Frontend/                # Vite React client SPA
    ├── index.html           # Main entry point with pre-rendered SEO content
    ├── package.json         # Node package configuration and dependencies
    ├── vite.config.js       # Vite build configurations
    ├── .env.example         # Template for frontend client configuration
    ├── .env.local           # Local frontend settings (Git ignored)
    ├── public/              # Static public assets (manifest, robots, sitemaps)
    │   ├── manifest.json    # PWA configuration
    │   └── favicon.svg      # Main application logo icon
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

* **`OPENROUTER_API_KEY`**: Your OpenRouter API key (`sk-or-v1-...`). Used as the primary LLM provider.
* **`OPENROUTER_MODEL`**: The target AI model to use on OpenRouter (defaults to `google/gemini-2.5-flash`).
* **`GROQ_API_KEY`**: Your Groq Console API key (used as a fallback).
* **`GEMINI_API_KEY`**: Your Google AI Studio API key. Used to generate 768-dimension vector embeddings using the `text-embedding-004` model.
* **`RAZORPAY_KEY_ID`**: Your Razorpay public key (e.g., `rzp_test_...`).
* **`RAZORPAY_KEY_SECRET`**: Your Razorpay secret key.
* **`RAZORPAY_WEBHOOK_SECRET`**: Webhook secret to verify signature headers on incoming payment events.
* **`SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD`**: Mail server settings to send email verification links, password resets, and transaction invoices.

### Frontend Configuration (`Frontend/.env`)

Copy `Frontend/.env.example` to `Frontend/.env` and configure:

* **`VITE_API_URL`**: HTTP address of your running backend API (e.g., `http://localhost:8000` locally, or `https://api.yourdomain.com` in production).
* **`VITE_RAZORPAY_KEY_ID`**: Razorpay key ID to power checkout widgets.

---

## 🚀 Installation & Local Setup

### 1. Backend Server Setup
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
The server will start running on `http://127.0.0.1:8000`.

### 2. Frontend Client Setup
Open a new terminal in the `Frontend` directory:
```bash
cd Frontend
npm install
npm run dev
```
The client will start running on `http://localhost:5173`.

---

## 📡 API Documentation

### Authentication & Profile Endpoints
* **`POST /auth/register`**: Register a new user account. Sends verification email.
* **`GET /auth/verify-email`**: Validate verification token to activate account.
* **`POST /auth/login`**: Authenticate credentials. Returns session JWT cookie. Supports 2FA check.
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

### Report & Billing Endpoints
* **`POST /reports`**: Compile a detailed PDF/DOCX-ready report using workspace context.
* **`GET /reports`**: List all compiled reports.
* **`PUT /reports/{report_id}`**: Modify report attributes (rename, favorite status).
* **`DELETE /reports/{report_id}`**: Delete report from history.
* **`POST /auth/razorpay/create-order`**: Create Order transaction for plan upgrade.
* **`POST /auth/razorpay/verify`**: Validate Razorpay signature to upgrade user subscription tier.
* **`POST /auth/razorpay/webhook`**: Receive transaction updates (charged, cancelled) from Razorpay.

---

## 🌐 Production Deployment Guide

### Backend Deployment (Render)
1. **Create Web Service**: Connect your GitHub repository to Render.
2. **Configure Environment**:
   - Environment: `Python`
   - Build Command: `pip install -r Backend/requirements.txt`
   - Start Command: `cd Backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**: Add all parameters from `Backend/.env.example` under the Environment tab.
4. **Persistent Disk (Optional)**: If you want to keep the SQLite database file and local vector store across deployments, attach a Persistent Disk in Render and mount it to `/data`, then configure database paths to point to `/data/research_assistant.db`.

### Frontend Deployment (Vercel)
1. **Import Project**: Link your GitHub repository in Vercel.
2. **Build Settings**:
   - Framework Preset: `Vite`
   - Root Directory: `Frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. **Environment Variables**: Add `VITE_API_URL` pointing to your deployed Render API, and `VITE_RAZORPAY_KEY_ID`.
4. **Deploy**: Click deploy. Vercel automatically deploys the SPA and configures routing overrides using the included `vercel.json` file.
