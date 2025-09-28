const express = require('express');
const cors = require('cors');
const path = require('path');
const api = require('./routes/api');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', api);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
