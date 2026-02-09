# CI/CD Setup Guide (Optional)

This guide explains the optional GitHub Actions workflow for testing builds.

## Overview

**For production releases, build locally** using `npm run build-release`. The GitHub Actions workflow is optional and meant for testing builds in CI/CD without requiring local setup.

## Local Build + S3 Distribution (Recommended)

See [RELEASE_BUILD.md](../RELEASE_BUILD.md) for the recommended local build process with integrated S3 upload.

## GitHub Actions Workflow (Optional Testing)

The workflow in `.github/workflows/release.yml` is for testing builds only:

- **Trigger:** Manual dispatch from Actions tab
- **Purpose:** Test builds without local environment
- **Models:** Optional (can build with or without AI models)
- **Output:** Artifacts for download (not uploaded to S3)

### Using the Workflow

1. Go to **Actions** tab
2. Select **Test Build (Optional)** workflow
3. Click **Run workflow**
4. Configure:
   - Version tag (e.g., `v1.0.0`)
   - Include AI models: Yes/No
5. Click **Run workflow**
6. Download artifacts after build completes

### GitHub Secrets (Optional)

Only needed if you want to test builds with models in CI/CD:

| Secret | Description |
|--------|-------------|
| `COMPLINIST_DATA_URL` | URL to complinist-data.tar.gz (models + chroma_db) on S3 |

If this secret is not set, builds will complete without AI models (app works but AI features disabled).

## When to Use CI/CD

- Testing builds on different platforms without local setup
- Verifying build process works in clean environment
- Testing builds without models for size/dependency testing

## When NOT to Use CI/CD

- Production releases (build locally for full control)
- When you need models included (local build is simpler)
- When you want to upload directly to S3 (local script does this)

## Cost Considerations

GitHub Actions minutes are limited on free plans. Local builds are free and faster for production releases.
