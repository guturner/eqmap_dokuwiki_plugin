/* DOKUWIKI:include ol.js */

class InfoControl extends ol.control.Control {
    constructor(opt_options) {
        const options = opt_options || {};

        const button = document.createElement('button');
        button.innerHTML = '?';
        button.title = 'Map Information';
        button.className = 'ol-info-button';

        const element = document.createElement('div');
        element.className = 'ol-info-control ol-unselectable ol-control';
        element.appendChild(button);

        super({
            element: element,
            target: options.target,
        });

        button.addEventListener('click', () => {
            const infoBox = document.getElementById('map-info-overlay');
            if (infoBox) {
                infoBox.innerHTML = options.message;
                infoBox.classList.toggle('map-info-visible');
                infoBox.classList.toggle('map-info-hidden');
            }
        });
		
		document.getElementById('map-info-overlay').addEventListener('click', function() {
			this.classList.add('map-info-hidden');
			this.classList.remove('map-info-visible');
		});
    }
}

function initMap() {
	const projection = getProjection(0, 0, 3840, 3267); // TODO These numbers seem wrong, figure this out

	// ==== START IMAGE LAYER ====
	const imageLayer = new ol.layer.Image({
		source: new ol.source.ImageStatic({
			url: eqmapBase + 'maps/norrath.png',
			projection: projection,
			imageExtent: projection.getExtent(),
		}),
	});
	// ==== END IMAGE LAYER ====
		
		
    // ==== START POI LAYER ====
	const pois = [];
    const iconLibrary = getMapIconLibrary();
    
    for (let poi of poiData.pois) {
        var iconFeature = new ol.Feature({
            geometry: new ol.geom.Point([poi.lat, poi.lon]),
        });
        
        iconFeature.setStyle(iconLibrary.get(poi.color));
        iconFeature.set('name', poi.name);
        pois.push(iconFeature);
    }

    var poiSource = new ol.source.Vector({
        features: pois
    });

    var poiLayer = new ol.layer.Vector({
        source: poiSource,
		renderMode: 'image'
    });
	// ==== END POI LAYER ====

	// ==== START MAP ====
	var center = ol.extent.getCenter(projection.getExtent());
	if (poiData.centerLat && poiData.centerLon) {
		center = [parseFloat(poiData.centerLat), parseFloat(poiData.centerLon)];
	}
	
	const zoom = poiData.zoom ? parseInt(poiData.zoom) : 2;
	
	const map = new ol.Map({
	  layers: [
		imageLayer,
		poiLayer
	  ],
	  controls: ol.control.defaults.defaults().extend(
		poiData.info ? [new InfoControl({ message: poiData.info })] : []
	  ),
	  target: 'map',
	  view: new ol.View({
		projection: projection,
		center: center,
		zoom: zoom,
		maxZoom: 8,
	  })
	});
	// ==== END MAP ====
	
	// ==== START POI TOOLTIP ====
	const tooltip = document.getElementById('tooltip');

	let currentFeature;
	let pinnedFeature = null; // Tracks a tooltip pinned by tap / click on mobile
	let activeDebugGrid = null; // Set when debug grid is initialized
	
	const showTooltip = function (feature, pixel) {
		tooltip.style.left = (pixel[0] + 12) + 'px';
		tooltip.style.top = (pixel[1] + 24) + 'px';
		tooltip.style.visibility = 'visible';
		tooltip.innerText = feature.get('name');
	};

	const hideTooltip = function () {
		tooltip.style.visibility = 'hidden';
	};
	
	const displayFeatureTooltip = function (pixel, target) {
		const feature = target.closest('.ol-control') ? 
			undefined : 
			map.forEachFeatureAtPixel(pixel, function (feature) {
				return feature;
			});
			
		if (feature) {
			showTooltip(feature, pixel);
		} else {
			hideTooltip();
		}
	  
		currentFeature = feature;
	};

	map.on('pointermove', function (evt) {
		if (evt.dragging) {
			pinnedFeature = null;
			hideTooltip();
			currentFeature = undefined;
			return;
		}
		
		// On mobile, pointermove fires during drag — skip hover logic if pinned
		if (pinnedFeature) return;

		const pixel = map.getEventPixel(evt.originalEvent);
		displayFeatureTooltip(pixel, evt.originalEvent.target);
	});

	map.on('click', function (evt) {
		if (evt.originalEvent.target.closest('.ol-control')) return;

		const feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
			return feature;
		});

		if (feature) {
			if (pinnedFeature === feature) {
				// Tapping the same POI again unpins/hides the tooltip
				pinnedFeature = null;
				hideTooltip();
			} else {
				// Pin the tooltip for this POI
				pinnedFeature = feature;
				showTooltip(feature, evt.pixel);
			}
		} else {
			// Tapped empty space — unpin and hide
			pinnedFeature = null;
			hideTooltip();
			// Show click coordinates if debug grid is visible
			if (activeDebugGrid && activeDebugGrid.isVisible()) {
				activeDebugGrid.showClickPin(evt.coordinate, evt.pixel);
			}
		}
	});
	
	map.getTargetElement().addEventListener('wheel', function () {
		pinnedFeature = null;
		currentFeature = undefined;
		hideTooltip();
	});

	map.getTargetElement().addEventListener('pointerleave', function () {
		if (pinnedFeature) return; // Keep tooltip visible if pinned
		currentFeature = undefined;
		hideTooltip();
	});
	// ==== END POI TOOLTIP ====
	
	// ==== START DEBUG GRID ====
	if (poiData.debug) {
		const debugGrid = initDebugGrid(map, projection);
		activeDebugGrid = debugGrid;
		map.addControl(new DebugGridControl({ debugGrid, map }));
	}
	// ==== END DEBUG GRID ====
	
	// ==== START LOADING SPINNER ====
	map.on('loadstart', function () {
		map.getTargetElement()
			.classList
			.add('spinner');
	});
		
	map.on('loadend', function () {
		map.getTargetElement()
			.classList
			.remove('spinner');
	});
	// ==== END LOADING SPINNER ====
}

