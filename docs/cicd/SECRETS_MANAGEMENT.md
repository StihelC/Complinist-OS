# Secrets Management Guide

This guide provides comprehensive instructions for managing secrets, credentials, and sensitive configuration in the CompliNist CI/CD pipeline.

## Table of Contents

1. [Overview](#overview)
2. [Types of Secrets](#types-of-secrets)
3. [GitLab CI/CD Variables](#gitlab-cicd-variables)
4. [Best Practices](#best-practices)
5. [Secret Rotation](#secret-rotation)
6. [Common Secrets](#common-secrets)
7. [Troubleshooting](#troubleshooting)
8. [Security Checklist](#security-checklist)

---

## Overview

### What Are Secrets?

Secrets are sensitive pieces of information that should never be committed to source code:

- API keys and tokens
- Database credentials
- Deployment credentials (SSH keys, passwords)
- Service account credentials
- Encryption keys
- Third-party service credentials

### Why Proper Secret Management Matters

**Security risks of exposed secrets**:
- Unauthorized access to systems
- Data breaches
- Service abuse and cost overruns
- Compliance violations
- Reputational damage

**Proper secret management provides**:
- ✓ Secure storage
- ✓ Access control
- ✓ Audit trails
- ✓ Easy rotation
- ✓ Separation by environment

---

## Types of Secrets

### 1. Deployment Credentials

**Purpose**: Authenticate to deployment targets

**Examples**:
- SSH private keys
- Cloud provider credentials (AWS, GCP, Azure)
- FTP/SFTP passwords
- Container registry credentials

**Where to use**: Deployment jobs (`deploy:dev`, `deploy:staging`, `deploy:production`)

---

### 2. Service Credentials

**Purpose**: Authenticate to external services

**Examples**:
- npm registry tokens
- Docker Hub credentials
- Slack webhook URLs
- Email service API keys
- Monitoring service tokens

**Where to use**: Various pipeline jobs as needed

---

### 3. Signing Certificates

**Purpose**: Code signing for application authenticity

**Examples**:
- Windows code signing certificate
- macOS code signing certificate
- Linux package signing keys

**Where to use**: Build jobs (`build:windows`, `build:linux`)

---

### 4. Environment Variables

**Purpose**: Configuration specific to each environment

**Examples**:
- API endpoints
- Feature flags
- Database connection strings
- Third-party service URLs

**Where to use**: Application runtime configuration

---

## GitLab CI/CD Variables

### Accessing CI/CD Variables

**Navigate to**: Settings → CI/CD → Variables

### Variable Configuration Options

#### 1. Variable Types

**Variable**
- Standard environment variable
- Use for most secrets

**File**
- Creates a temporary file with the value
- Use for multi-line secrets (certificates, keys)

#### 2. Protection Status

**Protected Variables**
- Only available to protected branches (main, release/*)
- **Recommended for**: Production secrets

**Unprotected Variables**
- Available to all branches
- **Use for**: Development/staging secrets, non-sensitive values

#### 3. Masking

**Masked Variables**
- Value hidden in job logs (shows as `[MASKED]`)
- **Required for**: All sensitive values

**Unmasked Variables**
- Value visible in logs
- **Use only for**: Non-sensitive configuration

**⚠️ Masking Requirements**:
- Minimum 8 characters
- Must not contain special characters that break masking
- Test with simple alphanumeric values first

#### 4. Expansion

**Variable Expansion**
- Allows variable references like `$OTHER_VAR` in value
- **Use for**: Variables that reference other variables

**No Expansion**
- Raw value, no variable substitution
- **Use for**: Most secrets to avoid accidental expansion

---

### Adding a Secret Variable

**Step-by-step**:

1. **Navigate to**: Settings → CI/CD → Variables → Expand

2. **Click**: "Add variable"

3. **Configure**:
   - **Key**: Variable name (UPPERCASE_WITH_UNDERSCORES)
   - **Value**: Secret value
   - **Type**: Variable (or File for certificates)
   - **Environment scope**: All (or specific environment)
   - **Flags**:
     - ☑ **Protect variable** (for production secrets)
     - ☑ **Mask variable** (for all secrets)
     - ☐ **Expand variable reference** (usually unchecked)

4. **Click**: "Add variable"

---

### Variable Naming Conventions

**Use descriptive, consistent names**:

```
# Good
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
STAGING_DEPLOY_SSH_KEY
PROD_DATABASE_PASSWORD
SLACK_WEBHOOK_URL

# Bad
key
secret
password
token
```

**Prefixes by purpose**:
- `DEV_*` - Development environment
- `STAGING_*` - Staging environment
- `PROD_*` - Production environment
- `AWS_*` - AWS credentials
- `*_API_KEY` - API keys
- `*_TOKEN` - Authentication tokens

---

## Best Practices

### 1. Never Commit Secrets to Code

**❌ Never do this**:

```javascript
// BAD: Secret in code
const apiKey = 'sk_live_abc123xyz';

// BAD: Secret in config file
{
  "apiKey": "sk_live_abc123xyz"
}
```

**✅ Always do this**:

```javascript
// GOOD: Secret from environment
const apiKey = process.env.API_KEY;

// GOOD: Secret from config with env var
{
  "apiKey": "${API_KEY}"
}
```

### 2. Use Different Secrets per Environment

**Example**:

```yaml
# GitLab CI/CD Variables

# Development
DEV_API_KEY = sk_dev_...
DEV_DATABASE_URL = postgresql://dev...

# Staging
STAGING_API_KEY = sk_staging_...
STAGING_DATABASE_URL = postgresql://staging...

# Production (protected)
PROD_API_KEY = sk_prod_...
PROD_DATABASE_URL = postgresql://prod...
```

### 3. Principle of Least Privilege

**Grant minimum required access**:

- Development secrets: Read-only when possible
- Staging secrets: Similar to production, but isolated
- Production secrets: Full access, highly restricted

### 4. Regular Rotation

**Rotate secrets regularly**:

| Secret Type | Rotation Frequency |
|-------------|-------------------|
| Production credentials | Every 90 days |
| Staging credentials | Every 180 days |
| Development credentials | Every 365 days |
| Compromised secrets | **Immediately** |

### 5. Audit Access

**Regularly review**:
- Who has access to secrets (Settings → Members)
- Which branches can access protected variables
- When secrets were last updated
- Unused secrets (remove them)

### 6. Use Masking Always

**All sensitive variables should be masked**:

```yaml
# In GitLab CI/CD Variables
PROD_API_KEY
  Value: sk_prod_abc123xyz
  Masked: ☑ Yes
  Protected: ☑ Yes
```

**In logs, this appears as**:
```
Using API key: [MASKED]
```

### 7. Avoid Echoing Secrets

**❌ Never echo secrets**:

```yaml
script:
  - echo "API Key: $API_KEY"  # BAD: Will be visible even if masked
  - echo $DATABASE_PASSWORD   # BAD: Will be visible
```

**✅ Verify without exposing**:

```yaml
script:
  - test -n "$API_KEY" && echo "API key is set" || echo "API key is missing"
  - echo "Using API key ending in: ${API_KEY: -4}"  # Shows last 4 chars only
```

### 8. Use Files for Certificates

**For multi-line secrets** (SSH keys, certificates):

**Type**: File

**Value**:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...
...
-----END PRIVATE KEY-----
```

**Usage in pipeline**:
```yaml
script:
  - chmod 600 $SSH_PRIVATE_KEY_FILE
  - ssh -i $SSH_PRIVATE_KEY_FILE user@server
```

---

## Secret Rotation

### Why Rotate Secrets?

- Limit exposure window if compromised
- Comply with security policies
- Reduce risk from former team members
- Best practice for security hygiene

### Rotation Procedure

#### Step 1: Generate New Secret

**Example for AWS credentials**:

1. **Create new access key** in AWS Console
2. **Save new key** securely (password manager)
3. **Keep old key active** (don't delete yet)

#### Step 2: Update GitLab Variable

1. **Navigate to**: Settings → CI/CD → Variables
2. **Find the variable** to rotate
3. **Click**: Edit (pencil icon)
4. **Update value** with new secret
5. **Save changes**

#### Step 3: Test with New Secret

**Trigger a pipeline** to verify:

```yaml
# Add a test job
test:new-secret:
  stage: test
  script:
    - echo "Testing new secret configuration"
    - # Run command that uses the secret
    - test -n "$AWS_ACCESS_KEY_ID" && echo "AWS credentials configured"
  only:
    - main
  when: manual
```

1. **Trigger the test job**
2. **Verify it succeeds**
3. **Check application functionality**

#### Step 4: Revoke Old Secret

**Only after confirming new secret works**:

1. **Revoke/delete old secret** from source (AWS, service, etc.)
2. **Monitor for errors** over next 24-48 hours
3. **Document rotation** in change log

### Emergency Rotation

**If secret is compromised**:

#### Immediate Actions (0-15 min)

1. **Revoke compromised secret** immediately at source
2. **Generate new secret**
3. **Update GitLab variable** with new secret
4. **Trigger pipeline** to redeploy with new secret
5. **Monitor for unauthorized access**

#### Follow-up Actions (1-24 hours)

1. **Investigate compromise**:
   - How was it exposed?
   - What was accessed?
   - Who had access?

2. **Audit related systems**:
   - Review access logs
   - Check for unauthorized activities
   - Assess impact

3. **Document incident**:
   - Timeline of events
   - Actions taken
   - Lessons learned

4. **Implement preventions**:
   - Improve procedures
   - Add monitoring
   - Update training

---

## Common Secrets

### Deployment Secrets

#### SSH Private Key (for server deployment)

**Setup**:

1. **Generate SSH key**:
   ```bash
   ssh-keygen -t ed25519 -C "gitlab-ci-complinist" -f gitlab_ci_key
   ```

2. **Add public key to server**:
   ```bash
   cat gitlab_ci_key.pub
   # Copy to server's ~/.ssh/authorized_keys
   ```

3. **Add private key to GitLab**:
   - Key: `DEPLOY_SSH_PRIVATE_KEY`
   - Value: Contents of `gitlab_ci_key`
   - Type: File
   - Protected: ☑ Yes
   - Masked: ☑ Yes

**Usage in pipeline**:
```yaml
before_script:
  - chmod 600 $DEPLOY_SSH_PRIVATE_KEY
  - ssh-add $DEPLOY_SSH_PRIVATE_KEY

script:
  - scp dist/* user@server:/path/to/deploy/
```

---

#### AWS Credentials

**Setup**:

1. **Create IAM user** in AWS Console
2. **Generate access key**
3. **Add to GitLab**:
   - `AWS_ACCESS_KEY_ID`: Access key ID
   - `AWS_SECRET_ACCESS_KEY`: Secret access key
   - Both: Protected ☑, Masked ☑

**Usage in pipeline**:
```yaml
script:
  - aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
  - aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
  - aws s3 cp dist/ s3://my-bucket/ --recursive
```

---

### Service Credentials

#### Slack Notifications

**Setup**:

1. **Create Slack webhook**:
   - Go to Slack → Apps → Incoming Webhooks
   - Create webhook for your channel

2. **Add to GitLab**:
   - Key: `SLACK_WEBHOOK_URL`
   - Value: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX`
   - Protected: ☐ No (for all branches)
   - Masked: ☑ Yes

**Usage in pipeline**:
```yaml
after_script:
  - |
    curl -X POST $SLACK_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"Pipeline $CI_PIPELINE_STATUS for $CI_COMMIT_REF_NAME\"}"
```

---

#### npm Registry Token

**Setup**:

1. **Generate npm token**:
   ```bash
   npm login
   npm token create --read-only
   ```

2. **Add to GitLab**:
   - Key: `NPM_TOKEN`
   - Value: Token from step 1
   - Protected: ☐ No
   - Masked: ☑ Yes

**Usage in pipeline**:
```yaml
before_script:
  - echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc

script:
  - npm install
```

---

### Application Secrets

#### Database Connection String

**Setup**:

1. **Format connection string**:
   ```
   postgresql://username:password@host:port/database
   ```

2. **Add to GitLab** (per environment):
   - `DEV_DATABASE_URL`: Development database
   - `STAGING_DATABASE_URL`: Staging database
   - `PROD_DATABASE_URL`: Production database (Protected ☑)
   - All: Masked ☑

**Usage in application**:
```javascript
const dbUrl = process.env.DATABASE_URL;
const connection = createConnection(dbUrl);
```

**Usage in pipeline**:
```yaml
deploy:production:
  script:
    - export DATABASE_URL=$PROD_DATABASE_URL
    - node deploy-script.js
```

---

## Troubleshooting

### Secret Not Available in Job

**Symptom**: Variable is undefined or empty

**Causes**:
1. Variable not created
2. Variable is protected, but branch isn't protected
3. Variable scope doesn't match environment
4. Typo in variable name

**Solutions**:

1. **Verify variable exists**:
   - Settings → CI/CD → Variables
   - Check variable name matches exactly

2. **Check protection status**:
   - If variable is protected, only protected branches can access it
   - Either unprotect variable or protect branch

3. **Check environment scope**:
   - Variables can be scoped to specific environments
   - Ensure job environment matches variable scope

4. **Test in pipeline**:
   ```yaml
   debug:secrets:
     script:
       - test -n "$MY_SECRET" && echo "Secret is set" || echo "Secret is missing"
   ```

---

### Masked Value Appears in Logs

**Symptom**: Secret value visible in job logs

**Causes**:
1. Masking not enabled
2. Value too short (<8 characters)
3. Value contains special characters
4. Value revealed through indirect means

**Solutions**:

1. **Enable masking**:
   - Edit variable
   - Check "Mask variable"

2. **Ensure value meets masking requirements**:
   - At least 8 characters
   - Alphanumeric (some special chars work)

3. **Don't echo secrets**:
   ```yaml
   # Bad
   script:
     - echo $MY_SECRET

   # Good
   script:
     - test -n "$MY_SECRET" && echo "Secret configured"
   ```

4. **Test masking**:
   ```yaml
   test:masking:
     script:
       - echo "Secret value is: $MY_SECRET"  # Should show [MASKED]
   ```

---

### File Variable Not Created

**Symptom**: File variable doesn't create a file

**Cause**: Variable type set to "Variable" instead of "File"

**Solution**:

1. **Edit variable**
2. **Change Type to "File"**
3. **Save**

**Usage**:
```yaml
script:
  - cat $MY_CERT_FILE  # File path, not content
  - openssl x509 -in $MY_CERT_FILE -text
```

---

### Permission Denied on File

**Symptom**: Permission denied when using file variable

**Cause**: File created with wrong permissions

**Solution**:
```yaml
before_script:
  - chmod 600 $MY_PRIVATE_KEY_FILE

script:
  - ssh -i $MY_PRIVATE_KEY_FILE user@server
```

---

## Security Checklist

### Initial Setup

- [ ] All secrets stored in GitLab CI/CD Variables
- [ ] No secrets in source code
- [ ] No secrets in commit history
- [ ] `.gitignore` includes secret file patterns
- [ ] Team members know not to commit secrets

### Variable Configuration

- [ ] Production secrets are protected
- [ ] All sensitive values are masked
- [ ] Descriptive variable names used
- [ ] Variables scoped appropriately
- [ ] Unused variables removed

### Access Control

- [ ] Only necessary members have Maintainer/Owner access
- [ ] Protected branches configured (main, release/*)
- [ ] Branch protection enforced
- [ ] Regular access audits scheduled

### Rotation and Maintenance

- [ ] Rotation schedule defined
- [ ] Rotation procedures documented
- [ ] Calendar reminders set for rotation
- [ ] Emergency rotation procedure documented

### Monitoring and Response

- [ ] Failed authentication alerts configured
- [ ] Unusual access patterns monitored
- [ ] Incident response plan documented
- [ ] Emergency contacts defined

### Documentation

- [ ] This guide reviewed and understood
- [ ] Team trained on secret management
- [ ] Procedures documented in runbook
- [ ] Onboarding includes secret management training

---

## Additional Resources

- [GitLab CI/CD Variables Documentation](https://docs.gitlab.com/ee/ci/variables/)
- [HashiCorp Vault](https://www.vaultproject.io/) - Advanced secret management
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/)
- [Google Secret Manager](https://cloud.google.com/secret-manager)

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-10
**Review Schedule**: Quarterly or after security incidents
