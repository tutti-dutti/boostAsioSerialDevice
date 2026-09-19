# Deploy Cookie Guard to Google Cloud Run

Host the game on **Cloud Run** (Google's serverless service). Free tier covers small traffic.

## What you need

1. A [Google Cloud project](https://console.cloud.google.com/)
2. Billing enabled on that project (Cloud Run has a free tier)
3. `gcloud` CLI installed on your computer

## One-time setup on your computer

```bash
# Install gcloud: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Give your account permission to deploy (Owner or these roles: Cloud Run Admin, Cloud Build Editor, Artifact Registry Admin).

## Deploy from this repo

```bash
export GCP_PROJECT_ID=YOUR_PROJECT_ID
export GCP_REGION=us-central1          # optional
export GCP_SERVICE_NAME=cookie-guard     # optional

bash scripts/deploy-gcp.sh
```

The script will:
- Turn on Cloud Run, Cloud Build, Artifact Registry, and **Firestore**
- Build the game + feedback API in Docker
- Deploy it as a public website
- Print your live URL (like `https://cookie-guard-xxxxx-uc.a.run.app`)

Feedback and idea requests are saved to the Firestore collection `cookie_guard_feedback` (no email).

## Auto-deploy with GitHub Actions (optional)

Add these **repository secrets** in GitHub → Settings → Secrets → Actions:

| Secret | What to put |
|--------|-------------|
| `GCP_PROJECT_ID` | Your Google Cloud project ID |
| `GCP_SA_KEY` | Full JSON key for a service account with Cloud Run + Cloud Build + Artifact Registry access |

Create the service account in [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts). Roles: **Cloud Run Admin**, **Cloud Build Editor**, **Artifact Registry Administrator**, **Service Account User**.

After secrets are set, push to `master` (or run the workflow manually) to deploy.

## Manual Docker test (local)

```bash
cd game
docker build -t cookie-guard .
docker run -p 8080:8080 cookie-guard
# Open http://localhost:8080
```
