try:
    from fastapi import FastAPI, UploadFile, File
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
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ----------------------------
# CORS
# ----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ai-research-assistant-lovat.vercel.app"],
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


# ----------------------------
# Upload PDF Endpoint
# ----------------------------

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):

    file_path = os.path.join(
        UPLOAD_FOLDER,
        file.filename
    )

    # Save uploaded PDF
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # Extract text
    text = extract_text_from_pdf(file_path)

    # Create chunks
    chunks = chunk_text(text)

    # Save chunks as txt files
    for i, chunk in enumerate(chunks, start=1):

        chunk_file = os.path.join(
            CHUNKS_FOLDER,
            f"{file.filename.replace('.pdf', '')}_chunk_{i}.txt"
        )

        with open(
            chunk_file,
            "w",
            encoding="utf-8"
        ) as f:
            f.write(chunk)

    # Store chunks in ChromaDB
    collection.add(
        documents=chunks,
        ids=[
            f"{file.filename}_chunk_{i}"
            for i in range(len(chunks))
        ],
        metadatas=[
            {"source": file.filename}
            for _ in chunks
        ]
    )

    print(f"Total Chunks: {len(chunks)}")
    print("Stored in ChromaDB")

    # Save extracted text
    txt_file = os.path.join(
        PROCESSED_FOLDER,
        file.filename.replace(".pdf", ".txt")
    )

    with open(
        txt_file,
        "w",
        encoding="utf-8"
    ) as f:
        f.write(text)

    return {
        "filename": file.filename,
        "status": "processed",
        "text_file": txt_file,
        "total_chunks": len(chunks),
        "chunks_folder": CHUNKS_FOLDER,
        "stored_in_chromadb": True
    }


# ----------------------------
# Ask Questions Endpoint
# ----------------------------

@app.post("/ask")
async def ask_question(data: QuestionRequest):

    question = data.question
    
    # Process Conversation History
    history_text = ""
    for msg in data.history[-6:]:
        role = msg.get("role", "")
        content = msg.get("content", "")
        history_text += f"{role}: {content}\n"

    # Retrieve relevant chunks
    results = collection.query(
        query_texts=[question],
        n_results=5
    )

    # Print source IDs
    print("\n========== SOURCES ==========")
    print(results["ids"][0])
    print("=============================\n")

    # Print retrieved chunks
    print("\n========== RETRIEVED DOCUMENTS ==========")

    for i, doc in enumerate(
        results["documents"][0],
        start=1
    ):
        print(f"\n--- Chunk {i} ---")
        print(doc[:300])

    print("\n=========================================\n")

    # Build full context containing both history and document data
    document_context = "\n".join(
        results["documents"][0]
    )

    context = f"""
Conversation History:
{history_text}

Document Context:
{document_context}
"""
    
    print("\n========== FINAL CONTEXT ==========")
    print(context[:3000])
    print("\n===================================\n")

    # Generate answer
    answer = generate_answer(
        context,
        question
    )

    return {
        "question": question,
        "answer": answer,
        "sources": results["ids"][0]
    }


@app.post("/summary")
async def generate_document_summary():
    results = collection.query(
        query_texts=["document summary"],
        n_results=10
    )

    context = "\n".join(
        results["documents"][0]
    )

    summary_question = """
Generate a structured summary of the document.

Include:

1. Main Topics
2. Key Characters
3. Important Events
4. Conclusion
"""

    summary = generate_answer(
        context,
        summary_question
    )

    return {
        "summary": summary
    }

# ----------------------------
# Health Check
# ----------------------------

@app.get("/")
def home():
    return {
        "message": "AI Research Assistant Backend Running"
    }
