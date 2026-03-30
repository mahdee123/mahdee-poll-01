# Vercel Deployment Checklist

## Pre-Deployment Preparation
- [ ] Ensure all code is committed to GitHub
- [ ] Create a GitHub repository if you haven't already
- [ ] All sensitive data is in `.env` (not committed)
- [ ] `.gitignore` includes `.env` files

## Backend Setup (MongoDB & Environment)
- [ ] Create MongoDB Atlas account
- [ ] Create a cluster and database
- [ ] Get MongoDB connection string
- [ ] Create `server/.env` with:
  - [ ] `MONGODB_URI` (from MongoDB Atlas)
  - [ ] `JWT_SECRET` (strong random string)
  - [ ] `NODE_ENV=production`
  - [ ] `ALLOWED_ORIGINS` (includes Vercel domain)

## Frontend Setup (Local Build Test)
- [ ] Run `npm install` in project root
- [ ] Run `npm run build --prefix client`
- [ ] Verify `client/dist` folder is created
- [ ] Check build size is reasonable
- [ ] Create `client/.env` with correct `VITE_API_URL`

## GitHub Repository Setup
- [ ] Create GitHub repository
- [ ] Push all code: `git push origin main`
- [ ] Verify repository is public (for Vercel import)
- [ ] Ensure `.gitignore` is working (no `.env` files shown)

## Vercel Frontend Deployment
- [ ] Create Vercel account (sign in with GitHub)
- [ ] Click "New Project"
- [ ] Select your GitHub repository
- [ ] Configure Build Settings:
  - [ ] **Framework**: Vite
  - [ ] **Build Command**: `npm run build --prefix client`
  - [ ] **Output Directory**: `client/dist`
  - [ ] **Install Command**: `npm install`
- [ ] Add Environment Variable:
  - [ ] **Name**: `VITE_API_URL`
  - [ ] **Value**: (temp: `http://localhost:4000/api` or your backend URL later)
- [ ] Click "Deploy"
- [ ] Note the Vercel domain: `your-project.vercel.app`
- [ ] Verify site loads (may show API errors until backend is live)

## Backend Deployment (Choose One: Railway or Render)

### Option A: Railway Deployment
- [ ] Create Railway account
- [ ] New Project → Import from GitHub
- [ ] Select your repository
- [ ] Configure Root Directory: `server`
- [ ] Add Environment Variables:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=4000`
  - [ ] `MONGODB_URI` (from Atlas)
  - [ ] `JWT_SECRET`
  - [ ] `ALLOWED_ORIGINS=your-vercel-domain.vercel.app`
- [ ] Get public URL from Railway
- [ ] Test endpoint: `https://your-railway-url.up.railway.app/api/health`

### Option B: Render Deployment
- [ ] Create Render account
- [ ] New → Web Service
- [ ] Select your GitHub repository
- [ ] Configure:
  - [ ] **Root Directory**: `server`
  - [ ] **Start Command**: `npm start`
- [ ] Add Environment Variables (same as Railway)
- [ ] Get public URL from Render
- [ ] Test endpoint: `https://your-render-url.onrender.com/api/health`

## Post-Backend Deployment
- [ ] Go to Vercel dashboard
- [ ] Update `VITE_API_URL` to your backend URL
- [ ] Trigger redeploy on Vercel
- [ ] Wait for rebuild to complete

## Final Testing
- [ ] Open `your-project.vercel.app` in browser
- [ ] Open DevTools (F12) → Application → Cookies
- [ ] Login page loads properly
- [ ] Try logging in with test credentials
- [ ] Check DevTools → Network tab for API calls
- [ ] Verify no CORS errors in Console
- [ ] Test main features:
  - [ ] Login/Logout
  - [ ] View Bills page
  - [ ] Create a test bill
  - [ ] View transaction data
  - [ ] Test membership features
  - [ ] Generate a report

## Troubleshooting
- [ ] Check Vercel build logs if build fails
- [ ] Check Railway/Render logs if backend fails
- [ ] Verify MongoDB connection string is correct
- [ ] Ensure ALLOWED_ORIGINS includes your Vercel domain
- [ ] Check browser console for CORS errors
- [ ] Verify date/time is correct on backend server
- [ ] Test with incognito/private window to avoid cache

## Production Optimization
- [ ] Enable automatic deployments on GitHub push (both Vercel & Railway/Render)
- [ ] Set up monitoring/alerts
- [ ] Configure error tracking (optional: Sentry)
- [ ] Review and rotate JWT_SECRET if needed
- [ ] Set up database backups
- [ ] Monitor API rate limits
- [ ] Check SSL certificate validity (should be automatic)

## Documentation
- [ ] Add `.env.example` to repo (done)
- [ ] Update README with deployment link (done)
- [ ] Create DEPLOYMENT.md with full instructions (done)

## Success Indicators
- ✅ Frontend loads at `your-project.vercel.app`
- ✅ API responds to health check
- ✅ Login works and returns JWT token
- ✅ Bills can be created and retrieved
- ✅ No errors in browser console
- ✅ No CORS errors
- ✅ MongoDB data persists across deployments
