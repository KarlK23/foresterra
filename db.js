const { MongoClient } = require("mongodb");
const MONGODB_URI = process.env.MONGODB_URI;
let _db = null;

async function getDb() {
  if (_db) return _db;
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  _db = client.db("foresterra");
  return _db;
}

async function loadDb() {
  const db = await getDb();
  const users = await db.collection("users").find({}).toArray();
  const parcelles = await db.collection("parcelles").find({}).toArray();
  const affectations = await db.collection("affectations").find({}).toArray();
  const retours = await db.collection("retours").find({}).toArray();
  const pdfs = await db.collection("pdfs").find({}).toArray();
  return { users, parcelles, affectations, retours, pdfs };
}

async function saveDb(db) {
  const mdb = await getDb();
  for (const col of ["users","parcelles","affectations","retours","pdfs"]) {
    await mdb.collection(col).deleteMany({});
    if (db[col] && db[col].length > 0) {
      await mdb.collection(col).insertMany(db[col]);
    }
  }
}

module.exports = { loadDb, saveDb };
