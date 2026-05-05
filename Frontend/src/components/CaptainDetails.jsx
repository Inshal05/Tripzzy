import React, { useContext } from 'react';
import { CaptainDataContext } from '../context/CapatainContext';
import { profileImages, normalizeVehicleType, vehicleCatalog } from '../utils/imageAssets';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatVehicleLabel = (vehicleType) => {
  const normalizedType = normalizeVehicleType(vehicleType);
  return normalizedType ? normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1) : 'Not available';
};

const CaptainDetails = ({
  onToggleAvailability = null,
  availabilityLoading = false,
  availabilityNotice = '',
}) => {
  const { captain } = useContext(CaptainDataContext);

  if (!captain) {
    return null;
  }

  const captainName = [captain.fullname?.firstname, captain.fullname?.lastname]
    .filter(Boolean)
    .join(' ')
    .trim();
  const stats = captain.stats || {};
  const vehicle = captain.vehicle || {};
  const isCaptainOnline = captain.status === 'active';
  const normalizedVehicleType = normalizeVehicleType(vehicle.vehicleType);
  const supportedVehicleCapacity = vehicleCatalog?.[normalizedVehicleType]?.capacity ?? Number(vehicle.capacity) ?? 0;
  const displayedCapacity = Math.min(Number(vehicle.capacity) || supportedVehicleCapacity, supportedVehicleCapacity);

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            className="h-12 w-12 rounded-full border-2 border-yellow-400 object-cover shadow-md"
            src={profileImages.captain}
            alt="Captain Avatar"
          />
          <div>
            <h4 className="text-lg font-semibold capitalize">{captainName || captain.email}</h4>
            <p className="text-sm text-slate-400">{captain.email}</p>
          </div>
        </div>

        <div className="text-right">
          <h4 className="text-xl font-bold text-emerald-400">
            {formatCurrency(stats.totalEarnings)}
          </h4>
          <p className="text-sm text-slate-400">Verified Completed Earnings</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-800 p-4 text-center">
        <div>
          <i className="ri-radar-line mb-1 block text-2xl text-yellow-400" />
          <h5 className="text-lg font-semibold">{isCaptainOnline ? 'Online' : 'Offline'}</h5>
          <p className="text-xs text-slate-400">Current Status</p>
        </div>
        <div>
          <i className="ri-roadster-line mb-1 block text-2xl text-sky-400" />
          <h5 className="text-lg font-semibold">{stats.completedTrips ?? 0}</h5>
          <p className="text-xs text-slate-400">Trips Completed</p>
        </div>
        <div>
          <i className="ri-team-line mb-1 block text-2xl text-pink-400" />
          <h5 className="text-lg font-semibold">{displayedCapacity}</h5>
          <p className="text-xs text-slate-400">Vehicle Seats</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-800/60 px-4 py-3 text-sm text-slate-300">
        <div className="flex items-center justify-between gap-3">
          <span className="capitalize">
            {[vehicle.color, formatVehicleLabel(vehicle.vehicleType)].filter(Boolean).join(' ')}
          </span>
          <span>{vehicle.plate || 'Plate unavailable'}</span>
        </div>
      </div>

      {availabilityNotice ? (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {availabilityNotice}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {isCaptainOnline ? 'You are visible to riders' : 'You are hidden from riders'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Keep location access enabled while online so nearby ride requests can reach you.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleAvailability}
            disabled={availabilityLoading || !onToggleAvailability}
            className={`rounded-lg px-4 py-2 text-sm font-semibold shadow transition ${
              isCaptainOnline
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {availabilityLoading ? 'Updating...' : isCaptainOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaptainDetails;
