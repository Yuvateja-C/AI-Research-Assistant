# 🌌 Enterprise AI Research Assistant

A production-ready, full-stack Retrieval-Augmented Generation (RAG) application built to extract, analyze, and synthesize insights from complex PDF documents. Designed with a premium, minimalist "Claude-style" interface, this tool allows users to upload research papers or business documents and instantly query them using ultra-fast LLMs.

🌐 **Live Demo:** [https://researchai-app.vercel.app](https://researchai-app.vercel.app)


## ✨ Core Features

* **🧠 Semantic Document Ingestion:** Upload any PDF. The backend automatically extracts the text, applies semantic chunking, and vectorizes the data into a local database.
* **⚡ Ultra-Fast RAG Pipeline:** Built on ChromaDB and the Groq API (Llama 3), retrieving context-aware answers in milliseconds without hallucinations.
* **📊 Executive Summarization:** Instantly compiles high-level summaries highlighting main topics, key metrics, and conclusions from the source architecture.
* **📄 PDF Report Compilation:** Users can export their AI-generated summaries and research directly to a beautifully formatted PDF with a single click.
* **🎨 Premium UI/UX:** A zero-scroll, anchored workspace built in React. Features real-time typing indicators, dynamic height textareas, and isolated interaction zones.

---

## 🏗️ Architecture & Tech Stack

This project utilizes a decoupled architecture, separating the client-side rendering from the heavy computational Python backend.

### **Frontend (Client)**

* **Framework:** React + Vite
* **Styling:** Custom Tailwind-inspired CSS (Minimalist, typography-focused)
* **Report Generation:** `jsPDF` for client-side document compilation

### **Backend (Server & AI)**

* **Framework:** FastAPI (Python) for high-performance API routing
* **Vector Database:** ChromaDB for local, in-memory embedding storage
* **Processing:** `PyPDF2` (or similar) for text extraction, custom NLP chunking algorithms
* **LLM Gateway:** Groq API running `llama-3.3-70b-versatile` for blazing-fast inference

---

## 🚀 Getting Started (Local Deployment)

To run this application locally, you will need two terminal windows—one for the Python server and one for the React client.

### 1. Backend Setup

Navigate to the backend directory and install the required Python dependencies.

```bash
cd backend
pip install -r requirements.txt
```

**Environment Variables:** You must provide a Groq API key to power the AI. Create a `.env` file (or add it to your system environment) in the backend folder:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

*(The backend will initialize and run on `http://127.0.0.1:8000`)*

### 2. Frontend Setup

Open a new terminal window, navigate to the frontend directory, and install the Node modules.

```bash
cd frontend
npm install
```

**Environment Variables:**
Create a `.env` file in the root of your frontend folder to point the app to your local backend:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start the Vite development server:

```bash
npm run dev
```

*(The frontend will launch on `https://researchai-app.vercel.app/`)*

---

## 💡 Usage Workflow

1. Open `http://localhost:5173` in your browser.
2. Click the **Paperclip icon** in the bottom command dock to attach a target PDF.
3. Wait for the backend to index the document (a file pill will appear when ready).
4. Click **✨ Extract Summary** for a complete document overview, or type a specific question into the command dock.
5. Click **Compile PDF Report** beneath any generated summary to save your research offline.

---

## 🛡️ Error Handling & Rate Limits

* **Dynamic CORS:** The backend explicitly manages Cross-Origin Resource Sharing to protect the API gateway.
* **Token Management:** The system dynamically trims document context to strictly adhere to LLM context window limits, preventing out-of-memory or rate-limit crashes. (Note: Using the free Groq tier imposes a 100k Token/Day limit).

---

*Built by C Yuva Teja — Generative AI Enginner*
