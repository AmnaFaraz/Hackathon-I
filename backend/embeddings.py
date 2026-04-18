"""
Embeddings module — local, in-process using fastembed (ONNX runtime).
Model: all-MiniLM-L6-v2 (384-dim vectors)
Takes <150MB RAM compared to >600MB with PyTorch.
Zero external API calls. Runs fully offline.
"""
from fastembed import TextEmbedding

_model: TextEmbedding | None = None


def get_model() -> TextEmbedding:
    """Lazy-load and cache the embedding model."""
    global _model
    if _model is None:
        _model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> list[float]:
    """
    Embed a single text string.
    Returns a 384-dimensional float vector.
    """
    model = get_model()
    # fastembed returns an iterator of arrays
    results = list(model.embed([text]))
    return results[0].tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Embed multiple texts efficiently.
    """
    model = get_model()
    results = list(model.embed(texts, batch_size=32))
    return [r.tolist() for r in results]
