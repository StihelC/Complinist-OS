/**
 * External ID Generator for Terraform Resources
 *
 * Generates deterministic external IDs for Terraform resources to enable
 * duplicate detection and resource tracking across import sessions.
 *
 * Format: provider:type:name:hash
 * Example: "hashicorp/aws:aws_instance:web_server:a1b2c3d4"
 */

import type { TerraformResourceChange } from '../terraformTypes';
import type { ExternalResourceId } from './types';

/**
 * Normalize provider name for consistent comparison
 * Examples:
 *   "registry.terraform.io/hashicorp/aws" → "hashicorp/aws"
 *   "hashicorp/aws" → "hashicorp/aws"
 *   "aws" → "hashicorp/aws"
 */
export function normalizeProviderName(providerName: string): string {
  // Remove registry prefix if present
  let normalized = providerName.replace(/^registry\.terraform\.io\//, '');

  // Handle short provider names (e.g., "aws" → "hashicorp/aws")
  if (!normalized.includes('/')) {
    // Common provider mappings
    const commonProviders: Record<string, string> = {
      aws: 'hashicorp/aws',
      azurerm: 'hashicorp/azurerm',
      google: 'hashicorp/google',
      kubernetes: 'hashicorp/kubernetes',
      helm: 'hashicorp/helm',
      null: 'hashicorp/null',
      random: 'hashicorp/random',
      local: 'hashicorp/local',
      template: 'hashicorp/template',
      tls: 'hashicorp/tls',
      archive: 'hashicorp/archive',
      external: 'hashicorp/external',
      time: 'hashicorp/time',
    };

    normalized = commonProviders[normalized] || `hashicorp/${normalized}`;
  }

  return normalized.toLowerCase();
}

/**
 * Generate a deterministic hash from the input components
 * Uses a simple string hash function for browser compatibility
 * Returns first 8 characters of the hex hash
 */
export function generateDeterministicHash(
  provider: string,
  type: string,
  name: string,
  moduleAddress?: string
): string {
  // Combine all components with a delimiter that won't appear in normal values
  const input = [provider, type, name, moduleAddress || ''].join('|');

  // Simple hash function (djb2 variant)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char; // hash * 33 XOR char
  }

  // Convert to unsigned 32-bit integer and then to hex
  const unsignedHash = hash >>> 0;
  const hexHash = unsignedHash.toString(16).padStart(8, '0');

  return hexHash;
}

/**
 * Generate a deterministic hash using Web Crypto API (async version)
 * More secure but requires async handling
 */
export async function generateDeterministicHashAsync(
  provider: string,
  type: string,
  name: string,
  moduleAddress?: string
): Promise<string> {
  const input = [provider, type, name, moduleAddress || ''].join('|');

  // Use Web Crypto API if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex.slice(0, 8);
  }

  // Fallback to sync version
  return generateDeterministicHash(provider, type, name, moduleAddress);
}

/**
 * Generate an external ID for a Terraform resource
 *
 * @param resource - The Terraform resource change object
 * @returns External resource ID with all components
 */
export function generateExternalId(resource: TerraformResourceChange): ExternalResourceId {
  const provider = normalizeProviderName(resource.provider_name);
  const hash = generateDeterministicHash(
    provider,
    resource.type,
    resource.name,
    resource.module_address
  );

  // Build the full ID
  // Format: provider:type:name:hash
  // If module address exists, include it: provider:type:module.name:hash
  const nameComponent = resource.module_address
    ? `${resource.module_address}.${resource.name}`
    : resource.name;

  const fullId = `${provider}:${resource.type}:${nameComponent}:${hash}`;

  return {
    provider,
    resourceType: resource.type,
    resourceName: resource.name,
    moduleAddress: resource.module_address,
    deterministicHash: hash,
    fullId,
  };
}

/**
 * Generate an external ID asynchronously (uses SHA-256)
 */
export async function generateExternalIdAsync(
  resource: TerraformResourceChange
): Promise<ExternalResourceId> {
  const provider = normalizeProviderName(resource.provider_name);
  const hash = await generateDeterministicHashAsync(
    provider,
    resource.type,
    resource.name,
    resource.module_address
  );

  const nameComponent = resource.module_address
    ? `${resource.module_address}.${resource.name}`
    : resource.name;

  const fullId = `${provider}:${resource.type}:${nameComponent}:${hash}`;

  return {
    provider,
    resourceType: resource.type,
    resourceName: resource.name,
    moduleAddress: resource.module_address,
    deterministicHash: hash,
    fullId,
  };
}

/**
 * Parse an external ID string back into its components
 *
 * @param externalId - The full external ID string
 * @returns Parsed components or null if invalid format
 */
export function parseExternalId(externalId: string): ExternalResourceId | null {
  // Format: provider:type:name:hash or provider:type:module.name:hash
  const parts = externalId.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [provider, resourceType, nameComponent, deterministicHash] = parts;

  // Check if name includes module address
  const moduleSeparatorIndex = nameComponent.lastIndexOf('.');
  let resourceName: string;
  let moduleAddress: string | undefined;

  // Module addresses contain dots, so we need to handle this carefully
  // The resource name is typically the last segment after the final dot in module paths
  if (moduleSeparatorIndex > 0 && nameComponent.includes('module.')) {
    moduleAddress = nameComponent.slice(0, moduleSeparatorIndex);
    resourceName = nameComponent.slice(moduleSeparatorIndex + 1);
  } else {
    resourceName = nameComponent;
    moduleAddress = undefined;
  }

  return {
    provider,
    resourceType,
    resourceName,
    moduleAddress,
    deterministicHash,
    fullId: externalId,
  };
}

/**
 * Compare two external IDs for equality
 *
 * @param id1 - First external ID
 * @param id2 - Second external ID
 * @returns True if the IDs represent the same resource
 */
export function externalIdsMatch(
  id1: ExternalResourceId | string,
  id2: ExternalResourceId | string
): boolean {
  const fullId1 = typeof id1 === 'string' ? id1 : id1.fullId;
  const fullId2 = typeof id2 === 'string' ? id2 : id2.fullId;

  return fullId1 === fullId2;
}

/**
 * Check if an external ID matches a Terraform address
 * This is a looser match that doesn't require the hash to match
 *
 * @param externalId - The external ID to check
 * @param terraformAddress - The Terraform address (e.g., "aws_instance.web")
 * @returns True if the external ID represents the same resource
 */
export function matchesTerraformAddress(
  externalId: ExternalResourceId | string,
  terraformAddress: string
): boolean {
  const parsed = typeof externalId === 'string' ? parseExternalId(externalId) : externalId;

  if (!parsed) {
    return false;
  }

  // Terraform address format: type.name or module.path.type.name
  const expectedAddress = parsed.moduleAddress
    ? `${parsed.moduleAddress}.${parsed.resourceType}.${parsed.resourceName}`
    : `${parsed.resourceType}.${parsed.resourceName}`;

  return expectedAddress === terraformAddress;
}
