import os
import sqlite3
import chromadb

# Possible database and ChromaDB directories depending on cwd
sqlite_options = ["research_assistant.db", "Backend/research_assistant.db", "../research_assistant.db"]
chroma_options = ["./chroma_db", "Backend/chroma_db", "../chroma_db"]

def clear_all_data():
    print("🧹 Starting Database Clean-up...")
    
    # 1. Locate and Clear SQLite Database
    sqlite_path = None
    for path in sqlite_options:
        if os.path.exists(path):
            sqlite_path = path
            break
            
    if sqlite_path:
        try:
            print(f"📂 Found SQLite database at: {sqlite_path}")
            conn = sqlite3.connect(sqlite_path)
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
            print("✅ SQLite database cleared (all users, sessions, chats, messages, and reports deleted).")
        except Exception as e:
            print(f"❌ Error clearing SQLite: {e}")
    else:
        print("⚠️ SQLite database file not found. Skipping SQL clear.")

    # 2. Locate and Clear ChromaDB Vector Store
    chroma_path = None
    for path in chroma_options:
        if os.path.exists(path):
            chroma_path = path
            break
            
    if not chroma_path:
        chroma_path = "./chroma_db" # default if not found
        
    try:
        print(f"📂 Accessing ChromaDB folder at: {chroma_path}")
        client = chromadb.PersistentClient(path=chroma_path)
        try:
            client.delete_collection("research_docs")
            print("✅ ChromaDB collection 'research_docs' deleted.")
        except Exception:
            print("卓越 'research_docs' collection did not exist or was already deleted.")
            
        client.get_or_create_collection(name="research_docs")
        print("✅ Fresh 'research_docs' collection initialized in ChromaDB.")
    except Exception as e:
        print(f"❌ Error clearing ChromaDB: {e}")
        
    print("🎉 System database reset complete! Users must now register fresh accounts.")

if __name__ == "__main__":
    clear_all_data()
