import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { profileImages } from '../utils/imageAssets';
import { getCaptainAuthHeaders } from '../utils/authStorage';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

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

const getParticipantStatusLabel = (status, isOwner) => {
  if (isOwner && status !== 'completed') {
    return 'Final rider';
  }

  switch (status) {
    case 'awaiting_pickup':
      return 'Awaiting pickup';
    case 'onboard':
      return 'Onboard';
    case 'completed':
      return 'Completed';
    default:
      return 'In trip';
  }
};

const buildFinishParticipants = (ride) => {
  const ownerRouteEndMeters = Number(ride?.ownerAllocation?.routeEndMeters);
  const owner = {
    key: `owner-${ride?.user?._id || ride?.user || 'primary'}`,
    participantId: ride?.user?._id || ride?.user || null,
    markerLabel: getParticipantMarkerLabel(0),
    displayName: buildParticipantName(ride?.user, 'Primary rider'),
    pickup: ride?.pickup || '',
    destination: ride?.destination || '',
    fare: ride?.ownerAllocation?.fare ?? ride?.fare,
    bookedSeats: Math.max(1, Number(ride?.bookedSeats) || 1),
    boardingStatus: ride?.status === 'completed' ? 'completed' : 'onboard',
    routeEndMeters: Number.isFinite(ownerRouteEndMeters) ? ownerRouteEndMeters : Number.MAX_SAFE_INTEGER,
    isOwner: true,
  };

  const passengers = Array.isArray(ride?.passengerAllocations)
    ? ride.passengerAllocations.map((allocation, index) => ({
        key: `passenger-${allocation?.user?._id || allocation?.user || index}`,
        participantId: allocation?.user?._id || allocation?.user || null,
        markerLabel: getParticipantMarkerLabel(index + 1),
        displayName: buildParticipantName(allocation?.user, `Shared rider ${index + 1}`),
        pickup: allocation?.pickup || '',
        destination: allocation?.destination || '',
        fare: allocation?.fare,
        bookedSeats: Math.max(1, Number(allocation?.bookedSeats) || 1),
        boardingStatus: allocation?.boardingStatus || 'awaiting_pickup',
        routeEndMeters: Number(allocation?.routeEndMeters) || 0,
        isOwner: false,
      }))
    : [];

  return [owner, ...passengers].sort((left, right) => {
    if (left.routeEndMeters !== right.routeEndMeters) {
      return left.routeEndMeters - right.routeEndMeters;
    }

    if (left.isOwner === right.isOwner) {
      return 0;
    }

    return left.isOwner ? 1 : -1;
  });
};

