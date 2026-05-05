import { useEffect } from 'react';

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15000,
};

const useCaptainLocationSharing = ({
  captainId,
  socket,
  isEnabled = true,
  onLocationChange,
}) => {
  useEffect(() => {
    if (!isEnabled || !captainId || !socket || !navigator.geolocation) {
      return undefined;
    }

    const emitLocationUpdate = (position) => {
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      onLocationChange?.(nextLocation);

      socket.emit('update-location-captain', {
        userId: captainId,
        location: {
          ltd: nextLocation.lat,
          lng: nextLocation.lng,
        },
      });
    };

    const handleLocationError = (error) => {
      console.warn('Geolocation error:', error.message);
    };

    navigator.geolocation.getCurrentPosition(
      emitLocationUpdate,
      handleLocationError,
      GEOLOCATION_OPTIONS
    );

    const watchId = navigator.geolocation.watchPosition(
      emitLocationUpdate,
      handleLocationError,
      GEOLOCATION_OPTIONS
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [captainId, isEnabled, onLocationChange, socket]);
};

export default useCaptainLocationSharing;
