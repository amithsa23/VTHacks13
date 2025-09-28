const express = require('express');
const cors = require('cors');
const api = require('./routes/api');
// Load .env from server folder first, then fall back to repository root (so users can place .env at project root)
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const serverEnv = path.join(__dirname, '.env');
const projectEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(serverEnv)) {
	dotenv.config({ path: serverEnv });
} else if (fs.existsSync(projectEnv)) {
	dotenv.config({ path: projectEnv });
} else {
	dotenv.config();
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', api);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
