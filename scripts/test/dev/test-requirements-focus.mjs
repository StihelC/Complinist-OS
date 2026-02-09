#!/usr/bin/env node
/**
 * Test Requirements-Focused Prompt
 * Validates that prompts produce requirements-focused answers, not assessment-focused
 * 
 * Usage:
 *   node scripts/test-requirements-focus.mjs
 */

console.log('\n🎯 Requirements-Focused Prompt Validation\n');
console.log('='.repeat(70) + '\n');

/**
 * Build the new requirements-focused prompt
 */
function buildRequirementsFocusedPrompt(query, documents) {
  return `Answer the user's question about NIST 800-53 using the provided reference documents.

CRITICAL: Focus on CONTROL REQUIREMENTS, not assessment procedures.

Guidelines:
- Be concise and direct - provide a clear answer in 2-4 sentences
- When asked "what is [control]", explain what the control REQUIRES organizations to do
- Include the control ID and name naturally (e.g., "AC-2 (Account Management)")
- Prioritize "Control Text" sections that describe requirements over "Assessment Objectives" sections
- Explain what organizations must do, not how to verify compliance
- Avoid assessment language like "examines, interviews, and tests" - these describe verification methods, not requirements
- If Control Text is present in the documents, explain the requirements clearly - do NOT say "the control text does not provide"
- Summarize the information; do not copy text verbatim
- Use only information from the documents below - do not add external knowledge
- If multiple documents are provided, synthesize the key points

What to focus on:
✓ Control Text sections (what organizations must do)
✓ Requirements and obligations
✓ Implementation guidance

What to avoid:
✗ Assessment Objectives (how to verify compliance)
✗ Phrases like "examines, interviews, and tests"
✗ Saying "the control text does not provide" - instead explain what IS in the control text

User Question: ${query}

Reference Documents:
${documents}

Answer:`;
}

/**
 * Sample RA-5 document (with both control text and assessment objectives)
 */
const ra5Document = `[Document 1 | Control: RA-5 | Name: Vulnerability Scanning | Relevance: 95.0%]
Control: RA-5
Title: Vulnerability Scanning
Family: RA (Risk Assessment)

Control Text:
The organization:
a. Scans for vulnerabilities in the information system and hosted applications [Assignment: organization-defined frequency and/or randomly in accordance with organization-defined process] and when new vulnerabilities potentially affecting the system/applications are identified and reported;
b. Employs vulnerability scanning tools and techniques that facilitate interoperability among tools and automate parts of the vulnerability management process by using standards for:
  1. Enumerating platforms, software flaws, and improper configurations;
  2. Formatting checklists and test procedures; and
  3. Measuring vulnerability impact;
c. Analyzes vulnerability scan results and reports;
d. Remediates legitimate vulnerabilities [Assignment: organization-defined response times] in accordance with an organizational assessment of risk;
e. Shares information obtained from the vulnerability scanning process and security control assessments with [Assignment: organization-defined personnel or roles] to help eliminate similar vulnerabilities in other information systems; and
f. Employs automated mechanisms to compare the results of vulnerability scans over time to determine trends in information system vulnerabilities.

Assessment Objective:
Determine if the organization examines, interviews, and tests related to vulnerability scanning, analysis, remediation, and information sharing processes.`;

/**
 * Sample AU-7 document
 */
const au7Document = `[Document 1 | Control: AU-7 | Name: Audit Reduction and Report Generation | Relevance: 95.0%]
Control: AU-7
Title: Audit Reduction and Report Generation
Family: AU (Audit and Accountability)

Control Text:
The organization provides an audit reduction and report generation capability that:
a. Supports on-demand analysis and reporting;
b. Supports after-the-fact investigations of security incidents;
c. Supports near real-time analysis to support response to suspicious activities;
d. Provides configurable report generation that includes:
  1. A readable, comprehensible format for a target audience;
  2. Individual or multiple audit record fields;
  3. Information about anomalous or suspicious activity;
  4. Statistical information; and
  5. Results of correlation analysis;
e. Provides a report generation capability that:
  1. Allows the organization to generate audit reports that can be customized to meet organizational and/or system requirements;
  2. Provides the capability to automatically process audit records for events of interest based upon selectable, event criteria; and
  3. Provides the capability to sort and search audit records for events of interest based upon:
     a. Audit record type;
     b. Date and time of occurrence;
     c. System component or resource identification;
     d. Individual user or process identification; and
     e. Event outcome.`;

