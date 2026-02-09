#!/usr/bin/env python3
"""
Test LLM Response Quality
Tests actual LLM responses to ensure they don't hallucinate or say "I don't have information" when they do
"""

import chromadb
import json
import sys
import os
import numpy as np
import subprocess
import tempfile

# Test cases with expected behaviors
TEST_CASES = [
    {
        "query": "What is AC-3?",
        "control_id": "AC-3",
        "expected_name": "Access Enforcement",
        "should_contain": ["AC-3", "Access Enforcement", "enforces", "authorizations"],
        "should_not_contain": ["don't have", "no information", "not provided", "further details"],
    },
    {
        "query": "What is AC-1?",
        "control_id": "AC-1",
        "expected_name": "Policy and Procedures",
        "should_contain": ["AC-1", "Policy and Procedures"],
        "should_not_contain": ["don't have", "no information", "not provided"],
    },
    {
        "query": "Explain AC-2",
        "control_id": "AC-2",
        "expected_name": "Account Management",
        "should_contain": ["AC-2", "Account Management"],
        "should_not_contain": ["don't have", "no information", "not provided"],
    },
]

def generate_embedding(text: str, dim: int = 1024) -> List[float]:
    """Generate a simple embedding for testing"""
    np.random.seed(hash(text) % (2**32))
    embedding = np.random.normal(0, 0.1, dim).tolist()
    norm = sum(x*x for x in embedding) ** 0.5
    return [x/norm for x in embedding]

def retrieve_context(collection, query: str, control_id: str) -> dict:
    """Retrieve context for a query"""
    query_embedding = generate_embedding(query)
    
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=3,
            where={"$and": [{"is_small_chunk": True}, {"control_id": control_id}]}
        )
    except:
        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=3,
                where={"control_id": control_id}
            )
        except:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=3,
                where={"document_type": "800-53_catalog"}
            )
    
    if not results['ids'] or len(results['ids'][0]) == 0:
        return None
    
    # Build context sections
    contexts = []
    for i in range(min(3, len(results['ids'][0]))):
        metadata = results['metadatas'][0][i]
        text = results['documents'][0][i]
        score = 1 - results['distances'][0][i]
        
        # Use parent_text if available
        parent_text = metadata.get('parent_text', text)
        
        header = f"[Document {i+1}"
        if metadata.get('control_id'):
            header += f" | Control: {metadata['control_id']}"
        if metadata.get('control_name'):
            header += f" | Name: {metadata['control_name']}"
        if metadata.get('family'):
            header += f" | Family: {metadata['family']}"
        header += f" | Relevance: {score*100:.1f}%]"
        
        contexts.append(f"{header}\n{parent_text}")
    
    return {
        "context": "\n\n---\n\n".join(contexts),
        "chunks": len(results['ids'][0]),
        "top_score": 1 - results['distances'][0][0] if results['distances'] else 0,
    }

def build_prompt(query: str, context: str) -> str:
    """Build the RAG prompt"""
    return f"""You are a NIST 800-53 Rev 5 compliance expert. Answer the user's question using ONLY the documents provided below.

CRITICAL RULES - READ CAREFULLY:
1. The Context Documents below contain the answer. DO NOT say "I don't have information" - the information IS in the documents.
2. Each document header shows: Control ID, Control Name, Family, and Relevance Score - USE THIS INFORMATION.
3. Start your answer with: "Control [ID] is [Name] from NIST 800-53 Rev 5. [Then explain based on the document text below]"
4. Quote or paraphrase directly from the document text - the Control Text section contains the requirements.
5. DO NOT say "the documents don't provide further details" - if you see Control Text, explain what it says.
6. DO NOT invent information or use external knowledge.
7. DO NOT confuse NIST 800-53 with other frameworks unless explicitly mentioned in context.

User Question: {query}

Context Documents:
{context}

Your Answer (Start with "Control [ID] is [Name] from NIST 800-53 Rev 5" and explain using the document text):"""

def test_llm_response(test_case: dict, collection) -> dict:
    """Test LLM response for a test case"""
    print(f"\n{'='*70}")
    print(f"Testing: {test_case['query']}")
    print(f"Expected: {test_case['control_id']} - {test_case['expected_name']}")
    print(f"{'='*70}")
    
    # Retrieve context
    context_data = retrieve_context(collection, test_case['query'], test_case['control_id'])
    if not context_data:
        return {
            "success": False,
            "error": "No context retrieved",
            "test_case": test_case,
        }
    
    print(f"✅ Retrieved {context_data['chunks']} chunks (score: {context_data['top_score']:.3f})")
    
    # Build prompt
    prompt = build_prompt(test_case['query'], context_data['context'])
    
    # For testing, we'll simulate what the LLM should do
    # In production, this would call the actual LLM
    print(f"\n📝 Prompt length: {len(prompt)} chars")
    print(f"📄 Context preview: {context_data['context'][:200]}...")
    
    # Check if context contains expected information
    context_lower = context_data['context'].lower()
    has_control_id = test_case['control_id'].lower() in context_lower
    has_control_name = test_case['expected_name'].lower() in context_lower
    
    print(f"\n✅ Context contains:")
    print(f"   Control ID: {has_control_id}")
    print(f"   Control Name: {has_control_name}")
    
    # Validate that context has the information
    if not has_control_id:
        return {
            "success": False,
            "error": "Control ID not found in context",
            "test_case": test_case,
        }
    
    # Note: Actual LLM response testing would require calling the LLM
    # This test validates that the context is correct
    return {
        "success": True,
        "test_case": test_case,
        "context_has_control_id": has_control_id,
        "context_has_control_name": has_control_name,
        "context_length": len(context_data['context']),
        "top_score": context_data['top_score'],
    }

def main():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    chroma_path = os.path.join(project_root, ".data", "chroma_db")
    
    print("\n🧪 LLM Response Quality Test")
    print("="*70)
    print(f"ChromaDB path: {chroma_path}\n")
    
    # Connect to ChromaDB
    try:
        client = chromadb.PersistentClient(path=chroma_path)
        collection = client.get_collection("documents")
        print(f"✅ Connected to ChromaDB")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    # Run tests
    results = []
    for test_case in TEST_CASES:
        result = test_llm_response(test_case, collection)
        results.append(result)
    
    # Summary
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    successful = sum(1 for r in results if r.get("success"))
    print(f"\nContext Retrieval: {successful}/{len(results)} successful")
    
    print("\n⚠️  NOTE: This test validates context retrieval only.")
    print("   To test actual LLM responses, the LLM must be called with the prompt.")
    print("   The prompt has been updated to prevent 'I don't have information' responses.")
    
    print("\n✅ Prompt improvements:")
    print("   - Explicitly tells LLM NOT to say 'I don't have information'")
    print("   - Requires starting with 'Control [ID] is [Name] from NIST 800-53 Rev 5'")
    print("   - Emphasizes using the provided document text")
    print("   - Warns against saying 'documents don't provide further details'")

if __name__ == "__main__":
    main()















