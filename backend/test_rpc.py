import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
supabase = create_client(url, key)

print(f"Connecting to {url}...")

# Test 1: Check if docs_embeddings table exists
try:
    res = supabase.table("docs_embeddings").select("count", count="exact").limit(1).execute()
    print("✓ docs_embeddings table exists.")
    print(f"  Count: {res.count}")
except Exception as e:
    print(f"✗ docs_embeddings table error: {e}")

# Test 2: Check match_docs RPC
try:
    # Use a dummy 384-dim zero vector (MiniLM-L6-v2)
    dummy_vec = [0.0] * 384
    res = supabase.rpc("match_docs", {
        "query_embedding": dummy_vec,
        "match_count": 1
    }).execute()
    print("✓ match_docs RPC exists.")
except Exception as e:
    print(f"✗ match_docs RPC error: {e}")
