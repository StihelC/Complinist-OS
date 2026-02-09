# Test Azure Terraform Project for CompliNIST

This is a test Terraform project that demonstrates various Azure resources for testing the CompliNIST Terraform integration.

## Resources Included

- **Resource Group** - Azure resource container
- **Virtual Network** - Azure VNet
- **Subnet** - Network subnet
- **Network Security Group** - Security rules
- **Public IP** - Public IP address
- **Network Interface** - NIC for VM
- **Virtual Machine** - Azure VM
- **SQL Server & Database** - Azure SQL
- **Storage Account** - Azure storage

## Setup Instructions

1. **Initialize Terraform:**
   ```bash
   cd tests/terraform/test-fixtures/azure-test-project
   terraform init
   ```

2. **Configure Azure Credentials:**
   ```bash
   az login
   az account set --subscription "your-subscription-id"
   ```

3. **Plan (Dry Run):**
   ```bash
   terraform plan -out=plan.tfplan
   ```

4. **Use with CompliNIST:**
   - Open CompliNIST
   - Click "Terraform" button
   - Select this directory
   - CompliNIST will run the plan automatically!

## Notes

- This is a **test configuration** - do not apply to production
- Make sure you have appropriate Azure credentials configured
- This will create real Azure resources if you run `terraform apply`


