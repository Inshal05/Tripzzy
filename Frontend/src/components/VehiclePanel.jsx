import React from 'react';
import {
  getCompatibleVehicleTypes,
  getVehicleImage,
  vehicleCatalog,
  vehicleDisplayOrder,
} from '../utils/imageAssets';

const formatDistance = (distanceMeters) => {
  if (!distanceMeters) {
    return null;
  }

  const distanceInKm = distanceMeters / 1000;
  return `${distanceInKm >= 10 ? distanceInKm.toFixed(0) : distanceInKm.toFixed(1)} km`;
};

const formatDuration = (durationSeconds) => {
  if (!durationSeconds) {
    return null;
  }

  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${totalMinutes} mins`;
  }

  if (!minutes) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} mins`;
};

const VehiclePanel = ({
  setVehiclePanel,
  setConfirmRidePanel,
  selectVehicle,
  fare,
  rideType,
  availableSeats,
  matchedCarpoolRides = [],
  setSelectedCarpoolRide,
}) => {
  const compatibleTypes = getCompatibleVehicleTypes({
    rideType,
    requiredSeats: availableSeats,
  });
  const requestedSeatLabel = `${availableSeats} seat${availableSeats === 1 ? '' : 's'} booked by you`;

  const genericVehicles = vehicleDisplayOrder
    .filter((type) => compatibleTypes.includes(type))
    .map((type) => ({
      ...vehicleCatalog[type],
      img: getVehicleImage(type),
      price: fare?.[type] || 0,
    }));

  const shouldShowLiveCarpools = rideType === 'carpool' && matchedCarpoolRides.length > 0;

  return (
    <div className="w-full rounded-t-3xl bg-gradient-to-br from-black to-neutral-900 px-4 py-5 text-white shadow-xl sm:px-5 sm:py-6">
      <button
        className="absolute top-3 left-1/2 -translate-x-1/2 text-3xl text-yellow-400 hover:text-yellow-300"
        onClick={() => setVehiclePanel(false)}
      >
        <i className="ri-arrow-down-wide-line" />
      </button>

      <h3 className="mb-3 mt-10 text-center text-xl font-bold text-yellow-400 sm:text-2xl">
        {shouldShowLiveCarpools
          ? 'Choose the Exact Shared Ride'
          : rideType === 'carpool'
            ? 'Choose a Vehicle for Your Fresh Shared Request'
            : 'Choose Your Ride'}
      </h3>

      <p className="mb-5 text-center text-sm leading-6 text-gray-400 sm:mb-6">
        {shouldShowLiveCarpools
          ? `These are nearby live shared rides with enough open seats for your ${availableSeats}-seat request.`
          : rideType === 'carpool'
            ? `We will ask nearby captains for a vehicle with at least ${availableSeats} open seats.`
            : 'Pick the ride that fits your trip best.'}
      </p>

      {shouldShowLiveCarpools
        ? matchedCarpoolRides.map((ride) => (
            <div
              key={ride._id}
              onClick={() => {
                setSelectedCarpoolRide(ride);
                selectVehicle(ride.vehicleType);
                setConfirmRidePanel(true);
                setVehiclePanel(false);
              }}
              className="mb-4 flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-yellow-600 bg-white/5 p-4 backdrop-blur transition-all hover:bg-white/10 sm:flex-row sm:items-center sm:gap-4"
            >
              <img
                src={getVehicleImage(ride.vehicleType)}
                alt={ride.vehicleType}
                className="h-24 w-full rounded-md object-contain shadow sm:h-16 sm:w-24"
              />
              <div className="flex-1">
                <h4 className="text-lg font-semibold capitalize text-yellow-300">
                  {ride.vehicleType}
                  <span className="ml-2 text-sm text-white">
                    <i className="ri-user-3-fill" /> {ride.availableSeats}
                  </span>
                </h4>
                <p className="text-sm text-gray-300">{ride.captainName}</p>
                <p className="text-xs text-gray-500">
                  {ride.vehiclePlate} | {ride.genderPreference} shared ride
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {ride.availableSeats} open seat{ride.availableSeats === 1 ? '' : 's'} | {requestedSeatLabel}
                </p>
                <p className="mt-1 text-xs font-medium text-emerald-300">
                  {ride.status === 'ongoing' ? 'Live shared ride' : 'Ready to join'}
                </p>
                <p className="mt-1 text-xs text-amber-200/80">
                  Payable updates from the current occupied-seat split after your seat is added.
                </p>
                {ride?.routeMatchSummary ? (
                  <p className="mt-1 text-xs text-cyan-200/80">
                    {ride?.routeMatchSummary?.exactRouteMatch ? 'Exact route match' : 'Nearby route match'}
                    {ride?.routeMatchSummary?.overlapMeters
                      ? ` | overlap ${formatDistance(ride.routeMatchSummary.overlapMeters)}`
                      : ''}
                    {typeof ride?.routeMatchSummary?.pickupDetourMeters === 'number'
                      ? ` | detour ${formatDistance(ride.routeMatchSummary.pickupDetourMeters) || 'under 1 km'}`
                      : ''}
                    {ride?.routeMatchSummary?.pickupEtaSeconds
                      ? ` | ETA ${ride?.routeMatchSummary?.pickupEtaText || formatDuration(ride.routeMatchSummary.pickupEtaSeconds)}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div className="w-full text-left sm:w-auto sm:text-right">
                <h2 className="text-xl font-bold text-yellow-300">Rs. {ride.fare}</h2>
                {ride?.farePerSeat != null ? (
                  <p className="mt-1 text-xs text-gray-400">Rs. {ride.farePerSeat}/seat</p>
                ) : null}
                <p className="mt-1 text-[11px] text-cyan-200/75">
                  Current estimated share after your seat is added
                </p>
              </div>
            </div>
          ))
        : genericVehicles.map((vehicle) => (
            <div
              key={vehicle.type}
              onClick={() => {
                setSelectedCarpoolRide(null);
                setConfirmRidePanel(true);
                setVehiclePanel(false);
                selectVehicle(vehicle.type);
              }}
              className="mb-4 flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-yellow-600 bg-white/5 p-4 backdrop-blur transition-all hover:bg-white/10 sm:flex-row sm:items-center sm:gap-4"
            >
              <img
                src={vehicle.img}
                alt={vehicle.name}
                className="h-24 w-full rounded-md object-contain shadow sm:h-16 sm:w-24"
              />
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-yellow-300">
                  {vehicle.name}
                  <span className="ml-2 text-sm text-white">
                    <i className="ri-user-3-fill" /> {vehicle.capacity}
                  </span>
                </h4>
                <p className="text-sm text-gray-300">{vehicle.wait}</p>
                <p className="text-xs text-gray-500">{vehicle.desc}</p>
              </div>
              <h2 className="w-full text-left text-xl font-bold text-yellow-300 sm:w-auto sm:text-right">
                Rs. {vehicle.price}
              </h2>
            </div>
          ))}
    </div>
  );
};

export default VehiclePanel;
