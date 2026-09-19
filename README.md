# Rice Bowl

Responsive restaurant website and menu MVP for client presentations. It includes an animated rice-bowl intro, searchable menu, dietary and chilli filters, and a persistent demo bag.

> The bag is a saved selection only. It does not submit orders or process payments.

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

Run `python build-site.py` after editing these sources. This rebuilds both standalone pages and `index.html` / `menu.html`, which redirect old URLs while preserving queries and fragments. Do not edit generated HTML if you intend to rebuild.

## Demo scope

Search and dietary/flavour filters work together. Category and search URLs can be shared. Browser Back/Forward restores filter selections. The bag supports quantities, removal, storage, copying and text downloads. Its modal supports keyboard focus, Escape and backdrop dismissal.

Both pages open with a rice-bowl intro (about 1.2 seconds; at most 2.2 seconds before its fade). Skip it with the on-screen button or Escape. Hero entrances, selected scroll reveals, menu filtering, bowl recommendations, bag opening/closing and add-to-bag feedback are animated. Reduced-motion preferences skip the intro and remove motion. An independent timeout releases the page even if the main script fails; without JavaScript, content stays visible.

This is a client demo, not a live restaurant ordering service. Menu, pricing and stock food photos need client approval. The two meal bundles use explicit bowl combinations to avoid promising an unimplemented customisation flow. No reservations, reviews, location, opening hours, payments or order submission are fabricated. Add verified business details and an ordering integration before launch. No external order is submitted from this MVP.
