#!/bin/bash
# Quick deployment setup script for Pool Software
# This script helps you get ready for Vercel deployment

echo "===== Pool Software - Deployment Setup ====="
echo ""

# Step 1: Verify Node and npm
echo "Step 1: Checking Node.js and npm..."
node --version
npm --version
echo ""

# Step 2: Install dependencies
echo "Step 2: Installing dependencies..."
npm install
npm install --prefix client
npm install --prefix server
echo ""

# Step 3: Build the client
echo "Step 3: Building client..."
npm run build --prefix client
echo ""

# Step 4: Create environment files
echo "Step 4: Creating environment file templates..."
if [ ! -f "server/.env" ]; then
    cp server/.env.example server/.env
    echo "Created server/.env - Please edit with your MongoDB URI and JWT_SECRET"
else
    echo "server/.env already exists"
fi

if [ ! -f "client/.env" ]; then
    cp client/.env.example client/.env
    echo "Created client/.env - Update with your API URL"
else
    echo "client/.env already exists"
fi
echo ""

# Step 5: Test the build
echo "Step 5: Verifying build output..."
if [ -d "client/dist" ]; then
    echo "✓ Client build successful"
    echo "Build size: $(du -sh client/dist | cut -f1)"
else
    echo "✗ Client build failed"
fi
echo ""

echo "===== Ready for Deployment ====="
echo ""
echo "Next steps:"
echo "1. Set up MongoDB at https://www.mongodb.com/cloud/atlas"
echo "2. Update server/.env with MONGODB_URI and JWT_SECRET"
echo "3. Push to GitHub: git push origin main"
echo "4. Deploy frontend on Vercel: https://vercel.com/import"
echo "5. Deploy backend on Railway: https://railway.app"
echo ""
echo "See DEPLOYMENT.md for detailed instructions"
