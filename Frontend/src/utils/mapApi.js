import axios from 'axios';
import { getCaptainAuthHeaders, getUserAuthHeaders } from './authStorage';

const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROUTE_CACHE_TTL_MS = 15 * 1000;
const geocodeCache = new Map();
const routeCache = new Map();
const geocodeInFlightRequests = new Map();
const routeInFlightRequests = new Map();
const reverseGeocodeCache = new Map();
const reverseGeocodeInFlightRequests = new Map();

const getAuthHeaders = (role = 'user') => {
  if (role === 'captain') {
    return getCaptainAuthHeaders();
  }

  return getUserAuthHeaders();
};

export const normalizeMapCoordinate = (point) => {
  if (!point || typeof point !== 'object') {
    return null;
  }

  const latitude = Number(point.lat ?? point.ltd ?? point.latitude);
  const longitude = Number(point.lng ?? point.lon ?? point.longitude);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return {
    lat: latitude,
    lng: longitude,
  };
};

export const hasCoordinates = (point) => Boolean(normalizeMapCoordinate(point));

const buildLocationCacheKey = (location) => {
  if (typeof location === 'string' && location.trim()) {
    return location.trim().toLowerCase();
  }

  const normalizedCoordinate = normalizeMapCoordinate(location);

  if (!normalizedCoordinate) {
    return '';
  }

  return `${normalizedCoordinate.lat.toFixed(6)},${normalizedCoordinate.lng.toFixed(6)}`;
};

const readCachedValue = (cache, key) => {
  if (!key) {
    return null;
  }

  const cachedEntry = cache.get(key);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cachedEntry.value;
};

const writeCachedValue = (cache, key, value, ttlMs) => {
  if (!key) {
    return value;
  }

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
};

const buildRouteCacheKey = ({ origin, destination, waypoints = [], role = 'user' }) =>
  [
    role,
    buildLocationCacheKey(origin),
    buildLocationCacheKey(destination),
    ...(Array.isArray(waypoints) ? waypoints.map((waypoint) => buildLocationCacheKey(waypoint)) : []),
  ].join('::');

const buildReverseGeocodeCacheKey = ({ latitude, longitude, role = 'user' }) =>
  [
    role,
    Number(latitude).toFixed(6),
    Number(longitude).toFixed(6),
  ].join('::');

const parseCoordinateString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const coordinateMatch = trimmedValue.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);

  if (!coordinateMatch) {
    return null;
  }

  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    lat: latitude,
    lng: longitude,
  };
};

const isCoordinateLabel = (value) => Boolean(parseCoordinateString(String(value || '').trim()));

export const formatDistanceText = (distanceMeters) => {
  const normalizedDistanceMeters = Number(distanceMeters);

  if (!Number.isFinite(normalizedDistanceMeters) || normalizedDistanceMeters <= 0) {
    return '';
  }

  if (normalizedDistanceMeters < 1000) {
    return `${Math.round(normalizedDistanceMeters)} m`;
  }

  const distanceKilometers = normalizedDistanceMeters / 1000;
  const formattedDistance =
    distanceKilometers >= 10 ? distanceKilometers.toFixed(0) : distanceKilometers.toFixed(1);

  return `${formattedDistance} km`;
};

export const formatDurationText = (durationSeconds) => {
  const normalizedDurationSeconds = Number(durationSeconds);

  if (!Number.isFinite(normalizedDurationSeconds) || normalizedDurationSeconds <= 0) {
    return '';
  }

  const totalMinutes = Math.max(1, Math.round(normalizedDurationSeconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} mins`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!minutes) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} mins`;
};

const getPrimaryCollection = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (!responseData || typeof responseData !== 'object') {
    return [];
  }

  const candidateCollections = [
    responseData.reverseGeocodingResults,
    responseData.geocodingResults,
    responseData.results,
    responseData.predictions,
    responseData.autocompleteResults,
    responseData.places,
    responseData.data,
  ];

  return candidateCollections.find((collection) => Array.isArray(collection)) || [];
};

const extractAddressLabel = (candidate) => {
  if (!candidate) {
    return '';
  }

  const addressCandidates = [
    candidate.formatted_address,
    candidate.formattedAddress,
    candidate.formatted_address_text,
    candidate.description,
    candidate.display_name,
    candidate.place_name,
    candidate.name,
    candidate.label,
    candidate.address,
    candidate.properties?.formatted_address,
    candidate.properties?.label,
    candidate.properties?.name,
  ];

  return String(
    addressCandidates.find((value) => typeof value === 'string' && value.trim()) || ''
  ).trim();
};

const resolveAddressLabel = (responseData) => {
  const primaryResult = getPrimaryCollection(responseData)[0] || responseData;
  return extractAddressLabel(primaryResult);
};

