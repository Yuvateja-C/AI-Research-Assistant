import os
from dotenv import load_dotenv

# Load environment variables
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL")
DATA_DIR = "/data" if os.path.exists("/data") and os.access("/data", os.W_OK) else BACKEND_DIR
SQLITE_DB = os.path.join(DATA_DIR, "research_assistant.db")
CHROMA_PATH = os.path.join(DATA_DIR, "chroma_db")

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Frontend & CORS
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip().rstrip("/")