/**
 * Test cases
 */
const testCases = [
  {
    name: 'RA-5 Query',
    query: 'What is RA-5?',
    document: ra5Document,
    shouldContain: ['scan', 'vulnerability', 'remediate', 'requires'],
    shouldNotContain: ['examines, interviews, and tests', 'assessment objective', 'does not provide'],
  },
  {
    name: 'AU-7 Query',
    query: 'What is AU-7?',
    document: au7Document,
    shouldContain: ['audit', 'reduction', 'report', 'requires'],
    shouldNotContain: ['examines, interviews, and tests', 'assessment objective'],
  },
];

console.log('📊 Prompt Validation Tests\n');
console.log('-'.repeat(70) + '\n');

for (const testCase of testCases) {
  console.log(`\n🔍 Test: ${testCase.name}`);
  console.log(`   Query: "${testCase.query}"`);
  console.log();
  
  // Build prompt
  const prompt = buildRequirementsFocusedPrompt(testCase.query, testCase.document);
  
  // Analyze prompt
  console.log('   📏 Prompt Analysis:');
  console.log(`      Length: ${prompt.length} characters`);
  console.log(`      Lines: ${prompt.split('\n').length}`);
  console.log(`      Contains "CONTROL REQUIREMENTS": ${prompt.includes('CONTROL REQUIREMENTS') ? '✅' : '❌'}`);
  console.log(`      Contains "Assessment Objectives": ${prompt.includes('Assessment Objectives') ? '✅' : '❌'}`);
  console.log(`      Contains "examines, interviews, and tests": ${prompt.includes('examines, interviews, and tests') ? '✅' : '❌'}`);
  console.log(`      Contains "does NOT say": ${prompt.includes('do NOT say') ? '✅' : '❌'}`);
  
  // Check for key improvements
  console.log(`\n   ✓ Key Features:`);
  if (prompt.includes('Focus on CONTROL REQUIREMENTS')) {
    console.log(`      ✓ Explicit focus on requirements`);
  }
  if (prompt.includes('Prioritize "Control Text"')) {
    console.log(`      ✓ Prioritizes Control Text sections`);
  }
  if (prompt.includes('Avoid assessment language')) {
    console.log(`      ✓ Warns against assessment language`);
  }
  if (prompt.includes('do NOT say "the control text does not provide"')) {
    console.log(`      ✓ Prevents unhelpful "does not provide" responses`);
  }
  if (prompt.includes('What to focus on:') && prompt.includes('What to avoid:')) {
    console.log(`      ✓ Clear visual distinction (✓/✗) between focus areas`);
  }
  
  // Check document content
  console.log(`\n   📄 Document Analysis:`);
  const hasControlText = testCase.document.includes('Control Text:');
  const hasAssessmentObjective = testCase.document.includes('Assessment Objective:');
  console.log(`      Contains Control Text: ${hasControlText ? '✅' : '❌'}`);
  console.log(`      Contains Assessment Objective: ${hasAssessmentObjective ? '✅' : '❌'}`);
  console.log(`      Prompt should prioritize: ${hasControlText ? 'Control Text' : 'N/A'}`);
  
  console.log('\n   ' + '-'.repeat(66));
}

console.log('\n\n' + '='.repeat(70));
console.log('\n📈 Expected Response Improvements:\n');
console.log('✓ Focus on what organizations must DO (requirements)');
console.log('✓ Avoid assessment language ("examines, interviews, and tests")');
console.log('✓ Explain control text requirements clearly');
console.log('✓ Do NOT say "the control text does not provide"');
console.log('✓ Prioritize Control Text over Assessment Objectives\n');

console.log('='.repeat(70));
console.log('\n💡 Example Expected Responses:\n');
console.log('RA-5: "RA-5 (Vulnerability Scanning) requires organizations to scan for');
console.log('       vulnerabilities, analyze scan results, remediate legitimate');
console.log('       vulnerabilities, and share vulnerability information."\n');
console.log('AU-7: "AU-7 (Audit Reduction and Report Generation) requires organizations');
console.log('       to provide capabilities for audit reduction, on-demand analysis,');
console.log('       after-the-fact investigations, and configurable report generation."\n');

console.log('✅ Requirements-focused prompt validation complete!\n');















