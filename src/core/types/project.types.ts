// Project and baseline types

export type NistBaseline = 'LOW' | 'MODERATE' | 'HIGH';

export interface Project {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  baseline: NistBaseline;
}

// Re-export layout types from the main types file for consistency
export type {
  LayoutAlgorithmType,
  LayoutDirectionType,
  ElkAlgorithmVariantType,
  EdgeRoutingTypeOption,
  SpacingTierType,
  LayoutSettings,
  GlobalSettings,
} from '@/lib/utils/types';

