# Terraform Test Fixtures

This directory contains test Terraform projects that you can use to verify CompliNIST's Terraform integration works correctly.

## Available Test Projects

### AWS Test Project (`aws-test-project/`)
A complete AWS infrastructure setup including:
- VPC, subnets, route tables
- Internet gateway
- Security groups
- EC2 instances
- RDS database
- S3 bucket

**To use:**
1. Navigate to `aws-test-project/`
2. Run `terraform init` (ensure AWS credentials are configured)
3. Use CompliNIST to select this directory and run plan

### Azure Test Project (`azure-test-project/`)
An Azure infrastructure setup including:
- Resource group
- Virtual network and subnets
- Network security groups
- Virtual machines
- SQL databases
- Storage accounts

**To use:**
1. Navigate to `azure-test-project/`
2. Run `terraform init` (ensure Azure credentials are configured)
3. Use CompliNIST to select this directory and run plan

## Quick Start

1. **Choose a project** (AWS or Azure)
2. **Initialize Terraform:**
   ```bash
   cd aws-test-project  # or azure-test-project
   terraform init
   ```

3. **Test with CompliNIST:**
   - Open CompliNIST application
   - Click the "Terraform" button in the header
   - Click "Select Directory & Run Plan"
   - Navigate to the test project directory you initialized
   - CompliNIST will automatically run `terraform plan` and show the visualization

## Notes

- These are **test configurations** only - do not apply to production environments
- Make sure you have appropriate cloud provider credentials configured
- The resources defined here will create real cloud resources if applied
- Use `terraform plan` for dry-run testing only


