import { OlaMaps } from '../vendor/olaMapsSdk';
import { normalizeMapCoordinate } from './mapApi';

export const DEFAULT_MAP_CENTER = {
  lat: 28.621,
  lng: 77.205,
};

const DEFAULT_OLA_STYLE_ID = String(
  import.meta.env.VITE_OLA_MAP_STYLE_ID || 'default-light-standard'
).trim();
const SHOULD_USE_OLA_RENDERER =
  String(import.meta.env.VITE_USE_OLA_RENDERER || '').trim().toLowerCase() === 'true';
const MAP_LOAD_TIMEOUT_MS = 12000;
const OLA_STYLE_WARNING_LAYER_KEY = '3d_model';
const MAP_STYLE_READY_EVENTS = ['load', 'styledata', 'idle'];
let forceOpenStreetMapFallback = false;
const pendingRouteLayerOperations = new WeakMap();
const routeLayerRetryDetachers = new WeakMap();
const OSM_FALLBACK_STYLE = {
  version: 8,
  name: 'Tripzzy OpenStreetMap Fallback',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'tripzzy-openstreetmap': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'tripzzy-openstreetmap',
      type: 'raster',
      source: 'tripzzy-openstreetmap',
    },
  ],
};

const getStyleDescriptor = (styleDefinition, fallbackDescriptor = DEFAULT_OLA_STYLE_ID) => {
  if (typeof styleDefinition === 'string' && styleDefinition.trim()) {
    return styleDefinition.trim();
  }

  if (!styleDefinition || typeof styleDefinition !== 'object') {
    return fallbackDescriptor;
  }

  const descriptorCandidates = [
    styleDefinition.metadata?.styleId,
    styleDefinition.metadata?.['style-id'],
    styleDefinition.metadata?.theme,
    styleDefinition.name,
    fallbackDescriptor,
  ];

  return String(descriptorCandidates.find((value) => typeof value === 'string' && value.trim()) || fallbackDescriptor);
};

const withSdkStyleStringCompatibility = (
  styleDefinition,
  fallbackDescriptor = DEFAULT_OLA_STYLE_ID
) => {
  if (!styleDefinition || typeof styleDefinition !== 'object') {
    return styleDefinition;
  }

  if (typeof styleDefinition.includes === 'function') {
    return styleDefinition;
  }

  const styleDescriptor = getStyleDescriptor(styleDefinition, fallbackDescriptor);

  Object.defineProperty(styleDefinition, 'includes', {
    value: (value) =>
      styleDescriptor.toLowerCase().includes(String(value || '').trim().toLowerCase()),
    enumerable: false,
  });

  return styleDefinition;
};

const getOlaMapsApiKey = () => {
  const apiKey = String(import.meta.env.VITE_OLA_MAPS_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('VITE_OLA_MAPS_API_KEY is not configured');
  }

  return apiKey;
};

const buildOlaStyleUrl = (styleId = DEFAULT_OLA_STYLE_ID) => {
  const apiKey = encodeURIComponent(getOlaMapsApiKey());

  return `https://api.olamaps.io/tiles/vector/v1/styles/${styleId}/style.json?api_key=${apiKey}`;
};

const buildMapInitializationError = (message, statusCode) => {
  const error = new Error(message);

  if (typeof statusCode === 'number') {
    error.statusCode = statusCode;
  }

  return error;
};

const cloneJsonLikeValue = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
};

