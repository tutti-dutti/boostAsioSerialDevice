# Deploy Open Road to Google Cloud Run

Open Road is a static site. Cloud Run serves the built game. Cookie Guard stays on its own service.

## Deploy

```bash
gcloud auth login
gcloud config set project fairway-finder-507002-n2

export GCP_PROJECT_ID=fairway-finder-507002-n2
export GCP_REGION=us-central1
export GCP_SERVICE_NAME=open-road

bash scripts/deploy-open-road-gcp.sh
```

The script turns on Cloud Run, Cloud Build, and Artifact Registry, builds the game, and prints the live URL.

The deploy account needs Cloud Run Admin, Cloud Build Editor, Artifact Registry Administrator, Service Account User, and Storage Admin.

## GitHub Actions

Repository secrets:

| Secret | Value |
|--------|--------|
| `GCP_PROJECT_ID` | `fairway-finder-507002-n2` |
| `GCP_SA_KEY` | JSON key for the deploy service account |

Pushes to `master` that touch `open-road/` deploy automatically. You can also run the workflow by hand.
