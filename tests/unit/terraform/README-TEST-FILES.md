# Terraform Plan JSON Test Files

This directory contains test Terraform plan JSON files that can be used to test the Terraform file picker functionality.

## Available Test Files

### 1. `simple-test-plan.json`
A minimal test file with just a few resources:
- AWS VPC
- AWS Subnet  
- AWS EC2 Instance

**Use this for quick testing** - it's the simplest and fastest to load.

### 2. `test-plan.json`
A more comprehensive test file with multiple AWS resources:
- AWS VPC with subnets
- Internet Gateway
- Route Tables
- Security Groups
- EC2 Instance
- RDS Database Instance
- S3 Bucket with versioning

**Use this for comprehensive testing** - includes networking, compute, database, and storage resources.

### 3. `fixtures/azure-simple.json`
An Azure-based test file (existing):
- Azure Virtual Network
- Azure Subnet
- Network Security Group
- Virtual Machine
- SQL Database

## How to Test

1. Open the CompliNist application
2. Navigate to the Terraform view (if available)
3. Click "Select JSON File" button
4. Choose one of the test files from this directory
5. The application should load and parse the Terraform plan

## Generating Your Own Test File

To generate a Terraform plan JSON file from your own Terraform code:

```bash
# In your Terraform directory
terraform init
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > my-plan.json
```

Then use `my-plan.json` with the file picker.

## File Format

All test files follow the Terraform plan JSON format:
- `format_version`: Should be "1.0"
- `terraform_version`: Version string (e.g., "1.5.0")
- `resource_changes`: Array of resource change objects
  - Each resource has: `address`, `type`, `name`, `provider_name`, `mode`, `change`
  - `change` contains: `actions`, `before`, `after`

## Troubleshooting

If the file picker doesn't work:
1. Check that Electron API is available (this is an Electron app)
2. Verify the file is valid JSON
3. Ensure the file follows the Terraform plan format
4. Check browser console for errors


