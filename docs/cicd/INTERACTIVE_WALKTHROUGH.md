# CI/CD Pipeline Interactive Walkthrough

Welcome to the CompliNist CI/CD Pipeline interactive walkthrough! This hands-on guide will walk you through every aspect of the pipeline with real examples and exercises.

## 🎯 Learning Objectives

By the end of this walkthrough, you will be able to:
- ✓ Trigger and monitor pipelines
- ✓ Read and interpret pipeline logs
- ✓ Download and verify build artifacts
- ✓ Deploy to different environments
- ✓ Debug failed pipeline runs
- ✓ Perform rollbacks safely
- ✓ Manage secrets and variables
- ✓ Modify the pipeline configuration

**Prerequisites**: Basic knowledge of Git, familiarity with GitLab UI

---

## Part 1: Pipeline Architecture Overview (10 minutes)

### 1.1 Understanding the Pipeline Flow

Let's start by visualizing the pipeline. Navigate to your project in GitLab:

1. **Open GitLab** → Your Project → **CI/CD** → **Pipelines**
2. Click on any completed pipeline
3. Notice the stages across the top:
   ```
   [validate] → [test] → [security] → [build] → [deploy-dev] → [deploy-staging] → [deploy-prod]
   ```

**🔍 Exercise 1.1**: Count the stages
- How many stages do you see? (Answer: 7 stages)
- Which stages run automatically?
- Which stages require manual triggering?

### 1.2 The Pipeline Graph

Click on the pipeline graph tab (second tab) to see the visual representation:

```
        ┌─────────────┐
        │   install   │  ← .pre stage
        └──────┬──────┘
               │
      ┌────────┴────────┐
      │   validate      │
   ┌──┴──┬──────┬──────┴──┐
   │ TC  │ Lint │ Format  │
   └──┬──┴──────┴──────┬──┘
      └────────┬────────┘
               ↓
```

**TC** = TypeCheck, **Lint** = ESLint, **Format** = Prettier

**🔍 Exercise 1.2**: Identify parallel jobs
- Which jobs run in parallel in the validate stage?
- Why do you think they run in parallel?

---

## Part 2: Triggering Your First Pipeline (15 minutes)

### 2.1 Automatic Pipeline Trigger

Let's trigger a pipeline automatically by making a commit:

**Step-by-step**:

1. **Create a new branch**:
   ```bash
   git checkout -b test/pipeline-walkthrough
   ```

2. **Make a small change** (e.g., update README.md):
   ```bash
   echo "\n## Testing CI/CD Pipeline" >> README.md
   ```

3. **Commit and push**:
   ```bash
   git add README.md
   git commit -m "docs: testing CI/CD pipeline"
   git push origin test/pipeline-walkthrough
   ```

4. **Watch the pipeline start**:
   - Go to GitLab → CI/CD → Pipelines
   - You should see a new pipeline appear immediately
   - Status: "Running" with a spinning icon

**⏱️ Time check**: Pipeline should start within 5-10 seconds

**🔍 Exercise 2.1**: Monitor pipeline progress
- Watch the pipeline progress through each stage
- Note the time each stage takes
- Which stage takes the longest?

### 2.2 Manual Pipeline Trigger

Now let's trigger a pipeline manually:

1. **Navigate to**: CI/CD → Pipelines
2. **Click**: "Run Pipeline" button (top right)
3. **Select**:
   - Branch: `test/pipeline-walkthrough`
   - Variables: (leave empty for now)
4. **Click**: "Run Pipeline"

