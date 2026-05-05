import React from 'react';
import { profileImages } from '../utils/imageAssets';

const formatSharedPreference = (value) => {
  if (value === 'female') {
    return 'Female only';
  }

  if (value === 'male') {
    return 'Men only';
  }

  return 'Any shared';
};

const RidePopUp = ({
  ride,
  setRidePopupPanel,
  confirmRide,
  rejectRide,
  decisionLoading,
}) => {
  const passenger = ride?.user?.fullname;

  return (
    <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-yellow-600/20 bg-gradient-to-b from-black via-neutral-900 to-neutral-800 px-4 pt-8 pb-6 text-white shadow-2xl backdrop-blur-lg">
      <div
        className="absolute top-3 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-gray-400/50 cursor-pointer"
        onClick={() => setRidePopupPanel(false)}
      />

      <h3 className="mt-6 mb-5 text-center text-xl font-semibold text-yellow-400">
        New Ride Request
      </h3>

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-yellow-400/20 bg-yellow-200/10 p-4 shadow-inner">
        <img
          src={profileImages.user}
          alt="Passenger"
          className="h-12 w-12 rounded-full object-cover shadow"
        />
        <div>
          <p className="text-lg font-semibold capitalize text-white">
            {passenger?.firstname} {passenger?.lastname}
          </p>
          <p className="text-xs text-gray-400">
            {ride?.rideType === 'carpool' ? 'Fresh shared request' : 'Direct ride request'}
          </p>
        </div>
      </div>

      <div className="space-y-5 text-sm">
        <div className="flex items-start gap-3">
          <i className="ri-map-pin-user-fill mt-1 text-xl text-yellow-400" />
          <div>
            <p className="text-sm text-gray-400">Pickup</p>
            <p className="break-words font-medium text-white">{ride?.pickup}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-map-pin-2-fill mt-1 text-xl text-red-400" />
          <div>
            <p className="text-sm text-gray-400">Drop</p>
            <p className="break-words font-medium text-white">{ride?.destination}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-wallet-3-line mt-1 text-xl text-green-400" />
          <div>
            <p className="text-sm text-gray-400">Fare</p>
            <p className="font-bold text-yellow-200">Rs. {ride?.fare}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-steering-2-fill mt-1 text-xl text-cyan-400" />
          <div>
            <p className="text-sm text-gray-400">Requested Vehicle</p>
            <p className="font-medium capitalize text-white">
              {ride?.allowAnyVehicleType ? 'Any compatible vehicle' : ride?.vehicleType || 'Not specified'}
              {ride?.rideType === 'carpool' ? ` • ${ride?.availableSeats || 1} seat request` : ''}
            </p>
          </div>
        </div>

        {ride?.rideType === 'carpool' && (
          <div className="flex items-start gap-3">
            <i className="ri-group-fill mt-1 text-xl text-pink-400" />
            <div>
              <p className="text-sm text-gray-400">Shared Preference</p>
              <p className="font-medium text-white">{formatSharedPreference(ride?.genderPreference)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <button
          onClick={confirmRide}
          disabled={decisionLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-3 font-medium text-white shadow-md transition-all duration-200 hover:from-green-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <i className="ri-check-line text-lg" /> {decisionLoading ? 'Updating...' : 'Accept Ride'}
        </button>

        <button
          onClick={rejectRide}
          disabled={decisionLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-700/70 py-3 font-medium text-white hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <i className="ri-close-line text-lg" /> Reject Ride
        </button>
      </div>
    </div>
  );
};

export default RidePopUp;
