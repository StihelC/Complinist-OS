#!/usr/bin/env python3
"""
NIST 800-53 Control Ingestion Script
Ingests control definitions from CSV into ChromaDB with Small2Big structure.

This script populates ChromaDB with control definitions so the AI can answer
questions like "What is AC-3?" with accurate control text and implementation guidance.
"""

import csv
import json
import sys
import re
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

import chromadb

# Configuration
# Navigate to project root from scripts/ingestion/
PROJECT_ROOT = Path(__file__).parent.parent.parent
CSV_PATH = PROJECT_ROOT / "src/assets/catalog/NIST_SP-800-53_rev5_catalog_load.csv"
CHROMA_PATH = PROJECT_ROOT / ".data/shared/chroma_db"
COLLECTION_NAME = "documents"

# Token estimation (rough approximation)
def estimate_tokens(text: str) -> int:
    """Estimate token count (roughly 4 chars per token for English)"""
    return len(text) // 4


def extract_family(control_id: str) -> str:
    """Extract family from control ID (e.g., AC-3 -> AC)"""
    match = re.match(r'^([A-Z]+)', control_id.upper())
    return match.group(1) if match else ""


def create_small_chunk(control_id: str, name: str, control_text: str, family: str) -> dict:
    """Create a small chunk optimized for retrieval"""
    # Small chunk: Just the control ID, name, and first part of control text
    # This is used for semantic matching
    small_text = f"Control {control_id} ({name}): {control_text[:500]}"

    return {
        "text": small_text,
        "metadata": {
            "control_id": control_id,
            "control_name": name,
            "family": family,
            "document_type": "800-53",
            "is_small_chunk": True,
            "token_count": estimate_tokens(small_text),
        }
    }


def create_parent_chunk(control_id: str, name: str, control_text: str, discussion: str, related: str, family: str) -> str:
    """Create parent text with full control information for LLM context"""
    sections = []

    sections.append(f"# NIST 800-53 Control: {control_id} - {name}")
    sections.append(f"\n## Control Family: {family}")

    sections.append(f"\n## Control Text (Requirements)")
    sections.append(control_text.strip())

    if discussion and discussion.strip():
        sections.append(f"\n## Discussion (Implementation Guidance)")
        sections.append(discussion.strip())

    if related and related.strip():
        sections.append(f"\n## Related Controls: {related.strip()}")

    # Add evidence implementation suggestions based on control family
    sections.append(f"\n## Evidence Implementation Suggestions")
    sections.append(get_evidence_suggestions(control_id, family, control_text))

    return "\n".join(sections)


