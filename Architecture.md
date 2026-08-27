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

React Application (Vite)

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

Groq

Responsibilities:

* Context Understanding
* Answer Generation
* Response Formatting

## Deployment Architecture

User
↓
React Frontend (Vite)
↓
FastAPI Backend
↓
ChromaDB
↓
Groq API