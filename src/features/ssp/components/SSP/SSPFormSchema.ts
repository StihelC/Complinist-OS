/**
 * JSON Schema for SSP Wizard Form
 * Defines the complete structure for System Security Plan generation
 */

import { RJSFSchema, UiSchema } from '@rjsf/utils';

export interface SSPFormData {
  // Step 1: Basic Info
  system_name: string;
  organization_name: string;
  prepared_by: string;
  baseline: 'LOW' | 'MODERATE' | 'HIGH';

  // Step 2: System Details
  system_description?: string;
  system_purpose?: string;
  deployment_model: 'on-premises' | 'private-cloud' | 'public-cloud' | 'hybrid-cloud' | 'other';
  service_model: 'on-premises' | 'saas' | 'paas' | 'iaas' | 'hybrid' | 'other';
  cloud_provider?: string;
  on_premises_details?: {
    data_center_location: string;
    physical_security_description: string;
    server_infrastructure: string;
    network_infrastructure: string;
    backup_systems: string;
    disaster_recovery: string;
  };
  physical_location?: string;

  // Step 3: Data & Security
  information_type_title?: string;
  information_type_description?: string;
  data_types_processed?: string;
  users_description?: string;
  confidentiality_impact: 'low' | 'moderate' | 'high';
  integrity_impact: 'low' | 'moderate' | 'high';
  availability_impact: 'low' | 'moderate' | 'high';

  // Step 4: Authorization & Parties
  authorization_boundary_description?: string;
  system_status: 'operational' | 'under-development' | 'major-modification' | 'other';
  system_owner?: string;
  system_owner_email?: string;
  authorizing_official?: string;
  authorizing_official_email?: string;
  security_contact?: string;
  security_contact_email?: string;

  // Step 5: Review & Generate
  topology_screenshot?: string;
  unedited_controls_mode: 'placeholder' | 'nist_text' | 'exclude';
  
  // Option descriptions for reference:
  // - placeholder: "This control is implemented. [Details to be documented]"
  // - nist_text: Full NIST 800-53 control description (official text)
  // - exclude: Control is not included in the SSP document
  
  custom_sections?: Array<{
    id: string;
    title: string;
    content: string;
    position: string;
  }>;
}

// Step 1: Basic Information
export const step1Schema: RJSFSchema = {
  type: 'object',
  required: ['system_name', 'organization_name', 'prepared_by', 'baseline'],
  properties: {
    system_name: {
      type: 'string',
      title: 'System Name',
      minLength: 1,
    },
    organization_name: {
      type: 'string',
      title: 'Organization Name',
      minLength: 1,
    },
    prepared_by: {
      type: 'string',
      title: 'Prepared By',
      minLength: 1,
    },
    baseline: {
      type: 'string',
      title: 'Security Baseline',
      enum: ['LOW', 'MODERATE', 'HIGH'],
      default: 'MODERATE',
    },
  },
};

export const step1UiSchema: UiSchema = {
  system_name: {
    'ui:placeholder': 'Enter system name',
    'ui:help': 'The official name of the information system',
  },
  organization_name: {
    'ui:placeholder': 'Enter organization name',
  },
  prepared_by: {
    'ui:placeholder': 'Your name or team',
  },
  baseline: {
    'ui:help': 'NIST 800-53 security baseline level',
  },
};

