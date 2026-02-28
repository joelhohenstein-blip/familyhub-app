# CI/CD Pipeline Guide

Family Hub - Continuous Integration and Deployment

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [Workflow Triggers](#workflow-triggers)
4. [Build Process](#build-process)
5. [Testing](#testing)
6. [Docker Image Building](#docker-image-building)
7. [Deployment](#deployment)
8. [Monitoring & Status](#monitoring--status)
9. [Troubleshooting](#troubleshooting)

---

## Pipeline Overview

The Family Hub CI/CD pipeline automates:

1. **Code Quality Checks** - Linting and type checking
2. **Testing** - Unit, integration, and smoke tests
3. **Building** - Application and Docker image builds
4. **Security Scanning** - Vulnerability and dependency checks
5. **Artifact Management** - Build artifact storage
6. **Deployment** - Automatic staging, manual production
7. **Monitoring** - Health checks and notifications

### Pipeline Architecture

```
Developer Push
       ↓
┌─────────────────────────────────────────┐
│          GitHub Actions CI              │
│  ┌─────────────────────────────────┐   │
│  │ 1. Lint & Code Quality          │   │
│  │ 2. Run Tests                    │   │
│  │ 3. Security Scanning            │   │
│  │ 4. Build Application            │   │
│  │ 5. Build Docker Image           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
       ↓
   All Pass?
     ↙    ↘
   NO    YES
   ↓      ↓
 Fail  ┌──────────────────┐
       │ Automatic        │
       │ Staging Deploy   │ (on develop)
       │ (if develop)     │ OR
       │                  │ Manual
       │ Manual Prod      │ Prod Deploy
       │ Deploy           │ (if main)
       │ (if main)        │
       └──────────────────┘
```

---

## GitHub Actions Workflows

### File Locations

All workflows are in `.github/workflows/`:

```
.github/
├── workflows/
│   ├── ci.yml                 # Main CI pipeline
│   ├── deploy-staging.yml     # Deploy to staging
│   ├── deploy-production.yml  # Deploy to production
│   └── rollback.yml           # Manual rollback
```

### Workflow Status

Check status in GitHub:

1. Go to repository
2. Click **Actions** tab
3. Select workflow to view details

---

## Workflow Triggers

### CI Workflow (`ci.yml`)

**Triggers**:
- Push to `main` or `develop` branch
- Pull requests to `main` or `develop`
- Manual trigger via GitHub Actions UI

**Runs**:
```
Every push → Tests run → If pass, build Docker image
```

### Staging Deployment (`deploy-staging.yml`)

**Triggers**:
- Automatic: Push to `develop` branch (after CI passes)
- Manual: `workflow_dispatch` in GitHub Actions UI
- Webhook: From CI workflow completion

**Example**:
```bash
git push origin develop
# → Triggers CI workflow
# → If CI passes, automatically triggers deploy-staging
# → Staging is updated within 5-10 minutes
```

### Production Deployment (`deploy-production.yml`)

**Triggers**:
- Manual: `workflow_dispatch` in GitHub Actions UI
- GitHub Release: Creating a release tag
- Manual: Using GitHub CLI

**Example**: Manual trigger
```bash
# Via GitHub UI
# Go to Actions → Deploy to Production → Run workflow → Select strategy → Run

# Via GitHub CLI
gh workflow run deploy-production.yml \
  -f deployment_strategy=blue-green
```

**Example**: Via release
```bash
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
# → Automatically triggers production deployment
```

---

## Build Process

### Step 1: Checkout Code

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history for versioning
```

### Step 2: Setup Node.js

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Caches node_modules
```

### Step 3: Install Dependencies

```yaml
- run: npm ci  # Clean install, faster and more reliable
```

Dependency caching saves ~30-60 seconds per build!

### Step 4: Lint Code

```yaml
- run: npm run typecheck  # TypeScript type checking
```

Catches errors before they reach production.

### Step 5: Run Tests

```yaml
- run: npm run test:run  # Run all tests
```

Database is automatically started via Docker for integration tests.

### Step 6: Build Application

```yaml
- run: npm run build
  env:
    NODE_ENV: production
```

Creates optimized production build in `build/` directory.

### Step 7: Upload Artifacts

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: build/
    retention-days: 7
```

Artifacts are stored for 7 days (configurable).

---

## Testing

### Unit Tests

Located in: `app/**/*.test.ts`

```bash
npm run test:run
```

Runs with Vitest, provides coverage reports.

### Integration Tests

Tests with real database (PostgreSQL in Docker):

```typescript
// Example: Database integration test
describe('User Service', () => {
  it('creates user in database', async () => {
    const user = await createUser({
      email: 'test@example.com',
      name: 'Test User'
    });
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### Smoke Tests

Post-deployment checks that critical functionality works:

```bash
# Run after deployment
curl https://staging.familyhub.local/health
curl https://staging.familyhub.local/api/auth/session
```

### Test Coverage

View coverage reports:

```bash
npm run test:run -- --coverage
```

Generates `coverage/` directory with HTML reports.

---

## Docker Image Building

### Build Process

1. **Multi-stage Build**
   ```dockerfile
   # Stage 1: Builder (with build deps)
   FROM node:20-alpine AS builder
   RUN npm ci
   RUN npm run build
   
   # Stage 2: Production (lean runtime only)
   FROM node:20-alpine
   COPY --from=builder /app/build ./build
   ```

2. **Build Command**
   ```bash
   docker build -t family-hub:latest .
   ```

3. **Image Optimization**
   - Builder stage removes build dependencies
   - Alpine Linux (smaller base image)
   - Non-root user
   - Health check included

### Image Registry

Images are pushed to:

```
ghcr.io/[owner]/family-hub:latest
ghcr.io/[owner]/family-hub:develop-[commit-sha]
ghcr.io/[owner]/family-hub:v1.0.0
```

### Image Tagging Strategy

| Tag | When | Example |
|-----|------|---------|
| `latest` | Main branch | `ghcr.io/family-hub/app:latest` |
| `develop` | Develop branch | `ghcr.io/family-hub/app:develop` |
| `develop-[sha]` | Develop commit | `ghcr.io/family-hub/app:develop-abc1234` |
| `v[version]` | Release tag | `ghcr.io/family-hub/app:v1.0.0` |
| `branch-[sha]` | Feature branch | `ghcr.io/family-hub/app:main-abc1234` |

---

## Deployment

### Staging Deployment

**Automatic** when code is merged to `develop`:

```
develop push
  → CI passes
  → Build Docker image
  → Deploy to staging
  → Run smoke tests
  → Health checks
  → Available at: https://staging.familyhub.local
```

**Timeline**: ~10-15 minutes from push to live

### Production Deployment

**Manual** with approval gates:

```
Manual trigger
  → Pre-deployment checks
  → Create GitHub Deployment
  → Build Docker image
  → Deploy to green environment
  → Run smoke tests
  → Await approval
  → Switch traffic from blue to green
  → Monitor (5 minutes)
  → Available at: https://familyhub.local
```

**Timeline**: ~20-30 minutes (including approval wait)

### Database Migrations

Migrations run automatically:

```bash
# Before deployment
npm run db:push

# Check migration status
npm run db:status
```

Migrations are:
- Non-blocking (don't hold up deployment)
- Idempotent (safe to run multiple times)
- Reversible (can rollback if needed)

---

## Monitoring & Status

### GitHub Actions Dashboard

View all workflows:

```
Repository → Actions tab
```

Click on workflow to see:
- Real-time build progress
- Log output
- Artifact links
- Status checks

### Status Badges

Add to README:

```markdown
![CI Status](https://github.com/owner/repo/workflows/CI/badge.svg)
![Deploy Status](https://github.com/owner/repo/workflows/Deploy%20to%20Production/badge.svg)
```

### Check Suite Status

GitHub shows status checks on PRs:

```
✅ All checks passed
- lint
- test
- build
- security
```

Pull request can only be merged if all checks pass.

### Deployment Status

View deployment history:

```
Settings → Environments → [environment name]
```

Shows:
- Deployment history
- Environment secrets
- Protection rules
- Activity logs

### Notifications

Failures trigger notifications:

- **In GitHub**: Red ✗ on PR
- **In Slack**: Bot posts to #deployments
- **By Email**: If configured

---

## Troubleshooting

### Workflow Fails on Lint

```bash
# Likely TypeScript issues
# Fix locally:
npm run typecheck

# Fix all auto-fixable issues:
npm run lint -- --fix
```

### Tests Failing in CI

```bash
# Run locally to debug:
npm test

# Run specific test file:
npm test -- app/server/user.test.ts

# Update snapshots:
npm test -- -u
```

### Docker Build Fails

```bash
# Build locally to reproduce:
docker build -t family-hub:test .

# Check Docker output for errors
docker build -t family-hub:test . --progress=plain

# Clear cache if needed:
docker builder prune
```

### Deployment Stuck

```bash
# Check workflow run status
gh run list --workflow=deploy-staging.yml

# Cancel stuck run
gh run cancel <run-id>

# Check logs
gh run view <run-id> --log

# Trigger new deployment
gh workflow run deploy-staging.yml
```

### Image Push Fails

```bash
# Verify Docker registry credentials
docker login ghcr.io

# Check image exists locally
docker images | grep family-hub

# Push manually if needed
docker push ghcr.io/owner/family-hub:latest
```

### Unclear Error Messages

The best debugging approach:

1. **Check workflow logs**
   ```
   Actions → [workflow] → [run] → Expand failing step
   ```

2. **Run locally**
   ```bash
   npm run lint
   npm test
   npm run build
   docker build .
   ```

3. **Ask for help**
   - Post error in #development Slack
   - Share workflow run URL
   - Include screenshot of error

---

## Performance Optimization

### Cache Configuration

The pipeline caches:

- **npm packages**: Saves ~40 seconds
- **node_modules**: Saves ~20 seconds
- **Docker layers**: Saves ~2-5 minutes

Cache is invalidated when:
- `package.json` changes
- `package-lock.json` changes
- 7 days have passed (default)

### Parallel Jobs

CI jobs that run in parallel:

- `lint` - Type checking (~2 min)
- `test` - Unit tests (~5 min)
- `security` - Security scanning (~3 min)

Total time: ~5 minutes (parallel) vs ~10 minutes (sequential)

### Build Optimization

```dockerfile
# Good: Cache dependencies first
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Bad: Cache invalidates with every source change
COPY . .
RUN npm ci
RUN npm run build
```

---

## Advanced Usage

### Manual Workflow Trigger

```bash
# Trigger CI
gh workflow run ci.yml

# Trigger with inputs (if configured)
gh workflow run deploy-production.yml \
  -f deployment_strategy=canary
```

### Skip CI

In commit message:

```bash
git commit -m "docs: update README [skip ci]"
git push
```

Workflow won't run (useful for documentation-only changes).

### Force Redeploy

```bash
# Delete workflow run (if < 35 days old)
gh run delete <run-id>

# Then trigger manually
gh workflow run deploy-staging.yml
```

### View Workflow Runs

```bash
# List recent runs
gh run list --workflow=ci.yml --limit 5

# View specific run
gh run view <run-id> --log

# Download artifacts from run
gh run download <run-id> --dir ./artifacts
```

---

## Continuous Improvement

### Monitoring Pipeline Health

Track metrics:

- Average build time
- Success rate
- Failure types
- Most common errors

**Command to get stats**:
```bash
gh run list --workflow=ci.yml --limit 100 \
  --json conclusion,startedAt,completedAt \
  --jq '.[] | select(.conclusion=="success") | .completedAt - .startedAt'
```

### Optimization Opportunities

- [ ] Cache is effective (> 50% hit rate)
- [ ] Build time < 10 minutes
- [ ] No flaky tests
- [ ] All security checks passing
- [ ] Deployment time < 15 minutes

---

## Contact & Support

- **CI/CD Issues**: #devops Slack channel
- **Build Failures**: Check Actions tab, ask in #development
- **Pipeline Questions**: Documentation in `/github`
- **On-Call**: PagerDuty

---

**Last Updated**: February 7, 2024
**Maintained By**: DevOps Team
**Next Review**: February 21, 2024
