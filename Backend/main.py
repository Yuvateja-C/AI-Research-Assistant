import os
import shutil
import uuid
import time
import json
import sqlite3
import re
import secrets
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, Response, Cookie, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from chunk_service import chunk_text
from file_parser import parse_document
from database import collection, get_db
from llm_service import generate_answer, generate_answer_stream
from embeddings_service import generate_embeddings
from auth_service import hash_password, verify_password, create_session, get_user_from_token, delete_session


app = FastAPI()

@app.on_event("startup")
def startup_event():
    if os.getenv("RESET_DB_ON_STARTUP") == "true":
        try:
            from clear_db import clear_all_data
            clear_all_data()
            print("[STARTUP] Startup database cleanup completed successfully.")
        except Exception as e:
            print(f"[STARTUP] Startup database cleanup failed: {e}")
    else:
        print("[STARTUP] Startup database cleanup bypassed (RESET_DB_ON_STARTUP is not set to true).")

# ----------------------------
# CORS
# ----------------------------
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
origins = list(set([
    frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:8080",
    "https://ai-research-assistant-six-theta.vercel.app",
    "https://ai-research-assistant-tan.vercel.app",
]))

from fastapi.responses import JSONResponse

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Request Correlation ID & Performance Middleware
# ----------------------------
@app.middleware("http")
async def request_correlation_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4().hex[:12])
    request.state.request_id = request_id
    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = str(duration_ms)
    return response

# ----------------------------
# In-Memory Abuse Prevention & Technical Rate Limiter
# ----------------------------
RATE_LIMIT_STORE = {}

def apply_rate_limit(key: str, max_requests: int = 30, window_seconds: int = 60):
    now = time.time()
    if key not in RATE_LIMIT_STORE:
        RATE_LIMIT_STORE[key] = []
    # Filter out timestamps outside window
    timestamps = [ts for ts in RATE_LIMIT_STORE[key] if now - ts < window_seconds]
    if len(timestamps) >= max_requests:
        raise HTTPException(
            status_code=429,
            detail=f"RATE_LIMIT_EXCEEDED: Rate limit exceeded ({max_requests} requests per {window_seconds}s). Please slow down."
        )
    timestamps.append(now)
    RATE_LIMIT_STORE[key] = timestamps

# ----------------------------
# Centralized Error Handlers
# ----------------------------
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail
            }
        }
    )

@app.exception_handler(Exception)
async def custom_general_exception_handler(request: Request, exc: Exception):
    err_str = str(exc)
    code = "INTERNAL_SERVER_ERROR"
    status_code = 500
    if "EMBEDDING_SERVICE_UNAVAILABLE" in err_str:
        code = "EMBEDDING_SERVICE_UNAVAILABLE"
        status_code = 533
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": err_str
            }
        }
    )

# ----------------------------
# Health & Readiness Endpoints
# ----------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AI Research Assistant Backend", "timestamp": int(time.time())}

@app.get("/health/ready")
def health_readiness():
    db_status = "unhealthy"
    vector_status = "unhealthy"
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        row = cursor.fetchone()
        conn.close()
        if row:
            db_status = "healthy"
    except Exception as e:
        db_status = f"error: {str(e)}"

    try:
        from database import collection
        if collection is not None:
            vector_status = "healthy"
    except Exception as e:
        vector_status = f"error: {str(e)}"

    from embeddings_service import get_embedding_info
    emb_info = get_embedding_info()

    is_ready = db_status == "healthy" and vector_status == "healthy"
    status_code = 200 if is_ready else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_ready else "not_ready",
            "database": db_status,
            "vector_store": vector_status,
            "embedding_engine": emb_info,
            "timestamp": int(time.time())
        }
    )


from config import DATA_DIR, BACKEND_DIR

UPLOAD_FOLDER = os.path.join(DATA_DIR, "uploads")
PROCESSED_FOLDER = os.path.join(DATA_DIR, "processed")
CHUNKS_FOLDER = os.path.join(DATA_DIR, "chunks")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_FOLDER, exist_ok=True)
os.makedirs(CHUNKS_FOLDER, exist_ok=True)

