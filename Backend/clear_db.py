import os
import sqlite3
import chromadb
from database import SQLITE_DB, CHROMA_PATH

def clear_all_data():
    print("[CLEANUP] Starting Database Clean-up...")
    
    # 1. Locate and Clear SQLite Database
    if os.path.exists(SQLITE_DB):
        try:
            print(f"[CLEANUP] Found SQLite database at: {SQLITE_DB}")
            conn = sqlite3.connect(SQLITE_DB)
            cursor = conn.cursor()
            
            cursor.execute("PRAGMA foreign_keys = OFF;")
            cursor.execute("DELETE FROM messages;")
            cursor.execute("DELETE FROM chats;")
            cursor.execute("DELETE FROM sessions;")
            cursor.execute("DELETE FROM reports;")
            cursor.execute("DELETE FROM users;")
            cursor.execute("PRAGMA foreign_keys = ON;")
            
            conn.commit()
            conn.close()
            print("[CLEANUP] SQLite database cleared (all users, sessions, chats, messages, and reports deleted).")
        except Exception as e:
            print(f"[CLEANUP] Error clearing SQLite: {e}")
    else:
        print("[CLEANUP] SQLite database file not found. Skipping SQL clear.")

    # 2. Locate and Clear ChromaDB Vector Store
    try:
        print(f"[CLEANUP] Accessing ChromaDB folder at: {CHROMA_PATH}")
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        try:
            client.delete_collection("research_docs")
            print("[CLEANUP] ChromaDB collection 'research_docs' deleted.")
        except Exception:
            print("[CLEANUP] 'research_docs' collection did not exist or was already deleted.")
            
        client.get_or_create_collection(name="research_docs")
        print("[CLEANUP] Fresh 'research_docs' collection initialized in ChromaDB.")
    except Exception as e:
        print(f"[CLEANUP] Error clearing ChromaDB: {e}")
        
    print("[CLEANUP] System database reset complete! Users must now register fresh accounts.")

if __name__ == "__main__":
    clear_all_data()
