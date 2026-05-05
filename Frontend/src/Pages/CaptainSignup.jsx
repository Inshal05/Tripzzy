import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CaptainDataContext } from '../context/CapatainContext';
import axios from 'axios';
import { persistCaptainToken } from '../utils/authStorage';

const CaptainSignup = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [vehicleType, setVehicleType] = useState('');

  const { setCaptain } = useContext(CaptainDataContext);

  const submitHandler = async (e) => {
    e.preventDefault();

    const captainData = {
      fullname: { firstname: firstName, lastname: lastName },
      email,
      password,
      vehicle: {
        color: vehicleColor,
        plate: vehiclePlate,
        capacity: vehicleCapacity,
        vehicleType
      }
    };

    const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/captains/register`, captainData);

    if (response.status === 201) {
      const data = response.data;
      setCaptain(data.captain);
      persistCaptainToken(data.token);
      navigate('/captain-home');
    }

    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setVehicleColor('');
    setVehiclePlate('');
    setVehicleCapacity('');
    setVehicleType('');
  };

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-4 py-6">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-md brightness-50"
        style={{ backgroundImage: `url('/image/captain-dashboard.svg')` }}
      />
      <div className="absolute inset-0 bg-black opacity-70" />

      {/* Card */}
      <div className="relative z-10 mx-auto max-h-[calc(100svh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-white/20 bg-white/10 px-5 py-6 text-white shadow-2xl backdrop-blur-lg sm:px-8 sm:py-7">
        <img className="mx-auto mb-6 h-10 sm:h-12" src="/image/trippzy.png" alt="Tripzzy" />

        <form onSubmit={submitHandler} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">What's our Captain's name</label>
            <div className="flex flex-col gap-4 sm:flex-row">
              <input
                required
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-yellow-400 sm:w-1/2"
              />
              <input
                required
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-yellow-400 sm:w-1/2"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">What's our Captain's email</label>
            <input
              required
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder:text-white/60 border border-white/30 focus:ring-yellow-400 focus:outline-none"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-2">Enter Password</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder:text-white/60 border border-white/30 focus:ring-yellow-400 focus:outline-none"
            />
          </div>

          {/* Vehicle Info */}
          <div>
            <label className="block text-sm font-medium mb-2">Vehicle Information</label>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row">
              <input
                required
                type="text"
                placeholder="Vehicle Color"
                value={vehicleColor}
                onChange={(e) => setVehicleColor(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-yellow-400 sm:w-1/2"
              />
              <input
                required
                type="text"
                placeholder="Vehicle Plate"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-yellow-400 sm:w-1/2"
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <input
                required
                type="number"
                placeholder="Vehicle Capacity"
                value={vehicleCapacity}
                onChange={(e) => setVehicleCapacity(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/60 focus:outline-none focus:ring-yellow-400 sm:w-1/2"
              />
              <select
                required
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white focus:outline-none focus:ring-yellow-400 sm:w-1/2"
              >
                <option value="" disabled>Select Vehicle Type</option>
                <option value="car">Car</option>
                <option value="auto">Auto</option>
                <option value="motorcycle">Moto</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
          >
            Create Captain Account
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          Already have an account?{' '}
          <Link to="/captain-login" className="text-yellow-400 hover:underline">
            Login here
          </Link>
        </p>

        <p className="text-[10px] mt-6 text-center leading-tight text-white/60">
          This site is protected by reCAPTCHA and the{' '}
          <span className="underline">Google Privacy Policy</span> and{' '}
          <span className="underline">Terms of Service apply</span>.
        </p>
      </div>
    </div>
  );
};

export default CaptainSignup;
