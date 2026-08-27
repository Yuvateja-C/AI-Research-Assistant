# AGENTS.md — AI Agent Integration Guide for ResearchAI

This file documents configuration specifications, environment structures, and operational protocols for coding agents interacting with this repository.

## Project Structure

```
├── Backend/                 # Python FastAPI backend services
│   ├── main.py              # Endpoint declarations and app routing
│   ├── database.py          # SQLite connections and ChromaDB collection setup
│   ├── llm_service.py       # Groq stream integration
│   ├── embeddings_service.py # Embedding batch service (size: 100)
│   └── chunk_service.py     # PDF parsing and sliding window text chunking
└── Frontend/                # Vite React client SPA
    ├── index.html           # Main entry point with pre-rendered SEO content
    ├── src/
    │   ├── HomeGPT.jsx      # Workspace UI controls, auth forms, streaming responses
    │   └── main.jsx         # React bootstrapping and DOM mounting
    └── public/              # Static public assets (manifest, robots, sitemaps)
```

## Running the Application Locally

### Running the Backend
1. Initialize virtual environment:
   ```bash
   cd Backend
   python -m venv venv
   .\venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the service:
   ```bash
   uvicorn main:app --reload
   ```

### Running the Frontend
1. Install dependencies:
   ```bash
   cd Frontend
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
