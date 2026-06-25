# КК9 App

React + Vite + Firebase character sheet app for the КК9 tabletop campaign.

## Development

```bash
cp .env.example .env.local   # fill in your Firebase credentials
npm install
npm run dev
```

## CI/CD

Two GitHub Actions workflows run on every push:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push + PR to `main` | `npm ci` → lint → build |
| `deploy.yml` | push to `main` | build → publish `dist/` to `gh-pages` |

### Required GitHub Actions secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Firebase `appId` |

The `GITHUB_TOKEN` secret is provided automatically by GitHub Actions — no manual setup needed for the deploy step.

## Deploy manually

```bash
npm run deploy
```

Builds and pushes `dist/` to the `gh-pages` branch. Requires `gh-pages` package (already in devDependencies).
