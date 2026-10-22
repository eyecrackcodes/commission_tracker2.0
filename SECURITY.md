# Security Policy

## Overview

This document describes the security hardening measures implemented in this application to protect sensitive data and prevent unauthorized access.

## Critical Security Fixes Applied

### 1. ✅ Secret Management
- **Issue**: Live API keys were committed to git history in `.env.example` (commit 2d2f74d)
- **Fix**: 
  - Replaced all live secrets with placeholder values in `.env.example`
  - Added `.env.example.local` to `.gitignore`
  - **⚠️ IMPORTANT**: Git history must be purged using `git filter-branch` or BFG Repo-Cleaner
  - All compromised keys have been rotated by the project owner

### 2. ✅ API Route Authentication
All API routes now require authentication and enforce ownership checks:

| Route | Auth | Ownership Check |
|-------|------|-----------------|
| `/api/notifications` | ✅ Clerk JWT | ✅ User can only access their own data; admins can view all |
| `/api/update-commission-rates` | ✅ Clerk JWT | ✅ Admin-only |
| `/api/create-agent-profile` | ✅ Clerk JWT | ✅ Users create own; admins can create for others |
| `/api/modify-agent-profile` | ✅ Clerk JWT | ✅ Users modify own; admins can modify others |
| `/api/agent-profile` | ✅ Clerk JWT | ✅ Ownership enforced with admin override |
| `/api/admin/*` | ✅ Clerk JWT | ✅ Admin role required |
| `/api/webhooks/clerk` | ✅ Svix signature | ✅ Cryptographic verification |

### 3. ✅ Row-Level Security (RLS)
Comprehensive Postgres RLS policies ensure database-level access control:

#### Agent Profiles Table
- Users can only view, insert, and update their own profile
- Admins can view all profiles
- Policies use `auth.uid()` JWT claims (not `current_user`)

#### Policies Table
- Users can view, insert, update, and delete only their own policies
- Admins can view and update all policies (for bulk operations)
- All operations filtered by `user_id = auth.uid()`

#### Security Functions
- `is_admin()` function for efficient role checking
- Proper indexes on `user_id` and `role` columns for performance

### 4. ✅ Input Validation
All API routes now validate:
- Required fields are present
- User IDs match authenticated user (unless admin override)
- Action parameters are valid enum values
- Data types are correct

## Security Checklist

### Environment Variables
- [ ] Never commit `.env` files
- [ ] Use placeholder values in `.env.example`
- [ ] Rotate keys immediately if exposed
- [ ] Use environment-specific secrets in production
- [ ] Restrict service role key to server-side only

### Authentication & Authorization
- [x] Every API route checks `auth()` for valid session
- [x] Ownership validation on user-scoped resources
- [x] Admin role verification for privileged operations
- [x] Webhook signature verification (Clerk)
- [x] RLS policies enabled on all tables

### Database Security
- [x] Row-Level Security (RLS) enabled on all tables
- [x] Policies use JWT claims (`auth.uid()`)
- [x] Service role key only used in server-side API routes
- [x] Client-side code uses anon key with RLS enforcement
- [x] Indexes added for performance on filtered columns

### Input Validation
- [x] Required field validation
- [x] Type checking for all inputs
- [x] Ownership checks for user_id parameters
- [x] Enum validation for action types

### Dependency Management
- [x] Regular `npm audit` checks
- [ ] Update vulnerable dependencies (see below)
- [ ] Automated dependency scanning in CI/CD
- [ ] Pin major versions to prevent breaking changes

### Rate Limiting
- [ ] **TODO**: Add rate limiting middleware (recommended: `express-rate-limit` or Vercel Edge Config)
- [ ] **TODO**: Implement rate limits on auth endpoints (login, signup)
- [ ] **TODO**: Rate limit form submission endpoints
- [ ] **TODO**: Add CAPTCHA for public-facing forms

## Known Vulnerabilities (Dependencies)

### Critical (2 packages)
- `form-data` - Update to latest version
- `next` - Update from 14.2.25 to latest 14.x patch

### High (30 packages)
- Multiple transitive dependencies in Clerk, ESLint, and build tools
- Run `npm audit fix` to auto-update compatible versions
- Review breaking changes for major version updates

### Recommended Actions
```bash
# Check current vulnerabilities
npm audit

# Auto-fix compatible updates
npm audit fix

# Update Next.js to latest patch
npm install next@latest

# Update other dependencies
npm update
```

## Git History Cleanup

**⚠️ CRITICAL**: The git history contains committed secrets. These steps must be completed:

1. **Verify key rotation** (already done by project owner)
2. **Clean git history** using one of these methods:

   **Method A: BFG Repo-Cleaner (Recommended)**
   ```bash
   # Download BFG from https://rtyley.github.io/bfg-repo-cleaner/
   java -jar bfg.jar --delete-files .env.example
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force
   ```

   **Method B: git filter-branch**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.example" \
     --prune-empty --tag-name-filter cat -- --all
   git push --force --all
   ```

3. **Notify all developers** to re-clone the repository

## Incident Response

If a security issue is discovered:

1. **Immediate**: Rotate all affected credentials
2. **Urgent**: Patch the vulnerability
3. **Required**: Audit logs for unauthorized access
4. **Follow-up**: Document the incident and prevention measures

## Maintenance

- Review this security policy quarterly
- Update dependencies monthly
- Run `npm audit` before each deployment
- Test RLS policies after schema changes
- Rotate service keys every 90 days (recommended)

## Contact

For security concerns, contact: [Project Owner Email]

---

**Last Updated**: October 22, 2026  
**Policy Version**: 1.0  
**Reviewed By**: Security Hardening Initiative