const absolutizeStyleUrlValue = (value, baseUrl) => {
  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const sanitizeOlaStyleDefinition = (styleDefinition, styleUrl) => {
  if (!styleDefinition || typeof styleDefinition !== 'object') {
    return styleDefinition;
  }

  const nextStyleDefinition = cloneJsonLikeValue(styleDefinition);

  nextStyleDefinition.sprite = absolutizeStyleUrlValue(nextStyleDefinition.sprite, styleUrl);
  nextStyleDefinition.glyphs = absolutizeStyleUrlValue(nextStyleDefinition.glyphs, styleUrl);

  if (nextStyleDefinition.sources && typeof nextStyleDefinition.sources === 'object') {
    Object.values(nextStyleDefinition.sources).forEach((sourceDefinition) => {
      if (!sourceDefinition || typeof sourceDefinition !== 'object') {
        return;
      }

      sourceDefinition.url = absolutizeStyleUrlValue(sourceDefinition.url, styleUrl);
      sourceDefinition.data = absolutizeStyleUrlValue(sourceDefinition.data, styleUrl);

      if (Array.isArray(sourceDefinition.tiles)) {
        sourceDefinition.tiles = sourceDefinition.tiles.map((tileUrl) =>
          absolutizeStyleUrlValue(tileUrl, styleUrl)
        );
      }
    });
  }

  if (Array.isArray(nextStyleDefinition.layers)) {
    nextStyleDefinition.layers = nextStyleDefinition.layers.filter((layerDefinition) => {
      const layerKeys = [
        layerDefinition?.id,
        layerDefinition?.source,
        layerDefinition?.['source-layer'],
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);

      return !layerKeys.some((value) => value.includes(OLA_STYLE_WARNING_LAYER_KEY));
    });
  }

  return nextStyleDefinition;
};

const loadOlaStyleDefinition = async (styleId = DEFAULT_OLA_STYLE_ID) => {
  const styleUrl = buildOlaStyleUrl(styleId);

  if (typeof fetch !== 'function') {
    return styleUrl;
  }

  try {
    const response = await fetch(styleUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw buildMapInitializationError(`Style request failed with status ${response.status}`, response.status);
    }

    return withSdkStyleStringCompatibility(
      sanitizeOlaStyleDefinition(await response.json(), styleUrl),
      styleId
    );
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.response?.status || 0);

    if ([401, 403].includes(statusCode)) {
      throw error;
    }

    console.warn('Unable to preload Ola Maps style; falling back to the remote style URL.', error);
    return styleUrl;
  }
};

const isRecoverableStyleLayerError = (message) => {
  const normalizedMessage = String(message || '').trim().toLowerCase();

  if (!normalizedMessage) {
    return false;
  }

  return (
    normalizedMessage.includes('does not exist on source') &&
    normalizedMessage.includes(OLA_STYLE_WARNING_LAYER_KEY)
  );
};

const hasRenderableMapSurface = (map) => {
  const canvas = map?.getCanvas?.();
  const container = map?.getContainer?.();

  return Boolean(
    (canvas && canvas.width > 0 && canvas.height > 0) ||
      (container && container.clientWidth > 0 && container.clientHeight > 0)
  );
};

const isMapStyleReadyForCustomLayers = (map) => {
  if (!map) {
    return false;
  }

  try {
    if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      return true;
    }

    if (typeof map.loaded === 'function' && map.loaded()) {
      return true;
    }

    const style = map.getStyle?.();
    return Array.isArray(style?.layers) && style.layers.length > 0;
  } catch {
    return false;
  }
};

const waitForMapLoad = (map, timeoutMs = MAP_LOAD_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    if (!map) {
      reject(new Error('Map instance was not created.'));
      return;
    }

    if (typeof map.loaded === 'function' && map.loaded()) {
      resolve();
      return;
    }

    let settled = false;
    let recoverableStyleErrorSeen = false;

    const cleanup = () => {
      map.off?.('load', handleLoad);
      map.off?.('styledata', handleRenderable);
      map.off?.('render', handleRenderable);
      map.off?.('idle', handleRenderable);
      map.off?.('error', handleError);
      window.clearTimeout(timeoutId);
    };

    const settle = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback(value);
    };

    const handleLoad = () => {
      settle(resolve);
    };

    const handleRenderable = () => {
      if (
        !hasRenderableMapSurface(map) ||
        (!recoverableStyleErrorSeen && !isMapStyleReadyForCustomLayers(map))
      ) {
        return;
      }

      settle(resolve);
    };

    const handleError = (event) => {
      const message = String(
        event?.error?.message || event?.message || event?.sourceDataType || ''
      ).trim();

      if (!message) {
        return;
      }

      if (message.includes('__publicField')) {
        settle(reject, new Error(message));
        return;
      }

      if (isRecoverableStyleLayerError(message)) {
        recoverableStyleErrorSeen = true;
        return;
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (isMapStyleReadyForCustomLayers(map)) {
        settle(resolve);
        return;
      }

      if (hasRenderableMapSurface(map)) {
        settle(resolve);
        return;
      }

      settle(reject, new Error('Map loading timed out.'));
    }, timeoutMs);

    map.on?.('load', handleLoad);
    map.on?.('styledata', handleRenderable);
    map.on?.('render', handleRenderable);
    map.on?.('idle', handleRenderable);
    map.on?.('error', handleError);
  });

