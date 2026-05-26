require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initialize } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/parent', require('./routes/parent'));
app.use('/student', require('./routes/student'));
app.use('/agent', require('./routes/agent'));

const PORT = process.env.PORT || 3001;

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
