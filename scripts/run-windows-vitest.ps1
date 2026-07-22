param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
  [string[]]$TestFiles
)

$ErrorActionPreference = "Stop"
$suiteName = ($TestFiles -join ",").Replace("/", "-").Replace("\\", "-")
$stdoutPath = Join-Path $env:RUNNER_TEMP "astrograph-vitest-$suiteName.stdout.log"
$stderrPath = Join-Path $env:RUNNER_TEMP "astrograph-vitest-$suiteName.stderr.log"
$arguments = @(
  "exec",
  "vitest",
  "run",
  "--no-file-parallelism",
  "--reporter=verbose",
  "--testTimeout=30000",
  "--hookTimeout=30000"
) + $TestFiles

$startProcessOptions = @{
  FilePath = "pnpm.cmd"
  ArgumentList = $arguments
  NoNewWindow = $true
  PassThru = $true
  RedirectStandardOutput = $stdoutPath
  RedirectStandardError = $stderrPath
}
$process = Start-Process @startProcessOptions

if (-not $process.WaitForExit(240000)) {
  & taskkill.exe /PID $process.Id /T /F | Out-Host
  Get-Content $stdoutPath -ErrorAction SilentlyContinue
  Get-Content $stderrPath -ErrorAction SilentlyContinue
  throw "Vitest suite exceeded its four-minute Windows CI limit: $($TestFiles -join ' ')"
}

Get-Content $stdoutPath -ErrorAction SilentlyContinue
Get-Content $stderrPath -ErrorAction SilentlyContinue
if ($process.ExitCode -ne 0) {
  exit $process.ExitCode
}
