const bcrypt = require("bcryptjs");
const { loadDb, saveDb } = require("./db");
function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
async function seed() {
  const db = await loadDb();
  console.log("Reinitialisation des comptes...");
  db.users = [];
  db.users.push({ id:genId("u"), username:"patron", passwordHash:bcrypt.hashSync("patron123",10), role:"patron", nom:"Patron" });
  db.users.push({ id:genId("u"), username:"marius.dalle", passwordHash:bcrypt.hashSync("acheteur123",10), role:"acheteur", nom:"Marius Dalle" });
  db.users.push({ id:genId("u"), username:"bois.co", passwordHash:bcrypt.hashSync("acheteur123",10), role:"acheteur", nom:"Bois & Co" });
  await saveDb(db);
  console.log("Comptes recrees !");
}
seed().catch(console.error).finally(()=>process.exit(0));