const configureMapInteractions = (map) => {
  map.dragRotate?.disable?.();
  map.touchZoomRotate?.disableRotation?.();
  map.scrollZoom?.enable?.();
  map.dragPan?.enable?.();
  map.doubleClickZoom?.enable?.();
  map.touchZoomRotate?.enable?.();
};

const detachRouteLayerRetryListeners = (map) => {
  const detach = routeLayerRetryDetachers.get(map);

  if (!detach) {
    return;
  }

  detach();
  routeLayerRetryDetachers.delete(map);
};

const scheduleRouteLayerOperation = (map, operation) => {
  if (!map) {
    return;
  }

  pendingRouteLayerOperations.set(map, operation);

  if (routeLayerRetryDetachers.has(map)) {
    return;
  }

  const flushPendingOperation = () => {
    if (!isMapStyleReadyForCustomLayers(map)) {
      return;
    }

    const pendingOperation = pendingRouteLayerOperations.get(map);
    pendingRouteLayerOperations.delete(map);
    detachRouteLayerRetryListeners(map);

    if (!pendingOperation) {
      return;
    }

    if (pendingOperation.type === 'clear') {
      clearRouteLayerNow(map, pendingOperation.options);
      return;
    }

    updateRouteLayerNow(map, pendingOperation.coordinates, pendingOperation.options);
  };

  const detach = () => {
    MAP_STYLE_READY_EVENTS.forEach((eventName) => map.off?.(eventName, flushPendingOperation));
  };

  routeLayerRetryDetachers.set(map, detach);
  MAP_STYLE_READY_EVENTS.forEach((eventName) => map.on?.(eventName, flushPendingOperation));

  window.setTimeout(flushPendingOperation, 0);
};

const resolveMapLibreNamespace = (loadedModule) => {
  const moduleNamespace = loadedModule?.O || loadedModule;

  if (moduleNamespace?.Map && moduleNamespace?.Marker && moduleNamespace?.NavigationControl) {
    return moduleNamespace;
  }

  if (
    moduleNamespace?.default?.Map &&
    moduleNamespace?.default?.Marker &&
    moduleNamespace?.default?.NavigationControl
  ) {
    return moduleNamespace.default;
  }

  if (loadedModule?.default?.Map && loadedModule?.default?.Marker) {
    return loadedModule.default;
  }

  throw new Error('MapLibre fallback bundle could not be loaded.');
};

const loadMapLibreNamespace = async () => {
  const mapLibreModule = await import('olamaps-web-sdk/dist/maplibre-gl-BIFSxk4Y.js');
  return resolveMapLibreNamespace(mapLibreModule);
};

const createFallbackOlaMapsBridge = (mapLibreNamespace) => ({
  addNavigationControls: (options = {}) => new mapLibreNamespace.NavigationControl(options),
  addMarker: (options = {}) => new mapLibreNamespace.Marker(options),
  addPopup: (options = {}) => new mapLibreNamespace.Popup(options),
});

const createOpenStreetMapFallback = async ({
  container,
  center = DEFAULT_MAP_CENTER,
  zoom = 11,
  gestureHandling = 'greedy',
}) => {
  const mapLibreNamespace = await loadMapLibreNamespace();
  const map = new mapLibreNamespace.Map({
    container,
    style: cloneJsonLikeValue(OSM_FALLBACK_STYLE),
    center: [center.lng, center.lat],
    zoom,
    cooperativeGestures: gestureHandling === 'cooperative',
  });

  await waitForMapLoad(map, 8000);
  configureMapInteractions(map);

  return {
    map,
    olaMaps: createFallbackOlaMapsBridge(mapLibreNamespace),
    provider: 'osm-fallback',
  };
};

export const createOlaMap = async ({
  container,
  center = DEFAULT_MAP_CENTER,
  zoom = 11,
  gestureHandling = 'greedy',
}) => {
  const normalizedCenter = normalizeMapCoordinate(center) || DEFAULT_MAP_CENTER;

  if (!SHOULD_USE_OLA_RENDERER || forceOpenStreetMapFallback) {
    return createOpenStreetMapFallback({
      container,
      center: normalizedCenter,
      zoom,
      gestureHandling,
    });
  }

  try {
    const olaMaps = new OlaMaps({
      apiKey: getOlaMapsApiKey(),
      mode: '2d',
    });
    const style = await loadOlaStyleDefinition();
    const map = await olaMaps.init({
      container,
      style,
      center: [normalizedCenter.lng, normalizedCenter.lat],
      zoom,
      cooperativeGestures: gestureHandling === 'cooperative',
    });

    await waitForMapLoad(map);
    configureMapInteractions(map);

    return {
      map,
      olaMaps,
      provider: 'ola',
    };
  } catch (error) {
    forceOpenStreetMapFallback = true;

    console.warn(
      'Ola Maps initialization failed, switching to OpenStreetMap fallback.',
      error
    );

    return createOpenStreetMapFallback({
      container,
      center: normalizedCenter,
      zoom,
      gestureHandling,
    });
  }
};

