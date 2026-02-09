import { describe, it, expect } from 'vitest';
import { analyzeTopology, categorizeDevice } from '@/lib/topology/topologyAnalyzer';
import type { DeviceCategorySummary } from '@/lib/topology/topologyAnalyzer';
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
  securityFeaturesTopology,
  encryptionVariantsTopology,
  crossZoneTopology,
} from '../../fixtures/topology/fixtures/network-configurations';

describe('topologyAnalyzer', () => {
  describe('categorizeDevice', () => {
    it('should categorize server devices correctly', () => {
      expect(categorizeDevice('server')).toBe('server');
      expect(categorizeDevice('web-server')).toBe('server');
      expect(categorizeDevice('database-server')).toBe('server');
      expect(categorizeDevice('file-server')).toBe('server');
      expect(categorizeDevice('application-server')).toBe('server');
    });

    it('should categorize security devices correctly', () => {
      expect(categorizeDevice('firewall')).toBe('security');
      expect(categorizeDevice('vpn-gateway')).toBe('security');
      expect(categorizeDevice('security-appliance')).toBe('security');
      expect(categorizeDevice('ids-sensor')).toBe('security');
      expect(categorizeDevice('ips-appliance')).toBe('security');
    });

    it('should categorize network devices correctly', () => {
      expect(categorizeDevice('router')).toBe('network');
      expect(categorizeDevice('switch')).toBe('network');
      expect(categorizeDevice('vpn-gateway')).toBe('security'); // contains 'vpn' matches security first
      expect(categorizeDevice('network-gateway')).toBe('network'); // contains 'gateway'
      expect(categorizeDevice('load-balancer')).toBe('network');
      expect(categorizeDevice('proxy')).toBe('network');
    });

    it('should categorize endpoint devices correctly', () => {
      expect(categorizeDevice('laptop')).toBe('endpoint');
      expect(categorizeDevice('workstation')).toBe('endpoint');
      expect(categorizeDevice('endpoint')).toBe('endpoint');
      expect(categorizeDevice('pc-desktop')).toBe('endpoint');
      expect(categorizeDevice('iot-device')).toBe('endpoint');
    });

    it('should return "other" for unknown device types', () => {
      expect(categorizeDevice(undefined)).toBe('other');
      expect(categorizeDevice('')).toBe('other');
      expect(categorizeDevice('mystery-appliance')).toBe('other');
      expect(categorizeDevice('cloud-connector')).toBe('other');
      expect(categorizeDevice('access-point')).toBe('other'); // doesn't match any pattern
      expect(categorizeDevice('generic-appliance')).toBe('other');
    });

    it('should handle case-insensitive matching', () => {
      expect(categorizeDevice('SERVER')).toBe('server');
      expect(categorizeDevice('Firewall')).toBe('security');
      expect(categorizeDevice('ROUTER')).toBe('network');
      expect(categorizeDevice('LapTop')).toBe('endpoint');
    });
  });

  describe('analyzeTopology', () => {
    describe('empty topology', () => {
      it('should handle empty nodes and edges', () => {
        const result = analyzeTopology(emptyTopology.nodes, emptyTopology.edges);

        expect(result.boundaries.count).toBe(0);
        expect(result.boundaries.zones).toEqual([]);
        expect(result.devices.total).toBe(0);
        expect(result.connections.total).toBe(0);
        expect(result.security.mfaEnabled).toBe(0);
      });
    });

    describe('single device topology', () => {
      it('should analyze a single device without boundaries', () => {
        const result = analyzeTopology(
          singleDeviceTopology.nodes,
          singleDeviceTopology.edges
        );

        expect(result.devices.total).toBe(1);
        expect(result.boundaries.count).toBe(0);
        expect(result.connections.total).toBe(0);
        expect(result.devices.byType['web-server']).toBe(1);
      });

      it('should track security features for single device', () => {
        const result = analyzeTopology(
          singleDeviceTopology.nodes,
          singleDeviceTopology.edges
        );

        expect(result.security.mfaEnabled).toBe(1);
        expect(result.security.encryptionAtRest).toBe(1);
        expect(result.security.encryptionInTransit).toBe(1);
      });
    });

    describe('simple DMZ network', () => {
      it('should detect boundary zones correctly', () => {
        const result = analyzeTopology(simpleDmzNetwork.nodes, simpleDmzNetwork.edges);

        expect(result.boundaries.count).toBe(1);
        expect(result.boundaries.zones[0].name).toBe('DMZ Zone');
        expect(result.boundaries.zones[0].zoneType).toBe('dmz');
      });

      it('should associate devices with their parent boundary', () => {
        const result = analyzeTopology(simpleDmzNetwork.nodes, simpleDmzNetwork.edges);
        const dmzBoundary = result.boundaries.zones.find(
          (z) => z.name === 'DMZ Zone'
        );

        expect(dmzBoundary?.deviceCount).toBe(3);
        expect(dmzBoundary?.devices).toContain('fw-1');
        expect(dmzBoundary?.devices).toContain('web-1');
        expect(dmzBoundary?.devices).toContain('db-1');
      });

      it('should count devices by type', () => {
        const result = analyzeTopology(simpleDmzNetwork.nodes, simpleDmzNetwork.edges);

        expect(result.devices.byType['firewall']).toBe(1);
        expect(result.devices.byType['web-server']).toBe(1);
        expect(result.devices.byType['database-server']).toBe(1);
      });

      it('should detect encrypted connections', () => {
        const result = analyzeTopology(simpleDmzNetwork.nodes, simpleDmzNetwork.edges);

        // One edge with firewalled=true, one with encryptionProtocol
        expect(result.connections.encrypted).toBe(2);
      });
    });

    describe('enterprise network with multiple zones', () => {
      it('should detect multiple security zones', () => {
        const result = analyzeTopology(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        expect(result.boundaries.count).toBe(3);
        const zoneNames = result.boundaries.zones.map((z) => z.name);
        expect(zoneNames).toContain('DMZ');
        expect(zoneNames).toContain('Internal Network');
        expect(zoneNames).toContain('AWS Cloud');
      });

      it('should correctly group devices by zone', () => {
        const result = analyzeTopology(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        // DMZ should have 3 devices, Internal 5, Cloud 2
        const dmz = result.boundaries.zones.find((z) => z.name === 'DMZ');
        const internal = result.boundaries.zones.find(
          (z) => z.name === 'Internal Network'
        );
        const cloud = result.boundaries.zones.find((z) => z.name === 'AWS Cloud');

        expect(dmz?.deviceCount).toBe(3);
        expect(internal?.deviceCount).toBe(5);
        expect(cloud?.deviceCount).toBe(2);
      });

      it('should detect cross-zone connections', () => {
        const result = analyzeTopology(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        // web-dmz -> db-internal, router-internal -> vpn-gw, vpn-gw -> cloud-app
        expect(result.connections.crossZone).toBeGreaterThanOrEqual(2);
      });

      it('should categorize devices into servers, network equipment, and endpoints', () => {
        const result = analyzeTopology(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        expect(result.devices.servers.length).toBeGreaterThan(0);
        expect(result.devices.networkEquipment.length).toBeGreaterThan(0);
        expect(result.devices.endpoints.length).toBeGreaterThanOrEqual(1);
      });

      it('should group devices by operating system', () => {
        const result = analyzeTopology(
          enterpriseNetwork.nodes,
          enterpriseNetwork.edges
        );

        expect(result.devices.byOS['Cisco ASA']).toBe(1);
        expect(result.devices.byOS['Windows 11']).toBe(1);
        expect(result.devices.byOS['nginx']).toBe(1);
      });
    });

    describe('wireless network topology', () => {
      it('should detect wireless devices', () => {
        const result = analyzeTopology(wirelessNetwork.nodes, wirelessNetwork.edges);

        expect(result.devices.byType['access-point']).toBe(1);
        expect(result.devices.byType['wireless-router']).toBe(1);
        expect(result.devices.byType['laptop']).toBe(2);
      });

      it('should categorize laptops as endpoints', () => {
        const result = analyzeTopology(wirelessNetwork.nodes, wirelessNetwork.edges);

        const endpoints = result.devices.endpoints;
        const laptopNames = endpoints.map((d) => d.name);
        expect(laptopNames).toContain('Employee Laptop');
        expect(laptopNames).toContain('Guest Laptop');
      });
    });

    describe('cloud-only topology', () => {
      it('should handle Azure cloud services', () => {
        const result = analyzeTopology(cloudOnlyNetwork.nodes, cloudOnlyNetwork.edges);

        expect(result.devices.total).toBe(6);
        expect(result.boundaries.count).toBe(1);
        expect(result.devices.byType['azure-firewall']).toBe(1);
        expect(result.devices.byType['cosmos-db']).toBe(1);
      });
    });

    describe('large network', () => {
      it('should handle networks with many devices', () => {
        const result = analyzeTopology(largeNetwork.nodes, largeNetwork.edges);

        expect(result.devices.total).toBe(12);
        expect(result.devices.byType['server']).toBe(12);
        expect(result.connections.total).toBe(11);
      });

      it('should track all servers', () => {
        const result = analyzeTopology(largeNetwork.nodes, largeNetwork.edges);

        expect(result.devices.servers.length).toBe(12);
      });
    });

    describe('nested boundaries', () => {
      it('should detect devices in nested boundaries', () => {
        const result = analyzeTopology(nestedBoundaries.nodes, nestedBoundaries.edges);

        expect(result.boundaries.count).toBe(3);
        expect(result.devices.total).toBe(2);
      });
    });

    describe('unknown devices', () => {
      it('should handle devices without types', () => {
        const result = analyzeTopology(
          unknownDevicesTopology.nodes,
          unknownDevicesTopology.edges
        );

        expect(result.devices.total).toBe(4);
        // Empty string becomes 'unknown' key
        expect(result.devices.byType['unknown'] || result.devices.byType['']).toBeDefined();
      });

      it('should categorize unknown devices appropriately', () => {
        const result = analyzeTopology(
          unknownDevicesTopology.nodes,
          unknownDevicesTopology.edges
        );

        // Check each device's category based on actual categorization logic
        const deviceCategories = result.devices.details.map((d) => ({
          name: d.name,
          category: d.category,
        }));

        // '' (empty) -> 'other'
        // 'mystery-device' contains 'device' -> 'endpoint'
        // 'generic-appliance' -> 'other'
        // 'endpoint' contains 'endpoint' -> 'endpoint'
        const otherDevices = result.devices.details.filter(
          (d) => d.category === 'other'
        );
        const endpointDevices = result.devices.details.filter(
          (d) => d.category === 'endpoint'
        );
        expect(otherDevices.length).toBe(2); // empty type and generic-appliance
        expect(endpointDevices.length).toBe(2); // mystery-device and endpoint
      });
    });

    describe('security features aggregation', () => {
      it('should count MFA-enabled devices', () => {
        const result = analyzeTopology(
          securityFeaturesTopology.nodes,
          securityFeaturesTopology.edges
        );

        expect(result.security.mfaEnabled).toBe(2);
      });

      it('should count encryption at rest', () => {
        const result = analyzeTopology(
          securityFeaturesTopology.nodes,
          securityFeaturesTopology.edges
        );

        expect(result.security.encryptionAtRest).toBe(2);
      });

      it('should count encryption in transit', () => {
        const result = analyzeTopology(
          securityFeaturesTopology.nodes,
          securityFeaturesTopology.edges
        );

        expect(result.security.encryptionInTransit).toBe(2);
      });

      it('should count backups configured', () => {
        const result = analyzeTopology(
          securityFeaturesTopology.nodes,
          securityFeaturesTopology.edges
        );

        expect(result.security.backupsConfigured).toBe(2);
      });

      it('should count monitoring enabled', () => {
        const result = analyzeTopology(
          securityFeaturesTopology.nodes,
          securityFeaturesTopology.edges
        );

        expect(result.security.monitoringEnabled).toBe(2);
      });
    });

    describe('edge encryption detection', () => {
      it('should detect encryption via encryptionProtocol', () => {
        const result = analyzeTopology(
          encryptionVariantsTopology.nodes,
          encryptionVariantsTopology.edges
        );

        // 4 encrypted edges (TLS, authenticationRequired, firewalled, VPN linkType)
        // 1 unencrypted edge
        expect(result.connections.encrypted).toBe(4);
        expect(result.connections.total).toBe(5);
      });
    });

    describe('cross-zone connection detection', () => {
      it('should count cross-zone connections accurately', () => {
        const result = analyzeTopology(crossZoneTopology.nodes, crossZoneTopology.edges);

        // Same zone: device-a1 -> device-a2 (not cross-zone)
        // Cross-zone: device-a1 -> device-b1, device-b1 -> device-c1, device-a2 -> device-c1
        expect(result.connections.crossZone).toBe(3);
        expect(result.connections.total).toBe(4);
      });

      it('should not count same-zone connections as cross-zone', () => {
        const result = analyzeTopology(crossZoneTopology.nodes, crossZoneTopology.edges);

        // Total minus cross-zone should give same-zone connections
        const sameZoneConnections = result.connections.total - result.connections.crossZone;
        expect(sameZoneConnections).toBe(1);
      });
    });

    describe('device detail summaries', () => {
      it('should include all device details', () => {
        const result = analyzeTopology(simpleDmzNetwork.nodes, simpleDmzNetwork.edges);
        const webServer = result.devices.details.find((d) => d.id === 'web-1');

        expect(webServer).toBeDefined();
        expect(webServer?.name).toBe('Web Application Server');
        expect(webServer?.deviceType).toBe('web-server');
        expect(webServer?.operatingSystem).toBe('CentOS 8');
        expect(webServer?.ipAddress).toBe('192.168.1.10');
        expect(webServer?.encryptionInTransit).toBe(true);
      });

      it('should set boundary information for devices', () => {
        const result = analyzeTopology(simpleDmzNetwork.nodes, simpleDmzNetwork.edges);
        const dbServer = result.devices.details.find((d) => d.id === 'db-1');

        expect(dbServer?.boundaryId).toBe('dmz-boundary');
        expect(dbServer?.boundaryName).toBe('DMZ Zone');
        expect(dbServer?.zoneType).toBe('dmz');
      });
    });
  });
});
