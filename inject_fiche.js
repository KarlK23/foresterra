var fs = require('fs');
var s = fs.readFileSync('public/app.js', 'utf8');

var newFunction = `

// ============================================================
// FICHE EFC - ESTIMATION FORESTIERE COMPLETE
// Basée sur TABLEUR_ESTIM_EFC_type_BD
// ============================================================

function openFicheModalEFC(parcelle, retour, modeRetour) {
  var overlay = document.getElementById('fiche-modal-overlay');
  var modal = document.getElementById('fiche-modal');
  if (!overlay || !modal) return;

  var ficheData = (retour && retour.ficheEFC) ? retour.ficheEFC : {};

  // Essences disponibles
  var essences = [
    { key: 'douglas', label: 'Douglas', tarif_defaut: 17, longueur_defaut: 13 },
    { key: 'epiceas', label: 'Epicéas', tarif_defaut: 14, longueur_defaut: 13 },
    { key: 'sapins', label: 'Sapins', tarif_defaut: 14, longueur_defaut: 13 },
    { key: 'melezes', label: 'Mélèzes', tarif_defaut: 16, longueur_defaut: 13 },
    { key: 'palette', label: 'Palette/Secs', tarif_defaut: 14, longueur_defaut: 13 }
  ];

  // Diamètres de 15 à 105 par pas de 5
  var diametres = [];
  for (var d = 15; d <= 105; d += 5) diametres.push(d);

  // Paramètres Rabais
  var ratioST_T   = ficheData.ratioST_T   || 0.5;
  var ratioST_M3  = ficheData.ratioST_M3  || 0.65;
  var prixVabres  = ficheData.prixVabres  || 55;
  var prixExplST  = ficheData.prixExplST  || 17;
  var fraisDivers = ficheData.fraisDivers || 0;

  // Produits (5 lignes Rabais)
  var produits = ficheData.produits || [
    { type: 'BC',     essence: 'Douglas', pct: 0, prixVente: 0, coutTrans: 0, marge: 15 },
    { type: 'BPV',    essence: 'RX',      pct: 0, prixVente: prixVabres, coutTrans: 0, marge: 15 },
    { type: 'BPG',    essence: 'RX',      pct: 0, prixVente: 0, coutTrans: 0, marge: 15 },
    { type: 'TRITUS', essence: 'RX',      pct: 0, prixVente: 0, coutTrans: 0, marge: 15 },
    { type: 'POTEAUX',essence: 'RX',      pct: 0, prixVente: 0, coutTrans: 0, marge: 15 }
  ];

  // Volume total G3 (à saisir)
  var volTotalG3 = ficheData.volTotalG3 || 0;

  // Données tiges par essence
  var tigesData = ficheData.tigesData || {};
  essences.forEach(function(e) {
    if (!tigesData[e.key]) {
      tigesData[e.key] = { enabled: false, longueur1: 13, longueur2: 0, longueur3: 0, tiges: {} };
    }
  });

  // ---- Formule dendrométrique ----
  function calcVolume(diam, tarif, longueur) {
    if (!diam || !longueur || longueur <= 0) return 0;
    var correction = -1.01516781053481 + 1.02972 * Math.log(diam) - 0.1053013 * tarif;
    var r = diam - correction * (longueur / 2 - 1);
    return r * r * Math.PI / 4 * longueur / 10000;
  }

  function calcVolume2(diam, tarif, l1, l2) {
    if (!diam || !l2 || l2 <= 0) return 0;
    var corr = -1.01516781053481 + 1.02972 * Math.log(diam) - 0.1053013 * tarif;
    var r2 = diam - corr * ((l1 + l2) / 2 - 1);
    var r1 = diam - corr * (l1 / 2 - 1);
    return (r2 * r2 * Math.PI / 4 * (l1 + l2) / 10000) - (r1 * r1 * Math.PI / 4 * l1 / 10000);
  }

  function calcVolume3(diam, tarif, l1, l2, l3) {
    if (!diam || !l3 || l3 <= 0) return 0;
    var corr = -1.01516781053481 + 1.02972 * Math.log(diam) - 0.1053013 * tarif;
    var r3 = diam - corr * ((l1 + l2 + l3) / 2 - 1);
    var r2 = diam - corr * ((l1 + l2) / 2 - 1);
    return (r3 * r3 * Math.PI / 4 * (l1 + l2 + l3) / 10000) - (r2 * r2 * Math.PI / 4 * (l1 + l2) / 10000);
  }

  // ---- Calcul volumes par essence ----
  function calcEssence(eKey) {
    var td = tigesData[eKey];
    if (!td || !td.enabled) return { nbTiges: 0, volTotal: 0, volL1: 0, volL2: 0, volL3: 0 };
    var l1 = parseFloat(td.longueur1) || 0;
    var l2 = parseFloat(td.longueur2) || 0;
    var l3 = parseFloat(td.longueur3) || 0;
    var ess = essences.find(function(e){ return e.key === eKey; });
    var tarif = parseFloat(td.tarif) || ess.tarif_defaut;

    var nbTiges = 0, volTotal = 0, vL1 = 0, vL2 = 0, vL3 = 0;
    diametres.forEach(function(d) {
      var n = parseInt(td.tiges[d]) || 0;
      if (n === 0) return;
      nbTiges += n;
      var e1 = calcVolume(d, tarif, l1);
      var e2 = calcVolume2(d, tarif, l1, l2);
      var e3 = calcVolume3(d, tarif, l1, l2, l3);
      vL1 += e1 * n;
      vL2 += e2 * n;
      vL3 += e3 * n;
      volTotal += (e1 + e2 + e3) * n;
    });
    return { nbTiges: nbTiges, volTotal: volTotal, volL1: vL1, volL2: vL2, volL3: vL3, tarif: tarif, l1: l1, l2: l2, l3: l3 };
  }

  // ---- Calcul Rabais ----
  function calcRabais() {
    var G3 = parseFloat(volTotalG3) || 0;
    var prixExplM3 = prixExplST / ratioST_M3;

    // Produit 1: BC (bois de charpente) en m3
    var volBC = G3 * (parseFloat(produits[0].pct) / 100);
    var caBC = (parseFloat(produits[0].prixVente) || 0) * volBC;
    var transBC = (parseFloat(produits[0].coutTrans) || 0) * volBC;
    var margeBC = caBC * (produits[0].marge / 100);

    // Produit 2: BPV (bois petite valeur) en stères
    var volBPV = (G3 * (parseFloat(produits[1].pct) / 100)) / ratioST_M3;
    var caBPV = prixVabres * volBPV;
    var transBPV = (parseFloat(produits[1].coutTrans) || 0) * volBPV;
    var margeBPV = caBPV * (produits[1].marge / 100);

    // Produit 3: BPG en stères
    var volBPG = (G3 * (parseFloat(produits[2].pct) / 100)) / ratioST_M3;
    var caBPG = (parseFloat(produits[2].prixVente) || 0) * volBPG;
    var transBPG = (parseFloat(produits[2].coutTrans) || 0) * volBPG;
    var margeBPG = caBPG * (produits[2].marge / 100);

    // Produit 4: TRITUS en tonnes
    var volTRITUS = ((G3 * (parseFloat(produits[3].pct) / 100)) / ratioST_M3) * ratioST_T;
    var caTRITUS = (parseFloat(produits[3].prixVente) || 0) * volTRITUS;
    var transTRITUS = (parseFloat(produits[3].coutTrans) || 0) * volTRITUS;
    var margeTRITUS = caTRITUS * (produits[3].marge / 100);

    // Produit 5: POTEAUX en m3 façonnés
    var volPOTEAUX = (G3 * (parseFloat(produits[4].pct) / 100)) * 0.7;
    var caPOTEAUX = (parseFloat(produits[4].prixVente) || 0) * volPOTEAUX;
    var transPOTEAUX = (parseFloat(produits[4].coutTrans) || 0) * volPOTEAUX;
    var margePOTEAUX = caPOTEAUX * (produits[4].marge / 100);

    var caTotal = caBC + caBPV + caBPG + caTRITUS + caPOTEAUX;
    var transTotal = transBC + transBPV + transBPG + transTRITUS + transPOTEAUX;
    var margeTotal = margeBC + margeBPV + margeBPG + margeTRITUS + margePOTEAUX;
    var coutExpl = (G3 / ratioST_M3) * prixExplST;

    // Tableau des marges (-22% à +17%)
    var marges = [-22,-20,-17,-15,-12,-10,-7,-5,-2,0,2,5,7,10,12,15,17];
    var tableauMarges = marges.map(function(m) {
      var achat;
      if (m <= 0) {
        achat = ((caTotal - (coutExpl + transTotal + fraisDivers)) + (caTotal * (1 + Math.abs(m)/100))) - caTotal;
      } else {
        achat = caTotal - ((coutExpl + transTotal + fraisDivers) + (caTotal * m / 100));
      }
      return { marge: m, achat: achat, achatM3: G3 > 0 ? achat / G3 : 0 };
    });

    return {
      caTotal: caTotal, transTotal: transTotal, margeTotal: margeTotal,
      coutExpl: coutExpl, fraisDivers: fraisDivers,
      tableauMarges: tableauMarges, G3: G3,
      vols: { BC: volBC, BPV: volBPV, BPG: volBPG, TRITUS: volTRITUS, POTEAUX: volPOTEAUX },
      cas:  { BC: caBC,  BPV: caBPV,  BPG: caBPG,  TRITUS: caTRITUS,  POTEAUX: caPOTEAUX },
      trans: { BC: transBC, BPV: transBPV, BPG: transBPG, TRITUS: transTRITUS, POTEAUX: transPOTEAUX }
    };
  }

  // ---- Rendu HTML ----
  function fmt(n, dec) {
    if (isNaN(n) || !isFinite(n)) return '-';
    return parseFloat(n).toFixed(dec !== undefined ? dec : 2);
  }

  function renderTigesTable(eKey) {
    var td = tigesData[eKey];
    var ess = essences.find(function(e){ return e.key === eKey; });
    var l1 = parseFloat(td.longueur1) || 0;
    var l2 = parseFloat(td.longueur2) || 0;
    var l3 = parseFloat(td.longueur3) || 0;
    var tarif = parseFloat(td.tarif) || ess.tarif_defaut;

    var rows = diametres.map(function(d) {
      var n = parseInt(td.tiges[d]) || 0;
      var e1 = calcVolume(d, tarif, l1);
      var e2 = calcVolume2(d, tarif, l1, l2);
      var e3 = calcVolume3(d, tarif, l1, l2, l3);
      var vtot = (e1 + e2 + e3) * n;
      return '<tr>' +
        '<td class="efc-td-c">' + d + '</td>' +
        '<td><input type="number" min="0" class="efc-input-n" data-essence="' + eKey + '" data-diam="' + d + '" value="' + (n||'') + '"></td>' +
        '<td class="efc-td-c">' + tarif + '</td>' +
        '<td class="efc-td-c">' + (l1||'-') + '</td>' +
        '<td class="efc-td-r">' + (n>0&&l1>0 ? fmt(e1,4) : '-') + '</td>' +
        '<td class="efc-td-c">' + (l2||'-') + '</td>' +
        '<td class="efc-td-r">' + (n>0&&l2>0 ? fmt(e2,4) : '-') + '</td>' +
        '<td class="efc-td-c">' + (l3||'-') + '</td>' +
        '<td class="efc-td-r">' + (n>0&&l3>0 ? fmt(e3,4) : '-') + '</td>' +
        '<td class="efc-td-r"><b>' + (n>0 ? fmt(vtot,3) : '-') + '</b></td>' +
        '</tr>';
    }).join('');

    var res = calcEssence(eKey);
    return '<div class="efc-ess-block">' +
      '<div class="efc-ess-header">' +
        '<label class="efc-toggle"><input type="checkbox" class="efc-ess-check" data-essence="' + eKey + '" ' + (td.enabled?'checked':'') + '> <b>' + ess.label + '</b></label>' +
        '<span class="efc-ess-summary">' + (td.enabled ? res.nbTiges + ' tiges — ' + fmt(res.volTotal,2) + ' m³' : '') + '</span>' +
      '</div>' +
      (td.enabled ? '<div class="efc-ess-body">' +
        '<div class="efc-longueurs">' +
          'Tarif: <input type="number" class="efc-input-tarif" data-essence="' + eKey + '" value="' + tarif + '" min="10" max="30"> &nbsp;' +
          'L1: <input type="number" class="efc-input-l" data-essence="' + eKey + '" data-l="1" value="' + (l1||'') + '" min="0" max="50"> &nbsp;' +
          'L2: <input type="number" class="efc-input-l" data-essence="' + eKey + '" data-l="2" value="' + (l2||'') + '" min="0" max="50"> &nbsp;' +
          'L3: <input type="number" class="efc-input-l" data-essence="' + eKey + '" data-l="3" value="' + (l3||'') + '" min="0" max="50">' +
        '</div>' +
        '<table class="efc-table"><thead><tr>' +
          '<th>Ø</th><th>Nb</th><th>Tarif</th><th colspan="2">L1</th><th colspan="2">L2</th><th colspan="2">L3</th><th>Vol.total</th>' +
        '</tr></thead><tbody>' + rows + '</tbody>' +
        '<tfoot><tr><td colspan="9" class="efc-td-r"><b>TOTAL</b></td>' +
          '<td class="efc-td-r"><b>' + fmt(res.volTotal,3) + ' m³</b></td>' +
        '</tr></tfoot></table>' +
      '</div>' : '') +
    '</div>';
  }

  function renderRabais() {
    var r = calcRabais();
    var G3 = r.G3;

    var prodRows = [
      { label:'BC (m³)',     key:'BC',     vol:r.vols.BC,     ca:r.cas.BC,     trans:r.trans.BC },
      { label:'BPV (stères)',key:'BPV',    vol:r.vols.BPV,    ca:r.cas.BPV,    trans:r.trans.BPV },
      { label:'BPG (stères)',key:'BPG',    vol:r.vols.BPG,    ca:r.cas.BPG,    trans:r.trans.BPG },
      { label:'Tritus (T)', key:'TRITUS', vol:r.vols.TRITUS, ca:r.cas.TRITUS, trans:r.trans.TRITUS },
      { label:'Poteaux (m³F)',key:'POTEAUX',vol:r.vols.POTEAUX,ca:r.cas.POTEAUX,trans:r.trans.POTEAUX }
    ];

    var prodHTML = prodRows.map(function(p, i) {
      return '<tr>' +
        '<td>' + p.label + '</td>' +
        '<td><input type="number" class="efc-input-pct" data-pi="' + i + '" value="' + (parseFloat(produits[i].pct)||0) + '" min="0" max="100"> %</td>' +
        '<td class="efc-td-r">' + fmt(p.vol,1) + '</td>' +
        '<td><input type="number" class="efc-input-prix" data-pi="' + i + '" value="' + (parseFloat(produits[i].prixVente)||0) + '" min="0"></td>' +
        '<td class="efc-td-r">' + fmt(p.ca,0) + ' €</td>' +
        '<td><input type="number" class="efc-input-trans" data-pi="' + i + '" value="' + (parseFloat(produits[i].coutTrans)||0) + '" min="0"></td>' +
        '<td class="efc-td-r">' + fmt(p.trans,0) + ' €</td>' +
        '</tr>';
    }).join('');

    var margesHTML = r.tableauMarges.map(function(m) {
      var cls = m.marge === 0 ? ' efc-marge-zero' : (m.marge > 0 ? ' efc-marge-pos' : '');
      return '<tr class="' + cls + '">' +
        '<td>' + (m.marge >= 0 ? '+' : '') + m.marge + '%</td>' +
        '<td class="efc-td-r">' + fmt(m.achat,0) + ' €</td>' +
        '<td class="efc-td-r">' + fmt(m.achatM3,2) + ' €/m³</td>' +
        '</tr>';
    }).join('');

    return '<div class="efc-rabais-block">' +
      '<h4>Paramètres économiques</h4>' +
      '<div class="efc-params-grid">' +
        '<label>Volume total G3 (m³): <input type="number" id="efc-vol-g3" value="' + G3 + '" min="0"></label>' +
        '<label>Prix exploit (€/st): <input type="number" id="efc-prix-expl" value="' + prixExplST + '" min="0"></label>' +
        '<label>Prix Vabres (€/st): <input type="number" id="efc-prix-vabres" value="' + prixVabres + '" min="0"></label>' +
        '<label>Frais divers (€): <input type="number" id="efc-frais-divers" value="' + fraisDivers + '" min="0"></label>' +
      '</div>' +
      '<h4>Produits</h4>' +
      '<table class="efc-table"><thead><tr>' +
        '<th>Produit</th><th>% vol.</th><th>Volume</th><th>Prix vente</th><th>CA</th><th>Coût trans.</th><th>Trans.</th>' +
      '</tr></thead><tbody>' + prodHTML + '</tbody>' +
      '<tfoot><tr><td colspan="4"><b>CA TOTAL</b></td><td class="efc-td-r"><b>' + fmt(r.caTotal,0) + ' €</b></td>' +
        '<td></td><td class="efc-td-r"><b>' + fmt(r.transTotal,0) + ' €</b></td></tr>' +
        '<tr><td colspan="4">Coût exploitation</td><td class="efc-td-r">' + fmt(r.coutExpl,0) + ' €</td><td colspan="2"></td></tr>' +
      '</tfoot></table>' +
      '<h4>Tableau des prix d\'achat selon marge</h4>' +
      '<table class="efc-table efc-table-marges"><thead><tr><th>Marge EFC</th><th>Prix achat</th><th>€/m³</th></tr></thead>' +
      '<tbody>' + margesHTML + '</tbody></table>' +
    '</div>';
  }

  // ---- HTML complet de la fiche ----
  var html = '<div id="efc-fiche" style="padding:16px;font-size:13px;">' +
    '<div class="efc-header-row">' +
      '<div><label>Article: <input type="text" id="efc-article" class="efc-input-text" value="' + (ficheData.article||parcelle.nom||'') + '"></label></div>' +
      '<div><label>Localisation: <input type="text" id="efc-localisation" class="efc-input-text" value="' + (ficheData.localisation||parcelle.commune||'') + '"></label></div>' +
      '<div><label>Date: <input type="text" id="efc-date" class="efc-input-text" value="' + (ficheData.date||new Date().toLocaleDateString('fr-FR')) + '"></label></div>' +
    '</div>' +
    '<div class="efc-tabs">' +
      '<button class="efc-tab-btn active" data-tab="volumes">📊 Volumes</button>' +
      '<button class="efc-tab-btn" data-tab="rabais">💰 Estimation</button>' +
    '</div>' +
    '<div id="efc-tab-volumes" class="efc-tab-content">' +
      essences.map(function(e){ return renderTigesTable(e.key); }).join('') +
    '</div>' +
    '<div id="efc-tab-rabais" class="efc-tab-content" style="display:none">' +
      renderRabais() +
    '</div>' +
    '<div class="efc-footer">' +
      '<button id="efc-save-btn" class="btn btn-primary">💾 Enregistrer</button>' +
      '<button id="efc-cancel-btn" class="btn btn-secondary">Annuler</button>' +
    '</div>' +
  '</div>';

  modal.innerHTML = '<div class="fiche-modal-header">' +
    '<h3>Estimation EFC — ' + (parcelle.nom || '') + '</h3>' +
    '<button class="fiche-close-btn" onclick="closeFicheModal()">✕</button>' +
  '</div>' + html;
  overlay.style.display = 'block';
  modal.style.display = 'block';

  // ---- Styles ----
  if (!document.getElementById('efc-styles')) {
    var style = document.createElement('style');
    style.id = 'efc-styles';
    style.textContent = [
      '.efc-header-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}',
      '.efc-input-text{border:1px solid #ccc;border-radius:4px;padding:2px 6px;width:160px}',
      '.efc-tabs{display:flex;gap:4px;margin-bottom:12px;border-bottom:2px solid #2d6a4f}',
      '.efc-tab-btn{background:#f0f0f0;border:1px solid #ccc;border-radius:4px 4px 0 0;padding:6px 16px;cursor:pointer;font-size:13px}',
      '.efc-tab-btn.active{background:#2d6a4f;color:#fff;border-color:#2d6a4f}',
      '.efc-ess-block{border:1px solid #ddd;border-radius:6px;margin-bottom:10px;overflow:hidden}',
      '.efc-ess-header{background:#f7f7f7;padding:8px 12px;display:flex;align-items:center;gap:12px;cursor:pointer}',
      '.efc-ess-summary{color:#666;font-size:12px}',
      '.efc-ess-body{padding:8px 12px}',
      '.efc-longueurs{margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.efc-input-n,.efc-input-l,.efc-input-tarif{width:56px;border:1px solid #ccc;border-radius:3px;padding:2px 4px;text-align:center}',
      '.efc-table{width:100%;border-collapse:collapse;font-size:12px}',
      '.efc-table th{background:#2d6a4f;color:#fff;padding:4px 6px;text-align:center}',
      '.efc-table td{padding:3px 6px;border-bottom:1px solid #eee}',
      '.efc-table tfoot td{background:#f0f7f3;font-weight:bold}',
      '.efc-td-c{text-align:center}.efc-td-r{text-align:right}',
      '.efc-rabais-block{padding:4px}',
      '.efc-params-grid{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px}',
      '.efc-params-grid label{display:flex;align-items:center;gap:6px;font-size:12px}',
      '.efc-params-grid input{width:80px;border:1px solid #ccc;border-radius:3px;padding:2px 4px}',
      '.efc-input-pct,.efc-input-prix,.efc-input-trans{width:64px;border:1px solid #ccc;border-radius:3px;padding:2px 4px;text-align:right}',
      '.efc-table-marges{max-width:340px}',
      '.efc-marge-zero{background:#fff9c4;font-weight:bold}',
      '.efc-marge-pos{color:#1a7a3a}',
      '.efc-footer{margin-top:16px;display:flex;gap:10px;justify-content:flex-end}',
      '.efc-toggle{display:flex;align-items:center;gap:6px}'
    ].join('\\n');
    document.head.appendChild(style);
  }

  // ---- Événements ----
  function rerender() {
    var tabVol = document.getElementById('efc-tab-volumes');
    var tabRab = document.getElementById('efc-tab-rabais');
    var activeTab = modal.querySelector('.efc-tab-btn.active');
    var tabName = activeTab ? activeTab.getAttribute('data-tab') : 'volumes';

    if (tabVol) {
      tabVol.innerHTML = essences.map(function(e){ return renderTigesTable(e.key); }).join('');
      bindTigesEvents();
    }
    if (tabRab && tabName === 'rabais') {
      tabRab.innerHTML = renderRabais();
      bindRabaisEvents();
    }
  }

  function bindTigesEvents() {
    modal.querySelectorAll('.efc-ess-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var eKey = this.getAttribute('data-essence');
        tigesData[eKey].enabled = this.checked;
        rerender();
      });
    });
    modal.querySelectorAll('.efc-input-n').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var eKey = this.getAttribute('data-essence');
        var d    = this.getAttribute('data-diam');
        tigesData[eKey].tiges[d] = parseInt(this.value) || 0;
        rerender();
      });
    });
    modal.querySelectorAll('.efc-input-l').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var eKey = this.getAttribute('data-essence');
        var li   = 'longueur' + this.getAttribute('data-l');
        tigesData[eKey][li] = parseFloat(this.value) || 0;
        rerender();
      });
    });
    modal.querySelectorAll('.efc-input-tarif').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var eKey = this.getAttribute('data-essence');
        tigesData[eKey].tarif = parseFloat(this.value) || essences.find(function(e){return e.key===eKey;}).tarif_defaut;
        rerender();
      });
    });
  }

  function bindRabaisEvents() {
    var g3inp = document.getElementById('efc-vol-g3');
    if (g3inp) g3inp.addEventListener('change', function(){ volTotalG3 = parseFloat(this.value)||0; rerender(); });
    var peinp = document.getElementById('efc-prix-expl');
    if (peinp) peinp.addEventListener('change', function(){ prixExplST = parseFloat(this.value)||0; rerender(); });
    var pvinp = document.getElementById('efc-prix-vabres');
    if (pvinp) pvinp.addEventListener('change', function(){ prixVabres = parseFloat(this.value)||0; rerender(); });
    var fdinp = document.getElementById('efc-frais-divers');
    if (fdinp) fdinp.addEventListener('change', function(){ fraisDivers = parseFloat(this.value)||0; rerender(); });

    modal.querySelectorAll('.efc-input-pct').forEach(function(inp) {
      inp.addEventListener('change', function() {
        produits[parseInt(this.getAttribute('data-pi'))].pct = parseFloat(this.value)||0;
        rerender();
      });
    });
    modal.querySelectorAll('.efc-input-prix').forEach(function(inp) {
      inp.addEventListener('change', function() {
        produits[parseInt(this.getAttribute('data-pi'))].prixVente = parseFloat(this.value)||0;
        rerender();
      });
    });
    modal.querySelectorAll('.efc-input-trans').forEach(function(inp) {
      inp.addEventListener('change', function() {
        produits[parseInt(this.getAttribute('data-pi'))].coutTrans = parseFloat(this.value)||0;
        rerender();
      });
    });
  }

  // Tabs
  modal.querySelectorAll('.efc-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      modal.querySelectorAll('.efc-tab-btn').forEach(function(b){ b.classList.remove('active'); });
      this.classList.add('active');
      var tab = this.getAttribute('data-tab');
      document.getElementById('efc-tab-volumes').style.display = tab==='volumes' ? '' : 'none';
      var tabRab = document.getElementById('efc-tab-rabais');
      tabRab.style.display = tab==='rabais' ? '' : 'none';
      if (tab === 'rabais') { tabRab.innerHTML = renderRabais(); bindRabaisEvents(); }
    });
  });

  bindTigesEvents();

  // Sauvegarde
  var saveBtn = document.getElementById('efc-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', function() {
    var ficheEFC = {
      article: document.getElementById('efc-article').value,
      localisation: document.getElementById('efc-localisation').value,
      date: document.getElementById('efc-date').value,
      ratioST_T: ratioST_T, ratioST_M3: ratioST_M3,
      prixVabres: prixVabres, prixExplST: prixExplST, fraisDivers: fraisDivers,
      volTotalG3: volTotalG3, produits: produits, tigesData: tigesData
    };
    if (!retour) retour = {};
    retour.ficheEFC = ficheEFC;
    if (typeof sauvegarderRetour === 'function') {
      sauvegarderRetour(parcelle, retour, modeRetour);
    }
    closeFicheModal();
  });

  var cancelBtn = document.getElementById('efc-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeFicheModal);
}

function closeFicheModal() {
  var overlay = document.getElementById('fiche-modal-overlay');
  var modal   = document.getElementById('fiche-modal');
  if (overlay) overlay.style.display = 'none';
  if (modal)   modal.style.display   = 'none';
}

`;

// Injecter juste avant init();
s = s.replace('  init();', newFunction + '  init();');
fs.writeFileSync('public/app.js', s);
console.log('ok - taille:' + fs.readFileSync('public/app.js').length);
