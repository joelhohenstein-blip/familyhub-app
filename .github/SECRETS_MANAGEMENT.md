# Secrets Management Guide

Family Hub - Secure Configuration and Secrets Handling

## Table of Contents

1. [Overview](#overview)
2. [Secret Types](#secret-types)
3. [Adding Secrets to GitHub Actions](#adding-secrets-to-github-actions)
4. [Accessing Secrets in CI/CD](#accessing-secrets-in-cicd)
5. [Local Development](#local-development)
6. [Secret Rotation](#secret-rotation)
7. [Security Best Practices](#security-best-practices)
8. [Incident Response](#incident-response)

---

## Overview

Secrets management ensures that sensitive information (API keys, database credentials, etc.) is:
- Stored securely
- Accessed only by authorized services
- Rotated regularly
- Never exposed in logs or version control
- Audited for access

### Architecture

```
┌─────────────────────────────────────────────┐
│         GitHub Secrets Encrypted            │
│         (Stored at rest, AES-256)           │
└─────────────────────────────────────────────┘
                      ↓
        GitHub Actions Workflow Execution
                      ↓
┌─────────────────────────────────────────────┐
│   Environment Variables (Masked in logs)    │
│   - Available to steps that need them       │
│   - Automatically scrubbed from output      │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│        Application Runtime                   │
│        - In-memory, not persisted           │
│        - Available via process.env          │
└─────────────────────────────────────────────┘
```

---

## Secret Types

### 1. Authentication Credentials

Used for service authentication and authorization.

| Secret Name | Purpose | Format | Rotation |
|-------------|---------|--------|----------|
| `CLERK_PUBLISHABLE_KEY` | Frontend authentication | `pk_test_...` | Quarterly |
| `CLERK_SECRET_KEY` | Backend authentication | `sk_test_...` | Quarterly |
| `GITHUB_TOKEN` | GitHub API access | `ghp_...` | Annually |

### 2. API Keys

External service integrations.

| Secret Name | Purpose | Format | Rotation |
|-------------|---------|--------|----------|
| `PUSHER_KEY` | Real-time messaging | `xxx...xxx` | Quarterly |
| `PUSHER_SECRET` | Pusher authentication | `xxx...xxx` | Quarterly |
| `OPENWEATHER_API_KEY` | Weather data | `xxx...xxx` | Annually |
| `PLUTO_API_KEY` | Pluto streaming | `xxx...xxx` | Annually |

### 3. Database Credentials

Database connection strings and passwords.

| Secret Name | Environment | Format | Rotation |
|-------------|-------------|--------|----------|
| `STAGING_DATABASE_URL` | Staging | `postgresql://user:pass@host:port/db` | Monthly |
| `PRODUCTION_DATABASE_URL` | Production | `postgresql://user:pass@host:port/db` | Quarterly |
| `DB_PASSWORD` | Local | Plain text | Never (dev only) |

### 4. Container Registry Credentials

Docker registry access.

| Secret Name | Purpose | Format | Rotation |
|-------------|---------|--------|----------|
| `REGISTRY_USERNAME` | Docker registry login | Username | Quarterly |
| `REGISTRY_PASSWORD` | Docker registry password | Token or password | Monthly |

### 5. Deployment Credentials

Cloud provider and deployment tools.

| Secret Name | Purpose | Format | Rotation |
|-------------|---------|--------|----------|
| `AWS_ACCESS_KEY_ID` | AWS API access | Key ID | Quarterly |
| `AWS_SECRET_ACCESS_KEY` | AWS API secret | Secret key | Quarterly |
| `SLACK_WEBHOOK_URL` | Slack notifications | `https://hooks.slack.com/...` | Quarterly |

### 6. Session & Security Keys

Application security tokens.

| Secret Name | Purpose | Format | Rotation |
|-------------|---------|--------|----------|
| `SESSION_SECRET` | Session encryption | Random 32+ chars | Annually |
| `JWT_SECRET` | JWT signing | Random 32+ chars | Annually |

---

## Adding Secrets to GitHub Actions

### Step 1: Access GitHub Settings

1. Go to GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**

### Step 2: Add New Secret

Click **New repository secret**

```
Name: SECRET_NAME
Value: [paste secret value]
```

### Step 3: Configure for Environments (Optional)

For environment-specific secrets:

1. Go to **Environments**
2. Select environment (staging, production)
3. Add environment secrets

**Example: Environment-specific database URLs**

```
Repository Secrets:
- DATABASE_URL (default/fallback)

Environment Secrets - Staging:
- STAGING_DATABASE_URL

Environment Secrets - Production:
- PRODUCTION_DATABASE_URL
```

### Step 4: Reference in Workflows

In workflow YAML:

```yaml
jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Deploy Application
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
          CLERK_SECRET: ${{ secrets.CLERK_SECRET_KEY }}
        run: |
          # Secrets are masked automatically in logs
          npm run deploy
```

---

## Accessing Secrets in CI/CD

### GitHub Actions Workflow

```yaml
# Method 1: As environment variables
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}

steps:
  - name: Use secret
    run: |
      curl -H "Authorization: Bearer $API_KEY" https://api.example.com
```

```yaml
# Method 2: Pass to step only
steps:
  - name: Deploy
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    run: npm run db:migrate
```

```yaml
# Method 3: Pass to specific action
- name: Docker login
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ secrets.REGISTRY_USERNAME }}
    password: ${{ secrets.REGISTRY_PASSWORD }}
```

### Best Practices in Workflows

✅ **DO**:
```yaml
- name: Good example
  env:
    SECRET: ${{ secrets.MY_SECRET }}
  run: |
    # Secret is available but masked in logs
    curl -H "Auth: $SECRET" https://api.example.com
```

❌ **DON'T**:
```yaml
- name: Bad example
  run: |
    # Never hardcode or echo secrets
    echo "token=sk_live_xxxxxxx"
    curl -H "Auth: sk_live_xxxxxxx" https://api.example.com
```

---

## Local Development

### Setup Local Secrets

1. **Copy example file**
   ```bash
   cp .env.example .env
   ```

2. **Edit with your values**
   ```bash
   nano .env
   ```

3. **For sensitive values, get them from:**
   - Shared password manager (1Password, LastPass, Vault)
   - Ask team lead for access
   - Generate new API keys for development

4. **Verify setup**
   ```bash
   npm run verify-env
   ```

### Local Secrets File (.env)

```bash
# NEVER commit this file
# Add to .gitignore (should already be there)
cat .env >> .gitignore

# Verify it's ignored
git status
# Should NOT show .env
```

### Using docker-compose with Secrets

```bash
# Create .env file for docker-compose
cp .env.example .env

# Update values
nano .env

# Start services
docker-compose up -d

# Verify services have access
docker exec family-hub-app env | grep DATABASE_URL
```

---

## Secret Rotation

### Rotation Schedule

| Secret Type | Rotation Frequency | Last Rotation | Next Rotation |
|-------------|-------------------|---------------|--------------|
| API Keys | Quarterly | 2024-02-01 | 2024-05-01 |
| Database Passwords | Monthly | 2024-02-01 | 2024-03-01 |
| Clerk Keys | Quarterly | 2024-01-15 | 2024-04-15 |
| Session Secrets | Annually | 2023-02-01 | 2024-02-01 |

### Rotation Process

#### Step 1: Generate New Secret

```bash
# For API keys: Use provider's dashboard
# For passwords: Use password generator
# For session secrets: Use openssl
openssl rand -base64 32

# Copy the output
# Example: AbCdEfGhIjKlMnOpQrStUvWxYz0123456789==
```

#### Step 2: Add New Secret

1. Go to GitHub Settings → Secrets
2. Create new secret with version suffix
   ```
   API_KEY_V2 = [new value]
   API_KEY_V1 = [old value] (for rollback)
   ```

#### Step 3: Update Application

```bash
# Update references (if needed)
git grep "API_KEY" | grep -v ".env.example"

# Update deployment to use new secret
# This should happen in the next release
```

#### Step 4: Deploy to Staging

```bash
# Test with new secret in staging
# Monitor for errors
# Verify functionality
```

#### Step 5: Deploy to Production

```bash
# After staging validation, deploy to production
# Keep old secret available for 24 hours
# Monitor for issues
```

#### Step 6: Cleanup

After 24-48 hours with no issues:

```bash
# Remove old secret
gh secret delete API_KEY_V1

# Or keep as backup for 1 week, then delete
```

### Automated Rotation (Advanced)

For sensitive credentials, consider using a secrets management service:

```bash
# Option 1: AWS Secrets Manager
# Automatically rotate RDS passwords
# Rotation: Every 30 days

# Option 2: HashiCorp Vault
# Centralized secret management
# Automatic rotation support

# Option 3: GitHub's native rotation
# Coming in future releases
```

---

## Security Best Practices

### 1. Principle of Least Privilege

```yaml
# ✅ Good: Specific role with minimal permissions
jobs:
  deploy:
    environment: production
    # Only this job can access production secrets
    
    steps:
      - name: Deploy
        env:
          DB_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}
        run: |
          # Only this step needs the secret
```

```yaml
# ❌ Bad: Exposing all secrets to all steps
env:
  # These are available to ALL steps
  CLERK_KEY: ${{ secrets.CLERK_SECRET_KEY }}
  DB_PASSWORD: ${{ secrets.PRODUCTION_DB_PASSWORD }}
  AWS_SECRET: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### 2. Never Log Secrets

```bash
# ❌ DON'T: This will be visible in logs
echo "DATABASE_URL=$DATABASE_URL"
curl -v -H "Auth: $API_KEY" https://api.example.com

# ✅ DO: Let tools handle secrets safely
npm run deploy  # If the tool doesn't expose secrets
curl -H "Auth: $API_KEY" -s https://api.example.com  # Suppress verbose output
```

### 3. Temporary Credentials

When possible, use temporary credentials instead of long-lived ones:

```bash
# ❌ Long-lived API key
API_KEY=sk_live_1234567890abcdef

# ✅ Temporary token (1-hour expiration)
TOKEN=$(curl -X POST https://auth.example.com/token \
  -d 'grant_type=client_credentials' \
  -H "Authorization: Basic $API_CREDENTIALS")

curl -H "Authorization: Bearer $TOKEN" https://api.example.com
```

### 4. Separate Development and Production Secrets

```bash
# Development (less sensitive)
OPENWEATHER_API_KEY=dev_key_for_testing

# Production (production traffic)
OPENWEATHER_API_KEY=prod_key_with_rate_limits

# These should be different secrets in GitHub
```

### 5. Secret Access Auditing

```bash
# GitHub logs all secret access
# Review in: Settings → Logs → Secret access

# Example audit entry:
# 2024-02-07 12:34:56 | deploy-production.yml | Referenced CLERK_SECRET_KEY
# 2024-02-07 12:34:57 | deploy-production.yml | Referenced DATABASE_URL
```

### 6. Incident Response for Exposed Secrets

If a secret is accidentally exposed:

```bash
# Step 1: IMMEDIATE - Revoke the secret
# In GitHub: Delete the secret
gh secret delete EXPOSED_SECRET

# Step 2: Rotate credentials at source
# Example: Revoke API key in service provider's dashboard

# Step 3: Generate new credentials
# Create new secret with higher security

# Step 4: Redeploy
# Force redeployment with new credentials
gh workflow run deploy-production.yml -f force_redeploy=true

# Step 5: Audit
# Check logs to see who accessed the secret
# Review commit history for accidental commits

# Step 6: Document
# Create incident report
# Update team on what happened and lessons learned
```

---

## Accessing Secrets in Application Code

### React Frontend

Never store secrets in frontend code!

```javascript
// ❌ DON'T: Secrets in frontend
const apiKey = "sk_live_xxxxxxx";  // NEVER!
const dbPassword = "password123";  // NEVER!

// ✅ DO: Only public keys in frontend
const CLERK_PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
// This is safe because it's meant to be public
```

### Node.js Backend

```javascript
// ✅ Backend can access secrets safely
const db = connect(process.env.DATABASE_URL);
const apiKey = process.env.OPENWEATHER_API_KEY;

// ✅ Never log them
console.log("Database:", process.env.DATABASE_URL); // ❌ DON'T
console.log("Connected to database"); // ✅ DO
```

### Environment Variables in TypeScript

```typescript
// Create a validated config object
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  API_PORT: z.string().default('3000'),
});

const config = envSchema.parse(process.env);

// Now TypeScript knows the types and presence of secrets
// And secrets are only read once at startup
export const getConfig = () => config;
```

---

## Testing with Secrets

### Unit Tests

```typescript
// ✅ Mock secrets for unit tests
describe('Database', () => {
  it('connects with provided URL', () => {
    const mockUrl = 'postgresql://test:test@localhost:5432/test';
    const db = new Database(mockUrl);
    expect(db.isConnected()).toBe(true);
  });
});
```

### Integration Tests (CI)

```yaml
# In GitHub Actions, use test secrets
jobs:
  test:
    steps:
      - name: Run integration tests
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          API_KEY: ${{ secrets.TEST_API_KEY }}
        run: npm test
```

### Local Testing

```bash
# Use .env.local for local testing (with test credentials)
cp .env.example .env.local

# Edit with TEST values (not production!)
nano .env.local

# Run tests
npm test

# Do NOT commit .env.local
git add .env.local
git commit -m "❌ DO NOT PUSH THIS"
```

---

## Secret Verification Checklist

- [ ] No secrets in .gitignore violations (run `git status`)
- [ ] No hardcoded secrets in source code (run `grep -r "sk_" app/` )
- [ ] All required secrets in GitHub Settings
- [ ] All secrets masked in CI/CD logs
- [ ] Rotation dates tracked
- [ ] Access logs reviewed monthly
- [ ] Incident response plan documented
- [ ] Team trained on secret handling

---

## Contact & Support

- **Security Team**: security@familyhub.local
- **DevOps Team**: devops@familyhub.local
- **Vault Admin**: vault-admin@familyhub.local
- **Emergency**: [phone number]

---

**Last Updated**: February 7, 2024
**Maintained By**: Security & DevOps Team
**Next Review**: February 21, 2024
**Rotation Schedule**: Monthly (first Friday)
