# Terraform Example Templates

This directory contains example Terraform JSON configurations that can be imported into CompliNist to demonstrate the Terraform import functionality and provide reference architectures for common infrastructure patterns.

## Available Templates

### 1. AWS Three-Tier Web Application (`aws-three-tier-web-app.tf.json`)

**Description:** Classic three-tier architecture with public web tier, private application tier, and database tier.

**Components:**
- VPC with public and private subnets across 2 availability zones
- Internet Gateway and NAT Gateways for outbound connectivity
- Application Load Balancer (ALB) in public subnets
- EC2 web servers in private application subnets
- RDS PostgreSQL database in private database subnets
- Security groups with proper tier-based access controls
- Multi-AZ deployment for high availability

**Use Cases:**
- Traditional web applications
- E-commerce platforms
- Content management systems

**NIST Controls Demonstrated:**
- SC-7: Boundary Protection (security groups, network segmentation)
- SC-8: Transmission Confidentiality (HTTPS, SSL/TLS)
- CP-9: Information System Backup (RDS backups)
- SI-4: Information System Monitoring (potential for logging)

---

### 2. Azure Kubernetes Service Cluster (`azure-kubernetes-cluster.tf.json`)

**Description:** Production-ready Azure Kubernetes Service (AKS) cluster with monitoring, security, and autoscaling.

**Components:**
- Azure Resource Group
- Virtual Network with dedicated subnets for AKS and Application Gateway
- AKS cluster with auto-scaling node pools
- Container Registry with geo-replication
- Log Analytics workspace for monitoring
- Application Gateway for ingress
- Network Security Groups
- Azure Policy integration

**Use Cases:**
- Microservices architectures
- Container orchestration
- Cloud-native applications

**NIST Controls Demonstrated:**
- AC-6: Least Privilege (RBAC, managed identity)
- AU-2: Audit Events (Log Analytics)
- SC-7: Boundary Protection (NSGs, network policies)
- RA-5: Vulnerability Scanning (Azure Policy)

---

### 3. GCP VPC with Cloud SQL (`gcp-vpc-with-cloud-sql.tf.json`)

**Description:** Google Cloud Platform VPC with auto-scaling web tier and managed PostgreSQL database.

**Components:**
- Custom VPC with regional subnets
- Cloud Router and NAT for egress traffic
- Firewall rules for internal and external access
- Cloud SQL PostgreSQL with private IP and VPC peering
- Compute Engine instance templates
- Regional instance group with auto-scaling
- HTTP(S) Load Balancer with global anycast IP
- Health checks and auto-healing

**Use Cases:**
- Global web applications
- Applications requiring managed databases
- Auto-scaling workloads

**NIST Controls Demonstrated:**
- SC-7: Boundary Protection (firewall rules, VPC)
- SC-12: Cryptographic Key Establishment (SSL/TLS)
- CP-9: Backup and Recovery (Cloud SQL backups, PITR)
- SI-4: Monitoring (health checks)

---

### 4. AWS Lambda API Gateway (`aws-lambda-api-gateway.tf.json`)

**Description:** Serverless REST API using AWS Lambda and API Gateway with DynamoDB backend.

**Components:**
- AWS Lambda functions with VPC configuration
- API Gateway HTTP API with CORS
- DynamoDB table with global secondary index
- CloudWatch Log Groups for function and API logs
- IAM roles and policies for Lambda execution
- VPC, subnets, and security groups for Lambda
- Lambda permissions for API Gateway invocation

**Use Cases:**
- Serverless REST APIs
- Event-driven architectures
- Microservices backends

**NIST Controls Demonstrated:**
- AC-3: Access Enforcement (IAM policies)
- AU-2: Audit Events (CloudWatch Logs)
- SC-8: Transmission Confidentiality (HTTPS API)
- SC-13: Cryptographic Protection (DynamoDB encryption)

---

### 5. Multi-Cloud Network (`multi-cloud-network.tf.json`)

**Description:** Hybrid multi-cloud architecture connecting AWS and Azure with site-to-site VPN.

**Components:**
- AWS VPC with subnets and Internet Gateway
- Azure Virtual Network with subnets
- AWS VPN Gateway and Customer Gateway
- Azure VPN Gateway with BGP
- Site-to-site VPN connection between clouds
- Cross-cloud security groups/NSGs
- EC2 instance in AWS
- Azure VM in Azure
- Bidirectional network connectivity

