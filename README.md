# Rice Bowl

Responsive restaurant website and menu MVP for client presentations. It includes an animated rice-bowl intro, searchable menu, dietary and chilli filters, and a persistent demo bag.

> Online ordering is live. The menu, prices and stock come from the CafePOS till, orders go
> straight to the kitchen, and guests follow their order on a live tracking page.

## Online ordering

The site is a static front end for a CafePOS outlet. There is no server here: the pages call the
CafePOS public API directly.

| Page | What it does |
|------|--------------|
| `order-standalone.html` | live menu with add-ons and sold-out flags, basket, checkout (pay online or at the counter) |
| `track-standalone.html?token=…` | live order status and wait time, updated over Socket.io with polling as a fallback |

Point the site at a till by editing **`store-config.js`** (no rebuild needed):

```js
window.RICE_BOWL_CONFIG = {
  apiBase: 'https://cafepos-backend-3xyu.onrender.com/api',
  outlet: 'rice-bowl',   // outlet code, shown in the POS under Settings
};
```

Opening hours, packaging charge, delivery, minimum order and whether orders are accepted at all are
controlled in the POS (Settings → Online ordering) — the site follows whatever it says. The marketing
pages also refresh their printed prices from the live menu and mark sold-out dishes, so the website
can never quote a price the till disagrees with. If the API is unreachable the static menu still
renders and ordering says so plainly.

## Preview locally

Open `index-standalone.html` directly, or run:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Then visit `http://127.0.0.1:8765`.

Both standalone pages include their CSS, JavaScript and menu data. Fonts and food photography require internet access; system fonts and descriptive image fallbacks remain available offline. Serving over HTTP is recommended for reliable bag persistence between pages. Browser storage on `file://` URLs varies by browser.

## Edit and rebuild

- `menu-data.json`: the 15 existing demonstration dishes, prices and photo URLs.
- `site.css`: responsive styles for both pages.
- `site.js`: navigation, search, filters, bowl finder and saved bag.
- `build-site.py`: page content and HTML generation.
- `store.js` / `store.css` / `store-config.js`: live ordering (menu, basket, checkout, tracking).

Run `python build-site.py` after editing these sources. This rebuilds the four standalone pages
(home, menu, order, track) and the `index.html` / `menu.html` / `order.html` / `track.html` redirects,
which preserve queries and fragments. Do not edit generated HTML if you intend to rebuild.
`store.js`, `store.css` and `store-config.js` are served as plain files, so editing them needs no rebuild.

## Demo scope

Search and dietary/flavour filters work together. Category and search URLs can be shared. Browser Back/Forward restores filter selections. The bag supports quantities, removal, storage, copying and text downloads. Its modal supports keyboard focus, Escape and backdrop dismissal.

Both pages open with a rice-bowl intro (about 1.2 seconds; at most 2.2 seconds before its fade). Skip it with the on-screen button or Escape. Hero entrances, selected scroll reveals, menu filtering, bowl recommendations, bag opening/closing and add-to-bag feedback are animated. Reduced-motion preferences skip the intro and remove motion. An independent timeout releases the page even if the main script fails; without JavaScript, content stays visible.

Menu, pricing and stock food photos still need client approval. Business details (address, phone,
GSTIN, FSSAI, opening hours) come from the POS outlet settings — fill those in before launch.
Reservations and reviews are still not implemented.
