/* DOKUWIKI:include ol.js */

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
	const poiString = poiData.pois.replace(/\\"/g, '"');
	
	const iconLibrary = getMapIconLibrary();
	const pois = [];
	for (let poi of JSON.parse(poiString)) {
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
        source: poiSource
    });
	// ==== END POI LAYER ====

	// ==== START MAP ====
	var center = ol.extent.getCenter(projection.getExtent());
	if (poiData.centerLat && poiData.centerLon) {
		center = [parseFloat(poiData.centerLat), parseFloat(poiData.centerLon)];
	}
	
	console.log(poiData);
	
	const zoom = poiData.zoom ? parseInt(poiData.zoom) : 2;
	
	const map = new ol.Map({
	  layers: [
		imageLayer,
		poiLayer
	  ],
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
	const displayFeatureTooltip = function (pixel, target) {
		const feature = target.closest('.ol-control') ? 
			undefined : 
			map.forEachFeatureAtPixel(pixel, function (feature) {
				return feature;
			});
			
		if (feature) {
			tooltip.style.left = (pixel[0] + 12) + 'px';
			tooltip.style.top = (pixel[1] + 24) + 'px';
		
			if (feature !== currentFeature) {
				tooltip.style.visibility = 'visible';
				tooltip.innerText = feature.get('name');
			}
		} else {
			tooltip.style.visibility = 'hidden';
		}
	  
		currentFeature = feature;
	};

	map.on('pointermove', function (evt) {
		if (evt.dragging) {
			tooltip.style.visibility = 'hidden';
			currentFeature = undefined;
			return;
		}

		const pixel = map.getEventPixel(evt.originalEvent);
		displayFeatureTooltip(pixel, evt.originalEvent.target);
	});

	map.on('click', function (evt) {
		displayFeatureTooltip(evt.pixel, evt.originalEvent.target);
	});

	map.getTargetElement().addEventListener('pointerleave', function () {
		currentFeature = undefined;
		tooltip.style.visibility = 'hidden';
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