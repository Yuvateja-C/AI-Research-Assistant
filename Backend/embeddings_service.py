import os
import logging
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logging.error(f"Failed to initialize GenAI client: {e}")

local_model = None

def _get_local_semantic_model():
    """
    Lazy loader for local SentenceTransformer semantic model.
    Uses 'all-MiniLM-L6-v2' for high-accuracy local semantic vector generation.
    """
    global local_model
    if local_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logging.info("Initializing local SentenceTransformer model 'all-MiniLM-L6-v2'...")
            local_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            logging.warning(f"SentenceTransformer not available: {e}")
            try:
                import importlib
                fastembed_mod = importlib.import_module("fastembed")
                TextEmbedding = getattr(fastembed_mod, "TextEmbedding")
                logging.info("Initializing FastEmbed local embedding model...")
                local_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            except Exception as fe:
                logging.warning(f"FastEmbed not available: {fe}")
                local_model = False
    return local_model

def generate_embeddings(texts):
    """
    Generates real semantic vector embeddings for text chunks and search queries.
    Primary: Google GenAI API (gemini-embedding-001)
    Secondary: Local SentenceTransformer / FastEmbed model
    """
    if not texts:
        return []
    
    # 1. Primary: Google GenAI API
    if client:
        embeddings = []
        batch_size = 100
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                response = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch
                )
                for emb in response.embeddings:
                    embeddings.append(emb.values)
                if len(embeddings) == len(texts):
                    return embeddings
            except Exception as e:
                logging.warning(f"GenAI embedding API failed: {e}. Attempting local semantic model fallback.")
                break
                
    # 2. Secondary: Local Semantic Model (SentenceTransformers / FastEmbed)
    model = _get_local_semantic_model()
    if model:
        try:
            if hasattr(model, "encode"):
                embeddings = model.encode(texts, convert_to_numpy=True).tolist()
                return embeddings
            elif hasattr(model, "embed"):
                embeddings = [list(e) for e in model.embed(texts)]
                return embeddings
        except Exception as le:
            logging.error(f"Local semantic embedding model generation failed: {le}")

    # 3. Development / Test Hash Fallback (Gated for offline unit testing)
    is_test_env = os.getenv("ALLOW_HASH_EMBEDDINGS", "false").lower() == "true" or os.getenv("ENVIRONMENT") == "test"
    if is_test_env:
        logging.info("Using deterministic hash-vector fallback for offline testing.")
        import hashlib, math
        fallback_embeddings = []
        for t in texts:
            vec = []
            seed_bytes = (t or "").encode("utf-8")
            for i in range(384):
                h = hashlib.md5(seed_bytes + str(i).encode()).hexdigest()
                val = (int(h[:8], 16) / 0xFFFFFFFF) * 2.0 - 1.0
                vec.append(val)
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            fallback_embeddings.append([v / norm for v in vec])
        return fallback_embeddings

    # 4. Production Service Failure
    raise RuntimeError(
        "EMBEDDING_SERVICE_UNAVAILABLE: No valid semantic embedding provider is configured. "
        "Please set GEMINI_API_KEY in Backend/.env or install 'sentence-transformers' / 'fastembed'."
    )

def get_embedding_info():
    """
    Returns active embedding provider and model metadata.
    """
    if client:
        return {"provider": "gemini", "model": "gemini-embedding-001", "dimension": 768}
    model = _get_local_semantic_model()
    if model:
        return {"provider": "sentence-transformers", "model": "all-MiniLM-L6-v2", "dimension": 384}
    return {"provider": "none", "model": "none", "dimension": 0}



