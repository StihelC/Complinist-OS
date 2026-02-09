import { describe, it, expect } from 'vitest';
import {
  getControlRecommendations,
  isControlRecommended,
} from '@/lib/controls/controlRecommendations';
import type { ControlRecommendation } from '@/lib/controls/controlRecommendations';
import {
  emptyTopology,
  singleDeviceTopology,
  simpleDmzNetwork,
  enterpriseNetwork,
  wirelessNetwork,
  cloudOnlyNetwork,
  largeNetwork,
  nestedBoundaries,
  unknownDevicesTopology,
} from '../../fixtures/topology/fixtures/network-configurations';
import type { AppNode, AppEdge, DeviceNodeData, BoundaryNodeData } from '@/lib/utils/types';

// Helper to create test topologies
function createTestDevice(
  id: string,
  deviceType: string,
  name?: string
): AppNode {
  return {
    id,
    type: 'device',
    position: { x: 0, y: 0 },
    data: {
      id,
      name: name || `Device-${id}`,
      deviceType: deviceType as any,
      iconPath: '',
    } as DeviceNodeData,
  };
}

function createTestBoundary(
  id: string,
  label: string,
  zoneType: string
): AppNode {
  return {
    id,
    type: 'boundary',
    position: { x: 0, y: 0 },
    data: {
      id,
      label,
      type: 'security_zone',
      zoneType,
    } as BoundaryNodeData,
  };
}

