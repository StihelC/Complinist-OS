# CI/CD Pipeline Quick Start Guide

**Get up and running with the CompliNist CI/CD pipeline in 15 minutes!**

## For the Absolute Beginner

Don't worry if you're new to CI/CD - this guide will walk you through everything step by step.

### What is CI/CD?

**CI/CD** stands for **Continuous Integration / Continuous Deployment**:

- **Continuous Integration (CI)**: Automatically tests your code whenever you push changes
- **Continuous Deployment (CD)**: Automatically deploys your code to servers

**Think of it as**: An automated assistant that tests, builds, and deploys your code for you!

---

## 🚀 5-Minute Setup

### Step 1: Check if Pipeline is Working

1. **Go to your project in GitLab**
2. **Click**: CI/CD → Pipelines (left sidebar)
3. **You should see**: A list of pipelines (or empty if none run yet)

**If you see an error**: GitLab Runners might not be configured. Contact your GitLab administrator.

### Step 2: Trigger Your First Pipeline

**Let's make a simple change to trigger the pipeline**:

1. **In your local project**, create a test file:
   ```bash
   echo "# Testing CI/CD" > TEST.md
   ```

2. **Commit and push**:
   ```bash
   git add TEST.md
   git commit -m "test: trigger CI/CD pipeline"
   git push origin main
   ```

3. **Go back to GitLab**: CI/CD → Pipelines

4. **You should see**: A new pipeline appear with status "Running"

5. **Click on the pipeline** to watch it run

**Congratulations!** 🎉 You just triggered your first pipeline!

### Step 3: Understand What's Happening

Your pipeline is now running through these stages:

1. **Validate** (1-2 min): Checking code quality
2. **Test** (2-5 min): Running automated tests
3. **Security** (1-3 min): Scanning for vulnerabilities
4. **Build** (10-20 min): Creating Linux and Windows installers

**Total time**: About 15-25 minutes

You can click on any job (blue boxes) to see what it's doing.

---

## 📚 What to Learn Next

### If You're a Developer