const buildCoordinateLabel = (latitude, longitude) =>
  `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;

const fetchDirectOlaReverseGeocode = async (latitude, longitude) => {
  const apiKey = String(import.meta.env.VITE_OLA_MAPS_API_KEY || '').trim();

  if (!apiKey || typeof fetch !== 'function') {
    return '';
  }

  const response = await fetch(
    `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${encodeURIComponent(
      `${latitude},${longitude}`
    )}&api_key=${encodeURIComponent(apiKey)}`,
    {
      headers: {
        Accept: 'application/json',
        'X-Request-Id': `tripzzy-${Date.now()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Direct Ola reverse geocode failed with status ${response.status}`);
  }

  return resolveAddressLabel(await response.json());
};

const fetchDirectNominatimReverseGeocode = async (latitude, longitude) => {
  if (typeof fetch !== 'function') {
    return '';
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(longitude)}&format=jsonv2&addressdetails=1&zoom=18`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Direct Nominatim reverse geocode failed with status ${response.status}`);
  }

  return resolveAddressLabel(await response.json());
};

const normalizeRouteData = (data = {}) => ({
  ...data,
  totalDistanceMeters: Number(data?.totalDistanceMeters) || 0,
  totalDurationSeconds: Number(data?.totalDurationSeconds) || 0,
  coordinates: Array.isArray(data?.coordinates)
    ? data.coordinates.map((coordinate) => normalizeMapCoordinate(coordinate)).filter(Boolean)
    : [],
  legs: Array.isArray(data?.legs)
    ? data.legs.map((leg) => ({
        ...leg,
        distanceMeters: Number(leg?.distanceMeters) || 0,
        durationSeconds: Number(leg?.durationSeconds) || 0,
        startLocation: normalizeMapCoordinate(leg?.startLocation),
        endLocation: normalizeMapCoordinate(leg?.endLocation),
      }))
    : [],
});

export const getMapCoordinates = async (address, options = {}) => {
  const { role = 'user' } = options;
  const coordinateFromString = parseCoordinateString(address);

  if (coordinateFromString) {
    return coordinateFromString;
  }

  const cacheKey = `${role}::${buildLocationCacheKey(address)}`;
  const cachedCoordinate = readCachedValue(geocodeCache, cacheKey);

  if (cachedCoordinate) {
    return cachedCoordinate;
  }

  if (geocodeInFlightRequests.has(cacheKey)) {
    return geocodeInFlightRequests.get(cacheKey);
  }

  const coordinateRequest = axios
    .get(`${import.meta.env.VITE_BASE_URL}/maps/get-coordinates`, {
      params: {
        address,
      },
      headers: getAuthHeaders(role),
    })
    .then(({ data }) =>
      writeCachedValue(
        geocodeCache,
        cacheKey,
        normalizeMapCoordinate(data),
        GEOCODE_CACHE_TTL_MS
      )
    )
    .finally(() => {
      geocodeInFlightRequests.delete(cacheKey);
    });

  geocodeInFlightRequests.set(cacheKey, coordinateRequest);
  return coordinateRequest;
};

export const getAddressFromCoordinates = async (latitude, longitude, options = {}) => {
  const { role = 'user' } = options;
  const normalizedLatitude = Number(latitude);
  const normalizedLongitude = Number(longitude);

  if (
    Number.isNaN(normalizedLatitude) ||
    Number.isNaN(normalizedLongitude) ||
    normalizedLatitude < -90 ||
    normalizedLatitude > 90 ||
    normalizedLongitude < -180 ||
    normalizedLongitude > 180
  ) {
    throw new Error('Valid latitude and longitude are required.');
  }

  const cacheKey = buildReverseGeocodeCacheKey({
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    role,
  });
  const cachedAddress = readCachedValue(reverseGeocodeCache, cacheKey);

  if (cachedAddress) {
    return cachedAddress;
  }

  if (reverseGeocodeInFlightRequests.has(cacheKey)) {
    return reverseGeocodeInFlightRequests.get(cacheKey);
  }

  const reverseGeocodeRequest = (async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/maps/reverse-geocode`, {
        params: {
          lat: normalizedLatitude,
          lng: normalizedLongitude,
        },
        headers: getAuthHeaders(role),
      });
      const resolvedAddress = String(data?.address || '').trim();

      if (resolvedAddress && !isCoordinateLabel(resolvedAddress)) {
        return writeCachedValue(
          reverseGeocodeCache,
          cacheKey,
          resolvedAddress,
          GEOCODE_CACHE_TTL_MS
        );
      }
    } catch (error) {
      console.warn('Backend reverse geocode failed, trying direct fallbacks.', error);
    }

    const directReverseGeocodeStrategies = [
      () => fetchDirectOlaReverseGeocode(normalizedLatitude, normalizedLongitude),
      () => fetchDirectNominatimReverseGeocode(normalizedLatitude, normalizedLongitude),
    ];

    for (const reverseGeocodeStrategy of directReverseGeocodeStrategies) {
      try {
        const resolvedAddress = String((await reverseGeocodeStrategy()) || '').trim();

        if (resolvedAddress) {
          return writeCachedValue(
            reverseGeocodeCache,
            cacheKey,
            resolvedAddress,
            GEOCODE_CACHE_TTL_MS
          );
        }
      } catch (error) {
        console.warn('Direct reverse geocode fallback failed.', error);
      }
    }

    return buildCoordinateLabel(normalizedLatitude, normalizedLongitude);
  })().finally(() => {
    reverseGeocodeInFlightRequests.delete(cacheKey);
  });

  reverseGeocodeInFlightRequests.set(cacheKey, reverseGeocodeRequest);
  return reverseGeocodeRequest;
};

export const getMapRoute = async ({ origin, destination, waypoints = [], role = 'user' }) => {
  const cacheKey = buildRouteCacheKey({ origin, destination, waypoints, role });
  const cachedRoute = readCachedValue(routeCache, cacheKey);

  if (cachedRoute) {
    return cachedRoute;
  }

  if (routeInFlightRequests.has(cacheKey)) {
    return routeInFlightRequests.get(cacheKey);
  }

  const routeRequest = axios
    .post(
      `${import.meta.env.VITE_BASE_URL}/maps/get-route`,
      {
        origin,
        destination,
        waypoints,
      },
      {
        headers: getAuthHeaders(role),
      }
    )
    .then(({ data }) =>
      writeCachedValue(routeCache, cacheKey, normalizeRouteData(data), ROUTE_CACHE_TTL_MS)
    )
    .finally(() => {
      routeInFlightRequests.delete(cacheKey);
    });

  routeInFlightRequests.set(cacheKey, routeRequest);
  return routeRequest;
};
