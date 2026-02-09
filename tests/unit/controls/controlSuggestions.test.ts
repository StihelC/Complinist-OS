import { describe, it, expect } from 'vitest';
import {
  getSuggestedControls,
  getSuggestedControlIds,
  getHighPriorityControls,
  shouldSuggestControls,
  getMinimumControlCount,
} from '@/lib/controls/controlSuggestions';
import type { ControlSuggestion } from '@/lib/controls/controlSuggestions';
import type { DeviceType } from '@/lib/utils/types';
import type { DeviceCategorySummary } from '@/lib/topology/topologyAnalyzer';

describe('controlSuggestions', () => {
  describe('getSuggestedControls', () => {
    describe('device type overrides', () => {
      it('should return firewall-specific controls for firewall devices', () => {
        const suggestions = getSuggestedControls('firewall', 'security');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('SC-8'); // Traffic encryption
        expect(controlIds).toContain('AC-4'); // Traffic flow enforcement
        expect(controlIds).toContain('AU-2'); // Event logging
        expect(controlIds).toContain('CM-6'); // Configuration settings
      });

      it('should return database-specific controls for database-server devices', () => {
        const suggestions = getSuggestedControls('database-server', 'server');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-28'); // Encryption at rest
        expect(controlIds).toContain('AU-9'); // Audit log protection
        expect(controlIds).toContain('AC-3'); // Access control
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('SI-2'); // Patching
      });

      it('should return web-server-specific controls', () => {
        const suggestions = getSuggestedControls('web-server', 'server');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('SC-8'); // HTTPS/TLS
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('SI-3'); // Malware protection
        expect(controlIds).toContain('SI-10'); // Input validation
      });

      it('should return VPN gateway-specific controls', () => {
        const suggestions = getSuggestedControls('vpn-gateway', 'security');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-8'); // VPN encryption
        expect(controlIds).toContain('SC-13'); // Cryptographic protection
        expect(controlIds).toContain('AC-17'); // Remote access control
        expect(controlIds).toContain('IA-2'); // VPN authentication
      });

      it('should return router-specific controls', () => {
        const suggestions = getSuggestedControls('router', 'network');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-7'); // Routing boundaries
        expect(controlIds).toContain('CM-7'); // Router hardening
        expect(controlIds).toContain('AU-2'); // Event logging
      });

      it('should return switch-specific controls', () => {
        const suggestions = getSuggestedControls('switch', 'network');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-7'); // Network segmentation
        expect(controlIds).toContain('CM-7'); // Port security
        expect(controlIds).toContain('AU-2'); // Event logging
      });

      it('should return workstation-specific controls', () => {
        const suggestions = getSuggestedControls('workstation', 'endpoint');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('SI-3'); // Malware protection
        expect(controlIds).toContain('SC-28'); // Full-disk encryption
        expect(controlIds).toContain('CM-8'); // Inventory
      });

      it('should return laptop-specific controls', () => {
        const suggestions = getSuggestedControls('laptop', 'endpoint');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('SI-3'); // Malware protection
        expect(controlIds).toContain('SC-28'); // Encryption (high priority for mobile)
        expect(controlIds).toContain('MP-7'); // Media use controls
      });
    });

    describe('category-based fallback', () => {
      it('should fall back to server category controls for generic server types', () => {
        const suggestions = getSuggestedControls('application-server' as DeviceType, 'server');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('AC-3'); // Access enforcement
        expect(controlIds).toContain('AU-2'); // Audit logging
        expect(controlIds).toContain('SC-28'); // Encryption at rest
        expect(controlIds).toContain('SI-2'); // Flaw remediation
      });

      it('should use security category controls for generic security devices', () => {
        const suggestions = getSuggestedControls('security-appliance' as DeviceType, 'security');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('SC-8'); // Transmission confidentiality
        expect(controlIds).toContain('AC-4'); // Information flow
        expect(controlIds).toContain('AU-2'); // Auditable events
        expect(controlIds).toContain('SI-4'); // Monitoring
      });

      it('should use network category controls for generic network devices', () => {
        const suggestions = getSuggestedControls('network-device' as DeviceType, 'network');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('SC-8'); // Transmission security
        expect(controlIds).toContain('CM-7'); // Least functionality
        expect(controlIds).toContain('CM-8'); // Device inventory
      });

      it('should use endpoint category controls for generic endpoints', () => {
        const suggestions = getSuggestedControls('desktop-pc' as DeviceType, 'endpoint');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('SI-3'); // Malware protection
        expect(controlIds).toContain('SI-7'); // Software integrity
        expect(controlIds).toContain('CM-8'); // Inventory tracking
      });

      it('should use "other" category controls for unknown devices', () => {
        const suggestions = getSuggestedControls('mystery-device' as DeviceType, 'other');

        const controlIds = suggestions.map((s) => s.controlId);
        expect(controlIds).toContain('CM-8'); // Component inventory
        expect(controlIds).toContain('AC-2'); // Basic account management
      });
    });

    describe('suggestion properties', () => {
      it('should include priority for each suggestion', () => {
        const suggestions = getSuggestedControls('firewall', 'security');

        suggestions.forEach((suggestion) => {
          expect(['high', 'medium', 'low']).toContain(suggestion.priority);
        });
      });

      it('should include reason for each suggestion', () => {
        const suggestions = getSuggestedControls('database-server', 'server');

        suggestions.forEach((suggestion) => {
          expect(suggestion.reason).toBeDefined();
          expect(suggestion.reason.length).toBeGreaterThan(0);
        });
      });

      it('should include controlId for each suggestion', () => {
        const suggestions = getSuggestedControls('web-server', 'server');

        suggestions.forEach((suggestion) => {
          expect(suggestion.controlId).toBeDefined();
          expect(suggestion.controlId).toMatch(/^[A-Z]{2}-\d+$/);
        });
      });
    });
  });

  describe('getSuggestedControlIds', () => {
    it('should return array of control IDs only', () => {
      const ids = getSuggestedControlIds('firewall', 'security');

      expect(Array.isArray(ids)).toBe(true);
      ids.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[A-Z]{2}-\d+$/);
      });
    });

    it('should match the controls from getSuggestedControls', () => {
      const suggestions = getSuggestedControls('database-server', 'server');
      const ids = getSuggestedControlIds('database-server', 'server');

      expect(ids).toEqual(suggestions.map((s) => s.controlId));
    });

    it('should return correct IDs for all device type overrides', () => {
      const deviceTypes: DeviceType[] = [
        'firewall',
        'database-server',
        'web-server',
        'vpn-gateway',
        'router',
        'switch',
        'workstation',
        'laptop',
      ];

      deviceTypes.forEach((deviceType) => {
        const ids = getSuggestedControlIds(deviceType, 'other');
        expect(ids.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getHighPriorityControls', () => {
    it('should return only high priority controls', () => {
      const highPriority = getHighPriorityControls('firewall', 'security');

      highPriority.forEach((suggestion) => {
        expect(suggestion.priority).toBe('high');
      });
    });

    it('should include SC-7 as high priority for firewall', () => {
      const highPriority = getHighPriorityControls('firewall', 'security');
      const controlIds = highPriority.map((s) => s.controlId);

      expect(controlIds).toContain('SC-7');
    });

    it('should include SC-28 as high priority for database-server', () => {
      const highPriority = getHighPriorityControls('database-server', 'server');
      const controlIds = highPriority.map((s) => s.controlId);

      expect(controlIds).toContain('SC-28');
    });

    it('should include SC-28 as high priority for laptop (mobile risk)', () => {
      const highPriority = getHighPriorityControls('laptop', 'endpoint');
      const controlIds = highPriority.map((s) => s.controlId);

      expect(controlIds).toContain('SC-28');
    });

    it('should filter out medium and low priority controls', () => {
      const allSuggestions = getSuggestedControls('firewall', 'security');
      const highPriority = getHighPriorityControls('firewall', 'security');

      const mediumLow = allSuggestions.filter(
        (s) => s.priority === 'medium' || s.priority === 'low'
      );

      // High priority should be a subset of all suggestions
      expect(highPriority.length).toBeLessThanOrEqual(allSuggestions.length);

      if (mediumLow.length > 0) {
        expect(highPriority.length).toBeLessThan(allSuggestions.length);
      }
    });

    it('should return empty array if no high priority controls exist', () => {
      // Create a scenario where all controls are medium/low
      // This tests the filter behavior
      const suggestions = getSuggestedControls('mystery-device' as DeviceType, 'other');
      const highPriority = getHighPriorityControls('mystery-device' as DeviceType, 'other');

      // For 'other' category, there may be no high priority controls
      const actualHighPriority = suggestions.filter((s) => s.priority === 'high');
      expect(highPriority.length).toBe(actualHighPriority.length);
    });
  });

  describe('shouldSuggestControls', () => {
    it('should return true for most device types', () => {
      const deviceTypes: DeviceType[] = [
        'firewall',
        'database-server',
        'web-server',
        'vpn-gateway',
        'router',
        'switch',
        'workstation',
        'laptop',
        'server',
        'access-point',
      ];

      deviceTypes.forEach((deviceType) => {
        expect(shouldSuggestControls(deviceType)).toBe(true);
      });
    });

    it('should return false for endpoint type', () => {
      expect(shouldSuggestControls('endpoint')).toBe(false);
    });

    it('should return false for generic-appliance type', () => {
      expect(shouldSuggestControls('generic-appliance' as DeviceType)).toBe(false);
    });

    it('should handle Azure service types', () => {
      const azureTypes: DeviceType[] = [
        'virtual-machine',
        'kubernetes-services',
        'azure-firewall',
        'key-vaults',
        'cosmos-db',
      ];

      azureTypes.forEach((deviceType) => {
        expect(shouldSuggestControls(deviceType)).toBe(true);
      });
    });
  });

  describe('getMinimumControlCount', () => {
    it('should return 4 for server category', () => {
      expect(getMinimumControlCount('server')).toBe(4);
    });

    it('should return 4 for security category', () => {
      expect(getMinimumControlCount('security')).toBe(4);
    });

    it('should return 3 for network category', () => {
      expect(getMinimumControlCount('network')).toBe(3);
    });

    it('should return 3 for endpoint category', () => {
      expect(getMinimumControlCount('endpoint')).toBe(3);
    });

    it('should return 1 for other category', () => {
      expect(getMinimumControlCount('other')).toBe(1);
    });

    it('should return 2 for unknown categories', () => {
      // TypeScript would prevent this, but testing runtime behavior
      expect(getMinimumControlCount('unknown-category' as DeviceCategorySummary)).toBe(2);
    });

    it('should ensure suggestions meet minimum count', () => {
      const categories: DeviceCategorySummary[] = [
        'server',
        'security',
        'network',
        'endpoint',
        'other',
      ];

      categories.forEach((category) => {
        const suggestions = getSuggestedControls('generic' as DeviceType, category);
        const minCount = getMinimumControlCount(category);
        expect(suggestions.length).toBeGreaterThanOrEqual(minCount);
      });
    });
  });

  describe('integration with topology analyzer categories', () => {
    it('should work with categorizeDevice results', () => {
      // These match the device types that would be categorized by topologyAnalyzer
      const testCases: Array<{ deviceType: DeviceType; expectedCategory: DeviceCategorySummary }> = [
        { deviceType: 'web-server', expectedCategory: 'server' },
        { deviceType: 'firewall', expectedCategory: 'security' },
        { deviceType: 'router', expectedCategory: 'network' },
        { deviceType: 'laptop', expectedCategory: 'endpoint' },
      ];

      testCases.forEach(({ deviceType, expectedCategory }) => {
        const suggestions = getSuggestedControls(deviceType, expectedCategory);
        expect(suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe('control suggestion consistency', () => {
    it('should not have duplicate control IDs in suggestions', () => {
      const deviceTypes: DeviceType[] = [
        'firewall',
        'database-server',
        'web-server',
        'vpn-gateway',
        'router',
        'switch',
        'workstation',
        'laptop',
      ];

      deviceTypes.forEach((deviceType) => {
        const suggestions = getSuggestedControls(deviceType, 'other');
        const controlIds = suggestions.map((s) => s.controlId);
        const uniqueIds = new Set(controlIds);

        expect(uniqueIds.size).toBe(controlIds.length);
      });
    });

    it('should have non-empty reasons for all suggestions', () => {
      const suggestions = getSuggestedControls('firewall', 'security');

      suggestions.forEach((suggestion) => {
        expect(suggestion.reason.trim().length).toBeGreaterThan(0);
      });
    });

    it('should have valid priority values for all suggestions', () => {
      const categories: DeviceCategorySummary[] = [
        'server',
        'security',
        'network',
        'endpoint',
        'other',
      ];

      categories.forEach((category) => {
        const suggestions = getSuggestedControls('generic' as DeviceType, category);
        suggestions.forEach((suggestion) => {
          expect(['high', 'medium', 'low']).toContain(suggestion.priority);
        });
      });
    });
  });
});
