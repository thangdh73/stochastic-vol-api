# Seed "QA Full Dummy" via API (requires backend on 8010).
# Frontend can also load the same case: Dashboard → Load QA full dummy.

$base = "http://127.0.0.1:8010"
$health = Invoke-RestMethod "$base/health" -ErrorAction Stop
Write-Host "Backend OK — engine $($health.engine_version)"

$pm = Invoke-RestMethod "$base/api/validation-cases/pm3xd"
$pm.prospect_name = "QA Full Dummy"
$pm.n_iterations = 3000
$pm.seed = 20260528

$v = Invoke-RestMethod -Method Post -Uri "$base/api/validate" -ContentType "application/json" -Body ($pm | ConvertTo-Json -Depth 30 -Compress)
if ($v.has_errors) {
  Write-Error "PM3XD-based validate failed"
  exit 1
}

$created = Invoke-RestMethod -Method Post -Uri "$base/api/prospects" -ContentType "application/json" -Body (@{
  name = "QA Full Dummy (API seed)"
  metadata = @{
    basin = "QA Basin"
    country = "QA Country"
    formation = "QA Formation"
    estimating_method = "area_net_pay_yield"
  }
} | ConvertTo-Json -Compress)

$saved = Invoke-RestMethod -Method Post -Uri "$base/api/prospects/$($created.id)/input-sets" -ContentType "application/json" -Body (@{ input = $pm } | ConvertTo-Json -Depth 30 -Compress)
Write-Host "Created prospect id=$($created.id) input_set id=$($saved.id)"
Write-Host "Open Dashboard → saved project, or use Load QA full dummy for full 3x2 envelope."
