import React, { useRef, useState, useEffect, useContext, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import FinishRide from '../components/FinishRide';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import LiveTracking from '../components/LiveTracking';
import { SocketContext } from '../context/SocketContext';
import { CaptainDataContext } from '../context/CapatainContext';
import useCaptainLocationSharing from '../hooks/useCaptainLocationSharing';
import { getMapCoordinates } from '../utils/mapApi';
import { getCaptainAuthHeaders } from '../utils/authStorage';

const SHARED_STOP_COMPLETION_RADIUS_METERS = 120;
const hasCoordinates = (point) => point?.lat != null && point?.lng != null;

const getCollapsedLauncherMetrics = () => {
  if (typeof window === 'undefined') {
    return { size: 64, margin: 16 };
  }

  const isDesktop = window.innerWidth >= 768;

  return {
    size: isDesktop ? 80 : 64,
    margin: isDesktop ? 24 : 16,
  };
};

const getCaptainRideMapViewport = (isRideInfoPanelCollapsed) => {
  if (typeof window === 'undefined') {
    return {
      fitPadding: 96,
      followPanOffset: [0, 0],
    };
  }

  const isDesktop = window.innerWidth >= 768;

  if (isDesktop) {
    return {
      fitPadding: isRideInfoPanelCollapsed
        ? { top: 180, right: 72, bottom: 72, left: 72 }
        : { top: 180, right: 520, bottom: 88, left: 72 },
      followPanOffset: [0, 0],
    };
  }

  return {
    fitPadding: isRideInfoPanelCollapsed
      ? { top: 170, right: 24, bottom: 96, left: 24 }
      : { top: 170, right: 24, bottom: 360, left: 24 },
    followPanOffset: [0, 0],
  };
};

const getDefaultCollapsedLauncherPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 16, y: 16 };
  }

  const { size, margin } = getCollapsedLauncherMetrics();

  return {
    x: window.innerWidth - size - margin,
    y: window.innerHeight - size - margin,
  };
};

const clampCollapsedLauncherPosition = (position) => {
  if (typeof window === 'undefined') {
    return position;
  }

  const { size, margin } = getCollapsedLauncherMetrics();
  const maxX = Math.max(margin, window.innerWidth - size - margin);
  const maxY = Math.max(margin, window.innerHeight - size - margin);

  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  };
};

const formatDistanceLabel = (routeMetrics) => {
  if (routeMetrics?.distanceText) {
    return `${routeMetrics.distanceText} to Destination`;
  }

  return 'Distance unavailable';
};

const normalizeAddress = (address) => String(address || '').trim().toLowerCase();

