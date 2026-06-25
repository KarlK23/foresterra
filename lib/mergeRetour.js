// Logique pure de fusion d'un "retour" (mise a jour partielle).
// Utilisee a l'identique par /api/retours (acheteur) et /api/retours-patron
// (patron) dans server.js - extraite ici pour eviter la duplication et
// permettre des tests unitaires sans dependance Mongo.
//
// existing: le retour deja present en base (objet) ou null/undefined s'il
//           faut en creer un nouveau.
// patch:    les champs envoyes par la requete ({ parcelleId, acheteurId,
//           description, estimation, achete, prix, statut, fiche, ficheEFC }).
//           Un champ absent (undefined) conserve la valeur existante : c'est
//           ce qui permet par exemple a la sauvegarde de la fiche EFC de ne
//           pas ecraser le reste du retour.
// genId:    fonction generatrice d'identifiant (genId("r")), utilisee
//           uniquement quand `existing` est absent.
// now:      optionnel, fonction retournant la date courante (Date par
//           defaut) - injectable pour des tests deterministes.
// actor:    optionnel, { nom, role } de la personne a l'origine de la
//           modification (acheteur ou patron) - utilise uniquement pour
//           journaliser l'historique (retour.history).
//
// Retourne l'objet retour fusionne (le meme objet que `existing` s'il etait
// fourni, muté en place, ou un nouvel objet sinon). Un tableau `history`
// (plafonne a 20 entrees, les plus anciennes sont supprimees) journalise
// chaque creation/modification: { date, actorNom, actorRole, changes }.
const HISTORY_MAX = 20;

function mergeRetour(existing, patch, genId, now, actor) {
  const getNow = now || function () { return new Date(); };
  const isNew = !existing;

  const retour = existing || {
    id: genId("r"),
    parcelleId: patch.parcelleId,
    acheteurId: patch.acheteurId,
    history: []
  };
  if (!Array.isArray(retour.history)) retour.history = [];

  const description = patch.description;
  const estimation = patch.estimation;
  const achete = patch.achete;
  const prix = patch.prix;
  const statut = patch.statut;
  const fiche = patch.fiche;
  const ficheEFC = patch.ficheEFC;

  const before = {
    statut: retour.statut || "",
    estimation: retour.estimation || "",
    achete: !!retour.achete,
    prix: retour.prix || "",
    description: retour.description || "",
    hasFiche: !!(retour.fiche || retour.ficheEFC)
  };

  retour.description = description !== undefined ? description : (retour.description || "");
  retour.statut = statut !== undefined ? statut : (retour.statut || "");
  retour.fiche = fiche !== undefined ? fiche : (retour.fiche || null);
  retour.ficheEFC = ficheEFC !== undefined ? ficheEFC : (retour.ficheEFC || null);
  retour.estimation = estimation !== undefined ? estimation : (retour.estimation || "");
  retour.achete = achete !== undefined ? !!achete : !!retour.achete;
  retour.prix = retour.achete ? (prix !== undefined ? prix : (retour.prix || "")) : "";
  retour.date = getNow().toISOString();

  const changes = {};
  if (isNew) {
    changes.creation = true;
  } else {
    if (before.statut !== retour.statut) changes.statut = { from: before.statut, to: retour.statut };
    if (before.estimation !== retour.estimation) changes.estimation = { from: before.estimation, to: retour.estimation };
    if (before.achete !== retour.achete) changes.achete = { from: before.achete, to: retour.achete };
    if (before.prix !== retour.prix) changes.prix = { from: before.prix, to: retour.prix };
    if (before.description !== retour.description) changes.description = true;
    const hasFicheNow = !!(retour.fiche || retour.ficheEFC);
    if (before.hasFiche !== hasFicheNow || ficheEFC !== undefined || fiche !== undefined) changes.fiche = true;
  }

  if (Object.keys(changes).length) {
    retour.history.push({
      date: retour.date,
      actorNom: (actor && actor.nom) || "Inconnu",
      actorRole: (actor && actor.role) || "",
      changes: changes
    });
    if (retour.history.length > HISTORY_MAX) {
      retour.history = retour.history.slice(retour.history.length - HISTORY_MAX);
    }
  }

  return retour;
}

module.exports = { mergeRetour };
