# Test Terraform Project for CompliNIST

This is a test Terraform project that demonstrates various AWS resources for testing the CompliNIST Terraform integration.

## Resources Included

- **VPC** - Virtual Private Cloud
- **Internet Gateway** - For public internet access
- **Subnet** - Public subnet for resources
- **Route Table** - Routing configuration
- **Security Group** - Network security rules
- **EC2 Instance** - Virtual machine
- **RDS Instance** - MySQL database
- **S3 Bucket** - Object storage

## Setup Instructions

1. **Initialize Terraform:**
   ```bash
   cd tests/terraform/test-fixtures/aws-test-project
   terraform init
   ```

2. **Configure AWS Credentials:**
   Make sure you have AWS credentials configured (via AWS CLI, environment variables, or credentials file).

3. **Plan (Dry Run):**
   ```bash
   terraform plan -out=plan.tfplan
   ```

4. **Convert to JSON for CompliNIST:**
   ```bash
   terraform show -json plan.tfplan > plan.json
   ```

   Or use CompliNIST's built-in directory selection feature which will do this automatically!

## Using with CompliNIST

1. Open CompliNIST
2. Click the "Terraform" button in the header
3. Click "Select Directory & Run Plan"
4. Navigate to this directory: `tests/terraform/test-fixtures/aws-test-project`
5. CompliNIST will automatically run `terraform plan` and visualize the changes

## Notes

- This is a **test configuration** - do not apply to production
- The AWS resources use placeholder AMI IDs and credentials
- Make sure you have appropriate AWS credentials configured before running
- This will create real AWS resources if you run `terraform apply` - be careful!


