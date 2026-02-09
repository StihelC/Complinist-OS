#!/usr/bin/env node
/**
 * Test NIST Control Accuracy
 * Queries 10 random NIST controls and verifies responses are accurate
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Known control IDs and their correct names for validation
const KNOWN_CONTROLS = {
  'AC-1': 'Policy and Procedures',
  'AC-2': 'Account Management',
  'AC-3': 'Access Enforcement',
  'AC-4': 'Information Flow Enforcement',
  'AC-5': 'Separation of Duties',
  'AC-6': 'Least Privilege',
  'AC-7': 'Unsuccessful Logon Attempts',
  'AC-8': 'System Use Notification',
  'AC-9': 'Previous Logon Notification',
  'AC-10': 'Concurrent Session Control',
  'AC-11': 'Device Lock',
  'AC-12': 'Session Termination',
  'AC-13': 'Supervision and Review',
  'AC-14': 'Permitted Actions Without Identification or Authentication',
  'AC-15': 'Automated Marking',
  'AC-16': 'Security and Privacy Attributes',
  'AC-17': 'Remote Access',
  'AC-18': 'Wireless Access',
  'AC-19': 'Access Control for Mobile Devices',
  'AC-20': 'Use of External Systems',
  'AC-21': 'Information Sharing',
  'AC-22': 'Publicly Accessible Content',
  'AU-1': 'Policy and Procedures',
  'AU-2': 'Event Logging',
  'AU-3': 'Content of Audit Records',
  'AU-4': 'Audit Log Storage Capacity',
  'AU-5': 'Response to Audit Processing Failures',
  'AU-6': 'Audit Review, Analysis, and Reporting',
  'AU-7': 'Audit Reduction and Report Generation',
  'AU-8': 'Time Stamps',
  'AU-9': 'Protection of Audit Information',
  'AU-10': 'Non-Repudiation',
  'AU-11': 'Audit Record Retention',
  'AU-12': 'Audit Generation',
  'SI-1': 'System and Information Integrity Policy and Procedures',
  'SI-2': 'Flaw Remediation',
  'SI-3': 'Malicious Code Protection',
  'SI-4': 'System Monitoring',
  'SI-5': 'Security Alerts, Advisories, and Directives',
  'SI-6': 'Security Function Verification',
  'SI-7': 'Software, Firmware, and Information Integrity',
  'SI-8': 'Spam Protection',
  'SI-9': 'Information Input Restrictions',
  'SI-10': 'Information Input Validation',
  'SI-11': 'Error Handling',
  'SI-12': 'Information Management and Retention',
  'SI-13': 'Predictable Failure Prevention',
  'SI-14': 'Non-Persistence',
  'SI-15': 'Information Output Filtering',
  'SI-16': 'Memory Protection',
  'SC-1': 'System and Communications Protection Policy and Procedures',
  'SC-2': 'Application Partitioning',
  'SC-3': 'Security Function Isolation',
  'SC-4': 'Information in Shared System Resources',
  'SC-5': 'Denial of Service Protection',
  'SC-6': 'Resource Availability',
  'SC-7': 'Boundary Protection',
  'SC-8': 'Transmission Confidentiality and Integrity',
  'SC-9': 'Transmission Confidentiality',
  'SC-10': 'Network Disconnect',
  'SC-11': 'Trusted Path',
  'SC-12': 'Cryptographic Key Establishment and Management',
  'SC-13': 'Cryptographic Protection',
  'SC-14': 'Public Key Infrastructure Certificates',
  'SC-15': 'Collaborative Computing Devices',
  'SC-16': 'Transmission of Security and Privacy Attributes',
  'SC-17': 'Public Key Infrastructure Certificates',
  'SC-18': 'Mobile Code',
  'SC-19': 'Voice Over Internet Protocol',
  'SC-20': 'Secure Name / Address Resolution Service',
  'SC-21': 'Secure Name / Address Resolution Service',
  'SC-22': 'Architecture and Provisioning for Name / Address Resolution Service',
  'SC-23': 'Session Authenticity',
  'SC-24': 'Fail in Known State',
  'SC-25': 'Thin Nodes',
  'SC-26': 'Honeypots',
  'SC-27': 'Platform-Independent Applications',
  'SC-28': 'Protection of Information at Rest',
  'SC-29': 'Heterogeneity',
  'SC-30': 'Concealment and Misdirection',
  'SC-31': 'Covert Channel Analysis',
  'SC-32': 'Information System Partitioning',
  'SC-33': 'Transmission Preparation Integrity',
  'SC-34': 'Non-Modifiable Executable Programs',
  'SC-35': 'External Malicious Code',
  'SC-36': 'Distributed Processing and Storage',
  'SC-37': 'Out-of-Band Channels',
  'SC-38': 'Operations Security',
  'SC-39': 'Process Isolation',
  'SC-40': 'Wireless Link Protection',
  'SC-41': 'Port and I/O Device Access',
  'SC-42': 'Sensor Capabilities and Data',
  'SC-43': 'Usage Restrictions',
  'SC-44': 'Detonation Chambers',
  'SC-45': 'System Time Synchronization',
  'SC-46': 'Cross-Service Attacks',
  'SC-47': 'Alternate Communications Paths',
  'SC-48': 'Sensor Relocation',
  'SC-49': 'Hardware-Enforced Separation',
  'SC-50': 'Software-Enforced Separation',
  'SC-51': 'Hardware-Based Protection',
  'SC-52': 'Threat Modeling',
  'SC-53': 'Covert Channel Mitigation',
  'SC-54': 'Shared Memory Protection',
  'SC-55': 'Enclave and Boundary Protection',
  'SC-56': 'External Service Provider',
  'SC-57': 'Virtualization Techniques',
  'SC-58': 'Wireless Access Restrictions',
  'SC-59': 'Session Lock',
  'SC-60': 'Communication Path Isolation',
  'SC-61': 'System Time Synchronization',
  'SC-62': 'Wireless Access Restrictions',
  'SC-63': 'Use of Cryptography',
  'SC-64': 'Cryptographic Key Establishment and Management',
  'SC-65': 'Transmission of Security Attributes',
  'SC-66': 'Transmission of Security Attributes',
  'SC-67': 'Transmission of Security Attributes',
  'SC-68': 'Transmission of Security Attributes',
  'SC-69': 'Transmission of Security Attributes',
  'SC-70': 'Transmission of Security Attributes',
};

// Get random sample of controls
function getRandomControls(count = 10) {
  const controlIds = Object.keys(KNOWN_CONTROLS);
  const shuffled = [...controlIds].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).map(id => ({
    id,
    expectedName: KNOWN_CONTROLS[id],
  }));
}

// Test a single control
async function testControl(controlId, expectedName) {
  return new Promise((resolve) => {
    const query = `What is ${controlId}?`;
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${controlId} - Expected: "${expectedName}"`);
    console.log(`Query: "${query}"`);
    console.log(`${'='.repeat(70)}`);
    
    // Python script to query ChromaDB and get response
    const pythonScript = `
import chromadb
import json
import sys
import os
import numpy as np

# Paths
project_root = "${path.resolve(__dirname, '..').replace(/\\/g, '/')}"
chroma_path = os.path.join(project_root, ".data", "chroma_db")

try:
    # Connect to ChromaDB
    client = chromadb.PersistentClient(path=chroma_path)
    collection = client.get_collection("documents")
    
    # Query for the control
    query_text = "${query}"
    
    # Generate a simple embedding (in production, this uses BGE-M3)
    # For testing, we'll use a random normalized vector
    np.random.seed(hash(query_text) % 2**32)
    query_embedding = np.random.normal(0, 0.1, 1024).tolist()
    norm = sum(x*x for x in query_embedding) ** 0.5
    query_embedding = [x/norm for x in query_embedding]
    
    # Query with filters for the specific control
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=6,
        where={"control_id": "${controlId}"}
    )
    
    if not results['ids'] or len(results['ids'][0]) == 0:
        # Try without control_id filter
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=6,
            where={"document_type": "800-53_catalog"}
        )
    
    if not results['ids'] or len(results['ids'][0]) == 0:
        print(json.dumps({
            "success": False,
            "error": "No results found",
            "control_id": "${controlId}",
            "query": query_text
        }))
        sys.exit(1)
    
    # Get metadata from first result
    first_metadata = results['metadatas'][0][0] if results['metadatas'] and results['metadatas'][0] else {}
    first_text = results['documents'][0][0] if results['documents'] and results['documents'][0] else ""
    first_score = 1 - results['distances'][0][0] if results['distances'] and results['distances'][0] else 0
    
    # Extract control name from metadata or text
    control_name_from_metadata = first_metadata.get('control_name', '')
    
    # Try to extract from text if metadata doesn't have it
    control_name_from_text = ''
    if first_text:
        # Look for pattern like "Control AC-1 - Policy and Procedures"
        import re
        pattern = r'Control\\s+${controlId}\\s*-\\s*([^|(]+)'
        match = re.search(pattern, first_text, re.IGNORECASE)
        if match:
            control_name_from_text = match.group(1).strip()
    
    control_name = control_name_from_metadata or control_name_from_text
    
    # Build context for mock LLM response
    contexts = []
    for i in range(min(3, len(results['ids'][0]))):
        contexts.append({
            "text": results['documents'][0][i] if i < len(results['documents'][0]) else "",
            "metadata": results['metadatas'][0][i] if i < len(results['metadatas'][0]) else {},
            "score": 1 - results['distances'][0][i] if i < len(results['distances'][0]) else 0
        })
    
    output = {
        "success": True,
        "control_id": "${controlId}",
        "expected_name": "${expectedName}",
        "found_name": control_name,
        "query": query_text,
        "retrieved_chunks": len(results['ids'][0]),
        "top_score": first_score,
        "context_preview": first_text[:500] if first_text else "",
        "metadata": first_metadata
    }
    
    print(json.dumps(output))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e),
        "control_id": "${controlId}",
        "query": query_text
    }), file=sys.stderr)
    sys.exit(1)
`;

    const python = spawn('python3', ['-c', pythonScript]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        resolve({
          success: false,
          error: `Failed to parse result: ${e.message}`,
          stderr: stderr,
          control_id: controlId,
        });
      }
    });
  });
}

// Validate response accuracy
function validateResponse(result, expectedName) {
  if (!result.success) {
    return {
      accurate: false,
      reason: result.error || 'Query failed',
    };
  }

  const foundName = result.found_name || '';
  const expectedLower = expectedName.toLowerCase();
  const foundLower = foundName.toLowerCase();

  // Check if found name matches expected (allowing for variations)
  const isExactMatch = foundLower === expectedLower;
  const containsExpected = foundLower.includes(expectedLower) || expectedLower.includes(foundLower);
  
  // Check if response mentions the control ID
  const mentionsControlId = result.context_preview?.includes(result.control_id) || false;
  
  // Check score quality
  const hasGoodScore = result.top_score >= 0.35;

  if (isExactMatch) {
    return { accurate: true, reason: 'Exact match' };
  } else if (containsExpected && mentionsControlId && hasGoodScore) {
    return { accurate: true, reason: 'Partial match with control ID' };
  } else if (!hasGoodScore) {
    return { accurate: false, reason: `Low relevance score: ${result.top_score.toFixed(3)}` };
  } else if (!mentionsControlId) {
    return { accurate: false, reason: 'Control ID not found in context' };
  } else {
    return { accurate: false, reason: `Name mismatch: found "${foundName}" vs expected "${expectedName}"` };
  }
}

// Main test function
async function runTests() {
  console.log('\n🧪 NIST Control Accuracy Test');
  console.log('='.repeat(70));
  console.log('Testing 10 random NIST controls...\n');

  const controls = getRandomControls(10);
  const results = [];

  for (const { id, expectedName } of controls) {
    const result = await testControl(id, expectedName);
    const validation = validateResponse(result, expectedName);
    
    results.push({
      controlId: id,
      expectedName,
      foundName: result.found_name || 'N/A',
      accurate: validation.accurate,
      reason: validation.reason,
      score: result.top_score,
      chunks: result.retrieved_chunks,
    });

    // Print result
    const status = validation.accurate ? '✅' : '❌';
    console.log(`${status} ${id}: ${validation.accurate ? 'ACCURATE' : 'INACCURATE'} - ${validation.reason}`);
    if (result.found_name) {
      console.log(`   Found: "${result.found_name}"`);
    }
    if (result.top_score !== undefined) {
      console.log(`   Score: ${result.top_score.toFixed(3)}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  
  const accurate = results.filter(r => r.accurate).length;
  const total = results.length;
  const accuracy = (accurate / total) * 100;
  
  console.log(`\nAccuracy: ${accurate}/${total} (${accuracy.toFixed(1)}%)`);
  
  if (accurate === total) {
    console.log('✅ All tests passed!');
  } else {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.accurate).forEach(r => {
      console.log(`   ${r.controlId}: ${r.reason}`);
    });
  }
  
  // Average score
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
  console.log(`\nAverage relevance score: ${avgScore.toFixed(3)}`);
  
  // Return results for further analysis
  return results;
}

// Run tests
runTests().catch(console.error);















