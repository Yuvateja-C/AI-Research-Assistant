import os
import shutil

def cleanup():
    print("[CLEANUP] Starting system cleanup...")
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Paths to delete
    paths_to_delete = [
        # Stray directories
        os.path.join(base_dir, "chroma_db"),
        os.path.join(base_dir, "Backend", "mock_emails"),
        
        # Backend obsolete scripts
        os.path.join(base_dir, "Backend", "storage_service.py"),
        os.path.join(base_dir, "Backend", "download_model.py"),
        os.path.join(base_dir, "Backend", "rag_service.py"),
        os.path.join(base_dir, "Backend", "store_chunks.py"),
        os.path.join(base_dir, "Backend", "test_chromadb.py"),
        os.path.join(base_dir, "Backend", "test_embedding.py"),
        os.path.join(base_dir, "Backend", "test_env.py"),
        os.path.join(base_dir, "Backend", "test_rag.py"),
        os.path.join(base_dir, "Backend", "test_real_search.py"),
        os.path.join(base_dir, "Backend", "test_search.py"),
        
        # Frontend obsolete files
        os.path.join(base_dir, "Frontend", "AskForm.jsx"),
        os.path.join(base_dir, "Frontend", "src", "AskForm.jsx"),
        os.path.join(base_dir, "Frontend", "src", "Navbar.jsx"),
        os.path.join(base_dir, "Frontend", "src", "UploadForm.jsx"),
        os.path.join(base_dir, "Frontend", "src", "App.css"),
        os.path.join(base_dir, "Frontend", "src", "hero.png"),
        os.path.join(base_dir, "Frontend", "src", "react.svg"),
        os.path.join(base_dir, "Frontend", "src", "vite.svg"),
        os.path.join(base_dir, "Frontend", "src", "pages", "HomeGPT.jsx"),
        os.path.join(base_dir, "Frontend", "src", "components", "AskForm.jsx"),
        os.path.join(base_dir, "Frontend", "src", "components", "Navbar.jsx"),
        os.path.join(base_dir, "Frontend", "src", "components", "UploadForm.jsx"),
    ]
    
    for path in paths_to_delete:
        if os.path.exists(path):
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                    print(f"[CLEANUP] Deleted directory: {path}")
                else:
                    os.remove(path)
                    print(f"[CLEANUP] Deleted file: {path}")
            except Exception as e:
                print(f"[CLEANUP] Failed to delete {path}: {e}")
        else:
            print(f"[CLEANUP] Path already deleted or not found: {path}")

    # Remove Frontend pages dir if empty
    pages_dir = os.path.join(base_dir, "Frontend", "src", "pages")
    if os.path.exists(pages_dir) and os.path.isdir(pages_dir):
        if not os.listdir(pages_dir):
            try:
                os.rmdir(pages_dir)
                print(f"[CLEANUP] Deleted empty directory: {pages_dir}")
            except Exception as e:
                print(f"[CLEANUP] Failed to remove pages directory: {e}")
                
    # Remove Frontend components dir if empty
    comp_dir = os.path.join(base_dir, "Frontend", "src", "components")
    if os.path.exists(comp_dir) and os.path.isdir(comp_dir):
        if not os.listdir(comp_dir):
            try:
                os.rmdir(comp_dir)
                print(f"[CLEANUP] Deleted empty directory: {comp_dir}")
            except Exception as e:
                print(f"[CLEANUP] Failed to remove components directory: {e}")

    print("[CLEANUP] Cleanup completed successfully!")

if __name__ == "__main__":
    cleanup()
