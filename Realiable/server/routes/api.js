const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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
  // Attach a simple Google Static Maps image URL (note: needs API key in frontend if used)
  prop.mapImage = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(prop.address + ', ' + prop.city)}&zoom=16&size=640x320&markers=color:red%7C${encodeURIComponent(prop.address + ', ' + prop.city)}`;
  res.json(prop);
});

// POST /api/schedule - accept a timetable text or file and return a mock analysis
router.post('/schedule', upload.single('file'), (req, res) => {
  const { text } = req.body;
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
  // Here we'd call Gemini API to analyze; for now return a deterministic mock response
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
    note: 'This is a sample analysis. Replace with Gemini API integration for live responses.'
  };
  res.json({ scheduleProvided: schedule.length > 0, analysis: mockResponse });
});

module.exports = router;
