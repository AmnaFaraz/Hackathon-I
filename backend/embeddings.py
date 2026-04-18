"""
Embeddings module — local, in-process using sentence-transformers.
Model: all-MiniLM-L6-v2 (384-dim vectors)
Zero external API calls. Runs fully offline.
"""
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

from functools import lru_cache
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    """Lazy-load and cache the embedding model."""
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> list[float]:
    """
    Embed a single text string.
    Returns a 384-dimensional normalized float vector.
    """
    model = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed multiple texts efficiently (batched inference).
    """
    model = get_model()
    vectors = model.encode(texts, normalize_embeddings=True, batch_size=32)
    return [v.tolist() for v in vectors]