**Learn this first**:
1. [How to read pipeline logs](#reading-pipeline-logs)
2. [What to do if pipeline fails](#when-pipeline-fails)
3. [How to run tests locally](#running-tests-locally)

### If You're Deploying Code

**Learn this first**:
1. [How to deploy to staging](#deploying-to-staging)
2. [How to deploy to production](#deploying-to-production)
3. [How to rollback](#rolling-back)

### If You're Managing the Pipeline

**Learn this first**:
1. [Pipeline Architecture](./PIPELINE_ARCHITECTURE.md)
2. [Secrets Management](./SECRETS_MANAGEMENT.md)
3. [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)

---

## Reading Pipeline Logs

### Finding Logs

1. **Go to**: CI/CD → Pipelines
2. **Click**: On any pipeline
3. **Click**: On any job (e.g., "validate:typecheck")
4. **You'll see**: A terminal-like output

### Understanding Logs

**Successful job**:
```
$ npm run typecheck
✓ TypeScript check passed
Job succeeded
```
**Look for**: ✓ checkmarks and "Job succeeded"

**Failed job**:
```
$ npm run lint
✗ Error: 'unused' is assigned but never used
ERROR: Job failed: exit code 1
```
**Look for**: ✗ X marks and "ERROR"

### What to Focus On

**Don't read everything!** Look for:
- ✓ Success/failure at the end
- ✗ Error messages (in red, if colors enabled)
- The `script` section (where actual work happens)

---

## When Pipeline Fails

**Don't panic!** Pipeline failures are normal and help catch bugs early.

### Step 1: Find What Failed

1. **Open the pipeline**
2. **Look for red X** on failed job
3. **Click on the failed job**

### Step 2: Understand the Error

**Common failures**:

#### TypeScript Error
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'
```
**Fix**: Your code has a type error. Fix it in the mentioned file.

#### Lint Error
```
error  'x' is defined but never used  @typescript-eslint/no-unused-vars
```
**Fix**: Remove unused variable or use it.

#### Test Failure
```
FAIL src/components/MyComponent.test.tsx
✕ should render correctly
```
**Fix**: Update the test or fix the code being tested.

### Step 3: Fix and Push

1. **Fix the issue locally**
2. **Test locally** (see below)
3. **Commit and push**:
   ```bash
   git add .
   git commit -m "fix: resolve pipeline error"
   git push
   ```
4. **Pipeline will run again automatically**

---

## Running Tests Locally

**Always test locally BEFORE pushing!**

```bash
# Check code formatting
npm run format:check

# Check linting
npm run lint

# Check TypeScript types
npm run typecheck

# Run tests
npm test

# Run everything at once
npm run lint && npm run typecheck && npm test
```

**Pro tip**: If all these pass locally, the pipeline will likely pass too!

---

## Deploying to Staging

**Prerequisites**: Pipeline must complete the build stage successfully.

### Steps

1. **Go to**: CI/CD → Pipelines
2. **Find**: A successful pipeline (all green checkmarks)
3. **Scroll right**: To the "deploy-staging" column
4. **Click**: The play button (▶) next to "deploy:staging"
5. **Confirm**: Click "Run job"
6. **Wait**: About 2-5 minutes
7. **Verify**: Check staging URL works

**That's it!** Your code is now on staging.

---

## Deploying to Production

**⚠️ Important**: Only deploy to production after thorough staging testing!

### Pre-Deployment Checklist

- [ ] Staging tested and working
- [ ] Team aware of deployment
- [ ] Deploying during low-traffic time (if possible)

### Steps

1. **Go to**: CI/CD → Pipelines
2. **Find**: The pipeline you tested in staging
3. **Scroll right**: To the "deploy-prod" column
4. **Click**: The play button (▶) next to "deploy:production"
5. **Review carefully**: Version, commit, branch
6. **Confirm**: Click "Run job"
7. **Watch closely**: Monitor the entire deployment
8. **Verify immediately**: Test production after deployment

**Post-deployment**: Monitor for 30 minutes for any issues.

---

## Rolling Back

**If production has issues after deployment**:

### Quick Rollback

1. **Go to**: CI/CD → Pipelines
2. **Find**: The problematic production deployment
3. **Click**: Play button (▶) next to "rollback:production"
4. **Confirm**: Click "Run job"
5. **Monitor**: Watch rollback complete
6. **Verify**: Check production is working

**Rollback time**: Usually 2-5 minutes

---

## Common Questions

### Q: How long does the pipeline take?

**A**:
- Feature branches: 10-15 minutes (no builds)
- Main branch: 20-30 minutes (includes builds)

### Q: Can I skip the pipeline?

**A**: No, and you shouldn't want to! The pipeline catches bugs before they reach users.

### Q: What if I need urgent production fix?

**A**:
1. Create fix on a branch
2. Push and wait for pipeline to pass
3. Merge to main
4. Deploy to production immediately
5. The pipeline will still run all checks!

### Q: Can I run just one stage?

**A**: You can retry individual jobs, but stages run in sequence.

### Q: What if pipeline is stuck?

**A**:
1. Check if GitLab Runners are available (Settings → CI/CD → Runners)
2. If stuck >10 minutes, cancel and retry
3. If persists, contact GitLab administrator

### Q: Where are build artifacts?

**A**:
1. Open the pipeline
2. Click on "build:linux" or "build:windows"
3. Right sidebar → "Job artifacts" → Download

### Q: How do I know what version is deployed?

**A**: Look at the deployment job logs - it shows version and commit at the start.

---

## Getting Help

### Resources

1. **[Pipeline Guide](./PIPELINE_GUIDE.md)** - Comprehensive user guide
2. **[Interactive Walkthrough](./INTERACTIVE_WALKTHROUGH.md)** - Hands-on tutorial
3. **[Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)** - Deployment procedures
4. **[Pipeline Architecture](./PIPELINE_ARCHITECTURE.md)** - Technical details

### When Stuck

1. **Check the guides above** - Your answer is probably there
2. **Ask a team member** - They've probably seen it before
3. **Create an issue** - Include pipeline link and error message
4. **Contact DevOps** - For infrastructure issues

---

## Next Steps

### For Developers

1. ✅ You know how to trigger pipelines
2. ✅ You know how to read logs
3. ✅ You know how to fix failures

**Next**: [Interactive Walkthrough](./INTERACTIVE_WALKTHROUGH.md) for hands-on practice

### For Deployers

1. ✅ You know how to deploy to staging
2. ✅ You know how to deploy to production
3. ✅ You know how to rollback

**Next**: [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md) for detailed procedures

### For Administrators

1. ✅ Pipeline is set up
2. ✅ Basic configuration done

**Next**:
- [Secrets Management](./SECRETS_MANAGEMENT.md) - Configure deployment credentials
- [Pipeline Architecture](./PIPELINE_ARCHITECTURE.md) - Understand the design

---

## Congratulations! 🎉

You're now ready to use the CI/CD pipeline!

**Remember**:
- The pipeline is your friend - it catches bugs early
- Always test locally first
- When in doubt, check the documentation
- Don't be afraid to ask for help

**Happy deploying!** 🚀

---

**Quick Reference Card**

```
┌──────────────────────────────────────────────────────┐
│  COMMON COMMANDS                                     │
├──────────────────────────────────────────────────────┤
│  npm run lint          # Check code quality          │
│  npm run typecheck     # Check TypeScript            │
│  npm test              # Run tests                   │
│  git push              # Trigger pipeline            │
├──────────────────────────────────────────────────────┤
│  PIPELINE STAGES                                     │
├──────────────────────────────────────────────────────┤
│  validate → test → security → build → deploy        │
│  (2 min)   (5 min)  (3 min)   (20 min)  (varies)    │
├──────────────────────────────────────────────────────┤
│  DEPLOYMENT FLOW                                     │
├──────────────────────────────────────────────────────┤
│  dev (auto) → staging (manual) → prod (manual)       │
└──────────────────────────────────────────────────────┘
```

Print this and keep it at your desk!
