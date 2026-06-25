import os
from sentence_transformers import SentenceTransformer

def download():
    model_dir = os.path.join(os.path.dirname(__file__), "local_model")
    print(f"Downloading all-MiniLM-L6-v2 and saving to {model_dir}...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    model.save(model_dir)
    print("Model downloaded and saved successfully!")

if __name__ == "__main__":
    download()
