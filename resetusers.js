const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");
const MONGODB_URI = "mongodb+srv://foresterra:ForesterraVabre@cluster0.4kj8u8q.mongodb.net/foresterra?appName=Cluster0";
async function reset() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("foresterra");
  await db.collection("users").deleteMany({});
  function genId(p){ return p+"_"+Math.random().toString(36).slice(2,9); }
  await db.collection("users").insertMany([
    { id:genId("u"), username:"patron", passwordHash:bcrypt.hashSync("patron123",10), role:"patron", nom:"Patron" },
    { id:genId("u"), username:"marius.dalle", passwordHash:bcrypt.hashSync("acheteur123",10), role:"acheteur", nom:"Marius Dalle" },
    { id:genId("u"), username:"bois.co", passwordHash:bcrypt.hashSync("acheteur123",10), role:"acheteur", nom:"Bois & Co" }
  ]);
  console.log("Comptes recrees !");
  await client.close();
}
reset().catch(console.error);
