const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeRetour } = require("../lib/mergeRetour");

function fixedNow() {
  return new Date("2026-01-01T00:00:00.000Z");
}

function genId(prefix) {
  return prefix + "_test1";
}

test("cree un nouveau retour quand aucun n'existe", function () {
  const retour = mergeRetour(
    null,
    { parcelleId: "p1", acheteurId: "u1", description: "Coupe partielle" },
    genId,
    fixedNow
  );

  assert.equal(retour.id, "r_test1");
  assert.equal(retour.parcelleId, "p1");
  assert.equal(retour.acheteurId, "u1");
  assert.equal(retour.description, "Coupe partielle");
  assert.equal(retour.statut, "");
  assert.equal(retour.fiche, null);
  assert.equal(retour.ficheEFC, null);
  assert.equal(retour.achete, false);
  assert.equal(retour.prix, "");
  assert.equal(retour.date, fixedNow().toISOString());
});

test("un champ absent (undefined) du patch conserve la valeur existante", function () {
  const existing = {
    id: "r1",
    parcelleId: "p1",
    acheteurId: "u1",
    description: "Description initiale",
    statut: "en cours",
    fiche: { volume: 12 },
    ficheEFC: null,
    estimation: "1000",
    achete: false,
    prix: ""
  };

  // Seule la ficheEFC est envoyee (cas reel: sauvegarde de la fiche EFC) -
  // tout le reste doit rester intact.
  const retour = mergeRetour(
    existing,
    { ficheEFC: { total: 500 } },
    genId,
    fixedNow
  );

  assert.equal(retour.description, "Description initiale");
  assert.equal(retour.statut, "en cours");
  assert.deepEqual(retour.fiche, { volume: 12 });
  assert.deepEqual(retour.ficheEFC, { total: 500 });
  assert.equal(retour.estimation, "1000");
  assert.equal(retour.achete, false);
});

test("achete=false force prix a une chaine vide meme si un prix est fourni", function () {
  const retour = mergeRetour(
    { id: "r1", parcelleId: "p1", acheteurId: "u1" },
    { achete: false, prix: "500" },
    genId,
    fixedNow
  );

  assert.equal(retour.achete, false);
  assert.equal(retour.prix, "");
});

test("achete=true conserve/accepte le prix fourni", function () {
  const retour = mergeRetour(
    { id: "r1", parcelleId: "p1", acheteurId: "u1" },
    { achete: true, prix: "750" },
    genId,
    fixedNow
  );

  assert.equal(retour.achete, true);
  assert.equal(retour.prix, "750");
});

test("achete=true sans prix dans le patch conserve le prix existant", function () {
  const retour = mergeRetour(
    { id: "r1", parcelleId: "p1", acheteurId: "u1", achete: true, prix: "900" },
    { achete: true },
    genId,
    fixedNow
  );

  assert.equal(retour.prix, "900");
});

test("mute et retourne le meme objet quand `existing` est fourni", function () {
  const existing = { id: "r1", parcelleId: "p1", acheteurId: "u1" };
  const retour = mergeRetour(existing, { description: "x" }, genId, fixedNow);
  assert.equal(retour, existing);
});
