import { describe, it, expect } from 'vitest'
import { findBestDeviceTypeMatch } from '@/lib/utils/deviceTypeMatcher'
import type { DeviceTypeRecord } from '@/lib/utils/deviceTypeMatcher'

describe('deviceTypeMatcher', () => {
  const mockDeviceTypes: DeviceTypeRecord[] = [
    {
      icon_path: 'src/Icons/Azure/Compute/Virtual-Machines.svg',
      device_type: 'virtual-machine',
      display_name: 'Virtual Machines',
      it_category: 'Compute',
      network_layer: 'Application'
    },
    {
      icon_path: 'src/Icons/Azure/Networking/Load-Balancers.svg',
      device_type: 'load-balancers',
      display_name: 'Load Balancers',
      it_category: 'Networking',
      network_layer: 'Network'
    },
    {
      icon_path: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
      device_type: 'virtual-machine',
      device_subtype: 'aws_instance',
      display_name: 'Amazon EC2',
      it_category: 'Compute',
      network_layer: 'Application'
    },
    {
      icon_path: 'src/Icons/Azure/Databases/Sql-Databases.svg',
      device_type: 'sql-database',
      display_name: 'SQL Databases',
      it_category: 'Databases',
      network_layer: 'Application'
    }
  ]

  describe('Exact Icon Path Match', () => {
    it('should match exact icon path with score 1.0', () => {
      const result = findBestDeviceTypeMatch(
        {
          iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.matchScore).toBe(1.0)
      expect(result.deviceType).toBe('virtual-machine')
      expect(result.matchReason).toBe('Exact icon path match')
    })
  })

  describe('Device Type Matching', () => {
    it('should match exact device type', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine',
          category: 'Compute'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.matchScore).toBeGreaterThan(0.5)
      expect(result.deviceType).toBe('virtual-machine')
    })

    it('should match similar device type with fuzzy matching', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'vm',
          category: 'Compute'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.deviceType).toBe('virtual-machine')
    })
  })

  describe('Provider-Specific Matching', () => {
    it('should prefer AWS icons for AWS provider', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine',
          provider: 'aws',
          resourceType: 'aws_instance',
          category: 'Compute'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.iconPath).toContain('/Aws/')
      expect(result.displayName).toBe('Amazon EC2')
    })

    it('should prefer Azure icons for Azure provider', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine',
          provider: 'azurerm',
          resourceType: 'azurerm_virtual_machine',
          category: 'Compute'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.iconPath).toContain('/Azure/')
      expect(result.displayName).toBe('Virtual Machines')
    })
  })

  describe('Category Matching', () => {
    it('should match by category', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'load-balancer',
          category: 'Networking'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.deviceType).toBe('load-balancers')
    })
  })

  describe('Keyword Matching', () => {
    it('should match based on resource type keywords', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'database',
          resourceType: 'azurerm_sql_database',
          provider: 'azurerm',
          category: 'Databases'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.deviceType).toBe('sql-database')
      expect(result.iconPath).toContain('Sql-Databases.svg')
    })
  })

  describe('Fallback Behavior', () => {
    it('should use category matching when device type unknown', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'unknown-type',
          category: 'Compute'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.deviceType).toBe('virtual-machine')  // First Compute type
      expect(result.matchReason).toContain('category')
    })

    it('should return generic fallback when no device types available', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'anything'
        },
        []
      )

      expect(result.matched).toBe(false)
      expect(result.deviceType).toBe('virtual-machine')
      expect(result.iconPath).toContain('Generic-Resource.svg')
      expect(result.matchReason).toContain('No device types available')
    })
  })

  describe('Subtype Matching', () => {
    it('should match device subtype', () => {
      const result = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine',
          deviceSubtype: 'aws_instance',
          provider: 'aws'
        },
        mockDeviceTypes
      )

      expect(result.matched).toBe(true)
      expect(result.deviceSubtype).toBe('aws_instance')
      expect(result.iconPath).toContain('Amazon-Ec2.svg')
    })
  })

  describe('Score Calculation', () => {
    it('should prioritize exact matches over fuzzy matches', () => {
      const exactMatch = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine',
          iconPath: 'src/Icons/Azure/Compute/Virtual-Machines.svg'
        },
        mockDeviceTypes
      )

      const fuzzyMatch = findBestDeviceTypeMatch(
        {
          deviceType: 'vm'
        },
        mockDeviceTypes
      )

      expect(exactMatch.matchScore).toBeGreaterThan(fuzzyMatch.matchScore)
    })

    it('should combine multiple matching criteria for higher scores', () => {
      const multiCriteriaMatch = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine',
          deviceSubtype: 'aws_instance',
          category: 'Compute',
          provider: 'aws',
          resourceType: 'aws_instance'
        },
        mockDeviceTypes
      )

      const singleCriteriaMatch = findBestDeviceTypeMatch(
        {
          deviceType: 'virtual-machine'
        },
        mockDeviceTypes
      )

      expect(multiCriteriaMatch.matchScore).toBeGreaterThan(singleCriteriaMatch.matchScore)
    })
  })
})
