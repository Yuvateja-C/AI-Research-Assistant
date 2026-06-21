from embeddings_service import generate_embeddings

chunks = [
    "Machine Learning is AI",
    "Deep Learning uses neural networks"
]

embeddings = generate_embeddings(chunks)

print(len(embeddings))
print(type(embeddings))
print(len(embeddings[0]))