from database import collection

query = input("Ask a question: ")

results = collection.query(
    query_texts=[query],
    n_results=3
)

print(results["documents"][0])