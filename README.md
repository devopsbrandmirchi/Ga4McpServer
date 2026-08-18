# GA4 Analytics MCP

Personal Google Analytics 4 connector for **Claude.ai Custom Connectors**, hosted on **Google Cloud Run**.

```text
Claude.ai Custom Connector
  → https://ga4-mcp-xxxxx-uc.a.run.app/ga4mcp
  → Cloud Run
  → Google Analytics Data API
  → your GA4 properties
```

There is no local stdio server, no `npx` requirement, and no `claude_desktop_config.json`.

Two authentication layers stay separate:

1. **Claude → MCP:** MCP OAuth (CIMD / DCR)
2. **MCP → Google:** Google OAuth refresh token stored in `GOOGLE_REFRESH_TOKEN`

## MCP tools

| Tool | Purpose |
| --- | --- |
| `ga4_list_properties` | Discover properties on the connected Google account |
| `ga4_get_metadata` | List valid dimensions and metrics |
| `ga4_run_report` | Historical GA4 reports |
| `ga4_run_realtime_report` | Last ~30 minutes |

## Local development

```bash
npm install
copy .env.example .env.local
```

Fill in `.env.local`, then:

```bash
npm run dev
```

- App: `http://localhost:3000`
- MCP: `http://localhost:3000/ga4mcp`
- Google OAuth: `http://localhost:3000/oauth/google`
- Health: `http://localhost:3000/health`

```bash
npm test
npm run build
```

Claude.ai cannot reach `localhost`. Deploy to Cloud Run before adding the Custom Connector.

## Google Cloud setup (one project)

Use the same Google Cloud project for APIs, OAuth, and Cloud Run.

### 1. Install and sign in

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Run:

```powershell
gcloud auth login
gcloud auth application-default login
```

3. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).

```powershell
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable APIs

```powershell
.\scripts\cloud-run-setup.ps1 -ProjectId YOUR_PROJECT_ID -Region us-central1
```

This enables:

- Cloud Run
- Cloud Build
- Artifact Registry
- Google Analytics Data API
- Google Analytics Admin API

Or enable them in Console: **APIs & Services → Library**.

### 3. OAuth consent and web client

This Google OAuth client is only so **Cloud Run** can read your GA4 data. It is not the Claude.ai Advanced Settings client.

1. Open **APIs & Services → OAuth consent screen**.
2. User type: **External** for a personal Gmail account.
3. App name: `GA4 MCP`.
4. Add yourself as a test user if you stay in Testing.
5. Publish to **Production** so refresh tokens do not expire after 7 days.
6. Create **OAuth client ID** credentials.
7. Application type: **Web application**.
8. Authorized redirect URIs (add both):
   - `http://localhost:3000/oauth/google/callback`
   - `https://ga4-mcp-XXXXXXXX-uc.a.run.app/oauth/google/callback`  
     (use the real Cloud Run URL after the first deploy)
9. Scope used by this app:

```text
https://www.googleapis.com/auth/analytics.readonly
```

10. Copy the client ID and client secret. Do not commit them.

The Google account you authorize must already have access to the GA4 properties Claude should query.

## Deploy to Cloud Run

Default service name: `ga4-mcp`. Default region: `us-central1`.

```powershell
.\scripts\cloud-run-deploy.ps1 -ProjectId YOUR_PROJECT_ID -Region us-central1
```

The script prints:

```text
https://ga4-mcp-XXXXXXXX-uc.a.run.app
https://ga4-mcp-XXXXXXXX-uc.a.run.app/ga4mcp
https://ga4-mcp-XXXXXXXX-uc.a.run.app/health
https://ga4-mcp-XXXXXXXX-uc.a.run.app/oauth/google/callback
```

The service is deployed **allow unauthenticated**. That is required. Claude.ai connects from Anthropic (`160.79.104.0/21`). Auth is `MCP_AUTH_TOKEN` / MCP OAuth, not Cloud Run IAM.

### Set environment variables

```powershell
.\scripts\cloud-run-set-env.ps1 `
  -ProjectId YOUR_PROJECT_ID `
  -AppBaseUrl "https://ga4-mcp-XXXXXXXX-uc.a.run.app" `
  -GoogleClientId "....apps.googleusercontent.com" `
  -GoogleClientSecret "...." `
  -McpAuthToken "a-long-random-string"
```

Then add the Cloud Run callback URL to the Google OAuth client if you have not already.

### Connect Google

1. Open `https://ga4-mcp-XXXXXXXX-uc.a.run.app/oauth/google`
2. Enter `MCP_AUTH_TOKEN`
3. Sign in with your Google account
4. Copy `GOOGLE_REFRESH_TOKEN` from the success page
5. Set it and let Cloud Run start a new revision:

