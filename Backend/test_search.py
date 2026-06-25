<<<<<<< HEAD
from database import collection

query = "What is Machine Learning?"

results = collection.query(
    query_texts=[query],
    n_results=2
)

=======
from database import collection

query = "What is Machine Learning?"

results = collection.query(
    query_texts=[query],
    n_results=2
)

>>>>>>> 7598798ccadd000a806922b001b75f612caabbc0
print(results)