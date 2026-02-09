import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from '@/core/stores/useFlowStore';
import { renderHook, act } from '@testing-library/react';

/**
 * Unit tests for cursor mode state management
 *
 * Tests:
 * 1. Placement mode state transitions
 * 2. Boundary drawing mode state transitions
 * 3. Mode clearing behavior
 * 4. State isolation between modes
 */

describe('Cursor Mode State Management', () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useFlowStore());
    act(() => {
      result.current.setPlacementMode(null);
      result.current.setBoundaryDrawingMode(null);
    });
  });

  describe('Placement Mode', () => {
    it('should initialize with null placement mode', () => {
      const { result } = renderHook(() => useFlowStore());
      expect(result.current.placementMode).toBeNull();
    });

    it('should set placement mode with device data', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'virtual-machine',
          iconFilename: 'Virtual-Machine.svg',
          displayName: 'Virtual Machine',
          deviceSubtype: 'server',
        });
      });

      expect(result.current.placementMode).toEqual({
        deviceType: 'virtual-machine',
        iconFilename: 'Virtual-Machine.svg',
        displayName: 'Virtual Machine',
        deviceSubtype: 'server',
      });
    });

    it('should clear placement mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'firewall',
          iconFilename: 'Firewall.svg',
          displayName: 'Firewall',
        });
      });

      expect(result.current.placementMode).not.toBeNull();

      act(() => {
        result.current.setPlacementMode(null);
      });

      expect(result.current.placementMode).toBeNull();
    });

    it('should call handlePlacementComplete to clear mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'database',
          iconFilename: 'Database.svg',
          displayName: 'Database',
        });
      });

      expect(result.current.placementMode).not.toBeNull();

      act(() => {
        result.current.handlePlacementComplete();
      });

      expect(result.current.placementMode).toBeNull();
    });
  });

  describe('Boundary Drawing Mode', () => {
    it('should initialize with null boundary drawing mode', () => {
      const { result } = renderHook(() => useFlowStore());
      expect(result.current.boundaryDrawingMode).toBeNull();
    });

    it('should set boundary drawing mode with boundary data', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setBoundaryDrawingMode({
          type: 'security_zone',
          label: 'Security Zone',
          color: '#dcfce7',
        });
      });

      expect(result.current.boundaryDrawingMode).toEqual({
        type: 'security_zone',
        label: 'Security Zone',
        color: '#dcfce7',
      });
    });

    it('should clear boundary drawing mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setBoundaryDrawingMode({
          type: 'ato',
          label: 'ATO Boundary',
          color: '#dbeafe',
        });
      });

      expect(result.current.boundaryDrawingMode).not.toBeNull();

      act(() => {
        result.current.setBoundaryDrawingMode(null);
      });

      expect(result.current.boundaryDrawingMode).toBeNull();
    });

    it('should support different boundary types', () => {
      const { result } = renderHook(() => useFlowStore());

      const boundaryTypes = [
        { type: 'ato' as const, label: 'ATO Boundary', color: '#dbeafe' },
        { type: 'network_segment' as const, label: 'Network Segment', color: '#fef9c3' },
        { type: 'security_zone' as const, label: 'Security Zone', color: '#dcfce7' },
        { type: 'physical_location' as const, label: 'Physical Location', color: '#fce7f3' },
        { type: 'datacenter' as const, label: 'Datacenter', color: '#e0e7ff' },
        { type: 'office' as const, label: 'Office', color: '#fef3c7' },
      ];

      boundaryTypes.forEach((boundary) => {
        act(() => {
          result.current.setBoundaryDrawingMode(boundary);
        });

        expect(result.current.boundaryDrawingMode).toEqual(boundary);
      });
    });
  });

  describe('Mode Isolation', () => {
    it('should allow both modes to be null simultaneously', () => {
      const { result } = renderHook(() => useFlowStore());

      expect(result.current.placementMode).toBeNull();
      expect(result.current.boundaryDrawingMode).toBeNull();
    });

    it('should allow placement mode without affecting boundary mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'firewall',
          iconFilename: 'Firewall.svg',
          displayName: 'Firewall',
        });
      });

      expect(result.current.placementMode).not.toBeNull();
      expect(result.current.boundaryDrawingMode).toBeNull();
    });

    it('should allow boundary mode without affecting placement mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setBoundaryDrawingMode({
          type: 'ato',
          label: 'ATO Boundary',
          color: '#dbeafe',
        });
      });

      expect(result.current.boundaryDrawingMode).not.toBeNull();
      expect(result.current.placementMode).toBeNull();
    });

    it('should allow both modes to be active simultaneously', () => {
      // Note: This shouldn't happen in UI, but store allows it
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'server',
          iconFilename: 'Server.svg',
          displayName: 'Server',
        });
        result.current.setBoundaryDrawingMode({
          type: 'security_zone',
          label: 'Security Zone',
          color: '#dcfce7',
        });
      });

      expect(result.current.placementMode).not.toBeNull();
      expect(result.current.boundaryDrawingMode).not.toBeNull();
    });

    it('should clear placement mode independently', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'database',
          iconFilename: 'Database.svg',
          displayName: 'Database',
        });
        result.current.setBoundaryDrawingMode({
          type: 'network_segment',
          label: 'Network Segment',
          color: '#fef9c3',
        });
      });

      act(() => {
        result.current.setPlacementMode(null);
      });

      expect(result.current.placementMode).toBeNull();
      expect(result.current.boundaryDrawingMode).not.toBeNull();
    });

    it('should clear boundary mode independently', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'loadbalancer',
          iconFilename: 'LoadBalancer.svg',
          displayName: 'Load Balancer',
        });
        result.current.setBoundaryDrawingMode({
          type: 'datacenter',
          label: 'Datacenter',
          color: '#e0e7ff',
        });
      });

      act(() => {
        result.current.setBoundaryDrawingMode(null);
      });

      expect(result.current.placementMode).not.toBeNull();
      expect(result.current.boundaryDrawingMode).toBeNull();
    });
  });

  describe('Mode Transitions', () => {
    it('should transition from placement to boundary mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'server',
          iconFilename: 'Server.svg',
          displayName: 'Server',
        });
      });

      expect(result.current.placementMode).not.toBeNull();

      act(() => {
        result.current.setPlacementMode(null);
        result.current.setBoundaryDrawingMode({
          type: 'ato',
          label: 'ATO Boundary',
          color: '#dbeafe',
        });
      });

      expect(result.current.placementMode).toBeNull();
      expect(result.current.boundaryDrawingMode).not.toBeNull();
    });

    it('should transition from boundary to placement mode', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setBoundaryDrawingMode({
          type: 'security_zone',
          label: 'Security Zone',
          color: '#dcfce7',
        });
      });

      expect(result.current.boundaryDrawingMode).not.toBeNull();

      act(() => {
        result.current.setBoundaryDrawingMode(null);
        result.current.setPlacementMode({
          deviceType: 'firewall',
          iconFilename: 'Firewall.svg',
          displayName: 'Firewall',
        });
      });

      expect(result.current.boundaryDrawingMode).toBeNull();
      expect(result.current.placementMode).not.toBeNull();
    });

    it('should return to default mode from any active mode', () => {
      const { result } = renderHook(() => useFlowStore());

      // From placement mode
      act(() => {
        result.current.setPlacementMode({
          deviceType: 'server',
          iconFilename: 'Server.svg',
          displayName: 'Server',
        });
      });

      act(() => {
        result.current.setPlacementMode(null);
      });

      expect(result.current.placementMode).toBeNull();
      expect(result.current.boundaryDrawingMode).toBeNull();

      // From boundary mode
      act(() => {
        result.current.setBoundaryDrawingMode({
          type: 'ato',
          label: 'ATO Boundary',
          color: '#dbeafe',
        });
      });

      act(() => {
        result.current.setBoundaryDrawingMode(null);
      });

      expect(result.current.placementMode).toBeNull();
      expect(result.current.boundaryDrawingMode).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting same placement mode twice', () => {
      const { result } = renderHook(() => useFlowStore());

      const placementData = {
        deviceType: 'firewall' as const,
        iconFilename: 'Firewall.svg',
        displayName: 'Firewall',
      };

      act(() => {
        result.current.setPlacementMode(placementData);
      });

      expect(result.current.placementMode).toEqual(placementData);

      act(() => {
        result.current.setPlacementMode(placementData);
      });

      expect(result.current.placementMode).toEqual(placementData);
    });

    it('should handle setting same boundary mode twice', () => {
      const { result } = renderHook(() => useFlowStore());

      const boundaryData = {
        type: 'security_zone' as const,
        label: 'Security Zone',
        color: '#dcfce7',
      };

      act(() => {
        result.current.setBoundaryDrawingMode(boundaryData);
      });

      expect(result.current.boundaryDrawingMode).toEqual(boundaryData);

      act(() => {
        result.current.setBoundaryDrawingMode(boundaryData);
      });

      expect(result.current.boundaryDrawingMode).toEqual(boundaryData);
    });

    it('should handle rapid mode changes', () => {
      const { result } = renderHook(() => useFlowStore());

      act(() => {
        result.current.setPlacementMode({
          deviceType: 'server',
          iconFilename: 'Server.svg',
          displayName: 'Server',
        });
        result.current.setPlacementMode(null);
        result.current.setBoundaryDrawingMode({
          type: 'ato',
          label: 'ATO',
          color: '#dbeafe',
        });
        result.current.setBoundaryDrawingMode(null);
      });

      expect(result.current.placementMode).toBeNull();
      expect(result.current.boundaryDrawingMode).toBeNull();
    });
  });
});
