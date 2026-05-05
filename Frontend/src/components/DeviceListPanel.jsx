import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { getCompatibleVehicleTypes, vehicleCatalog } from '../utils/imageAssets';
import { getUserAuthHeaders } from '../utils/authStorage';

const seatOptions = [1, 2, 3, 4];

const formatPreference = (value) => {
  if (value === 'any') {
    return 'Any shared carpool';
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)} only`;
};

const formatCurrency = (value) => `Rs. ${value}`;

const formatFareBreakdown = (fareOptions, availableSeats) => {
  const compatibleVehicleTypes = getCompatibleVehicleTypes({
    rideType: 'carpool',
    requiredSeats: availableSeats,
  });

  return compatibleVehicleTypes
    .map((vehicleType) => {
      const fare = fareOptions?.[vehicleType];

      if (typeof fare !== 'number') {
        return null;
      }

      return {
        vehicleType,
        label: vehicleCatalog?.[vehicleType]?.label || vehicleType,
        fare,
      };
    })
    .filter(Boolean);
};

const formatVehicleMix = (rides) => {
  const counts = rides.reduce((accumulator, ride) => {
    accumulator[ride.vehicleType] = (accumulator[ride.vehicleType] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([vehicleType, count]) => `${count} ${vehicleType}${count > 1 ? 's' : ''}`)
    .join(' | ');
};

const LoadingCard = () => (
  <div className="rounded-[22px] border border-slate-700 bg-slate-900/80 p-4">
    <div className="animate-pulse space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-5 w-28 rounded bg-slate-700/80" />
          <div className="h-4 w-40 rounded bg-slate-800/80" />
        </div>
        <div className="h-11 w-14 rounded-xl bg-slate-800/80" />
      </div>
      <div className="h-11 rounded-xl bg-slate-800/80" />
    </div>
  </div>
);

const DeviceListPanel = ({
  pickup,
  destination,
  showDeviceList,
  availableSeats,
  setAvailableSeats,
  genderPreference,
  setVehiclePanel,
  setShowDeviceList,
  setMatchingCarpoolRides,
  setSelectedCarpoolRide,
  onRequestFreshRide,
}) => {
  const [seatBuckets, setSeatBuckets] = useState([]);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeRideConflict, setActiveRideConflict] = useState(null);
  const [requestingFreshRide, setRequestingFreshRide] = useState(false);
  const [freshFareOptions, setFreshFareOptions] = useState({});

  useEffect(() => {
    if (!showDeviceList || !pickup || !destination) {
      return;
    }

    let cancelled = false;

    const fetchCarpoolOptions = async () => {
      setLoading(true);
      setError('');
      setActiveRideConflict(null);
      setSeatBuckets([]);
      setTotalVehicles(0);
      setFreshFareOptions({});

      try {
        const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/rides/carpool-options`, {
          params: {
            pickup,
            destination,
            genderPreference,
            availableSeats,
          },
          headers: getUserAuthHeaders(),
        });

        if (cancelled) {
          return;
        }

        setSeatBuckets(data?.seatBuckets || []);
        setTotalVehicles(data?.totalVehicles || 0);
        setActiveRideConflict(data?.activeRideConflict || null);

        if (!data?.activeRideConflict?.hasActiveRide && (data?.seatBuckets || []).length === 0) {
          const fareResponse = await axios.get(`${import.meta.env.VITE_BASE_URL}/rides/carPoolFare`, {
            params: {
              pickup,
              destination,
              availableSeats,
              rideType: 'carpool',
            },
            headers: getUserAuthHeaders(),
          });

          if (!cancelled) {
            setFreshFareOptions(fareResponse.data || {});
          }
        }
      } catch (err) {
        console.error('Error loading nearby carpools:', err);
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Unable to load nearby carpool vehicles right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCarpoolOptions();

    return () => {
      cancelled = true;
    };
  }, [availableSeats, destination, genderPreference, pickup, showDeviceList]);

  const cards = useMemo(() => {
    if (!loading) {
      return seatBuckets;
    }

    if (seatBuckets.length > 0) {
      return seatBuckets;
    }

    return [1, 2, 3].map((value) => ({ availableSeats: value, loading: true }));
  }, [loading, seatBuckets]);

  const openSeatBucket = (bucket) => {
    setMatchingCarpoolRides(bucket.rides || []);
    setSelectedCarpoolRide(null);
    setShowDeviceList(false);
    setVehiclePanel(true);
  };

  const handleFreshRideRequest = async () => {
    if (!onRequestFreshRide || requestingFreshRide || !freshFareReady) {
      return;
    }

    setRequestingFreshRide(true);

    try {
      await onRequestFreshRide({
        fareOptions: freshFareOptions,
      });
    } catch (err) {
      console.error('Error sending a fresh shared ride request:', err);
      setError(err?.response?.data?.message || 'Unable to send a fresh shared ride request right now.');
    } finally {
      setRequestingFreshRide(false);
    }
  };

  const freshRideLabel = genderPreference === 'any'
    ? 'Request a fresh shared ride'
    : `Request a fresh ${formatPreference(genderPreference).toLowerCase()} ride`;
  const hasActiveRideConflict = Boolean(activeRideConflict?.hasActiveRide);
  const freshFareReady = Object.keys(freshFareOptions || {}).length > 0;
  const requestedFare = typeof freshFareOptions?.requestedFare === 'number'
    ? freshFareOptions.requestedFare
    : null;
  const requestedFarePerSeat = typeof freshFareOptions?.requestedFarePerSeat === 'number'
    ? freshFareOptions.requestedFarePerSeat
    : null;
  const compatibleFareBreakdown = useMemo(
    () => formatFareBreakdown(freshFareOptions, availableSeats),
    [freshFareOptions, availableSeats]
  );
  const hasSingleCompatibleSharedVehicle = compatibleFareBreakdown.length === 1;
  const estimateMinFare = compatibleFareBreakdown.length
    ? Math.min(...compatibleFareBreakdown.map((entry) => entry.fare))
    : requestedFare;
  const estimateMaxFare = compatibleFareBreakdown.length
    ? Math.max(...compatibleFareBreakdown.map((entry) => entry.fare))
    : requestedFare;
  const seatSummary = `${availableSeats} seat${availableSeats === 1 ? '' : 's'}`;
  const shouldUseTwoColumnSeatBuckets = cards.length > 1;

  return (
    <div className="w-full rounded-[28px] border border-slate-700/80 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.07),_transparent_22%),linear-gradient(180deg,_#0f172a_0%,_#0a1220_100%)] p-3 text-white shadow-2xl md:p-3.5">
      <button
        className="absolute top-3 left-1/2 -translate-x-1/2 text-slate-400 transition hover:text-amber-300"
        onClick={() => setShowDeviceList(false)}
      >
        <i className="ri-arrow-down-wide-line text-2xl" />
      </button>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-full sm:max-w-[74%]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
            Shared Carpool
          </p>
          <h3 className="mt-1 text-[1.42rem] font-bold leading-tight text-white">
            Choose seats, then view matching vehicles
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            Nearby carpools are grouped by open seats and include rides whose route overlaps your trip while keeping pickup and drop detours within roughly 1 km.
          </p>
        </div>

        <div className="shrink-0 rounded-xl border border-amber-400/20 bg-amber-400/10 px-2.5 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Nearby</p>
          <p className="text-sm font-semibold text-white">{totalVehicles} match{totalVehicles === 1 ? '' : 'es'}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Carpool Type</p>
          <p className="mt-1 font-medium text-white">{formatPreference(genderPreference)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Your Request</p>
          <p className="mt-1 font-medium text-white">{seatSummary} booked by you</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Flow</p>
          <p className="mt-1 font-medium text-white">Seats first, vehicle next</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {!loading && !error && seatBuckets.length === 0 && (
        <div className="mt-4 rounded-[22px] border border-slate-700 bg-slate-900/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-left">
              <p className="text-base font-semibold text-white">
                {hasActiveRideConflict ? 'You already have a live trip' : 'No nearby shared vehicles'}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {hasActiveRideConflict
                  ? `This rider account already has a ${activeRideConflict?.rideType === 'carpool' ? 'shared' : 'live'} ride in ${activeRideConflict?.status || 'progress'}. Open that trip instead of starting another one.`
                  : `No ${formatPreference(genderPreference).toLowerCase()} matches were found with enough shared route overlap and a small pickup detour right now. You can still send a fresh shared request.`}
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Selected</p>
              <p className="text-base font-semibold text-white">{seatSummary}</p>
            </div>
          </div>

          {hasActiveRideConflict ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
              {activeRideConflict?.viewerRole === 'owner' && activeRideConflict?.rideType === 'carpool'
                ? 'Your own shared ride is intentionally excluded from joinable matches. If you want to test carpool joining, sign in with a different rider account.'
                : 'This account is already attached to an active ride, so Tripzzy is blocking new shared requests until that trip finishes.'}
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/65 px-3.5 py-3.5">
                <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Seats Needed</p>
                    <p className="mt-1 text-sm text-slate-300">Pick your seat count and we will notify nearby captains directly.</p>
                  </div>
                  <p className="text-xs font-medium text-slate-400">{formatPreference(genderPreference)}</p>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2">
                  {seatOptions.map((seat) => {
                    const isSelected = availableSeats === seat;

                    return (
                      <button
                        key={seat}
                        onClick={() => setAvailableSeats(seat)}
                        className={`rounded-xl border px-3 py-2.5 text-center transition ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/10'
                            : 'border-white/10 bg-slate-900/80 text-white hover:border-slate-500 hover:bg-slate-800'
                        }`}
                      >
                        <span className="block text-sm font-semibold">{seat}</span>
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.18em]">
                          Seat{seat === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/80 px-3.5 py-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="text-left">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Fresh Shared Request</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {seatSummary} | {formatPreference(genderPreference)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      First captain to accept gets this trip. No extra vehicle-selection step will open after this.
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-amber-200/80">
                      Route total stays fixed for this trip. Only the per-seat split changes as occupied seats change.
                    </p>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Estimate</p>
                    <p className="mt-1 text-sm font-semibold text-amber-300">
                      {freshFareReady && estimateMinFare != null
                        ? compatibleFareBreakdown.length > 1
                          ? `${formatCurrency(estimateMinFare)} - ${formatCurrency(estimateMaxFare)}`
                          : formatCurrency(estimateMinFare)
                        : 'Preparing...'}
                    </p>
                    {freshFareReady && requestedFarePerSeat != null && hasSingleCompatibleSharedVehicle && (
                      <p className="mt-1 text-[11px] text-slate-400">{formatCurrency(requestedFarePerSeat)}/seat</p>
                    )}
                  </div>
                </div>
                {compatibleFareBreakdown.length > 1 && (
                  <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Shared Vehicle Fares</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      {compatibleFareBreakdown.map((entry) => `${entry.label} ${formatCurrency(entry.fare)}`).join(' | ')}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-amber-200/80">
                      Final trip total locks to the vehicle that accepts this request, then that amount is re-split across occupied seats as more riders join.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleFreshRideRequest}
                disabled={requestingFreshRide || !freshFareReady}
                className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-200"
              >
                {requestingFreshRide
                  ? 'Sending your request to nearby captains...'
                  : !freshFareReady
                    ? 'Preparing vehicle fares...'
                    : freshRideLabel}
              </button>
            </>
          )}
        </div>
      )}

      <div className={`mt-3 grid gap-2.5 ${shouldUseTwoColumnSeatBuckets ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
        {cards.map((bucket, index) => {
          if (bucket.loading) {
            return <LoadingCard key={index} />;
          }

          const isSelected = availableSeats === bucket.availableSeats;
          const lowestFare = Math.min(...bucket.rides.map((ride) => ride.fare));
          const shouldSpanFullWidth =
            shouldUseTwoColumnSeatBuckets && cards.length % 2 === 1 && index === cards.length - 1;

          return (
            <button
              key={bucket.availableSeats}
              onClick={() => openSeatBucket(bucket)}
              className={`rounded-[22px] border p-4 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-amber-400 bg-slate-800 shadow-lg shadow-amber-400/10'
                  : 'border-slate-700 bg-slate-900/90 hover:border-slate-500 hover:bg-slate-800/90'
              } ${shouldSpanFullWidth ? 'md:col-span-2' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[1.02rem] font-semibold leading-tight text-white">
                    Vehicle has {bucket.availableSeats} open seat{bucket.availableSeats === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {bucket.nearbyVehicleCount} nearby vehicle{bucket.nearbyVehicleCount === 1 ? '' : 's'} for this route
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Your booking request stays at {seatSummary}.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">From</p>
                  <p className="text-base font-semibold text-white">{formatCurrency(lowestFare)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Vehicle Mix</p>
                <p className="mt-1 text-sm text-slate-200">{formatVehicleMix(bucket.rides)}</p>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Tap to see the exact nearby vehicles</span>
                <span className={`font-semibold ${isSelected ? 'text-amber-200' : 'text-slate-200'}`}>
                  {isSelected ? 'Selected' : 'View vehicles'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DeviceListPanel;