```powershell
.\scripts\cloud-run-set-env.ps1 `
  -ProjectId YOUR_PROJECT_ID `
  -AppBaseUrl "https://ga4-mcp-XXXXXXXX-uc.a.run.app" `
  -GoogleClientId "....apps.googleusercontent.com" `
  -GoogleClientSecret "...." `
  -McpAuthToken "a-long-random-string" `
  -GoogleRefreshToken "1//...."
```

Cloud Run cannot write env vars from inside the container. Same rule as any serverless host.

### Confirm the service

```text
https://ga4-mcp-XXXXXXXX-uc.a.run.app/health
```

must return:

```json
{"status":"ok"}
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_BASE_URL` | Yes | Cloud Run origin, no trailing slash |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth web client |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth web client secret |
| `GOOGLE_REDIRECT_URI` | No | Defaults to `${APP_BASE_URL}/oauth/google/callback` |
| `MCP_AUTH_TOKEN` | Yes | Operator setup token for Google OAuth and Claude MCP consent |
| `GOOGLE_REFRESH_TOKEN` | After Google OAuth | Long-lived Google token |
| `OAUTH_STATE_SECRET` | No | Signs Google OAuth state cookies |
| `MCP_TOKEN_SECRET` | No | Signs MCP JWTs. Defaults to `MCP_AUTH_TOKEN` |
| `MCP_OAUTH_CLIENT_ID` | No | Only for Claude.ai Advanced Settings confidential client |
| `MCP_OAUTH_CLIENT_SECRET` | No | Pair for that optional client |

Set these on the Cloud Run service. Do not put them in Git.

Optional Console path: **Cloud Run → ga4-mcp → Edit & deploy new revision → Variables & secrets**.

## Claude.ai Custom Connector

1. Confirm `/health` returns `{"status":"ok"}`.
2. Finish Google OAuth and set `GOOGLE_REFRESH_TOKEN`.
3. In Claude.ai open **Customize → Connectors → Add custom connector**.
4. Name: `GA4 Analytics`
5. URL:

```text
https://ga4-mcp-XXXXXXXX-uc.a.run.app/ga4mcp
```

6. Leave Advanced OAuth Client ID / Secret empty.
7. Click **Add**.
8. Enable the connector in **+ → Connectors**.
9. The first GA4 tool call shows **Connect**. Enter `MCP_AUTH_TOKEN` on this app’s consent page (not your Google password).
10. Ask: **How many users did I have yesterday?**

## Manual gcloud (if you do not want the scripts)

```powershell
gcloud artifacts repositories create ga4-mcp --repository-format=docker --location=us-central1
gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=us-central1
gcloud run services describe ga4-mcp --region us-central1 --format="value(status.url)"
gcloud run services update ga4-mcp --region us-central1 --update-env-vars APP_BASE_URL=https://...,GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,GOOGLE_REDIRECT_URI=https://.../oauth/google/callback,MCP_AUTH_TOKEN=...
```

## Security

- Never log Google tokens, authorization codes, client secrets, or MCP JWTs.
- MCP tools never return secrets.
- Only `GOOGLE_REFRESH_TOKEN` is persisted, as a Cloud Run env var.
- Cloud Run ingress is public so Claude can connect. Do not also put a Cloud IAP / IAM login in front of `/ga4mcp`.
- Generate a long random `MCP_AUTH_TOKEN`.

## Dates

Passed to GA4 unchanged: `today`, `yesterday`, `7daysAgo`, `30daysAgo`, `90daysAgo`, or `YYYY-MM-DD`. The `date` dimension comes back as `YYYYMMDD`.

## Known limitations

- One Google account and one refresh token.
- Cloud Run cannot persist a file or mutate env vars at runtime; set `GOOGLE_REFRESH_TOKEN` and deploy a new revision.
- Google Testing-mode refresh tokens expire after about 7 days.
- Realtime data is roughly the last 30 minutes.
- Report size is capped at 10,000 rows.
- Cold starts can add a few seconds when `min-instances` is 0.

## Files added for Cloud Run

| File | Purpose |
| --- | --- |
| `Dockerfile` | Production Next.js standalone image |
| `cloudbuild.yaml` | Build image and deploy Cloud Run |
| `scripts/cloud-run-setup.ps1` | Enable APIs and Artifact Registry |
| `scripts/cloud-run-deploy.ps1` | Build and deploy |
| `scripts/cloud-run-set-env.ps1` | Set Cloud Run env vars |
