#!/usr/bin/env bash
# Deploy Open Road to Google Cloud Run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/open-road"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID to your Google Cloud project ID}"
: "${GCP_REGION:=us-central1}"
SERVICE_NAME="${GCP_SERVICE_NAME:-open-road}"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:latest"

echo "Project:  $GCP_PROJECT_ID"
echo "Region:   $GCP_REGION"
echo "Service:  $SERVICE_NAME"
echo "Image:    $IMAGE"

gcloud config set project "$GCP_PROJECT_ID"

echo "Enabling required APIs (safe to rerun)..."
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --quiet

echo "Ensuring Artifact Registry repo exists..."
if ! gcloud artifacts repositories describe cloud-run-source-deploy \
  --location="$GCP_REGION" &>/dev/null; then
  gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --description="Cloud Run images"
fi

echo "Building and pushing container..."
BUILD_ID="$(gcloud builds submit "$GAME" --tag "$IMAGE" --async --format='value(id)')"
echo "Cloud Build: $BUILD_ID"
while true; do
  STATUS="$(gcloud builds describe "$BUILD_ID" --format='value(status)')"
  echo "Build status: $STATUS"
  case "$STATUS" in
    SUCCESS) break ;;
    FAILURE|INTERNAL_ERROR|TIMEOUT|CANCELLED|EXPIRED)
      echo "Build failed. Logs: https://console.cloud.google.com/cloud-build/builds/$BUILD_ID?project=$GCP_PROJECT_ID"
      exit 1
      ;;
  esac
  sleep 8
done

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --quiet

URL="$(gcloud run services describe "$SERVICE_NAME" --region "$GCP_REGION" --format='value(status.url)')"
echo ""
echo "Deployed! Open Road is live at:"
echo "$URL"
