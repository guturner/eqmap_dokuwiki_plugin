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

jQuery(initMap);