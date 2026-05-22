# Static files (favicon, etc.)

Files here are copied to the site root on build (`/favicon-32x32.png`, etc.).

**Recommended (use all you have):**

- `favicon.ico` — best for the automatic browser request to `/favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`

Optional:

- `apple-touch-icon.png` (180×180 recommended)
- `favicon-192x192.png` / `favicon-512x512.png` for PWA

If both `.ico` and PNGs exist, the site uses the `.ico` for `/favicon.ico` and the PNGs for sized `<link>` tags in the page.