// Step 2: System Details
export const step2Schema: RJSFSchema = {
  type: 'object',
  properties: {
    system_description: {
      type: 'string',
      title: 'System Description',
    },
    system_purpose: {
      type: 'string',
      title: 'System Purpose',
    },
    deployment_model: {
      type: 'string',
      title: 'Deployment Model',
      enum: ['on-premises', 'private-cloud', 'public-cloud', 'hybrid-cloud', 'other'],
      default: 'on-premises',
    },
    service_model: {
      type: 'string',
      title: 'Service Model',
      enum: ['on-premises', 'saas', 'paas', 'iaas', 'hybrid', 'other'],
      default: 'on-premises',
    },
    physical_location: {
      type: 'string',
      title: 'Physical Location',
    },
  },
  dependencies: {
    deployment_model: {
      oneOf: [
        {
          properties: {
            deployment_model: {
              enum: ['private-cloud', 'public-cloud', 'hybrid-cloud'],
            },
            cloud_provider: {
              type: 'string',
              title: 'Cloud Provider',
              enum: ['AWS', 'Azure', 'GCP', 'Oracle', 'IBM', 'Other'],
            },
          },
        },
        {
          properties: {
            deployment_model: {
              enum: ['on-premises'],
            },
            on_premises_details: {
              type: 'object',
              title: 'On-Premises Details',
              properties: {
                data_center_location: {
                  type: 'string',
                  title: 'Data Center Location',
                },
                physical_security_description: {
                  type: 'string',
                  title: 'Physical Security Description',
                },
                server_infrastructure: {
                  type: 'string',
                  title: 'Server Infrastructure',
                },
                network_infrastructure: {
                  type: 'string',
                  title: 'Network Infrastructure',
                },
                backup_systems: {
                  type: 'string',
                  title: 'Backup Systems',
                },
                disaster_recovery: {
                  type: 'string',
                  title: 'Disaster Recovery',
                },
              },
            },
          },
        },
        {
          properties: {
            deployment_model: {
              enum: ['other'],
            },
          },
        },
      ],
    },
  },
};

export const step2UiSchema: UiSchema = {
  system_description: {
    'ui:widget': 'textarea',
    'ui:placeholder': 'Describe what the system does...',
    'ui:options': {
      rows: 4,
    },
  },
  system_purpose: {
    'ui:placeholder': 'Specific capabilities (e.g., user management and audit logging)',
  },
  physical_location: {
    'ui:placeholder': 'Physical or logical location',
  },
  on_premises_details: {
    data_center_location: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
    },
    physical_security_description: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
    },
    server_infrastructure: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
    },
    network_infrastructure: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
    },
    backup_systems: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
    },
    disaster_recovery: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
    },
  },
};

// Step 3: Data & Security
export const step3Schema: RJSFSchema = {
  type: 'object',
  properties: {
    information_type_title: {
      type: 'string',
      title: 'Information Type',
      enum: [
        'User Account Data',
        'Financial Information',
        'Personal Health Information (PHI)',
        'Personally Identifiable Information (PII)',
        'System and Network Monitoring',
        'Business Operations Data',
        'Customer Service Data',
        'Research and Development Data',
        'Other',
      ],
    },
    information_type_description: {
      type: 'string',
      title: 'Information Type Description',
    },
    data_types_processed: {
      type: 'string',
      title: 'Data Types Processed',
    },
    users_description: {
      type: 'string',
      title: 'Users Description',
    },
    confidentiality_impact: {
      type: 'string',
      title: 'Confidentiality Impact',
      enum: ['low', 'moderate', 'high'],
      default: 'moderate',
    },
    integrity_impact: {
      type: 'string',
      title: 'Integrity Impact',
      enum: ['low', 'moderate', 'high'],
      default: 'moderate',
    },
    availability_impact: {
      type: 'string',
      title: 'Availability Impact',
      enum: ['low', 'moderate', 'high'],
      default: 'moderate',
    },
  },
};

export const step3UiSchema: UiSchema = {
  information_type_title: {
    'ui:placeholder': 'Select information type...',
  },
  information_type_description: {
    'ui:widget': 'textarea',
    'ui:placeholder': 'Describe the data...',
    'ui:options': {
      rows: 3,
    },
  },
  data_types_processed: {
    'ui:placeholder': 'Comma-separated (e.g., PII, Financial Data, System Logs)',
  },
  users_description: {
    'ui:placeholder': 'e.g., internal staff and approved contractors',
  },
  confidentiality_impact: {
    'ui:help': 'FIPS 199 Security Impact Level',
  },
  integrity_impact: {
    'ui:help': 'FIPS 199 Security Impact Level',
  },
  availability_impact: {
    'ui:help': 'FIPS 199 Security Impact Level',
  },
};

