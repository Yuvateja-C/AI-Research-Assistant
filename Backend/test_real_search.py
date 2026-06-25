<<<<<<< HEAD
from database import collection

query = input("Ask a question: ")

results = collection.query(
    query_texts=[query],
    n_results=3
)

=======
from database import collection

query = input("Ask a question: ")

results = collection.query(
    query_texts=[query],
    n_results=3
)

>>>>>>> 7598798ccadd000a806922b001b75f612caabbc0
print(results["documents"][0])