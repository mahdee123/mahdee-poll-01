# Raya Swimming Pool Management System

Full-stack app for desk-friendly operations at Raya Swimming Pool. Built with React + Vite + Tailwind on the frontend and Node.js + Express + MongoDB on the backend. Includes role-based access (admin/manager), billing with receipts, training module with class tracking, memberships, packages, and income reports.

## Stack
- Frontend: React, Vite, TailwindCSS
- Backend: Node.js, Express, MongoDB (Mongoose), JWT auth
- Dev tooling: concurrently, nodemon

## Features
- Role-based auth (admin full access; manager can create bills, view training dashboard, view daily reports)
- Billing/receipts with unique receipt IDs, print/download via browser print
- Training enrollment with auto price/duration/classes per batch and age group; class slot capacity checks (max 15)
- Class tracking with attendance/makeup and remaining classes; training dashboard summaries
- Membership management with auto end dates by plan
- Admin-only packages (create/edit/activate)
- Reporting with income totals and simple charts (line + pie)

## Setup
1) Install Node.js (18+ recommended) and MongoDB.
2) From project root, install dependencies (server/client handled via workspaces scripts):
```
npm install
```
3) Configure environment variables:
- Copy [server/.env.example](server/.env.example) to `server/.env` and adjust `MONGODB_URI`, `JWT_SECRET`, and admin credentials if needed.
- Optionally copy [client/.env.example](client/.env.example) to `client/.env` to point the UI at a different API URL.
4) Start development servers (frontend + backend together):
```
npm run dev
```
API defaults to http://localhost:4000 and frontend to http://localhost:5173.

## Credentials
- Default admin is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `server/.env` (defaults: admin@raya.com / admin123).
- Managers can be created manually in the database with role `manager`.

## Useful Scripts
- Frontend: `npm run dev --prefix client`, `npm run build --prefix client`
- Backend: `npm run dev --prefix server`, `npm run start --prefix server`

## API Notes
- Auth: `POST /api/auth/login`, `GET /api/auth/me`
- Billing: `POST /api/transactions`
- Training: `POST /api/training/students` (admin), `POST /api/training/students/:id/classes` (admin), `GET /api/training/dashboard`
- Memberships: `POST /api/memberships` (admin)
- Packages: `POST /api/packages`, `PATCH /api/packages/:id`, `PATCH /api/packages/:id/status` (admin)
- Reports: `GET /api/reports/income?range=daily|weekly|monthly`

## Printing Receipts
Use the in-app "Save & Print" action to store a bill then trigger the browser print dialog for a hard copy or PDF export.

## Deployment
For comprehensive deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Quick Summary:**
- **Frontend**: Deploy on [Vercel](https://vercel.com) (automatic from GitHub)
- **Backend**: Deploy on [Railway](https://railway.app) or [Render](https://render.com)
- **Database**: Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier available)

See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step setup instructions.
