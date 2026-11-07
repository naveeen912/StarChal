# Star Chal — React web app (responsive: phone · tablet · desktop)

Tigers vs Goats on a five-point star. 2 tigers, 7 goats. Local two-player play on one device, with optional worldwide online play (Firebase).
React 18 + TypeScript + Vite. Installable as a PWA (Add to Home Screen).

**Responsive design:** fluid type, percentage-based board (SVG, pieces and tap targets scale together),
phone portrait → stacked layout, tablet → larger board, desktop/large tablet → board + side panel,
phone landscape → two-column layout sized to the screen height, safe-area insets for notched phones,
44px+ touch targets, keyboard-accessible board, reduced-motion support. Checked at 360×640 up to 1920×1080.

## Setup (no Firebase needed)
Run `npm install` and `npm run dev`, create a profile, then choose **Play on this device**.
Two people take turns on the same board. Games and profiles are saved in this browser;
refreshing resumes the last game. Local games do not affect online win statistics.
No environment variables or Firebase project are required for local play.

## Optional online setup
1. Firebase console → new project → Authentication → enable **Anonymous**; Firestore → create database;
   Rules → paste `firestore.rules` → Publish; Project settings → add a **Web app** → copy the config.
2. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values.
3. Run:
```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # 3000 random games through the rules engine
```

## Deploy on Netlify (CI/CD)

The repo includes `netlify.toml` and `.github/workflows/ci-cd.yml`.

### One-time setup

1. **GitHub** — push this project to a new repository (`main` branch).
2. **Netlify** — [app.netlify.com](https://app.netlify.com) → Add new site → Import from Git → pick the repo.
   - Build command / publish directory are read from `netlify.toml` (`npm ci && npm run build`, `dist/`).
   - Under **Site settings → Environment variables**, add the six `VITE_FIREBASE_*` keys from `.env.example` (optional for local-only play; required for online rooms).
   - Under **Site settings → Build & deploy → Continuous deployment**, note the **Site ID**.
3. **Netlify personal access token** — User settings → Applications → Personal access tokens → create one.
4. **GitHub repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |--------|--------|
   | `NETLIFY_AUTH_TOKEN` | Netlify personal access token |
   | `NETLIFY_SITE_ID` | Site ID from Netlify |
   | `VITE_FIREBASE_*` (×6) | Same as Netlify env vars (optional; bakes Firebase into the Actions build) |

5. **GitHub environment** (optional but recommended) — Settings → Environments → create **production** (no extra rules required unless you want approval gates).
6. **Firebase** (if using online play) — Authentication → Authorized domains → add `your-site.netlify.app` and any custom domain.

### What runs on each push

| Event | Pipeline |
|-------|-----------|
| Pull request | `verify`: `npm ci` → typecheck → `npm test` → production build |
| Push to `main` | Same, then **Deploy to Netlify** uploads `dist/` via the Netlify API |

Use **one** deploy path to avoid double publishes:

- **Recommended:** GitHub Actions deploy (secrets above) → in Netlify, set **Build settings → Stop builds** or unlink auto-build so only Actions publishes.
- **Alternative:** Rely on Netlify’s Git hook only and keep the workflow’s `deploy-netlify` job disabled (delete that job or use Netlify build hooks without the Action).

### Manual / drag-and-drop

```bash
npm ci && npm run build
```

Upload `dist/` to [app.netlify.com/drop](https://app.netlify.com/drop). Firebase config must be in `.env` before `npm run build`.

## Play with friends
Create a room → "Share invite link" sends `?room=CODE`; opening it joins automatically.

## Notes
- Firestore rules enforce whose turn it is; move legality and win stats are checked in the client only.
  For ranked play, validate moves server-side (Cloud Functions or a .NET backend).
- Layout: `src/styles.css`. Rules engine: `src/game/board.ts`. Firestore: `src/service.ts`.
