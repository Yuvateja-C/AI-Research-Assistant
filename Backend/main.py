try:
    from fastapi import FastAPI, UploadFile, File, HTTPException
except ImportError as exc:
    raise ImportError(
        "fastapi is required. Install it with `pip install fastapi`"
    ) from exc

from pydantic import BaseModel
from chunk_service import chunk_text
from pdf_service import extract_text_from_pdf
from database import collection
from llm_service import generate_answer

import os
import shutil
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ----------------------------
# CORS
# ----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "https://vercel.com/yuvateja-cs-projects/ai-research-assistant-6vso/92mJ5oxPhGfxSAC7guvqPhtKqqU4",
    "https://ai-research-assistant-6vso.vercel.app"
    "http://localhost:3000", # Good to keep for local development
    "http://localhost:5173"  # Vite default
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Folders
# ----------------------------

UPLOAD_FOLDER = "uploads"
PROCESSED_FOLDER = "processed"
CHUNKS_FOLDER = "chunks"

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(CHUNKS_FOLDER, exist_ok=True)

# ----------------------------
# Models
# ----------------------------

class QuestionRequest(BaseModel):
    question: str
    history: list = []

class SummaryRequest(BaseModel):
    filename: str

# ----------------------------
# Upload PDF Endpoint
# ----------------------------

# Removed 'async' to allow FastAPI to run this blocking code in a background thread
@app.post("/upload")
def upload_pdf(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)

        # Faster file writing using shutil
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Extract and Chunk
        text = extract_text_from_pdf(file_path)
        chunks = chunk_text(text)

        # 2. Add to ChromaDB (Storage)
        collection.add(
            documents=chunks,
            ids=[f"{file.filename}_chunk_{i}" for i in range(len(chunks))],
            metadatas=[{"source": file.filename} for _ in chunks]
        )

        print(f"Total Chunks: {len(chunks)}")
        print("Stored in ChromaDB")

        # 3. Save only the full text (Optional, but much faster than saving chunks)
        txt_file = os.path.join(
            PROCESSED_FOLDER,
            file.filename.replace(".pdf", ".txt")
        )
        with open(txt_file, "w", encoding="utf-8") as f:
            f.write(text)

        return {
            "filename": file.filename,
            "status": "processed",
            "text_file": txt_file,
            "total_chunks": len(chunks),
            "stored_in_chromadb": True
        }
    except Exception as e:
        print(f"UPLOAD ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload Failed: {str(e)}")


# ----------------------------
# Ask Questions Endpoint
# ----------------------------

@app.post("/ask")
async def ask_question(data: QuestionRequest):
    try:
        question = data.question
        
        history_text = ""
        for msg in data.history[-4:]: # Reduced history context to save tokens
            role = msg.get("role", "")
            content = msg.get("content", "")
            history_text += f"{role}: {content}\n"

        # AGGRESSIVE FIX: Pull fewer chunks (2 instead of 3)
        results = collection.query(
            query_texts=[question],
            n_results=2
        )

        print("\n========== SOURCES ==========")
        if results and results.get("ids") and len(results["ids"][0]) > 0:
            print(results["ids"][0])
        else:
            print("No sources found.")
        print("=============================\n")

        document_context = ""
        if results and results.get("documents") and len(results["documents"][0]) > 0:
            document_context = "\n".join(results["documents"][0])
            
        # AGGRESSIVE FIX: Limit to 12,000 characters (~3,000 tokens)
        document_context = document_context[:12000]

        context = f"""
Conversation History:
{history_text}

Document Context:
{document_context}
"""
        
        answer = generate_answer(context, question)

        return {
            "question": question,
            "answer": answer,
            "sources": results["ids"][0] if results and results.get("ids") else []
        }
    except Exception as e:
        print(f"CRASH IN /ask: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")


# ----------------------------
# Summary Endpoint
# ----------------------------

@app.post("/summary")
async def generate_document_summary(data: SummaryRequest):
    try:
        # AGGRESSIVE FIX: Pull fewer chunks for the summary (3 instead of 4)
        results = collection.query(
            query_texts=["document summary main topics events conclusion"],
            n_results=3,
            where={"source": data.filename}
        )

        if not results or not results.get("documents") or len(results["documents"][0]) == 0:
            return {"summary": "Error: No indexed data found for this document. Please upload it again."}

        context = "\n".join(results["documents"][0])
        
        # AGGRESSIVE FIX: Limit to 15,000 characters (~3,750 tokens)
        context = context[:15000]

        summary_question = """
Generate a structured summary of the document.

Include:
1. Main Topics
2. Key Metrics
3. Important Concepts
4. Conclusion
"""

        summary = generate_answer(context, summary_question)

        return {
            "summary": summary
        }
    except Exception as e:
        print(f"CRASH IN /summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")

# ----------------------------
# Health Check
# ----------------------------

@app.get("/")
def home():
    return {
        "message": "AI Research Assistant Backend Running"
    }
