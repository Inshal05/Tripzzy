# Tripzzy Ride

Tripzzy Ride is a full-stack ride-booking web app with separate rider and captain flows, real-time ride updates, live location sharing, and support for both solo and carpool bookings.

🌐 **Live App:** [tripzzyride.web.app](https://tripzzyride.web.app)

🎥 **Demo Video:** [Watch Demo](https://drive.google.com/file/d/1Yg4f5fcBfPIzoD11N74T7VpnnC5D2rJy/view?usp=drivesdk)

## Overview

This repository contains:

- `Frontend/` - the Vite + React client deployed to Firebase Hosting
- `Backend/` - the Express + MongoDB + Socket.IO API used for auth, rides, maps, and live updates

Tripzzy is designed around a mobile-first booking experience. Riders can create solo or shared trips, preview routes, track captains live, and complete OTP-based ride handoff. Captains can go online, receive requests in real time, accept or reject rides, and complete pickups and drop-offs from a dedicated dashboard.

## Core Features

- Rider and captain authentication with JWT-based sessions
- Solo ride booking with vehicle selection for `auto`, `car`, and `moto`
- Carpool flow with seat selection, gender preference, and shared-fare calculation
- Route-matched carpool suggestions for riders before creating a new shared trip
- Real-time ride request, confirmation, rejection, and ride-status updates via Socket.IO
- Live captain location sharing during an active trip
- OTP verification before ride start and passenger pickup confirmation for carpool trips
- Ola Maps-powered route rendering with backend-side routing/geocoding helpers
- Firebase-ready frontend deployment configuration

## Tech Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- React Router
- Axios
- Socket.IO Client
- Ola Maps Web SDK
- GSAP

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO
- JWT + bcryptjs
- express-validator
- Axios

## Project Structure

```text
Tripzzy Ride/
|-- Frontend/
|   |-- src/
|   |   |-- Pages/
|   |   |-- components/
|   |   |-- context/
|   |   |-- hooks/
|   |   `-- utils/
|   |-- public/
|   |-- firebase.json
|   `-- package.json
|-- Backend/
|   |-- controllers/
|   |-- db/
|   |-- middlewares/
|   |-- models/
|   |-- routes/
|   |-- services/
|   |-- validators/
|   |-- app.js
|   |-- server.js
|   `-- package.json
`-- README.md
```

## Main Flows

### Rider flow

- Sign up or log in as a user
- Enter pickup and destination
- Choose between a private ride or a shared carpool ride
- Review fare estimates and route preview
- Wait for captain assignment or join a matching live carpool
- Use the generated OTP when the trip starts
- Track trip status and captain location in real time

### Captain flow

- Sign up or log in as a captain
- Register vehicle details during onboarding
- Toggle availability on the captain dashboard
- Receive ride requests in real time
- Accept or reject requests
- Verify OTP to start a ride
- Confirm shared-passenger pickup and complete the ride

## Local Setup

### Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB connection string
- Ola Maps API key

### 1. Install dependencies

```bash
cd Backend
npm install

cd ../Frontend
npm install
```

### 2. Create backend environment file

Create `Backend/.env`:

```env
PORT=5000
NODE_ENV=development
DB_CONNECT=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
OLA_MAPS_API_KEY=your_ola_maps_api_key
NOMINATIM_USER_AGENT=Tripzzy/1.0 (+https://tripzzyride.web.app)
NOMINATIM_REFERER=https://tripzzyride.web.app
OSRM_USER_AGENT=Tripzzy/1.0 (+https://tripzzyride.web.app)
```

### 3. Create frontend environment file

Create `Frontend/.env`:

```env
VITE_BASE_URL=http://localhost:5000
VITE_OLA_MAPS_API_KEY=your_ola_maps_api_key
VITE_OLA_MAP_STYLE_ID=default-light-standard
VITE_USE_OLA_RENDERER=false
```

## Running the App

Start the backend:

```bash
cd Backend
npm start
```

Start the frontend in a second terminal:

```bash
cd Frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Available Scripts

### Frontend

- `npm run dev` - start the Vite dev server
- `npm run build` - create a production build
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint

### Backend

- `npm start` - start the Express + Socket.IO server

## API Areas

The backend is organized around these route groups:

- `/users` - user registration, login, profile, logout
- `/captains` - captain registration, login, profile, availability, logout
- `/maps` - coordinates, reverse geocoding, autocomplete, route, distance/time
- `/rides` - create ride, fare lookup, carpool matching, join carpool, confirm/reject/start/end ride
- `/carpools` - separate carpool management endpoints

## Deployment Notes

### Frontend

The frontend already includes `Frontend/firebase.json` for Firebase Hosting. Build the app with:

```bash
cd Frontend
npm run build
```

Then deploy the generated `dist/` folder with Firebase.

### Backend

When deploying the backend, make sure:

- your host supports WebSockets for Socket.IO
- the frontend origin is added to the CORS allowlists in `Backend/app.js` and `Backend/socket.js`
- `VITE_BASE_URL` points to the deployed backend base URL

## Important Notes

- The app expects the backend base URL without a forced `/api` prefix.
- Socket connections reuse the same backend base URL and strip `/api` if you add it in frontend envs.
- Ola Maps is required for the full map experience in the frontend.
- There is currently no real automated test suite configured in the repo.

## Current Live Deployment

- Frontend: [https://tripzzyride.web.app](https://tripzzyride.web.app)

