# Realiable

Local dev notes

1) Server

  cd server
  npm install
  # copy server/.env.example -> server/.env and fill in keys (do NOT commit .env)
  # Example (Windows cmd):
  # set GOOGLE_MAPS_API_KEY=your_key_here
  # set GEMINI_PROVIDER=google
  # set GEMINI_API_KEY=your_key_here
  npm run dev

2) Client

  cd client
  npm install --legacy-peer-deps
  npm run dev

Open the client dev URL printed by Vite (e.g., http://localhost:5174) and the client will call the server at http://localhost:4000/api.

Gemini / PaLM notes

- To enable live LLM responses, set `GEMINI_PROVIDER=google`, `GEMINI_API_KEY` and `GEMINI_MODEL` in `server/.env` or the environment.
- The server will call the Google Generative Language REST endpoint. If you prefer service-account authentication, I can update the server to use OAuth tokens.
Realiable - Roadmap and Setup

Overview
- This project is a Zillow-like UI for Blacksburg properties using React for the frontend and Express for the backend. Data is currently mocked via JSON. Google Static Maps image URLs are constructed server-side; Gemini (LLM) integrations are described and stubbed.

Roadmap (high level)
1. Backend
   - Provide REST endpoints: /api/properties and /api/properties/:id
   - Endpoint /api/schedule accepts a timetable (text or uploaded file) and returns an analysis (stubbed). Replace with Gemini API calls later.
2. Frontend (React)
   - PropertyList with filters and sequence view.
   - PropertyDetail shows image/map + schedule analyser panel.
   - PropertyChat enables user to send schedule text and receive agent analysis.
3. Integrations
   - Google Static Maps (requires API key) for images of property locations.
   - Gemini (or other LLM) for schedule analysis and conversational agent.

File structure (important files)
- server/
  - server.js (Express server)
  - package.json (server deps)
  - routes/api.js (API endpoints)
  - data/properties.json (mock data)
- client/
  - public/index.html
  - src/assets/components/PropertyList.jsx
  - src/assets/components/PropertyCard.jsx
  - src/assets/components/PropertyDetail.jsx
  - src/assets/components/PropertyChat.jsx

Required packages
- Server: express, cors, dotenv, multer, nodemon (dev)
- Client: React (use Create React App or Vite). Recommended: create-react-app for simplicity.

How to run locally (recommended)
1. Server
   cd server
   npm install
   # set GOOGLE_API_KEY in environment if you will construct signed static maps (not required for placeholder)
   npm run dev

2. Client (if not created yet)
   # from project root
   npx create-react-app client
   # move provided src/ and public/ into the created client app and install deps
   cd client
   npm start

Notes on Gemini and Google Maps integration
- Gemini: use the official API/SDK. Do not commit API keys. The server's /api/schedule currently returns a mock result. Replace the mockResponse with a call to the Gemini endpoint and stream or forward structured JSON results to the client.
- Google Static Maps: generate URLs with your API key and sign requests if required. Be mindful of usage limits and billing.

Next steps I can take for you
- Wire the client into a real React app (I can scaffold using CRA or Vite within this workspace).
- Implement Gemini integration with a secure server-side call pattern and example of streaming responses.
- Add unit tests and simple E2E flow.
