/**
 * Organization Defaults Store
 *
 * Stores organization-level defaults that can be auto-populated into SSP metadata.
 * Persists to localStorage for easy cross-project reuse.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface OrganizationDefaults {
  // Organization Info
  organization_name: string;
  physical_location: string;

  // Default Contacts
  prepared_by: string;
  system_owner: string;
  system_owner_email: string;
  authorizing_official: string;
  authorizing_official_email: string;
  security_contact: string;
  security_contact_email: string;

  // Default System Settings
  default_baseline: 'LOW' | 'MODERATE' | 'HIGH';
  default_deployment_model: 'on-premises' | 'private-cloud' | 'public-cloud' | 'hybrid-cloud' | 'other';
  default_service_model: 'on-premises' | 'saas' | 'paas' | 'iaas' | 'hybrid' | 'other';

  // On-premises Defaults
  default_on_premises_details?: {
    data_center_location: string;
    physical_security_description: string;
    network_infrastructure: string;
    backup_systems: string;
    disaster_recovery: string;
  };

  // Cloud Defaults
  default_cloud_provider?: string;
}

interface OrganizationDefaultsState {
  defaults: OrganizationDefaults;
  lastUpdated: string | null;

  // Actions
  setDefaults: (defaults: Partial<OrganizationDefaults>) => void;
  updateDefaults: (updates: Partial<OrganizationDefaults>) => void;
  resetDefaults: () => void;

  // Helper to get defaults for SSP form
  getSSPDefaults: () => Partial<OrganizationDefaults>;

  // Import from existing SSP metadata
  importFromSSPMetadata: (metadata: any) => void;
}

const initialDefaults: OrganizationDefaults = {
  organization_name: '',
  physical_location: '',
  prepared_by: '',
  system_owner: '',
  system_owner_email: '',
  authorizing_official: '',
  authorizing_official_email: '',
  security_contact: '',
  security_contact_email: '',
  default_baseline: 'MODERATE',
  default_deployment_model: 'on-premises',
  default_service_model: 'on-premises',
};

export const useOrganizationDefaultsStore = create<OrganizationDefaultsState>()(
  devtools(
    persist(
      (set, get) => ({
        defaults: initialDefaults,
        lastUpdated: null,

        setDefaults: (defaults) => set({
          defaults: { ...initialDefaults, ...defaults },
          lastUpdated: new Date().toISOString(),
        }),

        updateDefaults: (updates) => set((state) => ({
          defaults: { ...state.defaults, ...updates },
          lastUpdated: new Date().toISOString(),
        })),

        resetDefaults: () => set({
          defaults: initialDefaults,
          lastUpdated: null,
        }),

        getSSPDefaults: () => {
          const { defaults } = get();
          return {
            organization_name: defaults.organization_name,
            physical_location: defaults.physical_location,
            prepared_by: defaults.prepared_by,
            system_owner: defaults.system_owner,
            system_owner_email: defaults.system_owner_email,
            authorizing_official: defaults.authorizing_official,
            authorizing_official_email: defaults.authorizing_official_email,
            security_contact: defaults.security_contact,
            security_contact_email: defaults.security_contact_email,
            default_baseline: defaults.default_baseline,
            default_deployment_model: defaults.default_deployment_model,
            default_service_model: defaults.default_service_model,
            default_on_premises_details: defaults.default_on_premises_details,
            default_cloud_provider: defaults.default_cloud_provider,
          };
        },

        importFromSSPMetadata: (metadata) => {
          if (!metadata) return;

          const updates: Partial<OrganizationDefaults> = {};

          // Import organization-level fields that should be defaults
          if (metadata.organization_name) updates.organization_name = metadata.organization_name;
          if (metadata.physical_location) updates.physical_location = metadata.physical_location;
          if (metadata.prepared_by) updates.prepared_by = metadata.prepared_by;
          if (metadata.system_owner) updates.system_owner = metadata.system_owner;
          if (metadata.system_owner_email) updates.system_owner_email = metadata.system_owner_email;
          if (metadata.authorizing_official) updates.authorizing_official = metadata.authorizing_official;
          if (metadata.authorizing_official_email) updates.authorizing_official_email = metadata.authorizing_official_email;
          if (metadata.security_contact) updates.security_contact = metadata.security_contact;
          if (metadata.security_contact_email) updates.security_contact_email = metadata.security_contact_email;

          // Import deployment settings
          if (metadata.baseline) updates.default_baseline = metadata.baseline;
          if (metadata.deployment_model) updates.default_deployment_model = metadata.deployment_model;
          if (metadata.service_model) updates.default_service_model = metadata.service_model;
          if (metadata.cloud_provider) updates.default_cloud_provider = metadata.cloud_provider;

          // Import on-premises details
          if (metadata.on_premises_details) {
            updates.default_on_premises_details = metadata.on_premises_details;
          }

          if (Object.keys(updates).length > 0) {
            set((state) => ({
              defaults: { ...state.defaults, ...updates },
              lastUpdated: new Date().toISOString(),
            }));
          }
        },
      }),
      {
        name: 'complinist-organization-defaults',
        version: 1,
      }
    ),
    { name: 'OrganizationDefaultsStore' }
  )
);
