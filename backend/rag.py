"""
RAG (Retrieval-Augmented Generation) module.
Retrieves relevant docs from Supabase pgvector, then generates answer via Groq.
"""
import os
from supabase import create_client, Client
from groq import Groq
from embeddings import embed


SYSTEM_PROMPT = (
    "You are an expert in Physical AI and Humanoid Robotics. "
    "You answer questions ONLY from the provided textbook context. "
    "If the question is not covered in the context, say exactly: "
    "'This is not covered in this textbook.' "
    "Be concise and accurate. Use code examples from the context when relevant."
)


def get_supabase() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    return create_client(url, key)


async def answer(question: str) -> dict:
    """
    Full RAG pipeline:
    1. Embed the question
    2. Vector search in Supabase
    3. Assemble context
    4. Generate answer via Groq
    Returns: { answer: str, sources: list[str] }
    """
    # 1. Embed question
    q_embedding = embed(question)

    # 2. Vector similarity search
    sb = get_supabase()
    result = sb.rpc(
        "match_docs",
        {
            "query_embedding": q_embedding,
            "match_count": 5,
        },
    ).execute()

    if not result.data:
        return {
            "answer": "This is not covered in this textbook.",
            "sources": [],
        }

    # 3. Assemble context from retrieved chunks
    chunks = result.data
    context = "\n\n---\n\n".join(
        f"[Source: {c['source']}]\n{c['content']}" for c in chunks
    )
    sources = list({c["source"] for c in chunks})

    # 4. Generate answer via Groq
    groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])
    completion = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {question}",
            },
        ],
        temperature=0.1,
        max_tokens=1024,
    )

    return {
        "answer": completion.choices[0].message.content,
        "sources": sources,
    }
