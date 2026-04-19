/* DOKUWIKI:include ol.js */

/**
 * eqmap.js — Interactive map of Norrath for DokuWiki
 *
 * Everything is initialised by `initMap()`, which jQuery calls once the DOM
 * is ready.  The function is intentionally kept linear so you can read it
 * top-to-bottom and understand the complete startup sequence:
 *
 *   1. Build the custom map projection (pixel-space, not geographic).
 *   2. Create the base image layer (the Norrath map PNG).
 *   3. Create the POI vector layer from `window.poiData`.
 *   4. Assemble the OL Map, adding optional controls (info overlay, debug grid).
 *   5. Wire up tooltip behaviour (hover on desktop, tap-to-pin on mobile).
 *   6. Wire up loading-spinner CSS class.
 *
 * Adding a new feature
 * --------------------
 * - New POI colour? Add an entry to `POI_ICONS` below.
 * - New map control? Create a class extending `ol.control.Control`, then add
 *   it in the `controls` array inside `initMap()`.
 * - New `poiData` field? Add parsing in `syntax.php::handle()` and consume
 *   it here; `poiData` is typed in the JSDoc below.
 *
 * Dependencies
 * ------------
 * - OpenLayers (ol.js, bundled via the DOKUWIKI:include directive above)
 * - `window.poiData`  — injected by syntax.php as an inline <script>
 * - `window.eqmapBase` — injected by action.php; base URL for plugin assets
 */

'use strict';

/**
 * The full extent of the Norrath map image in pixel-space coordinates.
 * [minX, minY, maxX, maxY]
 *
 * @type {ol.Extent}
 */
const NORRATH_EXTENT = [0, 0, 3840, 3267];

const DEFAULT_ZOOM = 2;
const MAX_ZOOM = 8;

/**
 * Map of colour names / numeric strings to their icon file paths.
 * To add a new colour: add an entry here and drop the corresponding PNG in
 * the icons/ directory.  No other changes are required.
 *
 * @type {ReadonlyMap<string, string>}
 */
const POI_ICONS = new Map([
    ['red',   'icons/marker-red.png'],
    ['green', 'icons/marker-green.png'],
    ['grey',  'icons/marker-grey.png'],
    ['1',     'icons/marker-1.png'],
    ['2',     'icons/marker-2.png'],
    ['3',     'icons/marker-3.png'],
    ['4',     'icons/marker-4.png'],
    ['5',     'icons/marker-5.png'],
    ['6',     'icons/marker-6.png'],
]);

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/**
 * Build a pixel-space OL projection for the Norrath map.
 *
 * OpenLayers normally works in geographic coordinates (lon/lat).  Because the
 * Norrath map is a flat image with an arbitrary pixel coordinate system, we
 * define a custom projection whose extent matches the image dimensions.
 *
 * @param {ol.Extent} extent  [minX, minY, maxX, maxY] in pixel units.
 * @returns {ol.proj.Projection}
 */
