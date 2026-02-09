# Deployment Runbook

This runbook provides operational procedures for deploying CompliNist across environments, handling incidents, and performing rollbacks.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Deployment Procedures](#environment-deployment-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Health Checks](#health-checks)
5. [Incident Response](#incident-response)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Emergency Contacts](#emergency-contacts)

---

## Pre-Deployment Checklist

### Development Deployment

**Automatic deployment to dev on main branch merge**

- [ ] Pipeline passed all validation stages
- [ ] Tests passed with adequate coverage
- [ ] Security scans reviewed (warnings acceptable)
- [ ] Build artifacts generated successfully

**No additional action required** - deployment is automatic.

---

### Staging Deployment

**Manual trigger required**

- [ ] Development environment tested and stable
- [ ] All tests passing
- [ ] Security vulnerabilities reviewed and assessed
- [ ] Build artifacts verified
- [ ] QA team notified and ready to test
- [ ] Test data prepared in staging environment

**Proceed to**: [Staging Deployment Procedure](#staging-deployment-procedure)

---

### Production Deployment

**Manual trigger with approval required**

#### Critical Pre-Deployment Checks

- [ ] **Staging tested thoroughly**
  - [ ] All critical user flows tested
  - [ ] Performance testing completed
  - [ ] Security testing passed
  - [ ] Integration testing verified

- [ ] **Team coordination**
  - [ ] Team notified of deployment window
  - [ ] Support team aware and on standby
  - [ ] Deployment window scheduled (low-traffic period)
  - [ ] Change management ticket created (if required)

- [ ] **Technical readiness**
  - [ ] Database migrations tested (if applicable)
  - [ ] Rollback procedure documented and ready
  - [ ] Previous version identified for rollback
  - [ ] Backup completed (if applicable)

- [ ] **Communication**
  - [ ] Users notified of maintenance window (if applicable)
  - [ ] Status page updated (if applicable)
  - [ ] Emergency contact list reviewed

**Proceed to**: [Production Deployment Procedure](#production-deployment-procedure)

---

## Environment Deployment Procedures

### Development Deployment Procedure

**Automatic deployment - for reference only**

**What happens**:
1. Pipeline completes build stage
2. `deploy:dev` job triggers automatically
3. Deployment script runs
4. Application deployed to dev environment
5. Health checks performed (if configured)

**Monitoring**:
- Watch deployment logs in real-time
- Verify no error messages
- Check deployment success message

**If deployment fails**:
- Pipeline will fail and stop
- Review logs for error messages
- Fix issue and push new commit
- Pipeline will retry automatically

---

### Staging Deployment Procedure

**Step-by-step process**:

#### 1. Identify Pipeline to Deploy

**Navigate to**: CI/CD → Pipelines

**Select pipeline** based on:
- Recent successful builds
- Specific feature/fix to test
- Version number/commit

**Verify**:
- Build stage completed successfully
- All artifacts present
- No critical security issues

#### 2. Trigger Deployment

**Steps**:
1. Open the selected pipeline
2. Scroll to `deploy-staging` stage
3. Locate `deploy:staging` job
4. Click the **play button** (⏵)
5. Confirm "Run job" in dialog

#### 3. Monitor Deployment

**Watch the job logs**:

```bash
Deploying to staging environment...
Version: 1.0.0
Commit: abc123
-----------------------------------
Downloading artifacts...
Running deployment script...
Uploading to server...
Restarting services...
Running health checks...
-----------------------------------
Staging deployment completed
Job succeeded
```

**Key checkpoints**:
- ✓ Artifacts downloaded successfully
- ✓ Deployment script executed without errors
- ✓ Services restarted successfully
- ✓ Health checks passed
- ✓ "Job succeeded" message

#### 4. Post-Deployment Verification

**Immediately after deployment**:

1. **Access the application**:
   ```bash
   curl https://staging.complinist.example.com
   ```

2. **Verify version**:
   - Check application version in UI
   - Compare with deployed version

3. **Check logs**:
   - No error spikes
   - Application started successfully

4. **Run smoke tests**:
   - Login functionality
   - Basic navigation
   - Critical features

#### 5. Notify QA Team

**Send notification**:
```
Staging Deployment Complete
Version: 1.0.0
Commit: abc123
Changes: [Link to changelog]
Ready for testing
```

#### 6. Document Deployment

**Record**:
- Date and time
- Version deployed
- Who triggered deployment
- Any issues encountered

---

### Production Deployment Procedure

**⚠️ CRITICAL: Follow this procedure exactly**

#### Phase 1: Final Preparation (15-30 min before)

**1. Team Coordination**
- [ ] Notify all stakeholders
- [ ] Confirm support team ready
- [ ] Verify off-hours deployment window (if applicable)

**2. Technical Preparation**
- [ ] Identify rollback pipeline (previous prod deployment)
- [ ] Backup database (if applicable)
- [ ] Verify rollback script functional
- [ ] Clear any caches that might interfere

**3. Communication**
- [ ] Update status page: "Maintenance in progress"
- [ ] Send user notification (if applicable)
- [ ] Post in team chat: "Production deployment starting"

#### Phase 2: Deployment Execution (15-30 min)

**1. Trigger Deployment**

**Steps**:
1. Navigate to: CI/CD → Pipelines
2. Select the verified pipeline (should be same as staging)
3. Scroll to `deploy-prod` stage
4. Click **play button** (⏵) on `deploy:production`
5. **Review deployment summary carefully**:
   ```
   ===================================================
   PRODUCTION DEPLOYMENT
   ===================================================
   Version: 1.0.0
   Commit: abc123def
   Branch: main
   Tag: v1.0.0
   ===================================================
   ```
6. **Verify all details are correct**
7. If approvals configured, wait for approval
8. Confirm deployment

**2. Monitor Deployment (CRITICAL)**

**Stay at your computer and watch every step**:

```bash
Deploying to production environment...
Version: 1.0.0
Commit: abc123def
-----------------------------------
[00:00] Starting deployment...
[00:15] Downloading artifacts...
[00:30] Backing up current version...
[01:00] Running deployment script...
[02:00] Uploading to production servers...
[03:00] Running database migrations... (if applicable)
[04:00] Restarting services...
[05:00] Running health checks...
[06:00] Deployment verification...
-----------------------------------
Production deployment completed successfully
DEPLOYED_VERSION=1.0.0
DEPLOYED_COMMIT=abc123def
DEPLOYED_AT=2026-01-10T15:30:00Z
Job succeeded
```

**Watch for**:
- ✓ Each step completes successfully
- ✓ No error messages
- ✓ Health checks pass
- ✓ "Job succeeded" at the end

**If any errors occur**: Immediately proceed to [Rollback Procedures](#rollback-procedures)

#### Phase 3: Immediate Verification (5-10 min)

**1. Application Accessibility**

```bash
# Test production URL
curl -I https://complinist.example.com
# Expected: HTTP/2 200

# Test health endpoint (if available)
curl https://complinist.example.com/health
# Expected: {"status": "healthy"}
```

**2. Functional Testing**

Test critical user flows:
- [ ] Login functionality
- [ ] Main dashboard loads
- [ ] Core features accessible
- [ ] No JavaScript console errors

**3. Performance Check**

- [ ] Page load times normal
- [ ] No timeout errors
- [ ] API responses within normal range

**4. Error Monitoring**

Check error tracking service (if available):
- [ ] No error spike
- [ ] Error rate within normal range

#### Phase 4: Post-Deployment Monitoring (30 min - 2 hours)

**Continue monitoring**:

**First 30 minutes (critical window)**:
- Check logs every 5 minutes
- Monitor error rates
- Watch user activity metrics
- Stay ready for rollback

**Next 90 minutes**:
- Check logs every 15 minutes
- Monitor system resources
- Collect user feedback
- Address any issues immediately

**Monitoring checklist**:
- [ ] No unusual error patterns
- [ ] Performance metrics normal
- [ ] User reports positive/neutral
- [ ] System resources stable

#### Phase 5: Communication and Documentation

**1. Notify stakeholders**:
```
Production Deployment Complete ✓
Version: 1.0.0
Deployed at: 2026-01-10 15:30 UTC
Status: Stable
Changes: [Link to release notes]
```

**2. Update status page**:
- Remove maintenance notice
- Confirm normal operations

**3. Document deployment**:
- Deployment timestamp
- Version deployed
- Who performed deployment
- Any issues encountered
- Verification results
- User feedback

**4. Team debrief** (if issues occurred):
- What went well
- What could be improved
- Action items

---

## Rollback Procedures

### When to Rollback

**Immediate rollback required if**:
- ❌ Application not accessible
- ❌ Critical functionality broken
- ❌ Error rate spike (>10x normal)
- ❌ Data corruption detected
- ❌ Security vulnerability introduced

**Consider rollback if**:
- ⚠️ Minor functionality degraded
- ⚠️ Performance significantly worse
- ⚠️ User complaints increasing
- ⚠️ Non-critical bugs affecting UX

**When not to rollback**:
- ✓ Minor cosmetic issues
- ✓ Issues that can be hotfixed quickly
- ✓ Issues affecting <5% of users

### Rollback Decision Matrix

| Issue Severity | User Impact | Action |
|---------------|-------------|--------|
| Critical | All users | **Immediate rollback** |
| High | >50% users | **Rollback** (assess in 5 min) |
| Medium | 10-50% users | Consider rollback vs hotfix |
| Low | <10% users | Hotfix preferred |

---

### Rollback Method 1: Using Rollback Job

**Best for**: Quick rollback to previous version

**Steps**:

#### 1. Initiate Rollback

**Navigate to**:
1. CI/CD → Pipelines
2. Find the **failed or problematic** production deployment
3. Scroll to `deploy-prod` stage
4. Locate `rollback:production` job
5. Click **play button** (⏵)
6. Confirm rollback

#### 2. Monitor Rollback

**Watch logs closely**:

```bash
Rolling back production deployment...
Previous version: 0.9.5
Previous commit: xyz789
-----------------------------------
[00:00] Starting rollback...
[00:15] Stopping current services...
[00:30] Restoring previous version...
[01:00] Restarting services...
[01:30] Running health checks...
[02:00] Rollback verification...
-----------------------------------
Rollback completed successfully
Job succeeded
```

**Verify**:
- ✓ Previous version identifier is correct
- ✓ Services stopped cleanly
- ✓ Restoration successful
- ✓ Health checks pass

#### 3. Verify Rollback Success

**Immediate checks**:

```bash
# Test application
curl https://complinist.example.com

# Verify version (should be previous version)
# Check application UI
```

**Functional tests**:
- [ ] Application accessible
- [ ] Critical functionality working
- [ ] Error rates back to normal
- [ ] User complaints stopped

#### 4. Post-Rollback Actions

- [ ] Notify stakeholders of rollback
- [ ] Update status page
- [ ] Begin incident analysis
- [ ] Plan fix for the issue
- [ ] Document rollback reason

---

### Rollback Method 2: Retry Previous Deployment

**Best for**: Rolling back to specific known-good version

**Steps**:

#### 1. Identify Previous Deployment

**Navigate to**: CI/CD → Pipelines

**Find** the last successful production deployment:
- Look for pipelines with successful `deploy:production` job
- Verify it's the version you want to restore
- Note the version/commit

#### 2. Retry Deployment

**Steps**:
1. Click on the previous successful pipeline
2. Go to `deploy-prod` stage
3. Click **retry icon** (↻) on `deploy:production` job
4. Confirm retry

**This will**:
- Re-run the exact same deployment
- Use the same artifacts
- Deploy the previous version

#### 3. Monitor and Verify

Follow same steps as normal deployment:
- Monitor deployment logs
- Verify application accessibility
- Test functionality
- Monitor error rates

#### 4. Post-Rollback Actions

Same as Method 1.

---

### Emergency Rollback

**If pipeline is unavailable or broken**:

#### Manual Rollback Steps

**⚠️ Use only if GitLab pipeline unavailable**

1. **Access production server** (SSH or console)

2. **Stop application**:
   ```bash
   sudo systemctl stop complinist
   ```

3. **Restore previous version** (method depends on deployment):
   ```bash
   # If using symbolic links
   ln -sfn /opt/complinist/releases/previous /opt/complinist/current

   # If using package manager
   apt-get install complinist=<previous-version>

   # If using containers
   docker pull complinist:previous-tag
   docker-compose up -d
   ```

4. **Start application**:
   ```bash
   sudo systemctl start complinist
   ```

5. **Verify**:
   ```bash
   sudo systemctl status complinist
   curl http://localhost:5000/health
   ```

6. **Document manual rollback**:
   - Create incident report
   - Note manual steps taken
   - Update team immediately

---

## Health Checks

### Automated Health Checks

**During deployment**, pipeline runs these checks:

```bash
#!/bin/bash
# Health check script

# Check HTTP response
response=$(curl -s -o /dev/null -w "%{http_code}" https://complinist.example.com)
if [ "$response" != "200" ]; then
    echo "ERROR: Application not responding correctly (HTTP $response)"
    exit 1
fi

# Check health endpoint (if available)
health=$(curl -s https://complinist.example.com/health)
status=$(echo $health | jq -r '.status')
if [ "$status" != "healthy" ]; then
    echo "ERROR: Health check failed ($status)"
    exit 1
fi

echo "Health checks passed"
```

### Manual Health Checks

**Run these after any deployment**:

#### 1. Connectivity Check

```bash
curl -I https://complinist.example.com
```

**Expected**:
```
HTTP/2 200
content-type: text/html
```

#### 2. Application Health

```bash
curl https://complinist.example.com/health
```

**Expected**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 12345
}
```

#### 3. Database Connectivity (if applicable)

Check application logs for database connection:
```bash
tail -100 /var/log/complinist/app.log | grep -i database
```

**Expected**: No connection errors

#### 4. Performance Check

```bash
time curl https://complinist.example.com
```

**Expected**: Response in <2 seconds

---

## Incident Response

### Severity Levels

**P0 - Critical**
- Application completely down
- Data loss occurring
- Security breach

**Response time**: Immediate
**Action**: Rollback immediately, then investigate

---

**P1 - High**
- Major functionality broken
- Affecting >50% of users
- Performance severely degraded

**Response time**: <15 minutes
**Action**: Assess rollback vs hotfix

---

**P2 - Medium**
- Minor functionality broken
- Affecting 10-50% users
- Performance moderately degraded

**Response time**: <1 hour
**Action**: Plan fix, consider hotfix

---

**P3 - Low**
- Cosmetic issues
- Affecting <10% users
- No performance impact

**Response time**: <24 hours
**Action**: Schedule fix in next release

---

### Incident Response Workflow

#### 1. Detection (0-5 min)

**Sources**:
- Deployment monitoring
- Automated alerts
- User reports
- Error tracking

**Actions**:
- [ ] Confirm incident
- [ ] Determine severity
- [ ] Alert team

#### 2. Assessment (5-15 min)

**Gather information**:
- What changed? (version, commit)
- When did it start? (timestamp)
- What's affected? (functionality, users)
- Error messages? (logs, traces)

**Determine**:
- Rollback or hotfix?
- Impact on users
- Data integrity

#### 3. Response (15-30 min)

**For P0/P1 incidents**:

1. **Initiate rollback** (if appropriate)
2. **Communicate**:
   - Update status page
   - Notify users
   - Alert stakeholders

3. **Monitor rollback**:
   - Verify success
   - Check metrics
   - Confirm resolution

**For P2/P3 incidents**:

1. **Plan fix**:
   - Identify root cause
   - Develop solution
   - Test locally

2. **Communicate**:
   - Update status page
   - Notify affected users
   - Set expectations

#### 4. Resolution

**After rollback**:
- [ ] Verify application stable
- [ ] Monitor for 1-2 hours
- [ ] Update status page: "Resolved"
- [ ] Begin post-incident analysis

**After hotfix**:
- [ ] Test fix thoroughly
- [ ] Deploy hotfix via pipeline
- [ ] Verify resolution
- [ ] Update status page: "Resolved"

#### 5. Post-Incident

**24-48 hours after**:

**Create incident report**:
- Timeline of events
- Root cause analysis
- Impact assessment
- Response effectiveness
- Action items

**Conduct postmortem**:
- What went well
- What could be improved
- Process changes needed
- Technical improvements

**Implement improvements**:
- Update runbooks
- Improve monitoring
- Enhance testing
- Update procedures

---

## Post-Deployment Verification

### Verification Checklist

**Immediately after deployment** (0-30 min):

- [ ] Application accessible
- [ ] Version correct
- [ ] Critical user flows working:
  - [ ] User login
  - [ ] Main dashboard
  - [ ] Primary features
- [ ] No error spike in logs
- [ ] Performance metrics normal
- [ ] Health checks passing

**Extended monitoring** (30 min - 24 hours):

- [ ] Error rates stable
- [ ] Performance consistent
- [ ] User feedback positive
- [ ] No security alerts
- [ ] Resource usage normal
- [ ] Background jobs running

**Weekly follow-up** (if major deployment):

- [ ] Review week's metrics
- [ ] Collect user feedback
- [ ] Review error trends
- [ ] Assess performance
- [ ] Validate success metrics

---

## Emergency Contacts

### On-Call Rotation

| Role | Primary | Backup | Contact |
|------|---------|--------|---------|
| DevOps Lead | [Name] | [Name] | [Phone/Slack] |
| Backend Lead | [Name] | [Name] | [Phone/Slack] |
| Frontend Lead | [Name] | [Name] | [Phone/Slack] |
| Product Manager | [Name] | [Name] | [Phone/Slack] |

### Escalation Path

**Level 1**: On-call engineer (0-15 min)
**Level 2**: Team lead (15-30 min)
**Level 3**: Engineering manager (30+ min)

### External Contacts

**Infrastructure**: [Provider support]
**Security**: [Security team contact]
**Management**: [Executive contact for critical incidents]

---

## Appendix

### Deployment Logs Location

**GitLab**: CI/CD → Pipelines → [Pipeline] → [Job]

**Server logs** (if applicable):
- Application: `/var/log/complinist/app.log`
- Deployment: `/var/log/complinist/deploy.log`
- System: `/var/log/syslog`

### Metrics and Monitoring

**GitLab**: CI/CD → Pipelines → Charts

**Application metrics** (configure as needed):
- Error rates
- Response times
- Active users
- Resource usage

### Documentation Links

- [Pipeline Architecture](./PIPELINE_ARCHITECTURE.md)
- [Pipeline Guide](./PIPELINE_GUIDE.md)
- [Interactive Walkthrough](./INTERACTIVE_WALKTHROUGH.md)
- [Secrets Management](./SECRETS_MANAGEMENT.md)

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-10
**Review Schedule**: Quarterly