const buildParticipantName = (user, fallbackLabel) => {
  const firstName = String(user?.fullname?.firstname || '').trim();
  const lastName = String(user?.fullname?.lastname || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName || fallbackLabel;
};

const getParticipantMarkerLabel = (index) => {
  let normalizedIndex = Math.max(0, Number(index) || 0);
  let label = '';

  do {
    label = String.fromCharCode(65 + (normalizedIndex % 26)) + label;
    normalizedIndex = Math.floor(normalizedIndex / 26) - 1;
  } while (normalizedIndex >= 0);

  return label;
};

const getParticipantStatusLabel = (status) => {
  switch (status) {
    case 'awaiting_pickup':
      return 'Awaiting pickup';
    case 'onboard':
      return 'Onboard';
    case 'completed':
      return 'Dropped off';
    case 'awaiting_start':
      return 'Awaiting ride start';
    default:
      return 'In trip';
  }
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

const buildRideParticipants = (ride) => {
  const ownerUser = ride?.user;
  const ownerUserId = ownerUser?._id || ride?.user;
  const ownerStatus =
    ride?.status === 'completed'
      ? 'completed'
      : ride?.status === 'ongoing'
        ? 'onboard'
        : 'awaiting_start';
  const ownerRouteEndMeters = Number(ride?.ownerAllocation?.routeEndMeters);
  const passengerAllocations = Array.isArray(ride?.passengerAllocations)
    ? [...ride.passengerAllocations].sort(
        (left, right) =>
          (Number(left?.routeStartMeters) || 0) - (Number(right?.routeStartMeters) || 0)
      )
    : [];

  return [
    {
      key: `owner-${ownerUserId || 'primary'}`,
      userId: ownerUserId ? String(ownerUserId) : 'owner',
      markerLabel: getParticipantMarkerLabel(0),
      displayName: buildParticipantName(ownerUser, 'Passenger A'),
      pickup: ride?.pickup || '',
      destination: ride?.destination || '',
      bookedSeats: Math.max(1, Number(ride?.bookedSeats) || 1),
      boardingStatus: ownerStatus,
      routeStartMeters: Number(ride?.ownerAllocation?.routeStartMeters) || 0,
      routeEndMeters: Number.isFinite(ownerRouteEndMeters) && ownerRouteEndMeters > 0
        ? ownerRouteEndMeters
        : Number.MAX_SAFE_INTEGER,
      isOwner: true,
    },
    ...passengerAllocations.map((allocation, index) => ({
      key: `passenger-${allocation?.user?._id || allocation?.user || index}`,
      userId: allocation?.user?._id || allocation?.user
        ? String(allocation?.user?._id || allocation?.user)
        : `passenger-${index + 1}`,
      markerLabel: getParticipantMarkerLabel(index + 1),
      displayName: buildParticipantName(allocation?.user, `Passenger ${index + 2}`),
      pickup: allocation?.pickup || '',
      destination: allocation?.destination || '',
      bookedSeats: Math.max(1, Number(allocation?.bookedSeats) || 1),
      boardingStatus: allocation?.boardingStatus || 'awaiting_pickup',
      routeStartMeters: Number(allocation?.routeStartMeters) || 0,
      routeEndMeters: Number(allocation?.routeEndMeters) || 0,
      isOwner: false,
    })),
  ];
};

const buildPassengerRouteStops = (participants) =>
  participants
    .filter((participant) => !participant?.isOwner)
    .flatMap((participant) => {
      const pickupPositionMeters = Number.isFinite(Number(participant?.routeStartMeters))
        ? Number(participant.routeStartMeters)
        : 0;
      const dropoffPositionMeters =
        Number.isFinite(Number(participant?.routeEndMeters)) &&
        Number(participant.routeEndMeters) > pickupPositionMeters
          ? Number(participant.routeEndMeters)
          : pickupPositionMeters + 1;

      if (!participant?.pickup || !participant?.destination) {
        return [];
      }

      return [
        {
          key: `${participant.key}-pickup`,
          participantKey: participant.key,
          participantLabel: participant.markerLabel,
          participantName: participant.displayName,
          type: 'pickup',
          address: participant.pickup,
          positionMeters: pickupPositionMeters,
          title: `${participant.markerLabel} pickup | ${participant.displayName}`,
          marker: {
            fillColor: '#f59e0b',
            glyph: participant.markerLabel,
            badgeText: 'P',
            badgeColor: '#111827',
          },
          zIndex: 40,
        },
        {
          key: `${participant.key}-dropoff`,
          participantKey: participant.key,
          participantLabel: participant.markerLabel,
          participantName: participant.displayName,
          type: 'dropoff',
          address: participant.destination,
          positionMeters: dropoffPositionMeters,
          title: `${participant.markerLabel} drop | ${participant.displayName}`,
          marker: {
            fillColor: '#7c3aed',
            glyph: participant.markerLabel,
            badgeText: 'D',
            badgeColor: '#0f172a',
          },
          zIndex: 35,
        },
      ];
    })
    .sort((left, right) => {
      if (left.positionMeters !== right.positionMeters) {
        return left.positionMeters - right.positionMeters;
      }

      return left.type === right.type ? 0 : left.type === 'pickup' ? -1 : 1;
    });

const isStopCompleted = (stop, participantsByKey, completedStopKeys) => {
  const participant = participantsByKey.get(stop?.participantKey);
  const participantStatus = participant?.boardingStatus;

  if (stop?.type === 'pickup') {
    return participantStatus !== 'awaiting_pickup';
  }

  if (participantStatus === 'completed') {
    return true;
  }

  return participantStatus === 'onboard' && completedStopKeys.includes(stop?.key);
};

const buildRouteWaypoints = (stops, finalDestinationAddress) => {
  const seenStops = new Set();
  const normalizedFinalDestination = normalizeAddress(finalDestinationAddress);

  return stops
    .filter((stop) => hasCoordinates(stop?.location))
    .filter((stop) => {
      const normalizedAddress = normalizeAddress(stop?.address);

      if (!normalizedAddress) {
        return false;
      }

      if (stop?.type === 'dropoff' && normalizedAddress === normalizedFinalDestination) {
        return false;
      }

      const dedupeKey = `${stop?.type}:${normalizedAddress}`;

      if (seenStops.has(dedupeKey)) {
        return false;
      }

      seenStops.add(dedupeKey);
      return true;
    })
    .map((stop) => ({
      key: `route-${stop.key}`,
      type: stop.type,
      location: stop.location,
    }));
};

const applyMarkerOffsetsToStops = (stops) => {
  const groupedStops = stops.reduce((groups, stop) => {
    if (!hasCoordinates(stop?.location)) {
      return groups;
    }

    const coordinateKey = `${Number(stop.location.lat).toFixed(5)}:${Number(stop.location.lng).toFixed(5)}`;
    const existingGroup = groups.get(coordinateKey) || [];
    existingGroup.push(stop);
    groups.set(coordinateKey, existingGroup);
    return groups;
  }, new Map());

  return stops.map((stop) => {
    if (!hasCoordinates(stop?.location)) {
      return stop;
    }

    const coordinateKey = `${Number(stop.location.lat).toFixed(5)}:${Number(stop.location.lng).toFixed(5)}`;
    const overlappingStops = groupedStops.get(coordinateKey) || [];

    if (overlappingStops.length <= 1) {
      return {
        ...stop,
        displayLocation: stop.location,
      };
    }

    const stopIndex = overlappingStops.findIndex(
      (candidateStop) => candidateStop.key === stop.key
    );
    const angle = ((Math.PI * 2) / overlappingStops.length) * stopIndex;
    const baseOffset = 0.00018;
    const latitudeOffset = Math.sin(angle) * baseOffset;
    const longitudeOffset =
      (Math.cos(angle) * baseOffset) /
      Math.max(Math.cos((Number(stop.location.lat) * Math.PI) / 180), 0.25);

    return {
      ...stop,
      displayLocation: {
        lat: stop.location.lat + latitudeOffset,
        lng: stop.location.lng + longitudeOffset,
      },
    };
  });
};

const CaptainRiding = () => {
  const [finishRidePanel, setFinishRidePanel] = useState(false);
  const finishRidePanelRef = useRef(null);
  const location = useLocation();
  const [ride, setRide] = useState(location.state?.ride || null);
  const [pickupOtp, setPickupOtp] = useState('');
  const [confirmingPickup, setConfirmingPickup] = useState(false);
  const { socket } = useContext(SocketContext);
  const { captain } = useContext(CaptainDataContext);

  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [sharedRouteStopsWithLocation, setSharedRouteStopsWithLocation] = useState([]);
  const [completedStopKeys, setCompletedStopKeys] = useState([]);
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [isPassengerManifestExpanded, setIsPassengerManifestExpanded] = useState(false);
  const [isRideInfoPanelCollapsed, setIsRideInfoPanelCollapsed] = useState(false);
  const [collapsedLauncherPosition, setCollapsedLauncherPosition] = useState(() =>
    clampCollapsedLauncherPosition(getDefaultCollapsedLauncherPosition())
  );
  const [isDraggingCollapsedLauncher, setIsDraggingCollapsedLauncher] = useState(false);
  const collapsedLauncherDragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const collapsedLauncherIgnoreClickRef = useRef(false);
  const collapsedLauncherIgnoreClickTimeoutRef = useRef(null);
  const rideParticipants = useMemo(() => buildRideParticipants(ride), [ride]);
  const participantsByKey = useMemo(
    () => new Map(rideParticipants.map((participant) => [participant.key, participant])),
    [rideParticipants]
  );
  const participantsByUserId = useMemo(
    () =>
      new Map(
        rideParticipants
          .map((participant) => [participant.userId, participant])
          .filter(([participantUserId]) => participantUserId)
      ),
    [rideParticipants]
  );
  const passengerRouteStops = useMemo(
    () => buildPassengerRouteStops(rideParticipants),
    [rideParticipants]
  );
  const passengerStopGeocodeSignature = useMemo(
    () =>
      passengerRouteStops
        .map(
          (stop) =>
            `${stop.key}:${stop.type}:${stop.address}:${Number(stop.positionMeters).toFixed(2)}`
        )
        .join('||'),
    [passengerRouteStops]
  );
  const activeSharedRouteStops = useMemo(
    () =>
      sharedRouteStopsWithLocation.filter(
        (stop) => !isStopCompleted(stop, participantsByKey, completedStopKeys)
      ),
    [completedStopKeys, participantsByKey, sharedRouteStopsWithLocation]
  );
  const activeRouteWaypoints = useMemo(
    () => buildRouteWaypoints(activeSharedRouteStops, ride?.destination),
    [activeSharedRouteStops, ride?.destination]
  );
  const nextSharedStop = activeSharedRouteStops[0] || null;
  const pendingPassengerAllocations = useMemo(
    () =>
      (ride?.passengerAllocations || [])
        .filter((allocation) => allocation?.boardingStatus === 'awaiting_pickup')
        .sort((left, right) => (Number(left?.routeStartMeters) || 0) - (Number(right?.routeStartMeters) || 0)),
    [ride]
  );
  const nextPendingPassenger = pendingPassengerAllocations[0] || null;
  const nextPendingPassengerProfile = nextPendingPassenger
    ? participantsByUserId.get(String(nextPendingPassenger?.user?._id || nextPendingPassenger?.user))
    : null;
  const ownerParticipant = rideParticipants[0] || null;
  const rideInfoPanelSectionClass = isRideInfoPanelCollapsed
    ? 'fixed inset-0 z-20 pointer-events-none'
    : 'fixed bottom-3 left-3 right-3 z-20 md:left-auto md:right-6 md:bottom-6 md:w-[420px]';
  const liveMapViewport = getCaptainRideMapViewport(isRideInfoPanelCollapsed);

  useEffect(() => {
    setPickupOtp('');
  }, [nextPendingPassenger?._id, nextPendingPassenger?.user?._id, nextPendingPassenger?.pickup]);

  useCaptainLocationSharing({
    captainId: captain?._id || ride?.captain?._id,
    socket,
    isEnabled: Boolean(ride?._id),
  });

  useEffect(() => {
    if (!socket || !(captain?._id || ride?.captain?._id)) {
      return undefined;
    }

    const captainId = captain?._id || ride?.captain?._id;
    const handleConnect = () => {
      socket.emit('join', {
        userId: captainId,
        userType: 'captain',
      });
    };

    const handleRideUpdated = (updatedRide) => {
      if (!updatedRide?._id) {
        return;
      }

      setRide((currentRide) => {
        if (!currentRide || currentRide._id === updatedRide._id) {
          return updatedRide;
        }

        return currentRide;
      });
    };

    socket.on('connect', handleConnect);
    socket.on('ride-updated', handleRideUpdated);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('ride-updated', handleRideUpdated);
    };
  }, [captain?._id, ride?.captain?._id, socket]);

  useGSAP(() => {
    gsap.to(finishRidePanelRef.current, {
      y: finishRidePanel ? 0 : '100%',
      duration: 0.4,
      ease: 'power3.out',
    });
  }, [finishRidePanel]);

  useEffect(() => {
    let isCancelled = false;

    const loadRoutePoints = async () => {
      if (!ride?.pickup || !ride?.destination) {
        return;
      }

      try {
        const [pickupLocation, destinationLocation, waypointLocations] = await Promise.all([
          getMapCoordinates(ride.pickup, { role: 'captain' }),
          getMapCoordinates(ride.destination, { role: 'captain' }),
          Promise.all(
            passengerRouteStops.map(async (stop) => ({
              ...stop,
              location: await getMapCoordinates(stop.address, { role: 'captain' }),
            }))
          ),
        ]);

        if (isCancelled) {
          return;
        }

        setPickupCoords(pickupLocation);
        setDestinationCoords(destinationLocation);
        setSharedRouteStopsWithLocation(
          applyMarkerOffsetsToStops(waypointLocations.filter((stop) => stop.location))
        );
        setCompletedStopKeys([]);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error('Failed to load shared route points:', error);
        setPickupCoords(null);
        setDestinationCoords(null);
        setSharedRouteStopsWithLocation([]);
        setCompletedStopKeys([]);
      }
    };

    loadRoutePoints();

    return () => {
      isCancelled = true;
    };
  }, [passengerStopGeocodeSignature, ride?.destination, ride?.pickup]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setCollapsedLauncherPosition((currentPosition) =>
        clampCollapsedLauncherPosition(currentPosition)
      );
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isRideInfoPanelCollapsed || !isDraggingCollapsedLauncher) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      if (event.pointerId !== collapsedLauncherDragRef.current.pointerId) {
        return;
      }

      const deltaX = event.clientX - collapsedLauncherDragRef.current.startX;
      const deltaY = event.clientY - collapsedLauncherDragRef.current.startY;

      if (!collapsedLauncherDragRef.current.moved && Math.hypot(deltaX, deltaY) > 6) {
        collapsedLauncherDragRef.current.moved = true;
      }

      setCollapsedLauncherPosition(
        clampCollapsedLauncherPosition({
          x: collapsedLauncherDragRef.current.originX + deltaX,
          y: collapsedLauncherDragRef.current.originY + deltaY,
        })
      );
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== collapsedLauncherDragRef.current.pointerId) {
        return;
      }

      if (collapsedLauncherDragRef.current.moved) {
        collapsedLauncherIgnoreClickRef.current = true;

        if (collapsedLauncherIgnoreClickTimeoutRef.current) {
          window.clearTimeout(collapsedLauncherIgnoreClickTimeoutRef.current);
        }

        collapsedLauncherIgnoreClickTimeoutRef.current = window.setTimeout(() => {
          collapsedLauncherIgnoreClickRef.current = false;
        }, 0);
      }

      setIsDraggingCollapsedLauncher(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingCollapsedLauncher, isRideInfoPanelCollapsed]);

  useEffect(() => {
    return () => {
      if (
        typeof window !== 'undefined' &&
        collapsedLauncherIgnoreClickTimeoutRef.current
      ) {
        window.clearTimeout(collapsedLauncherIgnoreClickTimeoutRef.current);
      }
    };
  }, []);

  const handleCaptainPositionChange = (captainPosition) => {
    if (!captainPosition) {
      return;
    }

    if (!sharedRouteStopsWithLocation.length) {
      return;
    }

    setCompletedStopKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      sharedRouteStopsWithLocation.forEach((stop) => {
        const participant = participantsByKey.get(stop.participantKey);

        if (stop.type !== 'dropoff' || participant?.boardingStatus !== 'onboard') {
          return;
        }

        if (
          calculateDistanceInMeters(captainPosition, stop.location) <=
          SHARED_STOP_COMPLETION_RADIUS_METERS
        ) {
          nextKeys.add(stop.key);
        }
      });

      return nextKeys.size === currentKeys.length ? currentKeys : Array.from(nextKeys);
    });
  };

  const handleConfirmPassengerPickup = async () => {
    if (!ride?._id || !nextPendingPassenger || !pickupOtp.trim() || confirmingPickup) {
      return;
    }

    setConfirmingPickup(true);

    try {
      const passengerId = nextPendingPassenger?.user?._id || nextPendingPassenger?.user;
      const { data } = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/rides/confirm-passenger-pickup`,
        {
          rideId: ride._id,
          passengerId,
          otp: pickupOtp.trim(),
        },
        {
          headers: getCaptainAuthHeaders(),
        }
      );

      setRide(data);
      setPickupOtp('');
    } catch (error) {
      console.error('Failed to confirm passenger pickup:', error);
      alert(error?.response?.data?.message || 'Failed to confirm this passenger pickup.');
    } finally {
      setConfirmingPickup(false);
    }
  };

  const handleCollapsedLauncherPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    event.preventDefault();

    collapsedLauncherDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: collapsedLauncherPosition.x,
      originY: collapsedLauncherPosition.y,
      moved: false,
    };

    setIsDraggingCollapsedLauncher(true);
  };

  const handleCollapsedLauncherClick = () => {
    if (collapsedLauncherIgnoreClickRef.current) {
      return;
    }

    setIsRideInfoPanelCollapsed(false);
  };

  if (!ride) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-black px-6 text-white">
        Invalid ride data
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] w-screen overflow-hidden bg-black font-sans text-white md:h-[100svh]">
      <header className="absolute left-0 right-0 top-0 z-40 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-slate-950/84 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-300/25 bg-yellow-300/10 text-yellow-300">
              <i className="ri-steering-2-line text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-yellow-200/70">
                Captain Ride
              </p>
              <div className="flex items-center gap-2">
                <img src="/image/trippzy.png" alt="Tripzzy" className="h-6" />
                <span className="text-lg font-semibold text-white">Tripzzy</span>
              </div>
            </div>
          </div>

          <Link
            to="/captain-home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/90 text-slate-950 shadow-lg transition hover:scale-[1.03] hover:bg-yellow-300"
          >
            <i className="ri-home-5-line text-lg" />
          </Link>
        </div>
      </header>

      <section className="absolute inset-x-0 top-24 z-30 px-4 md:top-28 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/20 bg-slate-950/65 px-3.5 py-2 text-sm text-white shadow-lg backdrop-blur-md">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]" />
            Live Trip
          </div>

          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
            <span className="text-slate-400">Remaining</span>
            <span className="text-base font-semibold text-white">
              {routeMetrics?.distanceText || 'Syncing distance'}
            </span>
          </div>

          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
            <span className="text-slate-400">ETA</span>
            <span className="text-base font-semibold text-white">
              {routeMetrics?.durationText || 'Syncing ETA'}
            </span>
          </div>
        </div>
      </section>

      <div className="absolute inset-0 z-0">
        <LiveTracking
          source={pickupCoords}
          destination={destinationCoords}
          waypoints={activeRouteWaypoints}
          markerWaypoints={activeSharedRouteStops}
          authRole="captain"
          gestureHandlingMode="greedy"
          fitPadding={liveMapViewport.fitPadding}
          followPanOffset={liveMapViewport.followPanOffset}
          sourceMarker={
            ownerParticipant
              ? {
                  fillColor: '#16a34a',
                  glyph: ownerParticipant.markerLabel,
                  badgeText: 'P',
                  badgeColor: '#14532d',
                  title: `${ownerParticipant.markerLabel} pickup | ${ownerParticipant.displayName}`,
                  zIndex: 45,
                }
              : null
          }
          destinationMarker={
            ownerParticipant
              ? {
                  fillColor: '#2563eb',
                  glyph: ownerParticipant.markerLabel,
                  badgeText: 'D',
                  badgeColor: '#0f172a',
                  title: `${ownerParticipant.markerLabel} drop | ${ownerParticipant.displayName}`,
                  zIndex: 30,
                }
              : null
          }
          captainMarker={{
            fillColor: '#dc2626',
            glyph: 'C',
            title: 'Captain location',
            zIndex: 60,
          }}
          includeSourceStopWhenFollowingCaptain
          trackedCaptainId={ride?.captain?._id || captain?._id}
          followCaptain
          onDistanceDurationChange={setRouteMetrics}
          onCaptainPositionChange={handleCaptainPositionChange}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_26%),linear-gradient(180deg,_rgba(4,8,18,0.62)_0%,_rgba(4,8,18,0.16)_30%,_rgba(4,8,18,0.7)_100%)]" />
      </div>

      <section className={rideInfoPanelSectionClass}>
        {isRideInfoPanelCollapsed ? (
          <button
            type="button"
            onClick={handleCollapsedLauncherClick}
            onPointerDown={handleCollapsedLauncherPointerDown}
            aria-label="Expand ride control panel"
            title="Open ride controls"
            className={`pointer-events-auto absolute group flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-yellow-100/50 bg-yellow-300/92 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl transition duration-200 hover:border-yellow-50/80 touch-none select-none ${
              isDraggingCollapsedLauncher ? 'cursor-grabbing scale-[1.03]' : 'cursor-grab hover:scale-[1.03]'
            } md:h-20 md:w-20`}
            style={{
              left: collapsedLauncherPosition.x,
              top: collapsedLauncherPosition.y,
            }}
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.34),_transparent_58%),linear-gradient(180deg,_rgba(253,224,71,0.94)_0%,_rgba(250,204,21,0.96)_100%)]" />
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/88 text-xl text-yellow-300 shadow-lg md:h-12 md:w-12">
              <i className="ri-steering-2-line" />
            </span>
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-yellow-50/70 bg-white text-[11px] text-slate-950 shadow-lg">
              <i className="ri-arrow-up-s-line" />
            </span>
            <span className="sr-only">Expand ride control panel</span>
          </button>
        ) : (
          <div
            className="relative rounded-3xl bg-gradient-to-br from-yellow-300/90 to-yellow-400/90 px-4 pb-6 pt-5 shadow-xl backdrop-blur-xl sm:px-5 sm:pb-7 sm:pt-6 md:rounded-2xl"
            onClick={() => setFinishRidePanel(true)}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsRideInfoPanelCollapsed(true);
              }}
              aria-label="Collapse ride control panel"
              title="Hide ride controls"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/45 text-gray-900 shadow-sm transition hover:bg-white/65"
            >
              <i className="ri-close-line text-lg" />
            </button>

            {ride?.rideType === 'carpool' ? (
              <div
                className="mb-4 rounded-2xl border border-black/10 bg-black/10 px-4 py-3 text-sm text-gray-900"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800/70">
                  Shared Route Stops
                </p>
                <p className="mt-1 font-semibold">
                  {activeSharedRouteStops.length
                    ? `${activeSharedRouteStops.length} marked stop${activeSharedRouteStops.length === 1 ? '' : 's'} pending`
                    : 'All shared stops completed'}
                </p>
                {nextSharedStop ? (
                  <p className="mt-1 text-xs leading-5 text-gray-800">
                    Next {nextSharedStop.type === 'pickup' ? 'pickup' : 'drop'}: {nextSharedStop.participantLabel}
                    {' | '}
                    {nextSharedStop.participantName} at {nextSharedStop.address}
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-5 text-gray-800">
                    Every shared rider stop on the route is done.
                  </p>
                )}
              </div>
            ) : null}

            <div
              className="mb-4 rounded-2xl border border-black/10 bg-black/10 px-4 py-3 text-sm text-gray-900"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setIsPassengerManifestExpanded((currentValue) => !currentValue)}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800/70">
                    Rider Route Details
                  </p>
                  <p className="mt-1 font-semibold">
                    {rideParticipants.length} rider{rideParticipants.length === 1 ? '' : 's'} mapped to route markers
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-800">
                    Expand to check who is travelling from where to where and match A/B/C labels on the map.
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/45 text-lg text-gray-900">
                  <i
                    className={`${
                      isPassengerManifestExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                    }`}
                  />
                </span>
              </button>

              {isPassengerManifestExpanded ? (
                <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  {rideParticipants.map((participant) => (
                    <div
                      key={participant.key}
                      className="rounded-2xl border border-black/10 bg-white/35 px-3.5 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-sm">
                            {participant.markerLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-950">
                              {participant.displayName}
                            </p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-700">
                              {participant.isOwner ? 'Primary rider' : 'Shared rider'} |{' '}
                              {getParticipantStatusLabel(participant.boardingStatus)}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-black/10 bg-white/45 px-2.5 py-1 text-[11px] font-semibold text-gray-800">
                          {participant.bookedSeats} seat{participant.bookedSeats === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-black/5 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-700/80">
                            From
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-900">
                            {participant.pickup || 'Pickup pending'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-black/5 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-700/80">
                            To
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-900">
                            {participant.destination || 'Destination pending'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {nextPendingPassenger ? (
              <div
                className="mb-4 rounded-2xl border border-black/10 bg-black/10 px-4 py-3 text-sm text-gray-900"
                onClick={(event) => event.stopPropagation()}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-800/70">
                  Pending Passenger Pickup
                </p>
                <p className="mt-1 font-semibold">
                  {nextPendingPassengerProfile
                    ? `${nextPendingPassengerProfile.markerLabel} | ${nextPendingPassengerProfile.displayName}`
                    : 'Passenger awaiting pickup'}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-800">
                  Pickup: {nextPendingPassenger?.pickup || 'Pickup location pending'}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-800">
                  Drop: {nextPendingPassenger?.destination || 'Destination pending'}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-800">
                  Ask the passenger for their pickup OTP before marking them onboard.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={pickupOtp}
                    onChange={(event) => setPickupOtp(event.target.value)}
                    placeholder="Enter passenger OTP"
                    className="flex-1 rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-500"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmPassengerPickup}
                    disabled={confirmingPickup}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {confirmingPickup ? 'Confirming...' : 'Confirm Pickup'}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {formatDistanceLabel(routeMetrics)}
                </h4>
                {routeMetrics?.durationText ? (
                  <p className="text-sm text-gray-700">{routeMetrics.durationText} away</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFinishRidePanel(true);
                }}
                className="rounded-lg bg-green-700 px-5 py-2 font-semibold text-white shadow transition hover:bg-green-800"
              >
                Complete Ride
              </button>
            </div>
            <div className="text-sm text-gray-800">
              Tap above to complete your current trip.
            </div>
            <i className="ri-arrow-up-line mx-auto mt-4 block text-center text-2xl text-black" />
          </div>
        )}
      </section>

      <div
        ref={finishRidePanelRef}
        className="fixed bottom-0 left-1/2 z-50 w-[min(100vw-1rem,32rem)] -translate-x-1/2 translate-y-full rounded-t-3xl border-t border-yellow-600/20 px-4 pb-8 pt-14 text-white shadow-2xl backdrop-blur-lg sm:px-5 sm:py-10"
      >
        <FinishRide ride={ride} setRide={setRide} setFinishRidePanel={setFinishRidePanel} />
      </div>
    </div>
  );
};

export default CaptainRiding;
