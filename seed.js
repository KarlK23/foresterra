const bcrypt = require("bcryptjs");
const { loadDb, saveDb } = require("./db");
function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
async function seed() {
  const db = await loadDb();

  // Garde-fou : ce script ecrasait auparavant TOUS les comptes a chaque
  // execution. Il etait meme lance automatiquement a chaque deploiement
  // Railway (voir railway.json), ce qui supprimait silencieusement tout
  // acheteur cree depuis l'interface. Desormais il ne fait rien si des
  // utilisateurs existent deja, sauf --force explicite.
  const force = process.argv.includes("--force");
  if (db.users && db.users.length > 0 && !force) {
    console.log("Des utilisateurs existent deja (" + db.users.length + "). Seed ignore.");
    console.log("Utilisez 'node seed.js --force' pour forcer la reinitialisation (ATTENTION : supprime tous les comptes existants).");
    return;
  }

  const hash1 = bcrypt.hashSync("patron123", 10);
  const hash2 = bcrypt.hashSync("acheteur123", 10);
  db.users = [
    { id:genId("u"), username:"patron", passwordHash:hash1, role:"patron", nom:"Patron" },
    { id:genId("u"), username:"marius.dalle", passwordHash:hash2, role:"acheteur", nom:"Marius Dalle" },
    { id:genId("u"), username:"bois.co", passwordHash:hash2, role:"acheteur", nom:"Bois & Co" }
  ];
  await saveDb(db);
  console.log("OK - comptes initiaux crees (patron123 / acheteur123 a changer immediatement)");
}
seed().catch(console.error).finally(()=>process.exit(0));
