"""Metadata enhancement with hypothetical question generation.

Research paper recommendation (Section 3.2.4):
"Enhancing chunk blocks with metadata like titles, keywords, and hypothetical
questions can improve retrieval, provide more ways to post-process retrieved texts,
and help LLMs better understand retrieved information."
"""
from typing import List, Dict, Any
import re


def generate_hypothetical_questions(
    text: str,
    metadata: Dict[str, Any],
    document_type: str,
    max_questions: int = 3
) -> List[str]:
    """
    Generate hypothetical questions for a chunk to improve retrieval.

    Uses rule-based generation tailored to document types.
    """
    questions = []

    # Control-based documents (NIST 800-53, 800-171, CMMC, FedRAMP, etc.)
    if document_type in ['800-53_catalog', '800-53a_assessment', '800-171',
                          'fedramp', 'cmmc', 'dod_srg', 'cnssi_1253', 'overlays']:
        questions.extend(_generate_control_questions(text, metadata))

    # Security patterns and guides
    elif document_type in ['security_pattern', 'positioning_guide', 'zone_guide',
                           'grouping_guide', 'segmentation_guide']:
        questions.extend(_generate_pattern_questions(text, metadata, document_type))

    # RMF and framework documents
    elif document_type in ['800-37_rmf', 'csf_2.0']:
        questions.extend(_generate_framework_questions(text, metadata, document_type))

    # Query patterns (special case - already question-like)
    elif document_type == 'query_patterns':
        questions.extend(_generate_query_pattern_questions(text, metadata))

    # Default: content-based question generation
    else:
        questions.extend(_generate_generic_questions(text, metadata))

    # Deduplicate and limit
    questions = list(dict.fromkeys(questions))
    return questions[:max_questions]


def _generate_control_questions(text: str, metadata: Dict[str, Any]) -> List[str]:
    """Generate questions for security control chunks."""
    questions = []

    control_id = metadata.get('control_id', '')
    control_name = metadata.get('control_name', '')
    family = metadata.get('family', '')
    enhancement_number = metadata.get('enhancement_number', '')

    if control_id:
        questions.append(f"What is the purpose of control {control_id}?")
        questions.append(f"What are the requirements for {control_id}?")

        if control_name:
            questions.append(f"How do I implement {control_name}?")
            questions.append(f"What does {control_name} require?")

        if enhancement_number:
            questions.append(f"What does enhancement {enhancement_number} of {control_id} add?")

        if 'assessment' in metadata.get('source', '').lower():
            questions.append(f"How do you assess {control_id}?")
            questions.append(f"What are the assessment procedures for {control_id}?")

    if family:
        questions.append(f"What are the {family} family requirements?")

    if 'baseline' in text.lower():
        questions.append(f"What baseline applies to {control_id or 'this control'}?")

    if any(word in text.lower() for word in ['shall', 'must', 'required']):
        questions.append(f"What are the mandatory requirements for {control_id or 'this'}?")

    return questions


def _generate_pattern_questions(text: str, metadata: Dict[str, Any],
                                  document_type: str) -> List[str]:
    """Generate questions for security pattern and guide chunks."""
    questions = []

    pattern_keywords = _extract_key_terms(text, pattern_type=True)

    if document_type == 'security_pattern':
        if pattern_keywords:
            for keyword in pattern_keywords[:2]:
                questions.append(f"How do I implement {keyword}?")
                questions.append(f"What are the best practices for {keyword}?")

        questions.append("What security patterns should I use?")

        if 'zero trust' in text.lower():
            questions.append("How do I implement zero trust architecture?")
        if 'dmz' in text.lower():
            questions.append("How should I configure my DMZ?")

    elif document_type == 'positioning_guide':
        questions.append("Where should I position security devices?")
        questions.append("What are the best practices for device placement?")

    elif document_type == 'zone_guide':
        questions.append("How should I segment network zones?")
        questions.append("What are the security zone requirements?")

    elif document_type == 'grouping_guide':
        questions.append("How should I group devices?")
        questions.append("What are device grouping best practices?")

    elif document_type == 'segmentation_guide':
        questions.append("How do I segment my network?")
        questions.append("What are network segmentation strategies?")

    return questions


