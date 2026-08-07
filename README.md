# Holographic card integration

Drop these three files into your project at the matching paths (they either
overwrite an existing file or add a new one):

- `public/holocard/index.html`  — NEW. Standalone Three.js card renderer,
  same pattern as your existing `public/3daura/index.html`. Reads all card
  data from URL query params.
- `src/components/HoloCardViewer.tsx` — NEW. Builds the query string from a
  `Card` row and renders it fullscreen in an iframe (same pattern as
  `ThreeDAuraPage.tsx`).
- `src/pages/MyCardsPage.tsx` — MODIFIED. Only the detail modal changed:
  clicking a card in the grid still opens the modal exactly as before, it
  just now renders `<HoloCardViewer>` instead of a static `<PokeCard>`. The
  grid itself is untouched (still the lightweight 2D cards).

## Before you test

**R2 CORS.** `<img>` tags don't need CORS headers, but loading an image into
a WebGL texture does. If your R2 bucket doesn't already send
`Access-Control-Allow-Origin`, add a CORS rule in the Cloudflare dashboard
for the bucket (allow your app's origin, `GET` only). This is a one-time
config change, not a cost or egress change.

If a card's image fails to load for CORS or any other reason, the card still
renders (foil, text, logo, dimension window) — you'll just see the black
starfield room without a floating image, plus a small on-screen error note.

## What did NOT change

- Database schema — none needed, your existing `Card` fields map directly.
- Supabase egress — zero impact. The iframe loads `card.image_url` directly
  from R2, exactly like the `<img>` tag it replaced. No new Supabase calls.
- The cards grid — still the fast 2D `PokeCard`. Only the single-card detail
  view got upgraded, which is also the only place that makes sense to pay
  the cost of a full WebGL scene.

## Known simplification (worth knowing about)

Card art is shown as-is (no background removal) but sized a bit smaller than
the card's window, so the black-starfield "dimension" frame is always
visible around it. This means it works immediately for every existing card
with zero image prep — but it's a floating rectangular photo, not a
die-cut floating character like the rabbit demo. If you want the fuller
floating-cutout look later, that needs per-image background removal, which
is a separate, optional follow-up (and won't work equally well on every
image, since these are teacher-uploaded photos/art with real backgrounds,
not clean flat-color ones).
