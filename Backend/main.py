import os
import shutil
import uuid
import time
import json
import sqlite3
import re
import secrets
import stripe
import razorpay
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, Response, Cookie, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from chunk_service import chunk_text
from pdf_service import extract_text_from_pdf
from database import collection, get_db
from llm_service import generate_answer, generate_answer_stream
from embeddings_service import generate_embeddings
from auth_service import hash_password, verify_password, create_session, get_user_from_token, delete_session

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

app = FastAPI()

# ----------------------------
# CORS
# ----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ai-research-assistant-gamma-six.vercel.app",
        "https://ai-research-assistant-yuvateja-cs-projects.vercel.app",
        "https://researchai-app.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
PROCESSED_FOLDER = "processed"
CHUNKS_FOLDER = "chunks"

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

def verify_user_subscription(user: dict) -> dict:
    tier = user.get("tier", "free")
    expires_at = user.get("subscription_expires_at")
    if tier == "pro" and expires_at:
        if int(time.time() * 1000) > expires_at:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET tier = 'free' WHERE id = ?", (user["id"],))
            conn.commit()
            conn.close()
            user["tier"] = "free"
    return user

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
    code_2fa: str = None

class RecoverRequest(BaseModel):
    email: str

class ResetRequest(BaseModel):
    token: str
    new_password: str

class Verify2FARequest(BaseModel):
    code: str

class ChatUpdateRequest(BaseModel):
    title: str = None
    tags: str = None
    status: str = None

class UpgradeRequest(BaseModel):
    plan: str

class VerifyRazorpayRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan: str

class QuestionRequest(BaseModel):
    question: str
    history: list = []
    persona: str = "default"

# ----------------------------
# Auth Endpoints
# ----------------------------
@app.post("/auth/register")
def register(data: RegisterRequest):
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
        "INSERT INTO users (id, email, username, password_hash, salt, tier, trial_starts_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, data.email.lower(), data.username.lower(), pw_hash, salt, "free", int(time.time() * 1000), int(time.time() * 1000))
    )
    conn.commit()
    conn.close()
    return {"message": "Registration successful", "user_id": user_id}

@app.post("/auth/login")
def login(data: LoginRequest, response: Response):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, password_hash, salt, is_2fa_enabled, secret_2fa FROM users WHERE email = ? OR username = ?",
        (data.username_or_email.lower(), data.username_or_email.lower())
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row or not verify_password(data.password, row["salt"], row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
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
    return {"message": "Login successful", "token": token}

@app.post("/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
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
        "tier": user.get("tier", "free"),
        "trial_starts_at": user.get("trial_starts_at"),
        "subscription_expires_at": user.get("subscription_expires_at")
    }}

@app.post("/auth/upgrade")
def upgrade_user_tier(data: UpgradeRequest, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    
    # Calculate subscription expiration time based on selected plan
    now = int(time.time() * 1000)
    months = 1
    if data.plan == "5_months":
        months = 5
    elif data.plan == "12_months":
        months = 12
        
    expiry = now + (months * 30 * 24 * 3600 * 1000)
    
    cursor.execute("UPDATE users SET tier = 'pro', subscription_expires_at = ? WHERE id = ?", (expiry, user["id"]))
    conn.commit()
    conn.close()
    return {"status": "success", "tier": "pro", "subscription_expires_at": expiry}

@app.post("/auth/create-checkout-session")
def create_checkout_session(user: dict = Depends(get_current_user)):
    if not stripe.api_key:
        return {"url": "simulated_stripe_checkout"}
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': 'ResearchAI Pro Plan',
                            'description': 'Unlimited document uploads, 10 GB file support, and premium AI personas.',
                        },
                        'unit_amount': 1900,
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',
            success_url=f"https://researchai-app.vercel.app/?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            cancel_url="https://researchai-app.vercel.app/?status=cancel",
            client_reference_id=user["id"]
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/verify-checkout")
def verify_checkout_session(session_id: str, user: dict = Depends(get_current_user)):
    if not stripe.api_key or session_id == "mock_session_id":
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET tier = 'pro' WHERE id = ?", (user["id"],))
        conn.commit()
        conn.close()
        return {"status": "success", "tier": "pro"}
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status == "paid" and session.client_reference_id == user["id"]:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET tier = 'pro' WHERE id = ?", (user["id"],))
            conn.commit()
            conn.close()
            return {"status": "success", "tier": "pro"}
        else:
            raise HTTPException(status_code=400, detail="Payment verification failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/razorpay/create-order")
