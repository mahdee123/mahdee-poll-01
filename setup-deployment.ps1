# Quick deployment setup script for Pool Software (Windows PowerShell)
# This script helps you get ready for Vercel deployment

Write-Host "===== Pool Software - Deployment Setup =====" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify Node and npm
Write-Host "Step 1: Checking Node.js and npm..." -ForegroundColor Yellow
node --version
npm --version
Write-Host ""

# Step 2: Install dependencies
Write-Host "Step 2: Installing dependencies..." -ForegroundColor Yellow
npm install
npm install --prefix client
npm install --prefix server
Write-Host ""

# Step 3: Build the client
Write-Host "Step 3: Building client..." -ForegroundColor Yellow
npm run build --prefix client
Write-Host ""

# Step 4: Create environment files
Write-Host "Step 4: Creating environment file templates..." -ForegroundColor Yellow
if (-not (Test-Path "server\.env")) {
    Copy-Item "server\.env.example" "server\.env"
    Write-Host "Created server\.env - Please edit with your MongoDB URI and JWT_SECRET" -ForegroundColor Green
} else {
    Write-Host "server\.env already exists" -ForegroundColor Gray
}

if (-not (Test-Path "client\.env")) {
    Copy-Item "client\.env.example" "client\.env"
    Write-Host "Created client\.env - Update with your API URL" -ForegroundColor Green
} else {
    Write-Host "client\.env already exists" -ForegroundColor Gray
}
Write-Host ""

# Step 5: Test the build
Write-Host "Step 5: Verifying build output..." -ForegroundColor Yellow
if (Test-Path "client\dist") {
    Write-Host "✓ Client build successful" -ForegroundColor Green
    $buildSize = (Get-ChildItem -Path "client\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "Build size: $([Math]::Round($buildSize, 2)) MB"
} else {
    Write-Host "✗ Client build failed" -ForegroundColor Red
}
Write-Host ""

Write-Host "===== Ready for Deployment =====" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Set up MongoDB at https://www.mongodb.com/cloud/atlas"
Write-Host "2. Update server\.env with MONGODB_URI and JWT_SECRET"
Write-Host "3. Push to GitHub: git push origin main"
Write-Host "4. Deploy frontend on Vercel: https://vercel.com/import"
Write-Host "5. Deploy backend on Railway: https://railway.app"
Write-Host ""
Write-Host "See DEPLOYMENT.md for detailed instructions" -ForegroundColor Gray
