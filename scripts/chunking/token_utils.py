"""Token counting utilities using tiktoken for accurate token-based chunking.

Based on research paper best practices (Section 3.2.1):
- Optimal chunk size: 256-512 tokens (97.59% faithfulness at 512 tokens)
- Adaptive overlap: ~20% of chunk size
- Token-based splitting prevents semantic fragmentation
"""
import tiktoken
from typing import Callable


# Default encoding for most modern LLMs (GPT-3.5, GPT-4, text-embedding-ada-002)
DEFAULT_ENCODING = "cl100k_base"

# Cache for tokenizer instances (avoid reloading)
_tokenizer_cache = {}


def get_tokenizer(encoding_name: str = DEFAULT_ENCODING) -> tiktoken.Encoding:
    """
    Get a tiktoken tokenizer instance (cached for performance).

    Args:
        encoding_name: Name of the tiktoken encoding (default: cl100k_base)

    Returns:
        tiktoken.Encoding instance
    """
    if encoding_name not in _tokenizer_cache:
        _tokenizer_cache[encoding_name] = tiktoken.get_encoding(encoding_name)
    return _tokenizer_cache[encoding_name]


def count_tokens(text: str, encoding_name: str = DEFAULT_ENCODING) -> int:
    """
    Count the number of tokens in a text string.

    Args:
        text: Text to count tokens for
        encoding_name: Name of the tiktoken encoding

    Returns:
        Number of tokens in the text
    """
    tokenizer = get_tokenizer(encoding_name)
    return len(tokenizer.encode(text, disallowed_special=()))


def create_token_counter(encoding_name: str = DEFAULT_ENCODING) -> Callable[[str], int]:
    """
    Create a token counting function suitable for use with LangChain text splitters.

    This function returns a callable that can be passed as the length_function
    parameter to RecursiveCharacterTextSplitter.

    Args:
        encoding_name: Name of the tiktoken encoding

    Returns:
        Callable that takes a string and returns token count
    """
    tokenizer = get_tokenizer(encoding_name)

    def token_counter(text: str) -> int:
        """Count tokens in text using tiktoken."""
        return len(tokenizer.encode(text, disallowed_special=()))

    return token_counter


def calculate_adaptive_overlap(chunk_size_tokens: int, overlap_ratio: float = 0.2) -> int:
    """
    Calculate adaptive overlap size based on chunk size.

    Research paper recommendation: ~20 tokens overlap for their setup.
    We use a percentage-based approach for flexibility across chunk sizes.

    Args:
        chunk_size_tokens: Target chunk size in tokens
        overlap_ratio: Ratio of overlap to chunk size (default: 0.2 = 20%)

    Returns:
        Overlap size in tokens
    """
    # Calculate overlap with minimum of 20 tokens (paper's base recommendation)
    overlap = max(20, int(chunk_size_tokens * overlap_ratio))

    # Cap overlap at 50% of chunk size to avoid excessive redundancy
    max_overlap = chunk_size_tokens // 2
    return min(overlap, max_overlap)


def estimate_tokens_from_chars(char_count: int) -> int:
    """
    Estimate token count from character count (rough approximation).

    Rule of thumb: ~4 characters per token for English text.
    """
    return max(1, char_count // 4)


def estimate_chars_from_tokens(token_count: int) -> int:
    """
    Estimate character count from token count (rough approximation).

    Rule of thumb: ~4 characters per token for English text.
    """
    return token_count * 4


def validate_token_config(chunk_size: int, chunk_overlap: int) -> tuple:
    """
    Validate and adjust token-based chunking configuration.

    Ensures:
    - Chunk size is within reasonable bounds (50-2048 tokens)
    - Overlap is less than chunk size
    - Configuration aligns with research paper recommendations

    Args:
        chunk_size: Desired chunk size in tokens
        chunk_overlap: Desired overlap size in tokens

    Returns:
        Tuple of (validated_chunk_size, validated_overlap)
    """
    # Enforce minimum chunk size (50 tokens)
    if chunk_size < 50:
        print(f"Warning: Chunk size {chunk_size} too small, setting to 50 tokens")
        chunk_size = 50

    # Enforce maximum chunk size (2048 tokens for most embeddings)
    if chunk_size > 2048:
        print(f"Warning: Chunk size {chunk_size} too large, setting to 2048 tokens")
        chunk_size = 2048

    # Ensure overlap is less than chunk size
    if chunk_overlap >= chunk_size:
        print(f"Warning: Overlap {chunk_overlap} >= chunk size {chunk_size}, adjusting")
        chunk_overlap = chunk_size // 4  # Set to 25% of chunk size

    return chunk_size, chunk_overlap


def get_optimal_chunk_size(document_type: str) -> tuple:
    """
    Get optimal chunk size and overlap based on document type and research recommendations.

    Based on paper Section 3.2.1, Table 3:
    - 512 tokens: 97.59% faithfulness, 97.41% relevancy (OPTIMAL)
    - 256 tokens: 97.22% faithfulness, 97.78% relevancy
    - 128 tokens: 95.74% faithfulness (too small, fragments context)
    - 1024+ tokens: 94.26% faithfulness (too large, dilutes relevance)

    Args:
        document_type: Type of document being chunked

    Returns:
        Tuple of (chunk_size_tokens, overlap_tokens)
    """
    # Research-backed optimal configurations
    optimal_configs = {
        # Controls: Smaller chunks to keep atomic (256-400 range)
        '800-53_catalog': (384, 77),
        '800-53a_assessment': (384, 77),
        '800-171': (384, 77),
        'fedramp': (384, 77),
        'cmmc': (384, 77),

        # RMF and frameworks: Medium chunks (400-450 range)
        '800-37_rmf': (400, 80),
        'csf_2.0': (400, 80),
        'dod_srg': (450, 90),
        'cnssi_1253': (400, 80),
        'overlays': (400, 80),
        'parameters': (400, 80),

        # Security patterns: Balanced chunks (400-500 range)
        'security_pattern': (450, 90),
        'positioning_guide': (450, 90),
        'zone_guide': (450, 90),
        'grouping_guide': (450, 90),
        'segmentation_guide': (450, 90),

        # Query patterns: Smaller chunks (300 range)
        'query_patterns': (300, 60),

        # Default: Research-backed optimal (512 tokens)
        'default': (512, 102)  # 97.59% faithfulness per Table 3
    }

    return optimal_configs.get(document_type, optimal_configs['default'])
