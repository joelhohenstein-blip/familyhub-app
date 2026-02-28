# Deployment Guide

Family Hub - Complete Deployment Documentation

## Table of Contents

1. [Overview](#overview)
2. [Environments](#environments)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Procedures](#deployment-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Alerts](#monitoring--alerts)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Procedures](#emergency-procedures)

---

## Overview

The Family Hub application uses a sophisticated CI/CD pipeline with the following characteristics:

- **CI Pipeline**: GitHub Actions runs tests, linting, and builds on every push/PR
- **Staging Deployment**: Automatic deployment to staging from `develop` branch
- **Production Deployment**: Manual approval-gated deployment to production from `main` branch
- **Deployment Strategy**: Blue-Green deployment for zero-downtime updates
- **Rollback**: Automated rollback on failure, manual rollback available for 24 hours

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Feature Branch → PR → main/develop                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Actions CI/CD                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Lint & Code Quality                              │   │
│  │ 2. Run Tests                                         │   │
│  │ 3. Build Docker Image                               │   │
│  │ 4. Security Scanning                                │   │
│  │ 5. Deploy to Staging (develop) or Production (main)│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    ↙              ↘
        ┌───────────────┐      ┌───────────────┐
        │   STAGING     │      │  PRODUCTION   │
        │  Environment  │      │  Environment  │
        │               │      │               │
        │ Blue/Green    │      │ Blue/Green    │
        │ Deployment    │      │ Deployment    │
        │               │      │               │
        └───────────────┘      └───────────────┘
```

---

## Environments

### Development

- **Branch**: Any feature branch
- **Deployment**: Local docker-compose
- **Database**: Local PostgreSQL (docker-compose)
- **Purpose**: Feature development and testing

```bash
# Start local development environment
docker-compose up -d

# Run database migrations
npm run db:push

# Start application
npm run dev
```

### Staging

- **Branch**: `develop`
- **Trigger**: Automatic on push to `develop`
- **Database**: Staging PostgreSQL (managed service)
- **URL**: `https://staging.familyhub.local`
- **Retention**: Latest deployment + 1 previous version (24h rollback window)

**Deployment Flow**:
```
develop push → CI passes → Docker build → Push to registry → Deploy to green → Run smoke tests → Switch traffic → Monitor
```

### Production

- **Branch**: `main`
- **Trigger**: Manual workflow dispatch or release creation
- **Approval**: Required before deployment
- **Database**: Production PostgreSQL (managed service, replicated)
- **URL**: `https://familyhub.local`
- **Retention**: Previous version retained for 24 hours

**Deployment Flow**:
```
main → Manual trigger → Approval gate → Pre-checks → Docker build → Deploy to green → Smoke tests → Traffic switch → Monitor → Archive blue
```

---

## Pre-Deployment Checklist

### Before Staging Deployment

- [ ] All tests passing on the branch
- [ ] Code review completed
- [ ] Changes merged to `develop`
- [ ] Database migrations tested locally
- [ ] No breaking API changes without versioning
- [ ] Feature flags configured for gradual rollout

### Before Production Deployment

- [ ] Tested in staging environment for minimum 2 hours
- [ ] All acceptance criteria verified
- [ ] Documentation updated
- [ ] Release notes prepared
- [ ] On-call engineer available
- [ ] Backup of production database confirmed
- [ ] Rollback plan reviewed
- [ ] Monitoring alerts configured

---

## Deployment Procedures

### Automatic Staging Deployment

Staging deployments are automatic when code is pushed to the `develop` branch:

```bash
# 1. Push to develop branch
git push origin develop

# 2. GitHub Actions automatically:
#    - Runs CI (lint, test, build)
#    - Builds Docker image
#    - Deploys to staging
#    - Runs smoke tests

# 3. Monitor deployment
# Visit GitHub Actions tab → deploy-staging workflow

# 4. Access staging environment
# https://staging.familyhub.local
```

### Manual Production Deployment

Production deployments require manual approval:

#### Option A: Using GitHub Actions UI

1. Go to GitHub Repository → Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select deployment strategy:
   - **blue-green** (Recommended): Zero-downtime, switch traffic after green is ready
   - **canary**: Gradually shift traffic to new version
   - **rolling**: Update instances one at a time
5. Click "Run workflow"
6. Wait for approval step
7. Review changes and approve
8. Monitor deployment progress

#### Option B: Using GitHub CLI

```bash
# Trigger deployment via CLI
gh workflow run deploy-production.yml \
  -f deployment_strategy=blue-green

# Check status
gh run list --workflow=deploy-production.yml --limit 5
```

#### Option C: Automatic Release Deployment

```bash
# Create release in GitHub (automatically triggers production deployment)
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Or use GitHub CLI
gh release create v1.0.0 --title "Release 1.0.0" --notes "Release notes here"
```

### Database Migrations

Database migrations run automatically during deployment:

```bash
# Migrations are applied in this order:
# 1. Pre-deployment checks validate migration compatibility
# 2. Backup current database
# 3. Run pending migrations on target environment
# 4. Verify schema changes
# 5. Rollback available if verification fails
```

Manual migration (if needed):

```bash
# SSH into target environment
ssh user@staging.familyhub.local

# Run migrations
npm run db:migrate -- --env staging

# Verify
npm run db:verify -- --env staging
```

---

## Rollback Procedures

### Automatic Rollback

Automatic rollback occurs if:
- Health checks fail post-deployment
- Error rate exceeds threshold
- Database connectivity lost
- Critical service unreachable

Rollback is automatic within the first 5 minutes.

### Manual Rollback - Staging

```bash
# Option 1: Redeploy previous version (recommended)
gh workflow run deploy-staging.yml \
  -f target_version=previous

# Option 2: Manual rollback via SSH
ssh user@staging.familyhub.local

# Check deployment history
docker service ls

# Switch back to blue (previous version)
docker service update --image <previous-image-tag> family-hub-app

# Verify health
curl https://staging.familyhub.local/health
```

### Manual Rollback - Production

**Only execute during critical failures. Follow approval process.**

```bash
# Step 1: Create incident ticket
# Severity: Critical
# Reason: [describe failure]

# Step 2: Notify stakeholders
# Email: devops@familyhub.local
# Slack: #incidents

# Step 3: Execute rollback (30-second window to switch traffic)
ssh user@production.familyhub.local

# Verify current deployments
docker service ls
docker service ps family-hub-app

# Switch back to blue
docker service update \
  --image ghcr.io/family-hub/app:production-<previous-commit> \
  family-hub-app

# Step 4: Health checks
curl https://familyhub.local/health
curl https://familyhub.local/api/health

# Step 5: Monitor for 15 minutes
# Check error rates, latency, database queries

# Step 6: Post-rollback analysis
# Create post-mortem within 24 hours
```

### Database Rollback

If database migration fails:

```bash
# Automatic: Deployment is halted, blue environment continues serving traffic
# Downtime: 0 minutes (due to blue-green deployment)

# Manual database recovery (if migration caused data issues):
ssh user@database-primary.familyhub.local

# List available backups
aws rds describe-db-snapshots --db-instance-identifier family-hub-prod

# Restore from backup (creates new instance)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier family-hub-prod-restore \
  --db-snapshot-identifier family-hub-prod-backup-2024-02-07

# Promote to primary (after verification)
# Check DNS and application configuration
```

---

## Monitoring & Alerts

### Health Checks

Health check endpoint is available at:

```
GET /health
```

Response format:

```json
{
  "status": "healthy",
  "timestamp": "2024-02-07T12:00:00Z",
  "uptime": 86400000,
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 2.5
    },
    "memory": {
      "status": "ok",
      "usage": {
        "rss": 256,
        "heapUsed": 128,
        "heapTotal": 256,
        "external": 10
      },
      "percentage": 50
    }
  }
}
```

### Key Metrics to Monitor

- **Response Time**: Target < 200ms (p95)
- **Error Rate**: Target < 0.1%
- **CPU Usage**: Target < 70%
- **Memory Usage**: Target < 80%
- **Database Latency**: Target < 50ms (p95)
- **WebSocket Connections**: Monitor for leaks

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 0.5% | > 1% | Check logs, consider rollback |
| Response Time (p95) | > 500ms | > 1s | Scale instances, check DB |
| CPU Usage | > 80% | > 95% | Scale up |
| Memory Usage | > 85% | > 95% | Restart instances, investigate leak |
| DB Connections | > 80% | > 95% | Tune connection pool |

### Alerts Configuration

Alerts are sent to:
- **Slack**: #alerts channel
- **Email**: devops-alerts@familyhub.local
- **PagerDuty**: For critical issues (auto-escalate after 5 min)

---

## Troubleshooting

### Deployment Stuck in Progress

```bash
# Check workflow status
gh workflow view deploy-production.yml --json status

# Cancel workflow if hung
gh run cancel <run-id>

# Investigate logs
gh run view <run-id> --log
```

### Health Checks Failing

```bash
# SSH into container
docker exec -it family-hub-app bash

# Check application logs
tail -f /var/log/app.log

# Check database connectivity
npm run db:verify

# Check Redis connectivity
redis-cli ping

# Restart application
docker restart family-hub-app
```

### Database Migration Failed

```bash
# Check migration status
npm run db:status -- --env staging

# View last applied migration
npm run db:history -- --env staging

# Rollback last migration
npm run db:rollback -- --env staging

# Manually apply specific migration
npm run db:migrate -- --migration <migration-id> --env staging
```

### Container Registry Issues

```bash
# Check Docker login
docker login ghcr.io

# Push image manually
docker build -t ghcr.io/family-hub/app:latest .
docker push ghcr.io/family-hub/app:latest

# Check image digest
docker inspect ghcr.io/family-hub/app:latest | grep Digest

# Verify image in registry
gh api repos/{owner}/{repo}/contents \
  --method GET -H "Accept: application/vnd.github.v3.raw"
```

### Memory Leaks in Production

```bash
# SSH into instance
ssh user@production.familyhub.local

# Generate heap dump
docker exec family-hub-app node \
  --heap-prof --expose-gc ./build/server/index.js

# Analyze heap
node --prof-process isolated-*.log > processed-output.txt

# Consider restarting container
docker restart family-hub-app

# Monitor memory after restart
watch 'docker stats family-hub-app'
```

---

## Emergency Procedures

### Critical Service Down (Prod)

**Incident Response Time: < 5 minutes**

1. **Declare Incident** (Immediately)
   ```bash
   # Notify team
   slack-notify "🚨 CRITICAL: Production API Down"
   
   # Create incident ticket
   gh issue create --title "INCIDENT: Production Down" \
     --label "incident,critical"
   ```

2. **Assess Status** (30 seconds)
   ```bash
   # Check health endpoint
   curl -v https://familyhub.local/health
   
   # Check container status
   ssh user@production.familyhub.local
   docker ps | grep family-hub-app
   
   # Check error logs
   docker logs --tail=100 family-hub-app
   ```

3. **Choose Recovery**

   **Option A**: Restart container (if hung)
   ```bash
   docker restart family-hub-app
   # Monitor: watch 'curl https://familyhub.local/health'
   ```

   **Option B**: Rollback to blue (if green deployment bad)
   ```bash
   # See "Manual Rollback - Production" section above
   ```

   **Option C**: Emergency maintenance mode
   ```bash
   docker update --restart=no family-hub-app
   docker stop family-hub-app
   # Notify users of maintenance
   # Restore after fix
   docker start family-hub-app
   ```

4. **Verify Recovery** (Ongoing)
   - [ ] Health checks passing
   - [ ] Error rate normal
   - [ ] Users can login
   - [ ] Critical flows working
   - [ ] Database responsive

5. **Post-Incident**
   - [ ] Generate incident summary
   - [ ] Schedule post-mortem (within 24 hours)
   - [ ] Document root cause
   - [ ] Create follow-up tickets
   - [ ] Update runbooks if needed

### Database Corruption

**Do not attempt automatic recovery. Seek DBA assistance.**

```bash
# Step 1: Stop application
docker stop family-hub-app

# Step 2: Notify database team
email "DBA Alert: Potential data corruption in family-hub-prod"

# Step 3: Preserve evidence
pg_dump family_hub > /backup/corruption-dump-$(date +%s).sql
pg_dump family_hub --schema-only > /backup/schema-before.sql

# Step 4: Restore from clean backup
# (Handled by DBA)

# Step 5: Restart application
docker start family-hub-app
```

### Security Incident

```bash
# Step 1: Isolate affected components
docker network disconnect family-hub-network family-hub-app

# Step 2: Notify security team
email "SECURITY ALERT: Potential breach in production"

# Step 3: Preserve logs
docker logs family-hub-app > /logs/incident-logs-$(date +%s).txt

# Step 4: Do not restart until security team approves
```

---

## Deployment Checklist Template

```markdown
## Production Deployment Checklist - [VERSION]

Date: ____________________
Deployer: _______________
Approver: ________________

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Staging verified for 2+ hours
- [ ] Documentation updated
- [ ] On-call engineer available
- [ ] Backup confirmed
- [ ] Rollback plan approved

### During Deployment
- [ ] Triggered deployment
- [ ] Waiting for approval
- [ ] Approved deployment
- [ ] Monitoring health checks
- [ ] Monitoring error rates
- [ ] Monitoring response times

### Post-Deployment (15 minutes)
- [ ] Health endpoint returning 200
- [ ] Error rate < 0.1%
- [ ] Response times normal
- [ ] Database queries normal
- [ ] WebSocket connections healthy
- [ ] User sign-ups working
- [ ] Critical features working

### Post-Deployment (1 hour)
- [ ] No errors in logs
- [ ] Performance metrics stable
- [ ] No customer complaints
- [ ] Backup of new version completed

### Sign-off
Deployment successful: _____________ (Y/N)
Issues found: _____________________
Next steps: _______________________
```

---

## Contact & Support

- **DevOps Team**: devops@familyhub.local
- **On-Call**: Check PagerDuty
- **Incident Channel**: #incidents (Slack)
- **Emergency Hotline**: +1-XXX-XXX-XXXX

---

**Last Updated**: February 7, 2024
**Maintained By**: DevOps Team
**Next Review**: February 21, 2024