def get_evidence_suggestions(control_id: str, family: str, control_text: str) -> str:
    """Generate evidence implementation suggestions based on control type"""
    suggestions = {
        "AC": """
- Access control lists (ACLs) and permission configurations
- User access review documentation and approval records
- Role-based access control (RBAC) matrix
- Access request and approval workflow records
- System access logs showing enforcement
- Screenshots of access control configurations
- Periodic access certification reports""",
        "AU": """
- Audit log configuration screenshots
- Sample audit log entries
- Log retention policy documentation
- SIEM configuration and alert rules
- Audit review meeting minutes
- Log storage capacity monitoring reports
- Audit trail integrity verification records""",
        "AT": """
- Security awareness training completion records
- Training materials and curricula
- Phishing simulation results
- Role-based training records
- Annual training schedule and attendance
- Training effectiveness assessments
- New hire security training documentation""",
        "CA": """
- System security assessment reports
- Penetration test results
- Vulnerability scan reports
- Plan of Action and Milestones (POA&M)
- Authorization decision letters
- Continuous monitoring reports
- Control assessment procedures""",
        "CM": """
- Baseline configuration documentation
- Configuration change records and approvals
- Hardening guides and checklists
- Software inventory and licenses
- System component inventory
- Configuration audit reports
- Deviation documentation and approvals""",
        "CP": """
- Business continuity plan (BCP)
- Disaster recovery plan (DRP)
- Backup test results and logs
- Recovery time objective (RTO) documentation
- Alternate processing site agreements
- Contingency plan test results
- System backup schedules and verification""",
        "IA": """
- Password policy configurations
- Multi-factor authentication (MFA) enrollment records
- Identity proofing procedures
- Authenticator management procedures
- PKI certificate inventory
- Account provisioning/deprovisioning records
- Identity federation configurations""",
        "IR": """
- Incident response plan and procedures
- Incident tracking and resolution records
- Post-incident analysis reports
- Incident response team training records
- Contact lists and escalation procedures
- Incident detection tool configurations
- Lessons learned documentation""",
        "MA": """
- Maintenance schedules and logs
- Remote maintenance session records
- Maintenance personnel authorization records
- Equipment sanitization procedures
- Maintenance tool inventories
- Preventive maintenance records
- Vendor maintenance agreements""",
        "MP": """
- Media sanitization records and certificates
- Media inventory and tracking logs
- Media handling procedures
- Transport authorization records
- Encryption key management for media
- Media destruction certificates
- Removable media policy acknowledgments""",
        "PE": """
- Physical access control logs
- Visitor logs and escort procedures
- Badge/key issuance records
- Surveillance system configurations
- Environmental monitoring logs
- Emergency lighting test records
- Physical security inspection reports""",
        "PL": """
- System security plan (SSP)
- Privacy impact assessments
- Rules of behavior acknowledgments
- Security architecture diagrams
- System boundary documentation
- Interconnection security agreements
- Annual SSP reviews and updates""",
        "PS": """
- Personnel screening records
- Position risk designations
- Access agreement acknowledgments
- Termination and transfer checklists
- Third-party personnel agreements
- Personnel sanctions documentation
- Background investigation records""",
        "RA": """
- Risk assessment reports
- Security categorization documentation
- Vulnerability scan results
- Threat assessments
- Risk register
- Penetration test findings
- Risk acceptance documentation""",
        "SA": """
- System development lifecycle documentation
- Secure coding standards
- Security testing results
- Third-party security assessments
- Supply chain risk assessments
- Developer training records
- Security requirements documentation""",
        "SC": """
- Network diagrams showing security zones
- Encryption configurations
- Firewall and IDS/IPS rules
- TLS/SSL certificate inventory
- Network segmentation documentation
- Cryptographic key management procedures
- Boundary protection configurations""",
        "SI": """
- Vulnerability remediation records
- Malware protection configurations
- Software update/patch logs
- Security alert monitoring procedures
- Input validation configurations
- Error handling procedures
- Memory protection configurations""",
        "SR": """
- Supply chain risk management plan
- Supplier security assessments
- Component authenticity verification
- Tamper protection procedures
- Supplier monitoring reports
- Critical component sourcing records
- Supply chain incident response plans""",
    }

    return suggestions.get(family, """
- Policy and procedure documentation
- Implementation evidence (configurations, screenshots)
- Periodic review and audit records
- Training and awareness documentation
- Monitoring and reporting evidence""")


