#!/usr/bin/env pwsh
# Rebuild Nginx container và test RTMP control API

Write-Host "=== Streaming Platform - Nginx Control API Setup ===" -ForegroundColor Cyan

# Step 1: Backup current docker-compose
Write-Host "`n[1] Stopping containers..." -ForegroundColor Yellow
docker compose -f docker-compose.yml down

Start-Sleep -Seconds 2

# Step 2: Rebuild Nginx image
Write-Host "`n[2] Rebuilding Nginx RTMP container..." -ForegroundColor Yellow
docker compose -f docker-compose.yml up -d --build nginx-rtmp

Write-Host "`nWaiting for Nginx to start..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Step 3: Check if Nginx is running
Write-Host "`n[3] Checking Nginx container status..." -ForegroundColor Yellow
$status = docker ps --filter "name=streaming-nginx" --format "{{.Status}}"
if ($status -match "Up") {
    Write-Host "✅ Nginx container is running: $status" -ForegroundColor Green
} else {
    Write-Host "❌ Nginx container is not running!" -ForegroundColor Red
    Write-Host "Logs:" -ForegroundColor Red
    docker logs streaming-nginx
    exit 1
}

# Step 4: Test HLS endpoint
Write-Host "`n[4] Testing HLS endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/hls/" -ErrorAction Stop
    Write-Host "✅ HLS endpoint responsive (200)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  HLS endpoint returned: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
}

# Step 5: Test RTMP Control API
Write-Host "`n[5] Testing RTMP Control API..." -ForegroundColor Yellow
Write-Host "Testing: GET /control/stat" -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/control/stat" -ErrorAction Stop
    $content = $response.Content

    if ($content -match "rtmp|stream|server") {
        Write-Host "✅ RTMP Control API is working!" -ForegroundColor Green
        Write-Host "`nResponse preview (first 500 chars):" -ForegroundColor Gray
        Write-Host $content.Substring(0, [Math]::Min(500, $content.Length)) -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Got response but format unexpected:" -ForegroundColor Yellow
        Write-Host $content -ForegroundColor Cyan
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    if ($statusCode -eq "NotFound") {
        Write-Host "❌ RTMP Control API returned 404 - Fix not applied yet!" -ForegroundColor Red
        Write-Host "   Make sure nginx.conf has 'location /control { rtmp_control all; }'" -ForegroundColor Red
    } else {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Step 6: Test health endpoint
Write-Host "`n[6] Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -ErrorAction Stop
    Write-Host "✅ Health endpoint responsive" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Health endpoint returned: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
}

# Step 7: Show relevant Nginx logs
Write-Host "`n[7] Nginx startup logs (last 20 lines):" -ForegroundColor Yellow
docker logs streaming-nginx 2>&1 | Select-Object -Last 20 | ForEach-Object {
    if ($_ -match "error|warn") {
        Write-Host "⚠️  $_" -ForegroundColor Yellow
    } else {
        Write-Host $_ -ForegroundColor Gray
    }
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "`n📝 Next steps:" -ForegroundColor Green
Write-Host "1. Start OBS and push stream to: rtmp://localhost:1935/live/{streamKey}"
Write-Host "2. Check logs for: '[on-publish-webhook] Received on_publish'"
Write-Host "3. Test disconnect: OBS should reconnect without 409 conflicts"
Write-Host "4. Monitor: grep 'drop/publisher' in backend logs for control API calls"
Write-Host ""

