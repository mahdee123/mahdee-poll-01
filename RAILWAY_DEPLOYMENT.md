# Deploying to Railway (client + server + MongoDB)

This project deploys as **three Railway services in one project**:

1. `MongoDB` — Railway's managed database plugin
2. `server` — the Express API (root directory: `server`)
3. `client` — the built React app, served as a static SPA (root directory: `client`)

All three live in a single Railway **project** so they share a private network and can reference each other's variables.

> **This repo is a monorepo (root `package.json` + `client/` + `server/`).** If a service's **Root Directory** setting is left blank, Railway builds from the repo root instead of `server`/`client`, `npm install` only installs the root's own (near-empty) dependency list, and the app crashes on boot with `Cannot find package 'express'` (or similar). Setting Root Directory correctly (step 2 and 3 below) is not optional for this repo. As a safety net, the root `package.json`'s `start` script now also runs `npm install --prefix server` first, but the Root Directory setting is still the correct fix — don't skip it.

---

## 1. Create the project and add MongoDB

1. [railway.app](https://railway.app) → **New Project** → **Empty Project**.
2. Inside the project: **+ New** → **Database** → **Add MongoDB**.
   Railway provisions it and exposes variables on that plugin, including `MONGO_URL` (a private-network connection string — no public internet hop, and it's free).

---

## 2. Deploy the `server` service

1. **+ New** → **GitHub Repo** → select this repo.
2. Once created, open the service → **Settings**:
   - **Root Directory**: `server`
   - Confirm **Build**/**Deploy** are picked up from `server/railway.json` (already in the repo — Nixpacks build, `npm start`, health check on `/api/health`).
3. **Settings** → **Networking** → **Generate Domain** (gives you a public `https://<name>.up.railway.app` URL for the API).
4. **Variables** — add:

   ```
   NODE_ENV=production
   SYSTEM_MONGODB_URI=${{MongoDB.MONGO_URL}}
   JWT_SECRET=<generate a long random value - see note below>
   JWT_EXPIRY=12h
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=<a real password - not admin123>
   ALLOWED_ORIGINS=https://${{client.RAILWAY_PUBLIC_DOMAIN}}
   ```

   - `${{MongoDB.MONGO_URL}}` and `${{client.RAILWAY_PUBLIC_DOMAIN}}` are Railway variable references — they auto-resolve to the other services' values (the `client` service must exist and have a public domain generated for the second one to resolve; you can add `ALLOWED_ORIGINS` after step 3 once the client domain exists).
   - `DEFAULT_COMPANY_MONGO_URI` does **not** need to be set — it's derived automatically from `SYSTEM_MONGODB_URI`.
   - Generate `JWT_SECRET` locally: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. The server refuses to boot in production without one.
   - `PORT` is injected by Railway automatically — don't set it yourself.

5. Deploy. Check logs for `✓ Connected to system database` and `API running on port ...`, then confirm `https://<server-domain>/api/health` returns `{"status":"ok"}`.

---

## 3. Deploy the `client` service

1. **+ New** → **GitHub Repo** → same repo again (Railway lets you add the same repo as a second service).
2. **Settings**:
   - **Root Directory**: `client`
   - Build/start come from `client/railway.json` (`npm run build`, then `npm run start` which runs `serve -s dist` — `serve` picks up Railway's injected `PORT` automatically, and `-s` rewrites all routes to `index.html` so client-side routing via react-router works on refresh/deep links).
3. **Variables** — add:

   ```
   VITE_API_URL=https://${{server.RAILWAY_PUBLIC_DOMAIN}}/api
   ```

   This is a **build-time** variable (Vite bakes it into the bundle), so it must be set before the first deploy of this service.
4. **Settings** → **Networking** → **Generate Domain**.
5. Deploy.

---

## 4. Close the loop

Once the client has a public domain, go back to the `server` service's `ALLOWED_ORIGINS` variable and confirm it resolved to `https://<client-domain>` (or paste the literal URL if the reference didn't pick it up) — CORS will reject the client otherwise. Redeploy `server` if you changed it manually.

---

## 5. Verify

```bash
curl https://<server-domain>/api/health
# {"status":"ok"}

curl -X POST https://<server-domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"<your ADMIN_PASSWORD>"}'
# should return a token
```

Open `https://<client-domain>` in a browser and log in.

---

## Notes specific to this app

- **Admin seeding is one-time**: the default admin is only created when the `User` collection is empty. Restarting/redeploying the server will never reset an existing admin's password (fixed behavior — earlier versions of this app reset it on every boot).
- **Self-service company signup** (`/api/auth/register-company`) automatically creates each new company's database on the same MongoDB instance as `SYSTEM_MONGODB_URI`, just with a different database name — no extra Railway config needed as you onboard more tenants.
- **Rotate `ADMIN_PASSWORD`** after first login; it's only used for the initial seed, not enforced afterward.
- If you ever move off Railway's MongoDB plugin to Atlas, just swap `SYSTEM_MONGODB_URI` — nothing else in the app assumes Railway specifically.

The previous Vercel/Netlify-oriented docs (`DEPLOYMENT.md`, `VERCEL_DEPLOYMENT_GUIDE.md`, `vercel.json`, `netlify.toml`) are no longer the deployment path for this project now that both client and server run on Railway; they're left in the repo for reference but can be deleted if you want to avoid confusion.

---

## Troubleshooting

### Crash loop with `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'express'`

The service built from the **repo root** instead of `server/`, so `npm install` only installed the root `package.json`'s near-empty dependency list, and `server/node_modules` was never created. Fix:

1. Open the `server` service → **Settings** → **Source** → set **Root Directory** to `server` (exactly that, no leading `/`).
2. Same for the `client` service → Root Directory `client`.
3. Redeploy (Deployments tab → **⋮** → **Redeploy**, or push a commit).

If you'd rather not touch the setting right now, a redeploy alone will also work once you've pulled the latest commit — the root `package.json`'s `start` script now runs `npm install --prefix server` before starting, as a fallback — but fixing Root Directory is still the correct long-term setting since it also makes `server/railway.json`'s health check and restart policy actually apply (they're only picked up when Root Directory points at the folder containing them).

### Crash loop with a MongoDB connection error

Check `SYSTEM_MONGODB_URI` on the `server` service resolved to an actual value (not the literal string `${{MongoDB.MONGO_URL}}`) — that only resolves if the MongoDB plugin is named exactly `MongoDB` in your project, or the variable reference name in the code snippet above needs to match your plugin's actual service name.
