const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const {Readable} = require("stream");
cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { loadDb, saveDb, acquireWriteLock } = require("./db");
const { mergeRetour } = require("./lib/mergeRetour");

const app = express();
const PORT = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Railway (et toute plateforme derriere un reverse proxy) doit etre signale a
// Express pour que req.ip / req.secure refletent le client reel (en-tetes
// X-Forwarded-*), sinon les cookies "secure" et le rate-limiting par IP ne
// fonctionnent pas correctement.
app.set("trust proxy", 1);

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn(
    "ATTENTION: la variable d'environnement SESSION_SECRET n'est pas definie. " +
    "Un secret temporaire a ete genere pour cette execution uniquement " +
    "(toutes les sessions seront invalidees au prochain redemarrage). " +
    "Definissez SESSION_SECRET dans les variables d'environnement Railway pour la production."
  );
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction
    }
  })
);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

// ---------- NOTIFICATIONS ----------
const NOTIFICATIONS_MAX = 500; // plafond global, evite une croissance illimitee

function pushNotification(db, userId, message, parcelleId, acheteurId) {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  db.notifications.push({
    id: genId("n"),
    userId: userId,
    message: message,
    parcelleId: parcelleId || null,
    acheteurId: acheteurId || null,
    read: false,
    date: new Date().toISOString()
  });
  if (db.notifications.length > NOTIFICATIONS_MAX) {
    db.notifications = db.notifications.slice(db.notifications.length - NOTIFICATIONS_MAX);
  }
}

// ---------- AUTH HELPERS ----------
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Non authentifie" });
  next();
}

function requirePatron(req, res, next) {
  if (!req.session.user || req.session.user.role !== "patron") {
    return res.status(403).json({ error: "Acces reserve au patron" });
  }
  next();
}

// ---------- RATE LIMITING (anti brute-force sur /api/login) ----------
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 8;
const _loginAttempts = new Map(); // ip -> { count, resetAt }

function loginRateLimiter(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  let entry = _loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS };
    _loginAttempts.set(key, entry);
  }
  if (entry.count >= LOGIN_RATE_LIMIT_MAX) {
    const waitMin = Math.max(1, Math.ceil((entry.resetAt - now) / 60000));
    return res.status(429).json({ error: "Trop de tentatives de connexion. Reessayez dans " + waitMin + " min." });
  }
  entry.count++;
  next();
}

// Purge periodique pour eviter une fuite memoire sur un serveur de longue duree
setInterval(function () {
  const now = Date.now();
  for (const [key, entry] of _loginAttempts) {
    if (entry.resetAt < now) _loginAttempts.delete(key);
  }
}, 10 * 60 * 1000);

// ---------- AUTH ROUTES ----------
app.post("/api/login", loginRateLimiter, async function (req, res) {
  const { username, password } = req.body;
  const db = await loadDb();
  const user = db.users.find(function (u) {
    return u.username === username;
  });

  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role, nom: user.nom };
  res.json({ user: req.session.user });
});

app.post("/api/logout", async function (req, res) {
  req.session.destroy(function () {
    res.json({ ok: true });
  });
});

app.get("/api/me", async function (req, res) {
  res.json({ user: req.session.user || null });
});

// ---------- CHANGEMENT DE MOT DE PASSE ----------
app.post("/api/me/password", requireAuth, async function (req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 4 caracteres" });
  }
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const user = db.users.find(function (u) { return u.id === req.session.user.id; });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (!bcrypt.compareSync(currentPassword || "", user.passwordHash)) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

// ---------- PATRON: GESTION ACHETEURS ----------
app.get("/api/acheteurs", requireAuth, async function (req, res) {
  const db = await loadDb();
  const acheteurs = db.users
    .filter(function (u) {
      return u.role === "acheteur";
    })
    .map(function (u) {
      return { id: u.id, username: u.username, nom: u.nom };
    });
  res.json({ acheteurs: acheteurs });
});

app.post("/api/acheteurs", requirePatron, async function (req, res) {
  const { username, password, nom } = req.body;
  if (!username || !password || !nom) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    if (db.users.find(function (u) { return u.username === username; })) {
      return res.status(409).json({ error: "Cet identifiant existe deja" });
    }

    const newUser = {
      id: genId("u"),
      username: username,
      passwordHash: bcrypt.hashSync(password, 10),
      role: "acheteur",
      nom: nom
    };
    db.users.push(newUser);
    await saveDb(db);

    res.json({ acheteur: { id: newUser.id, username: newUser.username, nom: newUser.nom } });
  } finally {
    release();
  }
});