// Step 4: Authorization & Parties
export const step4Schema: RJSFSchema = {
  type: 'object',
  properties: {
    authorization_boundary_description: {
      type: 'string',
      title: 'Authorization Boundary Description',
    },
    system_status: {
      type: 'string',
      title: 'System Status',
      enum: ['operational', 'under-development', 'major-modification', 'other'],
      default: 'operational',
    },
    system_owner: {
      type: 'string',
      title: 'System Owner',
    },
    system_owner_email: {
      type: 'string',
      title: 'System Owner Email',
    },
    authorizing_official: {
      type: 'string',
      title: 'Authorizing Official',
    },
    authorizing_official_email: {
      type: 'string',
      title: 'Authorizing Official Email',
    },
    security_contact: {
      type: 'string',
      title: 'Security Contact',
    },
    security_contact_email: {
      type: 'string',
      title: 'Security Contact Email',
    },
  },
};

export const step4UiSchema: UiSchema = {
  authorization_boundary_description: {
    'ui:widget': 'textarea',
    'ui:placeholder': "Describe what's included in the authorization boundary...",
    'ui:options': {
      rows: 4,
    },
  },
  system_owner: {
    'ui:placeholder': 'Full Name',
  },
  system_owner_email: {
    'ui:placeholder': 'email@example.com',
  },
  authorizing_official: {
    'ui:placeholder': 'Full Name',
  },
  authorizing_official_email: {
    'ui:placeholder': 'email@example.com',
  },
  security_contact: {
    'ui:placeholder': 'Full Name',
  },
  security_contact_email: {
    'ui:placeholder': 'email@example.com',
  },
};

// Step 5: Review & Generate
export const step5Schema: RJSFSchema = {
  type: 'object',
  required: ['unedited_controls_mode'],
  properties: {
    topology_screenshot: {
      type: 'string',
      title: 'Network Topology Diagram',
    },
    unedited_controls_mode: {
      type: 'string',
      title: 'Unedited Controls Handling',
      enum: ['placeholder', 'nist_text', 'exclude'],
      default: 'placeholder',
    } as RJSFSchema,
    custom_sections: {
      type: 'array',
      title: 'Custom Sections',
      default: [],
      items: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: {
            type: 'string',
            title: 'Section Title',
          },
          content: {
            type: 'string',
            title: 'Section Content',
          },
          position: {
            type: 'string',
            title: 'Insert Position',
            enum: ['appendix', 'after-section-1', 'after-section-2', 'after-section-3'],
            default: 'appendix',
          },
        },
      },
    },
  },
};

export const step5UiSchema: UiSchema = {
  topology_screenshot: {
    'ui:widget': 'topologyCapture',
  },
  control_selection: {
    'ui:widget': 'controlSelector',
  },
  control_status: {
    'ui:widget': 'controlStatus',
  },
  unedited_controls_mode: {
    'ui:widget': 'uneditedControlsMode',
    'ui:enumNames': [
      'Auto-Generated Placeholder Text',
      'NIST Control Text (Official)',
      'Exclude from SSP'
    ],
    'ui:help': 'Controls without custom narratives: Choose how they appear in the SSP PDF',
    'ui:description': 'Important: This affects how reviewers see unedited controls in your final document',
    'ui:classNames': 'ssp-section-generate',
  },
  custom_sections: {
    'ui:options': {
      addable: true,
      orderable: true,
      removable: true,
    },
    'ui:classNames': 'ssp-section-generate',
    'ui:description': 'Add custom sections to your SSP (optional)',
    items: {
      title: {
        'ui:placeholder': 'e.g., Additional Security Measures',
      },
      content: {
        'ui:widget': 'textarea',
        'ui:placeholder': 'Enter section content...',
        'ui:options': {
          rows: 6,
        },
      },
      position: {
        'ui:help': 'Where to insert this section in the SSP',
      },
    },
  },
};

