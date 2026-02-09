/**
 * ELI5 (Explain Like I'm 5) Prompt Templates
 *
 * Redesigned to use real-world analogies before technical mappings.
 * Pattern:
 * 1. Analogy (2-3 sentences): Relatable real-world comparison
 * 2. Technical Mapping (1-2 sentences): How the analogy maps to IT/security
 * 3. Simple Example (optional): Concrete scenario
 *
 * Based on feature request for analogy-first explanation mode.
 */

import type { ControlSectionType } from '../promptTemplates';

/**
 * Control family analogies for generating relatable explanations
 * Each family has a core metaphor that relates to everyday concepts
 */
export const CONTROL_FAMILY_ANALOGIES: Record<string, string> = {
  AC: 'controlling who can enter different rooms in your house',
  AT: 'teaching family members about home safety rules',
  AU: 'keeping a diary of who came and went from your house',
  CA: 'having a home inspector check if everything is safe',
  CM: 'keeping a list of everything in your house and its settings',
  CP: 'having a plan for what to do if there is a fire or flood',
  IA: 'checking IDs at the front door before letting someone in',
  IR: 'knowing what to do when something goes wrong',
  MA: 'regular maintenance checks like you do on your car',
  MP: 'protecting your photo albums and important documents',
  PE: 'physical locks, fences, and security cameras',
  PL: 'making plans and rules for keeping your house safe',
  PM: 'the overall management of your household security',
  PS: 'background checks before hiring a babysitter',
  PT: 'being open about what personal info you collect about visitors',
  RA: 'walking around your house to find potential dangers',
  SA: 'buying safe products and checking they work properly',
  SC: 'protecting messages and secrets when sending them',
  SI: 'detecting and removing viruses or pests from your house',
  SR: 'making sure the products you buy are genuine and safe',
};

/**
 * Common control analogies for specific controls
 * Provides more targeted analogies for frequently queried controls
 */
export const SPECIFIC_CONTROL_ANALOGIES: Record<string, {
  analogy: string;
  technicalMapping: string;
  simpleExample?: string;
}> = {
  'AC-1': {
    analogy: 'Think of this like having house rules written down about who can come in, when they can visit, and what rooms they can access.',
    technicalMapping: 'In IT, this means having written policies about who can access which systems and how those access decisions are made.',
    simpleExample: 'Like posting a sign that says "Family only in bedrooms, guests stay in living room."',
  },
  'AC-2': {
    analogy: 'This is like keeping a guest list for your house - tracking who has keys, updating the list when people move in or out, and checking it regularly.',
    technicalMapping: 'In computers, this means managing user accounts: creating them for new employees, removing them when people leave, and reviewing who has access.',
    simpleExample: 'Just like you would take back a key from a roommate who moves out.',
  },
  'AC-3': {
    analogy: 'Imagine different locks on different doors in your house - kids can open the playroom, but only parents can open the medicine cabinet.',
    technicalMapping: 'This means systems check if you are allowed to access something before letting you in, based on your role or identity.',
  },
  'AC-6': {
    analogy: 'Like giving the babysitter only the keys they need - just the front door, not your safe or home office.',
    technicalMapping: 'Users should only have access to what they need for their job, nothing more.',
  },
  'AU-2': {
    analogy: 'This is like having security cameras that record when people enter, what rooms they visit, and when they leave.',
    technicalMapping: 'Systems must keep logs of important events like logins, file access, and system changes.',
  },
  'AU-6': {
    analogy: 'Like watching your security camera footage regularly to spot anything unusual, not just installing cameras and forgetting about them.',
    technicalMapping: 'Security teams must regularly review system logs to detect suspicious activity or policy violations.',
  },
  'CA-7': {
    analogy: 'Like having a home monitoring service that constantly checks if your doors are locked and alarms are working, not just checking once a year.',
    technicalMapping: 'Continuous monitoring means constantly watching your security controls to make sure they are working, not just during annual audits.',
  },
  'CM-2': {
    analogy: 'This is like having a photo of exactly how your house should be set up - where furniture goes, what is in each room - so you can tell if something is out of place.',
    technicalMapping: 'A baseline configuration documents exactly how systems should be set up, so you can detect unauthorized changes.',
  },
  'CM-6': {
    analogy: 'Like making sure all your smoke detectors are set to the recommended sensitivity, not too sensitive or not sensitive enough.',
    technicalMapping: 'Configuration settings ensure systems are set up securely according to best practices.',
  },
  'CP-9': {
    analogy: 'Like making copies of your important family photos and storing them at grandma\'s house in case of a fire.',
    technicalMapping: 'Regular backups ensure you can recover your data if systems fail or are attacked.',
  },
  'IA-2': {
    analogy: 'Like requiring guests to show ID and answer a secret question only they would know before you let them in.',
    technicalMapping: 'Users must prove who they are (authentication) before accessing systems, often using passwords plus a second factor like a phone code.',
  },
  'IA-5': {
    analogy: 'Like having rules for your house keys - don\'t make copies without permission, don\'t leave them under the doormat, change the locks periodically.',
    technicalMapping: 'Managing authenticators means having policies for passwords and tokens: how strong they must be, how often to change them, how to protect them.',
  },
  'IR-4': {
    analogy: 'Like having a plan for what to do if someone breaks into your house - call the police, secure valuables, document what happened, and fix the broken window.',
    technicalMapping: 'Incident handling means having procedures to detect, analyze, contain, and recover from security incidents.',
  },
  'RA-5': {
    analogy: 'Like having a home inspector regularly check for cracks in the foundation, loose railings, or faulty wiring before they become serious problems.',
    technicalMapping: 'Vulnerability scanning means regularly checking systems for security weaknesses that attackers could exploit.',
  },
  'SC-7': {
    analogy: 'Like having a fence around your yard with gates that check who can come in - keeping the public on the sidewalk while family can roam freely inside.',
    technicalMapping: 'Boundary protection means using firewalls and network controls to separate your systems from untrusted networks.',
  },
  'SC-8': {
    analogy: 'Like sending a letter in a locked box instead of a postcard - only the person with the key can read what is inside.',
    technicalMapping: 'Transmission confidentiality means encrypting data when it travels across networks so eavesdroppers cannot read it.',
  },
  'SC-13': {
    analogy: 'Like using a secret code when you send messages - only people who know the code can understand what you wrote.',
    technicalMapping: 'Cryptographic protection means using encryption to protect sensitive data from unauthorized access.',
  },
  'SI-2': {
    analogy: 'Like fixing a broken lock as soon as you discover it, not waiting until after someone breaks in.',
    technicalMapping: 'Flaw remediation means applying security patches and updates promptly when vulnerabilities are discovered.',
  },
  'SI-3': {
    analogy: 'Like having a guard dog that sniffs packages for anything dangerous before bringing them inside.',
    technicalMapping: 'Malicious code protection means using antivirus and anti-malware tools to detect and block harmful software.',
  },
  'SI-4': {
    analogy: 'Like having security cameras and alarm sensors in your house that watch for bad guys, tell you when something strange happens, and help you respond quickly.',
    technicalMapping: 'System monitoring means using tools like intrusion detection systems, security logs, and monitoring dashboards that alert you to suspicious activity.',
    simpleExample: 'If someone tries to pick a lock at 3 AM, the alarm goes off and you get a phone notification.',
  },
};