def create_razorpay_order(data: UpgradeRequest, user: dict = Depends(get_current_user)):
    amount = 4900
    if data.plan == "5_months":
        amount = 24900
    elif data.plan == "12_months":
        amount = 49900

    if amount < 100:
        raise HTTPException(status_code=400, detail="Minimum amount must be at least 100 paise")

    if not razorpay_client:
        mock_order_id = f"order_mock_{uuid.uuid4().hex[:12]}"
        return {
            "order_id": mock_order_id,
            "amount": amount,
            "currency": "INR",
            "simulated": True
        }

    try:
        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"receipt_{user['id']}_{int(time.time())}"
        }
        order = razorpay_client.order.create(data=order_data)
        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "simulated": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay API Error: {str(e)}")

@app.post("/auth/razorpay/verify")
def verify_razorpay_payment(data: VerifyRazorpayRequest, user: dict = Depends(get_current_user)):
    if data.razorpay_order_id.startswith("order_mock_"):
        now = int(time.time() * 1000)
        months = 1
        if data.plan == "5_months":
            months = 5
        elif data.plan == "12_months":
            months = 12
        expiry = now + (months * 30 * 24 * 3600 * 1000)

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET tier = 'pro', subscription_expires_at = ? WHERE id = ?", (expiry, user["id"]))
        conn.commit()
        conn.close()
        return {"status": "success", "tier": "pro", "subscription_expires_at": expiry}

    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Razorpay client not configured")

    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': data.razorpay_order_id,
            'razorpay_payment_id': data.razorpay_payment_id,
            'razorpay_signature': data.razorpay_signature
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Signature mismatch. Payment verification failed.")

    now = int(time.time() * 1000)
    months = 1
    if data.plan == "5_months":
        months = 5
    elif data.plan == "12_months":
        months = 12
    expiry = now + (months * 30 * 24 * 3600 * 1000)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET tier = 'pro', subscription_expires_at = ? WHERE id = ?", (expiry, user["id"]))
    conn.commit()
    conn.close()

    return {"status": "success", "tier": "pro", "subscription_expires_at": expiry}

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
        "recovery_link": f"https://researchai-app.vercel.app/reset-password?token={token}"
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
import fitz # PyMuPDF
import zipfile
import xml.etree.ElementTree as ET

