# Pool Software - Vercel Deployment Guide

This guide covers deploying the Pool Software application on Vercel and configuring your backend API.

## Architecture Overview

- **Frontend**: React app deployed on Vercel
- **Backend**: Node.js/Express API (deployed separately - see options below)
- **Database**: MongoDB (Atlas recommended)

---

## Step 1: Prepare Your Project

### 1.1 Install Git (if not already installed)
```bash
# For Windows, use Git Bash or PowerShell
git init
git add .
git commit -m "Initial commit"
```

### 1.2 Create a GitHub Repository
1. Go to [GitHub](https://github.com/new)
2. Create a new repository (e.g., `pool-software`)
3. Connect your local project:
```bash
git remote add origin https://github.com/YOUR_USERNAME/pool-software.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Frontend on Vercel

### 2.1 Create/Sign In to Vercel Account
1. Go to [Vercel](https://vercel.com)
2. Sign up or sign in with GitHub

### 2.2 Import Your Project
1. Click "New Project"
2. Select "Import Git Repository"
3. Choose your GitHub repository
4. Select the root directory as the project root
5. Configure build settings:
   - **Framework**: Vite
   - **Build Command**: `npm run build --prefix client`
   - **Output Directory**: `client/dist`
   - **Install Command**: `npm install`

### 2.3 Add Environment Variables
In the Vercel dashboard for your project:
1. Go to **Settings** → **Environment Variables**
2. Add `VITE_API_URL` with your backend API URL:
   - For development: `http://localhost:4000/api`
   - For production: `https://your-api-domain.com/api` (see Step 3 for backend deployment)

### 2.4 Deploy
1. Click "Deploy"
2. Your frontend will be live at `your-project.vercel.app`

---

## Step 3: Deploy Backend API

### Option A: Railway (Recommended - Free tier available)

#### 3.1 Prepare Server for Railway
1. Go to [Railway](https://railway.app)
2. Sign up with GitHub
3. Create new project → Import from GitHub
4. Select your repository
5. Configure:
   - **Root Directory**: `server`
   - **Start Command**: `npm start`

#### 3.2 Add Environment Variables in Railway
In the Railway dashboard:
1. Go to your project
2. Click Variables
3. Add:
   ```
   PORT=4000
   MONGODB_URI=your_mongodb_atlas_uri
   JWT_SECRET=your_secure_jwt_secret
   ALLOWED_ORIGINS=your-project.vercel.app,localhost:5173
   NODE_ENV=production
   ```

#### 3.3 Get Your API URL
- Railway will provide a public URL like `https://your-service-name.up.railway.app`
- Update your Vercel `VITE_API_URL` environment variable to point to this URL

### Option B: Render (Alternative)

#### 3.1 Deploy on Render
1. Go to [Render](https://render.com)
2. Sign up with GitHub
3. New → Web Service
4. Select your repository
5. Configure:
   - **Name**: `pool-software-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

#### 3.2 Add Environment Variables
Set the same variables as Railway (see 3.2 above)

---

## Step 4: Configure MongoDB

### 4.1 Create MongoDB Atlas Cluster
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up/login
3. Create a new cluster (free tier available)
4. Create a database user with credentials
5. Get the connection string

### 4.2 Update Connection String
In your backend deployment (Railway/Render):
- Add `MONGODB_URI` with your MongoDB connection string
- Format: `mongodb+srv://username:password@cluster.mongodb.net/pool_software`

---

## Step 5: Update API URLs

### 5.1 Frontend API Configuration
After deploying your backend, update the `VITE_API_URL` in Vercel:

1. **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Update/Add `VITE_API_URL`:
   ```
   VITE_API_URL=https://your-api-domain.vercel.app/api
   ```
   (or your Railway/Render URL)

3. **Redeploy** on Vercel (it will auto-detect the change or you can manually trigger)

### 5.2 Backend CORS Configuration
Update `ALLOWED_ORIGINS` on your backend deployment to include:
```
your-project.vercel.app,localhost:5173,localhost:3000
```

---

## Step 6: Verify Deployment

### 6.1 Test Endpoints
```bash
# Check client is accessible
curl https://your-project.vercel.app

# Check API health
curl https://your-api-domain.com/api/health
```

### 6.2 Check Browser Console
1. Open your app in browser: `https://your-project.vercel.app`
2. Open DevTools (F12) → Console
3. Check for any API errors or CORS issues
4. Try logging in to verify the API connection works

---

## Environment Variables Reference

### Client (Vercel Browser Environment)
```
VITE_API_URL=https://your-backend-api.com/api
```

### Server (Backend Deployment)
```
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/pool_software
JWT_SECRET=your-secure-random-secret-key-min-32-characters
ALLOWED_ORIGINS=your-project.vercel.app,localhost:5173
```

---

## Troubleshooting

### Issue: "CORS error" or "Cannot read from API"
- Check `ALLOWED_ORIGINS` includes your Vercel domain
- Verify backend `VITE_API_URL` is correct
- Ensure backend is running and healthy (`/api/health` endpoint)

### Issue: "Cannot connect to MongoDB"
- Verify `MONGODB_URI` is correct
- Check MongoDB cluster allows your IP address (or allow all IPs for now)
- Ensure database user has correct credentials

### Issue: "Build fails on Vercel"
- Check build command: `npm run build --prefix client`
- Verify dependencies are installed: `npm install`
- Check for syntax errors in client code

### Issue: "Deployment stuck or failing"
- Check Railway/Render logs for backend errors
- Verify all environment variables are set
- Check Node version compatibility

---

## Post-Deployment Checklist

- [ ] Frontend accessible at `https://your-project.vercel.app`
- [ ] Backend API responding at health endpoint
- [ ] CORS configured correctly
- [ ] Login/authentication working
- [ ] Bills, transactions, memberships functional
- [ ] MongoDB data persisting
- [ ] SSL certificates valid (should be automatic)
- [ ] All API endpoints tested

---

## Redeploy Process

### For Frontend Changes
1. Commit and push to GitHub
2. Vercel auto-deploys or manually trigger from dashboard

### For Backend Changes
1. Commit and push to GitHub
2. Railway/Render auto-deploys or manually trigger

### For Environment Variable Changes
1. Update in Vercel/Railway/Render dashboard
2. Manually trigger redeploy if not automatic

---

## Support & Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [Express.js on Vercel](https://vercel.com/docs/frameworks/express)

---

## Quick Start Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Server-only build
npm run build --prefix server

# Client-only build
npm run build --prefix client
```

---

Last Updated: 2026-03-30
