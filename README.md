# Cookie Guard

Kid-friendly idle tower defense game inspired by the *format* of Summoner's Greed — new story, characters, and setting.

Play it:

```bash
cd game
npm install
npm run dev
```

See `game/README.md` for how to play.

## Deploy to Google Cloud (GCP)

Host on **Cloud Run**:

```bash
export GCP_PROJECT_ID=your-gcp-project-id
bash scripts/deploy-gcp.sh
```

Full steps: [`game/DEPLOY.md`](game/DEPLOY.md)