def _generate_framework_questions(text: str, metadata: Dict[str, Any],
                                    document_type: str) -> List[str]:
    """Generate questions for framework documents (RMF, CSF, etc.)."""
    questions = []

    if document_type == '800-37_rmf':
        task_id = metadata.get('task_id', '')
        step = metadata.get('step', '')

        if task_id:
            questions.append(f"What is task {task_id} in the RMF?")
            questions.append(f"How do I complete task {task_id}?")

        if step:
            questions.append(f"What are the requirements for RMF step {step}?")

        questions.append("What are the RMF steps?")
        questions.append("How do I implement the Risk Management Framework?")

    elif document_type == 'csf_2.0':
        function = metadata.get('function', '')
        category = metadata.get('category', '')

        if function:
            questions.append(f"What is the {function} function in the CSF?")

        if category:
            questions.append(f"What are the {category} requirements?")

        questions.append("What are the Cybersecurity Framework requirements?")

    return questions


def _generate_query_pattern_questions(text: str, metadata: Dict[str, Any]) -> List[str]:
    """Generate questions for query pattern chunks (meta-questions)."""
    questions = []

    if '?' in text:
        existing_questions = [q.strip() + '?' for q in text.split('?') if q.strip()]
        return existing_questions[:3]

    questions.append("What are common questions about compliance?")
    questions.append("What should I ask about security requirements?")

    return questions


def _generate_generic_questions(text: str, metadata: Dict[str, Any]) -> List[str]:
    """Generate generic questions for any document type."""
    questions = []

    key_terms = _extract_key_terms(text)

    if key_terms:
        primary_term = key_terms[0]
        questions.append(f"What is {primary_term}?")
        questions.append(f"How does {primary_term} work?")
        questions.append(f"What are the requirements for {primary_term}?")

    if any(word in text.lower() for word in ['requirement', 'must', 'shall']):
        questions.append("What are the requirements?")

    if any(word in text.lower() for word in ['implement', 'deploy', 'configure']):
        questions.append("How do I implement this?")

    if 'assess' in text.lower() or 'evaluate' in text.lower():
        questions.append("How do I assess this?")

    if metadata.get('section_heading'):
        section = metadata['section_heading']
        questions.append(f"What is covered in {section}?")

    return questions


def _extract_key_terms(text: str, pattern_type: bool = False) -> List[str]:
    """Extract key terms from text for question generation."""
    terms = []

    if pattern_type:
        pattern_terms = [
            'zero trust', 'dmz', 'defense in depth', 'segmentation',
            'micro-segmentation', 'network isolation', 'perimeter security',
            'firewall', 'intrusion detection', 'intrusion prevention',
            'load balancer', 'proxy', 'gateway'
        ]

        text_lower = text.lower()
        for term in pattern_terms:
            if term in text_lower:
                terms.append(term)

    # Extract capitalized terms
    capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', text)
    terms.extend(capitalized[:3])

    # Extract acronyms
    acronyms = re.findall(r'\b[A-Z]{2,6}\b', text)
    terms.extend(acronyms[:3])

    return terms[:5]


def enhance_chunk_metadata(
    chunk: Dict[str, Any],
    document_type: str,
    enable_questions: bool = True
) -> Dict[str, Any]:
    """
    Enhance chunk metadata with hypothetical questions.
    """
    if not enable_questions:
        return chunk

    text = chunk.get('text', '')
    metadata = chunk.get('metadata', {})

    questions = generate_hypothetical_questions(text, metadata, document_type)

    if questions:
        enhanced_metadata = metadata.copy()
        enhanced_metadata['hypothetical_questions'] = questions
        enhanced_metadata['question_count'] = len(questions)
        enhanced_metadata['questions_text'] = ' '.join(questions)

        return {
            'text': chunk['text'],
            'metadata': enhanced_metadata
        }

    return chunk


def batch_enhance_chunks(
    chunks: List[Dict[str, Any]],
    document_type: str,
    enable_questions: bool = True
) -> List[Dict[str, Any]]:
    """Enhance multiple chunks in batch."""
    if not enable_questions:
        return chunks

    return [enhance_chunk_metadata(chunk, document_type, enable_questions)
            for chunk in chunks]