/**
 * ELI5 prompt context for generating simplified explanations
 */
export interface ELI5PromptContext {
  query: string;
  controlId?: string;
  controlName?: string;
  retrievedContext: Array<{
    text: string;
    sectionType?: ControlSectionType;
    documentType?: string;
    score?: number;
  }>;
}

/**
 * Build an ELI5 response structure for a control
 * @param controlId - The control ID (e.g., "SI-4")
 * @param controlFamily - The control family code (e.g., "SI")
 */
function getControlAnalogy(controlId: string, controlFamily: string): {
  analogy: string;
  technicalMapping: string;
  simpleExample?: string;
} | null {
  // Check for specific control analogy first
  if (SPECIFIC_CONTROL_ANALOGIES[controlId]) {
    return SPECIFIC_CONTROL_ANALOGIES[controlId];
  }

  // Fall back to family-level analogy
  if (CONTROL_FAMILY_ANALOGIES[controlFamily]) {
    return {
      analogy: `Think of ${controlFamily} controls like ${CONTROL_FAMILY_ANALOGIES[controlFamily]}.`,
      technicalMapping: 'The specific technical requirements will depend on the control details.',
    };
  }

  return null;
}

/**
 * Build an ELI5 prompt for NIST control queries
 * Uses analogy-first structure for simplified explanations
 *
 * @param context - Query context with retrieved RAG chunks
 * @returns Formatted prompt string
 */