function buildProjection(extent) {
    return new ol.proj.Projection({
        code:   'norrath',
        units:  'pixels',
        extent: extent,
    });
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/**
 * Create the static image layer that renders the Norrath base map.
 *
 * @param {ol.proj.Projection} projection
 * @returns {ol.layer.Image}
 */
function buildImageLayer(projection) {
    return new ol.layer.Image({
        source: new ol.source.ImageStatic({
            url:        eqmapBase + 'maps/norrath.png',
            projection: projection,
            imageExtent: projection.getExtent(),
        }),
    });
}

/**
 * Create the vector layer that holds all POI markers.
 *
 * Each POI in `poiData.pois` becomes an OL Feature with a named icon style.
 * The layer is rendered in 'image' mode for better performance when there are
 * many markers (avoids per-feature DOM overhead).
 *
 * @param {PoiData['pois']} pois
 * @param {Map<string, ol.style.Style>} iconStyles  Pre-built style map from buildIconStyles().
 * @returns {ol.layer.Vector}
 */
function buildPoiLayer(pois, iconStyles) {
    const features = pois.map((poi) => {
        const feature = new ol.Feature({
            geometry: new ol.geom.Point([poi.lat, poi.lon]),
        });
		
        feature.setStyle(iconStyles.get(poi.color));
        feature.set('name', poi.name); 
        
        return feature;
    });

    return new ol.layer.Vector({
        source:     new ol.source.Vector({ features }),
        renderMode: 'image',
    });
}

/**
 * Pre-build OL icon styles for every entry in POI_ICONS.
 *
 * Styles are reused across all features of the same colour, which avoids
 * creating duplicate style objects during feature construction.
 *
 * @returns {Map<string, ol.style.Style>}
 */
function buildIconStyles() {
    const base = typeof eqmapBase !== 'undefined' ? eqmapBase : '';

    const makeStyle = (filename) => new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1.0],   // bottom-centre anchoring so the pin tip aligns to the coordinate
            width:  24,
            height: 48,
            src:    base + filename,
        }),
    });

    return new Map(
        [...POI_ICONS.entries()].map(([color, file]) => [color, makeStyle(file)])
    );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * InfoControl — a '?' button that toggles a full-map text overlay.
 *
 * Useful for providing context (e.g. "This map covers the Antonica continent")
 * without cluttering the map itself.  The overlay is dismissed by clicking it.
 *
 * @extends {ol.control.Control}
 */
class InfoControl extends ol.control.Control {
    /**
     * @param {object} options
     * @param {string} options.message  HTML string shown in the overlay.
     * @param {Element} [options.target]
     */
    constructor(options = {}) {
        const button = document.createElement('button');
        button.innerHTML = '?';
        button.title     = 'Map Information';
        button.className = 'ol-info-button';

        const element = document.createElement('div');
        element.className = 'ol-info-control ol-unselectable ol-control';
        element.appendChild(button);

        super({ element, target: options.target });

        const overlay = document.getElementById('map-info-overlay');

        button.addEventListener('click', () => {
            overlay.innerHTML = options.message;
            overlay.classList.toggle('map-info-visible');
            overlay.classList.toggle('map-info-hidden');
        });

        overlay.addEventListener('click', () => {
            overlay.classList.replace('map-info-visible', 'map-info-hidden');
        });
    }
}

/**
 * DebugGridControl — a '#' button that toggles the coordinate grid overlay.
 *
 * Only added to the map when `poiData.debug === true`.
 *
 * @extends {ol.control.Control}
 */
class DebugGridControl extends ol.control.Control {
    /**
     * @param {object}    options
     * @param {DebugGrid} options.debugGrid  The grid instance to toggle.
     */
    constructor(options = {}) {
        const button = document.createElement('button');
        button.innerHTML = '#';
        button.title     = 'Toggle coordinate grid';
        button.className = 'ol-debug-grid-button';

        const element = document.createElement('div');
        element.className = 'ol-debug-grid-control ol-unselectable ol-control';
        element.appendChild(button);

        super({ element });

        // Grid starts visible — reflect that in the button's active state.
        button.classList.add('ol-debug-grid-active');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowVisible = options.debugGrid.toggle();
            button.classList.toggle('ol-debug-grid-active', nowVisible);
        });
    }
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/**
 * Wire up the POI tooltip: hover on desktop, tap-to-pin on mobile.
 *
 * On desktop, the tooltip tracks the cursor.  On mobile (where there is no
 * hover), tapping a POI pins the tooltip until the user taps elsewhere or
 * scrolls/zooms.
 *
 * @param {ol.Map}     map
 * @param {HTMLElement} tooltipEl  The #tooltip div.
 * @returns {{ activeDebugGrid: DebugGrid|null }}  Mutable ref updated by the debug section.
 */
