import os
from sentence_transformers import SentenceTransformer

model_dir = os.path.join(os.path.dirname(__file__), "local_model")

if os.path.exists(model_dir):
    print("Loading SentenceTransformer model from local storage...")
    model = SentenceTransformer(model_dir)
else:
    print("Loading SentenceTransformer model from Hugging Face...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

def generate_embeddings(chunks):
    return model.encode(chunks).tolist()