**🔍 Exercise 2.2**: Compare pipelines
- How is the manual pipeline different from the automatic one?
- (Answer: They're identical! Manual trigger is just another way to start)

---

## Part 3: Reading and Interpreting Logs (20 minutes)

### 3.1 Navigating to Job Logs

Let's examine the logs of a specific job:

1. **Open your pipeline**
2. **Click on the first job**: `validate:typecheck`
3. **Observe the log structure**:
   - Job setup (grey)
   - Getting source code
   - Restoring cache
   - Running script (main section)
   - Uploading artifacts

### 3.2 Understanding Log Output

**Successful job log** looks like this:

```bash
$ npm run typecheck
> complinist-desktop@1.0.0 typecheck
> tsc --noEmit --incremental

✨ TypeScript check passed
Job succeeded
```

**Key indicators of success**:
- ✓ No error messages
- ✓ "Job succeeded" at the end
- ✓ Green checkmark on job

**🔍 Exercise 3.1**: Analyze successful job
- Open the `validate:lint` job
- Find where ESLint starts running
- Look for the success message
- How many files did ESLint check?

### 3.3 Interpreting Failed Jobs

Let's intentionally create a failure to practice debugging:

1. **Create a file with a linting error**:
   ```bash
   echo "const unused = 'test'; export const foo = 'bar';" > src/test-file.ts
   git add src/test-file.ts
   git commit -m "test: intentional lint error"
   git push
   ```

2. **Wait for pipeline to run**
3. **Observe the `validate:lint` job fail**

**Failed job log** looks like this:

```bash
$ npm run lint

src/test-file.ts
  1:7  error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)

ERROR: Job failed: exit code 1
```

**Key indicators of failure**:
- ✗ Red X on job
- ✗ Error messages in log
- ✗ "ERROR: Job failed" message
- ✗ Exit code (non-zero)

**🔍 Exercise 3.2**: Debug the failure
- Identify the exact line causing the error
- What is the error message?
- How would you fix it?

**Fix the error**:
```bash
# Remove the test file
git rm src/test-file.ts
git commit -m "test: remove intentional error"
git push
```

### 3.4 Reading Test Results

Let's examine test output:

1. **Open the `test:unit` job**
2. **Find the test execution section**:

```bash
$ npm run test:coverage

 ✓ src/components/Button.test.tsx (2)
   ✓ renders correctly
   ✓ handles click events
 ✓ src/lib/utils.test.ts (5)
   ✓ formatDate formats correctly
   ...

Test Files  12 passed (12)
     Tests  156 passed (156)
  Duration  4.32s

Coverage:
  Lines       : 87.3%
  Statements  : 86.8%
  Functions   : 82.1%
  Branches    : 79.5%
```

**🔍 Exercise 3.3**: Analyze test coverage
- What is the line coverage percentage?
- How many test files ran?
- How long did tests take?

---

## Part 4: Working with Build Artifacts (15 minutes)

### 4.1 Finding Build Artifacts

After a successful build (main branch only), artifacts are created:

1. **Wait for pipeline to reach the `build` stage**
2. **Open the `build:linux` job**
3. **Look for "Uploading artifacts" section** at the end:
   ```
   Uploading artifacts...
   dist/*.AppImage: found 1 matching files
   dist/*.deb: found 1 matching files
   Artifacts uploaded successfully
   ```

### 4.2 Downloading Artifacts

**Method 1: From Pipeline View**

1. **Open pipeline**
2. **Find `build:linux` job**
3. **Click the download icon** (↓) next to the job
4. **Select**: Download artifacts

**Method 2: From Job View**

1. **Open `build:linux` job**
2. **Right sidebar** → "Job Artifacts"
3. **Click**: "Download" or "Browse"

**🔍 Exercise 4.1**: Download and inspect
- Download the Linux build artifacts
- Extract the archive
- Find the `.AppImage` file
- What is the file size?

### 4.3 Browsing Artifacts

Instead of downloading, you can browse artifacts:

1. **Open `build:linux` job**
2. **Right sidebar** → "Job Artifacts"
3. **Click**: "Browse"
4. **Navigate**: `dist/` folder
5. **See all generated files**:
   - `CompliNist-1.0.0.AppImage`
   - `complinist-desktop_1.0.0_amd64.deb`
   - `complinist-desktop-1.0.0.x86_64.rpm`

**🔍 Exercise 4.2**: Compare artifact sizes
- Browse both `build:linux` and `build:windows` artifacts
- Which platform has the larger installer?
- Why do you think that is?

### 4.4 Artifact Retention

Notice the expiration date:

- **Build artifacts**: 90 days
- **Test reports**: 30 days
- **Security reports**: 30 days

After expiration, artifacts are **automatically deleted** and cannot be recovered.

**💡 Pro Tip**: For long-term storage, download important artifacts locally or configure external artifact storage (S3, GCS).

---

## Part 5: Deploying to Environments (25 minutes)

### 5.1 Understanding Environments

CompliNist has three environments:

| Environment | Trigger | Purpose | URL |
|-------------|---------|---------|-----|
| Development | Automatic | Quick testing | `https://dev.complinist.example.com` |
| Staging | Manual | Pre-production QA | `https://staging.complinist.example.com` |
| Production | Manual + Approval | Live users | `https://complinist.example.com` |

### 5.2 Automatic Development Deployment

Development deploys automatically when you merge to `main`:

1. **Merge your test branch**:
   ```bash
   # In GitLab: Create merge request
   # Get approval
   # Click "Merge"
   ```

2. **Watch the pipeline**:
   - Pipeline runs on `main`
   - After build stage completes
   - `deploy:dev` job runs automatically

3. **View deployment**:
   - Click on `deploy:dev` job
   - See deployment logs
   - Verify deployment succeeded

**🔍 Exercise 5.1**: Monitor dev deployment
- What commands are run in the deployment?
- How long does deployment take?
- What would happen if deployment failed?

### 5.3 Manual Staging Deployment

Now let's deploy to staging manually:

**Prerequisites**:
- Pipeline must have completed the build stage
- Build artifacts must exist

**Steps**:

1. **Navigate to**: CI/CD → Pipelines
2. **Find the pipeline** you want to deploy
3. **Scroll to**: `deploy-staging` stage
4. **Notice**: The `deploy:staging` job has a "play" button (⏵)
5. **Click**: The play button
6. **Confirm**: "Run job" in the dialog
7. **Monitor**: The job starts and you can watch logs

**🔍 Exercise 5.2**: Practice staging deployment
- Deploy to staging
- Monitor the logs
- Check the environment URL
- What information is logged during deployment?

### 5.4 Production Deployment (Simulation)

**⚠️ Important**: In a real scenario, only deploy to production when:
- Staging has been thoroughly tested
- Team is aware and coordinated
- It's during a planned deployment window

**Steps** (we'll just observe, not actually deploy):

1. **Navigate to**: CI/CD → Pipelines
2. **Find the pipeline** (same one as staging)
3. **Scroll to**: `deploy-prod` stage
4. **Notice**: Two jobs:
   - `deploy:production` - Deploy to prod
   - `rollback:production` - Rollback prod deployment

5. **To deploy** (DON'T actually do this):
   - Click play button on `deploy:production`
   - Review deployment summary:
     ```
     ===================================================
     PRODUCTION DEPLOYMENT
     ===================================================
     Version: 1.0.0
     Commit: abc123
     Branch: main
     ===================================================
     ```
   - Wait for approval (if configured)
   - Confirm deployment

6. **Monitor carefully**:
   - Watch every log line
   - Verify success messages
   - Check production URL immediately after

**🔍 Exercise 5.3**: Deployment readiness checklist
Create a checklist for production deployment:
- [ ] Staging tested and working
- [ ] Team notified
- [ ] Backup/rollback plan ready
- [ ] ...what else?

---

## Part 6: Debugging Failed Pipeline Runs (30 minutes)

### 6.1 Common Failure Scenarios

Let's practice debugging different types of failures:

#### Scenario 1: TypeScript Error

**Create the error**:
```typescript
// In src/test-debug.ts
export function add(a: number, b: number): string {
  return a + b; // Type error: number returned, but string expected
}
```

**Commit and push**:
```bash
git add src/test-debug.ts
git commit -m "test: typescript error scenario"
git push
```

**Debug process**:
1. Wait for `validate:typecheck` to fail
2. Open the job
3. Find the error in logs:
   ```
   src/test-debug.ts:2:10 - error TS2322: Type 'number' is not assignable to type 'string'
   ```
4. Fix the error:
   ```typescript
   export function add(a: number, b: number): number {
     return a + b; // Fixed!
   }
   ```

**🔍 Exercise 6.1**: Fix it yourself
- Create the error
- Find the error in the logs
- Fix it locally
- Push the fix
- Verify pipeline passes

#### Scenario 2: Test Failure

**Create a failing test**:
```typescript
// src/test-debug.test.ts
import { describe, it, expect } from 'vitest';

describe('Math', () => {
  it('should add correctly', () => {
    expect(2 + 2).toBe(5); // Intentionally wrong!
  });
});
```

**Debug process**:
1. Wait for `test:unit` to fail
2. Open the job
3. Find the test failure:
   ```
   FAIL src/test-debug.test.ts
   ● Math › should add correctly

   expect(received).toBe(expected)

   Expected: 5
   Received: 4
   ```
4. Fix the test

**🔍 Exercise 6.2**: Analyze test failure
- Why did the test fail?
- What's the expected vs actual value?
- How would you fix it?

#### Scenario 3: Build Failure

Build failures are more complex. Let's understand common causes:

**Common build errors**:

1. **Missing dependency**:
   ```
   Error: Cannot find module 'some-package'
   ```
   **Fix**: Add to package.json and commit

2. **Native module error**:
   ```
   Error: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.28' not found
   ```
   **Fix**: Usually handled by Docker image, but check `before_script`

3. **Out of memory**:
   ```
   FATAL ERROR: JavaScript heap out of memory
   ```
   **Fix**: Increase NODE_OPTIONS in pipeline

**🔍 Exercise 6.3**: Simulate build debugging
- Review the `build:linux` job configuration
- Identify where dependencies are installed
- What happens if npm install fails?

### 6.2 Using the Retry Feature

When a job fails due to transient issues (network, timeout), you can retry:

1. **Find the failed job**
2. **Click the retry icon** (↻) in the top right
3. **Job re-runs** using the same configuration
4. **Other jobs** in the pipeline are not affected

**When to retry**:
- ✓ Network timeouts
- ✓ Temporary service unavailable
- ✓ Random infrastructure failures

**When NOT to retry**:
- ✗ Test failures (fix the test first)
- ✗ Linting errors (fix the code first)
- ✗ Build errors (fix the build first)

---

## Part 7: Managing Secrets and Variables (20 minutes)

### 7.1 Understanding CI/CD Variables

Variables allow you to configure the pipeline without changing code.

**Navigate to**: Settings → CI/CD → Variables

**Variable types**:
- **Unprotected**: Available to all branches
- **Protected**: Only available to protected branches (main, release/*)
- **Masked**: Hidden in job logs
- **Expanded**: Variable expansion enabled

### 7.2 Adding a Variable

Let's add a deployment script variable:

1. **Go to**: Settings → CI/CD → Variables
2. **Click**: "Add variable"
3. **Configure**:
   - **Key**: `DEV_DEPLOY_SCRIPT`
   - **Value**: `scripts/deploy-dev.sh`
   - **Type**: Variable
   - **Flags**:
     - ☐ Protect variable (uncheck for all branches)
     - ☐ Mask variable (uncheck, not sensitive)
     - ☑ Expand variable reference (check)
4. **Click**: "Add variable"

**🔍 Exercise 7.1**: Add variables
- Add `STAGING_DEPLOY_SCRIPT` variable
- Add `PROD_DEPLOY_SCRIPT` variable
- Which variables should be protected?

### 7.3 Using Variables in Pipeline

Variables are automatically available as environment variables:

```yaml
script:
  - echo "Deploying with: $DEV_DEPLOY_SCRIPT"
  - bash $DEV_DEPLOY_SCRIPT
```

**🔍 Exercise 7.2**: Verify variable usage
- Open the `deploy:dev` job logs
- Find where the variable is used
- Is the value visible in logs?

### 7.4 Managing Secrets

For sensitive values (API keys, passwords):

1. **Add variable** as before
2. **Enable "Mask variable"** flag
3. **Value will appear** as `[MASKED]` in logs

**Best practices**:
- ✓ Always mask sensitive values
- ✓ Use protected variables for production secrets
- ✓ Rotate secrets regularly
- ✓ Never commit secrets to code

**🔍 Exercise 7.3**: Create a masked variable
- Add a test secret: `TEST_API_KEY=sk_test_123456`
- Enable masking
- Add a test job that echoes the variable
- Verify it's masked in logs

For detailed secrets management, see [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md).

---

## Part 8: Performing Rollbacks (20 minutes)

### 8.1 Understanding Rollback Strategies

There are two rollback methods:

**Method 1: Rollback job** - Runs dedicated rollback script
**Method 2: Retry previous deployment** - Re-deploys previous version

### 8.2 Using the Rollback Job

**Scenario**: Production deployment has issues

**Steps**:

1. **Navigate to**: CI/CD → Pipelines
2. **Find**: The problematic production deployment pipeline
3. **Go to**: `deploy-prod` stage
4. **Click**: Play button (⏵) on `rollback:production` job
5. **Confirm**: "Run job"
6. **Monitor**: Rollback logs
7. **Verify**: Production is restored

**🔍 Exercise 8.1**: Rollback simulation
- Review the `rollback:production` job configuration
- What script does it run?
- What information does it log?
- How would you verify rollback succeeded?

### 8.3 Retry Previous Deployment

**Scenario**: Want to go back to a specific version

**Steps**:

1. **Navigate to**: CI/CD → Pipelines
2. **Find**: The previous successful production deployment
3. **Click**: On that pipeline
4. **Go to**: `deploy-prod` stage
5. **Click**: Retry icon (↻) on `deploy:production` job
6. **Confirm and monitor**

**🔍 Exercise 8.2**: Find previous deployment
- Navigate to pipelines
- Find the last 3 production deployments
- How can you identify which version each deployed?

### 8.4 Post-Rollback Checklist

After rollback:

- [ ] Verify application is accessible
- [ ] Check health endpoints
- [ ] Review logs for errors
- [ ] Notify team of rollback
- [ ] Create incident report
- [ ] Plan fix for the issue

---

## Part 9: Modifying the Pipeline (30 minutes)

### 9.1 Understanding Pipeline Syntax

The `.gitlab-ci.yml` file is written in YAML. Let's break down a job:

```yaml
job_name:                    # Unique job identifier
  stage: test                # Which stage this job belongs to
  script:                    # Commands to execute
    - echo "Running tests"
    - npm test
  artifacts:                 # Files to save after job
    paths:
      - coverage/
  when: on_success           # When to run (on_success, on_failure, always, manual)
  allow_failure: false       # Can this job fail without failing the pipeline?
```

### 9.2 Adding a New Job

Let's add a simple job to check dependency updates:

**Edit `.gitlab-ci.yml`**:

```yaml
# Add to the security stage
security:dependency-updates:
  stage: security
  script:
    - echo "Checking for outdated dependencies..."
    - npm outdated || true
    - echo "Check complete"
  allow_failure: true
  only:
    - main
  tags:
    - docker
```

**Commit and push**:
```bash
git add .gitlab-ci.yml
git commit -m "ci: add dependency update check"
git push
```

**Verify**:
1. Watch pipeline run
2. Find new `security:dependency-updates` job
3. Check the output

**🔍 Exercise 9.1**: Add your own job
- Add a job that counts lines of code
- Place it in the validate stage
- Make it run on all branches
- Verify it works

### 9.3 Using the CI Lint Tool

Before committing pipeline changes, validate syntax:

1. **Navigate to**: CI/CD → Pipelines
2. **Click**: "CI Lint" tab (or "Lint" button)
3. **Paste**: Your `.gitlab-ci.yml` content
4. **Click**: "Validate"
5. **Review**: Validation results
   - ✓ "CI configuration is valid"
   - ✗ "Syntax errors found"

**🔍 Exercise 9.2**: Practice CI Lint
- Intentionally break the YAML syntax
- Run CI Lint
- Read the error message
- Fix the syntax
- Validate again

### 9.4 Common Pipeline Modifications

**Add a notification**:
```yaml
after_script:
  - echo "Job completed, sending notification..."
  - curl -X POST $SLACK_WEBHOOK -d '{"text":"Pipeline completed"}'
```

**Run only on specific files changed**:
```yaml
rules:
  - changes:
      - "src/**/*.ts"
```

**Add environment variables**:
```yaml
variables:
  NODE_ENV: production
  LOG_LEVEL: info
```

**🔍 Exercise 9.3**: Customize your pipeline
Choose one modification and implement it:
- Add a notification
- Add a rule to run only on specific file changes
- Add a custom environment variable

---

## Part 10: Monitoring and Metrics (15 minutes)

### 10.1 Pipeline Status Badges

Add status badges to your README:

**Edit `README.md`**:
```markdown
## Build Status

![Pipeline Status](https://gitlab.com/your-group/complinist/badges/main/pipeline.svg)
![Coverage](https://gitlab.com/your-group/complinist/badges/main/coverage.svg)
```

**Replace** `your-group/complinist` with your project path.

**🔍 Exercise 10.1**: Add badges
- Add pipeline status badge to README
- Commit and push
- View README in GitLab
- Do the badges display correctly?

### 10.2 Viewing Pipeline Metrics

**Navigate to**: CI/CD → Pipelines → Charts

**Available metrics**:
- Pipelines per day/week/month
- Success rate
- Duration trends

**🔍 Exercise 10.2**: Analyze metrics
- What's your pipeline success rate?
- What's the average duration?
- How has it changed over time?

### 10.3 Job Duration Analysis

Find slow jobs to optimize:

1. **Navigate to**: CI/CD → Pipelines
2. **Open any pipeline**
3. **Note job durations**
4. **Identify slowest jobs**:
   - Build jobs usually slowest (10-20 min)
   - Test jobs moderate (2-5 min)
   - Validation jobs fast (1-2 min)

**🔍 Exercise 10.3**: Optimize pipeline
- Which job takes the longest?
- Can it be sped up with better caching?
- Can it be parallelized?

---

## Part 11: Best Practices Review (10 minutes)

### 11.1 Developer Workflow

**Before pushing**:
```bash
# Always run locally first!
npm run lint
npm run typecheck
npm test
```

**Making commits**:
- Keep commits focused and atomic
- Write clear commit messages
- Reference issues if applicable

**Using branches**:
- Create feature branches
- Never push directly to main
- Use merge requests for code review

### 11.2 Pipeline Optimization

**Caching**:
- Keep cache keys based on lock files
- Don't cache generated files
- Clear cache when issues arise

**Parallelization**:
- Run independent jobs in parallel
- Use `needs` to create dependencies
- Balance runner capacity

**Artifacts**:
- Only save necessary artifacts
- Set appropriate retention periods
- Clean up old artifacts

### 11.3 Security

**Secrets management**:
- Always mask sensitive variables
- Use protected variables for production
- Rotate secrets regularly
- Never log secrets

**Dependency management**:
- Review security scan reports weekly
- Update vulnerable dependencies promptly
- Monitor license compliance

---

## Part 12: Hands-On Final Exercise (30 minutes)

Now it's your turn! Complete this end-to-end exercise:

### Scenario

You need to add a new feature, test it, and deploy it through all environments.

### Tasks

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/final-exercise
   ```

2. **Add a new function** (src/lib/utils/finalExercise.ts):
   ```typescript
   export function calculateScore(points: number, multiplier: number): number {
     return points * multiplier;
   }
   ```

3. **Add a test** (src/lib/utils/finalExercise.test.ts):
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { calculateScore } from './finalExercise';

   describe('calculateScore', () => {
     it('calculates score correctly', () => {
       expect(calculateScore(10, 2)).toBe(20);
     });
   });
   ```

4. **Run tests locally**:
   ```bash
   npm test
   ```

5. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: add score calculation"
   git push origin feature/final-exercise
   ```

6. **Monitor the pipeline**:
   - Watch it run through all stages
   - Verify all jobs pass
   - Download the test artifacts

7. **Create a merge request**:
   - In GitLab, create MR
   - Review the pipeline results
   - Merge to main

8. **Monitor main branch pipeline**:
   - Watch it deploy to dev automatically
   - Verify dev deployment succeeded

9. **Deploy to staging**:
   - Manually trigger staging deployment
   - Verify staging deployment

10. **Prepare for production** (don't actually deploy):
    - Write a deployment checklist
    - Identify rollback procedure
    - Document what you would test

### Success Criteria

- [ ] Pipeline passes on feature branch
- [ ] Merge request created and merged
- [ ] Automatically deployed to dev
- [ ] Manually deployed to staging
- [ ] Deployment checklist created
- [ ] Rollback procedure documented

**🔍 Self-Assessment**:
- Could you complete all tasks?
- Did you encounter any issues?
- How would you improve the process?

---

## Part 13: Troubleshooting Practice (20 minutes)

### Common Scenarios

Test your knowledge with these scenarios:

#### Scenario 1

**Problem**: Pipeline is stuck in "pending" state for 10 minutes.

**Questions**:
- What could be the cause?
- How would you diagnose it?
- What's the solution?

<details>
<summary>Click for answer</summary>

**Cause**: No available GitLab Runners, or runner busy

**Diagnose**:
- Check Settings → CI/CD → Runners
- Look for active runners
- Check runner capacity

**Solution**:
- Wait for runner to be available
- Or add more runners
- Or cancel less important pipelines
</details>

#### Scenario 2

**Problem**: Build succeeded but artifact download shows empty files.

**Questions**:
- What went wrong?
- How would you investigate?
- How to prevent this?

<details>
<summary>Click for answer</summary>

**Cause**: Artifacts paths incorrectly configured, or build didn't produce files

**Investigate**:
- Check build job logs for "Uploading artifacts" section
- Verify file paths match artifacts configuration
- Check if build actually created files

**Solution**:
- Fix artifact paths in `.gitlab-ci.yml`
- Verify build output directory
- Test build locally first
</details>

#### Scenario 3

**Problem**: Deployment says "succeeded" but application is not updated.

**Questions**:
- What could cause this?
- How would you verify?
- Next steps?

<details>
<summary>Click for answer</summary>

**Cause**: Deployment script succeeded but didn't actually deploy, or cache issue

**Verify**:
- Check deployment logs carefully
- Verify application version
- Check deployment service status

**Next steps**:
- Review deployment script
- Manually verify deployment
- Add health checks to deployment
</details>

---

## Conclusion and Next Steps

Congratulations! 🎉 You've completed the CI/CD Pipeline Interactive Walkthrough!

### What You've Learned

✓ How to trigger and monitor pipelines
✓ How to read and interpret pipeline logs
✓ How to download and work with artifacts
✓ How to deploy to different environments
✓ How to debug failed pipeline runs
✓ How to manage secrets and variables
✓ How to perform rollbacks
✓ How to modify the pipeline configuration
✓ Best practices for CI/CD workflows

### Continue Learning

**Next steps**:
1. Review [PIPELINE_GUIDE.md](./PIPELINE_GUIDE.md) for reference
2. Read [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) for operational procedures
3. Study [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) for security
4. Experiment with pipeline modifications
5. Set up notifications for your team

### Additional Resources

- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [YAML Syntax Guide](https://docs.gitlab.com/ee/ci/yaml/)
- [GitLab CI/CD Examples](https://docs.gitlab.com/ee/ci/examples/)
- [Electron Builder Docs](https://www.electron.build/)

### Feedback

This walkthrough is a living document. If you found something confusing or have suggestions for improvement, please:
- Create an issue
- Submit a merge request
- Contact the DevOps team

---

**Happy deploying! 🚀**
