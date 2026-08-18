param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "us-central1",
  [string]$Service = "ga4-mcp",
  [string]$Repository = "ga4-mcp"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

gcloud config set project $ProjectId

Write-Host "Submitting Cloud Build (this builds the container and deploys Cloud Run)"
gcloud builds submit $root `
  --project $ProjectId `
  --config "$root\cloudbuild.yaml" `
  --substitutions "_REGION=$Region,_SERVICE=$Service,_REPOSITORY=$Repository"

$serviceUrl = gcloud run services describe $Service `
  --region $Region `
  --project $ProjectId `
  --format "value(status.url)"

Write-Host ""
Write-Host "Cloud Run URL: $serviceUrl"
Write-Host "MCP endpoint:  $serviceUrl/ga4mcp"
Write-Host "Health:        $serviceUrl/health"
Write-Host "Google OAuth:  $serviceUrl/oauth/google"
Write-Host "Google callback: $serviceUrl/oauth/google/callback"
Write-Host ""
Write-Host "Set APP_BASE_URL to $serviceUrl, add the callback URI in Google Cloud OAuth, then run cloud-run-set-env.ps1"
