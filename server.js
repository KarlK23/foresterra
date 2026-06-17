const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { loadDb, saveDb } = require("./db");

const app = express();
const PORT = process.env.PORT || 8080;

const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

app.use(
  session({
    secret: "forestera-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 jours
  })
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const id = genId("pdf");
    cb(null, id + ".pdf");
  }
});
const upload = multer({ storage: storage, limits: { fileSize: 100 * 1024 * 1024 } });

function genId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
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

// ---------- AUTH ROUTES ----------
app.post("/api/login", function (req, res) {
  const { username, password } = req.body;
  const db = loadDb();
  const user = db.users.find(function (u) {
    return u.username === username;
  });

  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
  }

  req.session.user = { id: user.id, username: user.username, role: user.role, nom: user.nom };
  res.json({ user: req.session.user });
});

app.post("/api/logout", function (req, res) {
  req.session.destroy(function () {
    res.json({ ok: true });
  });
});

app.get("/api/me", function (req, res) {
  res.json({ user: req.session.user || null });
});

// ---------- PATRON: GESTION ACHETEURS ----------
app.get("/api/acheteurs", requireAuth, function (req, res) {
  const db = loadDb();
  const acheteurs = db.users
    .filter(function (u) {
      return u.role === "acheteur";
    })
    .map(function (u) {
      return { id: u.id, username: u.username, nom: u.nom };
    });
  res.json({ acheteurs: acheteurs });
});

app.post("/api/acheteurs", requirePatron, function (req, res) {
  const { username, password, nom } = req.body;
  if (!username || !password || !nom) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  const db = loadDb();
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
  saveDb(db);

  res.json({ acheteur: { id: newUser.id, username: newUser.username, nom: newUser.nom } });
});

app.delete("/api/acheteurs/:id", requirePatron, function (req, res) {
  const db = loadDb();
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
  saveDb(db);
  res.json({ ok: true });
});

// ---------- PDF UPLOAD ----------
app.post("/api/pdfs", requirePatron, function (req, res) {
  upload.single("pdf")(req, res, function (err) {
    if (err) {
      console.error("Erreur upload PDF:", err);
      return res.status(500).json({ error: "Erreur upload: " + err.message });
    }

    if (!req.file) return res.status(400).json({ error: "Aucun fichier" });

    try {
      const db = loadDb();
      if (!Array.isArray(db.pdfs)) db.pdfs = [];

      const pdfEntry = {
        id: path.parse(req.file.filename).name,
        originalName: req.file.originalname,
        filename: req.file.filename,
        uploadedAt: new Date().toISOString()
      };
      db.pdfs.push(pdfEntry);
      saveDb(db);

      res.json({ pdf: pdfEntry });
    } catch (e) {
      console.error("Erreur sauvegarde PDF:", e);
      res.status(500).json({ error: "Erreur serveur: " + e.message });
    }
  });
});

app.get("/api/pdfs", requireAuth, function (req, res) {
  const db = loadDb();
  res.json({ pdfs: db.pdfs || [] });
});

