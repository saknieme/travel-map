# Travel map

Static website (no build step): a Leaflet map of places visited and places on the wishlist. Public.

- `index.html`, `assets/style.css`, `assets/app.js`: the page
- `data/places.json`: **all place data, the only file that normally changes**
- `data/countries-110m.json`: country shapes (world-atlas TopoJSON) used to shade visited countries
- `photos/`: optional images referenced from places
- `tools/check-places.mjs`: validator
- `mockup/`: the original design mockup (reference only, not part of the site)

## Adding or changing places

When the user says something like "add Dubrovnik, visited July 2024, loved the walls":

1. Look up coordinates (city centre, 3 decimals). If ambiguous (e.g. two places with the same name), ask.
2. Edit `data/places.json`. Fields:
   - required: `id` (lowercase slug, unique, e.g. `dubrovnik`; add `-2024` style suffix for a repeat visit), `name`, `country`, `lat`, `lng`, `status` (`"visited"` | `"wishlist"`)
   - visited: `year` (integer, drives the timeline), `when` (free text, e.g. `"Jul 2024 · 4 days"`), `rating` (1–5)
   - wishlist: `priority` (`"High"` | `"Medium"` | `"Low"`), `season` (best time, e.g. `"May – Sep"`)
   - any: `notes`, `tags` (list of short lowercase words; reuse existing tags), `photos` (list of paths like `"photos/dubrovnik-1.jpg"`)
   - `country` must use the name in `data/countries-110m.json` so the country gets shaded, e.g. `United States of America`, `Czechia`, `Bosnia and Herz.`, `Dominican Rep.`. Very small countries (Singapore, Malta, ...) aren't in the shapes; use their normal name and accept the warning.
   - Moving a wishlist place to visited: change `status`, drop `priority`/`season`, add `year`/`when`/`rating`.
3. Run `node tools/check-places.mjs` and fix any errors.
4. Publish (see below) unless the user said not to. Tell them what changed.

Photos: resize to max 1600px wide before adding (`sips -Z 1600 in.jpg --out photos/name.jpg` on macOS) to keep the repo small.

## Preview locally

`python3 -m http.server 8000` in this folder, then open http://localhost:8000. Opening `index.html` directly as a file won't load the data.

## Publish

Hosted on GitHub Pages from the `main` branch. Commit and push; the site updates in about a minute.
