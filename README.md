# GA4 Analytics MCP

Personal Google Analytics 4 connector for **Claude.ai Custom Connectors**. One Google account, one MCP server, deployed on Vercel.

```text
Claude.ai Custom Connector
  → https://<VERCEL_PROJECT_NAME>.vercel.app/ga4mcp
  → Vercel Streamable HTTP MCP
  → Google Analytics Data API
  → your GA4 properties
```

There is no local stdio server, no `npx` requirement, and no `claude_desktop_config.json`.

Two authentication layers stay separate:

1. **Claude → MCP:** MCP OAuth (CIMD / DCR / optional Advanced Settings client)
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

Claude.ai cannot reach `localhost`. Deploy to Vercel before adding the Custom Connector.

## Google Cloud setup

This is only so **the MCP server** can read your GA4 data. It is not the Claude.ai connector OAuth client.

1. Create or select a Google Cloud project.
2. Enable [Google Analytics Data API](https://console.cloud.google.com/flows/enableapi?apiid=analyticsdata.googleapis.com).
3. Enable [Google Analytics Admin API](https://console.cloud.google.com/flows/enableapi?apiid=analyticsadmin.googleapis.com).
4. Configure the OAuth consent screen (External for personal Gmail). Publish to Production so refresh tokens do not expire after 7 days.
5. Create a **Web application** OAuth client.
6. Authorized redirect URIs:
   - `http://localhost:3000/oauth/google/callback`
   - `https://<VERCEL_PROJECT_NAME>.vercel.app/oauth/google/callback`
7. Scope used by this app:

   ```text
   https://www.googleapis.com/auth/analytics.readonly
   ```

8. Copy the client ID and secret into environment variables.

Then visit `/oauth/google`, enter `MCP_AUTH_TOKEN`, and sign in with the Google account that owns your GA4 properties.

- Locally the refresh token is written to `.env.local`.
- On Vercel, paste `GOOGLE_REFRESH_TOKEN` into project env vars and **redeploy**.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_BASE_URL` | Yes | Public origin, no trailing slash. Production: `https://<VERCEL_PROJECT_NAME>.vercel.app` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth web client |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth web client secret |
| `GOOGLE_REDIRECT_URI` | No | Defaults to `${APP_BASE_URL}/oauth/google/callback` |
| `MCP_AUTH_TOKEN` | Yes | Operator setup token for Google OAuth and Claude MCP consent |
| `GOOGLE_REFRESH_TOKEN` | After Google OAuth | Long-lived Google token |
| `OAUTH_STATE_SECRET` | No | Signs Google OAuth state cookies |
| `MCP_TOKEN_SECRET` | No | Signs MCP access/refresh JWTs. Defaults to `MCP_AUTH_TOKEN` |
| `MCP_OAUTH_CLIENT_ID` | No | Only if using Claude.ai Advanced Settings confidential client |
| `MCP_OAUTH_CLIENT_SECRET` | No | Pair for the optional confidential client |

## Vercel

```bash
npm i -g vercel
vercel
vercel --prod
```

Add the environment variables in the Vercel project. After the first Google OAuth on production, set `GOOGLE_REFRESH_TOKEN` and redeploy.

**Disable Deployment Protection / Vercel Authentication on production.** Claude.ai connects from Anthropic's network (`160.79.104.0/21`). If Vercel SSO sits in front of `/ga4mcp`, the connector cannot connect.

Production URLs:

```text
https://<VERCEL_PROJECT_NAME>.vercel.app/ga4mcp
https://<VERCEL_PROJECT_NAME>.vercel.app/oauth/google/callback
https://<VERCEL_PROJECT_NAME>.vercel.app/health
```

A custom domain is optional later. Keep using `APP_BASE_URL` so no code change is required.

## Claude.ai Custom Connector

1. Deploy to Vercel and confirm `https://<VERCEL_PROJECT_NAME>.vercel.app/health` returns `{"status":"ok"}`.
2. Connect Google at `https://<VERCEL_PROJECT_NAME>.vercel.app/oauth/google`.
3. Put `GOOGLE_REFRESH_TOKEN` in Vercel env and redeploy.
4. In Claude.ai open **Customize → Connectors → Add custom connector**.
5. Name: `GA4 Analytics`
6. URL:

   ```text
   https://<VERCEL_PROJECT_NAME>.vercel.app/ga4mcp
   ```

7. Leave Advanced OAuth Client ID / Secret empty. Claude uses CIMD against this server's authorization endpoints.
8. Click **Add**.
9. Enable the connector in the chat **+ → Connectors** menu.
10. The first GA4 tool call shows a **Connect** card. Enter `MCP_AUTH_TOKEN` on this app's consent page (not your Google password).
11. Ask: **How many users did I have yesterday?**

`initialize` and `tools/list` are public so Claude can discover tools. `tools/call` returns HTTP 401 with `WWW-Authenticate` until MCP OAuth completes.

## Security

- Never log Google tokens, authorization codes, client secrets, or MCP JWTs.
- MCP tools never return secrets.
- Google access tokens are not stored; only `GOOGLE_REFRESH_TOKEN` persists in env vars.
- Do not put secrets in Git.

## Dates

Passed to GA4 unchanged: `today`, `yesterday`, `7daysAgo`, `30daysAgo`, `90daysAgo`, or `YYYY-MM-DD`. The `date` dimension comes back as `YYYYMMDD`.

## Known limitations

- One Google account and one refresh token.
- Vercel cannot write env vars at runtime; paste `GOOGLE_REFRESH_TOKEN` and redeploy.
- Google Testing-mode refresh tokens expire after about 7 days.
- Realtime data is roughly the last 30 minutes.
- Report size is capped at 10,000 rows.
- I cannot complete the live Claude.ai click-through from this repository; that requires your Claude and Vercel accounts.