app.delete("/api/pdfs/:id", requirePatron, function (req, res) {
  const db = loadDb();
  const id = req.params.id;
  const pdfEntry = db.pdfs.find(function (p) { return p.id === id; });
  if (pdfEntry) {
    const filePath = path.join(UPLOADS_DIR, pdfEntry.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.pdfs = db.pdfs.filter(function (p) { return p.id !== id; });
  saveDb(db);
  res.json({ ok: true });
});

// ---------- PARCELLES ----------
app.get("/api/parcelles", requireAuth, function (req, res) {
  const db = loadDb();
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

app.post("/api/parcelles", requirePatron, function (req, res) {
  const { lignes, pdfId, pageNums } = req.body;
  if (!Array.isArray(lignes)) return res.status(400).json({ error: "lignes doit etre un tableau" });

  const db = loadDb();
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

  saveDb(db);
  res.json({ parcelles: created });
});

app.delete("/api/parcelles/:id", requirePatron, function (req, res) {
  const db = loadDb();
  const id = req.params.id;
  db.parcelles = db.parcelles.filter(function (p) { return p.id !== id; });
  db.affectations = db.affectations.filter(function (a) { return a.parcelleId !== id; });
  db.retours = db.retours.filter(function (r) { return r.parcelleId !== id; });
  saveDb(db);
  res.json({ ok: true });
});

// ---------- AFFECTATIONS ----------
app.post("/api/affectations", requirePatron, function (req, res) {
  const { parcelleId, acheteurId, assign } = req.body;
  const db = loadDb();

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

  saveDb(db);
  res.json({ ok: true });
});

// ---------- RETOURS (acheteur) ----------
app.post("/api/retours", requireAuth, function (req, res) {
  const user = req.session.user;
  if (user.role !== "acheteur") return res.status(403).json({ error: "Reserve aux acheteurs" });

  const { parcelleId, description, estimation, achete, prix, statut, fiche } = req.body;
  const db = loadDb();

  // verify assignment
  const isAssigned = db.affectations.find(function (a) {
    return a.parcelleId === parcelleId && a.acheteurId === user.id;
  });
  if (!isAssigned) return res.status(403).json({ error: "Parcelle non assignee" });

  let retour = db.retours.find(function (r) {
    return r.parcelleId === parcelleId && r.acheteurId === user.id;
  });

  if (!retour) {
    retour = { id: genId("r"), parcelleId: parcelleId, acheteurId: user.id };
    db.retours.push(retour);
  }

  retour.description = description || "";
  retour.statut = statut || "";
  retour.fiche = fiche || retour.fiche || null;
  retour.estimation = estimation || "";
  retour.achete = !!achete;
  retour.prix = achete ? (prix || "") : "";
  retour.date = new Date().toISOString();

  saveDb(db);
  res.json({ retour: retour });
});

// ---------- USERS (pour affichage noms dans vue patron) ----------
app.get("/api/users-map", requireAuth, function (req, res) {
  const db = loadDb();
  const map = {};
  db.users.forEach(function (u) {
    map[u.id] = u.nom;
  });
  res.json({ map: map });
});

// ---------- PARCELLES ACHETEUR (l'acheteur crée ses propres parcelles) ----------
app.post("/api/parcelles-acheteur", requireAuth, function (req, res) {
  const user = req.session.user;
  if (user.role !== "acheteur") return res.status(403).json({ error: "Réservé aux acheteurs" });

  const { lignes, pdfId, pageNums } = req.body;
  let idx = -1;
  if (!Array.isArray(lignes)) return res.status(400).json({ error: "lignes doit être un tableau" });

  const db = loadDb();
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

  saveDb(db);
  res.json({ parcelles: created, affectations: newAffectations });
});

// ---------- RETOURS PATRON (modification par le patron) ----------
app.post("/api/retours-patron", requirePatron, function (req, res) {
  const { parcelleId, acheteurId, description, estimation, achete, prix, statut, fiche } = req.body;
  const db = loadDb();

  // Vérifier que la parcelle existe
  const parcelle = db.parcelles.find(function(p) { return p.id === parcelleId; });
  if (!parcelle) return res.status(404).json({ error: "Parcelle introuvable" });

  let retour = db.retours.find(function (r) {
    return r.parcelleId === parcelleId && r.acheteurId === acheteurId;
  });

  if (!retour) {
    retour = { id: genId("r"), parcelleId: parcelleId, acheteurId: acheteurId };
    db.retours.push(retour);
  }

  retour.description = description || "";
  retour.estimation  = estimation  || "";
  retour.achete      = !!achete;
  retour.prix        = achete ? (prix || "") : "";
  retour.statut      = statut || "";
  retour.fiche       = fiche  || retour.fiche || null;
  retour.date        = new Date().toISOString();

  saveDb(db);
  res.json({ retour: retour });
});

// ---------- FALLBACK ----------
app.get("/*splat", function (req, res) {
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

app.listen(PORT, function () {
  console.log("Foresterra app demarree sur http://localhost:" + PORT);
});