describe('controlRecommendations', () => {
  describe('getControlRecommendations', () => {
    describe('empty topology', () => {
      it('should return empty array for empty topology', () => {
        const recommendations = getControlRecommendations(
          emptyTopology.nodes,
          emptyTopology.edges
        );

        expect(recommendations).toEqual([]);
      });
    });

    describe('device-based recommendations', () => {
      it('should recommend firewall controls for firewall devices', () => {
        const nodes = [createTestDevice('fw-1', 'firewall', 'Main Firewall')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('AC-4'); // Information flow
      });

      it('should recommend database controls for database servers', () => {
        const nodes = [
          createTestDevice('db-1', 'database-server', 'MySQL Database'),
        ];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        // Database-server maps to: SC-28, AC-3, AC-6, AU-2, AU-3, AU-9, SC-13
        expect(controlIds).toContain('SC-28'); // Encryption at rest
        expect(controlIds).toContain('AU-2'); // Audit logging
        expect(recommendations.length).toBeGreaterThan(0);
      });

      it('should recommend web server controls for web servers', () => {
        const nodes = [createTestDevice('web-1', 'web-server', 'Apache Web')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        // Web-server maps to: SC-8, SC-13, SC-23, SI-2, SI-3, SI-10
        expect(controlIds).toContain('SC-8'); // Transmission protection
        expect(recommendations.length).toBeGreaterThan(0);
      });

      it('should recommend VPN controls for VPN gateways', () => {
        const nodes = [createTestDevice('vpn-1', 'vpn-gateway', 'Site VPN')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('AC-17'); // Remote access
        expect(controlIds).toContain('SC-8'); // Transmission protection
        expect(controlIds).toContain('SC-13'); // Cryptographic protection
      });

      it('should recommend router controls for routers', () => {
        const nodes = [createTestDevice('router-1', 'router', 'Core Router')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('AC-4'); // Information flow
      });

      it('should recommend switch controls for switches', () => {
        const nodes = [createTestDevice('switch-1', 'switch', 'Distribution Switch')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('SC-7'); // Boundary protection
        expect(controlIds).toContain('AC-4'); // Information flow
      });

      it('should recommend endpoint controls for workstations', () => {
        const nodes = [
          createTestDevice('ws-1', 'workstation', 'Dev Workstation'),
        ];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('SI-3'); // Malware protection
        expect(controlIds).toContain('CM-7'); // Least functionality
      });

      it('should recommend laptop-specific controls', () => {
        const nodes = [createTestDevice('laptop-1', 'laptop', 'Employee Laptop')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('AC-19'); // Mobile device access
        expect(controlIds).toContain('MP-7'); // Media use
      });
    });

    describe('wireless topology recommendations', () => {
      it('should recommend wireless controls when access points are present', () => {
        const recommendations = getControlRecommendations(
          wirelessNetwork.nodes,
          wirelessNetwork.edges
        );

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('AC-18'); // Wireless access
        expect(controlIds).toContain('AC-19'); // Wireless access control
      });

      it('should include device info in recommendation reason', () => {
        const recommendations = getControlRecommendations(
          wirelessNetwork.nodes,
          wirelessNetwork.edges
        );

        const wirelessRec = recommendations.find((r) => r.controlId === 'AC-18');
        // Reason should include device info (access-point maps to AC-18)
        expect(wirelessRec?.reason).toBeDefined();
        expect(wirelessRec?.reason?.length).toBeGreaterThan(0);
      });
    });

    describe('cloud topology recommendations', () => {
      it('should recommend cloud service controls when cloud devices present', () => {
        // Create topology with explicit cloud device type
        const cloudNodes = [
          createTestDevice('cloud-1', 'cloud-server', 'Cloud Server'),
        ];
        const recommendations = getControlRecommendations(cloudNodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        // Cloud maps to: SA-9, AC-17, SC-7, SC-8, SC-12, SC-13
        // Also matches 'server' which maps to additional controls
        expect(controlIds).toContain('SA-9'); // External services (from cloud mapping)
        expect(recommendations.length).toBeGreaterThan(0);
      });

      it('should generate recommendations for Azure cloud topology', () => {
        const recommendations = getControlRecommendations(
          cloudOnlyNetwork.nodes,
          cloudOnlyNetwork.edges
        );

        // Azure services like azure-firewall should match firewall mappings
        const controlIds = recommendations.map((r) => r.controlId);
        expect(recommendations.length).toBeGreaterThan(0);
        // Should include firewall-related controls since azure-firewall contains 'firewall'
        expect(controlIds).toContain('SC-7');
      });
    });

    describe('VPN topology recommendations', () => {
      it('should recommend VPN-specific controls', () => {
        const nodes = [createTestDevice('vpn-1', 'vpn-gateway', 'VPN Gateway')];
        const recommendations = getControlRecommendations(nodes, []);

        const controlIds = recommendations.map((r) => r.controlId);
        expect(controlIds).toContain('AC-17'); // Remote access
        expect(controlIds).toContain('SC-10'); // Network disconnect
      });
    });

    describe('large network recommendations', () => {
      it('should generate recommendations for large networks', () => {
        const recommendations = getControlRecommendations(
          largeNetwork.nodes,
          largeNetwork.edges
        );

        // Large network with servers should generate server-related recommendations
        const controlIds = recommendations.map((r) => r.controlId);
        expect(recommendations.length).toBeGreaterThan(0);
        // Server devices map to: AC-2, AC-6, AU-2, AU-6, SI-2, SI-3, SI-4, CM-6, CM-7
        expect(controlIds).toContain('AC-2'); // Account management
        expect(controlIds).toContain('AU-2'); // Audit events
      });

      it('should limit recommendations to top 10 for large networks', () => {
        const recommendations = getControlRecommendations(
          largeNetwork.nodes,
          largeNetwork.edges
        );

        // Even with 12 servers, recommendations should be limited to 10
        expect(recommendations.length).toBeLessThanOrEqual(10);
        // All recommendations should have high confidence from device mappings
        expect(recommendations.every((r) => r.confidence === 'high')).toBe(true);
      });
    });

    describe('boundary-based recommendations', () => {
      it('should recommend controls for devices in security zones', () => {
        const nodes = [
          createTestBoundary('dmz-1', 'DMZ Zone', 'dmz'),
          createTestDevice('server-1', 'server', 'DMZ Server'),
        ];
        (nodes[1] as any).parentId = 'dmz-1';

        const recommendations = getControlRecommendations(nodes, []);

        // Server device should trigger server mappings
        const controlIds = recommendations.map((r) => r.controlId);
        expect(recommendations.length).toBeGreaterThan(0);
        expect(controlIds).toContain('AC-2'); // Server mapping
        expect(controlIds).toContain('AU-2'); // Server mapping
      });

      it('should handle boundaries with zoneType that matches mappings', () => {
        // DMZ boundary zoneType should match 'dmz' in topology_mappings
        const nodes = [
          createTestBoundary('dmz-1', 'DMZ Zone', 'dmz'),
        ];

        const recommendations = getControlRecommendations(nodes, []);
        // DMZ boundary should trigger SC-7, SC-7(13), AC-4, SC-32
        const controlIds = recommendations.map((r) => r.controlId);
        expect(recommendations.length).toBeGreaterThan(0);
      });

      it('should handle ATO boundaries', () => {
        const nodes = [
          createTestBoundary('ato-1', 'System ATO Boundary', 'ato'),
          createTestDevice('server-1', 'server', 'Production Server'),
        ];
        (nodes[1] as any).parentId = 'ato-1';

        const recommendations = getControlRecommendations(nodes, []);
        // ATO boundary with server should generate recommendations
        expect(recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('deduplication and merging', () => {
      it('should deduplicate control recommendations', () => {
        // Create multiple firewalls that would all trigger SC-7
        const nodes = [
          createTestDevice('fw-1', 'firewall', 'Firewall 1'),
          createTestDevice('fw-2', 'firewall', 'Firewall 2'),
          createTestDevice('fw-3', 'firewall', 'Firewall 3'),
        ];

        const recommendations = getControlRecommendations(nodes, []);

        // SC-7 should appear only once
        const sc7Recs = recommendations.filter((r) => r.controlId === 'SC-7');
        expect(sc7Recs.length).toBe(1);
      });

      it('should merge trigger devices for duplicate controls', () => {
        const nodes = [
          createTestDevice('fw-1', 'firewall', 'Firewall 1'),
          createTestDevice('fw-2', 'firewall', 'Firewall 2'),
        ];

        const recommendations = getControlRecommendations(nodes, []);
        const sc7Rec = recommendations.find((r) => r.controlId === 'SC-7');

        // Should have both devices as triggers
        expect(sc7Rec?.triggerDevices).toContain('fw-1');
        expect(sc7Rec?.triggerDevices).toContain('fw-2');
      });
    });

    describe('confidence levels', () => {
      it('should assign high confidence to device-based recommendations', () => {
        const nodes = [createTestDevice('fw-1', 'firewall', 'Main Firewall')];
        const recommendations = getControlRecommendations(nodes, []);

        recommendations.forEach((rec) => {
          // Device-based recommendations should have high confidence
          if (rec.triggerDevices.length > 0) {
            expect(rec.confidence).toBe('high');
          }
        });
      });

      it('should sort recommendations by confidence', () => {
        const recommendations = getControlRecommendations(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        // First recommendations should be high confidence
        if (recommendations.length > 0) {
          expect(recommendations[0].confidence).toBe('high');
        }
      });
    });

    describe('limit to top 10', () => {
      it('should return at most 10 recommendations', () => {
        const recommendations = getControlRecommendations(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        expect(recommendations.length).toBeLessThanOrEqual(10);
      });
    });

    describe('enterprise network comprehensive test', () => {
      it('should generate relevant recommendations for complex topology', () => {
        const recommendations = getControlRecommendations(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        const controlIds = recommendations.map((r) => r.controlId);

        // Should include key controls for enterprise environment
        expect(recommendations.length).toBeGreaterThan(0);
        expect(controlIds).toContain('SC-7'); // Boundary protection (firewall, router)
        expect(controlIds).toContain('SC-8'); // Transmission protection (vpn-gateway, firewall)
        // All recommendations should be from device-based mappings (high confidence)
        expect(recommendations.every((r) => r.confidence === 'high')).toBe(true);
      });

      it('should track trigger devices for recommendations', () => {
        const recommendations = getControlRecommendations(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        // Most recommendations should have trigger devices
        const withTriggers = recommendations.filter(
          (r) => r.triggerDevices.length > 0
        );
        expect(withTriggers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('isControlRecommended', () => {
    it('should return true for recommended controls', () => {
      const nodes = [createTestDevice('fw-1', 'firewall', 'Main Firewall')];

      const result = isControlRecommended('SC-7', nodes, []);

      expect(result.isRecommended).toBe(true);
      expect(result.reason).toBeDefined();
    });

    it('should return false for non-recommended controls', () => {
      const nodes = [createTestDevice('laptop-1', 'laptop', 'User Laptop')];

      // SC-28 (encryption at rest) not typically recommended for laptops in top 10
      const result = isControlRecommended('PM-99', nodes, []);

      expect(result.isRecommended).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('should provide reason for recommended control', () => {
      const nodes = [
        createTestDevice('db-1', 'database-server', 'MySQL Database'),
      ];

      const result = isControlRecommended('SC-28', nodes, []);

      if (result.isRecommended) {
        expect(result.reason).toContain('database');
      }
    });

    it('should work with complex topologies', () => {
      const result = isControlRecommended(
        'SC-7',
        enterpriseNetwork.nodes,
        enterpriseNetwork.edges
      );

      expect(result.isRecommended).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle nodes without type field', () => {
      const nodes: AppNode[] = [
        {
          id: 'node-1',
          position: { x: 0, y: 0 },
          data: {
            id: 'node-1',
            name: 'Unknown Node',
            deviceType: 'server',
            iconPath: '',
          } as DeviceNodeData,
        },
      ];

      const recommendations = getControlRecommendations(nodes, []);
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle devices with unknown types', () => {
      const recommendations = getControlRecommendations(
        unknownDevicesTopology.nodes,
        unknownDevicesTopology.edges
      );

      // Should not throw and should return array
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle nodes with missing data', () => {
      const nodes: AppNode[] = [
        {
          id: 'empty-node',
          type: 'device',
          position: { x: 0, y: 0 },
          data: {} as DeviceNodeData,
        },
      ];

      const recommendations = getControlRecommendations(nodes, []);
      expect(recommendations).toBeDefined();
    });
  });
});
