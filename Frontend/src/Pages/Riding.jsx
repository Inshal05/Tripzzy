import React, { useEffect, useContext, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { SocketContext } from '../context/SocketContext';
import { UserDataContext } from '../context/UserContext';
import LiveTracking from '../components/LiveTracking';
import { getVehicleImage } from '../utils/imageAssets';
import { getMapCoordinates } from '../utils/mapApi';
import { getUserAuthHeaders, getUserToken } from '../utils/authStorage';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatVehicleSummary = (vehicle = {}) => {
  const parts = [vehicle.color, vehicle.vehicleType].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Vehicle details unavailable';
};

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

const getRiderTripMapViewport = (isCaptainPanelCollapsed) => {
  if (typeof window === 'undefined') {
    return {
      fitPadding: 96,
      followPanOffset: [0, 0],
    };
  }

  const isDesktop = window.innerWidth >= 768;

  if (isDesktop) {
    return {
      fitPadding: isCaptainPanelCollapsed
        ? { top: 180, right: 72, bottom: 72, left: 72 }
        : { top: 180, right: 520, bottom: 88, left: 72 },
      followPanOffset: [0, 0],
    };
  }

  return {
    fitPadding: isCaptainPanelCollapsed
      ? { top: 170, right: 24, bottom: 96, left: 24 }
      : { top: 170, right: 24, bottom: 360, left: 24 },
    followPanOffset: [0, 0],
  };
};

const Riding = () => {
  const location = useLocation();
  const { ride: initialRide } = location.state || {};
  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);
  const navigate = useNavigate();
  const authToken = getUserToken();

  const [ride, setRide] = useState(initialRide || null);
  const [pickup, setPickup] = useState(null);
  const [drop, setDrop] = useState(null);
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [rideCompleted, setRideCompleted] = useState(initialRide?.status === 'completed');
  const [isCaptainPanelCollapsed, setIsCaptainPanelCollapsed] = useState(false);
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

  const displayPickup = ride?.viewerPickup || ride?.pickup;
  const displayDestination = ride?.viewerDestination || ride?.destination;
  const displayFare = ride?.viewerFare ?? ride?.fare;
  const displayFarePerSeat = ride?.viewerFarePerSeat ?? ride?.farePerSeat;
  const bookedSeatCount = Math.max(1, Number(ride?.viewerBookedSeats ?? ride?.bookedSeats) || 1);
  const bookedSeatLabel = `${bookedSeatCount} seat${bookedSeatCount === 1 ? '' : 's'} booked`;
  const tripModeLabel = ride?.rideType === 'carpool' ? 'Shared Ride' : 'Private Ride';
  const captainName = ride?.captain?.fullname?.firstname || 'Assigned captain';
  const vehicleSummary = formatVehicleSummary(ride?.captain?.vehicle);
  const vehiclePlate = ride?.captain?.vehicle?.plate || 'Plate unavailable';
  const routeEta = routeMetrics?.durationText || 'Syncing ETA';
  const routeDistance = routeMetrics?.distanceText || 'Syncing distance';
  const sharedPricingCopy = ride?.rideType === 'carpool'
    ? 'This ride total is divided across the occupied seats in the vehicle, and your payable updates automatically as seat occupancy changes.'
    : 'Your live route, captain, and payable amount stay visible here while the map remains front and center.';
  const captainPanelSectionClass = isCaptainPanelCollapsed
    ? 'fixed inset-0 z-30 pointer-events-none'
    : 'absolute inset-x-0 bottom-0 z-30 px-3 pb-3 md:inset-x-auto md:right-6 md:top-[9.75rem] md:bottom-6 md:w-[26.5rem] md:px-0 md:pb-0';
  const liveMapViewport = getRiderTripMapViewport(isCaptainPanelCollapsed);

  useEffect(() => {
    let cancelled = false;

    const loadRouteEndpoints = async () => {
      if (!displayPickup || !displayDestination) {
        setPickup(null);
        setDrop(null);
        return;
      }

      try {
        const [nextPickup, nextDrop] = await Promise.all([
          getMapCoordinates(displayPickup),
          getMapCoordinates(displayDestination),
        ]);

        if (cancelled) {
          return;
        }

        setPickup(nextPickup);
        setDrop(nextDrop);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Geocoding failed for riding view:', error);
        setPickup(null);
        setDrop(null);
      }
    };

    loadRouteEndpoints();

    return () => {
      cancelled = true;
    }
  }, [displayDestination, displayPickup]);

  useEffect(() => {
    if (!socket || !user?._id) {
      return undefined;
    }

    const handleJoin = () => {
      socket.emit('join', { userType: 'user', userId: user._id });
    };

    socket.on('connect', handleJoin);

    if (socket.connected) {
      handleJoin();
    }

    return () => {
      socket.off('connect', handleJoin);
    };
  }, [socket, user?._id]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleRideUpdated = (updatedRide) => {
      if (!updatedRide?._id) {
        return;
      }

      if (updatedRide.status === 'completed') {
        setRideCompleted(true);
      }

      setRide((currentRide) => {
        if (!currentRide || currentRide._id === updatedRide._id) {
          return updatedRide;
        }

        return currentRide;
      });
    };

    const listener = (completedRide) => {
      setRide(completedRide || ((currentRide) => currentRide));
      setRideCompleted(true);
      setRouteMetrics(null);
    };

    socket.on('ride-updated', handleRideUpdated);
    socket.on('ride-ended', listener);

    return () => {
      socket.off('ride-updated', handleRideUpdated);
      socket.off('ride-ended', listener);
    };
  }, [socket]);

  useEffect(() => {
    if (!ride?._id || !authToken) {
      return undefined;
    }

    let cancelled = false;

    const syncRideStatus = async () => {
      try {
        const { data: latestRide } = await axios.get(`${import.meta.env.VITE_BASE_URL}/rides/status`, {
          params: { rideId: ride._id },
          headers: getUserAuthHeaders(),
        });

        if (cancelled || !latestRide?._id) {
          return;
        }

        setRide(latestRide);
        setRideCompleted(latestRide.status === 'completed');
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error('Error syncing live ride status:', error);
      }
    };

    syncRideStatus();
    const intervalId = window.setInterval(syncRideStatus, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authToken, ride?._id]);

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
    if (!isCaptainPanelCollapsed || !isDraggingCollapsedLauncher) {
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
  }, [isCaptainPanelCollapsed, isDraggingCollapsedLauncher]);

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

    setIsCaptainPanelCollapsed(false);
  };

  if (!ride) {
    return (
        <div className="flex min-h-[100svh] items-center justify-center bg-[#08111f] px-6 text-white">
          Invalid Ride Data
        </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#08111f] text-white md:h-[100svh]">
      <div className="absolute inset-0">
        <LiveTracking
          source={pickup}
          destination={drop}
          trackedCaptainId={ride?.captain?._id || ride?.captain}
          followCaptain
          gestureHandlingMode="greedy"
          fitPadding={liveMapViewport.fitPadding}
          followPanOffset={liveMapViewport.followPanOffset}
          followZoom={15}
          followAnimationDuration={900}
          refitOnTrackedCaptainMove={false}
          routeRefreshIntervalMs={8000}
          routeRefreshDistanceMeters={75}
          keepPreviousRouteOnError
          onDistanceDurationChange={setRouteMetrics}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_26%),linear-gradient(180deg,_rgba(4,8,18,0.62)_0%,_rgba(4,8,18,0.16)_30%,_rgba(4,8,18,0.7)_100%)]" />
      </div>

      <header className="absolute left-0 right-0 top-0 z-40 px-4 pt-4 md:px-6 md:pt-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-slate-950/72 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-300">
              <i className="ri-road-map-line text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                Trip In Progress
              </p>
              <div className="flex items-center gap-2">
                <img src="/image/trippzy.png" alt="Tripzzy" className="h-6" />
                <span className="text-lg font-semibold text-white">Tripzzy</span>
              </div>
            </div>
          </div>

          <Link
            to="/home"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/90 text-slate-950 shadow-lg transition hover:scale-[1.03] hover:bg-amber-300"
          >
            <i className="ri-home-5-line text-lg" />
          </Link>
        </div>
      </header>

      <section className="absolute inset-x-0 top-24 z-30 px-4 md:top-28 md:px-6 md:pr-[27.5rem] lg:pr-[29rem]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-slate-950/65 px-3.5 py-2 text-sm text-white shadow-lg backdrop-blur-md">
            <span
              className={`h-2.5 w-2.5 rounded-full shadow-[0_0_14px_rgba(74,222,128,0.9)] ${
                rideCompleted ? 'bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.9)]' : 'bg-emerald-400'
              }`}
            />
            {rideCompleted ? 'Ride Completed' : tripModeLabel}
          </div>

          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
            <span className="text-slate-400">ETA</span>
            <span className="text-base font-semibold text-white">{rideCompleted ? 'Completed' : routeEta}</span>
          </div>

          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
            <span className="text-slate-400">Remaining</span>
            <span className="text-base font-semibold text-white">{rideCompleted ? '0 km' : routeDistance}</span>
          </div>

          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm shadow-lg backdrop-blur-md">
            <span className="text-slate-400">Payable</span>
            <span className="text-base font-semibold text-amber-300">{formatCurrency(displayFare)}</span>
          </div>
        </div>
      </section>

      <section className={captainPanelSectionClass}>
        {isCaptainPanelCollapsed ? (
          <button
            type="button"
            onClick={handleCollapsedLauncherClick}
            onPointerDown={handleCollapsedLauncherPointerDown}
            aria-label="Expand captain info panel"
            title="Open captain info"
            className={`pointer-events-auto absolute group flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-amber-300/35 bg-slate-950/80 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-200 hover:border-amber-300/60 touch-none select-none ${
              isDraggingCollapsedLauncher ? 'cursor-grabbing scale-[1.03]' : 'cursor-grab hover:scale-[1.03]'
            } md:h-20 md:w-20`}
            style={{
              left: collapsedLauncherPosition.x,
              top: collapsedLauncherPosition.y,
            }}
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_58%),linear-gradient(180deg,_rgba(15,23,42,0.96)_0%,_rgba(2,6,23,0.98)_100%)]" />
            <img
              src={getVehicleImage(ride?.captain?.vehicle?.vehicleType)}
              alt={ride?.captain?.vehicle?.vehicleType || 'Vehicle'}
              className="relative h-8 w-8 object-contain transition duration-200 group-hover:scale-110 md:h-10 md:w-10"
            />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300 text-[11px] text-slate-950 shadow-lg">
              <i className="ri-arrow-up-s-line" />
            </span>
            <span className="sr-only">Expand captain info panel</span>
          </button>
        ) : (
          <div className="max-h-[76svh] w-full overflow-hidden rounded-[30px] border border-amber-400/18 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.08),_transparent_26%),linear-gradient(180deg,_rgba(11,18,33,0.97)_0%,_rgba(5,10,22,0.98)_100%)] shadow-[0_30px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl md:h-full md:max-h-none">
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-300/75 to-transparent" />

            <div className="flex min-h-0 max-h-[76svh] flex-col md:h-full md:max-h-none">
              <div className="border-b border-white/10 p-5 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-300/25 bg-amber-300/12">
                        <img
                          src={getVehicleImage(ride?.captain?.vehicle?.vehicleType)}
                          alt={ride?.captain?.vehicle?.vehicleType || 'Vehicle'}
                          className="h-10 w-10 object-contain"
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">
                          Your Captain
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold capitalize text-white">
                          {captainName}
                        </h2>
                        <p className="mt-1 text-sm text-slate-400">{vehicleSummary}</p>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-left sm:text-right">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Payable</p>
                      <p className="mt-1 text-2xl font-bold text-amber-300">{formatCurrency(displayFare)}</p>
                      {ride?.rideType === 'carpool' && displayFarePerSeat != null ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {formatCurrency(displayFarePerSeat)}/seat | {bookedSeatLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCaptainPanelCollapsed(true)}
                    aria-label="Collapse captain info panel"
                    title="Hide captain info"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition duration-200 hover:border-amber-300/35 hover:bg-amber-300/10 hover:text-amber-200"
                  >
                    <i className="ri-close-line text-lg" />
                  </button>
                </div>
              </div>

              {rideCompleted ? (
                <div className="flex-1 overflow-y-auto p-5 md:p-6">
                  <div className="rounded-[28px] border border-emerald-400/25 bg-emerald-400/10 p-5 shadow-[0_18px_48px_rgba(16,185,129,0.08)]">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                        <i className="ri-checkbox-circle-fill text-2xl" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/75">Trip Status</p>
                        <h3 className="mt-1 text-2xl font-bold text-white">Ride is completed</h3>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                          Your captain has finished this trip. You can head back to the home page for your next booking.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/38 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300/12 text-amber-300">
                          <i className="ri-map-pin-user-fill text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pickup</p>
                          <p className="mt-1 break-words text-sm font-medium leading-6 text-white">{displayPickup}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-slate-950/38 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-300">
                          <i className="ri-map-pin-2-fill text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Destination</p>
                          <p className="mt-1 break-words text-sm font-medium leading-6 text-white">{displayDestination}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Ride Mode</p>
                        <p className="mt-1 text-sm font-semibold text-white">{tripModeLabel}</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Fare</p>
                        <p className="mt-1 text-sm font-semibold text-amber-300">{formatCurrency(displayFare)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-6">
                    <div className="rounded-[24px] border border-white/10 bg-slate-950/38 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300/12 text-amber-300">
                          <i className="ri-map-pin-user-fill text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pickup</p>
                          <p className="mt-1 break-words text-sm font-medium leading-6 text-white">{displayPickup}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-slate-950/38 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-300">
                          <i className="ri-map-pin-2-fill text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Destination</p>
                          <p className="mt-1 break-words text-sm font-medium leading-6 text-white">{displayDestination}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Ride Mode</p>
                        <p className="mt-1 text-sm font-semibold text-white">{tripModeLabel}</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Plate</p>
                        <p className="mt-1 text-sm font-semibold text-amber-300">{vehiclePlate}</p>
                      </div>

                      {ride?.rideType === 'carpool' ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Booked Seats</p>
                          <p className="mt-1 text-sm font-semibold text-white">{bookedSeatLabel}</p>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Remaining</p>
                        <p className="mt-1 text-sm font-semibold text-white">{routeDistance}</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">ETA</p>
                        <p className="mt-1 text-sm font-semibold text-white">{routeEta}</p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-amber-300/18 bg-amber-300/8 p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-300/15 text-amber-100">
                          <i className="ri-route-line text-lg" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/70">
                            {ride?.rideType === 'carpool' ? 'Shared Pricing Summary' : 'Trip Summary'}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-amber-50">{sharedPricingCopy}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-5 md:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                      <span className="text-sm text-slate-400">Status</span>
                      <span className="text-sm font-semibold text-emerald-300">Ready to pay</span>
                    </div>

                    <button className="w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 py-3.5 text-base font-bold text-slate-950 shadow-[0_18px_34px_rgba(251,191,36,0.18)] transition duration-200 hover:brightness-105">
                      Confirm Payment
                    </button>
                  </div>
                </>
              )}

              {rideCompleted ? (
                <div className="border-t border-white/10 p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                    <span className="text-sm text-emerald-100/80">Status</span>
                    <span className="text-sm font-semibold text-emerald-300">Completed</span>
                  </div>

                  <button
                    onClick={() => navigate('/home')}
                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 py-3.5 text-base font-bold text-slate-950 shadow-[0_18px_34px_rgba(52,211,153,0.18)] transition duration-200 hover:brightness-105"
                  >
                    Back to Home
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Riding;
