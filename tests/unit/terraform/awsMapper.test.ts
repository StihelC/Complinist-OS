import { describe, it, expect } from 'vitest'
import { AWSMapper } from '@/lib/terraform/resourceMappers/awsMapper'

describe('AWSMapper', () => {
  const mapper = new AWSMapper()
  
  it('should map aws_instance to virtual-machine', () => {
    const result = mapper.mapResource('aws_instance', {
      instance_type: 't2.micro',
      tags: { Name: 'web-server' }
    })
    
    expect(result.deviceType).toBe('virtual-machine')
    expect(result.category).toBe('Compute')
    expect(result.iconPath).toContain('Aws/Compute')
    expect(result.defaultName).toBe('web-server')
  })
  
  it('should map aws_vpc to virtual-networks', () => {
    const result = mapper.mapResource('aws_vpc', {
      cidr_block: '10.0.0.0/16',
      tags: { Name: 'main-vpc' }
    })
    
    expect(result.deviceType).toBe('virtual-networks')
    expect(result.category).toBe('Networking')
  })
  
  it('should extract name from tags', () => {
    const result = mapper.mapResource('aws_instance', {
      tags: { Name: 'my-instance' }
    })
    expect(result.defaultName).toBe('my-instance')
  })
  
  it('should fallback for unknown resource type', () => {
    const result = mapper.mapResource('aws_unknown_thing', {})
    expect(result.deviceType).toBeDefined()
    expect(result.category).toBe('Other')
  })
  
  it('should map aws_security_group', () => {
    const result = mapper.mapResource('aws_security_group', {})
    expect(result.deviceType).toBe('network-security-groups')
  })
  
  it('should map aws_rds_instance', () => {
    const result = mapper.mapResource('aws_db_instance', {})
    expect(result.deviceType).toBe('sql-database')
  })
})

