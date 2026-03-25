"""
Document ingestion script.
Walks docs-site/docs/ recursively, chunks each .md file,
embeds chunks, and upserts into Supabase docs_embeddings table.

Run once after deploy:
  python ingest_docs.py
Or via the /api/ingest endpoint (with ADMIN_KEY).
"""
import os
import re
import asyncio
from pathlib import Path
from supabase import create_client
from embeddings import embed_batch

DOCS_DIR = Path(__file__).parent.parent / "docs-site" / "docs"
CHUNK_SIZE = 500   # words per chunk
CHUNK_OVERLAP = 50 # words of overlap


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping word chunks."""
    # Strip frontmatter
    text = re.sub(r"^---[\s\S]*?---\n", "", text, count=1).strip()
    # Strip markdown syntax for cleaner chunks
    text = re.sub(r"```[\s\S]*?```", "", text)  # remove code blocks
    text = re.sub(r"#{1,6}\s", "", text)         # remove headings
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # links → text
    text = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", text)  # bold/italic

    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + size])
        if chunk.strip():
            chunks.append(chunk)
        i += size - overlap
    return chunks


async def ingest_all() -> int:
    """
    Ingest all .md files from docs directory.
    Returns total number of chunks stored.
    """
    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_KEY"]
    )

    md_files = list(DOCS_DIR.rglob("*.md"))
    print(f"Found {len(md_files)} markdown files")

    all_chunks = []
    for md_file in md_files:
        text = md_file.read_text(encoding="utf-8")
        chunks = chunk_text(text)
        # Relative path as source identifier
        source = str(md_file.relative_to(DOCS_DIR)).replace("\\", "/")
        chapter = md_file.parts[-2] if len(md_file.parts) >= 2 else "intro"

        for chunk in chunks:
            all_chunks.append({
                "content": chunk,
                "source": source,
                "chapter": chapter,
            })

    if not all_chunks:
        return 0

    print(f"Total chunks: {len(all_chunks)}")

    # Batch embed
    texts = [c["content"] for c in all_chunks]
    embeddings = embed_batch(texts)

    # Upsert to Supabase in batches of 50
    BATCH_SIZE = 50
    stored = 0
    for i in range(0, len(all_chunks), BATCH_SIZE):
        batch = all_chunks[i : i + BATCH_SIZE]
        batch_emb = embeddings[i : i + BATCH_SIZE]

        rows = [
            {
                "content": b["content"],
                "embedding": e,
                "source": b["source"],
                "chapter": b["chapter"],
            }
            for b, e in zip(batch, batch_emb)
        ]

        sb.table("docs_embeddings").upsert(rows).execute()
        stored += len(rows)
        print(f"Stored {stored}/{len(all_chunks)} chunks")

    print(f"✓ Ingestion complete: {stored} chunks stored")
    return stored


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(ingest_all())
