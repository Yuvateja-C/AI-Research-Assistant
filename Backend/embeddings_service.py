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

def generate_embeddings(texts):
    if not texts:
        return []
    embeddings = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        if client:
            try:
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=batch
                )
                for emb in response.embeddings:
                    embeddings.append(emb.values)
                continue
            except Exception as e:
                logging.error(f"GenAI embedding generation failed: {e}. Falling back to mock vectors.")
        
        for t in batch:
            mock_emb = [0.0] * 768
            val = abs(hash(t)) % 768
            mock_emb[val] = 1.0
            embeddings.append(mock_emb)
            
    return embeddings
