param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [string]$AppBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$GoogleClientId,

  [Parameter(Mandatory = $true)]
  [string]$GoogleClientSecret,

  [Parameter(Mandatory = $true)]
  [string]$McpAuthToken,

  [string]$GoogleRefreshToken = "",
  [string]$Region = "us-central1",
  [string]$Service = "ga4-mcp"
)

$ErrorActionPreference = "Stop"

$base = $AppBaseUrl.TrimEnd("/")
$redirect = "$base/oauth/google/callback"

$pairs = @(
  "APP_BASE_URL=$base",
  "GOOGLE_CLIENT_ID=$GoogleClientId",
  "GOOGLE_CLIENT_SECRET=$GoogleClientSecret",
  "GOOGLE_REDIRECT_URI=$redirect",
  "MCP_AUTH_TOKEN=$McpAuthToken"
)

if ($GoogleRefreshToken) {
  $pairs += "GOOGLE_REFRESH_TOKEN=$GoogleRefreshToken"
}

Write-Host "Updating Cloud Run environment for $Service (values are not printed)"
gcloud run services update $Service `
  --region $Region `
  --project $ProjectId `
  --update-env-vars ($pairs -join ",")

Write-Host "Environment updated. Revision will start automatically."
Write-Host "Add this Google OAuth redirect URI if you have not already:"
Write-Host "  $redirect"