function initTooltip(map, tooltipEl) {
    let currentFeature = null;
    let pinnedFeature  = null;

    // Exposed so the debug grid can call showClickPin() after a map click.
    const state = { activeDebugGrid: null };

    const showTooltip = (feature, pixel) => {
        tooltipEl.style.left       = (pixel[0] + 12) + 'px';
        tooltipEl.style.top        = (pixel[1] + 24) + 'px';
        tooltipEl.style.visibility = 'visible';
		
        tooltipEl.innerText        = feature.get('name');
    };

    const hideTooltip = () => {
        tooltipEl.style.visibility = 'hidden';
    };

    const featureAtPixel = (pixel, target) => {
        // Ignore clicks/hovers that land on an OL control button.
        if (target.closest('.ol-control')) return undefined;
        return map.forEachFeatureAtPixel(pixel, (f) => f);
    };

    map.on('pointermove', (evt) => {
        if (evt.dragging || pinnedFeature) {
            // During a drag or while pinned, suppress hover updates.
            if (evt.dragging) {
                pinnedFeature  = null;
                currentFeature = undefined;
                hideTooltip();
            }
            return;
        }

        const pixel   = map.getEventPixel(evt.originalEvent);
        const feature = featureAtPixel(pixel, evt.originalEvent.target);

        feature ? showTooltip(feature, pixel) : hideTooltip();
        currentFeature = feature;
    });

    map.on('click', (evt) => {
        if (evt.originalEvent.target.closest('.ol-control')) return;

        const feature = featureAtPixel(evt.pixel, evt.originalEvent.target);

        if (feature) {
            if (pinnedFeature === feature) {
                // Second tap on the same POI unpins the tooltip.
                pinnedFeature = null;
                hideTooltip();
            } else {
                pinnedFeature = feature;
                showTooltip(feature, evt.pixel);
            }
        } else {
            pinnedFeature = null;
            hideTooltip();

            if (state.activeDebugGrid?.isVisible()) {
                state.activeDebugGrid.showClickPin(evt.coordinate);
            }
        }
    });

    // Hide the tooltip on scroll (wheel) or when the pointer leaves the map.
    const reset = () => {
        pinnedFeature  = null;
        currentFeature = undefined;
        hideTooltip();
    };

    map.getTargetElement().addEventListener('wheel',        reset);
    map.getTargetElement().addEventListener('pointerleave', () => {
        if (!pinnedFeature) reset();
    });

    return state;
}

// ---------------------------------------------------------------------------
// Loading spinner
// ---------------------------------------------------------------------------

/**
 * Toggle a CSS 'spinner' class on the map element during tile/image loads.
 * The animation itself is defined entirely in eqmap.css.
 *
 * @param {ol.Map} map
 */
