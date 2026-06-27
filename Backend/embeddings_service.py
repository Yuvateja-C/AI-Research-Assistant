import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_embeddings(texts):
    if not texts:
        return []
    embeddings = []
    # Batch in groups of 100 to avoid request size limits and speed up document processing
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=batch
        )
        for emb in response.embeddings:
            embeddings.append(emb.values)
    return embeddings
