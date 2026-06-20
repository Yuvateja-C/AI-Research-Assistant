from chunk_service import chunk_text
from pdf_service import extract_text_from_pdf
from database import collection

text = extract_text_from_pdf(
    "uploads/your_pdf.pdf"
)

chunks = chunk_text(text)

collection.add(
    documents=chunks,
    ids=[str(i) for i in range(len(chunks))]
)

print(f"Stored {len(chunks)} chunks")