export function buildELI5ControlPrompt(context: ELI5PromptContext): string {
  const { query, controlId, controlName, retrievedContext } = context;

  // Extract control family from control ID
  const controlFamily = controlId ? controlId.split('-')[0] : undefined;

  // Get pre-defined analogy if available
  const predefinedAnalogy = controlId && controlFamily
    ? getControlAnalogy(controlId, controlFamily)
    : null;

  // Build context from retrieved documents
  const contextSection = retrievedContext
    .map((ctx, i) => `[Source ${i + 1}]:\n${ctx.text}`)
    .join('\n\n---\n\n');

  const controlHeader = controlId
    ? `Control: ${controlId}${controlName ? ` - ${controlName}` : ''}`
    : '';

  // Build few-shot examples section
  const fewShotExamples = `
EXAMPLE 1:
Control: SI-4 (System Monitoring)
Query: What is SI-4?

ELI5 Response:
## Simple Explanation

**Analogy:** SI-4 is like having security cameras and alarm sensors in your house. They watch for bad guys, tell you when something strange happens, and help you respond quickly.

**In IT Terms:** This means using tools like intrusion detection systems, security logs, and monitoring dashboards that alert you to suspicious activity.

**Real Example:** Just like a home security system sends you a phone alert when someone approaches your door, SI-4 requires your computers to alert the security team when something unusual happens on the network.

---

EXAMPLE 2:
Control: AC-2 (Account Management)
Query: Explain AC-2 simply

ELI5 Response:
## Simple Explanation

**Analogy:** Think of this like keeping a guest list for your house - you track who has keys, update the list when people move in or out, and check it regularly to make sure only the right people have access.

**In IT Terms:** This means managing user accounts: creating them for new employees, removing them when people leave, and regularly reviewing who has access to what.

**Real Example:** When a coworker quits their job, their building badge stops working the same day - that is AC-2 in action.`;

  // Build the ELI5 prompt
  let prompt = `You are an expert at explaining complex security concepts in simple terms that anyone can understand.

${controlHeader}

YOUR TASK: Explain this NIST control using the "Explain Like I'm 5" (ELI5) format.

ELI5 RESPONSE FORMAT (follow this EXACTLY):
Your response MUST use this three-part structure:

## Simple Explanation

**Analogy:** Start with a relatable real-world comparison that anyone can understand (2-3 sentences). Use everyday concepts like houses, schools, or families.

**In IT Terms:** Briefly explain how the analogy maps to actual IT/security implementation (1-2 sentences).

**Real Example:** (Optional but recommended) Give a concrete scenario that makes it click.

CRITICAL INSTRUCTIONS:
- Lead with the ANALOGY first - this is the most important part
- Use simple, everyday language - avoid jargon
- Keep sentences short and clear
- Think about what a non-technical person (like a parent, teacher, or manager) would understand
- If you mention technical terms, immediately explain them in simple words
- Make the connection between the analogy and the technical reality clear`;

  // Add pre-defined analogy as guidance if available
  if (predefinedAnalogy) {
    prompt += `

SUGGESTED ANALOGY (use this or create a similar one):
Analogy: ${predefinedAnalogy.analogy}
Technical Mapping: ${predefinedAnalogy.technicalMapping}
${predefinedAnalogy.simpleExample ? `Example: ${predefinedAnalogy.simpleExample}` : ''}`;
  }

  // Add few-shot examples
  prompt += `

${fewShotExamples}

---

Reference Documents (use these for technical accuracy):
${contextSection}

User Question: ${query}

ELI5 Response:`;

  return prompt;
}

/**
 * ELI5 section headers for response parsing
 */
export const ELI5_SECTION_HEADERS = {
  simple_explanation: '## Simple Explanation',
  analogy: '**Analogy:**',
  in_it_terms: '**In IT Terms:**',
  real_example: '**Real Example:**',
} as const;

/**
 * Parse an ELI5 response into structured sections
 * @param response - Raw LLM response
 * @returns Parsed sections or null if parsing fails
 */
export function parseELI5Response(response: string): {
  analogy: string;
  technicalMapping: string;
  realExample?: string;
} | null {
  try {
    // Extract analogy section
    const analogyMatch = response.match(/\*\*Analogy:\*\*\s*(.+?)(?=\*\*In IT Terms:\*\*|\*\*Real Example:\*\*|$)/s);
    const analogy = analogyMatch ? analogyMatch[1].trim() : '';

    // Extract technical mapping section
    const techMatch = response.match(/\*\*In IT Terms:\*\*\s*(.+?)(?=\*\*Real Example:\*\*|$)/s);
    const technicalMapping = techMatch ? techMatch[1].trim() : '';

    // Extract optional real example section
    const exampleMatch = response.match(/\*\*Real Example:\*\*\s*(.+?)$/s);
    const realExample = exampleMatch ? exampleMatch[1].trim() : undefined;

    if (!analogy && !technicalMapping) {
      return null;
    }

    return {
      analogy,
      technicalMapping,
      realExample,
    };
  } catch {
    return null;
  }
}

export default {
  buildELI5ControlPrompt,
  parseELI5Response,
  CONTROL_FAMILY_ANALOGIES,
  SPECIFIC_CONTROL_ANALOGIES,
  ELI5_SECTION_HEADERS,
};
