/**
 * server.js — Express server. Serves the frontend from /public and exposes the API.
 * Run:  npm install  &&  npm start   -> http://localhost:3000
 */
const express = require('express');
const path = require('path');
const bank = require('./backend');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- API ---------- */
const api = express.Router();

api.get('/categories', (req, res) => res.json(bank.CATEGORIES));
api.get('/stats', (req, res) => res.json(bank.getStats()));
api.get('/board', (req, res) => res.json(bank.getBoard()));

api.post('/join', (req, res) => res.json(bank.join(req.body.name)));
api.get('/members/:name', (req, res) => res.json(bank.getMember(req.params.name)));
api.get('/ledger/:name', (req, res) => res.json(bank.getLedger(req.params.name)));

api.post('/listings', (req, res) => res.status(201).json(bank.addListing(req.body)));
api.post('/listings/:id/accept', (req, res) => res.json(bank.acceptListing(req.params.id, req.body.name)));

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

/* ---------- errors ---------- */
app.use((err, req, res, next) => {
  if (err instanceof bank.HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server problem. Please try again in a moment.' });
});

app.listen(PORT, () => console.log(`Samay Bank running on http://localhost:${PORT}`));
