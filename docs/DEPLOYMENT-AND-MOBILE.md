# TJS Edu: Windows, Internet and Mobile

This document describes the three supported delivery targets from the same codebase.

## 1. Windows local edition

Requirements:
- Windows 10/11 64-bit
- Docker Desktop with WSL2 backend
- Internet for the first image/dependency download

Steps:
1. Extract the TJS Edu ZIP to a normal folder.
2. Start Docker Desktop and wait until it reports that Docker is running.
3. Double-click `ОҒОЗ-ДАР-WINDOWS.bat`.
4. Wait for the health check to finish.
5. Open `http://localhost:8080`.

The PostgreSQL data is stored in the Docker volume `tjs_edu_db`. Do not delete this volume if you want to keep the local database. Back it up regularly:

```powershell
docker compose exec -T db pg_dump -U tjsedu tjs_edu > tjs-edu-backup.sql
```

Stop the app with `docker compose down`. This keeps the database volume. Do not use `docker compose down -v` unless you intend to delete local database data.

## 2. Internet edition

The current `docker-compose.yml` is intentionally bound to `127.0.0.1:8080` for local use. It is not a public internet deployment configuration.

Before public launch, provide:
- A dedicated Linux server or approved hosting provider
- A dedicated PostgreSQL database and credentials for TJS Edu only
- A domain name and HTTPS reverse proxy
- Firewall rules, secure secrets, backups and restore testing
- Production monitoring, rate limits and tenant-access review

Never reuse credentials or database resources from ProgramerTJ. Never commit `.env`, passwords, private keys or production connection strings.

The application image can be built with:

```bash
docker build -t tjs-edu:latest .
```

A public deployment must be configured and tested on the selected host before it can be called live. No public endpoint is implied by a successful local build or CI run.

## 3. Mobile edition (installable PWA)

TJS Edu includes a web app manifest and service-worker registration. It can be installed from a secure HTTPS website on supported Android and iOS browsers.

### Android
1. Open the TJS Edu HTTPS address in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm. Start TJS Edu from its new home-screen icon.

### iPhone/iPad
1. Open the TJS Edu HTTPS address in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Tap **Add**.

### Offline limitations
The service worker caches the app shell and static assets and can reopen the cached interface after a successful first visit. This alone does not guarantee that every screen, API request, login, or new data entry works offline. Full offline-first operation requires each relevant form to save into the local IndexedDB outbox, reliable retry/sync, conflict handling and end-to-end tests after reconnecting. Do not promise full offline data entry until those flows are implemented and verified.

## Shared codebase

Windows, public web and mobile PWA use the same React application and API. The mobile PWA is not a separate native Android/iOS binary. A native APK/IPA would be a separate future packaging task.
