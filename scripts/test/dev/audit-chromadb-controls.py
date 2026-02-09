#!/usr/bin/env python3
"""
ChromaDB Control-Specific Audit
Focuses on 800-53 catalog documents and control metadata
"""

import chromadb
import os
import sys
from collections import defaultdict

CHROMA_PATH = os.path.join(os.path.dirname(__file__), '..', '.data', 'chroma_db')

def audit_controls():
    print("=" * 70)
    print("ChromaDB Control-Specific Audit")
    print("=" * 70)
    
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    collection = client.get_collection("documents")
    total_count = collection.count()
    
    print(f"\n📄 Total chunks: {total_count}")
    
    # Get ALL documents to analyze document types
    print("\n📊 Analyzing all document types...")
    
    # Get all unique document types
    all_results = collection.get(
        limit=total_count,
        include=["metadatas"]
    )
    
    document_types = defaultdict(int)
    control_ids = defaultdict(int)
    chunks_with_control_id = 0
    chunks_with_control_name = 0
    
    for metadata in all_results['metadatas']:
        doc_type = metadata.get('document_type', 'unknown')
        document_types[doc_type] += 1
        
        if metadata.get('control_id'):
            chunks_with_control_id += 1
            control_ids[metadata['control_id']] += 1
        
        if metadata.get('control_name'):
            chunks_with_control_name += 1
    
    print("\n📂 DOCUMENT TYPES (ALL CHUNKS):")
    print("-" * 50)
    for doc_type, count in sorted(document_types.items(), key=lambda x: -x[1]):
        pct = (count / total_count) * 100
        print(f"  {doc_type}: {count} ({pct:.1f}%)")
    
    print(f"\n🔢 Chunks with control_id: {chunks_with_control_id}/{total_count}")
    print(f"🔢 Chunks with control_name: {chunks_with_control_name}/{total_count}")
    
    if control_ids:
        print(f"\n🔢 Unique control IDs found: {len(control_ids)}")
        print("\nSample control IDs:")
        for ctrl_id, count in sorted(control_ids.items())[:20]:
            print(f"  {ctrl_id}: {count} chunks")
    else:
        print("\n❌ NO CONTROL IDs FOUND IN ANY CHUNKS!")
    
    # Now filter for 800-53 catalog specifically
    print("\n" + "=" * 70)
    print("Looking for 800-53 catalog documents...")
    print("=" * 70)
    
    # Try different document type variations
    for doc_type_filter in ['800-53_catalog', '800-53', 'nist_800-53', 'sp800-53']:
        try:
            results = collection.get(
                where={"document_type": doc_type_filter},
                limit=10,
                include=["documents", "metadatas"]
            )
            if results['ids']:
                print(f"\n✅ Found {len(results['ids'])} chunks with document_type='{doc_type_filter}'")
                for i, (doc_id, text, metadata) in enumerate(zip(results['ids'][:3], results['documents'][:3], results['metadatas'][:3])):
                    print(f"\n  Sample {i+1}:")
                    print(f"    Control ID: {metadata.get('control_id', 'N/A')}")
                    print(f"    Control Name: {metadata.get('control_name', 'N/A')}")
                    print(f"    Text: {text[:150]}...")
            else:
                print(f"\n❌ No chunks with document_type='{doc_type_filter}'")
        except Exception as e:
            print(f"\n⚠️ Query for '{doc_type_filter}' failed: {e}")
    
    # Search for AC-1 specifically
    print("\n" + "=" * 70)
    print("Searching for AC-1 control...")
    print("=" * 70)
    
    # Check if any text contains "AC-1"
    ac1_chunks = []
    for i, (doc_id, metadata) in enumerate(zip(all_results['ids'], all_results['metadatas'])):
        if metadata.get('control_id') == 'AC-1':
            ac1_chunks.append(doc_id)
    
    if ac1_chunks:
        print(f"\n✅ Found {len(ac1_chunks)} chunks with control_id='AC-1'")
        
        # Get full details
        details = collection.get(
            ids=ac1_chunks[:3],
            include=["documents", "metadatas"]
        )
        
        for i, (doc_id, text, metadata) in enumerate(zip(details['ids'], details['documents'], details['metadatas'])):
            print(f"\n  AC-1 Chunk {i+1}:")
            print(f"    ID: {doc_id}")
            print(f"    Control Name: {metadata.get('control_name', 'N/A')}")
            print(f"    Text: {text[:300]}...")
    else:
        print("\n❌ No chunks found with control_id='AC-1'")
        
        # Try text search for AC-1
        print("\n  Searching in text content for 'AC-1'...")
        found_in_text = 0
        for i, doc_id in enumerate(all_results['ids'][:1000]):
            doc = collection.get(ids=[doc_id], include=["documents"])
            if doc['documents'][0] and 'AC-1' in doc['documents'][0]:
                found_in_text += 1
                if found_in_text <= 2:
                    print(f"\n  Found 'AC-1' in text of chunk: {doc_id}")
                    print(f"    Text: {doc['documents'][0][:300]}...")
        
        print(f"\n  Total chunks with 'AC-1' in text (first 1000): {found_in_text}")

if __name__ == "__main__":
    audit_controls()















