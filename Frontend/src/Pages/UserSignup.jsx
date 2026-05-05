import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserDataContext } from '../context/UserContext';
import { persistUserToken } from '../utils/authStorage';

const UserSignup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const navigate = useNavigate();
  const { setUser } = useContext(UserDataContext);

  const submitHandler = async (e) => {
    e.preventDefault();

    const newUser = {
      fullname: {
        firstname: firstName,
        lastname: lastName
      },
      email,
      password
    };

    try {
      const response = await axios.post(`${import.meta.env.VITE_BASE_URL}/users/register`, newUser);

      if (response.status === 201) {
        const data = response.data;
        setUser(data.user);
        persistUserToken(data.token);
        navigate('/home');
      }
    } catch (err) {
      alert('Signup failed. Please try again.');
    }

    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
  };

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-4 py-6">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-md brightness-50"
        style={{ backgroundImage: `url('/image/trippzylogo.png')` }}
      />
      <div className="absolute inset-0 bg-black opacity-70" />

      {/* Signup Card */}
      <div className="relative z-10 mx-auto max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-white/20 bg-white/10 px-5 py-8 text-white shadow-2xl backdrop-blur-lg sm:px-8 sm:py-10">
        <img className="mx-auto mb-6 h-10 sm:h-12" src="/image/trippzy.png" alt="Tripzzy" />

        <form onSubmit={submitHandler} className="space-y-5 sm:space-y-6">
          <div>
            <label className="text-sm font-medium block mb-1">What's your name</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                required
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400 sm:w-1/2"
              />
              <input
                required
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-white/30 bg-white/20 px-4 py-3 text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400 sm:w-1/2"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">What's your email</label>
            <input
              required
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder:text-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Create a password</label>
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
            Create Account
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-yellow-400 hover:underline">
            Login here
          </Link>
        </p>

        <p className="text-[10px] text-center mt-4 leading-tight text-white/70">
          This site is protected by reCAPTCHA and the{' '}
          <span className="underline">Google Privacy Policy</span> and{' '}
          <span className="underline">Terms of Service</span> apply.
        </p>
      </div>
    </div>
  );
};

export default UserSignup;
