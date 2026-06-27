import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "models/embedding-001"

def generate_embeddings(texts):
    embeddings = []

    for text in texts:
        response = genai.embed_content(
            model=MODEL,
            content=text,
            task_type="retrieval_document"
        )

        embeddings.append(response["embedding"])

    return embeddings
