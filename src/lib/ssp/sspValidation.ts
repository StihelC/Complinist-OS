/**
 * Zod Validation Schemas for SSP Generation
 * 
 * Provides runtime validation with type safety for SSP generation requests.
 */

import { z } from 'zod';

// Email validation helper with user-friendly error messages
const emailSchema = z.string()
  .email('Please enter a valid email address (e.g., user@example.com)')
  .optional()
  .or(z.literal(''))
  .refine(
    (val) => !val || val === '' || z.string().email().safeParse(val).success,
    { message: 'Please enter a valid email address (e.g., user@example.com)' }
  );

// Custom sections schema
const customSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  position: z.string(),
});

// On-premises details schema
const onPremisesDetailsSchema = z.object({
  data_center_location: z.string(),
  physical_security_description: z.string(),
  server_infrastructure: z.string(),
  network_infrastructure: z.string(),
  backup_systems: z.string(),
  disaster_recovery: z.string(),
}).optional();

// Custom narrative schema
const customNarrativeSchema = z.object({
  narrative: z.string(),
  implementation_status: z.string().optional(),
  referenced_devices: z.array(z.string()).optional(),
  referenced_boundaries: z.array(z.string()).optional(),
});

/**
 * Main SSP Generation Request Schema
 * Defines validation rules for all SSP generation fields
 */
export const SSPGenerationRequestSchema = z.object({
  // Required fields
  system_name: z.string().min(1, 'System name is required. Please enter the official name of your information system.'),
  organization_name: z.string().min(1, 'Organization name is required. Please enter the name of your organization.'),
  prepared_by: z.string().min(1, 'Prepared by is required. Please enter the name of the person or team preparing this SSP.'),
  baseline: z.enum(['LOW', 'MODERATE', 'HIGH'], {
    message: 'Security baseline must be one of: LOW, MODERATE, or HIGH',
  }),

  // System characteristics
  system_description: z.string().optional(),
  system_purpose: z.string().optional(),
  deployment_model: z.enum([
    'on-premises',
    'private-cloud',
    'public-cloud',
    'hybrid-cloud',
    'other'
  ]).default('on-premises'),
  service_model: z.enum([
    'on-premises',
    'saas',
    'paas',
    'iaas',
    'hybrid',
    'other'
  ]).default('on-premises'),
  
  // Cloud/on-premises specific
  cloud_provider: z.string().optional(),
  on_premises_details: onPremisesDetailsSchema,
  
  // Information types
  information_type_title: z.string().default(''),
  information_type_description: z.string().default(''),
  data_sensitivity: z.string().optional(), // Legacy field
  
  // FIPS 199 Impact Levels
  confidentiality_impact: z.enum(['low', 'moderate', 'high']).default('moderate'),
  integrity_impact: z.enum(['low', 'moderate', 'high']).default('moderate'),
  availability_impact: z.enum(['low', 'moderate', 'high']).default('moderate'),
  
  // Authorization & Status
  authorization_boundary_description: z.string().default(''),
  system_status: z.enum([
    'operational',
    'under-development',
    'major-modification',
    'other'
  ]).default('operational'),
  authorization_date: z.string().optional(),
  
  // Responsible Parties - emails are optional but validated when present
  system_owner: z.string().default(''),
  system_owner_email: emailSchema,
  authorizing_official: z.string().default(''),
  authorizing_official_email: emailSchema,
  security_contact: z.string().default(''),
  security_contact_email: emailSchema,
  
  // Additional Context
  physical_location: z.string().default(''),
  data_types_processed: z.string().default(''),
  users_description: z.string().default(''),
  
  // Topology
  topology_screenshot: z.string().optional(), // Base64 encoded SVG
  topology_image: z.string().optional(), // Base64 encoded SVG (alias)
  
  // Custom Sections
  custom_sections: z.array(customSectionSchema).optional(),
  
  // SSP Generation Options
  unedited_controls_mode: z.enum(['placeholder', 'nist_text', 'exclude']).default('placeholder'),
  custom_narratives: z.record(z.string(), customNarrativeSchema).optional(),
  project_id: z.number().optional(),
  selected_control_ids: z.array(z.string()).optional(),

  // AI-enhanced narratives (keyed by control family: AC, AU, CM, etc.)
  enhanced_narratives: z.record(z.string(), z.string()).optional(),
});

/**
 * Infer TypeScript type from Zod schema
 */
export type SSPGenerationRequest = z.infer<typeof SSPGenerationRequestSchema>;

/**
 * Validate SSP Generation Request
 * Returns validation result with typed errors
 */
export function validateSSPRequest(request: unknown): {
  success: boolean;
  data?: SSPGenerationRequest;
  errors?: string[];
} {
  const result = SSPGenerationRequestSchema.safeParse(request);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }
  
  // Format Zod errors into readable, user-friendly messages
  const errors = result.error.issues.map(err => {
    const path = err.path.join('.');
    const fieldName = formatFieldName(path);

    // Provide context-aware error messages
    if (err.code === 'invalid_type') {
      const expected = 'expected' in err ? err.expected : 'valid value';
      return `${fieldName}: Invalid value. Expected ${expected}`;
    }

    if (err.code === 'invalid_value') {
      return `${fieldName}: Invalid selection. Please choose from the available options.`;
    }

    // Use the custom error message if available, otherwise use the default
    return err.message || `${fieldName}: Validation failed`;
  });
  
  return {
    success: false,
    errors,
  };
}

/**
 * Format field path into user-friendly field name
 */
function formatFieldName(path: string): string {
  const fieldMap: Record<string, string> = {
    'system_name': 'System Name',
    'organization_name': 'Organization Name',
    'prepared_by': 'Prepared By',
    'baseline': 'Security Baseline',
    'system_owner_email': 'System Owner Email',
    'authorizing_official_email': 'Authorizing Official Email',
    'security_contact_email': 'Security Contact Email',
    'deployment_model': 'Deployment Model',
    'service_model': 'Service Model',
    'cloud_provider': 'Cloud Provider',
    'confidentiality_impact': 'Confidentiality Impact',
    'integrity_impact': 'Integrity Impact',
    'availability_impact': 'Availability Impact',
    'unedited_controls_mode': 'Unedited Controls Mode',
  };

  // Handle nested paths (e.g., 'on_premises_details.data_center_location')
  const parts = path.split('.');
  if (parts.length > 1) {
    const parent = fieldMap[parts[0]] || parts[0].replace(/_/g, ' ');
    const child = parts[parts.length - 1].replace(/_/g, ' ');
    return `${parent} - ${child.charAt(0).toUpperCase() + child.slice(1)}`;
  }

  return fieldMap[path] || path.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Validate and throw on error (convenience function)
 */
export function validateSSPRequestOrThrow(request: unknown): SSPGenerationRequest {
  const result = validateSSPRequest(request);
  
  if (!result.success) {
    const errorMessages = result.errors?.map((err, idx) => `${idx + 1}. ${err}`).join('\n') || 'Validation failed';
    throw new Error(`SSP Validation Error:\n\n${errorMessages}\n\nPlease fix these errors and try again.`);
  }
  
  return result.data!;
}

