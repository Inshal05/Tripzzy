import React from 'react';
import { getVehicleImage } from '../utils/imageAssets';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const WaitingForDriver = ({ setWaitingForDriver, ride }) => {
  const captain = ride?.captain;
  const vehicle = captain?.vehicle;
  const displayPickup = ride?.viewerPickup || ride?.pickup;
  const displayDestination = ride?.viewerDestination || ride?.destination;
  const displayFare = ride?.viewerFare ?? ride?.fare;
  const displayFarePerSeat = ride?.viewerFarePerSeat ?? ride?.farePerSeat;
  const bookedSeatCount = Math.max(1, Number(ride?.viewerBookedSeats ?? ride?.bookedSeats) || 1);
  const bookedSeatLabel = `${bookedSeatCount} seat${bookedSeatCount === 1 ? '' : 's'} booked`;
  const viewerOtp = ride?.viewerOtp || ride?.otp;
  const viewerRole = ride?.viewerRole;
  const isWaitingForPickup = ride?.viewerBoardingStatus === 'awaiting_pickup';
  const isOwnerAwaitingPickup = viewerRole === 'owner' && ride?.status === 'accepted';
  const title = isWaitingForPickup
    ? 'Waiting for Pickup'
    : isOwnerAwaitingPickup
      ? 'Waiting for Driver'
      : 'Waiting for Confirmation';
  const otpLabel = isWaitingForPickup ? 'Pickup OTP' : 'Ride OTP';
  const helperCopy = isWaitingForPickup
    ? 'Keep this OTP ready and share it only when the captain reaches your pickup.'
    : 'Your captain is on the way. Share this OTP with the captain when your ride is about to begin.';
  const otpValue = viewerOtp || 'Pending';

  return (
    <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-yellow-500/20 bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900 px-5 pb-6 pt-10 text-white shadow-2xl backdrop-blur-md">
      <div
        onClick={() => setWaitingForDriver(false)}
        className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 cursor-pointer rounded-full bg-white/30 transition hover:bg-white/50"
      />

      <h3 className="mb-6 text-center text-2xl font-bold text-yellow-400">
        {title}
      </h3>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-yellow-400/20 bg-white/5 p-4 shadow-inner">
        <img
          className="h-14 w-14 rounded-full object-cover shadow"
          src={getVehicleImage(vehicle?.vehicleType)}
          alt="Vehicle"
        />
        <div className="text-right">
          <h4 className="text-lg font-semibold capitalize text-white">
            {captain?.fullname?.firstname || 'Assigned captain'}
          </h4>
          <p className="text-sm font-medium text-yellow-300">{vehicle?.plate || 'Plate unavailable'}</p>
          <p className="text-xs text-gray-400">{vehicle?.vehicleType || 'Vehicle details unavailable'}</p>
          <p className="mt-1 text-base font-semibold tracking-widest text-green-400">
            {otpLabel}: {otpValue}
          </p>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-gray-700/20 bg-white/5 p-5 shadow-inner">
        <div className="flex items-start gap-3">
          <i className="ri-map-pin-user-fill mt-1 text-xl text-yellow-300" />
          <div>
            <p className="text-sm text-gray-400">Pickup</p>
            <p className="break-words text-base font-medium text-white">{displayPickup}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-map-pin-2-fill mt-1 text-xl text-red-400" />
          <div>
            <p className="text-sm text-gray-400">Destination</p>
            <p className="break-words text-base font-medium text-white">{displayDestination}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-wallet-3-line mt-1 text-xl text-green-400" />
          <div>
            <p className="text-sm text-gray-400">Fare</p>
            <p className="text-lg font-bold text-yellow-200">{formatCurrency(displayFare)}</p>
            {ride?.rideType === 'carpool' && displayFarePerSeat != null ? (
              <p className="mt-1 text-sm text-gray-400">
                {formatCurrency(displayFarePerSeat)}/seat | {bookedSeatLabel}
              </p>
            ) : null}
          </div>
        </div>

        {ride?.rideType === 'carpool' ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">
            Trip total is being split across the occupied seats in this car. Your payable will refresh automatically if more passengers join.
          </div>
        ) : null}

        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
          {helperCopy}
        </div>
      </div>
    </div>
  );
};

export default WaitingForDriver;