# Mock in-memory recovery tokens for recovery workflow
RECOVERY_TOKENS = {}

# ----------------------------
# Dependency
# ----------------------------
async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token missing")
    
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user

from typing import Optional, List, Any

# ----------------------------
# Request Schemas
# ----------------------------
class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str

class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    code_2fa: Optional[str] = None

class RecoverRequest(BaseModel):
    email: str

class ResetRequest(BaseModel):
    token: str
    new_password: str

class Verify2FARequest(BaseModel):
    code: str

class ChatUpdateRequest(BaseModel):
    title: Optional[str] = None
    tags: Optional[str] = None
    status: Optional[str] = None

class QuestionRequest(BaseModel):
    question: str
    history: List[Any] = []
    persona: str = "default"
    model_id: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ContactRequest(BaseModel):
    name: str
    email: str
    message: str

class UserStatusRequest(BaseModel):
    status: str

class ReportCreateRequest(BaseModel):
    chat_id: str
    title: Optional[str] = None

# ----------------------------
# Auth Endpoints
# ----------------------------
@app.post("/auth/register")
def register(data: RegisterRequest, request: Request):
    client_ip = request.client.host if request.client else "local"
    apply_rate_limit(f"reg:{client_ip}", max_requests=10, window_seconds=60)
    
    # Validations
    if not re.match(r"[^@]+@[^@]+\.[^@]+", data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(data.password) < 8 or not any(c.isdigit() for c in data.password) or not any(c.isalpha() for c in data.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and contain both letters and numbers")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Check duplicate
    cursor.execute("SELECT id FROM users WHERE email = ? OR username = ?", (data.email.lower(), data.username.lower()))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email or username already exists")
    
    pw_hash, salt = hash_password(data.password)
    user_id = str(uuid.uuid4())
    
    cursor.execute(
        "INSERT INTO users (id, email, username, password_hash, salt, created_at, name, status, is_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, data.email.lower(), data.username.lower(), pw_hash, salt, int(time.time() * 1000), data.username.title(), "active", 1, None)
    )
    conn.commit()
    conn.close()

    return {"message": "Registration successful", "user_id": user_id}

@app.post("/auth/login")
def login(data: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "local"
    apply_rate_limit(f"login:{client_ip}", max_requests=10, window_seconds=60)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, username, role, name, password_hash, salt, is_2fa_enabled, secret_2fa, status, is_verified FROM users WHERE email = ? OR username = ?",
        (data.username_or_email.lower(), data.username_or_email.lower())
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row or not verify_password(data.password, row["salt"], row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if row["status"] == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")
    
    # If 2FA enabled, check code
    if row["is_2fa_enabled"]:
        if not data.code_2fa:
            return {"requires_2fa": True, "message": "2FA code required"}
        # Simple verification: matches mock secret or "123456" for demo SMS/authenticator
        if data.code_2fa != "123456" and data.code_2fa != row["secret_2fa"]:
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
            
    token = create_session(row["id"])
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=True
    )

    r_dict = dict(row)
    user_dict = {
        "id": r_dict["id"],
        "email": r_dict["email"],
        "username": r_dict["username"],
        "role": r_dict.get("role", "user"),
        "is_2fa_enabled": bool(r_dict.get("is_2fa_enabled", 0)),
        "name": r_dict.get("name") or r_dict["username"].title(),
        "status": r_dict.get("status", "active"),
        "is_verified": bool(r_dict.get("is_verified", 0))
    }
    return {"message": "Login successful", "token": token, "user": user_dict}

@app.post("/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if token:
        delete_session(token)
    response.delete_cookie("session_token")
    return {"message": "Logout successful"}

@app.get("/auth/me")
def check_me(user: dict = Depends(get_current_user)):
    return {"authenticated": True, "user": {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "role": user["role"],
        "is_2fa_enabled": bool(user["is_2fa_enabled"]),
        "name": user.get("name") or user["username"].title(),
        "status": user.get("status", "active"),
        "is_verified": bool(user.get("is_verified", 0))
    }}

# ----------------------------
# Profile Endpoints
# ----------------------------
@app.put("/profile/update")
def update_profile(data: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    updates = []
    params = []
    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name)
    if data.email is not None:
        if data.email.lower() != user["email"].lower():
            cursor.execute("SELECT id FROM users WHERE email = ?", (data.email.lower(),))
            if cursor.fetchone():
                conn.close()
                raise HTTPException(status_code=400, detail="Email already taken")
            updates.append("email = ?")
            params.append(data.email.lower())
            
    if updates:
        params.append(user["id"])
        cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        
    conn.close()
    return {"message": "Profile updated successfully"}

@app.post("/profile/change-password")
def change_password(data: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, salt FROM users WHERE id = ?", (user["id"],))
    row = cursor.fetchone()
    
    if not row or not verify_password(data.current_password, row["salt"], row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    if len(data.new_password) < 8:
        conn.close()
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        
    pw_hash, salt = hash_password(data.new_password)
    cursor.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (pw_hash, salt, user["id"]))
    conn.commit()
    conn.close()
    return {"message": "Password updated successfully"}

@app.delete("/profile/delete-account")
def delete_account(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"message": "Account deleted successfully"}



@app.post("/auth/2fa/setup")
def setup_2fa(user: dict = Depends(get_current_user)):
    # Generate mock secret
    secret = str(uuid.uuid4().hex[:10]).upper()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET secret_2fa = ? WHERE id = ?", (secret, user["id"]))
    conn.commit()
    conn.close()
    return {
        "secret": secret,
        "qr_code_mock": f"otpauth://totp/ResearchAI:{user['email']}?secret={secret}&issuer=ResearchAI"
    }

@app.post("/auth/2fa/verify")
def verify_2fa(data: Verify2FARequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT secret_2fa FROM users WHERE id = ?", (user["id"],))
    row = cursor.fetchone()
    
    if not row or (data.code != "123456" and data.code != row["secret_2fa"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    cursor.execute("UPDATE users SET is_2fa_enabled = 1 WHERE id = ?", (user["id"],))
    conn.commit()
    conn.close()
    return {"message": "2FA successfully enabled"}

@app.post("/auth/recover")
def recover_password(data: RecoverRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (data.email.lower(),))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        # Avoid user enumeration - return success anyway
        return {"message": "If the email exists, a recovery token has been sent"}
        
    token = secrets.token_urlsafe(32)
    # Token expires in 1 hour
    RECOVERY_TOKENS[token] = {
        "user_id": row["id"],
        "expires_at": int(time.time()) + 3600
    }
    # In a real app, send email here. For demo, we return the link.
    return {
        "message": "Recovery token generated",
        "recovery_link": f"{frontend_url}/reset-password?token={token}"
    }

@app.post("/auth/reset-password")
def reset_password(data: ResetRequest):
    token_info = RECOVERY_TOKENS.get(data.token)
    if not token_info or token_info["expires_at"] < int(time.time()):
        raise HTTPException(status_code=400, detail="Invalid or expired recovery token")
        
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
    pw_hash, salt = hash_password(data.new_password)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", (pw_hash, salt, token_info["user_id"]))
    conn.commit()
    conn.close()
    
    del RECOVERY_TOKENS[data.token]
    return {"message": "Password successfully updated"}

# ----------------------------
# Chat Management Endpoints
# ----------------------------
@app.get("/chats")
def get_chats(status: str = None, tag: str = None, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM chats WHERE user_id = ?"
    params = [user["id"]]
    
    if status:
        query += " AND status = ?"
        params.append(status)
    if tag:
        query += " AND ',' || tags || ',' LIKE ?"
        params.append(f"%,{tag},%")
        
    query += " ORDER BY updated_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    chats = []
    for r in rows:
        chats.append({
            "id": r["id"],
            "title": r["title"],
            "file_info": json.loads(r["file_info"]) if r["file_info"] else None,
            "summary": r["summary"] or "",
            "status": r["status"],
            "tags": r["tags"].split(",") if r["tags"] else [],
            "createdAt": r["created_at"],
            "updatedAt": r["updated_at"]
        })
    conn.close()
    return chats

@app.post("/chats")
def create_chat(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    chat_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    cursor.execute(
        "INSERT INTO chats (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (chat_id, user["id"], "New Research", now, now)
    )
    conn.commit()
    conn.close()
    return {"id": chat_id, "title": "New Research"}

@app.put("/chats/{chat_id}")
def update_chat_details(chat_id: str, data: ChatUpdateRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")
        
    updates = []
    params = []
    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title)
    if data.tags is not None:
        updates.append("tags = ?")
        params.append(data.tags)
    if data.status is not None:
        updates.append("status = ?")
        params.append(data.status)
        
    if updates:
        params.append(int(time.time() * 1000))
        params.append(chat_id)
        cursor.execute(f"UPDATE chats SET {', '.join(updates)}, updated_at = ? WHERE id = ?", params)
        conn.commit()
        
    conn.close()
    return {"message": "Chat updated successfully"}

@app.delete("/chats/{chat_id}")
def delete_chat(chat_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")
        
    cursor.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    conn.commit()
    conn.close()

    # Clean ChromaDB vector chunks for deleted chat session
    try:
        from database import collection
        if collection:
            collection.delete(where={"chat_id": chat_id})
    except Exception as e:
        print(f"[CHROMA] Vector collection chunk deletion for chat {chat_id} skipped: {e}")

    return {"message": "Chat deleted"}

@app.get("/chats/{chat_id}/messages")
def get_messages(chat_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")
        
    cursor.execute("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", (chat_id,))
    rows = cursor.fetchall()
    
    msgs = []
    for r in rows:
        msgs.append({
            "id": r["id"],
            "role": r["role"],
            "content": r["content"],
            "sources": json.loads(r["sources"]) if r["sources"] else []
        })
    conn.close()
    return msgs

# ----------------------------
# Large Upload (Streaming receiver & page-by-page indexer)
# ----------------------------

def safe_collection_add(collection, documents, embeddings, ids, metadatas):
    try:
        collection.add(
            documents=documents,
            embeddings=embeddings,
            ids=ids,
            metadatas=metadatas
        )
        return collection
    except Exception as e:
        err_msg = str(e)
        if "Dimension" in err_msg or "InvalidDimension" in err_msg or "dimensionality" in err_msg:
            try:
                from database import client
                print("[CHROMA] ChromaDB Dimension Mismatch detected. Re-creating collection...")
                client.delete_collection("research_docs")
                new_collection = client.get_or_create_collection(name="research_docs")
                new_collection.add(
                    documents=documents,
                    embeddings=embeddings,
                    ids=ids,
                    metadatas=metadatas
                )
                return new_collection
            except Exception:
                raise e
        else:
            raise e

@app.post("/upload")
async def upload_large_pdf(
    request: Request,
    filename: str,
    chat_id: str,
    user: dict = Depends(get_current_user)
):
    apply_rate_limit(f"upload:{user['id']}", max_requests=10, window_seconds=60)
    global collection
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")

    # Filename sanitization & extension check
    safe_filename = os.path.basename(filename).replace("..", "").replace("/", "").replace("\\", "")
    ext = os.path.splitext(safe_filename)[1].lower()
    allowed_exts = [
        ".pdf", ".docx", ".xlsx", ".pptx", ".ipynb", ".csv", ".tsv",
        ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".java",
        ".c", ".cpp", ".cs", ".go", ".rs", ".sql", ".html", ".css",
        ".json", ".yaml", ".yml", ".xml", ".toml", ".sh",
        ".png", ".jpg", ".jpeg", ".webp", ".svg", ".bmp", ".gif", ".tiff",
        ".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg",
        ".mp4", ".mov", ".mkv", ".avi", ".webm"
    ]
    if not ext or ext not in allowed_exts:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Please upload a valid document or dataset file.")

    file_path = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{safe_filename}")
    
    # 1. Stream file to disk with 50 MB Maximum File Size Check
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    total_bytes = 0
    try:
        with open(file_path, "wb") as buffer:
            async for chunk in request.stream():
                total_bytes += len(chunk)
                if total_bytes > MAX_FILE_SIZE:
                    buffer.close()
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    conn.close()
                    raise HTTPException(status_code=400, detail="DOCUMENT_TOO_LARGE: File size exceeds maximum allowed limit of 50 MB.")
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        conn.close()
        raise HTTPException(status_code=500, detail=f"Streaming upload failed: {str(e)}")

    # 2. Universal text extraction via file_parser pipeline
    try:
        text_buffer, doc_metadata = parse_document(file_path, filename)
        
        page_chunks = []
        chunk_size = 1000
        total_chunks_processed = 0
        MAX_CHUNKS_CEILING = 5000

        # Chunk when buffer is large enough
        while len(text_buffer) >= chunk_size and total_chunks_processed < MAX_CHUNKS_CEILING:
            chunk = text_buffer[:chunk_size]
            page_chunks.append(chunk)
            text_buffer = text_buffer[chunk_size:]

            # Embed and index in batches of 100 to optimize API speed
            if len(page_chunks) >= 100:
                embeddings = generate_embeddings(page_chunks)
                ids = [f"{chat_id}_chunk_{total_chunks_processed + i}" for i in range(len(page_chunks))]
                collection = safe_collection_add(
                    collection,
                    documents=page_chunks,
                    embeddings=embeddings,
                    ids=ids,
                    metadatas=[{"source": filename, "chat_id": chat_id, "user_id": user["id"]} for _ in page_chunks]
                )
                total_chunks_processed += len(page_chunks)
                page_chunks = []

        # Flush leftover buffer
        if text_buffer and total_chunks_processed < MAX_CHUNKS_CEILING:
            page_chunks.append(text_buffer)
        if page_chunks and total_chunks_processed < MAX_CHUNKS_CEILING:
            embeddings = generate_embeddings(page_chunks)
            ids = [f"{chat_id}_chunk_{total_chunks_processed + i}" for i in range(len(page_chunks))]
            collection = safe_collection_add(
                collection,
                documents=page_chunks,
                embeddings=embeddings,
                ids=ids,
                metadatas=[{"source": safe_filename, "chat_id": chat_id, "user_id": user["id"]} for _ in page_chunks]
            )
            total_chunks_processed += len(page_chunks)

        # Update Chat File Details in Database
        doc_metadata["filename"] = safe_filename
        doc_metadata["chunks"] = total_chunks_processed
        file_info = json.dumps(doc_metadata)

        cursor.execute(
            "UPDATE chats SET file_info = ?, updated_at = ? WHERE id = ?",
            (file_info, int(time.time() * 1000), chat_id)
        )
        conn.commit()
        conn.close()

        # Clean local file to save disk space
        if os.path.exists(file_path):
            os.remove(file_path)

        return {
            "filename": safe_filename,
            "status": "processed",
            "total_chunks": total_chunks_processed
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        conn.close()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# ----------------------------
# AI Models Registry Endpoint
# ----------------------------
@app.get("/ai/models")
def list_ai_models():
    from llm_service import get_available_models
    return {"models": get_available_models()}

@app.post("/chats/{chat_id}/generate-title")
def generate_chat_title(chat_id: str, data: dict, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")
        
    first_question = data.get("question", "")
    if not first_question:
        conn.close()
        return {"title": "New Research Workspace"}

    # Short clean title extraction
    clean_title = first_question.strip()[:40]
    if len(first_question) > 40:
        clean_title += "..."

    cursor.execute("UPDATE chats SET title = ?, updated_at = ? WHERE id = ?", (clean_title, int(time.time() * 1000), chat_id))
    conn.commit()
    conn.close()
    return {"title": clean_title}

# ----------------------------
# Ask Endpoint (RAG)
# ----------------------------
@app.post("/chats/{chat_id}/ask")
async def ask_chat_question(
    chat_id: str,
    data: QuestionRequest,
    user: dict = Depends(get_current_user)
):
    apply_rate_limit(f"ask:{user['id']}", max_requests=30, window_seconds=60)
    if len(data.question) > 4000:
        raise HTTPException(status_code=400, detail="Question length exceeds 4,000 characters maximum limit.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, file_info FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")

    file_info = json.loads(row["file_info"]) if row["file_info"] else None
    
    try:
        # Create user message in DB
        user_msg_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_msg_id, chat_id, "user", data.question, int(time.time() * 1000))
        )

        history_text = ""
        for msg in data.history[-4:]:
            history_text += f"{msg.get('role', '')}: {msg.get('content', '')}\n"

        document_context = ""
        sources_payload = []
        sources_meta_json = []
        
        # Only query vector DB if document has been uploaded for this chat
        if file_info:
            query_embeddings = generate_embeddings([data.question])
            results = collection.query(
                query_embeddings=query_embeddings,
                n_results=3,
                where={"chat_id": chat_id}
            )
            if results and results.get("documents") and len(results["documents"][0]) > 0:
                document_context = "\n".join(results["documents"][0])[:12000]
                raw_ids = results["ids"][0]
                raw_meta = results["metadatas"][0] if results.get("metadatas") else []
                for idx, cid in enumerate(raw_ids):
                    meta_item = raw_meta[idx] if idx < len(raw_meta) else {}
                    source_name = meta_item.get("source", "Document Context")
                    sources_payload.append({
                        "chunk_id": cid,
                        "source": source_name,
                        "chunk_index": idx,
                        "relevance": "High"
                    })
                    sources_meta_json.append({"source": source_name, "chunk_id": cid})

        context = f"Conversation History:\n{history_text}\n\nDocument Context:\n{document_context}"

        async def event_generator():
            # Send sources payload first
            yield f"data: {json.dumps({'sources': sources_payload})}\n\n"
            
            full_answer = ""
            for chunk in generate_answer_stream(context, data.question, data.persona, data.model_id):
                full_answer += chunk
                yield f"data: {json.dumps({'text': chunk})}\n\n"

            # Create assistant message in DB at the end of the stream
            conn_gen = get_db()
            cursor_gen = conn_gen.cursor()
            assistant_msg_id = str(uuid.uuid4())
            cursor_gen.execute(
                "INSERT INTO messages (id, chat_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (assistant_msg_id, chat_id, "assistant", full_answer, json.dumps(sources_meta_json), int(time.time() * 1000))
            )
            cursor_gen.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (int(time.time() * 1000), chat_id))
            conn_gen.commit()
            conn_gen.close()

            yield "data: [DONE]\n\n"

        conn.commit()
        conn.close()

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

# ----------------------------
# Summary Endpoint
# ----------------------------
@app.post("/chats/{chat_id}/summary")
async def generate_chat_summary(
    chat_id: str,
    user: dict = Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, file_info FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")

    file_info = json.loads(row["file_info"]) if row["file_info"] else None
    if not file_info:
        conn.close()
        raise HTTPException(status_code=400, detail="No document found to summarize")

    try:
        query_embeddings = generate_embeddings(["document summary main topics events conclusion"])
        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=3,
            where={"chat_id": chat_id}
        )

        if not results or not results.get("documents") or len(results["documents"][0]) == 0:
            conn.close()
            raise HTTPException(status_code=400, detail="Vector index missing")

        context = "\n".join(results["documents"][0])[:15000]
        summary_question = "Generate a structured summary: Main Topics, Key Metrics, Important Concepts, Conclusion."

        async def summary_generator():
            full_summary = ""
            for chunk in generate_answer_stream(context, summary_question):
                full_summary += chunk
                yield f"data: {json.dumps({'text': chunk})}\n\n"

            # Save summary and assistant message to SQLite at the end of the stream
            conn_gen = get_db()
            cursor_gen = conn_gen.cursor()
            cursor_gen.execute("UPDATE chats SET summary = ?, updated_at = ? WHERE id = ?", (full_summary, int(time.time() * 1000), chat_id))
            
            msg_id = str(uuid.uuid4())
            cursor_gen.execute(
                "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (msg_id, chat_id, "assistant", full_summary, int(time.time() * 1000))
            )
            conn_gen.commit()
            conn_gen.close()

            yield "data: [DONE]\n\n"

        conn.commit()
        conn.close()

        return StreamingResponse(summary_generator(), media_type="text/event-stream")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Summary failed: {str(e)}")

# ----------------------------
# Report Management Endpoints
# ----------------------------
@app.post("/reports")
async def generate_report(data: ReportCreateRequest, user: dict = Depends(get_current_user)):
    apply_rate_limit(f"reports:{user['id']}", max_requests=10, window_seconds=60)
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if chat exists and belongs to user
    cursor.execute("SELECT id, title, file_info FROM chats WHERE id = ? AND user_id = ?", (data.chat_id, user["id"]))
    chat_row = cursor.fetchone()
    if not chat_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    file_info = json.loads(chat_row["file_info"]) if chat_row["file_info"] else None
    if not file_info:
        conn.close()
        raise HTTPException(status_code=400, detail="Please upload a document to this chat before generating a report")
        
    try:
        # Query ChromaDB context
        query_embeddings = generate_embeddings(["document main concepts experimental results data charts findings summary"])
        results = collection.query(
            query_embeddings=query_embeddings,
            n_results=4,
            where={"chat_id": data.chat_id}
        )
        
        context = ""
        if results and results.get("documents") and len(results["documents"][0]) > 0:
            context = "\n".join(results["documents"][0])[:15000]
            
        if not context:
            conn.close()
            raise HTTPException(status_code=400, detail="No indexed document text chunks found in vector database")
            
        # Call LLM to generate report
        from llm_service import generate_answer
        report_prompt = """
        Generate a professional, publication-quality research report based on the provided document context.
        You must structure the output into separate sections using headings exactly as labeled below.
        Be thorough, analytical, and professional.
        
        Sections:
        ---EXECUTIVE SUMMARY---
        Write a concise executive summary.
        ---RESEARCH OVERVIEW---
        Explain the overview, scope, and data details of the research.
        ---DETAILED ANALYSIS---
        Write a deep analysis of the methodology, inputs, and structure.
        ---KEY FINDINGS---
        List the key findings (bulleted).
        ---AI INSIGHTS---
        Provide your high-level AI observations and patterns.
        ---RECOMMENDATIONS---
        Give actionable recommendations.
        ---CONCLUSION---
        Conclude the report.
        """
        
        raw_report = generate_answer(context, report_prompt)
        
        # Parse sections
        def parse_section(text, marker):
            pattern = rf"---{marker}---\s*(.*?)(?=\n---|\Z)"
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            return match.group(1).strip() if match else f"No {marker.lower().replace('_', ' ')} available in context."
            
        exec_summary = parse_section(raw_report, "EXECUTIVE SUMMARY")
        overview = parse_section(raw_report, "RESEARCH OVERVIEW")
        analysis = parse_section(raw_report, "DETAILED ANALYSIS")
        findings = parse_section(raw_report, "KEY FINDINGS")
        insights = parse_section(raw_report, "AI INSIGHTS")
        recs = parse_section(raw_report, "RECOMMENDATIONS")
        conclusion = parse_section(raw_report, "CONCLUSION")
        
        report_id = str(uuid.uuid4())
        now = int(time.time() * 1000)
        report_title = data.title or f"Research Report: {chat_row['title']}"
        
        cursor.execute(
            "INSERT INTO reports (id, user_id, title, chat_id, executive_summary, research_overview, detailed_analysis, key_findings, ai_insights, recommendations, conclusion, confidence_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (report_id, user["id"], report_title, data.chat_id, exec_summary, overview, analysis, findings, insights, recs, conclusion, 0.95, now, now)
        )
        conn.commit()
        conn.close()
        
        return {
            "id": report_id,
            "title": report_title,
            "executive_summary": exec_summary,
            "research_overview": overview,
            "detailed_analysis": analysis,
            "key_findings": findings,
            "ai_insights": insights,
            "recommendations": recs,
            "conclusion": conclusion,
            "confidence_score": 0.95,
            "created_at": now
        }
        
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@app.get("/reports")
def get_reports(search: str = None, favorite: bool = None, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM reports WHERE user_id = ? AND is_deleted = 0"
    params = [user["id"]]
    
    if search:
        query += " AND (title LIKE ? OR executive_summary LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    if favorite is not None:
        query += " AND is_favorite = ?"
        params.append(1 if favorite else 0)
        
    query += " ORDER BY created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    reports = []
    for r in rows:
        reports.append(dict(r))
    return reports

@app.put("/reports/{report_id}")
def update_report(report_id: str, data: dict, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")
        
    updates = []
    params = []
    if "title" in data:
        updates.append("title = ?")
        params.append(data["title"])
    if "is_favorite" in data:
        updates.append("is_favorite = ?")
        params.append(1 if data["is_favorite"] else 0)
        
    if updates:
        params.extend([int(time.time() * 1000), report_id])
        cursor.execute(f"UPDATE reports SET {', '.join(updates)}, updated_at = ? WHERE id = ?", params)
        conn.commit()
        
    conn.close()
    return {"message": "Report updated successfully"}

@app.delete("/reports/{report_id}")
def delete_report(report_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT user_id FROM reports WHERE id = ?", (report_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")
        
    # Soft delete
    cursor.execute("UPDATE reports SET is_deleted = 1, updated_at = ? WHERE id = ?", (int(time.time() * 1000), report_id))
    conn.commit()
    conn.close()
    return {"message": "Report deleted successfully"}

@app.post("/reports/{report_id}/duplicate")
def duplicate_report(report_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM reports WHERE id = ? AND user_id = ?", (report_id, user["id"]))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found")
        
    new_id = str(uuid.uuid4())
    now = int(time.time() * 1000)
    cursor.execute(
        "INSERT INTO reports (id, user_id, title, chat_id, executive_summary, research_overview, detailed_analysis, key_findings, ai_insights, recommendations, conclusion, confidence_score, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (new_id, user["id"], f"Copy of {row['title']}", row["chat_id"], row["executive_summary"], row["research_overview"], row["detailed_analysis"], row["key_findings"], row["ai_insights"], row["recommendations"], row["conclusion"], row["confidence_score"], row["is_favorite"], now, now)
    )
    conn.commit()
    conn.close()
    return {"id": new_id, "message": "Report duplicated successfully"}

# ----------------------------
# Razorpay Webhook Endpoint
# ----------------------------
# Admin Panel Endpoints
# ----------------------------
@app.get("/admin/stats")
def get_admin_stats(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM users")
    total_users = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM reports WHERE is_deleted = 0")
    total_reports = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE created_at > ?", (int(time.time() - 30*24*3600)*1000,))
    users_growth = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM messages")
    ai_queries = cursor.fetchone()["count"]
    
    conn.close()
    return {
        "total_users": total_users,
        "total_reports": total_reports,
        "users_growth": users_growth,
        "ai_queries": ai_queries
    }

@app.get("/admin/users")
def list_admin_users(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, username, role, name, status, is_verified, created_at FROM users")
    rows = cursor.fetchall()
    conn.close()
    
    users = []
    for r in rows:
        users.append(dict(r))
    return users

@app.put("/admin/users/{target_id}/status")
def toggle_user_status(target_id: str, data: UserStatusRequest, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")
        
    if data.status not in ["active", "suspended"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be active or suspended.")
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET status = ? WHERE id = ?", (data.status, target_id))
    conn.commit()
    conn.close()
    return {"message": f"User status updated to {data.status}"}

@app.delete("/admin/users/{target_id}")
def admin_delete_user(target_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (target_id,))
    conn.commit()
    conn.close()
    return {"message": "User deleted successfully"}

# ----------------------------
# Contact Support Endpoint
# ----------------------------
@app.post("/contact")
def submit_contact(data: ContactRequest):
    print(f"[CONTACT FORM] Submission from {data.name} ({data.email}): {data.message}")
    
    tickets_dir = os.path.join(DATA_DIR, "support_tickets")
    os.makedirs(tickets_dir, exist_ok=True)
    filename = os.path.join(tickets_dir, f"{int(time.time())}_{data.email}.txt")
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"Name: {data.name}\nEmail: {data.email}\n\nMessage:\n{data.message}")
        
    return {"message": "Inquiry submitted successfully. Our support team will get back to you shortly."}

# ----------------------------
# Health Check
# ----------------------------
@app.get("/")
def home():
    return {"message": "AI Research Assistant Backend Running"}
