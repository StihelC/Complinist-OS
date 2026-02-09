#!/usr/bin/env python3
"""
ChromaDB Content Audit Script
Analyzes the quality of data in ChromaDB for RAG retrieval
"""

import chromadb
import json
import os
import sys
from collections import defaultdict

# Path to ChromaDB
CHROMA_PATH = os.path.join(os.path.dirname(__file__), '..', '.data', 'chroma_db')

def audit_chromadb():
    print("=" * 70)
    print("ChromaDB Content Quality Audit")
    print("=" * 70)
    
    # Connect to ChromaDB
    print(f"\n📦 Connecting to ChromaDB at: {CHROMA_PATH}")
    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        print("✅ Connected successfully")
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    # List collections
    collections = client.list_collections()
    print(f"\n📚 Found {len(collections)} collection(s):")
    for col in collections:
        print(f"   - {col.name}")
    
    # Get the documents collection
    try:
        collection = client.get_collection("documents")
        total_count = collection.count()
        print(f"\n📄 Collection 'documents' has {total_count} chunks")
    except Exception as e:
        print(f"❌ Could not get 'documents' collection: {e}")
        sys.exit(1)
    
    # Sample chunks for analysis
    print("\n" + "=" * 70)
    print("Sampling chunks for quality analysis...")
    print("=" * 70)
    
    # Get all chunks (or sample if too many)
    sample_size = min(total_count, 100)
    results = collection.get(
        limit=sample_size,
        include=["documents", "metadatas"]
    )
    
    # Analysis counters
    stats = {
        "total_sampled": len(results['ids']),
        "has_parent_text": 0,
        "has_is_small_chunk": 0,
        "has_parent_chunk_id": 0,
        "has_control_id": 0,
        "has_control_name": 0,
        "has_document_type": 0,
        "has_family": 0,
        "has_token_count": 0,
        "has_parent_token_count": 0,
        "has_hypothetical_questions": 0,
        "empty_text": 0,
        "short_text": 0,  # < 50 chars
        "medium_text": 0,  # 50-500 chars
        "long_text": 0,  # > 500 chars
    }
    
    text_lengths = []
    parent_text_lengths = []
    document_types = defaultdict(int)
    control_families = defaultdict(int)
    control_ids = set()
    
    # Analyze each chunk
    for i, (doc_id, text, metadata) in enumerate(zip(results['ids'], results['documents'], results['metadatas'])):
        # Text analysis
        text_len = len(text) if text else 0
        text_lengths.append(text_len)
        
        if text_len == 0:
            stats["empty_text"] += 1
        elif text_len < 50:
            stats["short_text"] += 1
        elif text_len < 500:
            stats["medium_text"] += 1
        else:
            stats["long_text"] += 1
        
        # Metadata analysis
        if metadata:
            if metadata.get("parent_text"):
                stats["has_parent_text"] += 1
                parent_text_lengths.append(len(metadata["parent_text"]))
            if "is_small_chunk" in metadata:
                stats["has_is_small_chunk"] += 1
            if metadata.get("parent_chunk_id"):
                stats["has_parent_chunk_id"] += 1
            if metadata.get("control_id"):
                stats["has_control_id"] += 1
                control_ids.add(metadata["control_id"])
            if metadata.get("control_name"):
                stats["has_control_name"] += 1
            if metadata.get("document_type"):
                stats["has_document_type"] += 1
                document_types[metadata["document_type"]] += 1
            if metadata.get("family"):
                stats["has_family"] += 1
                control_families[metadata["family"]] += 1
            if metadata.get("token_count"):
                stats["has_token_count"] += 1
            if metadata.get("parent_token_count"):
                stats["has_parent_token_count"] += 1
            if metadata.get("hypothetical_questions"):
                stats["has_hypothetical_questions"] += 1
    
    # Print results
    print("\n📊 METADATA FIELD AVAILABILITY:")
    print("-" * 50)
    fields = [
        ("control_id", stats["has_control_id"]),
        ("control_name", stats["has_control_name"]),
        ("document_type", stats["has_document_type"]),
        ("family", stats["has_family"]),
        ("token_count", stats["has_token_count"]),
        ("parent_text", stats["has_parent_text"]),
        ("parent_token_count", stats["has_parent_token_count"]),
        ("is_small_chunk", stats["has_is_small_chunk"]),
        ("parent_chunk_id", stats["has_parent_chunk_id"]),
        ("hypothetical_questions", stats["has_hypothetical_questions"]),
    ]
    
    for field, count in fields:
        pct = (count / stats["total_sampled"]) * 100 if stats["total_sampled"] > 0 else 0
        status = "✅" if pct > 80 else "⚠️" if pct > 20 else "❌"
        print(f"  {status} {field}: {count}/{stats['total_sampled']} ({pct:.1f}%)")
    
    print("\n📏 TEXT LENGTH DISTRIBUTION:")
    print("-" * 50)
    print(f"  Empty (0 chars):     {stats['empty_text']}")
    print(f"  Short (<50 chars):   {stats['short_text']}")
    print(f"  Medium (50-500):     {stats['medium_text']}")
    print(f"  Long (>500 chars):   {stats['long_text']}")
    if text_lengths:
        print(f"  Average length:      {sum(text_lengths)/len(text_lengths):.0f} chars")
        print(f"  Min length:          {min(text_lengths)} chars")
        print(f"  Max length:          {max(text_lengths)} chars")
    
    if parent_text_lengths:
        print("\n📏 PARENT TEXT LENGTH DISTRIBUTION:")
        print("-" * 50)
        print(f"  Average length:      {sum(parent_text_lengths)/len(parent_text_lengths):.0f} chars")
        print(f"  Min length:          {min(parent_text_lengths)} chars")
        print(f"  Max length:          {max(parent_text_lengths)} chars")
    
    print("\n📂 DOCUMENT TYPES:")
    print("-" * 50)
    for doc_type, count in sorted(document_types.items(), key=lambda x: -x[1]):
        print(f"  {doc_type}: {count}")
    
    print("\n👪 CONTROL FAMILIES:")
    print("-" * 50)
    for family, count in sorted(control_families.items(), key=lambda x: -x[1]):
        print(f"  {family}: {count}")
    
    print(f"\n🔢 Unique control IDs: {len(control_ids)}")
    
    # Show sample chunks
    print("\n" + "=" * 70)
    print("SAMPLE CHUNKS (first 5):")
    print("=" * 70)
    
    for i in range(min(5, len(results['ids']))):
        doc_id = results['ids'][i]
        text = results['documents'][i]
        metadata = results['metadatas'][i]
        
        print(f"\n--- Chunk {i+1}: {doc_id[:40]}... ---")
        print(f"Control ID: {metadata.get('control_id', 'N/A')}")
        print(f"Control Name: {metadata.get('control_name', 'N/A')}")
        print(f"Document Type: {metadata.get('document_type', 'N/A')}")
        print(f"Family: {metadata.get('family', 'N/A')}")
        print(f"Token Count: {metadata.get('token_count', 'N/A')}")
        print(f"Has Parent Text: {'Yes' if metadata.get('parent_text') else 'No'}")
        print(f"Text Length: {len(text) if text else 0} chars")
        print(f"Text Preview: {text[:200] if text else 'EMPTY'}...")
        
        if metadata.get('parent_text'):
            print(f"Parent Text Length: {len(metadata['parent_text'])} chars")
            print(f"Parent Text Preview: {metadata['parent_text'][:200]}...")
    
    # Diagnosis summary
    print("\n" + "=" * 70)
    print("DIAGNOSIS SUMMARY:")
    print("=" * 70)
    
    issues = []
    
    if stats["has_parent_text"] < stats["total_sampled"] * 0.5:
        issues.append("❌ CRITICAL: Less than 50% of chunks have parent_text (Small2Big won't work)")
    
    if stats["has_is_small_chunk"] < stats["total_sampled"] * 0.5:
        issues.append("⚠️ WARNING: Less than 50% have is_small_chunk field (Small2Big metadata missing)")
    
    if stats["has_control_name"] < stats["total_sampled"] * 0.5:
        issues.append("⚠️ WARNING: Less than 50% have control_name (LLM won't know control names)")
    
    if stats["short_text"] + stats["empty_text"] > stats["total_sampled"] * 0.3:
        issues.append("❌ CRITICAL: Over 30% of chunks are very short/empty (insufficient content)")
    
    if stats["has_token_count"] < stats["total_sampled"] * 0.5:
        issues.append("⚠️ WARNING: Less than 50% have token_count (token budgeting may fail)")
    
    if not issues:
        print("✅ No major issues detected - data quality looks good!")
    else:
        for issue in issues:
            print(issue)
    
    print("\n" + "=" * 70)
    print("Audit complete.")
    print("=" * 70)

if __name__ == "__main__":
    audit_chromadb()















