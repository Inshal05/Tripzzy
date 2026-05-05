import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { SocketContext } from '../context/SocketContext';
import {
  formatDistanceText,
  formatDurationText,
  getMapRoute,
  hasCoordinates,
} from '../utils/mapApi';
import {
  addMapMarker,
  clearRouteLayer,
  createOlaMap,
  DEFAULT_MAP_CENTER,
  fitMapToPoints,
  panMapToPoint,
  resizeMap,
  updateRouteLayer,
} from '../utils/olaMaps';

const USER_VIEWPORT_FOLLOW_PAUSE_MS = 30000;
const EMPTY_WAYPOINTS = [];
const DEFAULT_FOLLOW_PAN_OFFSET = [0, 0];

const getResponsiveGestureHandling = () => {
  if (typeof window === 'undefined') {
    return 'greedy';
  }

  return window.matchMedia?.('(pointer: coarse)').matches ? 'cooperative' : 'greedy';
};

const buildLocationKey = (point) => {
  if (typeof point === 'string' && point.trim()) {
    return point.trim().toLowerCase();
  }

  if (hasCoordinates(point)) {
    return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
  }

  return '';
};

const calculateDistanceInMeters = (firstPoint, secondPoint) => {
  if (!hasCoordinates(firstPoint) || !hasCoordinates(secondPoint)) {
    return Number.POSITIVE_INFINITY;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(secondPoint.lat - firstPoint.lat);
  const deltaLongitude = toRadians(secondPoint.lng - firstPoint.lng);
  const latitudeOne = toRadians(firstPoint.lat);
  const latitudeTwo = toRadians(secondPoint.lat);

  const a =
    (Math.sin(deltaLatitude / 2) ** 2) +
    Math.cos(latitudeOne) * Math.cos(latitudeTwo) * (Math.sin(deltaLongitude / 2) ** 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const LiveTracking = ({
  source,
  destination,
  waypoints = EMPTY_WAYPOINTS,
  markerWaypoints = null,
  trackedCaptainId = null,
  captainPositionOverride = null,
  followCaptain = false,
  onDistanceDurationChange,
  onCaptainPositionChange,
  sourceMarker = null,
  destinationMarker = null,
  captainMarker = null,
  includeSourceStopWhenFollowingCaptain = false,
  showSourceMarker = true,
  showDestinationMarker = true,
  gestureHandlingMode = null,
  suppressDirectionsMarkers = true,
  fitPadding = 96,
  followPanOffset = DEFAULT_FOLLOW_PAN_OFFSET,
  followZoom = null,
  followAnimationDuration = 0,
  refitOnTrackedCaptainMove = true,
  routeRefreshIntervalMs = 0,
  routeRefreshDistanceMeters = 0,
  keepPreviousRouteOnError = true,
  authRole = 'user',
}) => {
  const [currentPosition, setCurrentPosition] = useState(DEFAULT_MAP_CENTER);
  const [captainPosition, setCaptainPosition] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const [dataMessage, setDataMessage] = useState('');
  const { socket } = useContext(SocketContext);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const olaMapsRef = useRef(null);
  const markerRefs = useRef([]);
  const fittedRouteSignatureRef = useRef('');
  const autoFollowPauseUntilRef = useRef(0);
  const autoFollowResumeTimeoutRef = useRef(null);
  const routeDataRef = useRef(null);
  const routeRequestStateRef = useRef({
    inFlight: false,
    requestedAt: 0,
    routeSignature: '',
    routeOrigin: null,
    requestToken: null,
  });

  const displayedWaypoints = markerWaypoints || waypoints;
  const resolvedGestureHandling = useMemo(
  () => gestureHandlingMode || getResponsiveGestureHandling(),
  [gestureHandlingMode]
);
  const resolvedCaptainPosition = hasCoordinates(captainPositionOverride)
    ? captainPositionOverride
    : captainPosition;
  const resolvedRouteLegs = Array.isArray(routeData?.legs) ? routeData.legs : [];
  const fitPaddingSignature =
    typeof fitPadding === 'number'
      ? String(fitPadding)
      : JSON.stringify(fitPadding || {});
  const routeViewportSignature = useMemo(
    () =>
      [
        buildLocationKey(source),
        buildLocationKey(destination),
        followCaptain && refitOnTrackedCaptainMove ? buildLocationKey(resolvedCaptainPosition) : '',
        ...(waypoints || []).map((waypoint) => buildLocationKey(waypoint?.location)),
      ]
        .filter(Boolean)
        .join('::'),
    [
      destination,
      followCaptain,
      refitOnTrackedCaptainMove,
      resolvedCaptainPosition,
      source,
      waypoints,
    ]
  );
  const routeResetSignature = useMemo(
    () =>
      [
        buildLocationKey(source),
        buildLocationKey(destination),
        ...(waypoints || []).map((waypoint) => buildLocationKey(waypoint?.location)),
        trackedCaptainId ? String(trackedCaptainId) : '',
      ]
        .filter(Boolean)
        .join('::'),
    [destination, source, trackedCaptainId, waypoints]
  );

  useEffect(() => {
    routeDataRef.current = routeData;
  }, [routeData]);

  const clearAutoFollowResumeTimer = () => {
    if (typeof window === 'undefined' || !autoFollowResumeTimeoutRef.current) {
      return;
    }

    window.clearTimeout(autoFollowResumeTimeoutRef.current);
    autoFollowResumeTimeoutRef.current = null;
  };

  const isAutoFollowTemporarilyPaused = () =>
    followCaptain && autoFollowPauseUntilRef.current > Date.now();

  const pauseAutoFollowForManualMapUse = () => {
    if (!followCaptain || typeof window === 'undefined') {
      return;
    }

    autoFollowPauseUntilRef.current = Date.now() + USER_VIEWPORT_FOLLOW_PAUSE_MS;
    clearAutoFollowResumeTimer();
    autoFollowResumeTimeoutRef.current = window.setTimeout(() => {
      autoFollowPauseUntilRef.current = 0;
      autoFollowResumeTimeoutRef.current = null;
    }, USER_VIEWPORT_FOLLOW_PAUSE_MS);
  };

  const resolveMarkerConfig = (config, fallbackConfig) => ({
    ...fallbackConfig,
    ...(config || {}),
  });
  const resolvedSourcePosition = hasCoordinates(source)
    ? source
    : resolvedRouteLegs[0]?.startLocation || routeData?.coordinates?.[0] || null;
  const resolvedDestinationPosition = hasCoordinates(destination)
    ? destination
    : resolvedRouteLegs[resolvedRouteLegs.length - 1]?.endLocation ||
      routeData?.coordinates?.[routeData.coordinates.length - 1] ||
      null;

  const resolveRouteLocation = (point) => {
    if (typeof point === 'string' && point.trim()) {
      return point.trim();
    }

    if (hasCoordinates(point)) {
      return point;
    }

    return null;
  };

  useEffect(() => {
    let disposed = false;

    const initializeMap = async () => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        setMapMessage('');
        const { map, olaMaps } = await createOlaMap({
          container: containerRef.current,
          center: hasCoordinates(source) ? source : DEFAULT_MAP_CENTER,
          zoom: 15,
          gestureHandling: resolvedGestureHandling,
        });

        if (disposed) {
          map.remove();
          return;
        }

        mapRef.current = map;
        olaMapsRef.current = olaMaps;

        try {
          map.addControl(olaMaps.addNavigationControls({ showCompass: false }), 'top-right');
        } catch (controlError) {
          console.error('Unable to add Ola navigation controls:', controlError);
        }

        setMapMessage('');
        setIsMapLoaded(true);
      } catch (error) {
        console.error('Ola map initialization failed:', error);
        setMapMessage(
          error?.message?.includes('VITE_OLA_MAPS_API_KEY')
            ? 'Add your Ola Maps key to load live tracking.'
            : 'Unable to initialize the live map.'
        );
      }
    };

    initializeMap();

    return () => {
      disposed = true;
      markerRefs.current.forEach((marker) => marker?.remove?.());
      markerRefs.current = [];
      clearRouteLayer(mapRef.current);
      mapRef.current?.remove?.();
      mapRef.current = null;
      olaMapsRef.current = null;
      clearAutoFollowResumeTimer();
      setIsMapLoaded(false);
    };
  }, [resolvedGestureHandling]);

  useEffect(() => {
    autoFollowPauseUntilRef.current = 0;
    clearAutoFollowResumeTimer();
    routeRequestStateRef.current = {
      inFlight: false,
      requestedAt: 0,
      routeSignature: '',
      routeOrigin: null,
      requestToken: null,
    };
  }, [routeResetSignature]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !followCaptain) {
      return undefined;
    }

    const mapInstance = mapRef.current;
    const mapContainer =
      mapInstance.getCanvasContainer?.() || mapInstance.getContainer?.() || containerRef.current;
    const handleManualViewportInteraction = (event) => {
      if (event && typeof event === 'object' && 'originalEvent' in event && !event.originalEvent) {
        return;
      }

      pauseAutoFollowForManualMapUse();
    };

    mapInstance.on?.('dragstart', handleManualViewportInteraction);
    mapInstance.on?.('zoomstart', handleManualViewportInteraction);
    mapInstance.on?.('rotatestart', handleManualViewportInteraction);
    mapInstance.on?.('pitchstart', handleManualViewportInteraction);
    mapContainer?.addEventListener?.('wheel', handleManualViewportInteraction, { passive: true });
    mapContainer?.addEventListener?.('touchstart', handleManualViewportInteraction, {
      passive: true,
    });

    return () => {
      mapInstance.off?.('dragstart', handleManualViewportInteraction);
      mapInstance.off?.('zoomstart', handleManualViewportInteraction);
      mapInstance.off?.('rotatestart', handleManualViewportInteraction);
      mapInstance.off?.('pitchstart', handleManualViewportInteraction);
      mapContainer?.removeEventListener?.('wheel', handleManualViewportInteraction);
      mapContainer?.removeEventListener?.('touchstart', handleManualViewportInteraction);
    };
  }, [followCaptain, isMapLoaded]);

  useEffect(() => {
    if (hasCoordinates(source)) {
      setCurrentPosition(source);
    }
  }, [source]);

  useEffect(() => {
    setCaptainPosition(null);

    if (hasCoordinates(source)) {
      setCurrentPosition(source);
      return;
    }

    setCurrentPosition(DEFAULT_MAP_CENTER);
  }, [trackedCaptainId, source]);

  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      const destinationLocation = resolveRouteLocation(destination);

      if (!destinationLocation) {
        setRouteData(null);
        setDataMessage('');
        onDistanceDurationChange?.(null);
        return;
      }

      const sourceLocation = resolveRouteLocation(source);
      const routeOrigin =
        followCaptain && hasCoordinates(resolvedCaptainPosition)
          ? resolvedCaptainPosition
          : sourceLocation;

      if (!routeOrigin) {
        setRouteData(null);
        setDataMessage('');
        onDistanceDurationChange?.(null);
        return;
      }

      const resolvedWaypoints = (waypoints || [])
        .map((waypoint) => {
          const location = resolveRouteLocation(waypoint?.location);
          if (!location) {
            return null;
          }

          return {
            location,
            stopover: waypoint?.stopover ?? true,
          };
        })
        .filter(Boolean);
      const routeOriginKey = buildLocationKey(routeOrigin);
      const sourceLocationKey = buildLocationKey(sourceLocation);
      const destinationLocationKey = buildLocationKey(destinationLocation);
      const shouldPrependSourceStop =
        includeSourceStopWhenFollowingCaptain &&
        followCaptain &&
        hasCoordinates(resolvedCaptainPosition) &&
        sourceLocationKey &&
        sourceLocationKey !== routeOriginKey &&
        sourceLocationKey !== destinationLocationKey &&
        resolvedWaypoints.every(
          (waypoint) => buildLocationKey(waypoint?.location) !== sourceLocationKey
        );
      const routeWaypoints = shouldPrependSourceStop
        ? [
            {
              location: sourceLocation,
              stopover: true,
            },
            ...resolvedWaypoints,
          ]
        : resolvedWaypoints;
      const routeSignature = [
        authRole,
        sourceLocationKey,
        destinationLocationKey,
        shouldPrependSourceStop ? 'with-source-stop' : 'direct',
        ...routeWaypoints.map((waypoint) => buildLocationKey(waypoint?.location)),
      ]
        .filter(Boolean)
        .join('::');
      const routeRequestState = routeRequestStateRef.current;
      const now = Date.now();
      const shouldThrottleRouteRefresh =
        followCaptain &&
        hasCoordinates(routeOrigin) &&
        routeSignature === routeRequestState.routeSignature &&
        (
          routeRequestState.inFlight ||
          (
            routeRefreshIntervalMs > 0 &&
            now - routeRequestState.requestedAt < routeRefreshIntervalMs &&
            routeRefreshDistanceMeters > 0 &&
            calculateDistanceInMeters(routeOrigin, routeRequestState.routeOrigin) <
              routeRefreshDistanceMeters
          )
        );

      if (shouldThrottleRouteRefresh) {
        return;
      }

      const requestToken = Symbol('route-request');
      routeRequestStateRef.current = {
        inFlight: true,
        requestedAt: now,
        routeSignature,
        routeOrigin,
        requestToken,
      };

      try {
        setDataMessage('');
        const nextRouteData = await getMapRoute({
          origin: routeOrigin,
          destination: destinationLocation,
          waypoints: routeWaypoints.map((waypoint) => waypoint.location),
          role: authRole,
        });

        if (cancelled) {
          return;
        }

        setRouteData(nextRouteData);
        routeDataRef.current = nextRouteData;
        onDistanceDurationChange?.({
          distanceMeters: nextRouteData.totalDistanceMeters || null,
          distanceText: formatDistanceText(nextRouteData.totalDistanceMeters),
          durationSeconds: nextRouteData.totalDurationSeconds || null,
          durationText: formatDurationText(nextRouteData.totalDurationSeconds),
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Route request failed:', error);

        if (!keepPreviousRouteOnError || !routeDataRef.current?.coordinates?.length) {
          setRouteData(null);
          routeDataRef.current = null;
          setDataMessage('Unable to load the live route right now.');
          onDistanceDurationChange?.(null);
          return;
        }

        setDataMessage('');
      } finally {
        if (routeRequestStateRef.current.requestToken === requestToken) {
          routeRequestStateRef.current = {
            ...routeRequestStateRef.current,
            inFlight: false,
          };
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    destination,
    followCaptain,
    includeSourceStopWhenFollowingCaptain,
    onDistanceDurationChange,
    resolvedCaptainPosition,
    source,
    waypoints,
    authRole,
    keepPreviousRouteOnError,
    routeRefreshDistanceMeters,
    routeRefreshIntervalMs,
  ]);

  useEffect(() => {
    if (!socket || !trackedCaptainId) {
      return undefined;
    }

    const trackedCaptainKey = String(trackedCaptainId);

    const handleLocationUpdate = (data) => {
      if (!data?.userId || String(data.userId) !== trackedCaptainKey) {
        return;
      }

      const newPosition = {
        lat: parseFloat(data.location?.ltd),
        lng: parseFloat(data.location?.lng),
      };

      if (Number.isNaN(newPosition.lat) || Number.isNaN(newPosition.lng)) {
        return;
      }

      setCaptainPosition(newPosition);
      onCaptainPositionChange?.(newPosition);

      if (followCaptain) {
        setCurrentPosition(newPosition);
      }

      if (followCaptain && mapRef.current && !isAutoFollowTemporarilyPaused()) {
        panMapToPoint(mapRef.current, newPosition, {
          offset: followPanOffset,
          zoom: typeof followZoom === 'number' ? followZoom : undefined,
          duration: followAnimationDuration,
        });
      }
    };

    socket.on('captain-location-updated', handleLocationUpdate);

    return () => {
      socket.off('captain-location-updated', handleLocationUpdate);
    };
  }, [
    followAnimationDuration,
    followCaptain,
    followPanOffset,
    followZoom,
    onCaptainPositionChange,
    socket,
    trackedCaptainId,
  ]);

  useEffect(() => {
    if (!followCaptain || !hasCoordinates(resolvedCaptainPosition)) {
      return;
    }

    setCurrentPosition(resolvedCaptainPosition);

    if (mapRef.current && !isAutoFollowTemporarilyPaused()) {
      panMapToPoint(mapRef.current, resolvedCaptainPosition, {
        offset: followPanOffset,
        zoom: typeof followZoom === 'number' ? followZoom : undefined,
        duration: followAnimationDuration,
      });
    }
  }, [
    followAnimationDuration,
    followCaptain,
    followPanOffset,
    followZoom,
    resolvedCaptainPosition,
  ]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !olaMapsRef.current) {
      return;
    }

    markerRefs.current.forEach((marker) => marker?.remove?.());
    markerRefs.current = [];

    const fallbackRouteCoordinates = [
      followCaptain ? resolvedCaptainPosition : null,
      resolvedSourcePosition,
      ...((waypoints || []).map((waypoint) => waypoint?.location)),
      resolvedDestinationPosition,
    ]
      .map((point) => (hasCoordinates(point) ? point : null))
      .filter(Boolean);
    
    if (routeData?.coordinates?.length) {
      updateRouteLayer(mapRef.current, routeData.coordinates);
    } else if (fallbackRouteCoordinates.length > 1) {
      updateRouteLayer(mapRef.current, fallbackRouteCoordinates, {
        opacity: 0.68,
        width: 5,
        casingWidth: 8,
      });
    } else {
      clearRouteLayer(mapRef.current);
    }

    if (showSourceMarker && hasCoordinates(resolvedSourcePosition)) {
      markerRefs.current.push(
        addMapMarker({
          olaMaps: olaMapsRef.current,
          map: mapRef.current,
          position: resolvedSourcePosition,
          config: resolveMarkerConfig(sourceMarker, {
            fillColor: '#16a34a',
            glyph: 'P',
            badgeText: '',
          }),
        })
      );
    }

    if (showDestinationMarker && hasCoordinates(resolvedDestinationPosition)) {
      markerRefs.current.push(
        addMapMarker({
          olaMaps: olaMapsRef.current,
          map: mapRef.current,
          position: resolvedDestinationPosition,
          config: resolveMarkerConfig(destinationMarker, {
            fillColor: '#2563eb',
            glyph: 'D',
            badgeText: '',
          }),
        })
      );
    }

    (displayedWaypoints || []).forEach((waypoint, index) => {
      const markerPosition = waypoint?.displayLocation || waypoint?.location;

      if (!hasCoordinates(markerPosition)) {
        return;
      }

      const isPickup = waypoint?.type === 'pickup';
      const waypointMarker = resolveMarkerConfig(waypoint?.marker, {
        fillColor: isPickup ? '#f59e0b' : '#7c3aed',
        glyph: isPickup ? 'P' : 'D',
        badgeText: '',
      });

      markerRefs.current.push(
        addMapMarker({
          olaMaps: olaMapsRef.current,
          map: mapRef.current,
          position: markerPosition,
          config: {
            ...waypointMarker,
            title: waypoint?.title,
            zIndex: waypoint?.zIndex,
          },
        })
      );
    });

    if (hasCoordinates(resolvedCaptainPosition)) {
      markerRefs.current.push(
        addMapMarker({
          olaMaps: olaMapsRef.current,
          map: mapRef.current,
          position: resolvedCaptainPosition,
          config: resolveMarkerConfig(captainMarker, {
            fillColor: '#dc2626',
            glyph: 'C',
            badgeText: '',
          }),
        })
      );
    }
  }, [
    captainMarker,
    destination,
    destinationMarker,
    displayedWaypoints,
    followCaptain,
    isMapLoaded,
    resolvedCaptainPosition,
    resolvedDestinationPosition,
    resolvedSourcePosition,
    routeData,
    showDestinationMarker,
    showSourceMarker,
    source,
    sourceMarker,
    waypoints,
  ]);

  useEffect(() => {
    if (!mapRef.current || !routeViewportSignature) {
      return;
    }

    if (isAutoFollowTemporarilyPaused()) {
      return;
    }

    const nextFittedRouteSignature = `${routeViewportSignature}::${fitPaddingSignature}`;

    if (fittedRouteSignatureRef.current === nextFittedRouteSignature) {
      return;
    }

    const routePoints =
      routeData?.coordinates?.length
        ? routeData.coordinates
        : [
            resolvedSourcePosition,
            resolvedDestinationPosition,
            ...((waypoints || []).map((waypoint) => waypoint?.location)),
            resolvedCaptainPosition,
          ];

    fitMapToPoints(mapRef.current, routePoints, fitPadding);
    fittedRouteSignatureRef.current = nextFittedRouteSignature;
  }, [
    destination,
    fitPadding,
    fitPaddingSignature,
    resolvedCaptainPosition,
    resolvedDestinationPosition,
    resolvedSourcePosition,
    routeData,
    routeViewportSignature,
    source,
    waypoints,
  ]);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      resizeMap(mapRef.current);

      if (hasCoordinates(currentPosition) && !isAutoFollowTemporarilyPaused()) {
        panMapToPoint(mapRef.current, currentPosition, {
          offset: followCaptain ? followPanOffset : [0, 0],
          zoom: followCaptain && typeof followZoom === 'number' ? followZoom : undefined,
          duration: followCaptain ? followAnimationDuration : 0,
        });
      }
    });
    const timeoutId = window.setTimeout(() => {
      resizeMap(mapRef.current);

      if (hasCoordinates(currentPosition) && !isAutoFollowTemporarilyPaused()) {
        panMapToPoint(mapRef.current, currentPosition, {
          offset: followCaptain ? followPanOffset : [0, 0],
          zoom: followCaptain && typeof followZoom === 'number' ? followZoom : undefined,
          duration: followCaptain ? followAnimationDuration : 0,
        });
      }
    }, 250);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [
    currentPosition,
    followAnimationDuration,
    followCaptain,
    followPanOffset,
    followZoom,
    isMapLoaded,
  ]);

  return (
    <div className="relative h-full w-full cursor-grab active:cursor-grabbing">
      <div ref={containerRef} className="h-full w-full" />

      {!isMapLoaded && !(mapMessage || dataMessage) ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-white">
          Loading Map...
        </div>
      ) : null}

      {mapMessage || dataMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/88 px-6 text-center text-sm text-white">
          {mapMessage || dataMessage}
        </div>
      ) : null}
    </div>
  );
};

export default LiveTracking;
