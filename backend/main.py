"""
FastAPI backend for Physical AI Textbook RAG Chatbot.
Endpoints:
  POST /api/chat     — RAG question answering
  POST /api/ingest   — Trigger doc ingestion (requires ADMIN_KEY header)
  GET  /api/health   — Health check
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rag import answer
from ingest_docs import ingest_all


# ─── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


class IngestResponse(BaseModel):
    status: str
    chunks_stored: int


# ─── App ────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up embedding model on startup."""
    # from embeddings import get_model
    # get_model()  # pre-load model into memory
    yield

app = FastAPI(
    title="Physical AI Textbook API",
    description="RAG chatbot backend for Panaversity Physical AI textbook.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "llama-3.3-70b-versatile"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    if len(req.question) > 2000:
        raise HTTPException(status_code=400, detail="Question too long (max 2000 chars)")

    try:
        result = await answer(req.question)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG error: {str(e)}")


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest(x_admin_key: str = Header(default=None)):
    """
    Trigger re-ingestion of all docs.
    Requires ADMIN_KEY header matching ADMIN_KEY env var.
    """
    admin_key = os.environ.get("ADMIN_KEY", "")
    if not admin_key or x_admin_key != admin_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")

    try:
        count = await ingest_all()
        return IngestResponse(status="success", chunks_stored=count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest error: {str(e)}")
