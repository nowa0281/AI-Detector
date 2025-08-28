# AI Detector

Next.js + TailwindCSS + Framer Motion app that runs fully on Cloudflare Pages using Next.js API routes (Edge runtime).

## Develop

1. Install dependencies:

```bash
npm install
```

2. Run locally:

```bash
npm run dev
```

## Deploy to Cloudflare Pages

- Framework preset: Next.js
- Build command: `npm run build`
- Build output directory: `.next`
- Node version: 18+

The API route `/pages/api/detect.js` uses `runtime: 'edge'` so it runs as a Cloudflare Worker.

## Notes

- SEO is configured via `<Head>` in `pages/index.js` and `public/robots.txt`.
- Local history (last 3 checks) is stored in `localStorage`.
- No external backend required.


