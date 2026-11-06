Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " VoiceBridge: Real-Time Call Translator (Telugu <=> Hindi)" -ForegroundColor Green
Write-Host " Starting Unified Server..." -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

# Check if port 8000 is occupied by a lingering process and free it
try {
    $occupied = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($occupied) {
        $pids = $occupied | Select-Object -ExpandProperty OwningProcess -Unique
        Write-Host "[Notice] Port 8000 is in use by process ID(s): $($pids -join ', '). Releasing port..." -ForegroundColor Yellow
        foreach ($procId in $pids) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 600
    }
} catch {}

Set-Location -Path "$PSScriptRoot\backend"
if (Test-Path ".\.venv\Scripts\python.exe") {
    & ".\.venv\Scripts\python.exe" "main.py"
} elseif (Test-Path "..\venv\Scripts\python.exe") {
    & "..\venv\Scripts\python.exe" "main.py"
} else {
    python main.py
}
