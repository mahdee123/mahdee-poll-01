# Vercel Deployment - Quick Start Guide

## 📋 Deployment Files Created

I've set up your project with comprehensive Vercel deployment configuration:

### Configuration Files
| File | Purpose |
|------|---------|
| [vercel.json](vercel.json) | Vercel build settings & environment variables |
| [DEPLOYMENT.md](DEPLOYMENT.md) | **→ START HERE** - Complete deployment instructions |
| [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) | Pre-flight checklist for deployment |
| [.env.example](.env.example) | Root environment variables reference |
| [server/.env.example](server/.env.example) | Backend environment variables reference |
| [client/.env.example](client/.env.example) | Frontend environment variables reference |

### Setup Scripts
| File | Platform |
|------|----------|
| [setup-deployment.sh](setup-deployment.sh) | Linux/macOS |
| [setup-deployment.ps1](setup-deployment.ps1) | Windows PowerShell |

---

## 🚀 Quick Start (3 Steps)

### Step 1: Prepare Your Code
```bash
# On Windows (PowerShell)
.\setup-deployment.ps1

# On macOS/Linux (Bash)
bash setup-deployment.sh
```

This will:
- Install all dependencies
- Build the client
- Create `.env` files with templates
- Verify build output

### Step 2: Set Up MongoDB
1. Visit [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Copy your connection string
4. Edit `server/.env` and add:
   ```
   MONGODB_URI=mongodb+srv://your_user:your_password@cluster.mongodb.net/pool_software
   JWT_SECRET=your_super_secret_key_min_32_chars
   ```

### Step 3: Deploy

#### Option A: Deploy Frontend + Backend (Recommended)

**Frontend (Vercel):**
1. Push to GitHub: `git push origin main`
2. Visit [Vercel](https://vercel.com) → New Project
3. Import your repository
4. Set build command: `npm run build --prefix client`
5. Set output: `client/dist`
6. Deploy ✅

**Backend (Railway):**
1. Visit [Railway](https://railway.app)
2. New Project → Import from GitHub
3. Select your repo & root directory: `server`
4. Add environment variables (same as your `server/.env`)
5. Deploy ✅

**Connect them:**
1. Copy Railway API URL
2. Go to Vercel → Settings → Environment Variables
3. Update `VITE_API_URL` to your Railway URL
4. Redeploy on Vercel

#### Option B: Deploy Frontend Only (If Backend Already Exists)
1. Update `VITE_API_URL` in Vercel dashboard
2. Deploy on Vercel
3. Done ✅

---

## 📚 Detailed Documentation

For comprehensive instructions, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full step-by-step guide
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Detailed checklist

---

## 🔐 Important Security Notes

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use strong JWT_SECRET** - At least 32 random characters
3. **MongoDB credentials** - Keep them in environment variables
4. **ALLOWED_ORIGINS** - Update with your Vercel domain in production
5. **Update API URLs** - After backend deployment, update frontend URL

---

## ✅ Verification

After deployment, verify:
```bash
# Check frontend loads
curl https://your-project.vercel.app

# Check backend health
curl https://your-api.railway.app/api/health

# Check browser console for errors
# Open DevTools (F12) → Console tab
```

---

## 🆘 Common Issues

**API not connecting?**
- Check `VITE_API_URL` in Vercel environment
- Verify backend `ALLOWED_ORIGINS` includes your Vercel domain
- Check if backend is running

**MongoDB connection fails?**
- Verify connection string in `server/.env`
- Check user credentials
- Whitelist IP in MongoDB Atlas (or allow all)

**Build fails on Vercel?**
- Check build logs in Vercel dashboard
- Verify `npm run build --prefix client` works locally
- Check for missing dependencies

---

## 📞 Support Resources

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [Express.js Documentation](https://expressjs.com)

---

## 🎯 Next Steps

1. ✅ Run setup script: `.\setup-deployment.ps1` (Windows) or `bash setup-deployment.sh` (Mac/Linux)
2. ✅ Set up MongoDB Atlas and get connection string
3. ✅ Update `server/.env` with MongoDB URI and JWT_SECRET
4. ✅ Read [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
5. ✅ Push to GitHub
6. ✅ Deploy frontend on Vercel
7. ✅ Deploy backend on Railway
8. ✅ Update `VITE_API_URL` in Vercel
9. ✅ Test your live application

---

**Good luck! Your Pool Software is ready for the world! 🏊**
