import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_embeddings(texts):
    embeddings = []

    for text in texts:
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=text
        )

        embeddings.append(response.embeddings[0].values)

    return embeddings
