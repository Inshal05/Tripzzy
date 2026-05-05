import React, { useContext, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { UserDataContext } from '../context/UserContext';
import RoutePreviewMap from '../components/RoutePreviewMap';
import LocationSearchPanel from '../components/LocationSearchPanel';
import RideTypePanel from '../components/RideTypePanel';
import DeviceListPanel from '../components/DeviceListPanel';
import VehiclePanel from '../components/VehiclePanel';
import ConfirmRide from '../components/ConfirmRide';
import LookingForDriver from '../components/LookingForDriver';
import WaitingForDriver from '../components/WaitingForDriver';
import { clearUserToken, getUserAuthHeaders, getUserToken } from '../utils/authStorage';
import { getAddressFromCoordinates } from '../utils/mapApi';

const Home = () => {
  const floatingPanelClass =
    'fixed inset-x-0 bottom-0 z-10 w-full max-h-[88svh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/90 px-4 pt-4 pb-5 text-white shadow-lg backdrop-blur-md sm:px-5 sm:pt-5 sm:pb-6 md:inset-x-auto md:right-4 md:bottom-4 md:w-[calc(40vw-2rem)] md:max-w-[44rem] md:max-h-[calc(100vh-2rem)] md:rounded-3xl';
  const rideTypePanelClass =
    'fixed inset-x-0 bottom-0 z-30 w-full max-h-[92svh] overflow-y-auto overscroll-contain rounded-t-3xl border border-slate-700 bg-gradient-to-br from-slate-800/88 to-slate-900/95 px-3 pt-3 pb-4 text-white shadow-lg backdrop-blur-md sm:px-4 sm:pt-4 sm:pb-5 md:inset-x-auto md:right-4 md:bottom-4 md:w-[calc(40vw-2rem)] md:max-w-[44rem] md:max-h-[calc(100vh-2rem)] md:rounded-3xl md:px-5 md:pt-5 md:pb-6';
  const compactDevicePanelClass =
    'fixed inset-x-0 bottom-0 z-20 w-full max-h-[88svh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-gradient-to-br from-slate-800/80 to-slate-900/90 px-4 pt-3 pb-4 text-white shadow-lg backdrop-blur-md md:inset-x-auto md:right-4 md:top-4 md:bottom-auto md:w-[calc(40vw-2rem)] md:max-w-[44rem] md:max-h-[calc(100vh-2rem)] md:rounded-3xl';

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [vehiclePanel, setVehiclePanel] = useState(false);
  const [confirmRidePanel, setConfirmRidePanel] = useState(false);
  const [vehicleFound, setVehicleFound] = useState(false);
  const [waitingForDriver, setWaitingForDriver] = useState(false);
  const [showRideTypePanel, setShowRideTypePanel] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);
  const [fare, setFare] = useState({});
  const [vehicleType, setVehicleType] = useState(null);
  const [rideType, setRideType] = useState('solo');
  const [availableSeats, setAvailableSeats] = useState(1);
  const [genderPreference, setGenderPreference] = useState('any');
  const [ride, setRide] = useState(null);
  const [matchingCarpoolRides, setMatchingCarpoolRides] = useState([]);
  const [selectedCarpoolRide, setSelectedCarpoolRide] = useState(null);
  const [submittingRide, setSubmittingRide] = useState(false);
  const [rideRequestNotice, setRideRequestNotice] = useState('');
  const [detectingPickupLocation, setDetectingPickupLocation] = useState(false);
  const [pickupLocationError, setPickupLocationError] = useState('');

  const panelRef = useRef(null);
  const rideTypePanelRef = useRef(null);
  const deviceListPanelRef = useRef(null);
  const vehiclePanelRef = useRef(null);
  const confirmRidePanelRef = useRef(null);
  const vehicleFoundRef = useRef(null);
  const waitingForDriverRef = useRef(null);

  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);
  const { user } = useContext(UserDataContext);
  const authToken = getUserToken();
  const authHeaders = getUserAuthHeaders();

  const viewerCanEnterLiveRide = (nextRide) => {
    if (!nextRide || nextRide.status !== 'ongoing') {
      return false;
    }

    if (nextRide.rideType !== 'carpool') {
      return true;
    }

    return nextRide.viewerBoardingStatus !== 'awaiting_pickup';
  };

  const restoreActiveRideState = (nextRide) => {
    if (!nextRide?._id) {
      return;
    }

    setPickup(nextRide.viewerPickup || nextRide.pickup || '');
    setDestination(nextRide.viewerDestination || nextRide.destination || '');
    setRideType(nextRide.rideType || 'solo');
    setAvailableSeats(Math.max(1, Number(nextRide.viewerBookedSeats ?? nextRide.bookedSeats) || 1));
    setGenderPreference(nextRide.genderPreference || 'any');
    setVehicleType(nextRide.vehicleType || null);
    setRide(nextRide);
    setShowRideTypePanel(false);
    setShowDeviceList(false);
    setVehiclePanel(false);
    setConfirmRidePanel(false);
    resetCarpoolSelection();

    if (nextRide.status === 'pending') {
      setVehicleFound(true);
      setWaitingForDriver(false);
      return;
    }

    if (nextRide.status === 'accepted') {
      setVehicleFound(false);
      setWaitingForDriver(true);
      return;
    }

    if (nextRide.status === 'ongoing') {
      setVehicleFound(false);

      if (viewerCanEnterLiveRide(nextRide)) {
        setWaitingForDriver(false);
        navigate('/riding', { state: { ride: nextRide } });
        return;
      }

      setWaitingForDriver(true);
      return;
    }

    dismissActiveRidePanels();
  };

  const resetCarpoolSelection = () => {
    setMatchingCarpoolRides([]);
    setSelectedCarpoolRide(null);
  };

  const dismissActiveRidePanels = () => {
    setVehicleFound(false);
    setWaitingForDriver(false);
  };

  const looksLikeCoordinateString = (value = '') =>
    /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(String(value).trim());

  useEffect(() => {
    if (!rideRequestNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRideRequestNotice('');
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [rideRequestNotice]);

  useEffect(() => {
    if (!authToken || ride?._id) {
      return undefined;
    }

    let cancelled = false;

    const restoreActiveRide = async () => {
      try {
        const { data: activeRide } = await axios.get(`${import.meta.env.VITE_BASE_URL}/rides/active`, {
          headers: authHeaders,
        });

        if (!cancelled && activeRide?._id) {
          restoreActiveRideState(activeRide);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error restoring active ride:', error);
        }
      }
    };

    restoreActiveRide();

    return () => {
      cancelled = true;
    };
  }, [authToken, ride?._id]);

  useEffect(() => {
    if (!socket || !user?._id) {
      return undefined;
    }

    const handleJoin = () => {
      socket.emit('join', { userType: 'user', userId: user._id });
    };

    socket.on('connect', handleJoin);

    if (socket.connected) {
      handleJoin();
    }

    socket.on('ride-confirmed', (nextRide) => {
      dismissActiveRidePanels();
      setRideRequestNotice('');
      setWaitingForDriver(true);
      setRide(nextRide);
    });

    socket.on('ride-rejected', ({ rideId, message }) => {
      dismissActiveRidePanels();
      setRide((currentRide) => {
        if (!currentRide) {
          return null;
        }

        return !rideId || currentRide._id === rideId ? null : currentRide;
      });
      setRideRequestNotice(message || 'Ride request rejected by nearby captains.');
    });

    socket.on('ride-started', (nextRide) => {
      setRide(nextRide);

      if (viewerCanEnterLiveRide(nextRide)) {
        setWaitingForDriver(false);
        navigate('/riding', { state: { ride: nextRide } });
        return;
      }

      setVehicleFound(false);
      setWaitingForDriver(true);
    });

    socket.on('ride-updated', (updatedRide) => {
      if (!updatedRide?._id) {
        return;
      }

      setRide((currentRide) => {
        if (!currentRide || currentRide._id === updatedRide._id) {
          return updatedRide;
        }

        return currentRide;
      });
    });

    return () => {
      socket.off('connect', handleJoin);
      socket.off('ride-confirmed').off('ride-rejected').off('ride-started').off('ride-updated');
    };
  }, [socket, user?._id, navigate]);

  useEffect(() => {
    if (!ride?._id || (!vehicleFound && !waitingForDriver)) {
      return undefined;
    }

    let cancelled = false;

    const syncRideStatus = async () => {
      try {
        const { data: latestRide } = await axios.get(`${import.meta.env.VITE_BASE_URL}/rides/status`, {
          params: { rideId: ride._id },
          headers: authHeaders,
        });

        if (cancelled) {
          return;
        }

        if (latestRide?.status === 'rejected' || latestRide?.status === 'cancelled') {
          dismissActiveRidePanels();
          setRide(null);
          setRideRequestNotice('Ride request rejected by nearby captains.');
          return;
        }

        if (latestRide?.status === 'accepted' && latestRide?.captain) {
          setRide(latestRide);
          setVehicleFound(false);
          setWaitingForDriver(true);
          return;
        }

        if (latestRide?.status === 'ongoing') {
          setRide(latestRide);
          setVehicleFound(false);

          if (viewerCanEnterLiveRide(latestRide)) {
            setWaitingForDriver(false);
            navigate('/riding', { state: { ride: latestRide } });
          } else {
            setWaitingForDriver(true);
          }

          return;
        }

        if (latestRide?.status === 'completed') {
          dismissActiveRidePanels();
          setRide(latestRide);
          return;
        }

        setRide(latestRide);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error?.response?.status === 404) {
          dismissActiveRidePanels();
          setRide(null);
          setRideRequestNotice('This ride request is no longer available.');
          return;
        }

        console.error('Error syncing ride status:', error);
      }
    };

    syncRideStatus();
    const intervalId = window.setInterval(syncRideStatus, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authToken, navigate, ride?._id, vehicleFound, waitingForDriver]);

  useEffect(() => {
    const normalizedPickup = String(pickup || '').trim();
    const shouldFetchPickupSuggestions =
      panelOpen &&
      activeField === 'pickup' &&
      normalizedPickup.length >= 3 &&
      !looksLikeCoordinateString(normalizedPickup);

    if (!shouldFetchPickupSuggestions) {
      setPickupSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/maps/get-suggestions`, {
          params: { input: normalizedPickup },
          headers: authHeaders,
        });

        if (!cancelled) {
          setPickupSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error fetching pickup suggestions:', err);

        if (!cancelled) {
          setPickupSuggestions([]);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeField, authToken, panelOpen, pickup]);

  useEffect(() => {
    const normalizedDestination = String(destination || '').trim();
    const shouldFetchDestinationSuggestions =
      panelOpen &&
      activeField === 'destination' &&
      normalizedDestination.length >= 3 &&
      !looksLikeCoordinateString(normalizedDestination);

    if (!shouldFetchDestinationSuggestions) {
      setDestinationSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_BASE_URL}/maps/get-suggestions`, {
          params: { input: normalizedDestination },
          headers: authHeaders,
        });

        if (!cancelled) {
          setDestinationSuggestions(data || []);
        }
      } catch (err) {
        console.error('Error fetching destination suggestions:', err);

        if (!cancelled) {
          setDestinationSuggestions([]);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeField, authToken, destination, panelOpen]);

  const handlePickupChange = async (e) => {
    const value = e.target.value;
    setPickup(value);
    setPickupLocationError('');

    if (!value.trim()) {
      setPickupSuggestions([]);
    }
  };

  const handleUseCurrentLocation = () => {
    if (detectingPickupLocation) {
      return;
    }

    if (!navigator.geolocation) {
      setPickupLocationError('Current location is not supported on this device.');
      return;
    }

    setDetectingPickupLocation(true);
    setPickupLocationError('');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const resolvedAddress = await getAddressFromCoordinates(coords.latitude, coords.longitude, {
            role: 'user',
          });

          if (!resolvedAddress) {
            throw new Error('Address lookup returned an empty result.');
          }

          setPickup(resolvedAddress);
          setPickupSuggestions([]);
          setPanelOpen(false);
          setActiveField('pickup');
        } catch (error) {
          console.error('Error resolving current pickup location:', error);
          const fallbackPickup = `${Number(coords.latitude).toFixed(6)}, ${Number(coords.longitude).toFixed(6)}`;

          setPickup(fallbackPickup);
          setPickupSuggestions([]);
          setPanelOpen(false);
          setActiveField('pickup');
          setPickupLocationError('');
        } finally {
          setDetectingPickupLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);

        if (error?.code === 1) {
          setPickupLocationError('Location permission denied. Please allow access and try again.');
        } else if (error?.code === 2) {
          setPickupLocationError('Unable to detect your current location.');
        } else if (error?.code === 3) {
          setPickupLocationError('Location request timed out. Please try again.');
        } else {
          setPickupLocationError('Unable to use your current location right now.');
        }

        setDetectingPickupLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleDestinationChange = async (e) => {
    const value = e.target.value;
    setDestination(value);

    if (!value.trim()) {
      setDestinationSuggestions([]);
    }
  };

  const findTrip = () => {
    resetCarpoolSelection();
    setRideRequestNotice('');
    setAvailableSeats(1);
    setVehicleType(null);
    setFare({});
    setRide(null);
    setVehiclePanel(false);
    setConfirmRidePanel(false);
    setVehicleFound(false);
    setWaitingForDriver(false);
    setShowRideTypePanel(true);
    setPanelOpen(false);
  };

  const createRide = async (overrides = {}) => {
    const nextRideType = overrides.rideType ?? rideType;
    const nextVehicleType = overrides.vehicleType ?? vehicleType;
    const nextAvailableSeats = overrides.availableSeats ?? (nextRideType === 'carpool' ? availableSeats : 1);
    const nextGenderPreference = overrides.genderPreference ?? (nextRideType === 'carpool' ? genderPreference : 'any');
    const nextAllowAnyVehicleType = overrides.allowAnyVehicleType ?? false;

    const { data } = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/rides/create`,
      {
        pickup,
        destination,
        vehicleType: nextVehicleType,
        rideType: nextRideType,
        availableSeats: nextAvailableSeats,
        genderPreference: nextGenderPreference,
        allowAnyVehicleType: nextAllowAnyVehicleType,
      },
      {
        headers: authHeaders,
      }
    );

    return data;
  };

  const requestFreshCarpoolRide = async ({ fareOptions }) => {
    if (submittingRide) {
      return;
    }

    setSubmittingRide(true);
    setRideRequestNotice('');
    resetCarpoolSelection();
    setSelectedCarpoolRide(null);
    setVehicleType(null);
    setFare(fareOptions || {});
    setVehiclePanel(false);
    setConfirmRidePanel(false);
    setShowDeviceList(false);

    try {
      const createdRide = await createRide({
        vehicleType: null,
        rideType: 'carpool',
        availableSeats,
        genderPreference,
        allowAnyVehicleType: true,
      });

      setRide(createdRide);

      if (createdRide?.status === 'rejected') {
        dismissActiveRidePanels();
        setRide(null);
        setRideRequestNotice('No compatible online captain is available for this fresh shared request right now.');
        return;
      }

      setVehicleFound(true);
    } catch (error) {
      console.error('Error requesting a fresh shared ride:', error);
      if (error?.response?.data?.activeRide?._id) {
        restoreActiveRideState(error.response.data.activeRide);
      }
      setRideRequestNotice(error?.response?.data?.message || 'Unable to send your fresh shared ride request right now.');
    } finally {
      setSubmittingRide(false);
    }
  };

  const joinSelectedCarpoolRide = async () => {
    const { data } = await axios.post(
      `${import.meta.env.VITE_BASE_URL}/rides/join-carpool`,
      {
        rideId: selectedCarpoolRide?._id,
        pickup,
        destination,
        bookedSeats: availableSeats,
      },
      {
        headers: authHeaders,
      }
    );

    return data;
  };

  const confirmSelection = async () => {
    if (submittingRide) {
      return;
    }

    setSubmittingRide(true);
    setRideRequestNotice('');

      try {
        if (rideType === 'carpool' && selectedCarpoolRide?._id) {
          const joinedRide = await joinSelectedCarpoolRide();
          setRide(joinedRide);
          setConfirmRidePanel(false);
          setVehicleFound(false);
          if (viewerCanEnterLiveRide(joinedRide)) {
            setWaitingForDriver(false);
            navigate('/riding', { state: { ride: joinedRide } });
          } else {
            setWaitingForDriver(true);
          }
        } else {
        setConfirmRidePanel(false);
        const createdRide = await createRide();
        setRide(createdRide);

        if (createdRide?.status === 'rejected') {
          dismissActiveRidePanels();
          setRide(null);
          setRideRequestNotice('No compatible online captain is available for this ride request right now.');
          return;
        }

        setVehicleFound(true);
      }
    } catch (error) {
      console.error('Error confirming ride:', error);
      if (error?.response?.data?.activeRide?._id) {
        restoreActiveRideState(error.response.data.activeRide);
      }
      setRideRequestNotice(error?.response?.data?.message || 'Unable to continue with this ride right now.');
    } finally {
      setSubmittingRide(false);
    }
  };

  useGSAP(() => {
    if (!panelRef.current) {
      return;
    }

    gsap.to(panelRef.current, {
      height: panelOpen ? '65%' : '0%',
      padding: panelOpen ? 24 : 0,
    });
  }, [panelOpen]);

  useGSAP(() => {
    if (!rideTypePanelRef.current) {
      return;
    }

    gsap.to(rideTypePanelRef.current, { yPercent: showRideTypePanel ? 0 : 100 });
  }, [showRideTypePanel]);

  useGSAP(() => {
    if (!deviceListPanelRef.current) {
      return;
    }

    gsap.to(deviceListPanelRef.current, { yPercent: showDeviceList ? 0 : 100 });
  }, [showDeviceList]);

  useGSAP(() => {
    if (!vehiclePanelRef.current) {
      return;
    }

    gsap.to(vehiclePanelRef.current, { yPercent: vehiclePanel ? 0 : 100 });
  }, [vehiclePanel]);

  useGSAP(() => {
    if (!confirmRidePanelRef.current) {
      return;
    }

    gsap.to(confirmRidePanelRef.current, { yPercent: confirmRidePanel ? 0 : 100 });
  }, [confirmRidePanel]);

  useGSAP(() => {
    if (!vehicleFoundRef.current) {
      return;
    }

    gsap.to(vehicleFoundRef.current, { yPercent: vehicleFound ? 0 : 100 });
  }, [vehicleFound]);

  useGSAP(() => {
    if (!waitingForDriverRef.current) {
      return;
    }

    gsap.to(waitingForDriverRef.current, { yPercent: waitingForDriver ? 0 : 100 });
  }, [waitingForDriver]);

  return (
    <div className="flex min-h-[100svh] flex-col overflow-x-hidden bg-gray-900 text-white md:h-[100svh] md:flex-row md:overflow-hidden">
      {rideRequestNotice && (
        <div className="fixed top-4 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-50 shadow-2xl backdrop-blur">
          {rideRequestNotice}
        </div>
      )}

      <div className="order-2 relative flex w-full flex-col items-center justify-center px-4 py-5 sm:px-6 sm:py-6 md:order-1 md:w-3/5 md:px-10 md:py-8">
        <div className="w-full rounded-[30px] border border-white/10 bg-slate-950/35 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-4 md:rounded-none md:border-none md:bg-transparent md:p-0 md:shadow-none">
          <div className="mb-3 flex items-center justify-between md:hidden">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">
                Live Route Preview
              </p>
              <p className="mt-1 text-sm text-slate-300">Your route updates here while you book.</p>
            </div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
              Ready
            </div>
          </div>

          <div className="mb-4 h-[30vh] min-h-[220px] max-h-[360px] w-full overflow-hidden rounded-[24px] border border-slate-700 shadow-xl sm:min-h-[250px] md:mb-6 md:h-[52vh] md:min-h-[280px] md:max-h-[520px] md:rounded-xl">
            <RoutePreviewMap
              pickupAddress={pickup}
              destinationAddress={destination}
            />
          </div>

          <div className="md:hidden">
            <h2 className="text-2xl font-bold text-white">Welcome to Tripzzy</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Build your trip in a few taps, then keep the map in view while you decide between solo and shared rides.
            </p>
          </div>
        </div>

        <h1 className="mb-3 hidden text-center text-3xl font-bold text-yellow-400 sm:text-4xl md:mb-4 md:block md:text-5xl">
          Welcome to Tripzzy
        </h1>
        <p className="hidden max-w-lg text-center text-sm text-gray-300 sm:text-base md:block md:text-lg">
          Premium ride booking at your fingertips. Enter your trip details to begin your journey with ease and comfort.
        </p>
      </div>

      <div className="order-1 relative w-full overflow-hidden rounded-t-3xl border-t-[5px] border-amber-400 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-5 text-white shadow-2xl sm:p-6 md:order-2 md:h-[100svh] md:w-2/5 md:rounded-l-3xl md:rounded-t-none md:border-l-[5px] md:border-t-0 md:p-8">
        <div className="relative mb-5 md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                <i className="ri-road-map-line text-sm" />
                Tripzzy Mobile
              </div>
              <h2 className="mt-3 text-[1.9rem] font-bold leading-tight text-white">Book your ride on the go</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Faster booking flow, clean route entry, and live ride choices designed for smaller screens.
              </p>
            </div>

            <button
              onClick={() => {
                clearUserToken({ includeLegacy: true });
                navigate('/');
              }}
              className="shrink-0 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-100 shadow-md transition hover:bg-red-500/25"
            >
              Logout
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {['Direct rides', 'Shared seats', 'Live tracking'].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center text-[11px] font-medium text-slate-200"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            clearUserToken({ includeLegacy: true });
            navigate('/');
          }}
          className="absolute right-4 top-4 hidden rounded-lg bg-red-500 px-3 py-2 text-sm text-white shadow-md transition hover:bg-red-600 sm:px-4 md:block md:text-base"
        >
          Logout
        </button>

        <h2 className="mb-5 hidden pr-20 text-2xl font-bold text-amber-400 sm:text-3xl md:block">Book Your Ride</h2>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/45 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-sm sm:p-5 md:rounded-none md:border-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
        <form className="space-y-4 sm:space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Pick-up Location</label>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-800/75 transition focus-within:border-amber-300/70 focus-within:bg-slate-800">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-amber-300">
                <i className="ri-map-pin-2-fill" />
              </div>
              <input
                type="text"
                value={pickup}
                onChange={handlePickupChange}
                onClick={() => {
                  setPanelOpen(true);
                  setActiveField('pickup');
                }}
                className="w-full bg-transparent py-3.5 pl-12 pr-16 text-white placeholder-gray-400 transition focus:outline-none"
                placeholder="Enter your location"
              />
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={detectingPickupLocation}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-base text-amber-200 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Use current location as pickup point"
                title="Use current location"
              >
                <i className={detectingPickupLocation ? 'ri-loader-4-line animate-spin' : 'ri-navigation-fill'} />
              </button>
            </div>
            {pickupLocationError ? (
              <p className="mt-2 text-xs text-rose-300">{pickupLocationError}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Tap the pointer to auto-fill your current pickup point.</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Destination</label>
            <div className="group relative overflow-hidden rounded-2xl border border-slate-600/80 bg-slate-800/75 transition focus-within:border-amber-300/70 focus-within:bg-slate-800">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-cyan-300">
                <i className="ri-navigation-fill" />
              </div>
              <input
                type="text"
                value={destination}
                onChange={handleDestinationChange}
                onClick={() => {
                  setPanelOpen(true);
                  setActiveField('destination');
                }}
                className="w-full bg-transparent py-3.5 pl-12 pr-4 text-white placeholder-gray-400 transition focus:outline-none"
                placeholder="Enter your destination"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={findTrip}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 py-3.5 font-semibold text-slate-900 shadow-[0_16px_36px_rgba(251,191,36,0.2)] transition hover:brightness-105"
          >
            See Prices
          </button>

          <button
            type="button"
            className="w-full rounded-2xl border border-slate-600 bg-slate-800/70 py-3.5 font-semibold text-white transition hover:bg-slate-700"
          >
            Schedule for Later
          </button>
        </form>
        </div>

        {panelOpen && (
          <div ref={panelRef} className="mt-5 overflow-hidden">
            <LocationSearchPanel
              suggestions={activeField === 'pickup' ? pickupSuggestions : destinationSuggestions}
              setPanelOpen={setPanelOpen}
              setVehiclePanel={setVehiclePanel}
              setPickup={setPickup}
              setDestination={setDestination}
              activeField={activeField}
            />
          </div>
        )}
      </div>

      <div ref={rideTypePanelRef} className={rideTypePanelClass}>
        <RideTypePanel
          {...{
            rideType,
            setRideType,
            setShowRideTypePanel,
            setVehiclePanel,
            pickup,
            destination,
            setFare,
            availableSeats,
            genderPreference,
            setGenderPreference,
            setAvailableSeats,
            setShowDeviceList,
            resetCarpoolSelection,
          }}
        />
      </div>

      <div
        ref={deviceListPanelRef}
        className={`${compactDevicePanelClass} transition-opacity duration-200 ${
          showDeviceList ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <DeviceListPanel
          {...{
            pickup,
            destination,
            showDeviceList,
            availableSeats,
            setAvailableSeats,
            genderPreference,
            setVehiclePanel,
            setShowDeviceList,
            setMatchingCarpoolRides,
            setSelectedCarpoolRide,
            onRequestFreshRide: requestFreshCarpoolRide,
          }}
        />
      </div>

      <div ref={vehiclePanelRef} className={floatingPanelClass}>
        <VehiclePanel
          {...{
            selectVehicle: setVehicleType,
            fare,
            rideType,
            availableSeats,
            matchedCarpoolRides: matchingCarpoolRides,
            setSelectedCarpoolRide,
            setConfirmRidePanel,
            setVehiclePanel,
          }}
        />
      </div>

      <div ref={confirmRidePanelRef} className={floatingPanelClass}>
        <ConfirmRide
          {...{
            pickup,
            destination,
            fare,
            vehicleType,
            rideType,
            availableSeats,
            genderPreference,
            selectedCarpoolRide,
            setConfirmRidePanel,
            confirmSelection,
            submittingRide,
          }}
        />
      </div>

      <div ref={vehicleFoundRef} className={floatingPanelClass}>
        <LookingForDriver
          {...{
            pickup,
            destination,
            fare,
            ride,
            vehicleType,
            rideType,
            availableSeats,
            genderPreference,
            setVehicleFound,
          }}
        />
      </div>

      <div ref={waitingForDriverRef} className={floatingPanelClass}>
        <WaitingForDriver {...{ ride, waitingForDriver, setWaitingForDriver, setVehicleFound }} />
      </div>
    </div>
  );
};

export default Home;