export const buildMarkerSvg = ({
  fillColor = '#2563eb',
  glyph = '',
  badgeText = '',
  badgeColor = '#0f172a',
  textColor = '#ffffff',
  badgeTextColor = '#ffffff',
}) => {
  const safeGlyph = String(glyph || '').slice(0, 2).toUpperCase();
  const safeBadgeText = String(badgeText || '').slice(0, 1).toUpperCase();

  return `
    <svg width="56" height="64" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M28 3C17.5066 3 9 11.5066 9 22C9 36.25 28 58 28 58C28 58 47 36.25 47 22C47 11.5066 38.4934 3 28 3Z" fill="${fillColor}" stroke="rgba(15,23,42,0.28)" stroke-width="2.5"/>
      <circle cx="28" cy="22" r="14" fill="rgba(255,255,255,0.16)"/>
      <text x="28" y="27" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="${textColor}">${safeGlyph}</text>
      ${
        safeBadgeText
          ? `<circle cx="42" cy="14" r="9" fill="${badgeColor}" stroke="white" stroke-width="2"/><text x="42" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="${badgeTextColor}">${safeBadgeText}</text>`
          : ''
      }
    </svg>
  `;
};

export const addMapMarker = ({ olaMaps, map, position, config = {} }) => {
  const normalizedPosition = normalizeMapCoordinate(position);

  if (!olaMaps || !map || !normalizedPosition) {
    return null;
  }

  const element = document.createElement('div');
  element.className = 'tripzzy-ola-marker';
  element.innerHTML = buildMarkerSvg(config);
  element.style.width = '56px';
  element.style.height = '64px';
  element.style.zIndex = String(config?.zIndex ?? 1);

  if (config?.title) {
    element.title = config.title;
  }

  return olaMaps
    .addMarker({
      element,
      anchor: 'bottom',
    })
    .setLngLat([normalizedPosition.lng, normalizedPosition.lat])
    .addTo(map);
};

const normalizePadding = (padding) => {
  if (typeof padding === 'number') {
    return padding;
  }

  if (padding && typeof padding === 'object') {
    return {
      top: Math.max(0, Number(padding.top) || 0),
      right: Math.max(0, Number(padding.right) || 0),
      bottom: Math.max(0, Number(padding.bottom) || 0),
      left: Math.max(0, Number(padding.left) || 0),
    };
  }

  return 96;
};

const clearRouteLayerNow = (
  map,
  {
    sourceId = 'tripzzy-route-source',
    layerId = 'tripzzy-route-layer',
    casingLayerId = 'tripzzy-route-layer-casing',
  } = {}
) => {
  if (!map) {
    return;
  }

  if (map.getLayer?.(layerId)) {
    map.removeLayer(layerId);
  }

  if (map.getLayer?.(casingLayerId)) {
    map.removeLayer(casingLayerId);
  }

  if (map.getSource?.(sourceId)) {
    map.removeSource(sourceId);
  }
};

export const clearRouteLayer = (map, options = {}) => {
  if (!map) {
    return;
  }

  if (!isMapStyleReadyForCustomLayers(map)) {
    scheduleRouteLayerOperation(map, { type: 'clear', options });
    return;
  }

  clearRouteLayerNow(map, options);
};

