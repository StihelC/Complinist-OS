"""File processor for extracting text from PDF, Excel, CSV, XML, and Markdown files."""
import os
import re
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
import pandas as pd
import xml.etree.ElementTree as ET


def _detect_section_heading(text: str) -> Optional[str]:
    """Detect section heading candidates from PDF text."""
    heading_patterns = [
        r'^(TASK\s+[A-Z]-?\d+)',
        r'^(STEP\s+[A-Z0-9\-\.]+)',
        r'^(PHASE\s+[A-Z0-9\-\.]+)',
        r'^(PR\.|ID\.|DE\.|RS\.|RC\.)',
        r'^[A-Z]{2}\.[A-Z]{2}-\d+',
        r'^[A-Z]{2}-\d+(\(\d+\))?'
    ]

    lines = [line.strip() for line in text.split('\n') if line.strip()]
    for line in lines:
        if len(line) > 5 and line.replace(' ', '').isupper():
            return line
        for pattern in heading_patterns:
            if re.match(pattern, line, flags=re.IGNORECASE):
                return line
    return None


def extract_text_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Extract text from PDF file with page tracking."""
    pages = []
    try:
        reader = PdfReader(file_path)
        filename = os.path.basename(file_path)
        current_section: Optional[str] = None

        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            if text and text.strip():
                metadata = {
                    'source': filename,
                    'page': page_num,
                    'file_type': 'pdf'
                }

                filename_lower = filename.lower()
                if 'cmmc' in filename_lower:
                    metadata['category'] = 'CMMC'
                    metadata['compliance_frameworks'] = 'CMMC'
                elif 'fedramp' in filename_lower:
                    metadata['category'] = 'FedRAMP'
                    metadata['compliance_frameworks'] = 'FedRAMP'
                elif 'dod' in filename_lower or 'srg' in filename_lower:
                    metadata['category'] = 'DoD_SRG'
                    metadata['compliance_frameworks'] = 'DoD SRG'
                elif 'nist' in filename_lower or '800-' in filename_lower or 'fips' in filename_lower:
                    metadata['category'] = 'NIST'
                    if '800-53' in filename_lower:
                        metadata['document_type'] = '800-53_catalog'
                    elif '800-171' in filename_lower:
                        metadata['document_type'] = '800-171'
                    elif '800-37' in filename_lower or 'rmf' in filename_lower:
                        metadata['document_type'] = '800-37_rmf'

                heading = _detect_section_heading(text)
                if heading:
                    current_section = heading
                if current_section:
                    metadata['section_heading'] = current_section

                pages.append({
                    'text': text,
                    'metadata': metadata
                })
    except Exception as e:
        raise Exception(f"Error processing PDF {file_path}: {str(e)}")

    return pages


def extract_text_from_excel(file_path: str) -> List[Dict[str, Any]]:
    """Extract text from Excel file with sheet tracking."""
    sheets = []
    try:
        filename = os.path.basename(file_path)
        excel_file = pd.ExcelFile(file_path)

        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)

            text_parts = []
            if not df.empty:
                text_parts.append(" | ".join(str(col) for col in df.columns))
                text_parts.append("-" * 50)
                for idx, row in df.iterrows():
                    row_text = " | ".join(str(val) if pd.notna(val) else "" for val in row.values)
                    text_parts.append(row_text)

            text = "\n".join(text_parts)

            if text.strip():
                metadata = {
                    'source': filename,
                    'sheet': sheet_name,
                    'file_type': 'excel'
                }

                filename_lower = filename.lower()
                if 'cmmc' in filename_lower:
                    metadata['category'] = 'CMMC'
                elif 'fedramp' in filename_lower:
                    metadata['category'] = 'FedRAMP'
                elif 'nist' in filename_lower or '800-' in filename_lower:
                    metadata['category'] = 'NIST'

                sheets.append({
                    'text': text,
                    'metadata': metadata
                })
    except Exception as e:
        raise Exception(f"Error processing Excel file {file_path}: {str(e)}")

    return sheets


def normalize_control_id(control_id: str) -> str:
    """Normalize control identifier."""
    if not control_id:
        return ""
    match = re.match(r'^([A-Z]+)-(\d+)(.*)$', control_id.upper())
    if match:
        family = match.group(1)
        number = match.group(2).zfill(2)
        suffix = match.group(3)
        return f"{family}-{number}{suffix}"
    return control_id.upper()


def extract_text_from_csv(file_path: str, assessment_procedures: Dict = None) -> List[Dict[str, Any]]:
    """Extract text from CSV file."""
    documents = []
    try:
        filename = os.path.basename(file_path)

        encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252', 'windows-1252']
        df = None

        for encoding in encodings:
            try:
                try:
                    df = pd.read_csv(file_path, encoding=encoding, on_bad_lines='skip', engine='python')
                except TypeError:
                    df = pd.read_csv(file_path, encoding=encoding, error_bad_lines=False, warn_bad_lines=False, engine='python')
                break
            except (UnicodeDecodeError, UnicodeError):
                continue

        if df is None:
            try:
                df = pd.read_csv(file_path, encoding='utf-8', errors='replace', on_bad_lines='skip', engine='python')
            except Exception as e:
                raise Exception(f"Could not read CSV file: {str(e)}")

        if not df.empty:
            for idx, row in df.iterrows():
                control_parts = []

                control_id = None
                if 'identifier' in df.columns:
                    control_id = str(row.get('identifier', '')).strip()
                    if control_id:
                        control_parts.append(f"Control: {control_id}")

                if 'name' in df.columns:
                    name = str(row.get('name', '')).strip()
                    if name:
                        control_parts.append(f"Name: {name}")

                for col in df.columns:
                    if col not in ['identifier', 'name']:
                        value = row.get(col, '')
                        if pd.notna(value) and str(value).strip():
                            col_name = col.replace('_', ' ').title()
                            control_parts.append(f"{col_name}: {str(value).strip()}")

                control_text = "\n\n".join(control_parts)

                if control_text.strip():
                    family = None
                    if control_id:
                        match = re.match(r'^([A-Z]+)', control_id.upper())
                        if match:
                            family = match.group(1)

                    metadata = {
                        'source': filename,
                        'file_type': 'csv',
                        'row_index': int(idx)
                    }

                    if control_id:
                        metadata['control_id'] = control_id
                        if family:
                            metadata['family'] = family

                    documents.append({
                        'text': control_text,
                        'metadata': metadata
                    })
    except Exception as e:
        raise Exception(f"Error processing CSV file {file_path}: {str(e)}")

    return documents


def _extract_statement_text(element: ET.Element, indent: int = 0) -> str:
    """Recursively extract text from nested <statement> elements."""
    parts = []

    desc_elem = element.find('description')
    if desc_elem is not None and desc_elem.text:
        desc_text = desc_elem.text.strip()
        if desc_text:
            parts.append(desc_text)

    for sub_statement in element.findall('statement'):
        sub_number = sub_statement.find('number')
        sub_desc = sub_statement.find('description')

        sub_parts = []
        if sub_number is not None and sub_number.text:
            sub_parts.append(f"{sub_number.text.strip()}")
        if sub_desc is not None and sub_desc.text:
            sub_parts.append(sub_desc.text.strip())

        if sub_parts:
            indent_str = "  " * (indent + 1)
            parts.append(f"{indent_str}{' '.join(sub_parts)}")

        deeper_text = _extract_statement_text(sub_statement, indent + 1)
        if deeper_text:
            parts.append(deeper_text)

    return "\n".join(parts)


def _extract_discussion_text(element: ET.Element) -> str:
    """Extract text from <discussion>/<description> elements."""
    if element is None:
        return ""

    desc_elem = element.find('description')
    if desc_elem is None:
        return ""

    parts = []
    for p_elem in desc_elem.findall('.//p'):
        if p_elem.text:
            parts.append(p_elem.text.strip())
        for child in p_elem:
            if child.tail:
                parts.append(child.tail.strip())

    if not parts and desc_elem.text:
        parts.append(desc_elem.text.strip())

    return "\n\n".join(parts)


def extract_text_from_xml(file_path: str) -> List[Dict[str, Any]]:
    """Extract text from NIST SP 800-53 XML file with control-aware parsing."""
    documents = []

    try:
        filename = os.path.basename(file_path)
        tree = ET.parse(file_path)
        root = tree.getroot()

        ns = {
            'controls': 'http://scap.nist.gov/schema/sp800-53/feed/2.0',
            '': 'http://scap.nist.gov/schema/sp800-53/2.0'
        }

        for control_elem in root.findall('.//controls:control', ns):
            family_elem = control_elem.find('family', ns)
            number_elem = control_elem.find('number', ns)
            title_elem = control_elem.find('title', ns)

            if number_elem is None or number_elem.text is None:
                continue

            control_id = number_elem.text.strip()
            family = family_elem.text.strip() if family_elem is not None and family_elem.text else ""
            title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""

            baselines = []
            for baseline_elem in control_elem.findall('baseline', ns):
                if baseline_elem.text:
                    baselines.append(baseline_elem.text.strip())

            statement_elem = control_elem.find('statement', ns)
            statement_text = _extract_statement_text(statement_elem) if statement_elem is not None else ""

            discussion_elem = control_elem.find('discussion', ns)
            discussion_text = _extract_discussion_text(discussion_elem) if discussion_elem is not None else ""

            base_control_parts = [
                f"Control ID: {control_id}",
                f"Title: {title}",
                f"Family: {family}"
            ]

            if baselines:
                base_control_parts.append(f"Baselines: {', '.join(baselines)}")

            if statement_text:
                base_control_parts.append(f"\nSTATEMENT:\n{statement_text}")

            if discussion_text:
                base_control_parts.append(f"\nDISCUSSION:\n{discussion_text}")

            base_control_text = "\n\n".join(base_control_parts)

            base_metadata = {
                'source': filename,
                'file_type': 'xml',
                'category': 'NIST',
                'control_id': control_id,
                'control_name': title,
                'family': family.split()[0] if family else control_id.split('-')[0],
                'document_type': '800-53_xml'
            }

            if baselines:
                base_metadata['baselines'] = ','.join(baselines)

            documents.append({
                'text': base_control_text,
                'metadata': base_metadata
            })

    except Exception as e:
        raise Exception(f"Error processing XML file {file_path}: {str(e)}")

    return documents


def extract_text_from_markdown(file_path: str) -> List[Dict[str, Any]]:
    """Extract text from Markdown file with metadata extraction."""
    documents = []
    try:
        filename = os.path.basename(file_path)

        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()

        if text and text.strip():
            metadata = {
                'source': filename,
                'file_type': 'markdown'
            }

            filename_lower = filename.lower()

            if 'cmmc' in filename_lower:
                metadata['category'] = 'CMMC'
            elif 'fedramp' in filename_lower:
                metadata['category'] = 'FedRAMP'
            elif 'nist' in filename_lower or '800-' in filename_lower:
                metadata['category'] = 'NIST'
            elif any(x in filename_lower for x in ['security_pattern', 'positioning', 'zone', 'grouping', 'segmentation']):
                metadata['category'] = 'Security_Patterns'

            if 'security_pattern' in filename_lower:
                metadata['document_type'] = 'security_pattern'
            elif 'positioning' in filename_lower:
                metadata['document_type'] = 'positioning_guide'
            elif 'zone' in filename_lower:
                metadata['document_type'] = 'zone_guide'
            elif 'grouping' in filename_lower:
                metadata['document_type'] = 'grouping_guide'
            elif 'segmentation' in filename_lower:
                metadata['document_type'] = 'segmentation_guide'

            documents.append({
                'text': text,
                'metadata': metadata
            })
    except Exception as e:
        raise Exception(f"Error processing Markdown file {file_path}: {str(e)}")

    return documents


def process_file(file_path: str) -> List[Dict[str, Any]]:
    """Process a file and extract text with metadata."""
    file_ext = os.path.splitext(file_path)[1].lower()

    if file_ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif file_ext in ['.xlsx', '.xls']:
        return extract_text_from_excel(file_path)
    elif file_ext == '.csv':
        return extract_text_from_csv(file_path)
    elif file_ext == '.xml':
        return extract_text_from_xml(file_path)
    elif file_ext == '.md':
        return extract_text_from_markdown(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_ext}. Supported types: .pdf, .xlsx, .xls, .csv, .xml, .md")