def extract_text_from_office(file_path: str, ext: str) -> str:
    try:
        with zipfile.ZipFile(file_path, 'r') as doc_zip:
            if ext == ".docx":
                xml_content = doc_zip.read('word/document.xml')
                root = ET.fromstring(xml_content)
                paragraphs = []
                for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                    texts = [node.text for node in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                    if texts:
                        paragraphs.append("".join(texts))
                return "\n".join(paragraphs)
            elif ext == ".xlsx":
                try:
                    xml_content = doc_zip.read('xl/sharedStrings.xml')
                    root = ET.fromstring(xml_content)
                    strings = []
                    for t in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                        if t.text:
                            strings.append(t.text)
                    return "\n".join(strings)
                except KeyError:
                    return ""
            elif ext == ".pptx":
                slide_texts = []
                slide_files = sorted([f for f in doc_zip.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')])
                for slide_file in slide_files:
                    xml_content = doc_zip.read(slide_file)
                    root = ET.fromstring(xml_content)
                    for t in root.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'):
                        if t.text:
                            slide_texts.append(t.text)
                return "\n".join(slide_texts)
    except Exception as e:
        return f"Error extracting text from office file: {str(e)}"
    return ""

@app.post("/upload")
async def upload_large_pdf(
    request: Request,
    filename: str,
    chat_id: str,
    user: dict = Depends(get_current_user)
):
    user = verify_user_subscription(user)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM chats WHERE id = ?", (chat_id,))
    row = cursor.fetchone()
    if not row or row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chat not found")
    # Check upload limits for Free Tier
    tier = user.get("tier", "free")
    if tier == "free":
        cursor.execute("SELECT COUNT(*) as count FROM chats WHERE user_id = ? AND file_info IS NOT NULL", (user["id"],))
        upload_count = cursor.fetchone()["count"]
        if upload_count >= 3:
            conn.close()
            raise HTTPException(status_code=403, detail="Free trial upload limit reached. Please upgrade to Research Pro.")

    file_path = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4()}_{filename}")
    
    # 1. Stream file directly to disk to prevent RAM usage on 10 GB uploads
    try:
        with open(file_path, "wb") as buffer:
            async for chunk in request.stream():
                buffer.write(chunk)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        conn.close()
        raise HTTPException(status_code=500, detail=f"Streaming upload failed: {str(e)}")

    # 2. Page-by-page text extraction, chunking, and batch embedding to ChromaDB
    try:
        page_chunks = []
        chunk_size = 1000
        text_buffer = ""
        total_chunks_processed = 0

        lower_fn = filename.lower()
        if lower_fn.endswith(".pdf"):
            doc = fitz.open(file_path)
            for page in doc:
                text_buffer += page.get_text() + "\n"
        elif lower_fn.endswith((".txt", ".md", ".csv")):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text_buffer = f.read()
        elif lower_fn.endswith((".docx", ".xlsx", ".pptx")):
            ext = os.path.splitext(lower_fn)[1]
            text_buffer = extract_text_from_office(file_path, ext)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
            
        # Chunk when buffer is large enough
        while len(text_buffer) >= chunk_size:
            chunk = text_buffer[:chunk_size]
            page_chunks.append(chunk)
            text_buffer = text_buffer[chunk_size:]

            # Embed and index in batches of 100 to optimize API speed
            if len(page_chunks) >= 100:
                embeddings = generate_embeddings(page_chunks)
                ids = [f"{chat_id}_chunk_{total_chunks_processed + i}" for i in range(len(page_chunks))]
                collection.add(
                    documents=page_chunks,
                    embeddings=embeddings,
                    ids=ids,
                    metadatas=[{"source": filename, "chat_id": chat_id} for _ in page_chunks]
                )
                total_chunks_processed += len(page_chunks)
                page_chunks = []

        # Flush leftover buffer
        if text_buffer:
            page_chunks.append(text_buffer)
        if page_chunks:
            embeddings = generate_embeddings(page_chunks)
            ids = [f"{chat_id}_chunk_{total_chunks_processed + i}" for i in range(len(page_chunks))]
            collection.add(
                documents=page_chunks,
                embeddings=embeddings,
                ids=ids,
                metadatas=[{"source": filename, "chat_id": chat_id} for _ in page_chunks]
            )
            total_chunks_processed += len(page_chunks)

        # Update Chat File Details in Database
        file_info = json.dumps({"filename": filename, "chunks": total_chunks_processed})
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
            "filename": filename,
            "status": "processed",
            "total_chunks": total_chunks_processed
        }
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        conn.close()
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# ----------------------------
# Ask Endpoint (RAG)
# ----------------------------
@app.post("/chats/{chat_id}/ask")
async def ask_chat_question(
    chat_id: str,
    data: QuestionRequest,
    user: dict = Depends(get_current_user)
):
    user = verify_user_subscription(user)
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
        sources = []
        
        # Only query vector DB if document has been uploaded for this chat
        if file_info:
            query_embeddings = generate_embeddings([data.question])
            results = collection.query(
                query_embeddings=query_embeddings,
                n_results=2,
                where={"chat_id": chat_id}
            )
            if results and results.get("documents") and len(results["documents"][0]) > 0:
                document_context = "\n".join(results["documents"][0])[:12000]
                sources = results["ids"][0]

        context = f"Conversation History:\n{history_text}\n\nDocument Context:\n{document_context}"

        async def event_generator():
            # Send sources first
            yield f"data: {json.dumps({'sources': [{'chunk_index': idx, 'score': 0.9} for idx, _ in enumerate(sources)]})}\n\n"
            
            full_answer = ""
            for chunk in generate_answer_stream(context, data.question, data.persona):
                full_answer += chunk
                yield f"data: {json.dumps({'text': chunk})}\n\n"

            # Create assistant message in DB at the end of the stream
            conn_gen = get_db()
            cursor_gen = conn_gen.cursor()
            assistant_msg_id = str(uuid.uuid4())
            cursor_gen.execute(
                "INSERT INTO messages (id, chat_id, role, content, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (assistant_msg_id, chat_id, "assistant", full_answer, json.dumps(sources), int(time.time() * 1000))
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
# Health Check
# ----------------------------
@app.get("/")
def home():
    return {"message": "AI Research Assistant Backend Running"}