const updateRouteLayerNow = (
  map,
  coordinates,
  {
    sourceId = 'tripzzy-route-source',
    layerId = 'tripzzy-route-layer',
    casingLayerId = 'tripzzy-route-layer-casing',
    color = '#3b82f6',
    width = 6,
    opacity = 0.92,
    casingColor = 'rgba(15, 23, 42, 0.42)',
    casingWidth = 10,
  } = {}
) => {
  if (!map) {
    return;
  }

  const normalizedCoordinates = Array.isArray(coordinates)
    ? coordinates.map((coordinate) => normalizeMapCoordinate(coordinate)).filter(Boolean)
    : [];

  if (!normalizedCoordinates.length) {
    clearRouteLayerNow(map, { sourceId, layerId, casingLayerId });
    return;
  }

  const routeFeature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: normalizedCoordinates.map((coordinate) => [coordinate.lng, coordinate.lat]),
    },
    properties: {},
  };

  const existingSource = map.getSource?.(sourceId);

  if (existingSource) {
    existingSource.setData(routeFeature);
  } else {
    map.addSource(sourceId, {
      type: 'geojson',
      data: routeFeature,
    });
  }

  if (!map.getLayer?.(casingLayerId)) {
    map.addLayer({
      id: casingLayerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': casingColor,
        'line-opacity': Math.min(1, opacity),
        'line-width': Math.max(width + 2, casingWidth),
      },
    });
  }

  if (!map.getLayer?.(layerId)) {
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': color,
        'line-opacity': opacity,
        'line-width': width,
      },
    });
  }
};

export const updateRouteLayer = (map, coordinates, options = {}) => {
  if (!map) {
    return;
  }

  if (!isMapStyleReadyForCustomLayers(map)) {
    scheduleRouteLayerOperation(map, { type: 'update', coordinates, options });
    return;
  }

  try {
    updateRouteLayerNow(map, coordinates, options);
  } catch (error) {
    const normalizedMessage = String(error?.message || '').trim().toLowerCase();
    const isRetryableMutationError =
      normalizedMessage.includes('style is not done loading') ||
      normalizedMessage.includes('style not done loading') ||
      normalizedMessage.includes('source') ||
      normalizedMessage.includes('layer');

    if (!isRetryableMutationError) {
      console.warn('Unable to render the route layer on the map.', error);
      return;
    }

    scheduleRouteLayerOperation(map, { type: 'update', coordinates, options });
  }
};

export const fitMapToPoints = (map, points, padding = 96) => {
  if (!map) {
    return;
  }

  const normalizedPoints = (Array.isArray(points) ? points : [])
    .map((point) => normalizeMapCoordinate(point))
    .filter(Boolean);

  if (!normalizedPoints.length) {
    return;
  }

  if (normalizedPoints.length === 1) {
    const singlePoint = normalizedPoints[0];
    map.easeTo?.({
      center: [singlePoint.lng, singlePoint.lat],
      zoom: 13,
      duration: 0,
    });
    return;
  }

  const bounds = normalizedPoints.reduce(
    (accumulator, point) => ({
      minLat: Math.min(accumulator.minLat, point.lat),
      maxLat: Math.max(accumulator.maxLat, point.lat),
      minLng: Math.min(accumulator.minLng, point.lng),
      maxLng: Math.max(accumulator.maxLng, point.lng),
    }),
    {
      minLat: normalizedPoints[0].lat,
      maxLat: normalizedPoints[0].lat,
      minLng: normalizedPoints[0].lng,
      maxLng: normalizedPoints[0].lng,
    }
  );

  fitMapToBounds(map, bounds, padding);
};

export const fitMapToBounds = (map, bounds, padding = 96) => {
  if (!map || !bounds) {
    return;
  }

  const resolvedPadding = normalizePadding(padding);

  map.fitBounds?.(
    [
      [bounds.minLng, bounds.minLat],
      [bounds.maxLng, bounds.maxLat],
    ],
    {
      padding: resolvedPadding,
      duration: 0,
      maxZoom: 15,
    }
  );
};

export const panMapToPoint = (map, point, zoomOrOptions = undefined) => {
  const normalizedPoint = normalizeMapCoordinate(point);

  if (!map || !normalizedPoint) {
    return;
  }

  const options =
    typeof zoomOrOptions === 'number'
      ? { zoom: zoomOrOptions }
      : zoomOrOptions && typeof zoomOrOptions === 'object'
        ? zoomOrOptions
        : {};
  const offset = Array.isArray(options.offset) && options.offset.length === 2
    ? [Number(options.offset[0]) || 0, Number(options.offset[1]) || 0]
    : undefined;
  const duration = Number.isFinite(Number(options.duration))
    ? Math.max(0, Number(options.duration))
    : 0;

  map.easeTo?.({
    center: [normalizedPoint.lng, normalizedPoint.lat],
    ...(typeof options.zoom === 'number' ? { zoom: options.zoom } : {}),
    ...(offset ? { offset } : {}),
    duration,
  });
};

export const resizeMap = (map) => {
  map?.resize?.();
};
