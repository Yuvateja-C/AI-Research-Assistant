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
    
    if token.startswith("mock_social_"):
        cursor.execute("SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at FROM users WHERE email = ?", ("social_user@example.com",))
        user = cursor.fetchone()
        if not user:
            now = int(time.time() * 1000)
            cursor.execute(
                "INSERT INTO users (email, username, password_hash, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                ("social_user@example.com", "Social Explorer", "mocked_hash", "user", 0, None, "free", now)
            )
            conn.commit()
            cursor.execute("SELECT id, email, username, role, is_2fa_enabled, secret_2fa, tier, trial_starts_at, subscription_expires_at FROM users WHERE email = ?", ("social_user@example.com",))
            user = cursor.fetchone()
        
        user_id = user['id']
        now_sec = int(time.time())
        expiry = now_sec + 7 * 24 * 3600
        cursor.execute("SELECT user_id FROM sessions WHERE token = ?", (token,))
        session_row = cursor.fetchone()
        if not session_row:
            cursor.execute(
                "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                (token, user_id, expiry)
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
