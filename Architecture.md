<<<<<<< HEAD
# System Architecture

## High-Level Flow

User
↓
Upload PDF
↓
PDF Processing
↓
Text Chunking
↓
Embedding Generation
↓
Vector Database Storage (ChromaDB)
↓
Question Input
↓
Similarity Search
↓
Relevant Chunks Retrieved
↓
LLM Processing
↓
Response Generation
↓
Answer with Citations

## Components

### Frontend

Streamlit Application

Responsibilities:

* File Upload
* User Interaction
* Chat Interface
* Result Display

### Backend

FastAPI Service

Responsibilities:

* API Management
* File Processing
* Retrieval Logic
* LLM Communication

### Vector Database

ChromaDB

Responsibilities:

* Store Embeddings
* Similarity Search
* Context Retrieval

### Language Model

Groq/OpenAI

Responsibilities:

* Context Understanding
* Answer Generation
* Response Formatting

## Deployment Architecture

User
↓
Streamlit Frontend
↓
FastAPI Backend
↓
ChromaDB
↓
=======
# System Architecture

## High-Level Flow

User
↓
Upload PDF
↓
PDF Processing
↓
Text Chunking
↓
Embedding Generation
↓
Vector Database Storage (ChromaDB)
↓
Question Input
↓
Similarity Search
↓
Relevant Chunks Retrieved
↓
LLM Processing
↓
Response Generation
↓
Answer with Citations

## Components

### Frontend

Streamlit Application

Responsibilities:

* File Upload
* User Interaction
* Chat Interface
* Result Display

### Backend

FastAPI Service

Responsibilities:

* API Management
* File Processing
* Retrieval Logic
* LLM Communication

### Vector Database

ChromaDB

Responsibilities:

* Store Embeddings
* Similarity Search
* Context Retrieval

### Language Model

Groq/OpenAI

Responsibilities:

* Context Understanding
* Answer Generation
* Response Formatting

## Deployment Architecture

User
↓
Streamlit Frontend
↓
FastAPI Backend
↓
ChromaDB
↓
>>>>>>> 0375e112ffc539e9b6d9f06a6a6f62debf2ed60b
Groq/OpenAI API