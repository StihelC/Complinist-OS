# CI/CD Pipeline Architecture

## Overview

The CompliNist CI/CD pipeline is built on GitLab CI/CD and provides automated testing, building, security scanning, and deployment for the Electron desktop application across multiple platforms (Linux and Windows).

## Design Philosophy

The pipeline is designed with the following principles:

1. **Speed**: Aggressive caching and parallel job execution
2. **Security**: Multiple security gates before production deployment
3. **Reliability**: Comprehensive testing at every stage
4. **Transparency**: Clear status indicators and detailed logging
5. **Safety**: Manual approval gates for production deployments
6. **Simplicity**: Easy to understand and modify for newcomers

## Pipeline Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitLab CI/CD Pipeline                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ .pre Stage                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐                                           │
│  │ install:dependencies │  ← Installs npm packages, creates cache   │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ VALIDATE Stage (Parallel Execution)                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌────────────┐  ┌──────────────┐              │
│  │ TypeScript    │  │  ESLint    │  │  Prettier    │              │
│  │ Type Check    │  │  Linting   │  │  Formatting  │              │
│  └───────────────┘  └────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ TEST Stage (Parallel Execution)                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌──────────────────┐                           │
│  │  Unit Tests   │  │   E2E License    │                           │
│  │  (Vitest)     │  │   Tests          │                           │
│  │  + Coverage   │  └──────────────────┘                           │
│  └───────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECURITY Stage (Parallel Execution)                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐            │
│  │ Dependency   │  │   License     │  │     SAST     │            │
│  │ Scanning     │  │   Compliance  │  │   (Static)   │            │
│  │ (npm audit)  │  │   Check       │  │   Analysis   │            │
│  └──────────────┘  └───────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ BUILD Stage (Parallel Execution)                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌─────────────────┐                            │
│  │  Build Linux  │  │  Build Windows  │                            │
│  │  (AppImage,   │  │  (.exe)         │                            │
│  │   .deb, .rpm) │  └─────────────────┘                            │
│  └───────────────┘                                                  │
│                    ↓                                                │
│             ┌──────────────┐                                        │
│             │   Validate   │  ← Verify artifacts exist              │
│             │   Artifacts  │                                        │
│             └──────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ DEPLOY-DEV Stage (Automatic)                                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐                                               │
│  │   Deploy to Dev  │  ← Automatic on main branch                  │
│  └──────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ DEPLOY-STAGING Stage (Manual)                                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐                                           │
│  │  Deploy to Staging   │  ← Requires manual trigger                │
│  └──────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ DEPLOY-PROD Stage (Manual + Approval)                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌──────────────────┐                     │
│  │ Deploy to Production│  │  Rollback Prod   │                     │
│  │ (Manual trigger)    │  │  (Manual only)   │                     │
│  └─────────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Pipeline Stages

### Stage 1: VALIDATE

**Purpose**: Ensure code quality and consistency before testing

**Jobs**:
- `validate:typecheck` - TypeScript type checking
- `validate:lint` - ESLint code quality checks
- `validate:format` - Prettier formatting verification

**Exit Criteria**: All validation jobs must pass

**Typical Duration**: 1-2 minutes

---

### Stage 2: TEST

**Purpose**: Run automated tests to verify functionality

**Jobs**:
- `test:unit` - Unit and integration tests with Vitest
  - Generates code coverage reports
  - Coverage threshold: (configurable)
- `test:e2e:license` - End-to-end license management tests
  - Allowed to fail (non-blocking)

**Exit Criteria**: Unit tests must pass

**Typical Duration**: 2-5 minutes

---

### Stage 3: SECURITY

**Purpose**: Identify security vulnerabilities and compliance issues

**Jobs**:
- `security:dependency-scan` - npm audit for known vulnerabilities
- `security:license-check` - Verify dependency licenses
- `security:sast` - Static Application Security Testing

**Exit Criteria**: All security jobs allowed to fail (non-blocking) but generate reports

