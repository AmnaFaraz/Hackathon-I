# Personal Documentation Site (Hackathon I)

**Student:** Amna Faraz | **GitHub:** [AmnaFaraz](https://github.com/AmnaFaraz)

## Project Overview
A professional documentation site built with **Docusaurus 3** and enhanced with a custom **FastAPI RAG Chatbot**.

### Tech Stack
-   **Frontend**: Docusaurus 3 + React + Vanilla CSS (Space Dark Theme)
-   **Backend**: FastAPI + Python 3.13 + SentenceTransformers (local embeddings)
-   **AI**: Groq (Llama 3.3 70B) for ultra-fast reasoning
-   **Database**: Supabase + pgvector for semantic search

## Local Setup

### Frontend (Docusaurus)
```bash
cd docs-site
npm install
npm run start
```

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

## AI Tutor (RAG Chatbot)
The chatbot uses an RAG (Retrieval-Augmented Generation) pipeline:
1.  **Ingestion**: Markdown files are chunked and converted to 384-dim vectors.
2.  **Retrieval**: User question is embedded and matched against Supabase vectors.
3.  **Generation**: Context is sent to Groq for a grounded AI answer.
