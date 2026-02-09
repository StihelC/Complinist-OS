/**
 * AI Narrative Enhancer
 *
 * Batch-enhances control narratives using AI based on topology context.
 * Generates control-family-specific implementation statements that reference
 * actual system components.
 */

import type { AppNode, AppEdge, DeviceNodeData } from '@/lib/utils/types';

export interface TopologyContext {
  devices: Array<{
    name: string;
    type: string;
    subtype?: string;
  }>;
  boundaries: Array<{
    name: string;
  }>;
  connections: number;
  devicesByType: Record<string, string[]>;
}

export interface EnhancedNarratives {
  [controlFamily: string]: string;
}

/**
 * Extract topology context for AI prompt
 */
export function extractTopologyContextForAI(nodes: AppNode[], edges: AppEdge[]): TopologyContext {
  const deviceNodes = nodes.filter(n => n.type === 'device' || !n.type);
  const boundaryNodes = nodes.filter(n => n.type === 'boundary');

  const devices = deviceNodes.map(node => {
    const data = node.data as DeviceNodeData;
    return {
      name: data?.name || data?.hostname || node.id,
      type: data?.deviceType || 'unknown',
      subtype: data?.deviceSubtype || undefined,
    };
  });

  const boundaries = boundaryNodes.map(n => {
    const data = n.data as { label?: string; name?: string };
    return {
      name: data?.label || data?.name || n.id,
    };
  });

  const devicesByType: Record<string, string[]> = {};
  devices.forEach(d => {
    if (!devicesByType[d.type]) devicesByType[d.type] = [];
    devicesByType[d.type].push(d.name);
  });

  return {
    devices,
    boundaries,
    connections: edges.length,
    devicesByType,
  };
}

/**
 * Build the AI prompt for narrative enhancement
 * Keep prompt concise to avoid context length issues
 */
function buildEnhancementPrompt(context: TopologyContext): string {
  // Limit devices to first 10 to keep prompt size manageable
  const topDevices = context.devices.slice(0, 10);
  const deviceList = topDevices
    .map(d => `${d.name} (${d.type})`)
    .join(', ');

  const moreDevices = context.devices.length > 10
    ? ` and ${context.devices.length - 10} more`
    : '';

  const boundaryList = context.boundaries.length > 0
    ? context.boundaries.map(b => b.name).join(', ')
    : 'none defined';

  // Get key device types
  const firewalls = context.devicesByType['firewall'] || [];
  const servers = context.devicesByType['server'] || [];
  const databases = context.devicesByType['database'] || [];

  return `Generate NIST 800-53 SSP implementation narratives for this system topology.

TOPOLOGY:
- Devices (${context.devices.length}): ${deviceList}${moreDevices}
- Boundaries: ${boundaryList}
- Connections: ${context.connections}
${firewalls.length > 0 ? `- Firewalls: ${firewalls.join(', ')}` : ''}
${servers.length > 0 ? `- Servers: ${servers.join(', ')}` : ''}
${databases.length > 0 ? `- Databases: ${databases.join(', ')}` : ''}

TASK: Write 2-sentence narratives for each control family. MUST reference actual device/boundary names above.

Return JSON only:
{"AC":"Access control narrative using device names...","AU":"Audit narrative...","CA":"...","CM":"...","CP":"...","IA":"...","IR":"...","MA":"...","MP":"...","PE":"...","PL":"...","PS":"...","RA":"...","SA":"...","SC":"...","SI":"...","SR":"..."}`;
}

/**
 * Parse the AI response into structured narratives
 */
