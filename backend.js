/**
 * backend.js — all the "bank rules" live here.
 * Storage is a simple JSON file (data.json) so you can run with zero setup.
 * When you deploy for real, swap load()/save() for MongoDB / PostgreSQL / Supabase.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'data.json');
const WELCOME_HOURS = 2;
const CATEGORIES = ['Teaching', 'Tech help', 'Cooking', 'Repairs', 'Care', 'Paperwork', 'Language', 'Garden'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- storage ---------- */

function seed() {
  const now = Date.now();
  const listing = (type, title, category, hours, area, owner, details, ago) => ({
    id: crypto.randomUUID(),
    type, title, category, hours, area, owner, details,
    status: 'open',
    createdAt: new Date(now - ago * 3600 * 1000).toISOString()
  });
  return {
    members: [
      { name: 'Lakshmi Aunty', hours: 4 },
      { name: 'Imran Sheikh', hours: 3 },
      { name: 'Meena Joshi', hours: 2 },
      { name: 'Arjun Rao', hours: 2 }
    ],
    listings: [
      listing('offer', 'I will fill your online forms (PAN, passport, ration card)', 'Paperwork', 1, 'B-Wing', 'Lakshmi Aunty', 'Bring your documents. I will sit with you and explain each step.', 2),
      listing('request', 'Need help reading a rental agreement before I sign', 'Paperwork', 1, 'Main road', 'Arjun Rao', 'Just a second pair of eyes for clauses on deposit and notice period.', 5),
      listing('offer', 'Excel basics for your shop accounts', 'Tech help', 2, 'Park side', 'Imran Sheikh', 'Sheets, simple formulas and a monthly hisaab template.', 9),
      listing('offer', 'Learn to roll soft phulkas that puff up', 'Cooking', 1, 'Lane 4', 'Meena Joshi', 'Evening slots. You bring the atta, I bring the tawa.', 20),
      listing('request', 'Leaking tap in the kitchen needs a new washer', 'Repairs', 1, 'B-Wing', 'Meena Joshi', 'I have the washer. I need someone who knows how to fit it.', 26),
      listing('request', 'Someone to walk with my father in the evening', 'Care', 2, 'Park side', 'Imran Sheikh', 'He is 74 and walks slowly. Around 6 pm, near the garden.', 30),
      listing('offer', 'Spoken English practice for job interviews', 'Language', 1, 'Lane 4', 'Arjun Rao', 'Mock interview and honest feedback.', 40)
    ],
    ledger: []
  };
}

function load() {
  if (!fs.existsSync(DB_FILE)) save(seed());
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/* ---------- helpers ---------- */

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
const findMember = (db, name) => db.members.find((m) => sameName(m.name, clean(name, 40)));

function requireMember(db, name) {
  const member = findMember(db, name);
  if (!member) throw new HttpError(404, 'Member not found. Join the bank first.');
  return member;
}

const plural = (n) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

/* ---------- public API ---------- */

function join(rawName) {
  const name = clean(rawName, 40);
  if (name.length < 2) throw new HttpError(400, 'Enter your name (at least 2 letters).');
  const db = load();
  let member = findMember(db, name);
  let created = false;
  if (!member) {
    member = { name, hours: WELCOME_HOURS };
    db.members.push(member);
    save(db);
    created = true;
  }
  return { member, created };
}

function getMember(name) {
  return requireMember(load(), name);
}

function getBoard() {
  return load()
    .listings.filter((l) => l.status === 'open')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function addListing(input) {
  const db = load();
  const owner = requireMember(db, input.owner);

  const type = input.type === 'request' ? 'request' : input.type === 'offer' ? 'offer' : null;
  const title = clean(input.title, 70);
  const details = clean(input.details, 200);
  const area = clean(input.area, 40);
  const hours = Number(input.hours);

  if (!type) throw new HttpError(400, 'Choose whether you are offering or asking for help.');
  if (title.length < 4) throw new HttpError(400, 'Write a short title (at least 4 letters).');
  if (!CATEGORIES.includes(input.category)) throw new HttpError(400, 'Pick a category.');
  if (!Number.isInteger(hours) || hours < 1 || hours > 8) throw new HttpError(400, 'Hours must be a whole number from 1 to 8.');
  if (!area) throw new HttpError(400, 'Add your area, such as a lane, wing or society.');

  const listing = {
    id: crypto.randomUUID(),
    type, title, category: input.category, hours, area, details,
    owner: owner.name,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  db.listings.push(listing);
  save(db);
  return listing;
}

/**
 * Accepting an OFFER   -> the person accepting pays the owner.
 * Accepting a REQUEST  -> the owner pays the person who helps.
 */
function acceptListing(id, rawName) {
  const db = load();
  const me = requireMember(db, rawName);
  const listing = db.listings.find((l) => l.id === id);

  if (!listing) throw new HttpError(404, 'This slip no longer exists.');
  if (listing.status !== 'open') throw new HttpError(409, 'Someone already took this one.');
  if (sameName(listing.owner, me.name)) throw new HttpError(400, 'You cannot accept your own slip.');

  const owner = requireMember(db, listing.owner);
  const payer = listing.type === 'offer' ? me : owner;
  const earner = listing.type === 'offer' ? owner : me;

  if (payer.hours < listing.hours) {
    const who = payer === me ? 'You have' : `${payer.name} has`;
    throw new HttpError(402, `${who} only ${plural(payer.hours)} in the passbook. Help a neighbour to earn more.`);
  }

  payer.hours -= listing.hours;
  earner.hours += listing.hours;
  listing.status = 'done';
  listing.acceptedBy = me.name;

  db.ledger.push({
    id: crypto.randomUUID(),
    from: payer.name,
    to: earner.name,
    hours: listing.hours,
    title: listing.title,
    at: new Date().toISOString()
  });
  save(db);

  const message =
    listing.type === 'offer'
      ? `Booked with ${owner.name}. ${plural(listing.hours)} moved out of your passbook.`
      : `Thank you for helping ${owner.name}. ${plural(listing.hours)} added to your passbook.`;
  return { message, member: me };
}

function getLedger(name) {
  const db = load();
  const me = requireMember(db, name);
  return db.ledger
    .filter((e) => sameName(e.from, me.name) || sameName(e.to, me.name))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 30);
}

function getStats() {
  const db = load();
  return {
    members: db.members.length,
    open: db.listings.filter((l) => l.status === 'open').length,
    hoursExchanged: db.ledger.reduce((sum, e) => sum + e.hours, 0)
  };
}

module.exports = {
  HttpError, CATEGORIES,
  join, getMember, getBoard, addListing, acceptListing, getLedger, getStats
};