**Typical Duration**: 1-3 minutes

---

### Stage 4: BUILD

**Purpose**: Create platform-specific distribution packages

**Jobs**:
- `build:linux` - Build for Linux (AppImage, .deb, .rpm)
- `build:windows` - Build for Windows (.exe installer)
- `build:validate` - Verify all build artifacts exist

**Technologies**:
- `electronuserland/builder:wine` Docker image
- electron-builder for packaging
- Platform-specific native module rebuilding

**Artifacts**:
- Linux: AppImage, .deb, .rpm packages
- Windows: .exe installer
- Retention: 90 days

**Exit Criteria**: All builds must succeed and validation must pass

**Typical Duration**: 10-20 minutes per platform (parallel)

---

### Stage 5: DEPLOY-DEV

**Purpose**: Automatically deploy to development environment

**Trigger**: Automatic on `main` branch commits

**Jobs**:
- `deploy:dev` - Deploy to development environment

**Environment**: development

**Exit Criteria**: Deployment script succeeds

**Typical Duration**: 2-5 minutes

---

### Stage 6: DEPLOY-STAGING

**Purpose**: Deploy to staging environment for final testing

**Trigger**: Manual

**Jobs**:
- `deploy:staging` - Deploy to staging environment

**Environment**: staging

**Exit Criteria**: Deployment script succeeds

**Typical Duration**: 2-5 minutes

---

### Stage 7: DEPLOY-PROD

**Purpose**: Deploy to production environment

**Trigger**: Manual (requires approval)

**Jobs**:
- `deploy:production` - Deploy to production
- `rollback:production` - Rollback deployment if needed

**Environment**: production

**Exit Criteria**: Deployment script succeeds

**Typical Duration**: 5-10 minutes

---

## Caching Strategy

The pipeline implements aggressive caching to minimize build times:

### Cache Keys

Based on `package-lock.json` hash to ensure cache invalidation when dependencies change.

### Cached Paths

- `node_modules/` - npm packages
- `.npm/` - npm cache
- `.cache/` - Electron, Cypress, and other tool caches

### Cache Policies

- **Pull**: Most jobs only pull from cache (read-only)
- **Pull-Push**: Only `install:dependencies` updates the cache

### Benefits

- **First run**: ~15-20 minutes
- **Cached runs**: ~5-10 minutes
- **Dependency changes**: Cache automatically invalidates

---

## Artifact Management

### Build Artifacts

**Linux**:
- `*.AppImage` - Universal Linux application
- `*.deb` - Debian/Ubuntu package
- `*.rpm` - RedHat/Fedora package
- `latest-linux.yml` - Update metadata

**Windows**:
- `*.exe` - Windows installer
- `latest.yml` - Update metadata

### Retention Policies

- Build artifacts: 90 days
- Test results: 30 days
- Security reports: 30 days
- Coverage reports: 30 days
- Deployment metadata: 1 year

### Storage Location

All artifacts stored in GitLab's artifact storage. Configure external storage (S3, GCS) for long-term retention.

---

## Environment Strategy

### Development

- **Trigger**: Automatic on main branch
- **Purpose**: Immediate feedback, testing new features
- **URL**: `https://dev.complinist.example.com`
- **Approvals**: None required
- **Rollback**: Automatic on failure

### Staging

- **Trigger**: Manual
- **Purpose**: Pre-production validation, QA testing
- **URL**: `https://staging.complinist.example.com`
- **Approvals**: None required
- **Rollback**: Manual trigger

### Production

- **Trigger**: Manual
- **Purpose**: Live user environment
- **URL**: `https://complinist.example.com`
- **Approvals**: Required (configure in GitLab)
- **Rollback**: Manual trigger with `rollback:production` job

---

## Security Gates

### Pre-Build Gates

1. **Code Quality**: ESLint, Prettier
2. **Type Safety**: TypeScript compilation
3. **Unit Tests**: Vitest test suite

