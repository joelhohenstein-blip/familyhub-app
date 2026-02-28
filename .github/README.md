# GitHub Configuration & CI/CD Setup

This directory contains all GitHub-specific configuration for the Family Hub project, including CI/CD workflows and documentation.

## Quick Navigation

### Workflows (`.github/workflows/`)

| File | Purpose | Trigger |
|------|---------|---------|
| `ci.yml` | Lint, test, build, security scan | Push to main/develop, PRs |
| `deploy-staging.yml` | Deploy to staging environment | Push to develop (auto) |
| `deploy-production.yml` | Deploy to production | Manual trigger or release |

### Documentation

| File | Purpose |
|------|---------|
| `CI_CD_GUIDE.md` | Comprehensive CI/CD documentation |
| `DEPLOYMENT.md` | Deployment procedures & rollback |
| `SECRETS_MANAGEMENT.md` | Secrets handling & rotation |
| `README.md` | This file |

### Root Level Documentation

| File | Location | Purpose |
|------|----------|---------|
| `CI_CD_README.md` | Root | Quick reference for developers |
| `CONTAINER_SETUP.md` | Root | Docker & container registry setup |

---

## Workflow Status

Check workflow status on GitHub:

```
Repository → Actions tab
```

**Status checks on PRs show**:
- ✅ Lint & Code Quality
- ✅ Tests
- ✅ Build
- ✅ Security Scan

All must pass to merge to main/develop.

---

## Getting Started

### For Developers

1. **Read**: [CI_CD_README.md](../CI_CD_README.md)
2. **Setup**: `cp .env.example .env && docker-compose up -d`
3. **Test**: `npm test`
4. **Deploy**: Push to branch → PR → merge when CI passes

### For DevOps

1. **Read**: [CI_CD_GUIDE.md](./CI_CD_GUIDE.md)
2. **Setup**: Configure GitHub Secrets (Settings → Secrets)
3. **Monitor**: Check Actions tab for workflow runs
4. **Deploy**: Manually trigger or create release

---

## Key Workflows Explained

### CI Workflow

**Triggers**: Push to main/develop, PRs to main/develop

**Steps**:
1. Lint & TypeScript check
2. Unit & integration tests
3. Security scanning
4. Build Docker image
5. Upload artifacts

**Status**: 🟢 Pass → Merge allowed  
**Status**: 🔴 Fail → Fix required before merge

### Staging Deployment

**Triggers**: Push to develop (automatic)

**Process**:
1. Waits for CI to pass
2. Builds Docker image
3. Deploys to staging
4. Runs health checks
5. Available at: https://staging.familyhub.local

**Timeline**: ~15 minutes from push

### Production Deployment

**Triggers**: Manual workflow dispatch or release creation

**Process**:
1. Pre-deployment checks
2. Build Docker image
3. Blue-green deployment
4. Smoke tests
5. Manual approval required
6. Traffic switch
7. 5-minute monitoring

**Timeline**: ~30 minutes (including approval)

---

## Environment Secrets

Configure in: **Settings → Secrets and variables → Actions**

### Repository Secrets (used by all environments)

```
GITHUB_TOKEN (auto)
```

### Environment: Staging

```
STAGING_DATABASE_URL
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
[other service keys]
```

### Environment: Production

```
PRODUCTION_DATABASE_URL
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
[other service keys]
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
SLACK_WEBHOOK_URL
```

See [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md) for complete list.

---

## Common Commands

```bash
# View all workflows
gh workflow list

# View specific workflow runs
gh run list --workflow=ci.yml

# Trigger workflow manually
gh workflow run deploy-staging.yml
gh workflow run deploy-production.yml

# View logs
gh run view <run-id> --log

# Cancel workflow
gh run cancel <run-id>
```

---

## Troubleshooting

### CI Failing?

1. Check workflow logs: Actions tab → failing step
2. Run locally: `npm test`, `npm run build`
3. Fix and push again

### Deployment Failing?

1. Check health endpoint: `curl https://staging.familyhub.local/health`
2. Review post-deployment logs
3. Automatic rollback in 5 minutes
4. Or manual rollback: See DEPLOYMENT.md

### Need to Re-trigger?

```bash
# Cancel workflow
gh run cancel <run-id>

# Trigger again
gh workflow run ci.yml
```

---

## Documentation Structure

```
.github/
├── workflows/          # GitHub Actions
│   ├── ci.yml         # CI pipeline
│   ├── deploy-staging.yml
│   └── deploy-production.yml
├── CI_CD_GUIDE.md     # Comprehensive guide
├── DEPLOYMENT.md      # Deployment procedures
├── SECRETS_MANAGEMENT.md
└── README.md          # This file

/
├── CI_CD_README.md    # Quick reference
├── CONTAINER_SETUP.md # Docker guide
└── .env.example       # Environment template
```

---

## Important Files

| File | Purpose | Keep Secret? |
|------|---------|--------------|
| `.env` | Local environment | YES - never commit |
| `.env.example` | Template | NO - version control OK |
| Dockerfile | Container definition | NO - version control OK |
| docker-compose.yml | Local services | NO - version control OK |

---

## Quick Links

- **GitHub Repository**: [family-hub/app](https://github.com/family-hub/app)
- **Actions Dashboard**: [Actions](https://github.com/family-hub/app/actions)
- **Environments**: [Settings → Environments](https://github.com/family-hub/app/settings/environments)
- **Secrets**: [Settings → Secrets](https://github.com/family-hub/app/settings/secrets)

---

## Support

- **CI/CD Issues**: Check [CI_CD_GUIDE.md](./CI_CD_GUIDE.md)
- **Deployment Issues**: Check [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Secrets Issues**: Check [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)
- **Docker Issues**: Check [CONTAINER_SETUP.md](../CONTAINER_SETUP.md)
- **Team Help**: #devops Slack channel

---

**Last Updated**: February 7, 2024  
**Maintained By**: DevOps Team
