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
from pdf_service import extract_text_from_pdf
from database import collection, get_db
from llm_service import generate_answer, generate_answer_stream
from embeddings_service import generate_embeddings
from auth_service import hash_password, verify_password, create_session, get_user_from_token, delete_session
try:
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
except ImportError:
    stripe = None

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

razorpay_client = None
try:
    import razorpay
    if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
except ImportError:
    razorpay = None

app = FastAPI()

@app.on_event("startup")
def startup_event():
    if os.getenv("RESET_DB_ON_STARTUP") == "true":
        try:
            from clear_db import clear_all_data
            clear_all_data()
            print("🚀 Startup database cleanup completed successfully.")
        except Exception as e:
            print(f"⚠️ Startup database cleanup failed: {e}")
    else:
        print("🚀 Startup database cleanup bypassed (RESET_DB_ON_STARTUP is not set to true).")

# ----------------------------
# CORS
# ----------------------------
origins = [
    "https://researchai-app.vercel.app",
    "https://ai-research-assistant-yuvateja-cs-projects.vercel.app",
    "https://ai-research-assistant-gamma-six.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://(ai-research-assistant-.*|researchai-app-.*|researchai-app)\.vercel\.app",
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
# SMTP Email Service Setup
# ----------------------------
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = os.getenv("SMTP_PORT")
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@researchai.app")

def send_html_email(to_email: str, subject: str, html_content: str):
    # Always log mock emails locally for inspection
    os.makedirs("mock_emails", exist_ok=True)
    filename = f"mock_emails/{int(time.time())}_{to_email}_{subject.replace(' ', '_')}.html"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"Subject: {subject}\nTo: {to_email}\n\n{html_content}")
    print(f"[EMAIL] Saved email to {filename}")

    if SMTP_HOST and SMTP_PORT and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))

            server = smtplib.SMTP(SMTP_HOST, int(SMTP_PORT))
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
            server.quit()
            print(f"[EMAIL] Sent real email to {to_email}")
        except Exception as e:
            print(f"[EMAIL] Failed to send real email to {to_email}: {e}")

