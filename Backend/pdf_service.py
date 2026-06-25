import fitz  # PyMuPDF

def extract_text_from_pdf(pdf_path):
    # Open the document
    doc = fitz.open(pdf_path)
    
    # Extract text from all pages efficiently
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
        
    return text