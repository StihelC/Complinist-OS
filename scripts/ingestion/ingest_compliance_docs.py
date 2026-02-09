#!/usr/bin/env python3
"""
Compliance Library Ingestion Script
====================================
Ingests documents into the shared ChromaDB compliance library.

Usage:
    # Ingest a single file
    python ingest_compliance_docs.py --file /path/to/document.pdf

    # Ingest all files in a directory
    python ingest_compliance_docs.py --dir /path/to/docs/

    # Ingest with specific document type
    python ingest_compliance_docs.py --file doc.pdf --type "800-53"

    # List what's currently in the database
    python ingest_compliance_docs.py --list

    # Clear and rebuild (dangerous!)
    python ingest_compliance_docs.py --clear

Supported file types: .pdf, .csv, .xml, .xlsx, .xls, .md
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

# Add paths for imports
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "chunking"))

import chromadb
from chromadb.utils import embedding_functions

# Try to import chunking modules
try:
    from chunking.file_processor import process_file
    from chunking.chunker import chunk_documents
    HAS_CHUNKING = True
except ImportError:
    HAS_CHUNKING = False
    print("Warning: chunking modules not available, using basic processing")

# Configuration
CHROMA_PATH = Path(__file__).parent.parent / ".data" / "shared" / "chroma_db"
COLLECTION_NAME = "documents"
SUPPORTED_EXTENSIONS = {'.pdf', '.csv', '.xml', '.xlsx', '.xls', '.md'}


def get_embedding_function():
    """Get ChromaDB's default embedding function."""
    return embedding_functions.DefaultEmbeddingFunction()


def get_collection():
    """Connect to ChromaDB and get the documents collection."""
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    try:
        collection = client.get_collection(COLLECTION_NAME)
    except:
        collection = client.create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
    return client, collection


def list_contents():
    """List what's in the database."""
    print("\n" + "=" * 60)
    print("ChromaDB Compliance Library Contents")
    print("=" * 60)

    client, collection = get_collection()
    total = collection.count()
    print(f"\nTotal documents: {total}")

    # Sample to get document types
    if total > 0:
        sample = collection.get(limit=min(total, 500), include=["metadatas"])

        doc_types = {}
        sources = {}
        families = {}

        for meta in sample["metadatas"]:
            dt = meta.get("document_type", "unknown")
            doc_types[dt] = doc_types.get(dt, 0) + 1

            src = meta.get("source", "unknown")
            sources[src] = sources.get(src, 0) + 1

            fam = meta.get("family")
            if fam:
                families[fam] = families.get(fam, 0) + 1

        print("\nDocument Types:")
        for dt, count in sorted(doc_types.items(), key=lambda x: -x[1]):
            print(f"  {dt}: {count}")

        print("\nSources:")
        for src, count in sorted(sources.items(), key=lambda x: -x[1])[:10]:
            print(f"  {src}: {count}")

        if families:
            print("\nControl Families:")
            for fam, count in sorted(families.items()):
                print(f"  {fam}: {count}")

    print()


def clear_collection():
    """Clear all documents from the collection."""
    print("\n⚠️  WARNING: This will delete ALL documents from the compliance library!")
    confirm = input("Type 'DELETE' to confirm: ")

    if confirm != "DELETE":
        print("Cancelled.")
        return

    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    try:
        client.delete_collection(COLLECTION_NAME)
        print("✓ Collection deleted")
        client.create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})
        print("✓ Empty collection recreated")
    except Exception as e:
        print(f"Error: {e}")


