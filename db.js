const { MongoClient } = require("mongodb");
const MONGODB_URI = process.env.MONGODB_URI;
let _client = null;
let _db = null;

async function getDb() {
  if (_db) return _db;
  _client = new MongoClient(MONGODB_URI);
  await _client.connect();
  _db = _client.db("foresterra");
  return _db;
}

async function loadDb() {
  const db = await getDb();
  const users = await db.collection("users").find({}).toArray();
  const parcelles = await db.collection("parcelles").find({}).toArray();
  const affectations = await db.collection("affectations").find({}).toArray();
  const retours = await db.collection("retours").find({}).toArray();
  const pdfs = await db.collection("pdfs").find({}).toArray();
  const notifications = await db.collection("notifications").find({}).toArray();
  return { users, parcelles, affectations, retours, pdfs, notifications };
}

const _COLLECTIONS = ["users", "parcelles", "affectations", "retours", "pdfs", "notifications"];

async function _replaceAllCollections(mdb, db, session) {
  const opts = session ? { session } : {};
  for (const col of _COLLECTIONS) {
    await mdb.collection(col).deleteMany({}, opts);
    if (db[col] && db[col].length > 0) {
      await mdb.collection(col).insertMany(db[col], opts);
    }
  }
}

// Optimiste au depart : on suppose que le serveur Mongo supporte les
// transactions (c'est le cas de tout cluster Atlas, meme M0, car Atlas est
// toujours un replica set). Si une premiere tentative echoue parce que le
// serveur est un mongod autonome (dev local sans replica set), on bascule
// definitivement sur le mode sans transaction pour ce process.
let _transactionsSupported = true;

async function saveDb(db) {
  const mdb = await getDb();

  if (_transactionsSupported) {
    const session = _client.startSession();
    try {
      await session.withTransaction(async function () {
        await _replaceAllCollections(mdb, db, session);
      });
      return;
    } catch (err) {
      const msg = (err && err.message) || "";
      if (err && (err.code === 20 || /Transaction numbers|Transactions are not supported/i.test(msg))) {
        console.warn("Transactions Mongo non supportees par ce serveur (pas de replica set) - bascule en mode non transactionnel pour saveDb().");
        _transactionsSupported = false;
      } else {
        throw err;
      }
    } finally {
      await session.endSession();
    }
  }

  // Repli : sans transaction (serveur standalone). Reste protege par
  // acquireWriteLock() cote appelant contre les ecritures concurrentes,
  // mais une coupure en cours d'ecriture peut laisser les collections dans
  // un etat incoherent - cas attendu uniquement en dev local sans replica set.
  await _replaceAllCollections(mdb, db, null);
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
