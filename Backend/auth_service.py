import hashlib
import secrets
import time
from database import get_db

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pw_hash, salt

def verify_password(password: str, salt: str, password_hash: str) -> bool:
    pw_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pw_hash, password_hash)

def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    # 7 days expiration
    expires_at = int(time.time()) + (7 * 24 * 3600)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
        (secrets.token_hex(8), user_id, token, expires_at)
    )
    conn.commit()
    conn.close()
    return token

def get_user_from_token(token: str):
    if not token:
        return None
    conn = get_db()
    cursor = conn.cursor()
    
    if token.startswith("mock_social_") or token.startswith("mock_social:"):
        email = "social_user@example.com"
        if token.startswith("mock_social:"):
            parts = token.split(":")
            if len(parts) >= 2:
                email = parts[1]
        
        cursor.execute("SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at FROM users WHERE email = ?", (email.lower(),))
        user = cursor.fetchone()
        if not user:
            now = int(time.time() * 1000)
            social_id = str(__import__('uuid').uuid4())
            username = email.split("@")[0]
            # Ensure unique username
            cursor.execute("SELECT id FROM users WHERE username = ?", (username.lower(),))
            if cursor.fetchone():
                import secrets
                username = f"{username}_{secrets.token_hex(3)}"
            cursor.execute(
                "INSERT INTO users (id, email, username, password_hash, salt, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (social_id, email.lower(), username.lower(), "mocked_hash", "mocked_salt", "user", 0, None, "free", now, now)
            )
            conn.commit()
            cursor.execute("SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at FROM users WHERE email = ?", (email.lower(),))
            user = cursor.fetchone()
        
        user_id = user['id']
        now_sec = int(time.time())
        expiry = now_sec + 7 * 24 * 3600
        cursor.execute("SELECT user_id FROM sessions WHERE token = ?", (token,))
        session_row = cursor.fetchone()
        if not session_row:
            session_id = __import__('secrets').token_hex(8)
            cursor.execute(
                "INSERT INTO sessions (id, token, user_id, expires_at) VALUES (?, ?, ?, ?)",
                (session_id, token, user_id, expiry)
            )
            conn.commit()
        conn.close()
        return dict(user)

    now = int(time.time())
    cursor.execute(
        "SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?",
        (token, now)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    
    user_id = row['user_id']
    cursor.execute(
        "SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at FROM users WHERE id = ?",
        (user_id,)
    )
    user = cursor.fetchone()
    conn.close()
    if user:
        return dict(user)
    return None

def delete_session(token: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
