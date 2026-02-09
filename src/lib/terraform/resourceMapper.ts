import { AWSMapper } from './resourceMappers/awsMapper'
import { AzureMapper } from './resourceMappers/azureMapper'
import type { ResourceMapping } from './terraformTypes'

export interface ResourceMapperConfig {
  provider: string
  resourceType: string
  resourceAttributes: Record<string, any>
}

export interface ProviderMapper {
  mapResource(type: string, attributes: any): ResourceMapping
  mapResourceAsync?(type: string, attributes: any): Promise<ResourceMapping>
}

const mappers: Record<string, ProviderMapper> = {
  aws: new AWSMapper(),
  azurerm: new AzureMapper(),
}

/**
 * Extract the short provider name from a full provider path
 * e.g., "registry.terraform.io/hashicorp/aws" -> "aws"
 * e.g., "aws" -> "aws"
 */
function normalizeProviderName(provider: string): string {
  if (!provider) return 'aws'

  // Handle full registry paths like "registry.terraform.io/hashicorp/aws"
  const parts = provider.split('/')
  const lastPart = parts[parts.length - 1]

  // Map common provider names
  if (lastPart === 'aws' || provider.includes('/aws')) return 'aws'
  if (lastPart === 'azurerm' || provider.includes('/azurerm')) return 'azurerm'
  if (lastPart === 'google' || provider.includes('/google')) return 'google'

  return lastPart || 'aws'
}

export function getProviderMapper(provider: string): ProviderMapper {
  const normalizedProvider = normalizeProviderName(provider)
  return mappers[normalizedProvider] || mappers.aws
}

export function mapTerraformResource(config: ResourceMapperConfig): ResourceMapping {
  const mapper = getProviderMapper(config.provider)
  return mapper.mapResource(config.resourceType, config.resourceAttributes)
}

export async function mapTerraformResourceAsync(config: ResourceMapperConfig): Promise<ResourceMapping> {
  const mapper = getProviderMapper(config.provider)

  // Use async version if available
  if (mapper.mapResourceAsync) {
    return mapper.mapResourceAsync(config.resourceType, config.resourceAttributes)
  }

  // Fallback to sync version
  return mapper.mapResource(config.resourceType, config.resourceAttributes)
}

