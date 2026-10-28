# BlitzMove Frontend

Next.js 15 (App Router) console for BlitzMove. See the root README for architecture and the full-stack setup.

```bash
npm install
cp .env.example .env.local   # API_URL=http://localhost:8000
npm run dev
npm run lint && npx tsc --noEmit && npm run build
```

The Laravel token lives in an httpOnly cookie. Browser code calls `/api/proxy/*` (`src/app/api/proxy`), which adds the Bearer header. Code layout: `src/app` (routes), `src/features` (screens per module), `src/components` (UI kit, layout, charts), `src/services` (API client), `src/hooks`.

Docker: `docker build -t blitzmove-frontend .` and run it with `API_URL` pointing at the API.
