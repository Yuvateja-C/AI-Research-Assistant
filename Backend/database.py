import sqlite3
import chromadb
import os
import logging

# Dynamic persistent paths (Render support)
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = "/data" if os.path.exists("/data") and os.access("/data", os.W_OK) else BACKEND_DIR
SQLITE_DB = os.path.join(DATA_DIR, "research_assistant.db")
CHROMA_PATH = os.path.join(DATA_DIR, "chroma_db")

# ChromaDB
client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name="research_docs")

# PostgreSQL Config
DATABASE_URL = os.getenv("DATABASE_URL")
IS_PG = DATABASE_URL is not None and (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://"))

if IS_PG:
    import psycopg2
    import psycopg2.extras
    # Normalise postgres scheme for general driver compatibility
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


class CursorWrapper:
    """
    Adapter wrapper that intercept sqlite3 cursor calls and makes them 
    compatible with psycopg2 (PostgreSQL) e.g., mapping parameter placeholders.
    """
    def __init__(self, cursor, is_pg):
        self.cursor = cursor
        self.is_pg = is_pg

    def execute(self, query, params=None):
        if self.is_pg:
            # Replace sqlite3 parameter '?' placeholders with PostgreSQL '%s' placeholders
            query = query.replace('?', '%s')
        
        if params is not None:
            # Convert list of parameters to tuple for psycopg2 compatibility
            if isinstance(params, list):
                params = tuple(params)
            self.cursor.execute(query, params)
        else:
            self.cursor.execute(query)

    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        # Convert psycopg2 DictRow/RealDictRow or SQLite row to dict-accessible representation
        return row

    def fetchall(self):
        return self.cursor.fetchall()

    @property
    def lastrowid(self):
        # We use UUID strings as keys, so lastrowid is not needed. Bypassed for PG.
        return getattr(self.cursor, "lastrowid", None)

    def __iter__(self):
        return iter(self.cursor)

    def __getattr__(self, name):
        return getattr(self.cursor, name)


class ConnectionWrapper:
    """
    Adapter wrapper that maps SQLite transaction controls to PostgreSQL.
    """
    def __init__(self, conn, is_pg):
        self.conn = conn
        self.is_pg = is_pg

    def cursor(self):
        if self.is_pg:
            # DictCursor returns rows that can be accessed by index or by key
            cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        else:
            cursor = self.conn.cursor()
        return CursorWrapper(cursor, self.is_pg)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()

    def execute(self, query, params=None):
        cursor = self.cursor()
        cursor.execute(query, params)
        return cursor


def get_db():
    if IS_PG:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            return ConnectionWrapper(conn, True)
        except Exception as e:
            logging.error(f"Failed to connect to PostgreSQL database: {e}")
            raise e
    else:
        conn = sqlite3.connect(SQLITE_DB, timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys = ON")
        except sqlite3.OperationalError:
            pass
        return ConnectionWrapper(conn, False)


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        secret_2fa TEXT,
        is_2fa_enabled INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL
    )
    """)
    
    # 2. Chats Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        file_info TEXT,
        summary TEXT,
        status TEXT DEFAULT 'active',
        tags TEXT DEFAULT '',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # 3. Messages Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources TEXT,
        created_at BIGINT NOT NULL,
        FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
    """)
    
    # 4. Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at BIGINT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # 5. Reports Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        chat_id TEXT,
        executive_summary TEXT,
        research_overview TEXT,
        detailed_analysis TEXT,
        key_findings TEXT,
        ai_insights TEXT,
        recommendations TEXT,
        conclusion TEXT,
        confidence_score REAL,
        is_favorite INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # 6. Database Migrations (Run columns additions safely)
    migrations = [
        "ALTER TABLE users ADD COLUMN name TEXT",
        "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'",
        "ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN verification_token TEXT",
        "ALTER TABLE users ADD COLUMN reset_token TEXT",
        "ALTER TABLE users ADD COLUMN reset_token_expires BIGINT"
    ]
    
    for mig in migrations:
        try:
            cursor.execute(mig)
        except Exception:
            # Ignore if column already exists
            pass

    # 7. Relational Performance Indexes
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)",
        "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)",
        "CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_reports_chat_id ON reports(chat_id)"
    ]
    
    for idx in indexes:
        try:
            cursor.execute(idx)
        except Exception as e:
            logging.warning(f"Index creation skipped/failed: {e}")
            pass

    conn.commit()
    conn.close()

# Automatic startup table/index creation
try:
    init_db()
    print("[DB] Database initialization complete.")
except Exception as e:
    print(f"[DB] Database initialization failed: {e}")