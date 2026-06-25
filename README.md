# 🤖 AI Research Assistant

> An AI-powered RAG (Retrieval-Augmented Generation) application that lets you upload PDF documents and ask questions in natural language.

🌐 **Live Demo:** [https://ai-research-assistant-yuvateja-cs-projects.vercel.app](https://ai-research-assistant-yuvateja-cs-projects.vercel.app)

---

## ✨ Features

- 📄 **PDF Upload** — Drag & drop or click to upload any PDF document
- 🔍 **Semantic Search** — ChromaDB vector store for intelligent retrieval
- 💬 **Contextual Q&A** — Ask questions in natural language with full chat history
- 📝 **Auto Summarization** — One-click document summary generation
- 📌 **Source Citations** — Every answer comes with chunk references
- 📥 **Export PDF** — Download your summary as a PDF report
- ⚡ **Keep-Alive** — Backend stays warm, no cold start delays

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite + TailwindCSS |
| **Backend** | FastAPI + Python |
| **AI / LLM** | Groq API (LLaMA 3.3 70B) |
| **Vector DB** | ChromaDB |
| **Embeddings** | Sentence Transformers (all-MiniLM-L6-v2) |
| **PDF Parsing** | PyPDF |
| **Frontend Deploy** | Vercel |
| **Backend Deploy** | Render |

---

## 🏗️ Architecture

```
PDF Upload → Text Extraction → Smart Chunking (800 chars)
         → Sentence Embeddings → ChromaDB Storage
         → Semantic Retrieval → Groq LLaMA → Response
```

---

## 🚀 Local Setup

### Backend

```bash
cd Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Create .env file
echo GROQ_API_KEY=your_key_here > .env

uvicorn main:app --reload
```

### Frontend

```bash
cd Frontend
npm install

# Create .env file
echo VITE_API_URL=http://127.0.0.1:8000 > .env

npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 📁 Project Structure

```
AI-Research-Assistant/
├── Backend/
│   ├── main.py              # FastAPI app, all endpoints
│   ├── chunk_service.py     # Smart text chunking (800-char, sentence-aware)
│   ├── pdf_service.py       # PDF text extraction
│   ├── database.py          # ChromaDB setup
│   ├── embeddings_service.py # Sentence-transformer embeddings
│   ├── llm_service.py       # Groq LLaMA integration
│   └── requirements.txt
├── Frontend/
│   ├── src/
│   │   ├── pages/HomeGPT.jsx  # Main UI (chat + upload + summary)
│   │   └── index.css
│   ├── index.html
│   └── vercel.json
├── render.yaml              # Render backend deployment config
└── README.md
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload & index a PDF |
| `POST` | `/ask` | Ask a question with chat history |
| `POST` | `/summary` | Generate document summary |
| `GET` | `/ping` | Keep-alive health check |
| `GET` | `/` | Backend status |

---

## 👤 Author

**Yuvateja** — [GitHub](https://github.com/Yuvateja-C)