function parseAIResponse(response: string): EnhancedNarratives | null {
  console.log('[NarrativeEnhancer] Attempting to parse response:', response.substring(0, 1000));

  try {
    // Try to extract JSON from the response - look for object pattern
    let jsonMatch = response.match(/\{[\s\S]*\}/);

    // If no match, try to find JSON after common prefixes
    if (!jsonMatch) {
      // Sometimes the model adds text before JSON
      const jsonStart = response.indexOf('{');
      if (jsonStart !== -1) {
        const possibleJson = response.substring(jsonStart);
        jsonMatch = possibleJson.match(/\{[\s\S]*\}/);
      }
    }

    if (!jsonMatch) {
      console.error('[NarrativeEnhancer] No JSON found in response. Full response:', response);

      // Try to extract narratives from non-JSON format (e.g., "AC: narrative text")
      const fallbackResult = parseNonJsonResponse(response);
      if (fallbackResult) {
        console.log('[NarrativeEnhancer] Parsed using fallback method');
        return fallbackResult;
      }
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate that we have the expected structure
    const expectedFamilies = ['AC', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP', 'PE', 'PL', 'PS', 'RA', 'SA', 'SC', 'SI', 'SR'];
    const result: EnhancedNarratives = {};

    for (const family of expectedFamilies) {
      if (parsed[family] && typeof parsed[family] === 'string') {
        result[family] = parsed[family];
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('[NarrativeEnhancer] Failed to parse AI response:', error);
    console.error('[NarrativeEnhancer] Raw response was:', response);

    // Try fallback parsing
    const fallbackResult = parseNonJsonResponse(response);
    if (fallbackResult) {
      console.log('[NarrativeEnhancer] Parsed using fallback method after JSON error');
      return fallbackResult;
    }
    return null;
  }
}

/**
 * Fallback parser for non-JSON responses
 * Handles formats like "AC: narrative text" or "AC - narrative text"
 */
function parseNonJsonResponse(response: string): EnhancedNarratives | null {
  const families = ['AC', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP', 'PE', 'PL', 'PS', 'RA', 'SA', 'SC', 'SI', 'SR'];
  const result: EnhancedNarratives = {};

  for (const family of families) {
    // Match patterns like "AC:" or "AC -" or "AC =" followed by text
    const patterns = [
      new RegExp(`"?${family}"?\\s*[:\\-=]\\s*"?([^"\\n]+(?:"[^"]*"[^"\\n]*)*)`, 'i'),
      new RegExp(`\\*\\*${family}\\*\\*[:\\-]?\\s*([^\\n]+)`, 'i'),
      new RegExp(`${family}[:\\s]+([^\\n]{20,})`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        let narrative = match[1].trim();
        // Clean up quotes and trailing punctuation
        narrative = narrative.replace(/^["']|["']$/g, '').trim();
        if (narrative.length > 20) { // Only accept if it's a real narrative
          result[family] = narrative;
          break;
        }
      }
    }
  }

  return Object.keys(result).length >= 5 ? result : null; // Need at least 5 families
}

/**
 * Enhance control narratives using AI
 *
 * @param nodes - Topology nodes
 * @param edges - Topology edges
 * @returns Enhanced narratives keyed by control family, or null if enhancement fails
 */
export async function enhanceNarrativesWithAI(
  nodes: AppNode[],
  edges: AppEdge[]
): Promise<EnhancedNarratives | null> {
  // Check if AI is available
  if (!window.electronAPI?.llmGenerate) {
    console.error('[NarrativeEnhancer] LLM API not available');
    return null;
  }

  const context = extractTopologyContextForAI(nodes, edges);

  // Don't proceed if there's no topology to work with
  if (context.devices.length === 0 && context.boundaries.length === 0) {
    console.warn('[NarrativeEnhancer] No topology data available for enhancement');
    return null;
  }

  const prompt = buildEnhancementPrompt(context);

  try {
    console.log('[NarrativeEnhancer] Requesting AI enhancement...');
    console.log('[NarrativeEnhancer] Topology context:', {
      deviceCount: context.devices.length,
      devices: context.devices.map(d => `${d.name} (${d.type})`),
      boundaryCount: context.boundaries.length,
      boundaries: context.boundaries.map(b => b.name),
      connections: context.connections,
    });

    const response = await window.electronAPI.llmGenerate({
      prompt,
      maxTokens: 4000,
      temperature: 0.3, // Lower temperature for more consistent output
    });

    // Handle the IPC response structure: { success, data } or { success, error }
    if (!response?.success) {
      const errorMsg = response?.error || 'Unknown error';
      console.error('[NarrativeEnhancer] LLM request failed:', errorMsg);

      // Provide more helpful error messages
      if (errorMsg.includes('context') || errorMsg.includes('dispose')) {
        throw new Error('AI service encountered a memory error. Try restarting the application.');
      } else if (errorMsg.includes('not initialized')) {
        throw new Error('AI service is not running. Please wait for it to initialize or restart the application.');
      }
      throw new Error(`AI generation failed: ${errorMsg}`);
    }

    const responseText = response.data?.text || response.data;
    if (!responseText || typeof responseText !== 'string') {
      console.error('[NarrativeEnhancer] Empty or invalid response from LLM:', response);
      return null;
    }

    console.log('[NarrativeEnhancer] Raw LLM response length:', responseText.length);
    console.log('[NarrativeEnhancer] Response preview:', responseText.substring(0, 500));

    const narratives = parseAIResponse(responseText);

    if (narratives) {
      console.log('[NarrativeEnhancer] Successfully enhanced', Object.keys(narratives).length, 'control families');
      // Log a sample to verify device names are included
      const sampleFamily = Object.keys(narratives)[0];
      if (sampleFamily) {
        console.log(`[NarrativeEnhancer] Sample (${sampleFamily}):`, narratives[sampleFamily]);
      }
    } else {
      console.error('[NarrativeEnhancer] Failed to parse narratives from response');
    }

    return narratives;
  } catch (error) {
    console.error('[NarrativeEnhancer] AI enhancement failed:', error);
    return null;
  }
}

/**
 * Get the enhanced narrative for a specific control
 * Falls back to null if no enhancement exists for that family
 */
export function getEnhancedNarrative(
  controlId: string,
  enhancedNarratives: EnhancedNarratives | null
): string | null {
  if (!enhancedNarratives) return null;

  const family = controlId.split('-')[0].toUpperCase();
  return enhancedNarratives[family] || null;
}
