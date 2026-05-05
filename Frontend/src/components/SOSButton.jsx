import React from "react";

const SOSButton = ({ onClick }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onClick}
        className="relative group w-20 h-20 rounded-full bg-red-600 text-white font-bold text-lg shadow-xl hover:bg-red-700 transition-all duration-300 focus:outline-none"
      >
        <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75 group-hover:opacity-100"></span>
        SOS
      </button>
    </div>
  );
};

export default SOSButton;
