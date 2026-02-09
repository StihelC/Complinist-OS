"""Text chunking using LangChain's RecursiveCharacterTextSplitter with document-aware chunking.

Updated to use token-based chunking following research paper best practices:
- Token-based chunk sizes (256-512 tokens) for optimal faithfulness (97.59% vs 80.37%)
- Adaptive 20% overlap ratio
- Enhanced metadata with hypothetical questions
- Small2Big retrieval support

Reference: "Searching for Best Practices in Retrieval-Augmented Generation" (2024)
"""
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import multiprocessing

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
    except ImportError:
        raise ImportError(
            "Could not import RecursiveCharacterTextSplitter. "
            "Please install langchain-text-splitters: pip install langchain-text-splitters"
        )

from .token_utils import (
    create_token_counter,
    get_optimal_chunk_size,
    calculate_adaptive_overlap,
    count_tokens
)
from .metadata_enhancer import batch_enhance_chunks


# Document type chunking configurations (TOKEN-BASED)
CHUNKING_CONFIG = {
    '800-53_catalog': {
        'chunk_size_tokens': 384,
        'chunk_overlap_tokens': 77,
        'one_per_control': True,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    '800-53a_assessment': {
        'chunk_size_tokens': 384,
        'chunk_overlap_tokens': 77,
        'one_per_control': True,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    '800-53_xml': {
        'chunk_size_tokens': 384,
        'chunk_overlap_tokens': 77,
        'one_per_control': True,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    '800-37_rmf': {
        'chunk_size_tokens': 400,
        'chunk_overlap_tokens': 80,
        'by_task': True,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    'csf_2.0': {
        'chunk_size_tokens': 400,
        'chunk_overlap_tokens': 80,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    '800-171': {
        'chunk_size_tokens': 384,
        'chunk_overlap_tokens': 77,
        'one_per_control': True,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    'fedramp': {
        'chunk_size_tokens': 384,
        'chunk_overlap_tokens': 77,
        'one_per_control': True,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    'dod_srg': {
        'chunk_size_tokens': 450,
        'chunk_overlap_tokens': 90,
        'by_impact_level': True,
        'use_small2big': True,
        'small_chunk_size': 300
    },
    'cmmc': {
        'chunk_size_tokens': 384,
        'chunk_overlap_tokens': 77,
        'use_small2big': True,
        'small_chunk_size': 256
    },
    'security_pattern': {
        'chunk_size_tokens': 450,
        'chunk_overlap_tokens': 90,
        'use_small2big': True,
        'small_chunk_size': 300
    },
    'positioning_guide': {
        'chunk_size_tokens': 450,
        'chunk_overlap_tokens': 90,
        'use_small2big': True,
        'small_chunk_size': 300
    },
    'zone_guide': {
        'chunk_size_tokens': 450,
        'chunk_overlap_tokens': 90,
        'use_small2big': True,
        'small_chunk_size': 300
    },
    'grouping_guide': {
        'chunk_size_tokens': 450,
        'chunk_overlap_tokens': 90,
        'use_small2big': True,
        'small_chunk_size': 300
    },
    'segmentation_guide': {
        'chunk_size_tokens': 450,
        'chunk_overlap_tokens': 90,
        'use_small2big': True,
        'small_chunk_size': 300
    },
    'query_patterns': {
        'chunk_size_tokens': 300,
        'chunk_overlap_tokens': 60,
        'use_small2big': False
    },
    'default': {
        'chunk_size_tokens': 512,
        'chunk_overlap_tokens': 102,
        'use_small2big': True,
        'small_chunk_size': 256
    }
}


def detect_document_type(filename: str, metadata: Dict[str, Any]) -> str:
    """Detect document type based on filename and metadata."""
    filename_lower = filename.lower()

    if '800-53' in filename_lower and metadata.get('file_type') == 'xml':
        return '800-53_xml'
    elif '800-53' in filename_lower and 'catalog' in filename_lower:
        return '800-53_catalog'
    elif '800-53a' in filename_lower or 'assessment' in filename_lower:
        return '800-53a_assessment'
    elif '800-37' in filename_lower or 'rmf' in filename_lower:
        return '800-37_rmf'
    elif 'csf' in filename_lower or 'cybersecurity framework' in filename_lower:
        return 'csf_2.0'
    elif '800-171' in filename_lower:
        return '800-171'
    elif 'fedramp' in filename_lower:
        return 'fedramp'
    elif 'cmmc' in filename_lower:
        return 'cmmc'
    elif 'srg' in filename_lower or 'dod' in filename_lower:
        return 'dod_srg'

    if metadata.get('document_type') == '800-53_xml':
        return '800-53_xml'
    elif metadata.get('document_type') == 'security_pattern':
        return 'security_pattern'
    elif metadata.get('document_type') == 'positioning_guide':
        return 'positioning_guide'
    elif metadata.get('document_type') == 'zone_guide':
        return 'zone_guide'
    elif metadata.get('document_type') == 'grouping_guide':
        return 'grouping_guide'
    elif metadata.get('document_type') == 'segmentation_guide':
        return 'segmentation_guide'

    if 'security_pattern' in filename_lower:
        return 'security_pattern'
    elif 'positioning' in filename_lower:
        return 'positioning_guide'
    elif 'zone' in filename_lower:
        return 'zone_guide'
    elif 'grouping' in filename_lower:
        return 'grouping_guide'
    elif 'segmentation' in filename_lower:
        return 'segmentation_guide'
    elif 'query_pattern' in filename_lower or 'greeting' in filename_lower:
        return 'query_patterns'

    return 'default'


def get_chunking_config(document_type: str) -> Dict[str, Any]:
    """Get chunking configuration for a document type."""
    return CHUNKING_CONFIG.get(document_type, CHUNKING_CONFIG['default'])


# Cache splitter instances and token counter
_splitter_cache = {}
_token_counter = None


DOCUMENT_LABELS = {
    '800-53_catalog': "NIST SP 800-53 Rev. 5 Control Catalog",
    '800-53_xml': "NIST SP 800-53 Rev. 5 Control Catalog (XML)",
    '800-53a_assessment': "NIST SP 800-53A Rev. 5 Assessment Procedures",
    '800-37_rmf': "NIST SP 800-37 Rev. 2 RMF Lifecycle",
    'csf_2.0': "NIST Cybersecurity Framework 2.0",
    '800-171': "NIST SP 800-171 Rev. 3 (CUI Requirements)",
    'fedramp': "FedRAMP Security Baseline",
    'dod_srg': "DoD Cloud SRG (IL2-IL6)",
    'cmmc': "CMMC (Cybersecurity Maturity Model Certification)",
    'security_pattern': "Security Pattern Documentation",
    'positioning_guide': "Device Positioning Best Practices",
    'zone_guide': "Security Zone Relationships",
    'grouping_guide': "Device Grouping Patterns",
    'segmentation_guide': "Network Segmentation Strategies",
    'query_patterns': "Query Patterns and Common Greetings",
    'default': "Source Document"
}


def _build_context_prefix(metadata: Dict[str, Any], document_type: str) -> str:
    """Build contextual prefix text for a chunk based on metadata."""
    parts = []

    label = DOCUMENT_LABELS.get(document_type)
    if label:
        parts.append(label)

    if metadata.get('section_heading'):
        parts.append(f"Section: {metadata['section_heading']}")

    if metadata.get('control_id'):
        control_part = f"Control {metadata['control_id']}"
        if metadata.get('control_name'):
            control_part += f" - {metadata['control_name']}"
        if metadata.get('family'):
            control_part += f" (Family {metadata['family']})"
        if metadata.get('enhancement_number'):
            control_part += f" Enhancement {metadata['enhancement_number']}"
        parts.append(control_part)

    if metadata.get('task_id'):
        parts.append(f"Task: {metadata['task_id']}")
    if metadata.get('step'):
        parts.append(f"Step: {metadata['step']}")

    if metadata.get('function'):
        parts.append(f"Function: {metadata['function']}")
    if metadata.get('category'):
        parts.append(f"Category: {metadata['category']}")

    if metadata.get('impact_level'):
        parts.append(f"Impact Level: {metadata['impact_level']}")
    if metadata.get('baseline_level'):
        parts.append(f"Baseline: {metadata['baseline_level']}")

    if metadata.get('page'):
        parts.append(f"Page {metadata['page']}")
    if metadata.get('sheet'):
        parts.append(f"Sheet: {metadata['sheet']}")

    return " | ".join(parts)


def chunk_text(text: str, metadata: Dict[str, Any], document_type: str = None,
                enable_small2big: bool = True, enable_questions: bool = True) -> List[Dict[str, Any]]:
    """
    Chunk text using TOKEN-BASED RecursiveCharacterTextSplitter.
    """
    global _token_counter

    if document_type is None:
        source = metadata.get('source', '')
        document_type = detect_document_type(source, metadata)

    config = get_chunking_config(document_type)
    chunk_size_tokens = config.get('chunk_size_tokens', 512)
    chunk_overlap_tokens = config.get('chunk_overlap_tokens', 102)
    use_small2big = config.get('use_small2big', False) and enable_small2big
    small_chunk_size = config.get('small_chunk_size', 256)

    context_prefix = _build_context_prefix(metadata, document_type)

    def prepend_context(content: str) -> str:
        content = content.strip()
        if not content:
            return content
        return f"{context_prefix}\n\n{content}" if context_prefix else content

    if _token_counter is None:
        _token_counter = create_token_counter()

    text_token_count = count_tokens(text)

    # For controls, if one_per_control is True and text is small enough, don't chunk
    if config.get('one_per_control') and text_token_count <= chunk_size_tokens:
        chunk_metadata = metadata.copy()
        chunk_metadata['chunk_index'] = 0
        chunk_metadata['document_type'] = document_type
        chunk_metadata['token_count'] = text_token_count
        chunk_metadata['is_small_chunk'] = False
        if context_prefix:
            chunk_metadata['context_prefix'] = context_prefix

        single_chunk = [{
            'text': prepend_context(text),
            'metadata': chunk_metadata
        }]

        if enable_questions:
            single_chunk = batch_enhance_chunks(single_chunk, document_type, enable_questions=True)

        return single_chunk

    # Cache splitter instances
    cache_key = (chunk_size_tokens, chunk_overlap_tokens, 'tokens')
    if cache_key not in _splitter_cache:
        _splitter_cache[cache_key] = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size_tokens,
            chunk_overlap=chunk_overlap_tokens,
            length_function=_token_counter,
        )

    text_splitter = _splitter_cache[cache_key]
    parent_chunks = text_splitter.split_text(text)

    chunk_metadata_base = metadata.copy()
    chunk_metadata_base['document_type'] = document_type
    if context_prefix:
        chunk_metadata_base['context_prefix'] = context_prefix

    chunk_documents = []

    if use_small2big and len(parent_chunks) > 1:
        small_overlap = calculate_adaptive_overlap(small_chunk_size)
        small_cache_key = (small_chunk_size, small_overlap, 'tokens_small')

        if small_cache_key not in _splitter_cache:
            _splitter_cache[small_cache_key] = RecursiveCharacterTextSplitter(
                chunk_size=small_chunk_size,
                chunk_overlap=small_overlap,
                length_function=_token_counter,
            )

        small_splitter = _splitter_cache[small_cache_key]

        for parent_idx, parent_chunk in enumerate(parent_chunks):
            parent_id = f"parent_{parent_idx}"
            parent_token_count = count_tokens(parent_chunk)

            small_chunks = small_splitter.split_text(parent_chunk)

            for small_idx, small_chunk in enumerate(small_chunks):
                small_token_count = count_tokens(small_chunk)
                chunk_meta = {
                    **chunk_metadata_base,
                    'chunk_index': len(chunk_documents),
                    'parent_chunk_id': parent_id,
                    'parent_chunk_index': parent_idx,
                    'small_chunk_index': small_idx,
                    'is_small_chunk': True,
                    'token_count': small_token_count,
                    'parent_token_count': parent_token_count,
                    'parent_text': parent_chunk
                }

                chunk_documents.append({
                    'text': prepend_context(small_chunk),
                    'metadata': chunk_meta
                })
    else:
        for idx, chunk in enumerate(parent_chunks):
            token_count = count_tokens(chunk)
            chunk_meta = {
                **chunk_metadata_base,
                'chunk_index': idx,
                'is_small_chunk': False,
                'token_count': token_count
            }

            chunk_documents.append({
                'text': prepend_context(chunk),
                'metadata': chunk_meta
            })

    if enable_questions:
        chunk_documents = batch_enhance_chunks(chunk_documents, document_type, enable_questions=True)

    return chunk_documents


def chunk_documents(documents: List[Dict[str, Any]], parallel: bool = True,
                    enable_small2big: bool = True, enable_questions: bool = True) -> List[Dict[str, Any]]:
    """
    Chunk a list of documents with document-aware chunking.
    """
    if not documents:
        return []

    if len(documents) == 1:
        doc = documents[0]
        source = doc['metadata'].get('source', '')
        document_type = detect_document_type(source, doc['metadata'])
        return chunk_text(doc['text'], doc['metadata'], document_type=document_type,
                         enable_small2big=enable_small2big, enable_questions=enable_questions)

    if parallel and len(documents) > 1:
        num_workers = min(len(documents), multiprocessing.cpu_count())

        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = []
            for doc in documents:
                source = doc['metadata'].get('source', '')
                document_type = detect_document_type(source, doc['metadata'])
                future = executor.submit(chunk_text, doc['text'], doc['metadata'], document_type,
                                       enable_small2big, enable_questions)
                futures.append(future)

            all_chunks = []
            for future in as_completed(futures):
                try:
                    chunks = future.result()
                    all_chunks.extend(chunks)
                except Exception as e:
                    print(f"  Warning: Chunking error: {e}")
                    continue

            return all_chunks
    else:
        all_chunks = []
        for doc in documents:
            source = doc['metadata'].get('source', '')
            document_type = detect_document_type(source, doc['metadata'])
            chunks = chunk_text(doc['text'], doc['metadata'], document_type=document_type,
                              enable_small2big=enable_small2big, enable_questions=enable_questions)
            all_chunks.extend(chunks)
        return all_chunks
