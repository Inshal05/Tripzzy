import React, { useEffect, useRef, useState } from 'react';
import { hasCoordinates } from '../utils/mapApi';
import {
  addMapMarker,
  createOlaMap,
  DEFAULT_MAP_CENTER,
  panMapToPoint,
  resizeMap,
} from '../utils/olaMaps';

const CaptainMap = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const olaMapsRef = useRef(null);
  const markerRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [mapMessage, setMapMessage] = useState('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);

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
          zoom: 5,
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
      } catch (mapError) {
        console.error('Ola map initialization failed:', mapError);
        setMapMessage(
          mapError?.message?.includes('VITE_OLA_MAPS_API_KEY')
            ? 'Add your Ola Maps key to load the captain map.'
            : 'Unable to initialize the captain map.'
        );
      }
    };

    initializeMap();

    return () => {
      disposed = true;
      markerRef.current?.remove?.();
      markerRef.current = null;
      mapRef.current?.remove?.();
      mapRef.current = null;
      olaMapsRef.current = null;
      setIsMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (geolocationError) => {
          console.error('Geolocation error:', geolocationError);
          setError('Location permission denied or unavailable.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setError('Geolocation not supported by this browser.');
    }
  }, []);

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !olaMapsRef.current) {
      return;
    }

    markerRef.current?.remove?.();
    markerRef.current = null;

    if (!hasCoordinates(location)) {
      return;
    }

    markerRef.current = addMapMarker({
      olaMaps: olaMapsRef.current,
      map: mapRef.current,
      position: location,
      config: {
        fillColor: '#facc15',
        glyph: 'C',
        title: 'Captain current location',
        zIndex: 30,
      },
    });

    panMapToPoint(mapRef.current, location, 15);
    resizeMap(mapRef.current);
  }, [isMapLoaded, location]);

  return (
    <>
      {error && <div style={{ color: 'red', paddingBottom: '1rem' }}>{error}</div>}
      <div className="relative h-full w-full">
        <div ref={containerRef} className="h-full w-full" />

        {!isMapLoaded && !mapMessage ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-slate-700">
            Loading map...
          </div>
        ) : null}

        {mapMessage ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-6 text-center text-sm text-slate-700">
            {mapMessage}
          </div>
        ) : null}
      </div>
    </>
  );
};

export default CaptainMap;
