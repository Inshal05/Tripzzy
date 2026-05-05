import React from 'react';
import { getVehicleImage } from '../utils/imageAssets';

const formatPreference = (value) => {
  if (value === 'female') {
    return 'Female only';
  }

  if (value === 'male') {
    return 'Men only';
  }

  return 'Any shared';
};

const formatCurrency = (value) => `Rs. ${value}`;

const LookingForDriver = ({
  pickup,
  destination,
  fare,
  ride,
  vehicleType,
  rideType,
  availableSeats,
  genderPreference,
  setVehicleFound,
}) => {
  const vehicleImg = getVehicleImage(vehicleType);
  const isSharedRide = rideType === 'carpool';
  const bookedSeatCount = Math.max(1, Number(ride?.viewerBookedSeats ?? availableSeats) || 1);
  const bookedSeatLabel = `${bookedSeatCount} seat${bookedSeatCount === 1 ? '' : 's'} booked`;
  const compatibleSharedFareBreakdown = isSharedRide && ride?.allowAnyVehicleType
    ? [ 'auto', 'car' ]
        .map((type) => {
          const nextFare = fare?.[type];
          return typeof nextFare === 'number' ? nextFare : null;
        })
        .filter((value) => value != null)
    : [];
  const hasFlexibleSharedFareRange = compatibleSharedFareBreakdown.length > 1 && !ride?.captain;
  const displayFare = typeof ride?.viewerFare === 'number'
    ? ride.viewerFare
    : hasFlexibleSharedFareRange
      ? null
    : typeof ride?.fare === 'number'
      ? ride.fare
      : typeof fare?.requestedFare === 'number'
        ? fare.requestedFare
        : vehicleType
          ? fare?.[vehicleType]
          : null;
  const displayFarePerSeat = typeof ride?.viewerFarePerSeat === 'number'
    ? ride.viewerFarePerSeat
    : typeof ride?.farePerSeat === 'number'
      ? ride.farePerSeat
      : typeof fare?.requestedFarePerSeat === 'number'
        ? fare.requestedFarePerSeat
        : null;
  const displayPickup = ride?.viewerPickup || pickup;
  const displayDestination = ride?.viewerDestination || destination;

  return (
    <div className="relative mx-auto h-full w-full max-w-md rounded-3xl border border-[#2c2e4a] bg-gradient-to-br from-[#1b1c2e] via-[#1f2137] to-[#1b1c2e] px-6 py-8 text-white shadow-2xl">
      <div
        className="absolute left-1/2 top-3 -translate-x-1/2 cursor-pointer"
        onClick={() => setVehicleFound(false)}
      >
        <i className="ri-arrow-down-wide-line text-3xl text-gray-400 transition-all hover:text-yellow-300" />
      </div>

      <h2 className="mb-6 mt-6 text-center text-2xl font-bold tracking-wide text-yellow-400">
        {isSharedRide ? 'Request Sent to Nearby Captains' : 'Searching for a Driver...'}
      </h2>

      {vehicleImg ? (
        <div className="mb-5 flex justify-center">
          <img
            src={vehicleImg}
            alt={vehicleType}
            className="h-24 rounded-xl border border-slate-700 shadow-md"
          />
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-4 text-center">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-400">Shared Vehicle</p>
          <p className="mt-2 text-lg font-semibold text-yellow-300">
            Any compatible nearby captain can accept
          </p>
        </div>
      )}

      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
          <i className="ri-map-pin-user-fill mt-1 text-xl text-yellow-300" />
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">Pick-up</p>
            <p className="text-base font-medium text-white">{displayPickup}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
          <i className="ri-map-pin-2-fill mt-1 text-xl text-yellow-300" />
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">Destination</p>
            <p className="text-base font-medium text-white">{displayDestination}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
          <i className="ri-currency-line mt-1 text-xl text-yellow-300" />
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">Fare</p>
            <p className="text-base font-semibold text-white">
              {hasFlexibleSharedFareRange
                ? `${formatCurrency(Math.min(...compatibleSharedFareBreakdown))} - ${formatCurrency(Math.max(...compatibleSharedFareBreakdown))}`
                : typeof displayFare === 'number'
                  ? formatCurrency(displayFare)
                  : 'Fare unavailable'}
            </p>
            {displayFarePerSeat != null && isSharedRide ? (
              <p className="mt-1 text-sm text-gray-400">
                Rs. {displayFarePerSeat}/seat x {bookedSeatCount} seat{bookedSeatCount === 1 ? '' : 's'}
              </p>
            ) : null}
            {isSharedRide ? (
              <p className="mt-1 text-sm text-slate-300">{bookedSeatLabel}</p>
            ) : null}
            {hasFlexibleSharedFareRange ? (
              <p className="mt-1 text-sm text-gray-400">
                Final fare locks to the shared vehicle that accepts this request.
              </p>
            ) : null}
          </div>
        </div>

        {isSharedRide && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
            <i className="ri-team-line mt-1 text-xl text-yellow-300" />
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">Shared Request</p>
              <p className="text-base font-semibold text-white">
                {formatPreference(genderPreference)} | {bookedSeatLabel}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <p className="animate-pulse text-sm italic text-gray-400">
          {isSharedRide
            ? 'Nearby matching captains are being notified right now...'
            : 'Looking for nearby drivers...'}
        </p>
        <div className="mt-3 flex justify-center space-x-2">
          <span className="h-2 w-2 animate-bounce rounded-full bg-yellow-400" />
          <span className="delay-150 h-2 w-2 animate-bounce rounded-full bg-yellow-500" />
          <span className="delay-300 h-2 w-2 animate-bounce rounded-full bg-yellow-600" />
        </div>
      </div>
    </div>
  );
};

export default LookingForDriver;
