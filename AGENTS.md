# AGENTS.md

Spec-driven development. No code without spec.
LLM: Groq llama-3.3-70b-versatile. Never openai/anthropic.
Frontend: Docusaurus. DB: Supabase pgvector. Deploy: Vercel.

## Student
Name: Amna Faraz
GitHub: AmnaFaraz

## Rules
- All LLM calls use Groq SDK with model: llama-3.3-70b-versatile
- Embeddings: sentence-transformers all-MiniLM-L6-v2 (local, in-process)
- Backend: FastAPI + Python 3.13 + uvicorn + uv
- Database: Supabase free tier (PostgreSQL + pgvector)
- Frontend Deploy: Vercel Hobby free
- Backend Deploy: Koyeb free tier
- NEVER commit .env or .env.local files
