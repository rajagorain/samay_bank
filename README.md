# Samay Bank (समय बैंक)

A neighbourhood time bank: trade hours of help, not rupees.

## Run locally
npm install
npm start
Open http://localhost:3000 (Node 18+)

## Structure
- server.js        Express server + API routes
- backend.js       Bank rules, validation, JSON-file storage (data.json)
- public/          index.html, style.css, app.js

## Before deploying
data.json is wiped on many free hosts. Swap load()/save() in backend.js for a database
(MongoDB, PostgreSQL, Supabase) and add real login.
