require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initialize } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/parent', require('./routes/parent'));
app.use('/api/student', require('./routes/student'));
app.use('/api/agent', require('./routes/agent'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;

initialize()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PurePain server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
