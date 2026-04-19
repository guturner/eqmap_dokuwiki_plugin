# eqmap — DokuWiki Map Plugin

Renders an interactive, zoomable map of **Norrath** (EverQuest) inside any DokuWiki page.  Built on [OpenLayers](https://openlayers.org/).

---

## Table of contents

1. [Installation](#installation)
2. [Quick start](#quick-start)
3. [Tag reference](#tag-reference)
4. [Points of interest (POI)](#points-of-interest-poi)
   - [Colour palette](#colour-palette)
   - [Finding coordinates](#finding-coordinates)
5. [Centering the map](#centering-the-map)
6. [Info overlay](#info-overlay)
7. [Debug mode](#debug-mode)
8. [Known coordinates](#known-coordinates)
9. [File structure](#file-structure)
10. [Contributing](#contributing)
11. [License](#license)

---

## Installation

Install the plugin manually into your DokuWiki instance:

```
lib/plugins/eqmap/
```

> **The directory must be named `eqmap`** — DokuWiki derives the plugin ID from the folder name.

Alternatively, install via the DokuWiki plugin manager by searching for **eqmap**.

---

## Quick start

Paste the following into any DokuWiki page:

```xml
<eqmap centered zoom=3
  poi='[{"name":"Qeynos","color":"red","lat":666.0,"lon":2299.0}]'>
</eqmap>
```

This renders a centred map with a single red marker over Qeynos at zoom level 3.

---

## Tag reference

```
<eqmap [options]></eqmap>
```

All options are **optional**.  The tag body is currently unused (reserved for future use).

| Option | Type | Default | Description |
|---|---|---|---|
| `centered` | flag | off | Centres the map horizontally on the page using `margin: auto`. |
| `centerLat=<float>` | float | map centre | Initial horizontal position of the viewport (pixel X). |
| `centerLon=<float>` | float | map centre | Initial vertical position of the viewport (pixel Y). |
| `zoom=<int>` | int | `2` | Starting zoom level.  Range: `1` – `8`. |
| `poi='[…]'` | JSON | `[]` | Array of point-of-interest objects (see below). |
| `info="<html>"` | string | none | HTML displayed in the info overlay (triggered by the `?` button). |
| `debug` | flag | off | Overlays a live coordinate grid and click-coordinate pin. |

### Full example

```xml
<eqmap
  centered
  centerLat=1351.5
  centerLon=2487.5
  zoom=4
  poi='[
    {"name":"Rivervale",  "color":"green", "lat":1351.5, "lon":2487.5},
    {"name":"Misty Thicket","color":"red", "lat":1400.0, "lon":2500.0},
    {"name":"Kithicor",   "color":"grey",  "lat":1500.0, "lon":2460.0}
  ]'
  info="<b>The Kithicor Region</b><br>Follow the road east from Rivervale to reach the Commonlands.">
</eqmap>
```

---

## Points of interest (POI)

The `poi` attribute accepts a **JSON array** of objects.  Single quotes wrap the JSON so that double quotes inside don't need escaping.

Each POI object has four fields:

```json
{
  "name":  "Location name",
  "color": "red",
  "lat":   1234.5,
  "lon":   4321.0
}
```

| Field | Type | Description |
|---|---|---|
| `name` | string | Label shown in the tooltip when hovering/tapping the marker. |
| `color` | string | Marker colour/style key — see [Colour palette](#colour-palette). |
| `lat` | float | Horizontal pixel coordinate on the Norrath image. |
| `lon` | float | Vertical pixel coordinate on the Norrath image. |

> **Note on axis naming:** `lat`/`lon` are named by analogy to geographic maps.  On the Norrath image they map to X and Y pixel positions respectively — they have nothing to do with real-world latitude and longitude.

### Colour palette

| Key | Appearance | Use case |
|---|---|---|
| `red` | Red marker | Danger zones, enemy camps, quest destinations |
| `green` | Green marker | Safe areas, vendors, friendly NPCs |
| `grey` | Grey marker | Neutral / inactive locations |
| `1` – `6` | Numbered markers | Ordered waypoints, multi-step quests |

### Finding coordinates

Enable **debug mode** (see below) and click anywhere on the map.  A red crosshair and a `lat=…, lon=…` badge will appear at the click location — copy these values directly into your `poi` JSON.

---

## Centering the map

Add the `centered` flag to horizontally centre the map block on the page:

```xml
<eqmap centered zoom=2></eqmap>
```

The map width is controlled by the `.map` CSS class (default: `75%`).  To override it for a specific page, wrap the tag in a `<div>` with a custom style, or edit `css/eqmap.css` globally.

---

## Info overlay

The `info` attribute populates a full-map overlay panel that is shown when the user clicks the **`?`** button in the top-right corner.  The overlay is dismissed by clicking it.

The value is **raw HTML**, so you can use formatting:

```xml
<eqmap
  info="<h3>Welcome to Antonica</h3><p>Home of Qeynos and the surrounding farmlands.</p>"
  zoom=2>
</eqmap>
```

> Keep the info text reasonably short.  Very long text may overflow on small screens.

---

## Debug mode

Add the `debug` flag during map authoring to display a dynamic coordinate grid over the map:

```xml
<eqmap debug centerLat=1234 centerLon=4321 zoom=4></eqmap>
```

**What debug mode gives you:**

| Feature | How to use |
|---|---|
| Coordinate grid | Yellow dashed grid lines with `(x, y)` labels at every intersection. |
| Axis ticks | Blue labels along the top and left edges for quick orientation. |
| Click pin | Click any empty area of the map to drop a red crosshair that shows the exact `lat` / `lon` values at that point. |
| Toggle grid | The **`#`** button in the controls hides/shows the grid without reloading the page. |

Remove the `debug` flag before publishing a page — it has a minor rendering overhead and is primarily intended for content authors.

---

## Known coordinates

The Norrath coordinate system is pixel-based (X increases right, Y increases down from the image origin).  Here are verified reference points:

| Location | lat | lon |
|---|---|---|
| Ak'Anon | 3525.0 | 2177.0 |
| Freeport | 1642.0 | 2200.0 |
| Kaladim | 2560.5 | 2680.5 |
| Kelethin | 3329.5 | 2514.0 |
| Neriak | 1659.0 | 2539.0 |
| Qeynos | 666.0 | 2299.0 |
| Rivervale | 1351.5 | 2487.5 |

---

## File structure

```
lib/plugins/eqmap/
│
├── plugin.info.txt         Plugin metadata (required by DokuWiki)
├── action.php              Injects toolbar button + eqmapBase JS variable
├── syntax.php              Registers <eqmap> tag, parses attributes, emits HTML
│
├── js/
│   ├── eqmap.js            Map initialisation, POI layer, tooltip, debug grid
│   └── ol.js               OpenLayers bundle (included by eqmap.js via DOKUWIKI directive)
│
├── css/
│   ├── eqmap.css           Plugin-specific styles (map, tooltip, controls, spinner)
│   └── ol.css              OpenLayers default styles
│
├── icons/
│   ├── icon.png            Toolbar button icon
│   ├── marker-red.png
│   ├── marker-green.png
│   ├── marker-grey.png
│   └── marker-{1-6}.png    Numbered marker icons
│
├── maps/
│   └── norrath.png         The base map image
│
├── README.md               This file
└── LICENSE                 GPL-2
```

### Separation of concerns

| File | Responsibility |
|---|---|
| `syntax.php` | Parse `<eqmap>` attributes → emit `poiData` JSON + map HTML |
| `action.php` | Side-effects: toolbar button, `eqmapBase` URL variable |
| `js/eqmap.js` | All client-side map logic (OL init, layers, tooltip, debug grid) |
| `css/eqmap.css` | Visual styling for plugin-specific elements only |

---

## Contributing

### Adding a new POI colour

1. Add a PNG marker icon to `icons/` (e.g. `marker-blue.png`).  Match the dimensions of the existing icons (24×48 px).
2. Add an entry to the `POI_ICONS` constant near the top of `js/eqmap.js`:
   ```js
   ['blue', 'icons/marker-blue.png'],
   ```
3. Document the new key in this README under [Colour palette](#colour-palette).

No PHP changes are required.

### Adding a new `<eqmap>` attribute

1. **PHP:** Add a new private extract method in `syntax.php` (follow the pattern of `extractFloat`, `extractInt`, `hasFlag`) and call it from `handle()`.  Add the key to `renderPoiDataScript()`.
2. **JS:** Read the new key from `poiData` in `initMap()` (or wherever appropriate).
3. **Docs:** Add a row to the [Tag reference](#tag-reference) table.

### Code style

- **PHP:** Follow [DokuWiki coding style](https://www.dokuwiki.org/devel:coding_style).  Prefer explicit return types and typed parameters (PHP 7.4+).
- **JS:** ES2020+, `'use strict'`, JSDoc for public-facing functions.  No build step required — the JS is served as-is.

---

## License

Copyright (C) Guy Turner <guy.alexander.turner@gmail.com>

This program is free software; you can redistribute it and/or modify it under the terms of the **GNU General Public License, version 2** as published by the Free Software Foundation.

See [LICENSE](LICENSE) for the full text.