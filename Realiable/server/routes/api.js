const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

// Helper: escape text for use inside XML/SVG
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[&<>\"']/g, function (c) {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&apos;';
    }
  });
}

// Helper: find the first balanced JSON object string in text
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

function readProperties() {
  const file = path.join(__dirname, '..', 'data', 'properties.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

// Root info route to help with 'Cannot GET /api/' errors
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'API is up. Available endpoints list below.',
    endpoints: ['/api/properties', '/api/properties/:id', '/api/schedule']
  });
});

// GET /api/properties?city=Blacksburg&minPrice=&maxPrice=&beds=
router.get('/properties', (req, res) => {
  let props = readProperties();
  const { city, minPrice, maxPrice, beds } = req.query;
  if (city) props = props.filter(p => p.city.toLowerCase() === city.toLowerCase());
  if (minPrice) props = props.filter(p => p.price >= Number(minPrice));
  if (maxPrice) props = props.filter(p => p.price <= Number(maxPrice));
  if (beds) props = props.filter(p => p.beds >= Number(beds));
  res.json(props);
});

// GET /api/properties/:id
router.get('/properties/:id', (req, res) => {
  const props = readProperties();
  const prop = props.find(p => String(p.id) === String(req.params.id));
  if (!prop) return res.status(404).json({ error: 'Not found' });
  // Use a server-side proxied map image endpoint to avoid exposing API keys to the client.
  prop.mapImage = `/api/map/${prop.id}`;
  res.json(prop);
});

// GET /api/map/:id - proxy a Google Static Maps image for a property (server-side, keeps API key secret)
router.get('/map/:id', (req, res) => {
  const props = readProperties();
  const prop = props.find(p => String(p.id) === String(req.params.id));
  if (!prop) return res.status(404).send('Not found');
  // No Google Maps API key required: return a simple SVG placeholder image with the address.
  const w = 640;
  const h = 320;
  const address = (prop.address ? `${prop.address}, ` : '') + (prop.city || '');
  const label = `${prop.title || 'Property'}\n${address}`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" fill="#e8eef6" />
    <g transform="translate(20,40)">
      <rect x="0" y="0" width="${w-40}" height="${h-80}" rx="12" ry="12" fill="#ffffff" stroke="#cbd6e6"/>
      <text x="20" y="40" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#1f3b73">${escapeXml(prop.title || 'Property')}</text>
      <text x="20" y="70" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#23365b">${escapeXml(address)}</text>
      <circle cx="${w-120}" cy="${h/2 - 10}" r="18" fill="#ff6b6b" />
      <text x="${w-120}" y="${h/2 - 6}" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#fff" text-anchor="middle">📍</text>
    </g>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// POST /api/schedule - accept a timetable text or file and return a mock analysis
router.post('/schedule', upload.single('file'), async (req, res) => {
  const { text, propertyId } = req.body;
  // If a file was uploaded, read its contents (for small files only)
  let fileText = null;
  if (req.file) {
    try {
      fileText = fs.readFileSync(req.file.path, 'utf8');
    } catch (e) {
      // ignore
    }
  }
  const schedule = text || fileText || '';
  // If a Gemini API key is configured, call the LLM with property context + user schedule.
  // For the Google provider (PaLM) we only need GEMINI_API_KEY + GEMINI_PROVIDER=google.
  // For generic remote endpoints, GEMINI_API_ENDPOINT must also be set.
  const geminiEndpoint = process.env.GEMINI_API_ENDPOINT;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const props = readProperties();
      const property = props.find(p => String(p.id) === String(propertyId)) || null;
      const provider = (process.env.GEMINI_PROVIDER || '').toLowerCase();
      const model = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME || 'text-bison-001';
      const prompt = `You are given a property and a user's weekly schedule. Return ONLY a single valid JSON object (no surrounding text) following this exact schema:\n{\n  "fitsSchedule": boolean,\n  "travelEstimates": { "driveMinutes": number, "transitMinutes": number, "walkMinutes": number },\n  "nearby": { "groceries": [ { "name": string, "distanceMiles": number } ], "schools": [ { "name": string, "distanceMiles": number } ] },\n  "note": string\n}\n\nInputs:\nProperty: ${property ? JSON.stringify(property) : 'N/A'}\nUser schedule:\n${schedule}\n\nGuidance:\n- If the property has lat/lng, estimate straight-line distances to POIs and convert to estimated travel minutes using reasonable local assumptions (driving ~30 mph, transit depends on local schedules — estimate conservatively, walking ~3 mph).\n- If the schedule includes addresses or named places, use them as destinations to estimate commute times; otherwise, provide reasonable local estimates to common amenities.\n- Keep numeric distances in miles (one decimal) and travelMinutes as whole numbers.\n- Do not include any additional fields or explanatory text. If uncertain, return conservative estimates and put uncertainties in the note field.`;

      let raw = null;
      if (provider === 'google') {
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generate?key=${encodeURIComponent(geminiKey)}`;
        const body = { prompt: { text: prompt }, temperature: 0.2 };
        const resp = await axios.post(googleUrl, body, { timeout: 20000 });
        try {
          if (resp.data && resp.data.candidates && resp.data.candidates.length > 0) {
            raw = resp.data.candidates[0].output || (resp.data.candidates[0].content && resp.data.candidates[0].content.map(c => c.text).join('\n')) || resp.data.candidates[0].text;
          } else if (resp.data && resp.data.output) {
            raw = resp.data.output;
          } else {
            raw = JSON.stringify(resp.data);
          }
        } catch (e) {
          raw = JSON.stringify(resp.data || {});
        }
      } else {
        // Generic remote endpoint integration
        if (!geminiEndpoint) {
          console.warn('GEMINI_API_ENDPOINT not set but GEMINI_API_KEY is present; generic provider requires GEMINI_API_ENDPOINT.');
          throw new Error('GEMINI_API_ENDPOINT required for generic provider');
        }
        const payload = { input: prompt };
        const headers = { 'Authorization': `Bearer ${geminiKey}`, 'Content-Type': 'application/json' };
        const resp = await axios.post(geminiEndpoint, payload, { headers, timeout: 20000 });
        raw = (typeof resp.data === 'string') ? resp.data : JSON.stringify(resp.data);
      }

      const extracted = extractJSON(raw);
      let analysis = null;
      if (extracted) {
        try { analysis = JSON.parse(extracted); } catch (e) { analysis = { note: String(raw) }; }
      } else {
        try { analysis = JSON.parse(raw); } catch (e) { analysis = { note: String(raw) }; }
      }
      return res.json({ scheduleProvided: schedule.length > 0, analysis });
    } catch (err) {
      console.error('Error calling Gemini endpoint', err && err.message);
      // fall back to mock
    }
  }

  // Fallback deterministic mock response when Gemini is not configured or call fails
  const mockResponse = {
    fitsSchedule: true,
    travelEstimates: {
      driveMinutes: 12,
      transitMinutes: 25,
      walkMinutes: 45
    },
    nearby: {
      groceries: [
        { name: 'Food Lion', distanceMiles: 0.8 },
        { name: 'Harris Teeter', distanceMiles: 1.3 }
      ],
      schools: [
        { name: 'Blacksburg Elementary', distanceMiles: 1.0 }
      ]
    },
    note: 'This is a sample analysis. Set GEMINI_API_ENDPOINT and GEMINI_API_KEY in .env to enable real LLM responses.'
  };
  res.json({ scheduleProvided: schedule.length > 0, analysis: mockResponse });
});

module.exports = router;