// Combined schema for all steps (for backward compatibility)
export const allStepsSchemas = [
  { schema: step1Schema, uiSchema: step1UiSchema, title: 'Basic Information' },
  { schema: step2Schema, uiSchema: step2UiSchema, title: 'System Details' },
  { schema: step3Schema, uiSchema: step3UiSchema, title: 'Data & Security' },
  { schema: step4Schema, uiSchema: step4UiSchema, title: 'Authorization & Parties' },
  { schema: step5Schema, uiSchema: step5UiSchema, title: 'Review & Generate' },
];

// Combined single-page schema merging all steps
export const combinedSchema: RJSFSchema = {
  type: 'object',
  required: ['system_name', 'organization_name', 'prepared_by', 'baseline', 'unedited_controls_mode'],
  properties: {
    // Step 1: Basic Information
    system_name: {
      type: 'string',
      title: 'System Name',
      minLength: 1,
    },
    organization_name: {
      type: 'string',
      title: 'Organization Name',
      minLength: 1,
    },
    prepared_by: {
      type: 'string',
      title: 'Prepared By',
      minLength: 1,
    },
    baseline: {
      type: 'string',
      title: 'Security Baseline',
      enum: ['LOW', 'MODERATE', 'HIGH'],
      default: 'MODERATE',
    },
    // Step 2: System Details
    system_description: {
      type: 'string',
      title: 'System Description',
    },
    system_purpose: {
      type: 'string',
      title: 'System Purpose',
    },
    deployment_model: {
      type: 'string',
      title: 'Deployment Model',
      enum: ['on-premises', 'private-cloud', 'public-cloud', 'hybrid-cloud', 'other'],
      default: 'on-premises',
    },
    service_model: {
      type: 'string',
      title: 'Service Model',
      enum: ['on-premises', 'saas', 'paas', 'iaas', 'hybrid', 'other'],
      default: 'on-premises',
    },
    physical_location: {
      type: 'string',
      title: 'Physical Location',
    },
    cloud_provider: {
      type: 'string',
      title: 'Cloud Provider',
      enum: ['AWS', 'Azure', 'GCP', 'Oracle', 'IBM', 'Other'],
    },
    on_premises_details: {
      type: 'object',
      title: 'On-Premises Details',
      properties: {
        data_center_location: {
          type: 'string',
          title: 'Data Center Location',
        },
        physical_security_description: {
          type: 'string',
          title: 'Physical Security Description',
        },
        server_infrastructure: {
          type: 'string',
          title: 'Server Infrastructure',
        },
        network_infrastructure: {
          type: 'string',
          title: 'Network Infrastructure',
        },
        backup_systems: {
          type: 'string',
          title: 'Backup Systems',
        },
        disaster_recovery: {
          type: 'string',
          title: 'Disaster Recovery',
        },
      },
    },
    // Step 3: Data & Security
    information_type_title: {
      type: 'string',
      title: 'Information Type',
      enum: [
        'User Account Data',
        'Financial Information',
        'Personal Health Information (PHI)',
        'Personally Identifiable Information (PII)',
        'System and Network Monitoring',
        'Business Operations Data',
        'Customer Service Data',
        'Research and Development Data',
        'Other',
      ],
    },
    information_type_description: {
      type: 'string',
      title: 'Information Type Description',
    },
    data_types_processed: {
      type: 'string',
      title: 'Data Types Processed',
    },
    users_description: {
      type: 'string',
      title: 'Users Description',
    },
    confidentiality_impact: {
      type: 'string',
      title: 'Confidentiality Impact',
      enum: ['low', 'moderate', 'high'],
      default: 'moderate',
    },
    integrity_impact: {
      type: 'string',
      title: 'Integrity Impact',
      enum: ['low', 'moderate', 'high'],
      default: 'moderate',
    },
    availability_impact: {
      type: 'string',
      title: 'Availability Impact',
      enum: ['low', 'moderate', 'high'],
      default: 'moderate',
    },
    // Step 4: Authorization & Parties
    authorization_boundary_description: {
      type: 'string',
      title: 'Authorization Boundary Description',
    },
    system_status: {
      type: 'string',
      title: 'System Status',
      enum: ['operational', 'under-development', 'major-modification', 'other'],
      default: 'operational',
    },
    system_owner: {
      type: 'string',
      title: 'System Owner',
    },
    system_owner_email: {
      type: 'string',
      title: 'System Owner Email',
    },
    authorizing_official: {
      type: 'string',
      title: 'Authorizing Official',
    },
    authorizing_official_email: {
      type: 'string',
      title: 'Authorizing Official Email',
    },
    security_contact: {
      type: 'string',
      title: 'Security Contact',
    },
    security_contact_email: {
      type: 'string',
      title: 'Security Contact Email',
    },
    // Step 5: Review & Generate
    topology_screenshot: {
      type: 'string',
      title: 'Network Topology Diagram',
    },
    unedited_controls_mode: {
      type: 'string',
      title: 'Unedited Controls Handling',
      enum: ['placeholder', 'nist_text', 'exclude'],
      default: 'placeholder',
    },
    custom_sections: {
      type: 'array',
      title: 'Custom Sections',
      default: [],
      items: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: {
            type: 'string',
            title: 'Section Title',
          },
          content: {
            type: 'string',
            title: 'Section Content',
          },
          position: {
            type: 'string',
            title: 'Insert Position',
            enum: ['appendix', 'after-section-1', 'after-section-2', 'after-section-3'],
            default: 'appendix',
          },
        },
      },
    },
  },
  dependencies: {
    deployment_model: {
      oneOf: [
        {
          properties: {
            deployment_model: {
              enum: ['private-cloud', 'public-cloud', 'hybrid-cloud'],
            },
            cloud_provider: {
              type: 'string',
              title: 'Cloud Provider',
              enum: ['AWS', 'Azure', 'GCP', 'Oracle', 'IBM', 'Other'],
            },
          },
          required: ['cloud_provider'],
        },
        {
          properties: {
            deployment_model: {
              enum: ['on-premises'],
            },
            on_premises_details: {
              type: 'object',
              title: 'On-Premises Details',
              properties: {
                data_center_location: {
                  type: 'string',
                  title: 'Data Center Location',
                },
                physical_security_description: {
                  type: 'string',
                  title: 'Physical Security Description',
                },
                server_infrastructure: {
                  type: 'string',
                  title: 'Server Infrastructure',
                },
                network_infrastructure: {
                  type: 'string',
                  title: 'Network Infrastructure',
                },
                backup_systems: {
                  type: 'string',
                  title: 'Backup Systems',
                },
                disaster_recovery: {
                  type: 'string',
                  title: 'Disaster Recovery',
                },
              },
            },
          },
        },
        {
          properties: {
            deployment_model: {
              enum: ['other'],
            },
          },
        },
      ],
    },
  },
};

