const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, account_type, grade_level } = req.body;

  if (!name || !email || !password || !account_type) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!['parent', 'student'].includes(account_type)) {
    return res.status(400).json({ error: 'Invalid account type' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash, account_type, grade_level) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, account_type, grade_level',
      [name, email.toLowerCase().trim(), hash, account_type, grade_level || null]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, account_type: user.account_type, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, account_type: user.account_type, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, account_type: user.account_type, grade_level: user.grade_level } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
