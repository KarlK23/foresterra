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
//
// Retourne l'objet retour fusionne (le meme objet que `existing` s'il etait
// fourni, muté en place, ou un nouvel objet sinon).
function mergeRetour(existing, patch, genId, now) {
  const getNow = now || function () { return new Date(); };

  const retour = existing || {
    id: genId("r"),
    parcelleId: patch.parcelleId,
    acheteurId: patch.acheteurId
  };

  const description = patch.description;
  const estimation = patch.estimation;
  const achete = patch.achete;
  const prix = patch.prix;
  const statut = patch.statut;
  const fiche = patch.fiche;
  const ficheEFC = patch.ficheEFC;

  retour.description = description !== undefined ? description : (retour.description || "");
  retour.statut = statut !== undefined ? statut : (retour.statut || "");
  retour.fiche = fiche !== undefined ? fiche : (retour.fiche || null);
  retour.ficheEFC = ficheEFC !== undefined ? ficheEFC : (retour.ficheEFC || null);
  retour.estimation = estimation !== undefined ? estimation : (retour.estimation || "");
  retour.achete = achete !== undefined ? !!achete : !!retour.achete;
  retour.prix = retour.achete ? (prix !== undefined ? prix : (retour.prix || "")) : "";
  retour.date = getNow().toISOString();

  return retour;
}

module.exports = { mergeRetour };
