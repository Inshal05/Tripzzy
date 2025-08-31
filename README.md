# Tripzzy — Ride Sharing & Carpooling Backend + Frontend 
 
> 👉 **Live Website 🚗:** [https://tripzzyride.web.app/](https://tripzzyride.web.app/)

> Lightweight ride-booking and carpooling app (Node.js + Express backend, React + Vite frontend). This README explains how to run the project locally, environment variables, key API endpoints and development notes.

---

## Table of contents

* Project overview
* Features
* Tech stack
* Folder structure (high level)
* Requirements
* Environment variables
* Installation & run (backend)
* Installation & run (frontend)
* API reference (main endpoints)
* Real-time / sockets
* Notes, troubleshooting & tips
* Contributing
* License

---

## Project overview

Tripzzy is a ride-booking service with support for:

* User and Captain (driver) registration & authentication
* Create and manage rides (solo & carpool)
* Carpool matching and joining
* Maps integration (geocoding, suggestions, distance/time, fare estimation)
* Real-time updates via Socket.IO (carpool/ride events)

This repository contains two main parts:

* `Backend/` — Express + MongoDB API server (socket.io integration)
* `Frontend/` — Vite + React UI (uses Google Maps client libraries)

---

## Features

* Register / Login for Users and Captains
* Create ride requests (solo or carpool)
* Carpool creation (by captain) and join (by users)
* Geocoding and autocomplete using Google Maps API
* Fare calculation endpoints
* Socket-driven real-time events (join carpool, ride updates)

---

## Tech stack

* Backend: Node.js, Express, Mongoose (MongoDB), Socket.IO
* Frontend: React + Vite, Tailwind (UI utilities), @react-google-maps/api
* External: Google Maps APIs (Geocoding & Places/Autocomplete)

---

## High level folder structure

```
/Backend        # Express API, socket server
/Frontend       # React (Vite) app
README.md
```

Inside `Backend/` you will find `routes/`, `controllers/`, `services/`, `models/` and `socket.js`.

---

## Requirements

* Node.js (v16+ recommended)
* npm or yarn
* MongoDB (local or remote) — service must be reachable via connection string
* Google Maps API key (Geocoding & Places/Autocomplete enabled)

---

## Environment variables

Create a `.env` file in `Backend/` (there is an example `.env` in the repository). The following variables are used:

```
DB_CONNECT=mongodb://localhost:27017/tripzzy   # MongoDB connection string
JWT_SECRET=your_jwt_secret_here                # JWT secret for tokens
GOOGLE_MAPS_API=YOUR_GOOGLE_MAPS_API_KEY       # API key for geocoding/autocomplete
PORT=3000                                      # (optional) backend port
```

> **Security note:** Do not commit secrets (JWT, API keys) into source control.

---

## Install & run — Backend

1. Open a terminal and `cd` into the backend folder:

```bash
cd Backend
```

2. Install dependencies:

```bash
npm install
```

3. Ensure MongoDB is running and `.env` variables are set.

4. Start the server:

```bash
npm start
# or
node server.js
```

The backend listens on the port specified by `PORT` (default `3000`).

API base URL (development): `http://localhost:3000`

---

## Install & run — Frontend

1. Open another terminal and `cd` into the frontend folder:

```bash
cd Frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

Vite will serve the frontend (often on `http://localhost:5173` by default). Configure the frontend to point to the backend base URL if needed (check `src` for where API base is set).

---

## API reference — quick summary

All backend routes are mounted at the top-level paths shown below (base = `http://localhost:3000`):

### Users

* `POST /users/register` — register a user (body: `fullname`, `email`, `password`)
* `POST /users/login` — login (body: `email`, `password`) — returns token cookie
* `GET  /users/profile` — get logged-in user profile (requires auth)
* `GET  /users/logout` — logout (clears token and blacklists it)

### Captains (drivers)

* `POST /captains/register` — register a captain (vehicle details included)
* `POST /captains/login` — captain login
* `GET  /captains/profile` — get logged-in captain profile
* `GET  /captains/logout` — logout captain

### Maps

* `GET /maps/get-coordinates?address=...` — geocode an address (lat/lng)
* `GET /maps/get-distance-time?origin=...&destination=...` — distance/time and estimated fare helper
* `GET /maps/get-suggestions?input=...` — autocomplete suggestions (Places API)

### Rides

* `POST /rides/create` — create a ride request (requires auth)
* `GET  /rides/get-fare` — get fare estimate
* `GET  /rides/carPoolFare` — carpool fare estimate
* `POST /rides/confirm` — confirm/accept a ride
* `GET  /rides/start-ride?rideId=...&otp=...` — start ride (OTP verification)
* `POST /rides/end-ride` — end ride

### Carpools

* `GET  /carpools/matches` — find carpool matches (pickup/destination etc.)
* `POST /carpools/create` — create carpool (captain)
* `POST /carpools/join` — join a carpool (user)

> See route files in `Backend/routes/` and controllers in `Backend/controllers/` for full request/response details and validation logic.

---

## Real-time (Socket.IO)

The backend initializes a Socket.IO server. The sockets are used to emit events such as:

* `carpool-updated` — after a successful join or update
* `joined-carpool` — emit to socket joining user
* Ride status updates (emit patterns in `socket.js`)

When running locally, the socket server is attached to the same HTTP server as the Express API.

---

## Notes, troubleshooting & tips

* **MongoDB connection failed:** check `DB_CONNECT` and ensure `mongod` is running or use a remote MongoDB URI.
* **Missing API key:** Google Maps endpoints require a valid API key with the relevant APIs enabled (Geocoding and Places).
* **Auth token issues:** Tokens are set in cookies. Ensure the frontend sends cookies along with requests (`credentials: "include"` in `fetch`/axios).
* **Port conflict:** Set `PORT` in `.env` or run with `PORT=4000 npm start`.

---

## Contributing

If you'd like to contribute:

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Add tests (if applicable) and code
4. Open a PR describing changes

---

## License

This repository does not include an explicit license file. Add a `LICENSE` if you plan to share under a specific license (MIT, Apache-2.0, etc.).

---

If you'd like, I can:

* generate a more detailed API reference (with example `curl`/`HTTPie` requests and sample JSON payloads),
* create Postman collection (or an OpenAPI spec) for the endpoints,
* or improve the frontend `README` with deployment instructions.

Tell me which of these you'd like next.



