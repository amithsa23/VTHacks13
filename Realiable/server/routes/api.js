const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const axios = require('axios');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

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
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).send('Server missing GOOGLE_MAPS_API_KEY in environment');

  // Prefer lat/lng if available because they are more reliable for map images
  const center = (prop.lat && prop.lng) ? `${prop.lat},${prop.lng}` : encodeURIComponent(prop.address + ', ' + prop.city);
  const zoom = req.query.zoom || 16;
  const size = req.query.size || '640x320';
  const markers = (prop.lat && prop.lng) ? `${prop.lat},${prop.lng}` : encodeURIComponent(prop.address + ', ' + prop.city);
  const mapsUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&markers=color:red%7C${markers}&key=${key}`;

  https.get(mapsUrl, (mapsRes) => {
    const contentType = mapsRes.headers['content-type'] || 'image/png';
    res.setHeader('Content-Type', contentType);
    // Stream the image response to the client
    mapsRes.pipe(res);
  }).on('error', (err) => {
    console.error('Error proxying map image', err);
    res.status(500).send('Failed to fetch map image');
  });
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
  // If Gemini endpoint & key are configured, call it with property context + user schedule
  const geminiEndpoint = process.env.GEMINI_API_ENDPOINT;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiEndpoint && geminiKey) {
    try {
      // Build a prompt/payload for the LLM. Adjust to match your provider's API schema.
      const props = readProperties();
      const property = props.find(p => String(p.id) === String(propertyId)) || null;
      const provider = (process.env.GEMINI_PROVIDER || '').toLowerCase();

      if (provider === 'google') {
        // Google Generative Language (PaLM) REST API
        // Requires GEMINI_API_KEY and GEMINI_MODEL environment variables.
        const model = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME || 'text-bison-001';
        const prompt = `Property: ${property ? JSON.stringify(property) : 'N/A'}\nUser schedule:\n${schedule}\n\nReturn a JSON object with keys: fitsSchedule (true/false), travelEstimates, nearby, note.`;
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generate?key=${encodeURIComponent(geminiKey)}`;
        const body = { prompt: { text: prompt }, temperature: 0.2 };
        const resp = await axios.post(googleUrl, body, { timeout: 20000 });
        // Parse candidates: resp.data.candidates[0].output or resp.data.candidates[0].content
        let raw = null;
        try {
          if (resp.data && resp.data.candidates && resp.data.candidates.length > 0) {
            raw = resp.data.candidates[0].output || resp.data.candidates[0].content && resp.data.candidates[0].content.map(c=>c.text).join('\n') || resp.data.candidates[0].text;
          } else if (resp.data && resp.data["output"] ) {
            raw = resp.data.output;
          } else {
            raw = JSON.stringify(resp.data);
          }
        } catch (e) {
          raw = JSON.stringify(resp.data || {});
        }
        // If the model returned JSON text, try to parse it; otherwise return as note
        let analysis = null;
        try {
          analysis = JSON.parse(raw);
        } catch (e) {
          analysis = { note: String(raw) };
        }
        return res.json({ scheduleProvided: schedule.length > 0, analysis });
      } else {
        // Generic remote endpoint integration
        const payload = {
          input: `Property: ${property ? JSON.stringify(property) : 'N/A'}\nUser schedule:\n${schedule}\n\nProvide a JSON analysis with keys: fitsSchedule (bool), travelEstimates, nearby, note.`,
        };
        const headers = {
          'Authorization': `Bearer ${geminiKey}`,
          'Content-Type': 'application/json'
        };
        const resp = await axios.post(geminiEndpoint, payload, { headers, timeout: 20000 });
        // Expect the LLM to return a JSON-like analysis in resp.data; adapt as needed.
        const analysis = resp.data || { note: 'Gemini returned no data' };
        return res.json({ scheduleProvided: schedule.length > 0, analysis });
      }
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