### Pre-Deployment Gates

1. **Dependency Scanning**: npm audit
2. **License Compliance**: license-checker
3. **SAST**: Static code analysis
4. **Build Validation**: Artifact verification

### Production Gates

1. **Manual Approval**: Human verification required
2. **Staging Success**: Must deploy to staging first
3. **Security Reports**: Review before approval

---

## Performance Optimization

### Parallel Execution

Jobs in the same stage run in parallel when possible:
- All validation jobs run simultaneously
- All test jobs run simultaneously
- Linux and Windows builds run simultaneously

### Shallow Git Clones

`GIT_DEPTH: 10` reduces clone time by fetching only recent commits.

### Docker Layer Caching

Using consistent base images allows Docker layer reuse.

### Incremental Builds

TypeScript incremental compilation enabled where possible.

---

## Failure Handling

### Job Failure Behaviors

- **Validation failures**: Pipeline stops immediately
- **Test failures**: Pipeline stops immediately
- **Security failures**: Pipeline continues (warnings only)
- **Build failures**: Pipeline stops immediately
- **Deployment failures**: Pipeline stops, rollback available

### Retry Strategy

Manual retries only. No automatic retries to prevent infinite loops.

### Rollback Procedures

See [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) for detailed rollback procedures.

---

## Monitoring and Observability

### Pipeline Metrics

- Build duration
- Success/failure rate
- Artifact sizes
- Test coverage trends

### Notifications

Configure in GitLab:
- **Slack**: Pipeline status updates
- **Email**: Failure notifications
- **Teams**: Deployment confirmations

### Status Badges

Add to README.md:
```markdown
![Pipeline Status](https://gitlab.com/your-group/complinist/badges/main/pipeline.svg)
![Coverage](https://gitlab.com/your-group/complinist/badges/main/coverage.svg)
```

---

## Configuration Management

### GitLab CI/CD Variables

**Required Variables**:
- `DEV_DEPLOY_SCRIPT` - Path to development deployment script
- `STAGING_DEPLOY_SCRIPT` - Path to staging deployment script
- `PROD_DEPLOY_SCRIPT` - Path to production deployment script
- `PROD_ROLLBACK_SCRIPT` - Path to production rollback script

**Optional Variables**:
- `SLACK_WEBHOOK_URL` - For Slack notifications
- `S3_BUCKET` - For artifact storage
- `ARTIFACT_REGISTRY_URL` - Custom artifact registry

### Secrets Management

See [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) for detailed secrets configuration.

---

## Design Decisions

### Why GitLab CI/CD?

1. **Integrated**: Built into GitLab, no external service needed
2. **Powerful**: Advanced features like environments, approvals
3. **Flexible**: YAML-based, easy to customize
4. **Cost-effective**: Free tier generous for small teams

### Why Electron Builder?

1. **Multi-platform**: Single configuration for all platforms
2. **Auto-updates**: Built-in update mechanism
3. **Signing**: Code signing support
4. **Mature**: Well-tested and documented

### Why Manual Production Deploys?

1. **Safety**: Prevents accidental production updates
2. **Compliance**: Allows for change management process
3. **Coordination**: Enables team communication before deploy
4. **Rollback**: Manual trigger ensures deliberate action

---

## Maintenance

### Regular Tasks

- **Weekly**: Review security scan reports
- **Monthly**: Update base Docker images
- **Quarterly**: Review and optimize cache strategy
- **Yearly**: Audit pipeline performance and costs

### Updating the Pipeline

1. Test changes in a feature branch
2. Verify with merge request pipeline
3. Merge to main after approval
4. Monitor first few runs for issues

---

## Troubleshooting

For common pipeline issues, see [PIPELINE_GUIDE.md](./PIPELINE_GUIDE.md#troubleshooting).

For deployment issues, see [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md#troubleshooting).

---

## Further Reading

- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [Electron Builder Documentation](https://www.electron.build/)
- [npm Audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
