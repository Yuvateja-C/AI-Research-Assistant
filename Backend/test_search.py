from database import collection

query = "What is Machine Learning?"

results = collection.query(
    query_texts=[query],
    n_results=2
)

print(results)