def generate_embeddings_batch(texts: list, batch_size: int = 32) -> list:
    """Generate embeddings using BAAI/bge-m3 model to match app's embedding dimensions"""
    from chromadb.utils import embedding_functions

    # Use SentenceTransformer with bge-m3 model (1024 dimensions)
    # This matches the bge-m3-FP16.gguf model used by the app
    print(f"Using BAAI/bge-m3 embedding model (1024 dimensions)...")

    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="BAAI/bge-m3"
        )
    except Exception as e:
        print(f"Error loading bge-m3 model: {e}")
        print("Falling back to default embedding function (384 dimensions)")
        print("Note: This will cause dimension mismatch with the app!")
        ef = embedding_functions.DefaultEmbeddingFunction()

    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        print(f"  Embedding batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
        embeddings = ef(batch)
        all_embeddings.extend(embeddings)

    return all_embeddings


def ingest_controls():
    """Main ingestion function"""
    print(f"NIST 800-53 Control Ingestion")
    print(f"=" * 50)
    print(f"CSV Path: {CSV_PATH}")
    print(f"ChromaDB Path: {CHROMA_PATH}")
    print(f"Collection: {COLLECTION_NAME}")

    # Verify CSV exists
    if not CSV_PATH.exists():
        print(f"ERROR: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    # Read controls from CSV
    controls = []
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('identifier'):
                controls.append(row)

    print(f"\nLoaded {len(controls)} controls from CSV")

    # Create chunks
    small_chunks = []
    for control in controls:
        control_id = control.get('identifier', '').strip()
        name = control.get('name', '').strip()
        control_text = control.get('control_text', '').strip()
        discussion = control.get('discussion', '').strip()
        related = control.get('related', '').strip()

        if not control_id or not control_text:
            continue

        family = extract_family(control_id)

        # Create small chunk for retrieval
        small_chunk = create_small_chunk(control_id, name, control_text, family)

        # Create parent text for context
        parent_text = create_parent_chunk(control_id, name, control_text, discussion, related, family)

        # Add parent_text to metadata for Small2Big expansion
        small_chunk["metadata"]["parent_text"] = parent_text
        small_chunk["metadata"]["parent_token_count"] = estimate_tokens(parent_text)

        small_chunks.append({
            "id": f"nist_800_53_{control_id}",
            **small_chunk
        })

    print(f"Created {len(small_chunks)} chunks for ingestion")

    # Generate embeddings
    print(f"\nGenerating embeddings...")
    texts = [chunk["text"] for chunk in small_chunks]
    embeddings = generate_embeddings_batch(texts)

    print(f"Generated {len(embeddings)} embeddings")

    # Connect to ChromaDB
    print(f"\nConnecting to ChromaDB...")
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))

    # Delete and recreate collection to ensure correct embedding dimensions
    # This is necessary when switching embedding models (e.g., 384-dim to 1024-dim)
    try:
        existing_collection = client.get_collection(COLLECTION_NAME)
        print(f"Found existing collection '{COLLECTION_NAME}' with {existing_collection.count()} documents")
        print(f"Deleting collection to recreate with correct embedding dimensions...")
        client.delete_collection(COLLECTION_NAME)
        print(f"Deleted collection '{COLLECTION_NAME}'")
    except:
        print(f"No existing collection '{COLLECTION_NAME}' found")

    # Create fresh collection
    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )
    print(f"Created new collection '{COLLECTION_NAME}'")

    # Add controls in batches
    print(f"\nAdding controls to ChromaDB...")
    batch_size = 100
    total_added = 0

    for i in range(0, len(small_chunks), batch_size):
        batch = small_chunks[i:i + batch_size]
        batch_embeddings = embeddings[i:i + batch_size]

        ids = [chunk["id"] for chunk in batch]
        documents = [chunk["text"] for chunk in batch]
        metadatas = [chunk["metadata"] for chunk in batch]

        collection.add(
            ids=ids,
            embeddings=batch_embeddings,
            documents=documents,
            metadatas=metadatas
        )

        total_added += len(batch)
        print(f"  Added batch {i//batch_size + 1}: {total_added}/{len(small_chunks)} controls")

    print(f"\n" + "=" * 50)
    print(f"SUCCESS: Ingested {total_added} NIST 800-53 controls")
    print(f"Collection now has {collection.count()} total documents")

    # Verify with a test query
    print(f"\nVerifying ingestion with test query for AC-3...")
    test_results = collection.get(
        where={"control_id": "AC-3"},
        include=["metadatas", "documents"]
    )

    if test_results.get("ids"):
        print(f"✓ Found AC-3 control:")
        print(f"  ID: {test_results['ids'][0]}")
        print(f"  Name: {test_results['metadatas'][0].get('control_name', 'N/A')}")
        print(f"  Has parent_text: {'parent_text' in test_results['metadatas'][0]}")
        print(f"  Parent text length: {len(test_results['metadatas'][0].get('parent_text', ''))}")
    else:
        print("✗ AC-3 not found - check ingestion")


if __name__ == "__main__":
    ingest_controls()
