const express = require('express');
const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const PORT = 3000;

app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASS || 'apppass',
  database: process.env.DB_NAME || 'appdb',
});

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS common_passwords (
      id SERIAL PRIMARY KEY,
      password TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "2403237" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      creation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_common_pw ON common_passwords (password)
  `);

  const result = await pool.query('SELECT COUNT(*) FROM common_passwords');
  if (Number.parseInt(result.rows[0].count) === 0) {
    const filePath = path.join(__dirname, 'common-passwords.txt');
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(function (l) { return l.trim().length > 0; });
      const batchSize = 1000;
      for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        const placeholders = batch.map(function (_, idx) { return '($' + (idx + 1) + ')'; }).join(',');
        await pool.query('INSERT INTO common_passwords (password) VALUES ' + placeholders, batch);
      }
      console.log('Loaded ' + lines.length + ' common passwords');
    }
  }
}

function validatePasswordFrontend() {
  return `
    function validatePassword() {
      var pw = document.getElementById('password').value;
      var errors = [];
      if (pw.length < 12) errors.push('Password must be at least 12 characters');
      if (pw.length > 128) errors.push('Password must not exceed 128 characters');
      if (errors.length > 0) {
        document.getElementById('error-msg').textContent = errors.join('. ');
        return false;
      }
      return true;
    }
    function togglePassword() {
      var p = document.getElementById('password');
      p.type = p.type === 'password' ? 'text' : 'password';
    }
  `;
}

async function validatePasswordBackend(password) {
  const errors = [];
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return errors;
  }
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters');
  }
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  if (password.length >= 12) {
    const result = await pool.query('SELECT 1 FROM common_passwords WHERE password = $1 LIMIT 1', [password]);
    if (result.rows.length > 0) {
      errors.push('This password is too common. Please choose a different password');
    }
  }
  return errors;
}

app.get('/', function (req, res) {
  const error = req.query.error || '';
  res.send(
    '<!DOCTYPE html><html><head><title>Home</title></head><body>' +
    '<h1>Login</h1>' +
    '<form method="POST" action="/login" onsubmit="return validatePassword()">' +
    '<label for="username">Username:</label><br>' +
    '<input type="text" id="username" name="username" required><br><br>' +
    '<label for="password">Password:</label><br>' +
    '<input type="password" id="password" name="password" required minlength="12" maxlength="128">' +
    ' <button type="button" onclick="togglePassword()">Show/Hide</button><br>' +
    '<small>Min 12 characters, max 128. Must not be a commonly used password.</small><br><br>' +
    '<button type="submit">Login</button>' +
    '</form>' +
    '<br><a href="/register">Create Account</a>' +
    '<p id="error-msg" style="color:red;">' + escapeHtml(error) + '</p>' +
    '<script>' + validatePasswordFrontend() + '</script>' +
    '</body></html>'
  );
});

app.get('/register', function (req, res) {
  const error = req.query.error || '';
  res.send(
    '<!DOCTYPE html><html><head><title>Create Account</title></head><body>' +
    '<h1>Create Account</h1>' +
    '<form method="POST" action="/register" onsubmit="return validatePassword()">' +
    '<label for="username">Username:</label><br>' +
    '<input type="text" id="username" name="username" required><br><br>' +
    '<label for="password">Password:</label><br>' +
    '<input type="password" id="password" name="password" required minlength="12" maxlength="128">' +
    ' <button type="button" onclick="togglePassword()">Show/Hide</button><br>' +
    '<small>Min 12 characters, max 128. Must not be a commonly used password.</small><br><br>' +
    '<button type="submit">Create Account</button>' +
    '</form>' +
    '<br><a href="/">Back to Login</a>' +
    '<p id="error-msg" style="color:red;">' + escapeHtml(error) + '</p>' +
    '<script>' + validatePasswordFrontend() + '</script>' +
    '</body></html>'
  );
});

app.post('/register', async function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  if (!username || !password) {
    return res.redirect('/register?error=' + encodeURIComponent('Username and password are required'));
  }
  const errors = await validatePasswordBackend(password);
  if (errors.length > 0) {
    return res.redirect('/register?error=' + encodeURIComponent(errors.join('. ')));
  }
  await pool.query('INSERT INTO "2403237" (username) VALUES ($1)', [username]);
  res.send(
    '<!DOCTYPE html><html><head><title>Welcome</title></head><body>' +
    '<h1>Welcome</h1>' +
    '<p>Account created successfully.</p>' +
    '<p>Your password: ' + escapeHtml(password) + '</p>' +
    '<form method="POST" action="/logout">' +
    '<button type="submit">Logout</button>' +
    '</form></body></html>'
  );
});

app.post('/login', async function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  if (!username || !password) {
    return res.redirect('/?error=' + encodeURIComponent('Username and password are required'));
  }
  const errors = await validatePasswordBackend(password);
  if (errors.length > 0) {
    return res.redirect('/?error=' + encodeURIComponent(errors.join('. ')));
  }
  res.send(
    '<!DOCTYPE html><html><head><title>Welcome</title></head><body>' +
    '<h1>Welcome</h1>' +
    '<p>Login successful.</p>' +
    '<form method="POST" action="/logout">' +
    '<button type="submit">Logout</button>' +
    '</form></body></html>'
  );
});

app.post('/logout', function (req, res) {
  res.redirect('/');
});

app.get('/health', function (req, res) {
  res.status(200).json({ status: 'OK' });
});

if (require.main === module) {
  initDB().then(function () {
    app.listen(PORT, '0.0.0.0', function () {
      console.log('Server running on port ' + PORT);
    });
  }).catch(function (err) {
    console.error('DB init failed:', err);
    process.exit(1);
  });
}

module.exports = { app, validatePasswordBackend, escapeHtml, pool };