def ingest_file(file_path: str, document_type: str = None, batch_size: int = 32):
    """Ingest a single file into the compliance library."""
    file_path = Path(file_path)

    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        return False

    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        print(f"Error: Unsupported file type: {ext}")
        print(f"Supported: {', '.join(SUPPORTED_EXTENSIONS)}")
        return False

    print(f"\nProcessing: {file_path.name}")
    print("-" * 50)

    # Extract and chunk the document
    if HAS_CHUNKING:
        try:
            # Use the existing chunking pipeline
            documents = process_file(str(file_path))
            print(f"  Extracted {len(documents)} pages/sections")

            chunks = chunk_documents(
                documents,
                parallel=True,
                enable_small2big=True,
                enable_questions=True
            )
            print(f"  Created {len(chunks)} chunks")
        except Exception as e:
            print(f"  Error processing file: {e}")
            return False
    else:
        print("  Error: Chunking modules not available")
        return False

    if not chunks:
        print("  No chunks generated")
        return False

    # Prepare for ChromaDB
    ids = []
    texts = []
    metadatas = []

    for idx, chunk in enumerate(chunks):
        chunk_id = f"{file_path.stem}_{idx}"
        ids.append(chunk_id)
        texts.append(chunk.get("text", ""))

        meta = chunk.get("metadata", {})
        # Override document_type if specified
        if document_type:
            meta["document_type"] = document_type
        # Ensure source is set
        if "source" not in meta:
            meta["source"] = file_path.name

        # Clean metadata for ChromaDB (only strings, ints, floats, bools)
        clean_meta = {}
        for k, v in meta.items():
            if isinstance(v, (str, int, float, bool)):
                clean_meta[k] = v
            elif isinstance(v, list):
                clean_meta[k] = str(v)
            elif v is not None:
                clean_meta[k] = str(v)
        metadatas.append(clean_meta)

    # Generate embeddings
    print(f"  Generating embeddings...")
    ef = get_embedding_function()

    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = ef(batch)
        all_embeddings.extend(embeddings)
        print(f"    Batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")

    # Add to ChromaDB
    print(f"  Adding to ChromaDB...")
    _, collection = get_collection()

    # Remove existing chunks from this file
    try:
        existing = collection.get(where={"source": file_path.name})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
            print(f"  Removed {len(existing['ids'])} existing chunks from {file_path.name}")
    except:
        pass

    # Add new chunks
    collection.add(
        ids=ids,
        documents=texts,
        embeddings=all_embeddings,
        metadatas=metadatas
    )

    print(f"  ✓ Added {len(ids)} chunks to compliance library")
    return True


def ingest_directory(dir_path: str, document_type: str = None):
    """Ingest all supported files from a directory."""
    dir_path = Path(dir_path)

    if not dir_path.is_dir():
        print(f"Error: Not a directory: {dir_path}")
        return

    files = []
    for ext in SUPPORTED_EXTENSIONS:
        files.extend(dir_path.glob(f"*{ext}"))
        files.extend(dir_path.glob(f"**/*{ext}"))  # Recursive

    files = sorted(set(files))

    if not files:
        print(f"No supported files found in {dir_path}")
        return

    print(f"\nFound {len(files)} files to process:")
    for f in files:
        print(f"  - {f.name}")

    confirm = input("\nProceed with ingestion? (y/N): ")
    if confirm.lower() != 'y':
        print("Cancelled.")
        return

    success = 0
    failed = 0

    for file_path in files:
        if ingest_file(str(file_path), document_type):
            success += 1
        else:
            failed += 1

    print("\n" + "=" * 50)
    print(f"Ingestion complete: {success} succeeded, {failed} failed")


def main():
    parser = argparse.ArgumentParser(
        description="Ingest documents into CompliNist's shared compliance library",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument("--file", "-f", help="Single file to ingest")
    parser.add_argument("--dir", "-d", help="Directory to ingest (all supported files)")
    parser.add_argument("--type", "-t", help="Document type (e.g., '800-53', 'CMMC', 'FedRAMP')")
    parser.add_argument("--list", "-l", action="store_true", help="List current database contents")
    parser.add_argument("--clear", action="store_true", help="Clear all documents (dangerous!)")

    args = parser.parse_args()

    # Ensure ChromaDB directory exists
    CHROMA_PATH.mkdir(parents=True, exist_ok=True)

    if args.list:
        list_contents()
    elif args.clear:
        clear_collection()
    elif args.file:
        ingest_file(args.file, args.type)
        list_contents()
    elif args.dir:
        ingest_directory(args.dir, args.type)
        list_contents()
    else:
        parser.print_help()
        print("\n" + "=" * 50)
        print("Quick examples:")
        print("  python ingest_compliance_docs.py --list")
        print("  python ingest_compliance_docs.py --file docs/my-policy.pdf")
        print("  python ingest_compliance_docs.py --dir docs/ --type CMMC")


if __name__ == "__main__":
    main()
