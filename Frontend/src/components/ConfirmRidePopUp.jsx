import React, { useState } from 'react';
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

const ConfirmRidePopUp = ({
  ride,
  setRidePopupPanel,
  setConfirmRidePopupPanel,
}) => {
  const [otp, setOtp] = useState('');
  const [startingRide, setStartingRide] = useState(false);
  const navigate = useNavigate();

  const submitHandler = async (e) => {
    e.preventDefault();

    if (!ride?._id || startingRide) {
      return;
    }

    setStartingRide(true);

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/rides/start-ride`,
        {
          params: {
            rideId: ride._id,
            otp,
          },
          headers: getCaptainAuthHeaders(),
        }
      );

      if (response.status === 200) {
        setConfirmRidePopupPanel(false);
        setRidePopupPanel(false);
        navigate('/captain-riding', { state: { ride: response.data } });
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Invalid OTP or failed to start ride');
      console.error(err);
    } finally {
      setStartingRide(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-yellow-600/20 bg-gradient-to-b from-black via-neutral-900 to-neutral-800 px-4 pt-8 pb-6 text-white shadow-2xl backdrop-blur-lg">
      <div
        onClick={() => setRidePopupPanel(false)}
        className="absolute top-3 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-gray-400/60 cursor-pointer"
      />

      <h3 className="mb-6 text-center text-xl font-semibold text-yellow-400">
        Verify OTP and Start Ride
      </h3>

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-yellow-500/20 bg-yellow-100/10 p-4 shadow-inner">
        <img
          className="h-12 w-12 rounded-full object-cover shadow"
          src={profileImages.user}
          alt="Rider"
        />
        <div>
          <h4 className="text-lg font-semibold capitalize text-white">
            {ride?.user?.fullname?.firstname}
          </h4>
          <p className="text-sm text-gray-400">
            {ride?.rideType === 'carpool' ? 'Shared ride request' : 'Direct ride request'}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-yellow-300/90">
            Ready for OTP verification
          </p>
        </div>
      </div>

      <div className="mb-6 space-y-5 rounded-2xl border border-yellow-500/20 bg-white/5 p-5 shadow-lg">
        <div className="flex items-start gap-3">
          <i className="ri-map-pin-user-fill mt-1 text-xl text-yellow-300" />
          <div>
            <p className="text-sm text-gray-400">Pickup</p>
            <p className="break-words text-base font-medium text-white">{ride?.pickup}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-map-pin-2-fill mt-1 text-xl text-red-400" />
          <div>
            <p className="text-sm text-gray-400">Destination</p>
            <p className="break-words text-base font-medium text-white">{ride?.destination}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <i className="ri-wallet-3-line mt-1 text-xl text-green-300" />
          <div>
            <p className="text-sm text-gray-400">Fare</p>
            <p className="text-lg font-bold text-yellow-200">{formatCurrency(ride?.fare)}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
        Ask the passenger for their OTP now, then start the ride.
      </div>

      <form onSubmit={submitHandler} className="space-y-4">
        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="w-full rounded-xl border border-gray-500 bg-neutral-800/80 px-5 py-3 font-mono text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
          placeholder="Enter OTP to start ride"
          required
        />

        <button
          type="submit"
          disabled={startingRide}
          className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-3 font-bold text-white shadow-md transition-all duration-200 hover:from-green-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {startingRide ? 'Starting Ride...' : 'Start Ride'}
        </button>

        <button
          type="button"
          onClick={() => {
            setConfirmRidePopupPanel(false);
            setRidePopupPanel(false);
          }}
          className="w-full rounded-xl bg-neutral-700/70 py-3 font-medium text-white shadow-md hover:bg-neutral-600"
        >
          Cancel
        </button>
      </form>
    </div>
  );
};

export default ConfirmRidePopUp;
