const request = require('supertest');
const { app, pool } = require('./server');

afterAll(async () => {
  await pool.end();
});

describe('Routes', () => {
  test('GET / returns home page with login form', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Login');
    expect(res.text).toContain('username');
    expect(res.text).toContain('password');
  });

  test('GET /register returns account creation page', async () => {
    const res = await request(app).get('/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Create Account');
  });

  test('POST /register with short password redirects with error', async () => {
    const res = await request(app)
      .post('/register')
      .send({ username: 'testuser', password: 'short' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error');
  });

  test('POST /register with empty fields redirects with error', async () => {
    const res = await request(app)
      .post('/register')
      .send({ username: '', password: '' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error');
  });

  test('POST /login with short password redirects with error', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'testuser', password: 'short' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error');
  });

  test('POST /logout redirects to home', async () => {
    const res = await request(app).post('/logout');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('GET /health returns OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});
