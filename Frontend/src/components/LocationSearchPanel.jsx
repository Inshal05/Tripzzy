import React from 'react';

const LocationSearchPanel = ({
  suggestions,
  setPanelOpen,
  setPickup,
  setDestination,
  activeField,
}) => {
  const handleSuggestionClick = (suggestion) => {
    if (activeField === 'pickup') {
      setPickup(suggestion);
    } else {
      setDestination(suggestion);
    }

    setPanelOpen(false);
    // 🔥 Removed: setVehiclePanel(true);
  };

  if (!suggestions.length) return null;

  return (
    <div className="max-h-72 overflow-y-auto mt-4 px-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
      <p className="text-sm text-slate-400 mb-3 px-2">Suggested Locations</p>
      {suggestions.map((elem, idx) => (
        <div
          key={idx}
          onClick={() => handleSuggestionClick(elem)}
          className="flex items-center gap-3 px-4 py-3 mb-3 rounded-xl cursor-pointer bg-white/5 hover:bg-slate-800 transition-all border border-slate-600 text-white"
        >
          <div className="text-amber-400 text-xl">
            <i className="ri-map-pin-fill"></i>
          </div>
          <span className="truncate text-sm">{elem}</span>
        </div>
      ))}
    </div>
  );
};

export default LocationSearchPanel;
