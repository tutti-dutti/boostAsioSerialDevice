#!/usr/bin/env bash
# Deploy Cookie Guard to Google Cloud Run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GAME="$ROOT/game"

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID to your Google Cloud project ID}"
: "${GCP_REGION:=us-central1}"
SERVICE_NAME="${GCP_SERVICE_NAME:-cookie-guard}"
IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:latest"
FEEDBACK_BUCKET="${FEEDBACK_BUCKET:-${GCP_PROJECT_ID}-cookie-guard-data}"

echo "Project:  $GCP_PROJECT_ID"
echo "Region:   $GCP_REGION"
echo "Service:  $SERVICE_NAME"
echo "Image:    $IMAGE"
echo "Bucket:   $FEEDBACK_BUCKET"

gcloud config set project "$GCP_PROJECT_ID"

echo "Enabling required APIs (safe to rerun)..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  --quiet

echo "Ensuring Artifact Registry repo exists..."
if ! gcloud artifacts repositories describe cloud-run-source-deploy \
  --location="$GCP_REGION" &>/dev/null; then
  gcloud artifacts repositories create cloud-run-source-deploy \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --description="Cookie Guard Cloud Run images"
fi

echo "Ensuring feedback storage bucket exists..."
if ! gcloud storage buckets describe "gs://${FEEDBACK_BUCKET}" --project="$GCP_PROJECT_ID" &>/dev/null; then
  gcloud storage buckets create "gs://${FEEDBACK_BUCKET}" \
    --project="$GCP_PROJECT_ID" \
    --location="$GCP_REGION" \
    --uniform-bucket-level-access
fi

PROJECT_NUMBER="$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Granting object write on gs://${FEEDBACK_BUCKET} to ${RUNTIME_SA} ..."
gcloud storage buckets add-iam-policy-binding "gs://${FEEDBACK_BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectAdmin" \
  --project="$GCP_PROJECT_ID" >/dev/null || true

echo "Building and pushing container..."
gcloud builds submit "$GAME" --tag "$IMAGE" --quiet

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
  --set-env-vars="FEEDBACK_BUCKET=${FEEDBACK_BUCKET},FEEDBACK_PREFIX=feedback/,GOOGLE_CLOUD_PROJECT=${GCP_PROJECT_ID}" \
  --quiet

URL="$(gcloud run services describe "$SERVICE_NAME" --region "$GCP_REGION" --format='value(status.url)')"
echo ""
echo "Deployed! Open your game at:"
echo "$URL"
echo "Feedback is stored in gs://${FEEDBACK_BUCKET}/feedback/"
