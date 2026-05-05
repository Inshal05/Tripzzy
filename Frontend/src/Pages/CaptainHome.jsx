import React, { useRef, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import axios from 'axios';

import CaptainDetails from '../components/CaptainDetails';
import RidePopUp from '../components/RidePopUp';
import ConfirmRidePopUp from '../components/ConfirmRidePopUp';
import LiveTracking from '../components/LiveTracking';
import { SocketContext } from '../context/SocketContext';
import { CaptainDataContext } from '../context/CapatainContext';
import useCaptainLocationSharing from '../hooks/useCaptainLocationSharing';
import { clearCaptainToken, getCaptainAuthHeaders } from '../utils/authStorage';

const CaptainHome = () => {
  const [ridePopupPanel, setRidePopupPanel] = useState(false);
  const [confirmRidePopupPanel, setConfirmRidePopupPanel] = useState(false);
  const [ride, setRide] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const [captainPosition, setCaptainPosition] = useState(null);
  const [pickupRouteMetrics, setPickupRouteMetrics] = useState(null);

  const ridePopupPanelRef = useRef(null);
  const confirmRidePopupPanelRef = useRef(null);

  const { socket } = useContext(SocketContext);
  const { captain, setCaptain } = useContext(CaptainDataContext);
  const navigate = useNavigate();
  const captainFirstName = captain?.fullname?.firstname?.trim();
  const isCaptainOnline = captain?.status === 'active';

  useCaptainLocationSharing({
    captainId: captain?._id,
    socket,
    isEnabled: isCaptainOnline,
    onLocationChange: setCaptainPosition,
  });

  useEffect(() => {
    if (!ride?.pickup) {
      setPickupRouteMetrics(null);
    }
  }, [ride?.pickup]);

  useEffect(() => {
    if (!captain?._id || !socket || !isCaptainOnline) {
      return undefined;
    }

    const handleConnect = () => {
      socket.emit('join', {
        userId: captain._id,
        userType: 'captain',
      });
    };

    socket.on('connect', handleConnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [captain?._id, isCaptainOnline, socket]);
  
  useEffect(() => {
    if (!availabilityNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setAvailabilityNotice('');
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [availabilityNotice]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleNewRide = (data) => {
      if (!isCaptainOnline) {
        return;
      }

      setRide(data);
      setRidePopupPanel(true);
    };

    socket.on('new-ride', handleNewRide);
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
      socket.off('new-ride', handleNewRide);
      socket.off('ride-updated');
    };
  }, [isCaptainOnline, socket]);

  const handleToggleAvailability = async () => {
    if (!captain?._id || availabilityLoading) {
      return;
    }

    const nextStatus = isCaptainOnline ? 'inactive' : 'active';
    setAvailabilityLoading(true);
    setAvailabilityNotice('');

    try {
      const { data } = await axios.patch(
        `${import.meta.env.VITE_BASE_URL}/captains/status`,
        {
          status: nextStatus,
        },
        {
          headers: getCaptainAuthHeaders(),
        }
      );

      if (data?.captain?._id) {
        setCaptain(data.captain);
      } else {
        setCaptain((currentCaptain) => currentCaptain
          ? {
              ...currentCaptain,
              status: nextStatus,
            }
          : currentCaptain);
      }

      if (nextStatus === 'active' && socket) {
        if (!socket.connected) {
          socket.connect();
        }

        socket.emit('join', {
          userId: captain._id,
          userType: 'captain',
        });
        setAvailabilityNotice('You are online now and can receive nearby ride requests.');
        return;
      }

      setRidePopupPanel(false);
      setConfirmRidePopupPanel(false);
      setRide(null);
      setAvailabilityNotice('You are offline now and hidden from new rider requests.');
    } catch (error) {
      console.error('Failed to update captain availability:', error);
      alert(error?.response?.data?.message || 'Unable to update your availability right now.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.get(`${import.meta.env.VITE_BASE_URL}/captains/logout`, {
        headers: getCaptainAuthHeaders(),
      });
    } catch (error) {
      console.error('Captain logout failed:', error);
    } finally {
      setCaptain(null);
      clearCaptainToken({ includeLegacy: true });
      navigate('/');
    }
  };

  const confirmRide = async () => {
    if (!ride?._id || decisionLoading) {
      return;
    }

    setDecisionLoading(true);

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/rides/confirm`,
        {
          rideId: ride._id,
          captainId: captain._id,
        },
        {
          headers: getCaptainAuthHeaders(),
        }
      );

      setRide(data);
      setRidePopupPanel(false);
      setConfirmRidePopupPanel(true);
    } catch (error) {
      console.error('Failed to confirm ride:', error);
      alert(error?.response?.data?.message || 'Failed to accept this ride request.');
    } finally {
      setDecisionLoading(false);
    }
  };

  const rejectRide = async () => {
    if (!ride?._id || decisionLoading) {
      return;
    }

    setDecisionLoading(true);

    try {
      await axios.post(
        `${import.meta.env.VITE_BASE_URL}/rides/reject`,
        {
          rideId: ride._id,
        },
        {
          headers: getCaptainAuthHeaders(),
        }
      );

      setRidePopupPanel(false);
      setConfirmRidePopupPanel(false);
      setRide(null);
    } catch (error) {
      console.error('Failed to reject ride:', error);
      alert(error?.response?.data?.message || 'Failed to reject this ride request.');
    } finally {
      setDecisionLoading(false);
    }
  };

  useGSAP(() => {
    if (ridePopupPanelRef.current) {
      gsap.to(ridePopupPanelRef.current, {
        transform: ridePopupPanel ? 'translateY(0)' : 'translateY(100%)',
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }, [ridePopupPanel]);

  useGSAP(() => {
    if (confirmRidePopupPanelRef.current) {
      gsap.to(confirmRidePopupPanelRef.current, {
        transform: confirmRidePopupPanel ? 'translateY(0)' : 'translateY(100%)',
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }, [confirmRidePopupPanel]);

  const hasPickupRoute = Boolean(ride?.pickup);
  const mapHeading = hasPickupRoute
    ? confirmRidePopupPanel
      ? 'Head to pickup'
      : 'Incoming ride route'
    : 'Captain live map';
  const mapSubheading = hasPickupRoute
    ? ride?.pickup
    : isCaptainOnline
      ? 'You are online. Keep location access enabled to receive nearby trips.'
      : 'Go online to start receiving nearby trip requests.';
  const heroTitle = captainFirstName ? `Welcome ${captainFirstName}` : 'Welcome';
  const heroDescription = hasPickupRoute
    ? 'Live route is visible above so you can reach the passenger pickup without switching screens.'
    : isCaptainOnline
      ? 'You are live for ride requests. Stay online to keep receiving nearby trips on Tripzzy.'
      : 'Switch yourself online when you are ready to receive rides and start earning.';

  return (
    <div className="flex min-h-[100svh] flex-col overflow-x-hidden bg-gray-950 text-white md:h-[100svh] md:flex-row md:overflow-hidden">
      <div className="relative flex w-full flex-col items-center justify-center p-5 sm:p-6 md:w-3/5 md:p-10">
        <div className="relative mb-5 h-[34vh] min-h-[240px] max-h-[420px] w-full overflow-hidden rounded-xl border border-slate-700 shadow-lg sm:min-h-[280px] md:mb-6 md:h-[400px] md:max-h-none">
          <LiveTracking
            source={captainPosition}
            destination={hasPickupRoute ? ride?.pickup : null}
            trackedCaptainId={captain?._id}
            captainPositionOverride={captainPosition}
            followCaptain
            authRole="captain"
            onDistanceDurationChange={hasPickupRoute ? setPickupRouteMetrics : undefined}
            showSourceMarker={false}
            showDestinationMarker={false}
            gestureHandlingMode="greedy"
            suppressDirectionsMarkers={!hasPickupRoute}
            captainMarker={{
              fillColor: '#facc15',
              glyph: 'C',
              title: 'Captain live location',
              zIndex: 60,
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.18),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.08)_0%,_rgba(2,6,23,0.18)_55%,_rgba(2,6,23,0.5)_100%)]" />

          <div className="absolute left-4 top-4 right-4 flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-[75%] rounded-2xl border border-white/15 bg-slate-950/78 px-4 py-3 shadow-xl backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300/80">
                {mapHeading}
              </p>
              <p className="mt-1 text-sm font-medium text-white sm:text-base">
                {mapSubheading}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-slate-950/78 px-4 py-3 text-right shadow-xl backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
                Status
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {hasPickupRoute ? 'Navigating to rider' : isCaptainOnline ? 'Online and ready' : 'Offline'}
              </p>
            </div>
          </div>

          {hasPickupRoute ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-cyan-300/15 bg-slate-950/82 px-4 py-3 shadow-xl backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
                    Pickup ETA
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {pickupRouteMetrics?.durationText || 'Syncing live ETA'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
                    Distance
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {pickupRouteMetrics?.distanceText || 'Syncing route'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-slate-950/78 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur-md">
              Your live location stays visible here. As soon as a rider request arrives, this map will switch to the pickup route automatically.
            </div>
          )}
        </div>
        <h1 className="mb-3 text-center text-3xl font-bold text-yellow-400 sm:text-4xl md:mb-4 md:text-5xl">{heroTitle}</h1>
        <p className="max-w-xl text-center text-sm text-gray-300 sm:text-base md:text-lg">
          {heroDescription}
        </p>
      </div>

      <div className="relative w-full rounded-t-3xl border-t-[5px] border-amber-400 bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-6 shadow-2xl sm:px-6 sm:py-8 md:h-[100svh] md:w-2/5 md:rounded-l-3xl md:rounded-t-none md:border-l-[5px] md:border-t-0">
        <div className="absolute left-5 right-5 top-4 flex items-center justify-between gap-4 md:left-auto md:right-5 md:top-5 md:justify-start">
          <img src="/image/trippzy.png" alt="Tripzzy" className="h-9 sm:h-10" />
          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white shadow hover:bg-red-700 sm:px-4 md:text-base"
          >
            Logout
          </button>
        </div>

        <div className="mt-14 sm:mt-16">
          <CaptainDetails
            onToggleAvailability={handleToggleAvailability}
            availabilityLoading={availabilityLoading}
            availabilityNotice={availabilityNotice}
          />
        </div>
      </div>

      <div
        ref={ridePopupPanelRef}
        className="fixed inset-x-0 bottom-0 z-30 w-full max-h-[88svh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-gradient-to-br from-slate-800/90 to-slate-900/90 px-4 py-6 text-white shadow-lg backdrop-blur-md sm:px-5 sm:py-7 md:inset-x-auto md:right-4 md:bottom-4 md:w-[min(32rem,38vw)] md:max-h-[calc(100vh-2rem)] md:rounded-3xl md:px-6 md:py-8"
      >
        <RidePopUp
          ride={ride}
          setRidePopupPanel={setRidePopupPanel}
          setConfirmRidePopupPanel={setConfirmRidePopupPanel}
          confirmRide={confirmRide}
          rejectRide={rejectRide}
          decisionLoading={decisionLoading}
        />
      </div>

      <div
        ref={confirmRidePopupPanelRef}
        className="fixed inset-x-0 bottom-0 z-40 w-full max-h-[88svh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-gradient-to-br from-slate-800/90 to-slate-900/90 px-4 py-6 text-white shadow-lg backdrop-blur-md sm:px-5 sm:py-7 md:inset-x-auto md:right-4 md:bottom-4 md:w-[min(32rem,38vw)] md:max-h-[calc(100vh-2rem)] md:rounded-3xl md:px-6 md:py-8"
      >
        <ConfirmRidePopUp
          ride={ride}
          setConfirmRidePopupPanel={setConfirmRidePopupPanel}
          setRidePopupPanel={setRidePopupPanel}
        />
      </div>
    </div>
  );
};

export default CaptainHome;
