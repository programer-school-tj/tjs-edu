# TJS Edu

Низоми рақамии идоракунии муассисаҳои таълимии Тоҷикистон.

## Stack
- React + TypeScript + Vite
- React Router
- PostgreSQL/Kysely (server integration is being migrated)
- ExcelJS for institution templates
- PWA application shell (offline shell cache is enabled; offline data queue is not yet enabled)

## Local development
1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and configure a dedicated TJS Edu database before enabling API routes.
4. Run `npm run dev`.
5. Run `npm run build` to create `dist/`.

The Vite development server proxies `/api` to `http://localhost:3001`. The independent API server and database schema are separate migration steps and are not considered production-ready yet.

## Safety
Never commit `.env`, database credentials, session secrets, password hashes, or real student/staff data. TJS Edu must use its own database project, separate from ProgramerTJ.
