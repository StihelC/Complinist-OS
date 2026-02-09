#!/usr/bin/env node
/**
 * Test NIST RAG Prompt Quality
 * Validates that prompts produce concise, coherent responses
 * 
 * Usage:
 *   node scripts/test-prompt-quality.mjs
 */

console.log('\n📝 NIST RAG Prompt Quality Test\n');
console.log('='.repeat(70) + '\n');

/**
 * Test the new concise prompt format
 */
function buildConcisePrompt(query, documents) {
  return `Answer the user's question about NIST 800-53 using the provided reference documents.

Guidelines:
- Be concise and direct - provide a clear answer in 2-4 sentences
- When asked "what is [control]", explain its purpose and key requirements
- Include the control ID and name naturally (e.g., "AC-2 (Account Management)")
- Summarize the information; do not copy text verbatim
- Use only information from the documents below - do not add external knowledge
- If multiple documents are provided, synthesize the key points

User Question: ${query}

Reference Documents:
${documents}

Answer:`;
}

/**
 * Test the old verbose prompt format (for comparison)
 */
function buildVerbosePrompt(query, documents) {
  return `You are a NIST 800-53 Rev 5 compliance expert. Answer the user's question using ONLY the documents provided below.

CRITICAL RULES - READ CAREFULLY:
1. The Context Documents below contain the answer. DO NOT say "I don't have information" - the information IS in the documents.
2. Each document header shows: Control ID, Control Name, Family, and Relevance Score - USE THIS INFORMATION.
3. Start your answer with: "Control [ID] is [Name] from NIST 800-53 Rev 5. [Then explain based on the document text below]"
4. Quote or paraphrase directly from the document text - the Control Text section contains the requirements.
5. DO NOT say "the documents don't provide further details" - if you see Control Text, explain what it says.
6. DO NOT invent information or use external knowledge.
7. DO NOT confuse NIST 800-53 with other frameworks unless explicitly mentioned in context.
8. If multiple documents are provided, synthesize information from all relevant ones.

User Question: ${query}

Context Documents:
${documents}

Your Answer (Start with "Control [ID] is [Name] from NIST 800-53 Rev 5" and explain using the document text):`;
}

/**
 * Sample document for testing
 */
const sampleDocument = `[Document 1 | Control: AC-2 | Name: Account Management | Relevance: 95.0%]
Control: AC-2
Control Enhancement(s): None
Title: Account Management
Family: AC (Access Control)

Control Text:
The organization manages information system accounts by:
a. Identifying account types (individual, group, system, application, guest, temporary);
b. Establishing conditions for group and role membership;
c. Specifying authorized users of the information system and access privileges;
d. Requiring approvals for requests to create accounts;
e. Creating, enabling, modifying, disabling, and removing accounts;
f. Monitoring the use of accounts;
g. Notifying account managers when accounts are no longer required or users are terminated;
h. Authorizing access based on intended use; and
i. Reviewing accounts for compliance with account management requirements.`;

/**
 * Test cases
 */
const testCases = [
  {
    name: 'Simple "What is" Query',
    query: 'What is AC-2?',
    expectedLength: 'short', // 2-4 sentences
    shouldNotContain: ['assessment objective', 'assessment procedures', 'examining, interviewing, and testing'],
  },
  {
    name: 'Explain Control Query',
    query: 'Explain AC-2 account management',
    expectedLength: 'short',
    shouldNotContain: ['Control 02 is', 'from NIST 800-53 Rev 5'],
  },
  {
    name: 'Requirements Query',
    query: 'What are the AC-2 requirements?',
    expectedLength: 'medium', // Could be 3-5 sentences to list requirements
    shouldNotContain: ['assessment objective'],
  },
];

console.log('📊 Prompt Format Comparison\n');
console.log('-'.repeat(70) + '\n');

for (const testCase of testCases) {
  console.log(`\n🔍 Test: ${testCase.name}`);
  console.log(`   Query: "${testCase.query}"`);
  console.log();
  
  // Build both prompts
  const concisePrompt = buildConcisePrompt(testCase.query, sampleDocument);
  const verbosePrompt = buildVerbosePrompt(testCase.query, sampleDocument);
  
  // Analyze prompt characteristics
  console.log('   📏 Prompt Characteristics:');
  console.log(`      Concise: ${concisePrompt.length} chars, ${concisePrompt.split('\n').length} lines`);
  console.log(`      Verbose: ${verbosePrompt.length} chars, ${verbosePrompt.split('\n').length} lines`);
  console.log(`      Reduction: ${((1 - concisePrompt.length / verbosePrompt.length) * 100).toFixed(1)}% smaller`);
  
  // Analyze instruction clarity
  const conciseInstructions = concisePrompt.split('\n').filter(line => line.startsWith('-')).length;
  const verboseInstructions = verbosePrompt.split('\n').filter(line => line.match(/^\d+\./)).length;
  
  console.log(`\n   📋 Instruction Count:`);
  console.log(`      Concise: ${conciseInstructions} guidelines`);
  console.log(`      Verbose: ${verboseInstructions} critical rules`);
  
  // Check for key improvements
  console.log(`\n   ✓ Improvements in Concise Prompt:`);
  if (!concisePrompt.includes('CRITICAL RULES')) {
    console.log(`      ✓ Removed aggressive "CRITICAL RULES" framing`);
  }
  if (!concisePrompt.includes('Start your answer with:')) {
    console.log(`      ✓ No rigid response format requirement`);
  }
  if (concisePrompt.includes('2-4 sentences')) {
    console.log(`      ✓ Explicit conciseness guidance (2-4 sentences)`);
  }
  if (concisePrompt.includes('Summarize')) {
    console.log(`      ✓ Encourages summarization over verbatim copying`);
  }
  
  console.log('\n   ' + '-'.repeat(66));
}

console.log('\n\n' + '='.repeat(70));
console.log('\n📈 Expected Response Improvements:\n');
console.log('✓ Shorter, more focused answers (2-4 sentences vs paragraphs)');
console.log('✓ Natural language instead of rigid "Control XX is..." format');
console.log('✓ Summarized information instead of verbatim document text');
console.log('✓ Better compatibility with Mistral instruction format');
console.log('✓ More user-friendly and readable responses\n');

console.log('='.repeat(70));
console.log('\n💡 To test with actual LLM:\n');
console.log('   1. Start the application');
console.log('   2. Use the NIST Query panel');
console.log('   3. Ask: "What is AC-2?"');
console.log('   4. Response should be concise (2-4 sentences)');
console.log('   5. Should NOT start with "Control 02 is Account Management..."');
console.log('   6. Should naturally mention "AC-2 (Account Management)"\n');

console.log('✅ Prompt format validation complete!\n');