def get_email_template(title: str, message: str, button_text: str = None, button_url: str = None) -> str:
    btn_html = ""
    if button_text and button_url:
        btn_html = f"""
        <div style="margin: 28px 0; text-align: center;">
            <a href="{button_url}" target="_blank" style="background: linear-gradient(135deg, #7c5bf5 0%, #3b82f6 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(124, 91, 245, 0.3); border: none;">
                {button_text}
            </a>
        </div>
        """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Inter', Arial, sans-serif; background-color: #0b0b10; color: #ffffff; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 20px auto; background-color: #14141c; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }}
            .logo {{ font-size: 24px; font-weight: 800; color: #ffffff; text-align: center; margin-bottom: 20px; text-decoration: none; }}
            .logo span {{ background: linear-gradient(135deg, #7c5bf5 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
            h1 {{ font-size: 22px; font-weight: bold; margin-bottom: 20px; text-align: center; color: #fff; }}
            p {{ font-size: 14px; line-height: 1.6; color: #a1a1aa; }}
            .footer {{ margin-top: 40px; text-align: center; font-size: 11px; color: #71717a; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; }}
        </style>
    </head>
    <body>
        <div style="background-color: #0b0b10; padding: 40px 20px;">
            <div class="container">
                <div class="logo"><span>ResearchAI</span></div>
                <h1>{title}</h1>
                <p>{message}</p>
                {btn_html}
                <div class="footer">
                    &copy; 2026 ResearchAI. All rights reserved.<br>
                    Intelligent Document Analysis SaaS Platform
                </div>
            </div>
        </div>
    </body>
    </html>
    """

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

class SocialCallbackRequest(BaseModel):
    provider: str
    token: str

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

class ProfileUpdateRequest(BaseModel):
    name: str = None
    email: str = None

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
    title: str = None

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
    verification_token = secrets.token_urlsafe(32)
    
    cursor.execute(
        "INSERT INTO users (id, email, username, password_hash, salt, tier, trial_starts_at, created_at, name, status, is_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, data.email.lower(), data.username.lower(), pw_hash, salt, "free", int(time.time() * 1000), int(time.time() * 1000), data.username.title(), "active", 0, verification_token)
    )
    conn.commit()
    conn.close()

    # Send verification email
    verify_url = f"https://researchai-app.vercel.app/verify-email?token={verification_token}"
    email_html = get_email_template(
        "Welcome to ResearchAI!",
        f"Thank you for registering. Please click the button below to verify your email address and unlock your intelligent research workspace.",
        "Verify Email Address",
        verify_url
    )
    send_html_email(data.email.lower(), "Verify Your Email - ResearchAI", email_html)

    return {"message": "Registration successful. Please verify your email.", "user_id": user_id, "verification_link": verify_url}

@app.get("/auth/verify-email")
def verify_email(token: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email FROM users WHERE verification_token = ?", (token,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    cursor.execute("UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()
    return {"message": "Email verified successfully!"}

@app.post("/auth/verify-email-by-email")
def verify_email_by_email(data: dict):
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ? OR username = ?", (email.lower(), email.lower()))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="User account not found")
    cursor.execute("UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?", (row["id"],))
    conn.commit()
    conn.close()
    return {"message": f"Email {email} verified successfully!"}

@app.post("/auth/login")
def login(data: LoginRequest, response: Response):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, password_hash, salt, is_2fa_enabled, secret_2fa, status, is_verified FROM users WHERE email = ? OR username = ?",
        (data.username_or_email.lower(), data.username_or_email.lower())
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row or not verify_password(data.password, row["salt"], row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if row["status"] == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")
        
    if not row["is_verified"]:
        raise HTTPException(status_code=403, detail="Please verify your email address before logging in.")
    
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

@app.post("/auth/social-callback")
def social_callback(data: SocialCallbackRequest, response: Response):
    import requests
    email = None
    name = None
    
    if data.provider == "google":
        try:
            res = requests.get(f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={data.token}")
            if not res.ok:
                raise HTTPException(status_code=400, detail="Failed to verify Google token")
            info = res.json()
            email = info.get("email")
            name = info.get("name") or info.get("given_name")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Google token verification failed: {str(e)}")
            
    elif data.provider == "microsoft":
        try:
            headers = {"Authorization": f"Bearer {data.token}"}
            res = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers)
            if not res.ok:
                raise HTTPException(status_code=400, detail="Failed to verify Microsoft token")
            info = res.json()
            email = info.get("mail") or info.get("userPrincipalName")
            name = info.get("displayName")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Microsoft token verification failed: {str(e)}")
            
    else:
        raise HTTPException(status_code=400, detail="Invalid social provider")
        
    if not email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from provider")
        
    email_lower = email.lower()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at, name, status, is_verified FROM users WHERE email = ?",
        (email_lower,)
    )
    user_row = cursor.fetchone()
    
    if not user_row:
        now = int(time.time() * 1000)
        user_id = str(uuid.uuid4())
        username = email_lower.split("@")[0]
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            username = f"{username}_{secrets.token_hex(3)}"
            
        real_name = name if name else username.title()
        
        cursor.execute(
            "INSERT INTO users (id, email, username, password_hash, salt, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, created_at, name, status, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, email_lower, username, "oauth_mocked_hash", "oauth_mocked_salt", "user", 0, None, "free", now, now, real_name, "active", 1)
        )
        conn.commit()
        
        cursor.execute(
            "SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at, name, status, is_verified FROM users WHERE id = ?",
            (user_id,)
        )
        user_row = cursor.fetchone()
        
    user_dict = dict(user_row)
    conn.close()
    
    if user_dict["status"] == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended. Please contact support.")
        
    token = create_session(user_dict["id"])
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=True
    )
    return {"message": "Social login successful", "token": token}

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
        "subscription_expires_at": user.get("subscription_expires_at"),
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
                print("⚠️ ChromaDB Dimension Mismatch detected. Re-creating collection...")
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
    global collection
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
                collection = safe_collection_add(
                    collection,
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
            collection = safe_collection_add(
                collection,
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
# Report Management Endpoints
# ----------------------------
@app.post("/reports")
async def generate_report(data: ReportCreateRequest, user: dict = Depends(get_current_user)):
    user = verify_user_subscription(user)
    tier = user.get("tier", "free")
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Free tier limit check
    if tier == "free":
        cursor.execute("SELECT COUNT(*) as count FROM reports WHERE user_id = ? AND is_deleted = 0", (user["id"],))
        count = cursor.fetchone()["count"]
        if count >= 3:
            conn.close()
            raise HTTPException(status_code=403, detail="Free tier report generation limit reached. Please upgrade to Pro.")
            
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
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")

def verify_razorpay_webhook(payload: bytes, signature: str) -> bool:
    if not RAZORPAY_WEBHOOK_SECRET:
        print("[RAZORPAY] RAZORPAY_WEBHOOK_SECRET is not configured in .env. Skipping verification.")
        return True
    import hmac
    import hashlib
    generated_signature = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(generated_signature, signature)

@app.post("/auth/razorpay/webhook")
async def razorpay_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")
        
    if not verify_razorpay_webhook(payload, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
    try:
        data = json.loads(payload)
        event = data.get("event")
        
        if event == "subscription.charged":
            sub_entity = data["payload"]["subscription"]["entity"]
            notes = sub_entity.get("notes", {})
            user_id = notes.get("user_id")
            
            if user_id:
                conn = get_db()
                cursor = conn.cursor()
                now = int(time.time() * 1000)
                plan = notes.get("plan", "monthly")
                days = 365 if plan == "yearly" else 30
                expiry = now + (days * 24 * 3600 * 1000)
                
                cursor.execute("UPDATE users SET tier = 'pro', subscription_expires_at = ? WHERE id = ?", (expiry, user_id))
                conn.commit()
                
                cursor.execute("SELECT email, username FROM users WHERE id = ?", (user_id,))
                user_row = cursor.fetchone()
                conn.close()
                
                if user_row:
                    email_html = get_email_template(
                        "Payment Successful - Premium Activated",
                        f"Hi {user_row['username']}, your subscription payment was captured successfully! Your ResearchAI Pro account is now active. Thank you for supporting our platform!"
                    )
                    send_html_email(user_row["email"], "Payment Success - ResearchAI Pro", email_html)
                    
        elif event in ["subscription.cancelled", "subscription.halted"]:
            sub_entity = data["payload"]["subscription"]["entity"]
            notes = sub_entity.get("notes", {})
            user_id = notes.get("user_id")
            
            if user_id:
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute("UPDATE users SET tier = 'free', subscription_expires_at = NULL WHERE id = ?", (user_id,))
                conn.commit()
                conn.close()
                
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE tier = 'pro'")
    active_subs = cursor.fetchone()["count"]
    
    total_revenue = active_subs * 19.0
    
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE created_at > ?", (int(time.time() - 30*24*3600)*1000,))
    users_growth = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM messages")
    ai_queries = cursor.fetchone()["count"]
    
    conn.close()
    return {
        "total_users": total_users,
        "total_reports": total_reports,
        "active_subscriptions": active_subs,
        "total_revenue": total_revenue,
        "users_growth": users_growth,
        "ai_queries": ai_queries
    }

@app.get("/admin/users")
def list_admin_users(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden. Admin access required.")
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, username, role, tier, name, status, is_verified, created_at FROM users")
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
    
    os.makedirs("support_tickets", exist_ok=True)
    filename = f"support_tickets/{int(time.time())}_{data.email}.txt"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"Name: {data.name}\nEmail: {data.email}\n\nMessage:\n{data.message}")
        
    email_html = get_email_template(
        "Support Ticket Received",
        f"Hi {data.name}, thank you for contacting ResearchAI Support. We have received your inquiry regarding: '{data.message[:100]}...' and our team will get back to you within 24 hours."
    )
    send_html_email(data.email.lower(), "Support Ticket Received - ResearchAI", email_html)
    
    return {"message": "Inquiry submitted successfully. Confirmation email sent."}

# ----------------------------
# Health Check
# ----------------------------
@app.get("/")
def home():
    return {"message": "AI Research Assistant Backend Running"}
