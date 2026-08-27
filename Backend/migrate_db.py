import os
import sqlite3
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load env variables from active .env file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
SQLITE_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "research_assistant.db")

def migrate():
    if not DATABASE_URL:
        print("[MIGRATE] Error: DATABASE_URL is not set in your Backend/.env file.")
        print("[MIGRATE] Please configure your PostgreSQL database URL (Neon / AWS RDS / Self-hosted) first!")
        return

    # Normalise connection scheme
    conn_url = DATABASE_URL
    if conn_url.startswith("postgres://"):
        conn_url = conn_url.replace("postgres://", "postgresql://", 1)

    if not os.path.exists(SQLITE_DB):
        print(f"[MIGRATE] Note: SQLite database file not found at: {SQLITE_DB}")
        print("[MIGRATE] Starting with a clean cloud PostgreSQL database.")
        return

    print("[MIGRATE] Connecting to databases...")
    lite_conn = sqlite3.connect(SQLITE_DB)
    lite_conn.row_factory = sqlite3.Row
    lite_cursor = lite_conn.cursor()

    try:
        pg_conn = psycopg2.connect(conn_url)
        pg_cursor = pg_conn.cursor()
    except Exception as e:
        print(f"[MIGRATE] Error: Failed to connect to PostgreSQL: {e}")
        lite_conn.close()
        return

    tables = ["users", "chats", "messages", "sessions", "reports"]
    
    print("\n[MIGRATE] Starting data migration from SQLite to PostgreSQL...")

    for table in tables:
        print(f"\n[MIGRATE] Migrating table: {table}...")
        
        # 1. Fetch column names
        lite_cursor.execute(f"PRAGMA table_info({table})")
        columns = [col[1] for col in lite_cursor.fetchall()]
        if not columns:
            print(f"[MIGRATE] Note: Table {table} does not exist in SQLite database. Skipping.")
            continue
            
        col_list = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        # 2. Fetch all SQLite rows
        lite_cursor.execute(f"SELECT * FROM {table}")
        rows = lite_cursor.fetchall()
        
        print(f"[MIGRATE] Found {len(rows)} records in SQLite.")
        
        if not rows:
            continue

        # 3. Construct bulk insert query with conflict handlers
        # PostgreSQL supports ON CONFLICT (id) DO NOTHING
        insert_query = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING"
        
        migrated_count = 0
        for r in rows:
            row_dict = dict(r)
            values = [row_dict[col] for col in columns]
            
            try:
                pg_cursor.execute(insert_query, values)
                migrated_count += 1
            except Exception as e:
                print(f"[MIGRATE] Warning: Failed to migrate row in {table} (ID: {row_dict.get('id')}): {e}")
                pg_conn.rollback()
                
        pg_conn.commit()
        print(f"[MIGRATE] Successfully migrated {migrated_count} of {len(rows)} rows to PostgreSQL '{table}'.")

    print("\n[MIGRATE] Database migration complete!")
    lite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    migrate()