app.delete("/api/acheteurs/:id", requirePatron, async function (req, res) {
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const id = req.params.id;
    db.users = db.users.filter(function (u) {
      return u.id !== id;
    });
    db.affectations = db.affectations.filter(function (a) {
      return a.acheteurId !== id;
    });
    db.retours = db.retours.filter(function (r) {
      return r.acheteurId !== id;
    });
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

app.patch("/api/acheteurs/:id/password", requirePatron, async function (req, res) {
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 4 caracteres" });
  }
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const id = req.params.id;
    const user = db.users.find(function (u) {
      return u.id === id && u.role === "acheteur";
    });
    if (!user) return res.status(404).json({ error: "Compte acheteur introuvable" });
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

// ---------- PDF UPLOAD ----------
app.post("/api/pdfs", requirePatron, async function (req, res) {
  upload.single("pdf")(req, res, function (err) {
    if (err) return res.status(500).json({ error: "Erreur upload: " + err.message });
    if (!req.file) return res.status(400).json({ error: "Aucun fichier" });
    const id = genId("pdf");
    const {Readable} = require("stream");
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "raw", public_id: id, folder: "foresterra", use_filename: true, unique_filename: false },
      async function(error, result) {
        if (error) return res.status(500).json({ error: "Cloudinary: " + error.message });
        const release = await acquireWriteLock();
        try {
          const db = await loadDb();
          if (!Array.isArray(db.pdfs)) db.pdfs = [];
          const pdfEntry = { id, originalName: req.file.originalname, filename: result.secure_url, uploadedAt: new Date().toISOString() };
          db.pdfs.push(pdfEntry);
          await saveDb(db);
          res.json({ pdf: pdfEntry });
        } finally {
          release();
        }
      }
    );
    require("stream").Readable.from(req.file.buffer).pipe(stream);
  });
});

app.get("/api/pdfs", requireAuth, async function (req, res) {
  const db = await loadDb();
  res.json({ pdfs: db.pdfs || [] });
});

app.delete("/api/pdfs/:id", requirePatron, async function (req, res) {
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const id = req.params.id;
    const pdfEntry = db.pdfs.find(function (p) { return p.id === id; });
    if (pdfEntry) {
      const filePath = path.join(UPLOADS_DIR, pdfEntry.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.pdfs = db.pdfs.filter(function (p) { return p.id !== id; });
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

// ---------- PARCELLES ----------
app.get("/api/parcelles", requireAuth, async function (req, res) {
  const db = await loadDb();
  const user = req.session.user;

  if (user.role === "patron") {
    return res.json({
      parcelles: db.parcelles,
      affectations: db.affectations,
      retours: db.retours
    });
  }

  // acheteur: only his assigned parcelles + his own retours
  const mesAffectations = db.affectations.filter(function (a) {
    return a.acheteurId === user.id;
  });
  const mesIds = mesAffectations.map(function (a) { return a.parcelleId; });
  const mesParcelles = db.parcelles.filter(function (p) {
    return mesIds.indexOf(p.id) !== -1;
  });
  const mesRetours = db.retours.filter(function (r) {
    return r.acheteurId === user.id;
  });

  res.json({ parcelles: mesParcelles, retours: mesRetours });
});

app.post("/api/parcelles", requirePatron, async function (req, res) {
  const { lignes, pdfId, pageNums } = req.body;
  if (!Array.isArray(lignes)) return res.status(400).json({ error: "lignes doit etre un tableau" });

  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const maxOrdre = db.parcelles.reduce(function (m, p) {
      return Math.max(m, p.ordre || 0);
    }, 0);

    let ordre = maxOrdre;
    const created = [];
    lignes.forEach(function (label, i) {
      const trimmed = String(label).trim();
      if (!trimmed) return;
      ordre += 1;
      const pageNum = Array.isArray(pageNums) && pageNums[i] ? parseInt(pageNums[i]) : null;
      const p = { id: genId("p"), label: trimmed, ordre: ordre, pdfId: pdfId || null, pageNum: pageNum };
      db.parcelles.push(p);
      created.push(p);
    });

    await saveDb(db);
    res.json({ parcelles: created });
  } finally {
    release();
  }
});

app.delete("/api/parcelles/:id", requirePatron, async function (req, res) {
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const id = req.params.id;
    db.parcelles = db.parcelles.filter(function (p) { return p.id !== id; });
    db.affectations = db.affectations.filter(function (a) { return a.parcelleId !== id; });
    db.retours = db.retours.filter(function (r) { return r.parcelleId !== id; });
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

// ---------- AFFECTATIONS ----------
app.post("/api/affectations", requirePatron, async function (req, res) {
  const { parcelleId, acheteurId, assign } = req.body;
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();

    const exists = db.affectations.find(function (a) {
      return a.parcelleId === parcelleId && a.acheteurId === acheteurId;
    });

    if (assign) {
      if (!exists) {
        db.affectations.push({ parcelleId: parcelleId, acheteurId: acheteurId });
      }
    } else {
      db.affectations = db.affectations.filter(function (a) {
        return !(a.parcelleId === parcelleId && a.acheteurId === acheteurId);
      });
    }

    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

// ---------- RETOURS (acheteur) ----------
app.post("/api/retours", requireAuth, async function (req, res) {
  const user = req.session.user;
  if (user.role !== "acheteur") return res.status(403).json({ error: "Reserve aux acheteurs" });

  const { parcelleId, description, estimation, achete, prix, statut, fiche, ficheEFC } = req.body;
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();

    // verify assignment
    const isAssigned = db.affectations.find(function (a) {
      return a.parcelleId === parcelleId && a.acheteurId === user.id;
    });
    if (!isAssigned) return res.status(403).json({ error: "Parcelle non assignee" });

    let retour = db.retours.find(function (r) {
      return r.parcelleId === parcelleId && r.acheteurId === user.id;
    });
    const isNew = !retour;
    const histLenBefore = retour && Array.isArray(retour.history) ? retour.history.length : 0;

    retour = mergeRetour(
      retour,
      { parcelleId: parcelleId, acheteurId: user.id, description: description, estimation: estimation, achete: achete, prix: prix, statut: statut, fiche: fiche, ficheEFC: ficheEFC },
      genId,
      undefined,
      { nom: user.nom, role: "acheteur" }
    );
    if (isNew) db.retours.push(retour);

    if (retour.history.length > histLenBefore) {
      const parcelle = db.parcelles.find(function (p) { return p.id === parcelleId; });
      const label = parcelle ? parcelle.label : "une parcelle";
      db.users.filter(function (u) { return u.role === "patron"; }).forEach(function (patron) {
        pushNotification(db, patron.id, (user.nom || "Un acheteur") + " a mis a jour \"" + label + "\"", parcelleId, user.id);
      });
    }

    await saveDb(db);
    res.json({ retour: retour });
  } finally {
    release();
  }
});

// ---------- USERS (pour affichage noms dans vue patron) ----------
app.get("/api/users-map", requireAuth, async function (req, res) {
  const db = await loadDb();
  const map = {};
  db.users.forEach(function (u) {
    map[u.id] = u.nom;
  });
  res.json({ map: map });
});

// ---------- PARCELLES ACHETEUR (l'acheteur crée ses propres parcelles) ----------
app.post("/api/parcelles-acheteur", requireAuth, async function (req, res) {
  const user = req.session.user;
  if (user.role !== "acheteur") return res.status(403).json({ error: "Réservé aux acheteurs" });

  const { lignes, pdfId, pageNums } = req.body;
  let idx = -1;
  if (!Array.isArray(lignes)) return res.status(400).json({ error: "lignes doit être un tableau" });

  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const maxOrdre = db.parcelles.reduce(function(m, p) { return Math.max(m, p.ordre || 0); }, 0);

    let ordre = maxOrdre;
    const created = [];
    lignes.forEach(function(label) {
      idx++;
      const trimmed = String(label).trim();
      if (!trimmed) return;
      // Éviter les doublons pour cet acheteur
      const exists = db.parcelles.find(function(p) {
        return p.label === trimmed && p.pdfId === (pdfId || null) &&
          db.affectations.find(function(a) { return a.parcelleId === p.id && a.acheteurId === user.id; });
      });
      if (exists) { created.push(exists); return; }
      ordre += 1;
      const pNum = Array.isArray(pageNums) && pageNums[idx] ? parseInt(pageNums[idx]) : null;
      const p = { id: genId("p"), label: trimmed, ordre: ordre, pdfId: pdfId || null, pageNum: pNum };
      db.parcelles.push(p);
      created.push(p);
    });

    // Auto-assigner à cet acheteur
    const newAffectations = [];
    created.forEach(function(p) {
      const exists = db.affectations.find(function(a) { return a.parcelleId === p.id && a.acheteurId === user.id; });
      if (!exists) {
        const aff = { parcelleId: p.id, acheteurId: user.id };
        db.affectations.push(aff);
        newAffectations.push(aff);
      }
    });

    await saveDb(db);
    res.json({ parcelles: created, affectations: newAffectations });
  } finally {
    release();
  }
});

// ---------- RETOURS PATRON (modification par le patron) ----------
app.post("/api/retours-patron", requirePatron, async function (req, res) {
  const { parcelleId, acheteurId, description, estimation, achete, prix, statut, fiche, ficheEFC } = req.body;
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();

    // Vérifier que la parcelle existe
    const parcelle = db.parcelles.find(function(p) { return p.id === parcelleId; });
    if (!parcelle) return res.status(404).json({ error: "Parcelle introuvable" });

    let retour = db.retours.find(function (r) {
      return r.parcelleId === parcelleId && r.acheteurId === acheteurId;
    });
    const isNew = !retour;
    const histLenBefore = retour && Array.isArray(retour.history) ? retour.history.length : 0;

    retour = mergeRetour(
      retour,
      { parcelleId: parcelleId, acheteurId: acheteurId, description: description, estimation: estimation, achete: achete, prix: prix, statut: statut, fiche: fiche, ficheEFC: ficheEFC },
      genId,
      undefined,
      { nom: req.session.user.nom, role: "patron" }
    );
    if (isNew) db.retours.push(retour);

    if (retour.history.length > histLenBefore) {
      pushNotification(db, acheteurId, (req.session.user.nom || "Le patron") + " a mis a jour \"" + parcelle.label + "\"", parcelleId, acheteurId);
    }

    await saveDb(db);
    res.json({ retour: retour });
  } finally {
    release();
  }
});


// ---------- NOTIFICATIONS ----------
app.get("/api/notifications", requireAuth, async function (req, res) {
  const db = await loadDb();
  const mine = (db.notifications || [])
    .filter(function (n) { return n.userId === req.session.user.id; })
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
    .slice(0, 50);
  res.json({ notifications: mine });
});

app.post("/api/notifications/:id/read", requireAuth, async function (req, res) {
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    const n = (db.notifications || []).find(function (x) { return x.id === req.params.id && x.userId === req.session.user.id; });
    if (!n) return res.status(404).json({ error: "Notification introuvable" });
    n.read = true;
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

app.post("/api/notifications/read-all", requireAuth, async function (req, res) {
  const release = await acquireWriteLock();
  try {
    const db = await loadDb();
    (db.notifications || []).forEach(function (n) {
      if (n.userId === req.session.user.id) n.read = true;
    });
    await saveDb(db);
    res.json({ ok: true });
  } finally {
    release();
  }
});

// ---------- PROXY PDF CLOUDINARY ----------
app.get("/api/proxy-pdf", requireAuth, function(req, res) {
  var url = req.query.url;
  if (!url || !url.startsWith("https://res.cloudinary.com/")) {
    return res.status(400).json({ error: "URL invalide" });
  }
  var https = require("https");
  https.get(url, function(r) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    r.pipe(res);
  }).on("error", function(e) {
    res.status(500).json({ error: e.message });
  });
});
// ---------- FALLBACK ----------
app.get("/*splat", async function (req, res) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------- GESTION GLOBALE DES ERREURS (toujours renvoyer du JSON pour /api) ----------
app.use(function (err, req, res, next) {
  console.error("Erreur serveur:", err);
  if (req.path.indexOf("/api/") === 0) {
    return res.status(500).json({ error: "Erreur serveur: " + (err.message || "inconnue") });
  }
  res.status(500).send("Erreur serveur");
});

app.use(function(req,res,next){res.setTimeout(300000);next()});
app.listen(PORT, function () {
    console.log("Foresterra app demarree sur http://localhost:" + PORT);
});