function getProjection(bottomLeft, bottomRight, topLeft, topRight) {
	const extent = [bottomLeft, bottomRight, topLeft, topRight];
	
	return new ol.proj.Projection({
		code: 'norrath',
		units: 'pixels',
		extent: extent,
	});
}

function getMapIconLibrary() {
    const base = (typeof eqmapBase !== 'undefined') ? eqmapBase : '';

    const makeIconStyle = (filename) => new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1.0],
            width: 24,
            height: 48,
            src: base + filename
        })
    });

    return new Map([
        ['red',   makeIconStyle('icons/marker-red.png')],
        ['green', makeIconStyle('icons/marker-green.png')],
        ['grey',  makeIconStyle('icons/marker-grey.png')],
        ['1',     makeIconStyle('icons/marker-1.png')],
        ['2',     makeIconStyle('icons/marker-2.png')],
        ['3',     makeIconStyle('icons/marker-3.png')],
        ['4',     makeIconStyle('icons/marker-4.png')],
        ['5',     makeIconStyle('icons/marker-5.png')],
        ['6',     makeIconStyle('icons/marker-6.png')]
    ]);
}

/**
 * DebugGridControl — OL map control button to toggle the coordinate grid on/off.
 * Only added to the map when debug=true is set on the <eqmap> tag.
 */
class DebugGridControl extends ol.control.Control {
	constructor(opt_options) {
		const options = opt_options || {};

		const button = document.createElement('button');
		button.innerHTML = '#';
		button.title = 'Toggle coordinate grid';
		button.className = 'ol-debug-grid-button';

		const element = document.createElement('div');
		element.className = 'ol-debug-grid-control ol-unselectable ol-control';
		element.appendChild(button);

		super({ element });

		const { debugGrid } = options;
		
		// Grid starts visible — reflect that in button state
		button.classList.add('ol-debug-grid-active');

		button.addEventListener('click', (e) => {
			e.stopPropagation();
			const nowVisible = debugGrid.toggle();
			button.classList.toggle('ol-debug-grid-active', nowVisible);
		});
	}
}

/**
 * Debug grid overlay.
 *
 * Renders a dynamic coordinate grid over the map that updates on zoom and pan.
 * Grid line spacing adapts to the current zoom level so labels stay readable.
 * Returns a control API: { toggle, isVisible, showClickPin }.
 */