function initLoadingSpinner(map) {
    const el = map.getTargetElement();
    map.on('loadstart', () => el.classList.add('spinner'));
    map.on('loadend',   () => el.classList.remove('spinner'));
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Poi
 * @property {string} name
 * @property {string} color  One of the keys in POI_ICONS.
 * @property {number} lat
 * @property {number} lon
 *
 * @typedef {object} PoiData
 * @property {boolean}    centered
 * @property {string|null} centerLat
 * @property {string|null} centerLon
 * @property {string|null} zoom
 * @property {Poi[]}      pois
 * @property {string}     info      HTML for the info overlay (empty string if unused).
 * @property {boolean}    debug
 */

/**
 * Main entry point — called by jQuery when the DOM is ready.
 *
 * Reads configuration from `window.poiData` (injected by syntax.php) and
 * `window.eqmapBase` (injected by action.php), then assembles the OL map.
 */
function initMap() {
    const projection = buildProjection(NORRATH_EXTENT);
    const iconStyles = buildIconStyles();

    // --- Layers ---
    const imageLayer = buildImageLayer(projection);
    const poiLayer   = buildPoiLayer(poiData.pois ?? [], iconStyles);

    // --- Initial view ---
    const center = (poiData.centerLat && poiData.centerLon)
        ? [parseFloat(poiData.centerLat), parseFloat(poiData.centerLon)]
        : ol.extent.getCenter(projection.getExtent());

    const zoom = poiData.zoom ? parseInt(poiData.zoom, 10) : DEFAULT_ZOOM;

    // --- Controls ---
    const extraControls = poiData.info
        ? [new InfoControl({ message: poiData.info })]
        : [];

    // --- Map ---
    const map = new ol.Map({
        target:  'map',
        layers:  [imageLayer, poiLayer],
        controls: ol.control.defaults.defaults().extend(extraControls),
        view: new ol.View({
            projection,
            center,
            zoom,
            maxZoom: MAX_ZOOM,
        }),
    });

    // --- Tooltip ---
    const tooltipState = initTooltip(map, document.getElementById('tooltip'));

    // --- Debug grid ---
    if (poiData.debug) {
        const debugGrid = initDebugGrid(map, projection);
        tooltipState.activeDebugGrid = debugGrid;
        map.addControl(new DebugGridControl({ debugGrid }));
    }

    // --- Loading spinner ---
    initLoadingSpinner(map);
}

// ---------------------------------------------------------------------------
// Debug grid
// ---------------------------------------------------------------------------

/**
 * Render a dynamic coordinate grid over the map as a canvas overlay.
 *
 * The grid adapts its line spacing to the current zoom level so labels stay
 * readable at any zoom.  It also supports a click-pin feature: after clicking
 * empty map space, a crosshair + coordinate badge marks the spot (handy when
 * authoring new POI coordinates).
 *
 * @param {ol.Map}             map
 * @param {ol.proj.Projection} projection
 * @returns {DebugGrid}
 *
 * @typedef {object} DebugGrid
 * @property {function(): boolean} toggle       Toggle visibility; returns the new state.
 * @property {function(): boolean} isVisible    Return current visibility.
 * @property {function(ol.Coordinate): void} showClickPin  Place a coordinate pin.
 */
function initDebugGrid(map, projection) {
    const canvas = document.createElement('canvas');
    canvas.className  = 'eqmap-debug-canvas';
    canvas.style.cssText =
        'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';

    map.getTargetElement().style.position = 'relative';
    map.getTargetElement().appendChild(canvas);

    let visible  = true;
    let clickPin = null; // { coordinate: ol.Coordinate } | null

    // ---- Grid line spacing ------------------------------------------------

    /**
     * Choose the smallest "nice" step that produces roughly IDEAL_LINES grid
     * lines across the visible span.
     */
    const IDEAL_LINES = 8;
    const NICE_STEPS  = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

    function niceStep(span) {
        const raw = span / IDEAL_LINES;
        return NICE_STEPS.find((s) => s >= raw) ?? NICE_STEPS.at(-1);
    }

    // ---- Drawing helpers --------------------------------------------------

    /** Draw a rounded rectangle path (fill/stroke it yourself). */
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ---- Main draw function -----------------------------------------------

    function drawGrid() {
        const size      = map.getSize();
        const view      = map.getView();
        const mapExtent = view.calculateExtent(size);

        canvas.width  = size[0];
        canvas.height = size[1];

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!visible) return;

        const [vMinX, vMinY, vMaxX, vMaxY] = mapExtent;
        const visW = vMaxX - vMinX;
        const visH = vMaxY - vMinY;

        const stepX = niceStep(visW);
        const stepY = niceStep(visH);

        /**
         * Project a map coordinate to a canvas pixel.
         * Note: OL's Y axis is bottom-up; canvas Y axis is top-down.
         */
        const toPixel = ([px, py]) => [
            ((px - vMinX) / visW) * canvas.width,
            canvas.height - ((py - vMinY) / visH) * canvas.height,
        ];

        const startX = Math.ceil(vMinX / stepX) * stepX;
        const startY = Math.ceil(vMinY / stepY) * stepY;

        // -- Grid lines --
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 220, 80, 0.35)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);

        for (let x = startX; x <= vMaxX; x += stepX) {
            const [cx] = toPixel([x, 0]);
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, canvas.height);
            ctx.stroke();
        }

        for (let y = startY; y <= vMaxY; y += stepY) {
            const [, cy] = toPixel([0, y]);
            ctx.beginPath();
            ctx.moveTo(0, cy);
            ctx.lineTo(canvas.width, cy);
            ctx.stroke();
        }

        ctx.restore();

        // -- Labels --
        ctx.save();
        ctx.font         = 'bold 11px "Courier New", monospace';
        ctx.textBaseline = 'top';
        const PAD = 3;

        // Intersection labels (shown at every grid crossing).
        for (let x = startX; x <= vMaxX; x += stepX) {
            for (let y = startY; y <= vMaxY; y += stepY) {
                const [cx, cy] = toPixel([x, y]);
                if (cx < 0 || cx > canvas.width || cy < 0 || cy > canvas.height) continue;

                const label = `(${Math.round(x)}, ${Math.round(y)})`;
                const lw    = ctx.measureText(label).width + PAD * 2;
                const lh    = 14;

                ctx.fillStyle = 'rgba(20, 20, 30, 0.72)';
                roundRect(ctx, cx + 2, cy - lh - 2, lw, lh, 3);
                ctx.fill();

                ctx.fillStyle = '#ffe050';
                ctx.fillText(label, cx + 2 + PAD, cy - lh - 2 + 1);
            }
        }

        // Edge tick labels — X axis (top edge).
        for (let x = startX; x <= vMaxX; x += stepX) {
            const [cx] = toPixel([x, 0]);
            const label = String(Math.round(x));
            const lw    = ctx.measureText(label).width + PAD * 2;

            ctx.fillStyle = 'rgba(20, 20, 30, 0.72)';
            roundRect(ctx, cx - lw / 2, 4, lw, 14, 3);
            ctx.fill();

            ctx.fillStyle  = '#80d4ff';
            ctx.textAlign  = 'center';
            ctx.fillText(label, cx, 5);
            ctx.textAlign  = 'left';
        }

        // Edge tick labels — Y axis (left edge).
        for (let y = startY; y <= vMaxY; y += stepY) {
            const [, cy] = toPixel([0, y]);
            const label  = String(Math.round(y));

            ctx.fillStyle = 'rgba(20, 20, 30, 0.72)';
            roundRect(ctx, 4, cy - 8, ctx.measureText(label).width + PAD * 2, 14, 3);
            ctx.fill();

            ctx.fillStyle = '#80d4ff';
            ctx.fillText(label, 4 + PAD, cy - 7);
        }

        // -- Click pin --
        if (clickPin) {
            const [pinX, pinY] = toPixel(clickPin.coordinate);
            const CROSS = 10;

            ctx.strokeStyle = 'rgba(255, 80, 80, 0.85)';
            ctx.lineWidth   = 1.5;
            ctx.setLineDash([]);

            // Crosshair
            ctx.beginPath();
            ctx.moveTo(pinX - CROSS, pinY);
            ctx.lineTo(pinX + CROSS, pinY);
            ctx.moveTo(pinX, pinY - CROSS);
            ctx.lineTo(pinX, pinY + CROSS);
            ctx.stroke();

            // Circle
            ctx.beginPath();
            ctx.arc(pinX, pinY, 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
            ctx.stroke();

            // Coordinate badge — flipped if near canvas edges.
            const pinLabel = `lat=${Math.round(clickPin.coordinate[0])}, lon=${Math.round(clickPin.coordinate[1])}`;
            const plw      = ctx.measureText(pinLabel).width + PAD * 2;
            const plh      = 16;

            let badgeX = pinX + 14;
            let badgeY = pinY - plh - 6;
            if (badgeX + plw > canvas.width - 4) badgeX = pinX - plw - 14;
            if (badgeY < 4)                       badgeY = pinY + 10;

            ctx.fillStyle = 'rgba(180, 30, 30, 0.88)';
            roundRect(ctx, badgeX, badgeY, plw, plh, 4);
            ctx.fill();

            ctx.fillStyle    = '#fff';
            ctx.font         = 'bold 11px "Courier New", monospace';
            ctx.textBaseline = 'middle';
            ctx.fillText(pinLabel, badgeX + PAD, badgeY + plh / 2);
        }

        ctx.restore();
    }

    map.on('postrender', drawGrid);
    map.on('moveend',    drawGrid);
    drawGrid();

    // ---- Public API -------------------------------------------------------
    return {
        toggle() {
            visible = !visible;
            if (!visible) clickPin = null;
            drawGrid();
            return visible;
        },

        isVisible() {
            return visible;
        },

        showClickPin(coordinate) {
            clickPin = { coordinate };
            drawGrid();
        },
    };
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

jQuery(initMap);