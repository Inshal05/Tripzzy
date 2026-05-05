export const vehicleImages = {
  car: '/image/vehicle-car.svg',
  moto: '/image/vehicle-moto.svg',
  auto: '/image/vehicle-auto.svg',
};

export const vehicleCatalog = {
  auto: {
    type: 'auto',
    label: 'Auto',
    name: 'TripzzyAuto',
    capacity: 3,
    wait: '3 mins away',
    desc: 'Affordable auto rides',
  },
  car: {
    type: 'car',
    label: 'Car',
    name: 'TripzzyGo',
    capacity: 4,
    wait: '2 mins away',
    desc: 'Affordable, compact rides',
  },
  moto: {
    type: 'moto',
    label: 'Moto',
    name: 'Moto',
    capacity: 1,
    wait: '3 mins away',
    desc: 'Affordable motorcycle rides',
  },
};

export const vehicleDisplayOrder = ['auto', 'car', 'moto'];

export const profileImages = {
  user: '/image/avatar-user.svg',
  captain: '/image/avatar-captain.svg',
};

export const uiImages = {
  captainDashboard: '/image/captain-dashboard.svg',
};

export const normalizeVehicleType = (vehicleType) => {
  const normalized = String(vehicleType || '').trim().toLowerCase();

  if (normalized === 'motorcycle' || normalized === 'bike') {
    return 'moto';
  }

  if (normalized === 'cab' || normalized === 'tripzzygo') {
    return 'car';
  }

  if (normalized === 'auto' || normalized === 'car' || normalized === 'moto') {
    return normalized;
  }

  return 'car';
};

export const getVehicleImage = (vehicleType) => vehicleImages[normalizeVehicleType(vehicleType)];

export const getCompatibleVehicleTypes = ({ rideType = 'solo', requiredSeats = 1 } = {}) => {
  const seatsNeeded = Math.max(1, Number(requiredSeats) || 1);

  return vehicleDisplayOrder.filter((type) => {
    const vehicle = vehicleCatalog[type];

    if (!vehicle) {
      return false;
    }

    if (rideType !== 'carpool') {
      return true;
    }

    if (type === 'moto') {
      return false;
    }

    return vehicle.capacity >= seatsNeeded;
  });
};
