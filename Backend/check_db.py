from database import collection

results = collection.get()

print("Total Docs:", len(results["documents"]))
print(results["documents"][:2])