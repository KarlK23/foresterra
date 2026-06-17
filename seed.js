const bcrypt = require("bcryptjs");
const { loadDb, saveDb } = require("./db");
function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
async function seed() {
  const db = await loadDb();
  if (db.users.length === 0) {
    console.log("Initialisation des comptes par defaut...");
    db.users.push({
      id: genId("u"),
      username: "patron",
      passwordHash: bcrypt.hashSync("patron123", 10),
      role: "patron",
      nom: "Patron"
    });
    db.users.push({
      id: genId("u"),
      username: "marius.dalle",
      passwordHash: bcrypt.hashSync("acheteur123", 10),
      role: "acheteur",
      nom: "Marius Dalle"
    });
    db.users.push({
      id: genId("u"),
      username: "bois.co",
      passwordHash: bcrypt.hashSync("acheteur123", 10),
      role: "acheteur",
      nom: "Bois & Co"
    });
    await saveDb(db);
    console.log("Comptes crees :");
    console.log("  Patron -> identifiant: patron / mot de passe: patron123");
    console.log("  Acheteur 1 -> identifiant: marius.dalle / mot de passe: acheteur123");
    console.log("  Acheteur 2 -> identifiant: bois.co / mot de passe: acheteur123");
    console.log("Pensez a changer ces mots de passe (page Admin > Acheteurs).");
  } else {
    console.log("La base de donnees existe deja, aucun changement.");
  }
}
seed().catch(console.error).finally(()=>process.exit(0));
