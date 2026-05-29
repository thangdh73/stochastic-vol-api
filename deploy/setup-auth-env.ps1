# Generate values for Render / local auth (run once, store secrets in Render dashboard).
$secret = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
Write-Host "Add these environment variables on Render (stochastic-vol-api -> Environment):"
Write-Host ""
Write-Host "MMRA_JWT_SECRET=$secret"
Write-Host "MMRA_AUTH_USERS=your.email@example.com:ChooseAStrongPassword"
Write-Host ""
Write-Host "Format: email:password pairs, comma-separated for multiple users."
Write-Host "Local dev: leave MMRA_AUTH_USERS unset to skip login."