// Combined UI schema with section organization
export const combinedUiSchema: UiSchema = {
  'ui:order': [
    // Section 1: Basic Information
    'system_name',
    'organization_name',
    'prepared_by',
    'baseline',
    // Section 2: System Details
    'system_description',
    'system_purpose',
    'deployment_model',
    'service_model',
    'cloud_provider',
    'on_premises_details',
    'physical_location',
    // Section 3: Data & Security
    'information_type_title',
    'information_type_description',
    'data_types_processed',
    'users_description',
    'confidentiality_impact',
    'integrity_impact',
    'availability_impact',
    // Section 4: Authorization & Parties
    'authorization_boundary_description',
    'system_status',
    'system_owner',
    'system_owner_email',
    'authorizing_official',
    'authorizing_official_email',
    'security_contact',
    'security_contact_email',
    // Section 5: Review & Generate
    'topology_screenshot',
    'control_selection',
    'control_status',
    'unedited_controls_mode',
    'custom_sections',
  ],
  // Step 1 fields
  system_name: {
    'ui:placeholder': 'Enter system name',
    'ui:help': 'The official name of the information system',
    'ui:classNames': 'ssp-section-basic required',
    'ui:description': 'Required',
  },
  organization_name: {
    'ui:placeholder': 'Enter organization name',
    'ui:classNames': 'ssp-section-basic required',
    'ui:description': 'Required',
  },
  prepared_by: {
    'ui:placeholder': 'Your name or team',
    'ui:classNames': 'ssp-section-basic required',
    'ui:description': 'Required',
  },
  baseline: {
    'ui:help': 'NIST 800-53 security baseline level (LOW, MODERATE, or HIGH)',
    'ui:classNames': 'ssp-section-basic',
  },
  // Step 2 fields
  system_description: {
    'ui:widget': 'textarea',
    'ui:placeholder': 'Describe what the system does...',
    'ui:help': 'Provide a clear overview of the system\'s purpose and functionality',
    'ui:options': {
      rows: 4,
    },
    'ui:classNames': 'ssp-section-system',
  },
  system_purpose: {
    'ui:placeholder': 'Specific capabilities (e.g., user management and audit logging)',
    'ui:help': 'List key capabilities and functions',
    'ui:classNames': 'ssp-section-system',
  },
  deployment_model: {
    'ui:classNames': 'ssp-section-system',
    'ui:help': 'Where is the system deployed?',
  },
  service_model: {
    'ui:classNames': 'ssp-section-system',
    'ui:help': 'What type of service model is used?',
  },
  physical_location: {
    'ui:placeholder': 'Physical or logical location',
    'ui:help': 'Geographic or network location of the system',
    'ui:classNames': 'ssp-section-system',
  },
  cloud_provider: {
    'ui:classNames': 'ssp-section-system',
  },
  on_premises_details: {
    'ui:classNames': 'ssp-section-system',
    'ui:title': 'On-Premises Infrastructure Details',
    'ui:description': 'Provide details about your on-premises infrastructure',
    data_center_location: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
      'ui:placeholder': 'Address and details of data center location',
    },
    physical_security_description: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
      'ui:placeholder': 'Describe physical security controls (locks, cameras, guards, etc.)',
    },
    server_infrastructure: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
      'ui:placeholder': 'Server hardware, virtualization platform, etc.',
    },
    network_infrastructure: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
      'ui:placeholder': 'Network equipment, switches, routers, firewalls, etc.',
    },
    backup_systems: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
      'ui:placeholder': 'Backup solutions, frequencies, and retention policies',
    },
    disaster_recovery: {
      'ui:widget': 'textarea',
      'ui:options': { rows: 2 },
      'ui:placeholder': 'DR procedures, RTO/RPO, failover mechanisms',
    },
  },
  // Step 3 fields
  information_type_title: {
    'ui:placeholder': 'Select information type...',
    'ui:help': 'Select the primary type of information your system processes',
    'ui:classNames': 'ssp-section-data',
  },
  information_type_description: {
    'ui:widget': 'textarea',
    'ui:placeholder': 'Describe the data...',
    'ui:help': 'Provide details about the information types and sensitivity',
    'ui:options': {
      rows: 3,
    },
    'ui:classNames': 'ssp-section-data',
  },
  data_types_processed: {
    'ui:placeholder': 'Comma-separated (e.g., PII, Financial Data, System Logs)',
    'ui:help': 'List all types of data processed by the system',
    'ui:classNames': 'ssp-section-data',
  },
  users_description: {
    'ui:placeholder': 'e.g., internal staff and approved contractors',
    'ui:help': 'Describe who has access to the system',
    'ui:classNames': 'ssp-section-data',
  },
  confidentiality_impact: {
    'ui:help': 'FIPS 199 Security Impact Level for Confidentiality',
    'ui:classNames': 'ssp-section-data',
  },
  integrity_impact: {
    'ui:help': 'FIPS 199 Security Impact Level for Integrity',
    'ui:classNames': 'ssp-section-data',
  },
  availability_impact: {
    'ui:help': 'FIPS 199 Security Impact Level for Availability',
    'ui:classNames': 'ssp-section-data',
  },
  // Step 4 fields
  authorization_boundary_description: {
    'ui:widget': 'textarea',
    'ui:placeholder': "Describe what's included in the authorization boundary...",
    'ui:help': 'Define the logical and physical boundaries of the system',
    'ui:options': {
      rows: 4,
    },
    'ui:classNames': 'ssp-section-authorization',
  },
  system_status: {
    'ui:classNames': 'ssp-section-authorization',
    'ui:help': 'Current operational status of the system',
  },
  system_owner: {
    'ui:placeholder': 'Full Name',
    'ui:help': 'Person responsible for the system',
    'ui:classNames': 'ssp-section-authorization',
  },
  system_owner_email: {
    'ui:placeholder': 'email@example.com',
    'ui:classNames': 'ssp-section-authorization',
  },
  authorizing_official: {
    'ui:placeholder': 'Full Name',
    'ui:help': 'Person who grants authorization to operate (ATO)',
    'ui:classNames': 'ssp-section-authorization',
  },
  authorizing_official_email: {
    'ui:placeholder': 'email@example.com',
    'ui:classNames': 'ssp-section-authorization',
  },
  security_contact: {
    'ui:placeholder': 'Full Name',
    'ui:help': 'Primary security contact for the system',
    'ui:classNames': 'ssp-section-authorization',
  },
  security_contact_email: {
    'ui:placeholder': 'email@example.com',
    'ui:classNames': 'ssp-section-authorization',
  },
  // Step 5 fields
  topology_screenshot: {
    'ui:widget': 'topologyCapture',
    'ui:classNames': 'ssp-section-generate',
    'ui:help': 'Capture a high-quality screenshot of your network topology diagram',
  },
  control_selection: {
    'ui:widget': 'controlSelector',
    'ui:classNames': 'ssp-section-generate',
    'ui:help': 'Select which NIST 800-53 controls to include in your SSP',
  },
  control_status: {
    'ui:widget': 'controlStatus',
    'ui:classNames': 'ssp-section-generate',
    'ui:help': 'Review the status of selected controls',
  },
  unedited_controls_mode: {
    'ui:widget': 'uneditedControlsMode',
    'ui:enumNames': [
      'Auto-Generated Placeholder Text',
      'NIST Control Text (Official)',
      'Exclude from SSP'
    ],
    'ui:help': 'Controls without custom narratives: Choose how they appear in the SSP PDF',
    'ui:description': 'Important: This affects how reviewers see unedited controls in your final document',
    'ui:classNames': 'ssp-section-generate',
  },
  custom_sections: {
    'ui:options': {
      addable: true,
      orderable: true,
      removable: true,
    },
    'ui:classNames': 'ssp-section-generate',
    'ui:description': 'Add custom sections to your SSP (optional)',
    items: {
      title: {
        'ui:placeholder': 'e.g., Additional Security Measures',
      },
      content: {
        'ui:widget': 'textarea',
        'ui:placeholder': 'Enter section content...',
        'ui:options': {
          rows: 6,
        },
      },
      position: {
        'ui:help': 'Where to insert this section in the SSP',
      },
    },
  },
};