function initDebugGrid(map, projection) {
	// Canvas overlay for grid lines + labels
	const canvas = document.createElement('canvas');
	canvas.className = 'eqmap-debug-canvas';
	canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';

	map.getTargetElement().style.position = 'relative';
	map.getTargetElement().appendChild(canvas);

	let visible = true;
	let clickPin = null; // { coordinate, pixel } or null

	// ---- Nice step helper ----
	const IDEAL_LINES = 8;
	const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

	function niceStep(span) {
		const raw = span / IDEAL_LINES;
		for (const s of NICE_STEPS) {
			if (s >= raw) return s;
		}
		return NICE_STEPS[NICE_STEPS.length - 1];
	}

	// ---- Rounded rect helper ----
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

		// Project coordinate → canvas pixel (OL Y axis is up, canvas Y is down)
		const toPixel = ([px, py]) => [
			((px - vMinX) / visW) * canvas.width,
			canvas.height - ((py - vMinY) / visH) * canvas.height,
		];

		// ---- Grid lines ----
		ctx.save();
		ctx.strokeStyle = 'rgba(255, 220, 80, 0.35)';
		ctx.lineWidth   = 1;
		ctx.setLineDash([4, 4]);

		const startX = Math.ceil(vMinX / stepX) * stepX;
		for (let x = startX; x <= vMaxX; x += stepX) {
			const [cx] = toPixel([x, 0]);
			ctx.beginPath();
			ctx.moveTo(cx, 0);
			ctx.lineTo(cx, canvas.height);
			ctx.stroke();
		}

		const startY = Math.ceil(vMinY / stepY) * stepY;
		for (let y = startY; y <= vMaxY; y += stepY) {
			const [, cy] = toPixel([0, y]);
			ctx.beginPath();
			ctx.moveTo(0, cy);
			ctx.lineTo(canvas.width, cy);
			ctx.stroke();
		}
		ctx.restore();

		// ---- Intersection coordinate labels ----
		ctx.save();
		ctx.font         = 'bold 11px "Courier New", monospace';
		ctx.textBaseline = 'top';
		const PAD = 3;

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

		// ---- Axis-edge tick labels ----
		for (let x = startX; x <= vMaxX; x += stepX) {
			const [cx] = toPixel([x, 0]);
			const label = String(Math.round(x));
			const lw    = ctx.measureText(label).width + PAD * 2;

			ctx.fillStyle = 'rgba(20, 20, 30, 0.72)';
			roundRect(ctx, cx - lw / 2, 4, lw, 14, 3);
			ctx.fill();

			ctx.fillStyle = '#80d4ff';
			ctx.textAlign = 'center';
			ctx.fillText(label, cx, 5);
			ctx.textAlign = 'left';
		}

		for (let y = startY; y <= vMaxY; y += stepY) {
			const [, cy] = toPixel([0, y]);
			const label  = String(Math.round(y));

			ctx.fillStyle = 'rgba(20, 20, 30, 0.72)';
			roundRect(ctx, 4, cy - 8, ctx.measureText(label).width + PAD * 2, 14, 3);
			ctx.fill();

			ctx.fillStyle = '#80d4ff';
			ctx.fillText(label, 4 + PAD, cy - 7);
		}

		// ---- Click pin ----
		if (clickPin) {
			const [pinX, pinY] = toPixel(clickPin.coordinate);

			// Crosshair lines
			ctx.strokeStyle = 'rgba(255, 80, 80, 0.85)';
			ctx.lineWidth   = 1.5;
			ctx.setLineDash([]);

			const CROSS = 10;
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

			// Label
			const pinLabel = `lat=${Math.round(clickPin.coordinate[0])}, lon=${Math.round(clickPin.coordinate[1])}`;
			const plw      = ctx.measureText(pinLabel).width + PAD * 2;
			const plh      = 16;

			// Offset the badge so it doesn't sit under the cursor; flip if near edge
			let badgeX = pinX + 14;
			let badgeY = pinY - plh - 6;
			if (badgeX + plw > canvas.width - 4) badgeX = pinX - plw - 14;
			if (badgeY < 4) badgeY = pinY + 10;

			ctx.fillStyle = 'rgba(180, 30, 30, 0.88)';
			roundRect(ctx, badgeX, badgeY, plw, plh, 4);
			ctx.fill();

			ctx.fillStyle = '#fff';
			ctx.font = 'bold 11px "Courier New", monospace';
			ctx.textBaseline = 'middle';
			ctx.fillText(pinLabel, badgeX + PAD, badgeY + plh / 2);
		}

		ctx.restore();
	}

	map.on('postrender', drawGrid);
	map.on('moveend',    drawGrid);
	drawGrid();

	// ---- Public API ----
	return {
		/** Toggle visibility; returns new visible state */
		toggle() {
			visible = !visible;
			if (!visible) clickPin = null;
			drawGrid();
			return visible;
		},

		isVisible() {
			return visible;
		},

		/** Place a click-coordinate pin at the given map coordinate */
		showClickPin(coordinate) {
			clickPin = { coordinate };
			drawGrid();
		},
	};
}
jQuery(initMap);