**Use Cases:**
- Multi-cloud deployments
- Cloud migration scenarios
- Disaster recovery across clouds
- Geographic distribution

**NIST Controls Demonstrated:**
- SC-7: Boundary Protection (VPNs, security groups)
- SC-8: Transmission Confidentiality (IPsec VPN)
- SC-13: Cryptographic Protection (VPN encryption)
- CM-7: Least Functionality (network segmentation)

---

### 6. AWS S3 CloudFront CDN (`aws-s3-cloudfront-cdn.tf.json`)

**Description:** Global content delivery network for static websites with SSL/TLS and WAF protection.

**Components:**
- S3 buckets for website content and logs
- CloudFront distribution with global edge locations
- ACM SSL/TLS certificate with DNS validation
- Route53 DNS zones and records
- CloudFront Origin Access Identity for S3 security
- WAF Web ACL with rate limiting and managed rules
- Bucket versioning and encryption
- Custom error pages and cache behaviors

**Use Cases:**
- Static website hosting
- Single-page applications (SPAs)
- Global content distribution
- Media delivery

**NIST Controls Demonstrated:**
- SC-8: Transmission Confidentiality (HTTPS, TLS 1.2+)
- SC-13: Cryptographic Protection (S3 encryption)
- SI-4: Information System Monitoring (CloudFront/S3 logs)
- SC-5: Denial of Service Protection (WAF rate limiting)

---

## How to Use These Templates

### In CompliNist

1. **Import Template:**
   - Open CompliNist
   - Navigate to the Terraform import feature
   - Select one of these JSON files to import
   - CompliNist will parse the infrastructure and create a topology diagram

2. **Generate Control Narratives:**
   - After importing, use the AI assistant to analyze your topology
   - Generate control narratives based on the imported infrastructure
   - Review and customize the narratives for your SSP

3. **Create SSP:**
   - Use the SSP wizard to generate a System Security Plan
   - The topology and controls will be pre-populated from the import

### With Terraform CLI

These files can also be used directly with Terraform:

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply configuration (be careful - this creates real resources!)
terraform apply
```

**⚠️ WARNING:** Running `terraform apply` on these templates will create real cloud resources that may incur costs. These are examples for demonstration purposes. Always review and modify for your specific needs before applying.

## Customization

Before using these templates in production:

1. **Update Variables:**
   - Change region/location values
   - Update CIDR blocks to avoid conflicts
   - Modify instance sizes based on requirements

2. **Security:**
   - Replace placeholder passwords with secure secrets
   - Update SSH keys with your own public keys
   - Review and tighten security group/firewall rules
   - Configure proper IAM/RBAC policies

3. **Naming:**
   - Update resource names to match your naming conventions
   - Ensure bucket names are globally unique
   - Update DNS domain names

4. **Cost Optimization:**
   - Adjust instance sizes for your workload
   - Review backup retention periods
   - Consider reserved instances or savings plans
   - Remove unnecessary multi-AZ deployments for dev/test

## Architecture Patterns

These templates demonstrate several key architectural patterns:

- **Defense in Depth:** Multiple layers of security (network, application, data)
- **High Availability:** Multi-AZ/multi-region deployments
- **Least Privilege:** Minimal necessary permissions via IAM/RBAC
- **Encryption:** Data at rest and in transit
- **Monitoring:** Logging and observability built-in
- **Network Segmentation:** Public/private subnets and security boundaries

## NIST SP 800-53 Mapping

Each template includes components that help satisfy various NIST controls:

| Control Family | Examples in Templates |
|----------------|----------------------|
| AC (Access Control) | IAM roles, security groups, RBAC |
| AU (Audit and Accountability) | CloudWatch, Log Analytics, Cloud Logging |
| CM (Configuration Management) | Infrastructure as Code, version control |
| CP (Contingency Planning) | Backups, multi-AZ, disaster recovery |
| SC (System and Communications Protection) | VPNs, encryption, firewalls, WAF |
| SI (System and Information Integrity) | Health checks, monitoring, auto-healing |

## Contributing

To add more templates:

1. Create a new `.tf.json` file with descriptive name
2. Include comprehensive tags for resource identification
3. Add comments via the JSON structure where helpful
4. Update this README with template details
5. Ensure templates follow security best practices

## License

These templates are provided as examples for CompliNist users. Modify and use as needed for your compliance and infrastructure needs.
