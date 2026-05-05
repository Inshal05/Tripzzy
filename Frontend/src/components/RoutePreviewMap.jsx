import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getMapCoordinates, getMapRoute, hasCoordinates } from '../utils/mapApi';
import {
  addMapMarker,
  clearRouteLayer,
  createOlaMap,
  DEFAULT_MAP_CENTER,
  fitMapToPoints,
  resizeMap,
  updateRouteLayer,
} from '../utils/olaMaps';

const RoutePreviewMap = ({ pickupAddress = '', destinationAddress = '', authRole = 'user' }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const olaMapsRef = useRef(null);
  const markerRefs = useRef([]);
  const [pickupPosition, setPickupPosition] = useState(null);
  const [destinationPosition, setDestinationPosition] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const [dataMessage, setDataMessage] = useState('');
  const [debouncedPickupAddress, setDebouncedPickupAddress] = useState('');
  const [debouncedDestinationAddress, setDebouncedDestinationAddress] = useState('');

  const normalizedPickupAddress = useMemo(
    () => String(pickupAddress || '').trim(),
    [pickupAddress]
  );
  const normalizedDestinationAddress = useMemo(
    () => String(destinationAddress || '').trim(),
    [destinationAddress]
  );

  const canResolveLocationInput = (value) => {
    const normalizedValue = String(value || '').trim();

    if (!normalizedValue) {
      return false;
    }

    if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(normalizedValue)) {
      return true;
    }

    // Avoid firing route/geocode requests for half-typed tokens like "dabrim".
    return normalizedValue.length >= 6 && /[\s,\d-]/.test(normalizedValue);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedPickupAddress(normalizedPickupAddress);
      setDebouncedDestinationAddress(normalizedDestinationAddress);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [normalizedDestinationAddress, normalizedPickupAddress]);

  useEffect(() => {
    let cancelled = false;

    const loadMapData = async () => {
      if (!debouncedPickupAddress && !debouncedDestinationAddress) {
        setPickupPosition(null);
        setDestinationPosition(null);
        setRouteData(null);
        setDataMessage('');
        return;
      }

      const canResolvePickup = canResolveLocationInput(debouncedPickupAddress);
      const canResolveDestination = canResolveLocationInput(debouncedDestinationAddress);

      if (!canResolvePickup && !canResolveDestination) {
        setPickupPosition(null);
        setDestinationPosition(null);
        setRouteData(null);
        setDataMessage('');
        return;
      }

      try {
        setDataMessage('');

        if (
          debouncedPickupAddress &&
          debouncedDestinationAddress &&
          canResolvePickup &&
          canResolveDestination
        ) {
          const nextRoute = await getMapRoute({
            origin: debouncedPickupAddress,
            destination: debouncedDestinationAddress,
            role: authRole,
          });

          if (cancelled) {
            return;
          }

          const firstLeg = nextRoute.legs?.[0] || null;
          const lastLeg = nextRoute.legs?.[nextRoute.legs.length - 1] || firstLeg;

          setPickupPosition(firstLeg?.startLocation || nextRoute.coordinates?.[0] || null);
          setDestinationPosition(
            lastLeg?.endLocation || nextRoute.coordinates?.[nextRoute.coordinates.length - 1] || null
          );
          setRouteData(nextRoute);
          return;
        }

        if (debouncedPickupAddress && canResolvePickup) {
          const nextPickupPosition = await getMapCoordinates(debouncedPickupAddress, { role: authRole });

          if (cancelled) {
            return;
          }

          setPickupPosition(nextPickupPosition);
          setDestinationPosition(null);
          setRouteData(null);
          return;
        }

        const nextDestinationPosition = await getMapCoordinates(debouncedDestinationAddress, { role: authRole });

        if (cancelled) {
          return;
        }

        setPickupPosition(null);
        setDestinationPosition(nextDestinationPosition);
        setRouteData(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Preview map load failed:', error);
        setPickupPosition(null);
        setDestinationPosition(null);
        setRouteData(null);

        if (error?.response?.status === 429) {
          setDataMessage('Map requests are temporarily rate-limited. Please pause for a few seconds.');
          return;
        }

        if (error?.response?.status === 403) {
          setDataMessage('Route preview is temporarily unavailable. You can still continue booking.');
          return;
        }

        if (debouncedPickupAddress && debouncedDestinationAddress) {
          setDataMessage('Unable to load the route preview right now.');
          return;
        }

        setDataMessage('');
      }
    };

    loadMapData();

    return () => {
      cancelled = true;
    };
  }, [authRole, debouncedDestinationAddress, debouncedPickupAddress]);

  useEffect(() => {
    let disposed = false;

    const initializeMap = async () => {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        const { map, olaMaps } = await createOlaMap({
          container: containerRef.current,
          center: DEFAULT_MAP_CENTER,
          zoom: 11,
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

        setIsMapLoaded(true);
      } catch (error) {
        console.error('Ola map initialization failed:', error);
        setMapMessage(
          error?.message?.includes('VITE_OLA_MAPS_API_KEY')
            ? 'Add your Ola Maps key to preview the map.'
            : 'Unable to initialize the map.'
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
      setIsMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !olaMapsRef.current) {
      return;
    }

    markerRefs.current.forEach((marker) => marker?.remove?.());
    markerRefs.current = [];

    if (routeData?.coordinates?.length) {
      updateRouteLayer(mapRef.current, routeData.coordinates);
    } else {
      clearRouteLayer(mapRef.current);
    }

    if (hasCoordinates(pickupPosition)) {
      markerRefs.current.push(
        addMapMarker({
          olaMaps: olaMapsRef.current,
          map: mapRef.current,
          position: pickupPosition,
          config: {
            fillColor: '#16a34a',
            glyph: 'P',
            title: 'Pickup',
            zIndex: 20,
          },
        })
      );
    }

    if (hasCoordinates(destinationPosition)) {
      markerRefs.current.push(
        addMapMarker({
          olaMaps: olaMapsRef.current,
          map: mapRef.current,
          position: destinationPosition,
          config: {
            fillColor: '#2563eb',
            glyph: 'D',
            title: 'Destination',
            zIndex: 20,
          },
        })
      );
    }

    const focusPoints = routeData?.coordinates?.length
      ? routeData.coordinates
      : [pickupPosition, destinationPosition];

    fitMapToPoints(mapRef.current, focusPoints, 96);
    resizeMap(mapRef.current);
  }, [destinationPosition, isMapLoaded, pickupPosition, routeData]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {!isMapLoaded && !(mapMessage || dataMessage) ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-sm text-slate-300">
          Loading map...
        </div>
      ) : null}

      {mapMessage || dataMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/92 px-6 text-center text-sm text-slate-200">
          {mapMessage || dataMessage}
        </div>
      ) : null}
    </div>
  );
};

export default RoutePreviewMap;
