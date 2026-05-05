import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function TripzzyLanding() {
  const [showContent, setShowContent] = useState(false);
  const [carLeft, setCarLeft] = useState(-50);
  const [carStage, setCarStage] = useState(0);
  const [carOpacity, setCarOpacity] = useState(0);
  const [lettersVisible, setLettersVisible] = useState([]);

  const carRef = useRef(null);
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 0;

  useEffect(() => {
    const showLetters = () => {
      [..."Tripzzy"].forEach((_, i) => {
        setTimeout(() => {
          setLettersVisible((prev) => [...prev, i]);
        }, 200 * i);
      });
    };

    const animateCar = () => {
      setTimeout(() => {
        setCarOpacity(1);
        setCarLeft(0);
        setCarStage(1);
        setTimeout(() => {
          setCarLeft(180);
          setCarStage(2);
          setTimeout(() => {
            setCarLeft(windowWidth);
            setTimeout(() => {
              setShowContent(true);
            }, 1500);
          }, 400);
        }, 300);
      }, 200 * 7 + 300);
    };

    showLetters();
    animateCar();
  }, []);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-center filter blur-md brightness-50"
        style={{ backgroundImage: `url('/image/trippzylogo.png')` }}
      />

      {/* Loading Overlay */}
      {!showContent && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black px-4">
          <div className="flex gap-1 text-4xl font-bold text-yellow-400 sm:text-6xl">
            {[..."Tripzzy"].map((char, i) => (
              <span
                key={i}
                className={`transition-all duration-300 transform ${lettersVisible.includes(i) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
              >
                {char}
              </span>
            ))}
          </div>
          <div
            ref={carRef}
            className="absolute top-24 z-50 h-[20px] w-[50px] rounded-md bg-yellow-400 sm:top-[100px]"
            style={{
              left: `${carLeft}px`,
              opacity: carOpacity,
              transition: carStage === 2 ? "all 1.5s ease-in" : "all 0.3s ease",
              transform: carStage === 1 ? "translateY(-20px)" : carStage === 2 ? "translateY(-5px)" : "translateY(0px)"
            }}
          >
            <div className="absolute top-[-10px] left-[10px] w-[30px] h-[15px] bg-yellow-400 rounded-t-md" />
            <div className="absolute bottom-[-5px] left-[5px] w-[10px] h-[10px] bg-gray-800 rounded-full shadow-[25px_0_0_#333]" />
          </div>
        </div>
      )}

      {/* Main Content */}
      {showContent && (
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center bg-black/50 px-4 py-10 text-center sm:px-6">
          {/* Small Logo */}
          <div className="absolute left-4 top-4 rounded-full bg-black/60 px-4 py-2 text-base font-bold text-yellow-400 shadow-lg sm:text-xl">
            Tripzzy
          </div>

          <div className="mb-8 text-4xl font-bold text-white drop-shadow sm:mb-10 sm:text-6xl">Tripzzy</div>
          <div className="mb-6 text-base opacity-100 transition-all duration-500 translate-y-0 sm:text-xl">
            Make your trip easy
          </div>
          <Link
            to="/login"
            className="w-full max-w-xs rounded-full bg-yellow-400 px-6 py-3 font-bold uppercase tracking-wide text-black transition-all duration-300 hover:translate-y-1 hover:bg-yellow-300 sm:w-auto"
          >
            Book Now
          </Link>
          <Link
            to="/captain-login"
            className="mt-4 w-full max-w-xs rounded-full border-2 border-yellow-400 px-6 py-3 font-bold uppercase tracking-wide text-yellow-400 transition-all duration-300 hover:bg-yellow-400 hover:text-black sm:w-auto"
          >
            Captain Login
          </Link>

          <div className="mt-12 flex w-full flex-col items-center gap-4 opacity-100 transition-all duration-500 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-6">
            <div className="w-full max-w-xs rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur sm:w-48">
              <h3 className="font-semibold text-lg mb-2">Fast Booking</h3>
              <p className="text-sm">Book your ride in seconds</p>
            </div>
            <div className="w-full max-w-xs rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur sm:w-48">
              <h3 className="font-semibold text-lg mb-2">Premium Cars</h3>
              <p className="text-sm">Luxury fleet at your service</p>
            </div>
            <div className="w-full max-w-xs rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur sm:w-48">
              <h3 className="font-semibold text-lg mb-2">24/7 Support</h3>
              <p className="text-sm">Always ready to assist you</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