const FinishRide = ({ ride, setRide, setFinishRidePanel }) => {
  const navigate = useNavigate();
  const [pendingActionKey, setPendingActionKey] = useState('');
  const rideParticipants = useMemo(() => buildFinishParticipants(ride), [ride]);
  const pendingSharedParticipants = rideParticipants.filter(
    (participant) => !participant.isOwner && participant.boardingStatus !== 'completed'
  );

  const completeEntireRide = async () => {
    const response = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/rides/end-ride`,
      { rideId: ride._id },
      {
        headers: getCaptainAuthHeaders(),
      }
    );

    if (response.status === 200) {
      setRide?.(response.data);
      navigate('/captain-home');
    }
  };

  const completePassengerRide = async (participantId) => {
    const response = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/rides/complete-passenger-dropoff`,
      {
        rideId: ride._id,
        passengerId: participantId,
      },
      {
        headers: getCaptainAuthHeaders(),
      }
    );

    if (response.status === 200) {
      setRide?.(response.data);
    }
  };

  const handleCompleteParticipant = async (participant) => {
    if (!participant || !ride?._id) {
      return;
    }

    setPendingActionKey(participant.key);

    try {
      if (participant.isOwner) {
        await completeEntireRide();
        return;
      }

      await completePassengerRide(participant.participantId);
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          (participant.isOwner ? 'Failed to finish ride' : 'Failed to complete this rider trip')
      );
      console.error(err);
    } finally {
      setPendingActionKey('');
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-xl rounded-t-3xl border border-yellow-600/20 bg-gradient-to-b from-neutral-900 via-black to-neutral-900 px-5 pb-6 pt-8 text-white shadow-2xl backdrop-blur-md">
      <div
        onClick={() => setFinishRidePanel(false)}
        className="absolute left-1/2 top-3 h-1.5 w-10 -translate-x-1/2 cursor-pointer rounded-full bg-gray-500/40"
      />

      <h3 className="mb-2 text-center text-2xl font-bold text-yellow-400">
        Finish This Ride
      </h3>
      <p className="mb-6 text-center text-sm text-slate-400">
        Complete each rider separately from this panel.
      </p>

      <div className="max-h-[65svh] space-y-4 overflow-y-auto pr-1">
        {rideParticipants.map((participant) => {
          const isCompleted = participant.boardingStatus === 'completed';
          const isAwaitingPickup = participant.boardingStatus === 'awaiting_pickup';
          const ownerBlocked = participant.isOwner && pendingSharedParticipants.length > 0;
          const isDisabled =
            isCompleted ||
            isAwaitingPickup ||
            ownerBlocked ||
            pendingActionKey === participant.key;

          let actionLabel = 'Complete Ride';

          if (pendingActionKey === participant.key) {
            actionLabel = 'Processing...';
          } else if (isCompleted) {
            actionLabel = 'Completed';
          } else if (isAwaitingPickup) {
            actionLabel = 'Awaiting Pickup';
          } else if (ownerBlocked) {
            actionLabel = 'Complete Others First';
          }

          return (
            <div
              key={participant.key}
              className="rounded-[26px] border border-yellow-700/10 bg-yellow-200/5 p-4 shadow-inner"
            >
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-yellow-600/30 bg-yellow-400/10 p-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative">
                    <img
                      className="h-12 w-12 rounded-full object-cover shadow-md"
                      src={profileImages.user}
                      alt={participant.displayName}
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-yellow-300/30 bg-slate-950 text-xs font-bold text-yellow-300">
                      {participant.markerLabel}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate text-lg font-semibold capitalize text-white">
                      {participant.displayName}
                    </h4>
                    <p className="text-xs uppercase tracking-[0.16em] text-yellow-200/80">
                      {participant.isOwner ? 'Primary Rider' : 'Shared Rider'} |{' '}
                      {getParticipantStatusLabel(participant.boardingStatus, participant.isOwner)}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                  {participant.bookedSeats} seat{participant.bookedSeats === 1 ? '' : 's'}
                </div>
              </div>

              <div className="space-y-5 rounded-2xl border border-yellow-700/10 bg-white/[0.03] p-5 shadow-inner">
                <div className="flex items-start gap-3">
                  <i className="ri-map-pin-user-fill mt-1 text-xl text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">Pickup</p>
                    <p className="break-words text-base font-medium text-white">
                      {participant.pickup || 'Pickup pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <i className="ri-map-pin-2-fill mt-1 text-xl text-red-400" />
                  <div>
                    <p className="text-sm text-gray-400">Destination</p>
                    <p className="break-words text-base font-medium text-white">
                      {participant.destination || 'Destination pending'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <i className="ri-wallet-3-line mt-1 text-xl text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">Fare</p>
                    <p className="text-lg font-bold text-yellow-200">
                      {formatCurrency(participant.fare)}
                    </p>
                  </div>
                </div>

                {ownerBlocked ? (
                  <p className="text-sm text-amber-200/85">
                    Finish all shared riders first, then complete the final rider.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleCompleteParticipant(participant)}
                disabled={isDisabled}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-3 font-bold text-white shadow-md transition-all duration-200 hover:from-green-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {actionLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FinishRide;
