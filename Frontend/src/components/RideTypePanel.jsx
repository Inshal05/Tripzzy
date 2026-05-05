import React, { useState } from 'react';
import axios from 'axios';
import { getUserAuthHeaders } from '../utils/authStorage';

const seatOptions = [1, 2, 3, 4];

const rideModeCards = {
  solo: {
    icon: 'ri-vip-crown-2-line',
    eyebrow: 'Direct and private',
    title: 'Solo Ride',
    description: 'A premium direct ride for when you want a cabin fully to yourself.',
    highlights: ['No shared stops', 'Fastest dispatch', 'Private comfort'],
  },
  carpool: {
    icon: 'ri-team-line',
    eyebrow: 'Coordinated shared trip',
    title: 'Carpool',
    description: 'Join or request a curated shared route with live seat-based split pricing.',
    highlights: ['Live seat split', 'Route-matched carpools', 'Smart shared savings'],
  },
};

const preferenceLabels = {
  female: 'Female',
  male: 'Male',
  any: 'Any',
};

const RideTypePanel = ({
  rideType,
  setRideType,
  setShowRideTypePanel,
  setVehiclePanel,
  setShowDeviceList,
  availableSeats,
  setAvailableSeats,
  pickup,
  destination,
  setFare,
  genderPreference,
  setGenderPreference,
}) => {
  const [loading, setLoading] = useState(false);
  const [isShrunk, setIsShrunk] = useState(false);
  const isSoloSelected = rideType === 'solo';
  const isCarpoolSelected = rideType === 'carpool';
  const activeRideCard = rideModeCards[rideType] || rideModeCards.solo;

  const handleRideTypeSelect = async (selectedType) => {
    if (loading) {
      return;
    }

    if (!pickup || !destination) {
      alert('Please enter both pickup and destination locations');
      return;
    }

    if (selectedType === 'carpool') {
      setRideType('carpool');
      setAvailableSeats(availableSeats >= 1 ? availableSeats : 1);
      setShowRideTypePanel(false);
      setShowDeviceList(true);
      return;
    }

    setLoading(true);

    try {
      setRideType(selectedType);
      setAvailableSeats(1);

      const response = await axios.get(
        `${import.meta.env.VITE_BASE_URL}/rides/get-fare`,
        {
          params: {
            pickup,
            destination,
            rideType: selectedType,
          },
          headers: getUserAuthHeaders(),
        }
      );

      setFare(response.data);
      setShowRideTypePanel(false);
      setVehiclePanel(true);
    } catch (error) {
      console.error('Error calculating fare:', error);
      alert(error?.response?.data?.message || 'Failed to calculate fare. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full">
      <button
        type="button"
        className="absolute left-1/2 top-2 z-10 -translate-x-1/2 text-slate-400 transition hover:text-amber-300"
        onClick={() => !loading && setShowRideTypePanel(false)}
      >
        <i className="ri-arrow-down-wide-line text-2xl" />
      </button>

      <div className="relative overflow-hidden rounded-[28px] border border-amber-400/15 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.12),_transparent_24%),linear-gradient(180deg,_rgba(8,15,30,0.98)_0%,_rgba(3,8,20,0.98)_100%)] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:p-5 md:rounded-[30px] md:p-6">
        <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -right-8 bottom-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
              <i className="ri-star-smile-line text-sm" />
              Premium Ride Modes
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsShrunk((current) => !current)}
                className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-amber-300/30 hover:text-white sm:px-3 sm:text-xs"
              >
                <i className={`${isShrunk ? 'ri-expand-up-down-line' : 'ri-collapse-diagonal-2-line'} text-sm`} />
                {isShrunk ? 'Expand' : 'Shrink'}
              </button>

              <button
                type="button"
                onClick={() => !loading && setShowRideTypePanel(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-white"
                aria-label="Close ride type panel"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-[2.05rem]">
                Choose Your Ride Type
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-300 sm:text-sm md:text-[0.95rem]">
                Pick a direct private cabin or a coordinated shared ride experience that feels aligned with the rest of Tripzzy.
              </p>
            </div>
          </div>

          {isShrunk ? (
            <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
                    <i className={`${activeRideCard.icon} text-lg`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/75">
                      {activeRideCard.eyebrow}
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-white">{activeRideCard.title}</h4>
                    <p className="mt-1 text-sm text-slate-400">
                      {rideType === 'carpool'
                        ? `${preferenceLabels[genderPreference]} preference | ${availableSeats} seat${availableSeats === 1 ? '' : 's'}`
                        : 'Private direct cabin'}
                    </p>
                  </div>
                </div>

                <div className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Compact
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => handleRideTypeSelect('solo')}
              disabled={loading}
              className={`w-full rounded-[24px] border p-4 text-left transition-all duration-200 sm:rounded-[26px] sm:p-5 ${
                isSoloSelected
                  ? 'border-amber-300/60 bg-[linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(251,191,36,0.08)_45%,_rgba(15,23,42,0.9)_100%)] shadow-[0_14px_40px_rgba(251,191,36,0.12)]'
                  : 'border-white/10 bg-slate-950/55 hover:border-amber-300/30 hover:bg-slate-900/75'
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                    isSoloSelected
                      ? 'border-amber-300/40 bg-amber-300/15 text-amber-200'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}>
                    <i className={`${rideModeCards.solo.icon} text-xl`} />
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/75">
                      {rideModeCards.solo.eyebrow}
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-white sm:text-xl">
                      {rideModeCards.solo.title}
                    </h4>
                    <p className={`mt-1 text-[13px] leading-6 sm:text-sm ${
                      isSoloSelected ? 'text-slate-100/90' : 'text-slate-400'
                    }`}>
                      {rideModeCards.solo.description}
                    </p>
                  </div>
                </div>

                <div className={`mt-1 flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-full border sm:self-auto ${
                  isSoloSelected
                    ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
                    : 'border-white/10 bg-white/5 text-slate-500'
                }`}>
                  <i className={`text-lg ${isSoloSelected ? 'ri-check-line' : 'ri-arrow-right-up-line'}`} />
                </div>
              </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {rideModeCards.solo.highlights.map((highlight) => (
                    <span
                    key={highlight}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                      isSoloSelected
                        ? 'bg-amber-300/12 text-amber-100'
                        : 'bg-white/6 text-slate-300'
                    }`}
                  >
                    {highlight}
                  </span>
                  ))}
                </div>
              </button>

            <div
                  className={`overflow-hidden rounded-[24px] border transition-all duration-200 sm:rounded-[26px] ${
                isCarpoolSelected
                  ? 'border-amber-300/45 bg-[linear-gradient(135deg,_rgba(245,158,11,0.2),_rgba(59,130,246,0.12)_42%,_rgba(15,23,42,0.9)_100%)] shadow-[0_18px_45px_rgba(251,191,36,0.12)]'
                  : 'border-white/10 bg-slate-950/55 hover:border-amber-300/30 hover:bg-slate-900/75'
              }`}
            >
              <button
                type="button"
                onClick={() => setRideType('carpool')}
                disabled={loading}
                className="w-full px-4 py-4 text-left sm:px-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                      isCarpoolSelected
                        ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}>
                      <i className={`${rideModeCards.carpool.icon} text-xl`} />
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/75">
                        {rideModeCards.carpool.eyebrow}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-white sm:text-xl">
                        {rideModeCards.carpool.title}
                      </h4>
                      <p className={`mt-1 text-[13px] leading-6 sm:text-sm ${
                        isCarpoolSelected ? 'text-slate-100/90' : 'text-slate-400'
                      }`}>
                        {rideModeCards.carpool.description}
                      </p>
                    </div>
                  </div>

                  <div className={`mt-1 flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-full border sm:self-auto ${
                    isCarpoolSelected
                      ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
                      : 'border-white/10 bg-white/5 text-slate-500'
                  }`}>
                    <i className={`text-lg ${isCarpoolSelected ? 'ri-check-line' : 'ri-arrow-right-up-line'}`} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {rideModeCards.carpool.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                        isCarpoolSelected
                          ? 'bg-amber-300/12 text-amber-100'
                          : 'bg-white/6 text-slate-300'
                      }`}
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </button>

              {isCarpoolSelected && (
                  <div className="border-t border-white/10 bg-black/15 px-3 pb-3 pt-4 sm:px-4 sm:pb-4 md:px-5">
                  <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08)_0%,_rgba(255,255,255,0.02)_100%)] p-3.5 backdrop-blur-md sm:rounded-[24px] sm:p-4">
                    <div className="space-y-5">
                      <div>
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="text-sm font-semibold text-white/90">Shared Preference</label>
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                            Curated match
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2.5 sm:gap-3">
                          {Object.entries(preferenceLabels).map(([option, label]) => {
                            const isActive = genderPreference === option;

                            return (
                              <button
                                type="button"
                                key={option}
                                className={`rounded-full px-4 py-2.5 text-sm transition ${
                                  isActive
                                    ? 'border border-amber-300/50 bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/10'
                                    : 'border border-white/12 bg-white/6 text-white hover:border-amber-300/25 hover:bg-white/10'
                                }`}
                                onClick={() => setGenderPreference(option)}
                                disabled={loading}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="text-sm font-semibold text-white/90">Seats Needed</label>
                          <span className="text-xs leading-5 text-slate-400">Choose the size of shared cabin you need</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {seatOptions.map((seat) => {
                            const isSelected = availableSeats === seat;

                            return (
                              <button
                                type="button"
                                key={seat}
                                 className={`rounded-[20px] border px-3 py-3.5 text-sm transition sm:rounded-[22px] ${
                                   isSelected
                                     ? 'border-amber-300/50 bg-amber-300 text-slate-950 shadow-[0_10px_30px_rgba(251,191,36,0.16)]'
                                     : 'border-white/12 bg-white/6 text-white hover:border-amber-300/25 hover:bg-white/10'
                                }`}
                                onClick={() => setAvailableSeats(seat)}
                                disabled={loading}
                              >
                                <span className="block text-lg font-semibold">{seat}</span>
                                <span className="mt-1 block text-[11px] uppercase tracking-[0.22em]">
                                  Seat{seat === 1 ? '' : 's'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-slate-300">
                        We will surface shared options that match your route, seat requirement, and preference, while keeping the Tripzzy premium feel intact.
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRideTypeSelect('carpool')}
                        className="w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 py-3.5 font-bold text-slate-950 shadow-[0_14px_34px_rgba(251,191,36,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={loading}
                      >
                        Continue to Shared Options
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {loading && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              <i className="ri-loader-4-line animate-spin text-amber-300" />
              Calculating fares...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RideTypePanel;
