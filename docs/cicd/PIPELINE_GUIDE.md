# CI/CD Pipeline User Guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding the Pipeline](#understanding-the-pipeline)
3. [Running the Pipeline](#running-the-pipeline)
4. [Reading Pipeline Logs](#reading-pipeline-logs)
5. [Working with Artifacts](#working-with-artifacts)
6. [Deployment Procedures](#deployment-procedures)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)
9. [FAQ](#faq)

---

## Quick Start

### First-Time Setup

1. **Ensure GitLab Runner is configured**:
   ```bash
   # Check if runners are available (Project Settings > CI/CD > Runners)
   ```

2. **Configure required CI/CD variables** (Settings > CI/CD > Variables):
   - `DEV_DEPLOY_SCRIPT` (optional) - Path to dev deployment script
   - `STAGING_DEPLOY_SCRIPT` (optional) - Path to staging deployment script
   - `PROD_DEPLOY_SCRIPT` (required for prod) - Path to production deployment script
   - `PROD_ROLLBACK_SCRIPT` (required for prod) - Path to rollback script

3. **Push code to trigger pipeline**:
   ```bash
   git push origin main
   ```

4. **Monitor pipeline in GitLab**:
   - Go to: CI/CD > Pipelines
   - Click on the running pipeline to see details

### Daily Workflow

For most developers, you don't need to do anything special. The pipeline runs automatically:

1. Create a merge request
2. Pipeline runs automatically on your branch
3. Fix any failures
4. Merge when pipeline passes

---

## Understanding the Pipeline

### Pipeline Stages Overview

The pipeline has 7 stages that run sequentially:

```
.pre → validate → test → security → build → deploy-dev → deploy-staging → deploy-prod
```

**Time to completion**: ~15-25 minutes for full pipeline

### What Happens at Each Stage?

#### .pre Stage (Hidden)
- Installs npm dependencies
- Creates cache for faster subsequent runs
- **Duration**: 2-5 minutes

#### Validate Stage
- Checks TypeScript types
- Runs ESLint linter
- Verifies Prettier formatting
- **Duration**: 1-2 minutes
- **Runs in parallel**: Yes

#### Test Stage
- Runs unit tests with Vitest
- Generates code coverage report
- Runs E2E license tests
- **Duration**: 2-5 minutes
- **Runs in parallel**: Yes

#### Security Stage
- Scans for vulnerable dependencies (npm audit)
- Checks license compliance
- Performs static code analysis
- **Duration**: 1-3 minutes
- **Runs in parallel**: Yes
- **Failures**: Non-blocking (warnings only)

#### Build Stage
- Builds Linux packages (AppImage, .deb, .rpm)
- Builds Windows installer (.exe)
- Validates all artifacts were created
- **Duration**: 10-20 minutes
- **Runs in parallel**: Yes (Linux and Windows)

#### Deploy-Dev Stage
- Deploys to development environment
- **Trigger**: Automatic on main branch
- **Duration**: 2-5 minutes

#### Deploy-Staging Stage
- Deploys to staging environment
- **Trigger**: Manual (button click)
- **Duration**: 2-5 minutes

#### Deploy-Prod Stage
- Deploys to production environment
- **Trigger**: Manual (button click)
- **Requires**: Approval (configure in GitLab)
- **Duration**: 5-10 minutes

---

## Running the Pipeline

### Automatic Pipeline Triggers

The pipeline runs automatically when:

1. **Pushing to any branch**:
   ```bash
   git push origin feature-branch
   ```

2. **Creating a merge request**:
   - Pipeline runs on the source branch
   - Updates automatically on new commits

3. **Merging to main branch**:
   - Full pipeline runs including deployment to dev

4. **Creating a tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

### Manual Pipeline Triggers

You can manually trigger a pipeline:

1. Go to **CI/CD > Pipelines**
2. Click **Run Pipeline**
3. Select branch/tag
4. Click **Run Pipeline**

### Running Specific Jobs

To run only specific jobs:

1. Go to the pipeline view
2. Find the job you want to run
3. Click the **retry** icon (↻)

---

## Reading Pipeline Logs

### Understanding Pipeline Status

**Pipeline Status Icons**:
- ✓ (Green checkmark) - Job passed
- ✗ (Red X) - Job failed
- ⚠ (Yellow warning) - Job failed but allowed to continue
- ⏸ (Pause) - Job waiting for manual trigger
- ⏵ (Play) - Job can be manually triggered
- ⟳ (Loading) - Job currently running

### Reading Job Logs

**To view job logs**:

1. Click on the pipeline
2. Click on any job
3. View the log output in real-time

**Log Sections**:

```
┌─────────────────────────────────────┐
│ Job Setup                            │  ← GitLab prepares environment
├─────────────────────────────────────┤
│ Getting Source (git clone)          │  ← Downloads code
├─────────────────────────────────────┤
│ Downloading Artifacts                │  ← Gets artifacts from previous jobs
├─────────────────────────────────────┤
│ Restoring Cache                      │  ← Loads cached dependencies
├─────────────────────────────────────┤
│ before_script                        │  ← Pre-job setup commands
├─────────────────────────────────────┤
│ script                               │  ← Main job commands ⭐ MAIN SECTION
├─────────────────────────────────────┤
│ after_script                         │  ← Post-job commands (if any)
├─────────────────────────────────────┤
│ Saving Cache                         │  ← Updates cache (if policy allows)
├─────────────────────────────────────┤
│ Uploading Artifacts                  │  ← Stores job outputs
└─────────────────────────────────────┘
```

**Focus on the `script` section** - this is where the actual work happens and where errors will appear.

### Common Log Patterns

**Successful job**:
```
$ npm run build
✓ Built successfully
Uploading artifacts...
Job succeeded
```

**Failed job**:
```
$ npm run test
✗ Test suite failed
ERROR: Job failed: exit code 1
```

**Warning (allowed to fail)**:
```
$ npm audit
found 3 vulnerabilities
⚠ Job failed but allowed to fail
Job succeeded
```

---

## Working with Artifacts

### What Are Artifacts?

Artifacts are files produced by pipeline jobs that can be downloaded or passed to other jobs.

**CompliNist Artifacts**:
- **Build outputs**: AppImage, .deb, .rpm, .exe files
- **Test reports**: Coverage reports, test results
- **Security reports**: Vulnerability scans, license checks

### Downloading Artifacts

**Method 1: From Pipeline View**

1. Go to **CI/CD > Pipelines**
2. Click on the pipeline
3. Find the job with artifacts
4. Click **Browse** or **Download**

**Method 2: From Job View**

1. Open the job
2. Right sidebar shows artifacts
3. Click **Download** or **Browse**

### Artifact Locations

**Build artifacts** (build:linux, build:windows):
- Linux: `dist/*.AppImage`, `dist/*.deb`, `dist/*.rpm`
- Windows: `dist/*.exe`

**Coverage reports** (test:unit):
- `coverage/` directory
- View HTML report: `coverage/index.html`

**Security reports** (security:*):
- `npm-audit-report.json`
- `licenses.json`

### Artifact Retention

- Build artifacts: 90 days
- Test reports: 30 days
- Security reports: 30 days

After retention period, artifacts are automatically deleted.

---

## Deployment Procedures

### Development Deployment

**When**: Automatic on every commit to `main`

**What happens**:
1. Pipeline builds the application
2. All tests pass
3. `deploy:dev` job runs automatically
4. Application deployed to development environment

**No action needed** - this is fully automatic.

### Staging Deployment

**When**: Manual trigger after successful build

**How to deploy**:

1. Go to **CI/CD > Pipelines**
2. Find the pipeline you want to deploy
3. Go to the **deploy-staging** stage
4. Click the **play** button (⏵) next to `deploy:staging`
5. Confirm the deployment
6. Monitor the job logs

**Verify deployment**:
```bash
# Check staging URL
curl https://staging.complinist.example.com
```

### Production Deployment

**When**: Manual trigger after successful staging deployment

**⚠️ Important**: Production deployments should be coordinated with the team!

**How to deploy**:

1. **Verify staging is working** - Test thoroughly!
2. Go to **CI/CD > Pipelines**
3. Find the pipeline you want to deploy
4. Go to the **deploy-prod** stage
5. Click the **play** button (⏵) next to `deploy:production`
6. **Review the deployment summary**:
   - Version number
   - Commit hash
   - Branch/tag
7. If approvals are configured, wait for approval
8. Confirm the deployment
9. Monitor the job logs carefully
10. **Verify production immediately after deployment**

**Post-deployment checklist**:
- ✓ Application is accessible
- ✓ Health checks passing
- ✓ No error spike in logs
- ✓ Basic functionality working

### Rollback Procedures

If production deployment fails or causes issues:

**Immediate Rollback**:

1. Go to **CI/CD > Pipelines**
2. Find the failed production deployment pipeline
3. Go to the **deploy-prod** stage
4. Click the **play** button (⏵) next to `rollback:production`
5. Confirm the rollback
6. Monitor the rollback job
7. Verify production is restored

**Alternative Rollback** (deploy previous version):

1. Find the previous successful production deployment
2. Click **Retry** on that deployment job
3. Verify production is restored

For detailed rollback procedures, see [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md).

---

## Troubleshooting

### Pipeline Not Running

**Symptom**: Pipeline doesn't start after push

**Causes**:
1. No GitLab Runner available
2. Pipeline disabled in project settings
3. `.gitlab-ci.yml` syntax error

**Solutions**:

1. **Check Runners**:
   - Settings > CI/CD > Runners
   - Ensure at least one runner is active

2. **Check CI/CD is enabled**:
   - Settings > General > Visibility
   - Ensure CI/CD is enabled

3. **Validate YAML**:
   - CI/CD > Pipelines
   - Click "CI Lint" to validate syntax

---

### Job Stuck in "Pending" State

**Symptom**: Job shows pending indefinitely

**Causes**:
1. No available runners with matching tags
2. All runners busy

**Solutions**:

1. **Check runner tags**:
   - Job requires `docker` tag
   - Ensure runners have this tag

2. **Check runner capacity**:
   - Settings > CI/CD > Runners
   - View runner status

3. **Cancel and retry**:
   - Cancel the job
   - Retry after runners are available

---

### Validation Job Failing

**Job**: `validate:typecheck`, `validate:lint`, or `validate:format`

**Common Errors**:

**TypeScript errors**:
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```
**Solution**: Fix TypeScript errors locally
```bash
npm run typecheck
# Fix errors
git commit -am "fix: type errors"
git push
```

**ESLint errors**:
```
error  'x' is defined but never used  @typescript-eslint/no-unused-vars
```
**Solution**: Fix linting errors
```bash
npm run lint:fix
git commit -am "fix: linting errors"
git push
```

**Prettier errors**:
```
Code style issues found in the above file(s). Forgot to run Prettier?
```
**Solution**: Format code
```bash
npm run format
git commit -am "style: format code"
git push
```

---

### Test Job Failing

**Job**: `test:unit`

**Common Errors**:

**Test failures**:
```
FAIL src/components/MyComponent.test.tsx
✕ should render correctly
```

**Solution**: Fix tests locally
```bash
npm test
# Fix failing tests
git commit -am "fix: update tests"
git push
```

**Coverage below threshold**:
```
ERROR: Coverage for lines (45%) does not meet threshold (80%)
```

**Solution**: Add more tests or adjust threshold in `vitest.config.ts`

---

### Build Job Failing

**Job**: `build:linux` or `build:windows`

**Common Errors**:

**Native module rebuild failure**:
```
Error: Could not find napi.h
```
**Solution**: Already handled in pipeline, but if persists:
- Check `before_script` in build jobs
- Ensure `python3 make g++` are installed

**Out of memory**:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```
**Solution**: Increase Node.js memory
```yaml
# In .gitlab-ci.yml build jobs
script:
  - export NODE_OPTIONS="--max-old-space-size=4096"
  - npm run electron:build:linux
```

**Electron builder fails**:
```
ERROR: Cannot find module 'app-builder-bin'
```
**Solution**: Clear cache and rebuild
```bash
# Locally
npm run cache:clear
npm ci
npm run electron:build:linux
```

---

### Deployment Job Failing

**Job**: `deploy:dev`, `deploy:staging`, or `deploy:production`

**Common Errors**:

**Deployment script not found**:
```
bash: /path/to/deploy.sh: No such file or directory
```

**Solution**: Configure CI/CD variable
- Settings > CI/CD > Variables
- Add `*_DEPLOY_SCRIPT` variable with correct path
- Or update script path in `.gitlab-ci.yml`

**Permission denied**:
```
Permission denied (publickey)
```

**Solution**: Configure deployment credentials
- Add SSH key to CI/CD variables
- Or configure deployment service credentials

**Deployment script failed**:
```
ERROR: Deployment failed with exit code 1
```

**Solution**:
1. Check deployment script logs
2. Verify environment is accessible
3. Check deployment service status

---

### Cache Issues

**Symptom**: Jobs taking longer than usual, dependency errors

**Solution**: Clear and rebuild cache

1. **Clear cache via UI**:
   - CI/CD > Pipelines
   - Click "Clear Runner Caches"

2. **Clear cache via pipeline**:
   - Delete `node_modules/` locally
   - Update `package-lock.json`
   - Push changes
   - New cache will be created

---

### Artifact Download Issues

**Symptom**: Cannot download artifacts

**Causes**:
1. Artifacts expired
2. Job didn't upload artifacts
3. Network issues

**Solutions**:

1. **Check expiration**:
   - View job
   - Check "Artifacts" section
   - If expired, re-run the job

2. **Re-run job**:
   - Click retry on the job
   - Wait for completion
   - Download artifacts

---

## Best Practices

### For Developers

1. **Test locally before pushing**:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

2. **Use merge requests**:
   - Never push directly to `main`
   - Let pipeline run on feature branch
   - Fix issues before merging

3. **Watch your pipeline**:
   - Monitor pipeline after pushing
   - Fix failures quickly

4. **Keep commits focused**:
   - Small, logical commits
   - Easier to identify pipeline failures

### For Deployment

1. **Always test in staging first**:
   - Deploy to staging
   - Test thoroughly
   - Then deploy to production

2. **Deploy during low-traffic periods**:
   - Schedule production deployments
   - Coordinate with team

3. **Monitor after deployment**:
   - Watch logs
   - Check metrics
   - Verify functionality

4. **Have rollback plan ready**:
   - Know how to rollback
   - Keep previous version accessible

### For Pipeline Maintenance

1. **Review security reports weekly**:
   - Check `security:dependency-scan`
   - Update vulnerable dependencies

2. **Monitor pipeline performance**:
   - Track build times
   - Optimize slow jobs

3. **Keep dependencies updated**:
   - Update npm packages monthly
   - Test thoroughly after updates

4. **Document pipeline changes**:
   - Comment complex configurations
   - Update this guide

---

## FAQ

### Q: How long does the pipeline take?

**A**: Typical times:
- **Feature branch**: 10-15 minutes (validation, test, security)
- **Main branch with builds**: 20-30 minutes (includes builds and dev deployment)
- **With caching**: Can be 30-50% faster

### Q: Can I skip certain jobs?

**A**: No, but security jobs are non-blocking (allowed to fail). All other jobs must pass.

### Q: How do I add a new test?

**A**:
1. Add test file in `tests/` or `src/**/*.test.ts`
2. Push code
3. Pipeline will automatically run new tests

### Q: How do I update the pipeline?

**A**:
1. Edit `.gitlab-ci.yml`
2. Test in a feature branch first
3. Use "CI Lint" to validate syntax
4. Create merge request
5. Review pipeline changes
6. Merge when approved

### Q: Can I run the pipeline locally?

**A**: Partially. You can run individual commands:
```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run electron:build:linux
```

For full pipeline simulation, use [gitlab-runner](https://docs.gitlab.com/runner/commands/#gitlab-runner-exec) (advanced).

### Q: What if I need help?

**A**:
1. Check this guide and [PIPELINE_ARCHITECTURE.md](./PIPELINE_ARCHITECTURE.md)
2. Check [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)
3. Check job logs for error messages
4. Search GitLab CI/CD docs
5. Ask team members
6. Create an issue with pipeline link and error message

---

## Additional Resources

- [Pipeline Architecture](./PIPELINE_ARCHITECTURE.md) - Technical details
- [Interactive Walkthrough](./INTERACTIVE_WALKTHROUGH.md) - Hands-on tutorial
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) - Deployment procedures
- [Secrets Management](./SECRETS_MANAGEMENT.md) - Managing secrets safely
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)

---

**Last Updated**: 2026-01-10
**Pipeline Version**: 1.0.0
