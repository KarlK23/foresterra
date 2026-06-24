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

// ---------- Verrou d'ecriture global ----------
// saveDb() remplace INTEGRALEMENT chaque collection a partir d'un instantane pris par loadDb().
// Sans verrou, deux requetes concurrentes qui font chacune loadDb() -> mutation -> saveDb() peuvent
// se chevaucher : la requete qui termine en second ecrase silencieusement les changements de l'autre
// (y compris des enregistrements qu'elle n'a jamais touches), ce qui provoque des pertes de donnees
// aleatoires (parcelles, retours ou fiches qui "disparaissent"). acquireWriteLock() serialise tous
// les cycles loadDb()->saveDb() pour que deux ecritures ne puissent jamais se chevaucher.
let _writeLockQueue = Promise.resolve();

function acquireWriteLock() {
  let release;
  const ticket = new Promise(function (resolve) { release = resolve; });
  const previous = _writeLockQueue;
  _writeLockQueue = previous.then(function () { return ticket; });
  return previous.then(function () { return release; });
}

module.exports = { loadDb, saveDb, acquireWriteLock };
