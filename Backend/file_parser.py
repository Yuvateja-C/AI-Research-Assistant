import os
import json
import zipfile
import xml.etree.ElementTree as ET
import logging
from google import genai

# Setup GenAI client for multimodal file parsing (Images, Audio, Video)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai_client = None
if GEMINI_API_KEY:
    try:
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logging.error(f"Failed to initialize GenAI client for file parsing: {e}")


def extract_text_from_office(file_path: str, ext: str) -> str:
    """
    Parses office files (.docx, .xlsx, .pptx) directly using native zip/xml extraction.
    """
    try:
        with zipfile.ZipFile(file_path, 'r') as doc_zip:
            if ext == ".docx":
                xml_content = doc_zip.read('word/document.xml')
                root = ET.fromstring(xml_content)
                paragraphs = []
                for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                    texts = [node.text for node in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                    if texts:
                        paragraphs.append("".join(texts))
                return "\n".join(paragraphs)
                
            elif ext == ".xlsx":
                try:
                    xml_content = doc_zip.read('xl/sharedStrings.xml')
                    root = ET.fromstring(xml_content)
                    strings = []
                    for t in root.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
                        if t.text:
                            strings.append(t.text)
                    return "\n".join(strings)
                except KeyError:
                    return "Empty Spreadsheet"
                    
            elif ext == ".pptx":
                slide_texts = []
                slide_files = sorted([f for f in doc_zip.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')])
                for slide_file in slide_files:
                    xml_content = doc_zip.read(slide_file)
                    root = ET.fromstring(xml_content)
                    for t in root.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}t'):
                        if t.text:
                            slide_texts.append(t.text)
                return "\n".join(slide_texts)
    except Exception as e:
        return f"Error extracting office file text: {str(e)}"
    return ""


def extract_text_from_notebook(file_path: str) -> str:
    """
    Parses Jupyter Notebook files (.ipynb) and returns a clean Markdown representation.
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            notebook = json.load(f)
        
        cells = notebook.get("cells", [])
        markdown_lines = []
        
        for idx, cell in enumerate(cells):
            cell_type = cell.get("cell_type", "")
            source = cell.get("source", [])
            
            # Reconstruct list of source strings
            if isinstance(source, list):
                source_str = "".join(source)
            else:
                source_str = str(source)
                
            if cell_type == "markdown":
                markdown_lines.append(f"\n{source_str}\n")
            elif cell_type == "code":
                markdown_lines.append(f"\n```python\n# [Cell {idx}]\n{source_str}\n```\n")
                
        return "\n".join(markdown_lines)
    except Exception as e:
        return f"Error parsing Jupyter Notebook: {str(e)}"


def parse_csv_tsv(file_path: str, is_tsv: bool = False) -> str:
    """
    Parses CSV/TSV table formats into structured Markdown tables.
    """
    try:
        delimiter = "\t" if is_tsv else ","
        rows_text = []
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f):
                columns = [col.strip().strip('"') for col in line.split(delimiter)]
                # Add Markdown table separator after header row
                if idx == 0:
                    rows_text.append("| " + " | ".join(columns) + " |")
                    rows_text.append("|" + "|".join(["---"] * len(columns)) + "|")
                else:
                    rows_text.append("| " + " | ".join(columns) + " |")
                    
        return "\n".join(rows_text)
    except Exception as e:
        return f"Error parsing CSV/TSV data: {str(e)}"


def parse_media_with_gemini(file_path: str, file_name: str, mime_type: str, prompt: str) -> str:
    """
    Uploads media files (Images, Audio, Video) directly to Gemini API File manager
    to perform high-accuracy OCR / transcriptions.
    """
    if not genai_client:
        raise ValueError("GEMINI_API_KEY is not configured in .env. Media parsing (OCR/Transcription) is disabled.")
        
    try:
        print(f"[MEDIA] Uploading media file '{file_name}' to Gemini API...")
        # 1. Upload the file to Gemini File API
        uploaded_file = genai_client.files.upload(file=file_path)
        print(f"[MEDIA] Uploaded. Processing with model...")
        
        # 2. Query Gemini 2.5 Flash to perform transcription or OCR
        response = genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded_file, prompt]
        )
        
        # 3. Clean up file resource
        genai_client.files.delete(name=uploaded_file.name)
        print("[MEDIA] Cleaned up Gemini API file resource.")
        
        if response and response.text:
            return response.text
        return "No text could be extracted from this media file."
    except Exception as e:
        logging.error(f"Gemini multimodal file parsing failed: {e}")
        raise RuntimeError(f"Gemini file parsing failed: {str(e)}")


def parse_document(file_path: str, filename: str) -> tuple[str, dict]:
    """
    Universal Entry Point: Detects extension, runs correct parser,
    and returns (extracted_text, metadata).
    """
    lower_fn = filename.lower()
    ext = os.path.splitext(lower_fn)[1]
    
    metadata = {
        "filename": filename,
        "extension": ext,
        "size_bytes": os.path.getsize(file_path),
        "content_type": "text"
    }

    # 1. PDFs
    if ext == ".pdf":
        metadata["content_type"] = "document"
        parsed = False
        try:
            import fitz
            doc = fitz.open(file_path)
            metadata["pages"] = len(doc)
            text = ""
            for page in doc:
                text += page.get_text() + "\n"
            parsed = True
        except Exception:
            pass

        if not parsed:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            metadata["pages"] = len(reader.pages)
            text = ""
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
            
    # 2. Office Documents
    elif ext in [".docx", ".xlsx", ".pptx"]:
        metadata["content_type"] = "document"
        text = extract_text_from_office(file_path, ext)
        
    # 3. Jupyter Notebooks
    elif ext == ".ipynb":
        metadata["content_type"] = "code"
        text = extract_text_from_notebook(file_path)
        
    # 4. Tabular Spreadsheets
    elif ext == ".csv":
        metadata["content_type"] = "table"
        text = parse_csv_tsv(file_path, is_tsv=False)
    elif ext == ".tsv":
        metadata["content_type"] = "table"
        text = parse_csv_tsv(file_path, is_tsv=True)
        
    # 5. Multimodal Media: Images
    elif ext in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".bmp", ".gif", ".tiff"]:
        metadata["content_type"] = "image"
        ocr_prompt = "Perform complete OCR on this image. Extract all text, visual headings, spreadsheet values, and handwriting exactly as shown. If no text exists, write a detailed scientific description of the visual contents."
        text = parse_media_with_gemini(file_path, filename, f"image/{ext[1:]}", ocr_prompt)
        
    # 6. Multimodal Media: Audio
    elif ext in [".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"]:
        metadata["content_type"] = "audio"
        transcribe_prompt = "Transcribe this audio file word-for-word. Output only the verbatim transcription. Do not summarize or add narration."
        text = parse_media_with_gemini(file_path, filename, f"audio/{ext[1:]}", transcribe_prompt)
        
    # 7. Multimodal Media: Video
    elif ext in [".mp4", ".mov", ".mkv", ".avi", ".webm"]:
        metadata["content_type"] = "video"
        transcribe_prompt = "Provide a detailed transcription of all spoken dialogue in this video, along with a visual log of major events described sequentially."
        text = parse_media_with_gemini(file_path, filename, f"video/{ext[1:]}", transcribe_prompt)
        
    # 8. Plain Text, Markdown, LaTeX, and all Code files
    else:
        # Fallback as text file
        metadata["content_type"] = "code" if ext in [".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".c", ".cpp", ".cs", ".go", ".rs", ".sql", ".html", ".css", ".json", ".yaml", ".yml", ".xml", ".toml", ".sh"] else "text"
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception as e:
            text = f"Error reading text contents: {str(e)}"
            
    # Calculate word and char count
    metadata["word_count"] = len(text.split())
    metadata["character_count"] = len(text)
    
    return text, metadata
