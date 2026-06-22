var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');

// Ajouter filtreAcheteur et filtrePdf dans le state
s=s.replace(
  'pdfSelectorId: null, pdfSelectedPages: [], pdfAssignAcheteurId: null, pdfPages: []',
  'pdfSelectorId: null, pdfSelectedPages: [], pdfAssignAcheteurId: null, pdfPages: [], filtreAcheteur: null, filtrePdf: null'
);

// Ajouter les filtres HTML avant la liste des parcelles
s=s.replace(
  "html += '<div class=\"block\"><p class=\"section-title\">Parcelles à visiter ('+sorted.length+')</p>';",
  `// Filtres
  var filtreHtml = '<div class="block" style="padding:12px 18px;">';
  filtreHtml += '<div class="row" style="gap:12px;flex-wrap:wrap;align-items:center;">';
  filtreHtml += '<div style="flex:1;min-width:180px;"><label class="field-label">Filtrer par acheteur</label>';
  filtreHtml += '<select id="filtre-acheteur"><option value="">Tous les acheteurs</option>';
  state.acheteurs.forEach(function(a){ filtreHtml += '<option value="'+a.id+'"'+(state.filtreAcheteur===a.id?' selected':'')+'>'+a.nom+'</option>'; });
  filtreHtml += '</select></div>';
  filtreHtml += '<div style="flex:1;min-width:180px;"><label class="field-label">Filtrer par PDF</label>';
  filtreHtml += '<select id="filtre-pdf"><option value="">Tous les PDFs</option>';
  state.pdfs.forEach(function(p){ filtreHtml += '<option value="'+p.id+'"'+(state.filtrePdf===p.id?' selected':'')+'>'+p.originalName+'</option>'; });
  filtreHtml += '</select></div>';
  if(state.filtreAcheteur||state.filtrePdf) filtreHtml += '<button id="btn-reset-filtres" style="margin-top:18px;">✕ Réinitialiser</button>';
  filtreHtml += '</div></div>';
  html += filtreHtml;

  // Appliquer les filtres
  if(state.filtreAcheteur){
    var idsAcheteur=state.affectations.filter(function(a){return a.acheteurId===state.filtreAcheteur;}).map(function(a){return a.parcelleId;});
    sorted=sorted.filter(function(p){return idsAcheteur.indexOf(p.id)!==-1;});
  }
  if(state.filtrePdf){
    sorted=sorted.filter(function(p){return p.pdfId===state.filtrePdf;});
  }

  html += '<div class="block"><p class="section-title">Parcelles à visiter ('+sorted.length+')</p>';`
);

// Binder les filtres dans bindPatronEvents
s=s.replace(
  'var el = document.getElementById("patron-content");',
  `var el = document.getElementById("patron-content");
    var filtreAch=document.getElementById("filtre-acheteur");
    if(filtreAch) filtreAch.addEventListener("change",function(){ state.filtreAcheteur=this.value||null; renderPatronContent(); });
    var filtrePdf=document.getElementById("filtre-pdf");
    if(filtrePdf) filtrePdf.addEventListener("change",function(){ state.filtrePdf=this.value||null; renderPatronContent(); });
    var btnReset=document.getElementById("btn-reset-filtres");
    if(btnReset) btnReset.addEventListener("click",function(){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); });`
);

fs.writeFileSync('public/app.js',s);
console.log('ok');
