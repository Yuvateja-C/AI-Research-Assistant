from database import collection
from rag_service import generate_answer

question = input("Ask a question: ")

results = collection.query(
    query_texts=[question],
    n_results=3
)

context = "\n".join(
    results["documents"][0]
)

answer = generate_answer(
    context,
    question
)

print("\nAnswer:\n")
print(answer)