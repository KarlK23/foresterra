const bcrypt = require("bcryptjs");
const { loadDb, saveDb } = require("./db");
function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
async function seed() {
  const db = await loadDb();
  const hash1 = bcrypt.hashSync("patron123", 10);
  const hash2 = bcrypt.hashSync("acheteur123", 10);
  console.log("Hash patron:", hash1);
  console.log("Hash acheteur:", hash2);
  db.users = [
    { id:genId("u"), username:"patron", passwordHash:hash1, role:"patron", nom:"Patron" },
    { id:genId("u"), username:"marius.dalle", passwordHash:hash2, role:"acheteur", nom:"Marius Dalle" },
    { id:genId("u"), username:"bois.co", passwordHash:hash2, role:"acheteur", nom:"Bois & Co" }
  ];
  await saveDb(db);
  console.log("OK - comptes recrees");
}
seed().catch(console.error).finally(()=>process.exit(0));
