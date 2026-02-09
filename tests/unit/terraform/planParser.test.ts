import { describe, it, expect } from 'vitest'
import { parseTerraformPlan, validateTerraformPlan, extractChangeSummary } from '@/lib/terraform/planParser'
import awsSimplePlan from '../../fixtures/terraform/fixtures/aws-simple.json'
import invalidPlan from '../../fixtures/terraform/fixtures/invalid-plan.json'

describe('planParser', () => {
  describe('parseTerraformPlan', () => {
    it('should throw error for invalid JSON string', () => {
      expect(() => parseTerraformPlan('not valid json')).toThrow()
    })
    
    it('should throw error for plan without format_version', () => {
      expect(() => parseTerraformPlan('{}')).toThrow('Invalid Terraform plan')
    })
    
    it('should parse valid AWS plan', () => {
      const plan = parseTerraformPlan(JSON.stringify(awsSimplePlan))
      expect(plan.format_version).toBeDefined()
      expect(plan.resource_changes).toBeInstanceOf(Array)
    })
    
    it('should parse plan with resource_changes', () => {
      const plan = parseTerraformPlan(JSON.stringify(awsSimplePlan))
      expect(plan.resource_changes.length).toBeGreaterThan(0)
    })
  })
  
  describe('validateTerraformPlan', () => {
    it('should return false for null', () => {
      expect(validateTerraformPlan(null)).toBe(false)
    })
    
    it('should return false for plan without format_version', () => {
      expect(validateTerraformPlan({})).toBe(false)
    })
    
    it('should return true for valid plan', () => {
      expect(validateTerraformPlan(awsSimplePlan)).toBe(true)
    })
  })
  
  describe('extractChangeSummary', () => {
    it('should count create actions', () => {
      const summary = extractChangeSummary(awsSimplePlan)
      expect(summary.create).toBeGreaterThan(0)
    })
    
    it('should return zero for empty plan', () => {
      const emptyPlan = { format_version: '1.0', terraform_version: '1.5.0', resource_changes: [] }
      const summary = extractChangeSummary(emptyPlan)
      expect(summary.total).toBe(0)
    })
  })
})

