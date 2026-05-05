import React from 'react';
import { getVehicleImage } from '../utils/imageAssets';

const formatGenderPreference = (value) => {
  if (value === 'female') {
    return 'Female only shared ride';
  }

  if (value === 'male') {
    return 'Men only shared ride';
  }

  return 'Any shared ride';
};

const ConfirmRide = ({
  pickup,
  destination,
  fare,
  vehicleType,
  rideType,
  availableSeats,
  genderPreference,
  selectedCarpoolRide,
  setConfirmRidePanel,
  confirmSelection,
  submittingRide,
}) => {
  const vehicleImg = getVehicleImage(vehicleType);
  const isJoiningExistingCarpool = rideType === 'carpool' && Boolean(selectedCarpoolRide?._id);
  const isFreshCarpoolRequest = rideType === 'carpool' && !isJoiningExistingCarpool;
  const isJoiningLiveCarpool = isJoiningExistingCarpool && selectedCarpoolRide?.status === 'ongoing';
  const bookedSeatCount = rideType === 'carpool' ? Math.max(1, Number(availableSeats) || 1) : 1;
  const bookedSeatLabel = `${bookedSeatCount} seat${bookedSeatCount === 1 ? '' : 's'} booked by you`;
  const displayFare = selectedCarpoolRide?.fare || fare?.requestedFare || fare?.[vehicleType] || '--';
  const displayFarePerSeat = rideType === 'carpool'
    ? selectedCarpoolRide?.farePerSeat || fare?.requestedFarePerSeat || null
    : null;
  const title = isJoiningExistingCarpool
    ? isJoiningLiveCarpool
      ? 'Reserve Seat in Live Carpool'
      : 'Join Shared Ride'
    : isFreshCarpoolRequest
      ? 'Request Fresh Shared Ride'
      : 'Confirm Your Ride';

  return (
    <div className="relative mx-auto w-full max-w-md rounded-t-3xl bg-gradient-to-b from-black via-neutral-900 to-neutral-800 px-4 pb-6 pt-8 text-white shadow-2xl">
      <div
        className="absolute left-1/2 top-3 h-1.5 w-10 -translate-x-1/2 cursor-pointer rounded-full bg-yellow-600/80"
        onClick={() => !submittingRide && setConfirmRidePanel(false)}
      />

      <h3 className="mb-6 mt-6 text-center text-2xl font-bold text-yellow-400">
        {title}
      </h3>

      <div className="space-y-6 rounded-2xl border border-yellow-600/30 bg-white/5 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-4">
          {vehicleImg && (
            <img
              src={vehicleImg}
              alt={vehicleType}
              className="h-12 w-16 rounded-md object-contain shadow-md"
            />
          )}
          <div>
            <p className="text-sm text-gray-400 capitalize">
              {isFreshCarpoolRequest ? 'Requested Vehicle' : 'Selected Vehicle'}
            </p>
            <h4 className="text-lg font-semibold capitalize text-yellow-200">
              {vehicleType || '--'}
            </h4>
          </div>
        </div>

        {rideType === 'carpool' && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-gray-400">Shared Ride Preference</p>
            <p className="mt-1 text-base font-semibold text-white">
              {formatGenderPreference(genderPreference)}
            </p>
            <p className="mt-1 text-sm text-gray-300">
              {isJoiningExistingCarpool
                ? `${selectedCarpoolRide?.availableSeats || 0} open seat${(selectedCarpoolRide?.availableSeats || 0) === 1 ? '' : 's'} in this live ride`
                : `Requesting a captain vehicle with at least ${availableSeats} open seat${availableSeats === 1 ? '' : 's'}`}
            </p>
            <p className="mt-1 text-sm font-medium text-white/90">
              {bookedSeatLabel}
            </p>
            {isJoiningExistingCarpool ? (
              <p className="mt-2 text-xs leading-5 text-cyan-100/85">
                After you join, Tripzzy will generate your ride OTP. Keep it ready and share it with the captain when your trip is about to begin.
              </p>
            ) : null}
            {isJoiningExistingCarpool ? (
              <p className="mt-2 text-xs leading-5 text-amber-200/85">
                The current trip total is divided across occupied seats in the vehicle, so your payable drops as more passengers join.
              </p>
            ) : null}
          </div>
        )}

        <div className="flex items-start gap-4">
          <i className="ri-map-pin-user-fill mt-1 text-xl text-green-400" />
          <div>
            <p className="text-sm text-gray-400">Pickup</p>
            <p className="break-words text-base font-medium text-white">{pickup}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <i className="ri-map-pin-2-fill mt-1 text-xl text-cyan-400" />
          <div>
            <p className="text-sm text-gray-400">Destination</p>
            <p className="break-words text-base font-medium text-white">{destination}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <i className="ri-wallet-3-line mt-1 text-xl text-yellow-300" />
          <div>
            <p className="text-sm text-gray-400">{isJoiningExistingCarpool ? 'Shared Fare' : 'Fare'}</p>
            <p className="text-lg font-bold text-yellow-200">
              Rs. {displayFare}
            </p>
            {displayFarePerSeat != null && rideType === 'carpool' && (
              <p className="mt-1 text-sm text-gray-400">
                Rs. {displayFarePerSeat}/seat x {bookedSeatCount} seat{bookedSeatCount === 1 ? '' : 's'}
              </p>
            )}
            {rideType === 'carpool' ? (
              <p className="mt-2 text-xs leading-5 text-cyan-100/80">
                This share updates dynamically as occupied seats change. More passengers means a lower per-seat payable.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <button
        onClick={confirmSelection}
        disabled={submittingRide}
        className="mt-8 w-full rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-300 py-3 font-bold text-black shadow-md transition-all duration-200 hover:from-yellow-500 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submittingRide
          ? 'Submitting...'
          : isJoiningExistingCarpool
            ? isJoiningLiveCarpool
              ? 'Reserve Seat'
              : 'Join This Shared Ride'
            : isFreshCarpoolRequest
              ? 'Send Fresh Shared Request'
              : 'Confirm Ride'}
      </button>
    </div>
  );
};

export default ConfirmRide;
