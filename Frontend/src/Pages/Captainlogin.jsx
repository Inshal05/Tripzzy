import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CaptainDataContext } from '../context/CapatainContext';
import { persistCaptainToken } from '../utils/authStorage';

const CaptainLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setCaptain } = useContext(CaptainDataContext);
  const navigate = useNavigate();

  const submitHandler = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/captains/login`, {
        email,
        password
      });

      if (response.status === 200) {
        const data = response.data;
        setCaptain(data.captain);
        persistCaptainToken(data.token);
        navigate('/captain-home');
      }
    } catch (err) {
      alert('Invalid credentials');
    }

    setEmail('');
    setPassword('');
  };

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-4 py-6">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-md brightness-50"
        style={{ backgroundImage: `url('/image/captain-dashboard.svg')` }}
      />
      <div className="absolute inset-0 bg-black opacity-70" />

      {/* Glass Card */}
      <div className="relative z-10 mx-auto w-full max-w-md rounded-xl border border-white/20 bg-white/10 px-5 py-8 text-white shadow-2xl backdrop-blur-lg sm:px-8 sm:py-10">
        <img className="mx-auto mb-6 h-10 sm:h-12" src="/image/trippzy.png" alt="Tripzzy Logo" />

        <form onSubmit={submitHandler} className="space-y-5 sm:space-y-6">
          <div>
            <label className="text-sm font-medium block mb-1">What's your email</label>
            <input
              required
              type="email"
              placeholder="captain@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder:text-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Enter password</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder:text-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
          >
            Login
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          New here?{' '}
          <Link to="/captain-signup" className="text-yellow-400 hover:underline">
            Register as a Captain
          </Link>
        </p>

        <Link
          to="/login"
          className="block mt-6 w-full text-center py-3 border border-yellow-400 text-yellow-400 font-semibold rounded-lg hover:bg-yellow-400 hover:text-black transition"
        >
          Sign in as User
        </Link>
      </div>
    </div>
  );
};

export default CaptainLogin;
