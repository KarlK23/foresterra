const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

function defaultDb() {
  return {
    users: [
      // patron account, password "patron123" will be hashed on first run
    ],
    parcelles: [],
    affectations: [],
    retours: [],
    pdfs: []
  };
}

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Erreur lecture DB, reinitialisation", e);
    const db = defaultDb();
    saveDb(db);
    return db;
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

module.exports = { loadDb, saveDb, DB_PATH };
