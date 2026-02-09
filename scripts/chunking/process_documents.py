#!/usr/bin/env python3
"""
Document processing entry point for CompliNist IPC integration.

This script is called from Electron's chunking-service.js to process
uploaded documents. It:
1. Extracts text from the uploaded file
2. Chunks the text using token-based chunking
3. Outputs JSON results for consumption by Node.js

Usage:
    python process_documents.py --file <file_path> [--output json|summary]

Output format (JSON):
{
    "success": true,
    "file": "document.pdf",
    "chunk_count": 45,
    "chunks": [
        {
            "id": "doc_chunk_0",
            "text": "chunk content...",
            "metadata": {...}
        },
        ...
    ]
}
"""
import argparse
import json
import sys
import os
import uuid
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chunking.file_processor import process_file
from chunking.chunker import chunk_documents


def generate_chunk_id(filename: str, chunk_index: int) -> str:
    """Generate a unique ID for a chunk."""
    # Create a short hash from filename and index
    base = f"{filename}_{chunk_index}_{datetime.now().isoformat()}"
    return f"chunk_{uuid.uuid5(uuid.NAMESPACE_DNS, base).hex[:12]}"


def process_document(file_path: str, enable_small2big: bool = True,
                     enable_questions: bool = True) -> dict:
    """
    Process a single document file and return chunked results.

    Args:
        file_path: Path to the document file
        enable_small2big: Enable small2big retrieval chunking
        enable_questions: Enable hypothetical question generation

    Returns:
        Dictionary with processing results
    """
    try:
        # Validate file exists
        if not os.path.exists(file_path):
            return {
                "success": False,
                "error": f"File not found: {file_path}"
            }

        filename = os.path.basename(file_path)
        file_ext = os.path.splitext(filename)[1].lower()

        # Validate file type
        supported_types = ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.md']
        if file_ext not in supported_types:
            return {
                "success": False,
                "error": f"Unsupported file type: {file_ext}. Supported: {', '.join(supported_types)}"
            }

        # Extract text from file
        documents = process_file(file_path)

        if not documents:
            return {
                "success": False,
                "error": f"No content extracted from file: {filename}"
            }

        # Chunk the documents
        chunks = chunk_documents(
            documents,
            parallel=True,
            enable_small2big=enable_small2big,
            enable_questions=enable_questions
        )

        if not chunks:
            return {
                "success": False,
                "error": f"No chunks generated from file: {filename}"
            }

        # Format chunks for output
        output_chunks = []
        for idx, chunk in enumerate(chunks):
            # Generate unique ID for the chunk
            chunk_id = generate_chunk_id(filename, idx)

            # Clean metadata for JSON serialization
            metadata = chunk.get('metadata', {})
            clean_metadata = {}
            for key, value in metadata.items():
                # Convert non-JSON-serializable types
                if isinstance(value, (str, int, float, bool)):
                    clean_metadata[key] = value
                elif isinstance(value, list):
                    clean_metadata[key] = value
                elif value is None:
                    clean_metadata[key] = None
                else:
                    clean_metadata[key] = str(value)

            output_chunks.append({
                "id": chunk_id,
                "text": chunk.get('text', ''),
                "metadata": clean_metadata
            })

        return {
            "success": True,
            "file": filename,
            "file_path": file_path,
            "file_type": file_ext[1:],  # Remove leading dot
            "chunk_count": len(output_chunks),
            "chunks": output_chunks,
            "processed_at": datetime.now().isoformat()
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file": os.path.basename(file_path) if file_path else "unknown"
        }


def main():
    parser = argparse.ArgumentParser(
        description='Process documents for chunking and embedding'
    )
    parser.add_argument(
        '--file', '-f',
        required=True,
        help='Path to the document file to process'
    )
    parser.add_argument(
        '--output', '-o',
        choices=['json', 'summary'],
        default='json',
        help='Output format (default: json)'
    )
    parser.add_argument(
        '--no-small2big',
        action='store_true',
        help='Disable small2big retrieval chunking'
    )
    parser.add_argument(
        '--no-questions',
        action='store_true',
        help='Disable hypothetical question generation'
    )

    args = parser.parse_args()

    # Process the document
    result = process_document(
        args.file,
        enable_small2big=not args.no_small2big,
        enable_questions=not args.no_questions
    )

    if args.output == 'json':
        # Output full JSON result
        print(json.dumps(result, indent=2))
    else:
        # Output summary
        if result['success']:
            print(f"File: {result['file']}")
            print(f"Type: {result['file_type']}")
            print(f"Chunks: {result['chunk_count']}")
            print(f"Processed: {result['processed_at']}")
        else:
            print(f"Error: {result['error']}")
            sys.exit(1)

    # Exit with appropriate code
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()
