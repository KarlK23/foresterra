(function () {
  "use strict";

  var root = document.getElementById("app");
  var state = {
    user: null, parcelles: [], affectations: [], retours: [],
    acheteurs: [], pdfs: [], usersMap: {},
    pdfSelectorId: null, pdfSelectedPages: [], pdfAssignAcheteurId: null, pdfPages: [], filtreAcheteur: null, filtrePdf: null
  };

  // ── PDF CACHE & RENDU ─────────────────────────────────────────────
  var _pdfCache = {};
  function getPdfDoc(url) {
    if (_pdfCache[url]) return Promise.resolve(_pdfCache[url]);
    if (typeof pdfjsLib === 'undefined') return Promise.reject('PDF.js non chargé');
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    return pdfjsLib.getDocument(url).promise.then(function(doc){
      _pdfCache[url] = doc; return doc;
    });
  }
  function renderPageCanvas(canvas, url, pageNum) {
    if (!canvas || !url || !pageNum) return;
    getPdfDoc(url).then(function(doc){ return doc.getPage(pageNum); })
    .then(function(page){
      var maxW = canvas.parentElement ? canvas.parentElement.offsetWidth || 400 : 400;
      var vp = page.getViewport({scale:1});
      var scale = maxW / vp.width;
      var sv = page.getViewport({scale:scale});
      canvas.width = sv.width; canvas.height = sv.height;
      canvas.style.width = '100%'; canvas.style.display = 'block';
      page.render({canvasContext:canvas.getContext('2d'), viewport:sv});
    }).catch(function(){});
  }
  function renderAllPagePreviews() {
    setTimeout(function(){
      document.querySelectorAll('canvas.pdf-preview').forEach(function(c){
        renderPageCanvas(c, c.getAttribute('data-url'), parseInt(c.getAttribute('data-page')));
      });
    }, 50);
  }
  function pdfPreviewHtml(pdfId, pageNum) {
    if (!pdfId || !pageNum) return '';
    var pdf = state.pdfs.find(function(p){return p.id===pdfId;});
    if (!pdf) return '';
    var url = '/api/proxy-pdf?url='+encodeURIComponent(pdf.filename);
    return '<div style="margin-bottom:12px;border-radius:10px;overflow:hidden;border:1px solid #e0ddd5;background:#f9faf7;">'+
      '<div style="padding:6px 12px;background:#e8f5ef;display:flex;justify-content:space-between;align-items:center;">'+
        '<span style="font-size:11px;font-weight:600;color:#0f6e56;">📄 Page '+pageNum+' — '+esc(pdf.originalName)+'</span>'+
        '<a href="'+url+'#page='+pageNum+'" target="_blank" style="font-size:11px;color:#0f6e56;text-decoration:none;">Ouvrir ↗</a>'+
      '</div>'+
      '<canvas class="pdf-preview" data-url="'+url+'" data-page="'+pageNum+'" style="display:block;width:100%;background:#fff;"></canvas>'+
    '</div>';
  }

  // ── UTILS ──────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function parseFr(s) { return parseFloat(String(s || "0").replace(",", ".")) || 0; }
  function fmtN(n) { return isNaN(n) ? "—" : Math.round(n).toLocaleString("fr-FR") + " €"; }
  function fmtD(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"});
  }
  function api(method, url, body) {
    var opts = {method:method, headers:{"Content-Type":"application/json"}, credentials:"same-origin"};
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Erreur"); return d; });
    });
  }

  // ── STATUTS ────────────────────────────────────────────────────────
  var STATUTS = [
    {val:"sans_interet",  label:"Sans intérêt",   icon:"❌", color:"#fde8e8", text:"#a32d2d"},
    {val:"estime",        label:"Estimée",         icon:"📋", color:"#f0f0ff", text:"#3a3aaa"},
    {val:"interet_faible",label:"Intérêt faible",  icon:"⭐", color:"#fef6e4", text:"#7a5800"},
    {val:"interet_moyen", label:"Intérêt moyen",   icon:"⭐⭐",color:"#fef0c0", text:"#7a5800"},
    {val:"interet_fort",  label:"Intérêt fort",    icon:"🟢", color:"#eaf3de", text:"#3b6d11"},
    {val:"achete",        label:"Acheté",           icon:"✅", color:"#e1f5ee", text:"#0f6e56"}
  ];
  function statutBadge(val) {
    var s = STATUTS.find(function(x){return x.val===val;});
    if (!s) return '<span style="font-size:12px;color:#a3a098;">Non visitée</span>';
    return '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:'+s.color+';color:'+s.text+';">'+s.icon+' '+s.label+'</span>';
  }
  function ficheRequired(val) {
    return val==="estime"||val==="interet_faible"||val==="interet_moyen"||val==="interet_fort"||val==="achete";
  }

  // ── INIT ───────────────────────────────────────────────────────────
  function init() {
    api("GET", "/api/me").then(function (d) {
      state.user = d.user;
      if (!state.user) renderLogin(); else loadAll();
    });
  }
  function pageNum(label) {
    var m = String(label||"").match(/^Page (\d+)$/);
    return m ? parseInt(m[1]) : 0;
  }
  function sortParcelles(list) {
    return list.slice().sort(function(a,b){
      var na=pageNum(a.label), nb=pageNum(b.label);
      if (na&&nb) return na-nb;
      return (a.ordre||0)-(b.ordre||0);
    });
  }

  function loadAll() {
    var calls = [api("GET","/api/parcelles"), api("GET","/api/users-map"), api("GET","/api/pdfs")];
    if (state.user.role==="patron") calls.push(api("GET","/api/acheteurs"));
    Promise.all(calls).then(function (r) {
      state.parcelles   = r[0].parcelles   || [];
      state.affectations= r[0].affectations|| [];
      state.retours     = r[0].retours     || [];
      state.usersMap    = r[1].map         || {};
      state.pdfs        = r[2].pdfs        || [];
      if (state.user.role==="patron") { state.acheteurs=r[3].acheteurs||[]; renderPatronApp(); }
      else renderAcheteurApp();
    }).catch(function(e){ alert("Erreur chargement: "+e.message); });
  }

  // ── LOGIN ──────────────────────────────────────────────────────────
  function renderLogin() {
    root.innerHTML =
      '<div class="login-wrap"><h1>Foresterra</h1><p class="subtitle">Connexion</p>'+
      '<div class="field-group" style="margin-top:1rem;"><label class="field-label">Identifiant</label>'+
      '<input id="l-user" type="text" autocomplete="username"/></div>'+
      '<div class="field-group"><label class="field-label">Mot de passe</label>'+
      '<input id="l-pass" type="password" autocomplete="current-password"/></div>'+
      '<button id="btn-login" class="primary" style="width:100%;">Se connecter</button>'+
      '<p id="l-err" class="error-msg"></p></div>';
    var go = function(){
      api("POST","/api/login",{username:document.getElementById("l-user").value.trim(), password:document.getElementById("l-pass").value})
        .then(function(d){ state.user=d.user; loadAll(); })
        .catch(function(e){ document.getElementById("l-err").textContent=e.message; });
    };
    document.getElementById("btn-login").addEventListener("click", go);
    document.getElementById("l-pass").addEventListener("keydown", function(e){ if(e.key==="Enter") go(); });
  }
  function logout() {
    api("POST","/api/logout").then(function(){
      state.user=null; state.parcelles=[]; state.affectations=[]; state.retours=[];
      state.acheteurs=[]; state.pdfs=[]; renderLogin();
    });
  }

  // ── HEADER ─────────────────────────────────────────────────────────
  function headerHtml() {
    return '<header class="header"><div><h1>Foresterra</h1>'+
      '<p class="subtitle">Parcelles à visiter et historique d\'achat</p></div>'+
      '<div class="user-badge"><p class="name">'+esc(state.user.nom)+'</p>'+
      '<p class="role">'+(state.user.role==="patron"?"Patron":"Acheteur")+'</p>'+
      '<button id="btn-logout" style="margin-top:6px;">Déconnexion</button></div></header>';
  }

  // ══════════════════════════════════════════════════════════════════
  // PATRON APP
  // ══════════════════════════════════════════════════════════════════
  function renderPatronApp() {
    root.innerHTML = headerHtml()+'<div id="patron-content"></div>'+
      '<div id="pdf-modal-overlay" style="display:none;"></div>'+
      '<div id="pdf-modal" style="display:none;"></div>'+
      '<div id="fiche-modal-overlay" style="display:none;"></div>'+
      '<div id="fiche-modal" style="display:none;"></div>';
    document.getElementById("btn-logout").addEventListener("click", logout);
    root.addEventListener("change", function(e){
      if(e.target && e.target.id==="filtre-acheteur"){ state.filtreAcheteur=e.target.value||null; renderPatronContent(); }
      if(e.target && e.target.id==="filtre-pdf"){ state.filtrePdf=e.target.value||null; renderPatronContent(); }
    });
    document.getElementById("patron-content").addEventListener("click", function(e){
      if(e.target && e.target.id==="btn-reset-filtres"){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); }
      if(e.target && e.target.id==="btn-upload-pdf"){
        var input=document.getElementById("pdf-file-input");
        if(!input||!input.files||!input.files[0]){alert("Choisis un fichier PDF.");return;}
        var fd=new FormData();fd.append("pdf",input.files[0]);
        e.target.disabled=true;e.target.textContent="Upload...";
        fetch("/api/pdfs",{method:"POST",body:fd,credentials:"same-origin"})
          .then(function(r){return r.json();})
          .then(function(d){if(d.error)throw new Error(d.error);state.pdfs.push(d.pdf);renderPatronContent();})
          .catch(function(e){alert("Erreur upload: "+e.message);});
      }
    });
    renderPatronContent();
  }

  function renderPatronContent() {
    var el = document.getElementById("patron-content");
    
    var html = "";

    // ─ PDF upload
    html += '<div class="block"><p class="section-title">Importer un PDF de parcelles</p>'+
      '<p class="hint">Uploadez le PDF, puis sélectionnez visuellement les pages à transformer en parcelles.</p>'+
      '<div class="row"><input id="pdf-file-input" type="file" accept="application/pdf" style="flex:1;"/>'+
      '<button id="btn-upload-pdf" class="primary">Uploader</button></div>';
    if (state.pdfs.length) {
      html += '<div style="margin-top:10px;">';
      state.pdfs.forEach(function(pdf){
        html += '<div class="pdf-list-item"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(pdf.originalName)+'</span>'+
          '<div class="row" style="flex-shrink:0;">'+
          '<button class="btn-select-pages primary" data-id="'+pdf.id+'" data-filename="'+esc(pdf.filename)+'">Sélectionner des pages</button>'+
          '<button class="btn-delete-pdf danger" data-id="'+pdf.id+'">Supprimer</button></div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // ─ Acheteurs
    html += '<div class="block"><p class="section-title">Comptes acheteurs</p><div class="chips">';
    state.acheteurs.forEach(function(a){
      html += '<span class="chip">'+esc(a.nom)+' ('+esc(a.username)+')'+
        '<button class="btn-del-acheteur" data-id="'+a.id+'" title="Supprimer">×</button></span>';
    });
    html += '</div><div class="row" style="flex-wrap:wrap;">'+
      '<input id="new-acheteur-nom" type="text" placeholder="Nom complet" style="flex:1;min-width:160px;"/>'+
      '<input id="new-acheteur-username" type="text" placeholder="Identifiant" style="flex:1;min-width:140px;"/>'+
      '<input id="new-acheteur-password" type="text" placeholder="Mot de passe" style="flex:1;min-width:120px;"/>'+
      '<button id="btn-add-acheteur">Créer le compte</button></div></div>';

    // ─ Parcelles
    var sorted = sortParcelles(state.parcelles);
    // Filtres
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

  html += '<div class="block"><p class="section-title">Parcelles à visiter ('+sorted.length+')</p>';
    if (!sorted.length) {
      html += '<p class="empty">Aucune parcelle. Sélectionnez des pages depuis un PDF ci-dessus.</p>';
    } else {
      sorted.forEach(function(p){
        var retours = state.retours.filter(function(r){return r.parcelleId===p.id;});
        var assignees = state.affectations.filter(function(a){return a.parcelleId===p.id;}).map(function(a){return a.acheteurId;});
        html += '<div class="card"><div class="card-head"><div>'+
          '<p class="card-title">'+esc(p.label)+'</p>';
        if (assignees.length) {
          var names = assignees.map(function(id){return state.usersMap[id]||"?";});
          html += '<p class="card-meta">Envoyé à : '+names.map(esc).join(", ")+'</p>';
        }
        html += '</div><button class="btn-remove-parcelle danger" data-id="'+p.id+'">Suppr.</button></div>';

        // Assignation
        html += '<div class="assign-row">';
        state.acheteurs.forEach(function(a){
          var checked = assignees.indexOf(a.id)!==-1;
          html += '<label class="assign-label'+(checked?" checked":"")+'">'+
            '<input type="checkbox" class="cb-assign" data-pid="'+p.id+'" data-aid="'+a.id+'" '+(checked?"checked":"")+' />'+
            esc(a.nom)+'</label>';
        });
        html += '</div>';

        // Historique retours acheteurs
        if (retours.length) {
          retours.forEach(function(r){
            var nomAcheteur = esc(state.usersMap[r.acheteurId]||"?");
            var pid = p.id, aid = r.acheteurId;
            var uid = pid+"-"+aid; // identifiant unique pour les inputs

            html += '<div class="history-block patron-retour-block" data-pid="'+pid+'" data-aid="'+aid+'">';

            // En-tête : nom + statut
            html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
            html += '<p style="margin:0;font-weight:700;font-size:14px;">'+nomAcheteur+'</p>';
            html += statutBadge(r.statut);
            html += '</div>';
            // Aperçu page PDF
            html += pdfPreviewHtml(p.pdfId, p.pageNum);

            // Statut modifiable
            html += '<div class="field-group"><label class="field-label">Statut</label>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;">';
            STATUTS.forEach(function(s){
              var checked = (r.statut||"")=== s.val;
              html += '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:5px 9px;border-radius:8px;border:1.5px solid '+(checked?"#0f6e56":"#e0ddd5")+';background:'+(checked?"#e1f5ee":"#fff")+';font-weight:'+(checked?"600":"400")+';">'+
                '<input type="radio" class="patron-statut-radio" name="patron-statut-'+uid+'" data-uid="'+uid+'" value="'+s.val+'" '+(checked?"checked":"")+' style="margin:0;width:auto;"/>'+
                s.icon+' '+s.label+'</label>';
            });
            html += '</div></div>';

            // Estimation
            html += '<div class="field-group"><label class="field-label">Estimation</label>';
            html += '<input class="patron-est-input" data-uid="'+uid+'" type="text" value="'+esc(r.estimation||"")+'" placeholder="ex: 3 500 €" style="width:100%;"/></div>';

            // Prix (si acheté)
            var showPrix = r.statut==="achete";
            html += '<div class="patron-prix-wrap field-group" data-uid="'+uid+'" style="'+(showPrix?"":"display:none;")+'">'+
              '<label class="field-label">Prix d\'achat</label>'+
              '<input class="patron-prix-input" data-uid="'+uid+'" type="text" value="'+esc(r.prix||"")+'" placeholder="ex: 4 200 €" style="width:100%;"/></div>';

            // Notes
            html += '<div class="field-group"><label class="field-label">Notes</label>';
            html += '<textarea class="patron-desc-input" data-uid="'+uid+'" rows="2" style="width:100%;">'+esc(r.description||"")+'</textarea></div>';

            // Fiche
            html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">';
            if (r.fiche) {
              html += '<button class="btn-voir-fiche" data-pid="'+pid+'" data-aid="'+aid+'" style="font-size:12px;">📋 Modifier la fiche</button>';
            } else {
              html += '<button class="btn-voir-fiche" data-pid="'+pid+'" data-aid="'+aid+'" style="font-size:12px;">📋 Remplir la fiche</button>';
            }
            html += '</div>';

            // Date + bouton sauvegarder
            if (r.date) html += '<p style="margin:0 0 8px;font-size:11px;color:#a3a098;">Dernière mise à jour acheteur : '+esc(fmtD(r.date))+'</p>';
            html += '<button class="btn-patron-save primary" data-pid="'+pid+'" data-aid="'+aid+'" data-uid="'+uid+'" style="font-size:12px;">💾 Sauvegarder les modifications</button>';

            html += '</div>';
          });
        }
        html += '</div>';
      });
    }
    html += '</div>';
    el.innerHTML = html;
    bindPatronEvents();
    renderAllPagePreviews();
  }

  function bindPatronEvents() {
    var el = document.getElementById("patron-content");

    

    el.querySelectorAll(".btn-select-pages").forEach(function(btn){
      btn.addEventListener("click", function(){
        openPdfPageSelector(btn.getAttribute("data-id"), btn.getAttribute("data-filename"));
      });
    });

    el.querySelectorAll(".btn-delete-pdf").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id = btn.getAttribute("data-id");
        if (!confirm("Supprimer ce PDF ?")) return;
        api("DELETE","/api/pdfs/"+id).then(function(){
          state.pdfs=state.pdfs.filter(function(p){return p.id!==id;}); renderPatronContent();
        });
      });
    });

    document.getElementById("btn-add-acheteur").addEventListener("click", function(){
      var nom=document.getElementById("new-acheteur-nom").value.trim();
      var username=document.getElementById("new-acheteur-username").value.trim();
      var password=document.getElementById("new-acheteur-password").value;
      if (!nom||!username||!password) { alert("Remplis tous les champs."); return; }
      api("POST","/api/acheteurs",{nom,username,password}).then(function(d){
        state.acheteurs.push(d.acheteur); state.usersMap[d.acheteur.id]=d.acheteur.nom; renderPatronContent();
      }).catch(function(e){ alert(e.message); });
    });

    el.querySelectorAll(".btn-del-acheteur").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id=btn.getAttribute("data-id");
        if (!confirm("Supprimer ce compte acheteur ?")) return;
        api("DELETE","/api/acheteurs/"+id).then(function(){
          state.acheteurs=state.acheteurs.filter(function(a){return a.id!==id;});
          state.affectations=state.affectations.filter(function(a){return a.acheteurId!==id;});
          state.retours=state.retours.filter(function(r){return r.acheteurId!==id;}); renderPatronContent();
        });
      });
    });

    el.querySelectorAll(".btn-remove-parcelle").forEach(function(btn){
      btn.addEventListener("click", function(){
        var id=btn.getAttribute("data-id");
        if (!confirm("Supprimer cette parcelle et son historique ?")) return;
        api("DELETE","/api/parcelles/"+id).then(function(){
          state.parcelles=state.parcelles.filter(function(p){return p.id!==id;});
          state.affectations=state.affectations.filter(function(a){return a.parcelleId!==id;});
          state.retours=state.retours.filter(function(r){return r.parcelleId!==id;}); renderPatronContent();
        });
      });
    });

    el.querySelectorAll(".cb-assign").forEach(function(cb){
      cb.addEventListener("change", function(){
        var pid=cb.getAttribute("data-pid"), aid=cb.getAttribute("data-aid"), assign=cb.checked;
        api("POST","/api/affectations",{parcelleId:pid,acheteurId:aid,assign}).then(function(){
          if (assign) state.affectations.push({parcelleId:pid,acheteurId:aid});
          else state.affectations=state.affectations.filter(function(a){return !(a.parcelleId===pid&&a.acheteurId===aid);});
          renderPatronContent();
        });
      });
    });

    // Fiche (patron peut modifier)
    el.querySelectorAll(".btn-voir-fiche").forEach(function(btn){
      btn.addEventListener("click", function(){
        var pid=btn.getAttribute("data-pid"), aid=btn.getAttribute("data-aid");
        var retour=state.retours.find(function(r){return r.parcelleId===pid&&r.acheteurId===aid;})||{acheteurId:aid,parcelleId:pid};
        var parcelle=state.parcelles.find(function(p){return p.id===pid;});
        openFicheModalEFC(parcelle, retour, false); // false = éditable par le patron
      });
    });

    // Statut radio patron
    el.querySelectorAll(".patron-statut-radio").forEach(function(radio){
      radio.addEventListener("change", function(){
        var uid=radio.getAttribute("data-uid"), statut=radio.value;
        var showPrix=statut==="achete";
        var prixWrap=el.querySelector('.patron-prix-wrap[data-uid="'+uid+'"]');
        if (prixWrap) prixWrap.style.display=showPrix?"":"none";
        el.querySelectorAll('input[name="patron-statut-'+uid+'"]').forEach(function(r){
          var lbl=r.parentElement, sel=r.value===statut;
          lbl.style.borderColor=sel?"#0f6e56":"#e0ddd5";
          lbl.style.background=sel?"#e1f5ee":"#fff";
          lbl.style.fontWeight=sel?"600":"400";
        });
      });
    });

    // Sauvegarder modifications patron
    el.querySelectorAll(".btn-patron-save").forEach(function(btn){
      btn.addEventListener("click", function(){
        var pid=btn.getAttribute("data-pid"), aid=btn.getAttribute("data-aid"), uid=btn.getAttribute("data-uid");
        var statutEl=el.querySelector('input[name="patron-statut-'+uid+'"]:checked');
        var statut=statutEl?statutEl.value:"";
        var desc=(el.querySelector('.patron-desc-input[data-uid="'+uid+'"]')||{}).value||"";
        var est=(el.querySelector('.patron-est-input[data-uid="'+uid+'"]')||{}).value||"";
        var prix=(el.querySelector('.patron-prix-input[data-uid="'+uid+'"]')||{}).value||"";
        var retourExist=state.retours.find(function(r){return r.parcelleId===pid&&r.acheteurId===aid;})||{};

        // On sauvegarde en simulant le retour de l'acheteur via l'API
        api("POST","/api/retours-patron",{
          parcelleId:pid, acheteurId:aid, statut, description:desc,
          estimation:est, achete:statut==="achete", prix:statut==="achete"?prix:"",
          fiche:null, ficheEFC:retourExist.ficheEFC||null
        }).then(function(d){
          var idx=state.retours.findIndex(function(r){return r.parcelleId===pid&&r.acheteurId===aid;});
          if (idx!==-1) state.retours[idx]=d.retour; else state.retours.push(d.retour);
          btn.textContent="✓ Sauvegardé !";
          setTimeout(function(){ btn.textContent="💾 Sauvegarder les modifications"; renderPatronContent(); }, 1200);
        }).catch(function(e){ alert("Erreur: "+e.message); });
      });
    });
  }

  // ── EXTRACTION DATES PDF ──────────────────────────────────────────
  var MOIS_FR = {
    'janvier':0,'fevrier':1,'f\u00e9vrier':1,'mars':2,'avril':3,'mai':4,'juin':5,
    'juillet':6,'aout':7,'ao\u00fbt':7,'septembre':8,'octobre':9,'novembre':10,
    'decembre':11,'d\u00e9cembre':11
  };

  function extractDateFromText(text) {
    // Format DD/MM/YYYY ou DD-MM-YYYY
    var m = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/);
    if (m) {
      var d = new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1]));
      if (!isNaN(d.getTime()) && parseInt(m[2]) >= 1 && parseInt(m[2]) <= 12) return d;
    }
    // Format "12 mars 2025" / "lundi 12 mars 2025"
    var noms = Object.keys(MOIS_FR).join('|');
    var re = new RegExp('(\\d{1,2})\\s+('+noms+')\\s+(20\\d{2})', 'i');
    var mFr = text.toLowerCase().match(re);
    if (mFr && MOIS_FR[mFr[2]] !== undefined) {
      var d2 = new Date(parseInt(mFr[3]), MOIS_FR[mFr[2]], parseInt(mFr[1]));
      if (!isNaN(d2.getTime())) return d2;
    }
    return null;
  }

  function analyzePdfDates(url, onProgress, onDone) {
    if (typeof pdfjsLib === 'undefined') { onDone(null); return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var pages = [];
    pdfjsLib.getDocument(url).promise.then(function(doc) {
      var total = doc.numPages;
      var doPage = function(i) {
        if (i > total) {
          // Tri : pages avec date dans l'ordre, puis sans date
          var dated   = pages.filter(function(p){return p.date;}).sort(function(a,b){return a.date-b.date;});
          var undated = pages.filter(function(p){return !p.date;});
          onDone(dated.concat(undated));
          return;
        }
        onProgress(i, total);
        doc.getPage(i).then(function(page){
          return page.getTextContent();
        }).then(function(tc){
          var text = tc.items.map(function(it){return it.str;}).join(' ');
          var date = extractDateFromText(text);
          var dateStr = date ? date.toLocaleDateString('fr-FR') : null;
          pages.push({num:i, date:date, dateStr:dateStr});
          doPage(i+1);
        }).catch(function(){ pages.push({num:i, date:null, dateStr:null}); doPage(i+1); });
      };
      doPage(1);
    }).catch(function(){ onDone(null); });
  }

  function buildPageCards(pages, selectedNums, assignLabel) {
    if (!pages || !pages.length) return '<p style="color:#a3a098;font-size:13px;">Aucune page trouv00e9e.</p>';
    var html = '';
    pages.forEach(function(p) {
      var sel = selectedNums.indexOf(p.num) !== -1;
      html += '<div class="pdf-page-card" data-page="'+p.num+'" style="'+
        'padding:10px 12px;border:2px solid '+(sel?'#0f6e56':'#e0ddd5')+';border-radius:8px;cursor:pointer;'+
        'background:'+(sel?'#e1f5ee':'#fff')+';transition:all 0.15s;user-select:none;">'+
        '<p style="margin:0;font-weight:600;font-size:13px;">Page '+p.num+'</p>'+
        (p.dateStr
          ? '<p style="margin:2px 0 0;font-size:12px;color:#0f6e56;">📅 Vente du '+p.dateStr+'</p>'
          : '<p style="margin:2px 0 0;font-size:11px;color:#a3a098;">Date non détectée</p>')+
        (sel ? '<p style="margin:2px 0 0;font-size:11px;color:#0f6e56;font-weight:600;">✓ Sélectionnée</p>' : '')+
        '</div>';
    });
    return html;
  }

  // ══════════════════════════════════════════════════════════════════
  // PDF PAGE SELECTOR MODAL
  // ══════════════════════════════════════════════════════════════════
  function openPdfPageSelector(pdfId, filename) {
    state.pdfSelectorId=pdfId; state.pdfSelectedPages=[]; state.pdfAssignAcheteurId=null; state.pdfPages=[];
    var overlay=document.getElementById("pdf-modal-overlay");
    var modal=document.getElementById("pdf-modal");
    overlay.style.cssText="display:block;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100;";
    modal.style.cssText="display:flex;flex-direction:column;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(96vw,960px);height:90vh;background:#fff;border-radius:14px;z-index:101;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);";
    modal.innerHTML=
      '<div style="padding:14px 20px;border-bottom:1px solid #e0ddd5;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">'+
        '<div><p style="margin:0;font-weight:600;font-size:15px;">Ventes — triées par date automatiquement</p>'+
        '<p style="margin:2px 0 0;font-size:12px;color:#6f6e69;">Pages détectées et triées par date de vente</p></div>'+
        '<button id="btn-close-modal" style="font-size:20px;border:none;background:none;cursor:pointer;color:#6f6e69;padding:4px 8px;">✕</button></div>'+
      '<div style="display:flex;flex:1;overflow:hidden;">'+
        '<div style="flex:1;overflow-y:auto;background:#404040;padding:10px;" id="patron-pdf-viewer"><p style="color:#ccc;text-align:center;padding:40px;">Chargement...</p></div>'+
        '<div style="width:280px;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;">'+
          '<div style="padding:10px 14px;border-bottom:1px solid #e0ddd5;flex-shrink:0;">'+
            '<p style="margin:0 0 6px;font-size:13px;font-weight:600;">Assigner à :</p>'+
            '<div id="modal-acheteur-list" style="display:flex;flex-direction:column;gap:5px;">'+pdfAcheteurBtns()+'</div></div>'+
          '<div id="modal-page-list" style="flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:6px;">'+
            '<p style="color:#6f6e69;font-size:13px;text-align:center;margin-top:20px;">⏳ Analyse des dates en cours…</p></div>'+
          '<div style="padding:10px 14px;border-top:1px solid #e0ddd5;flex-shrink:0;">'+
            '<p id="modal-sel-count" style="margin:0 0 6px;font-size:12px;color:#6f6e69;">Aucune vente sélectionnée</p>'+
            '<p id="modal-error" style="margin:0 0 6px;font-size:12px;color:#a32d2d;min-height:14px;"></p>'+
            '<button id="btn-modal-confirm" class="primary" style="width:100%;" disabled>Créer les parcelles</button>'+
            '<button id="btn-modal-cancel" style="width:100%;margin-top:6px;">Annuler</button></div></div></div>';

    document.getElementById("btn-close-modal").addEventListener("click", closePdfModal);
    document.getElementById("btn-modal-cancel").addEventListener("click", closePdfModal);
    document.getElementById("btn-modal-confirm").addEventListener("click", confirmPageSelection);
    overlay.addEventListener("click", closePdfModal);
    modal.addEventListener("click", function(e){e.stopPropagation();});
    var proxyUrl='/api/proxy-pdf?url='+encodeURIComponent(filename);
    if(typeof pdfjsLib!=='undefined'){
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfjsLib.getDocument(proxyUrl).promise.then(function(doc){
        var viewer=document.getElementById('patron-pdf-viewer');
        if(!viewer)return;
        viewer.innerHTML='';
        for(var i=1;i<=doc.numPages;i++){(function(n){
          var c=document.createElement('canvas');
          c.style.cssText='display:block;width:100%;margin-bottom:8px;background:#fff;';
          viewer.appendChild(c);
          doc.getPage(n).then(function(p){
            var vp=p.getViewport({scale:1});
            var sc=(viewer.offsetWidth-20)/vp.width;
            var sv=p.getViewport({scale:sc});
            c.width=sv.width;c.height=sv.height;
            p.render({canvasContext:c.getContext('2d'),viewport:sv});
          });
        })(i);}
      }).catch(function(){
        var v=document.getElementById('patron-pdf-viewer');
        if(v)v.innerHTML='<p style="color:#f88;text-align:center;padding:40px;">Impossible de charger le PDF.</p>';
      });
    }
    bindPdfAcheteurBtns();
    analyzePdfDates(proxyUrl,
      function(i,total){
        var el=document.getElementById("modal-page-list");
        if(el) el.innerHTML='<p style="color:#6f6e69;font-size:13px;text-align:center;margin-top:20px;">⏳ Lecture page '+i+'/'+total+'…</p>';
      },
      function(pages){
        state.pdfPages=pages||[];
        refreshPatronPageList();
      }
    );
  }

  function refreshPatronPageList() {
    var el=document.getElementById("modal-page-list");
    if (!el) return;
    if (!state.pdfPages.length) { el.innerHTML='<p style="color:#a3a098;font-size:13px;">Analyse non disponible.</p>'; return; }
    el.innerHTML=buildPageCards(state.pdfPages, state.pdfSelectedPages);
    el.querySelectorAll(".pdf-page-card").forEach(function(card){
      card.addEventListener("click", function(){
        var num=parseInt(card.getAttribute("data-page"));
        var idx=state.pdfSelectedPages.indexOf(num);
        if (idx===-1) state.pdfSelectedPages.push(num); else state.pdfSelectedPages.splice(idx,1);
        refreshPatronPageList();
        updatePdfConfirmBtn();
      });
    });
  }


  function pdfAcheteurBtns() {
    if (!state.acheteurs.length) return '<p style="font-size:13px;color:#a3a098;margin:0;">Aucun acheteur créé.</p>';
    return state.acheteurs.map(function(a){
      return '<button class="modal-acheteur-btn" data-aid="'+a.id+'" style="padding:8px 12px;border-radius:8px;font-size:13px;border:1.5px solid #e0ddd5;background:#f7f6f3;cursor:pointer;font-weight:500;text-align:left;">'+esc(a.nom)+'</button>';
    }).join("");
  }
  function bindPdfAcheteurBtns() {
    var list=document.getElementById("modal-acheteur-list");
    if (!list) return;
    list.querySelectorAll(".modal-acheteur-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        var aid=btn.getAttribute("data-aid");
        state.pdfAssignAcheteurId=state.pdfAssignAcheteurId===aid?null:aid;
        list.querySelectorAll(".modal-acheteur-btn").forEach(function(b){
          var sel=b.getAttribute("data-aid")===state.pdfAssignAcheteurId;
          b.style.borderColor=sel?"#0f6e56":"#e0ddd5"; b.style.background=sel?"#e1f5ee":"#f7f6f3"; b.style.color=sel?"#0f6e56":"#2c2c2a";
        });
        updatePdfConfirmBtn();
      });
    });
  }
  function parsePageInput(str) {
    var pages=[];
    str.split(",").forEach(function(part){
      part=part.trim();
      var range=part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (range) { for (var i=parseInt(range[1]);i<=parseInt(range[2]);i++) pages.push(i); }
      else if (/^\d+$/.test(part)) pages.push(parseInt(part));
    });
    return pages.filter(function(v,i,a){return a.indexOf(v)===i;});
  }
  function updatePdfConfirmBtn() {
    var btn=document.getElementById("btn-modal-confirm");
    var errEl=document.getElementById("modal-error");
    var countEl=document.getElementById("modal-sel-count");
    var n=state.pdfSelectedPages.length, hasA=!!state.pdfAssignAcheteurId;
    if (countEl) countEl.textContent=n>0?n+" vente(s) sélectionnée(s)":"Aucune vente sélectionnée";
    if (errEl) {
      if (n>0&&!hasA) errEl.textContent="Choisissez un acheteur.";
      else if (!n&&hasA) errEl.textContent="Sélectionnez au moins une vente.";
      else errEl.textContent="";
    }
    if (btn) btn.disabled=!(n>0&&hasA);
  }
  function confirmPageSelection() {
    // Trier les pages sélectionnées selon l'ordre date (pdfPages est déjà trié par date)
    var selectedNums=state.pdfSelectedPages;
    var orderedSelected = state.pdfPages.filter(function(p){return selectedNums.indexOf(p.num)!==-1;});
    // Si pas d'analyse (pdfPages vide), fallback page order
    if (!orderedSelected.length) orderedSelected=selectedNums.map(function(n){return {num:n,dateStr:null};});
    var acheteurId=state.pdfAssignAcheteurId, pdfId=state.pdfSelectorId;
    if (!orderedSelected.length||!acheteurId) return;
    var lignes=orderedSelected.map(function(p){
      return p.dateStr ? "Vente du "+p.dateStr : "Page "+p.num;
    });
    var pageNums=orderedSelected.map(function(p){return p.num;});
    var btn=document.getElementById("btn-modal-confirm");
    if (btn){btn.disabled=true;btn.textContent="Création…";}
    api("POST","/api/parcelles",{lignes:lignes, pageNums:pageNums, pdfId}).then(function(d){
      var newP=d.parcelles||[];
      state.parcelles=state.parcelles.concat(newP);
      return Promise.all(newP.map(function(p){
        return api("POST","/api/affectations",{parcelleId:p.id,acheteurId,assign:true}).then(function(){
          state.affectations.push({parcelleId:p.id,acheteurId});
        });
      }));
    }).then(function(){ closePdfModal(); renderPatronContent(); })
      .catch(function(e){ alert("Erreur : "+e.message); if(btn){btn.disabled=false;btn.textContent="Créer les parcelles";} });
  }
  function closePdfModal() {
    var overlay=document.getElementById("pdf-modal-overlay");
    var modal=document.getElementById("pdf-modal");
    if (overlay) overlay.style.display="none";
    if (modal) modal.style.display="none";
    state.pdfSelectedPages=[]; state.pdfAssignAcheteurId=null;
  }

  // ══════════════════════════════════════════════════════════════════
  // ACHETEUR APP
  // ══════════════════════════════════════════════════════════════════
  function renderAcheteurApp() {
    root.innerHTML = headerHtml()+'<div id="acheteur-content"></div>'+
      '<div id="pdf-modal-overlay" style="display:none;"></div>'+
      '<div id="pdf-modal" style="display:none;"></div>'+
      '<div id="fiche-modal-overlay" style="display:none;"></div>'+
      '<div id="fiche-modal" style="display:none;"></div>';
    document.getElementById("btn-logout").addEventListener("click", logout);
    renderAcheteurContent();
  }

  function renderAcheteurContent() {
    var el=document.getElementById("acheteur-content");
    var sorted=sortParcelles(state.parcelles);

    // Section PDFs disponibles
    var html='<div class="block">';
    html+='<p class="section-title">📄 PDFs disponibles</p>';
    if (!state.pdfs.length) {
      html+='<p class="empty">Aucun PDF disponible pour le moment.</p>';
    } else {
      state.pdfs.forEach(function(pdf){
        html+='<div class="pdf-list-item">'+
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">'+esc(pdf.originalName)+'</span>'+
          '<div class="row" style="flex-shrink:0;">'+
          
          '<button class="btn-acheteur-select-pages primary" data-id="'+pdf.id+'" data-filename="'+esc(pdf.filename)+'" style="font-size:12px;">📌 Sélectionner mes pages</button>'+
          '</div></div>';
      });
    }
    html+='</div>';

    html+='<div class="block"><p class="section-title">Mes parcelles à estimer ('+sorted.length+')</p>';
    if (!sorted.length) { html+='<p class="empty">Aucune parcelle assignée pour le moment.</p>'; }
    else {
      sorted.forEach(function(p){
        var retour=state.retours.find(function(r){return r.parcelleId===p.id;})||{};
        var statut=retour.statut||"";
        html+='<div class="card">';
        html+='<div class="card-head" style="margin-bottom:10px;"><p class="card-title">'+esc(p.label)+'</p>'+statutBadge(statut)+'</div>';
        // Aperçu de la page PDF
        html+=pdfPreviewHtml(p.pdfId, p.pageNum);

        // ─ Statut
        html+='<div class="field-group"><label class="field-label">Statut de la visite</label>'+
          '<div style="display:flex;flex-direction:column;gap:5px;margin-top:4px;">';
        STATUTS.forEach(function(s){
          var checked=statut===s.val;
          html+='<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:7px 10px;border-radius:8px;border:1.5px solid '+(checked?"#0f6e56":"#e0ddd5")+';background:'+(checked?"#e1f5ee":"#fff")+';font-weight:'+(checked?"600":"400")+';">'+
            '<input type="radio" class="statut-radio" name="statut-'+p.id+'" data-pid="'+p.id+'" value="'+s.val+'" '+(checked?"checked":"")+' style="margin:0;width:auto;"/>'+
            s.icon+' '+s.label+'</label>';
        });
        html+='</div></div>';

        // ─ Champs conditionnels
        var showEst=ficheRequired(statut);
        var showPrix=statut==="achete";

        html+='<div class="est-wrap field-group" data-pid="'+p.id+'" style="'+(showEst?"":"display:none;")+'">'+
          '<label class="field-label">Estimation de la valeur</label>'+
          '<input class="est-input" data-pid="'+p.id+'" type="text" value="'+esc(retour.estimation||"")+'" placeholder="ex: 3 500 € — qualité bonne"/></div>';

        html+='<div class="prix-wrap field-group" data-pid="'+p.id+'" style="'+(showPrix?"":"display:none;")+'">'+
          '<label class="field-label">Prix d\'achat</label>'+
          '<input class="prix-input" data-pid="'+p.id+'" type="text" value="'+esc(retour.prix||"")+'" placeholder="ex: 4 200 €"/></div>';

        // ─ Fiche d\'estimation
        if (ficheRequired(statut)) {
          var hasFiche=!!(retour&&(retour.fiche||retour.ficheEFC));
          html+='<div style="margin:8px 0;"><button class="btn-open-fiche '+(hasFiche?"primary":"")+'" data-pid="'+p.id+'" style="font-size:13px;">'+
            (hasFiche?"📋 Modifier la fiche d\'estimation":"📋 Remplir la fiche d\'estimation")+'</button>'+
            (hasFiche?'<span style="font-size:12px;color:#0f6e56;margin-left:8px;">✓ Fiche remplie</span>':'')+'</div>';
        }

        // ─ Notes
        html+='<div class="field-group"><label class="field-label">Notes (facultatif)</label>'+
          '<textarea class="desc-input" data-pid="'+p.id+'" rows="2">'+esc(retour.description||"")+'</textarea></div>';

        if (retour.date) html+='<p class="card-meta" style="margin-bottom:8px;">Dernière mise à jour : '+esc(fmtD(retour.date))+'</p>';
        html+='<button class="btn-save-retour primary" data-pid="'+p.id+'">Enregistrer</button></div>';
      });
    }
    html+='</div>';
    el.innerHTML=html;
    bindAcheteurEvents();
    renderAllPagePreviews();
  }

  function bindAcheteurEvents() {
    var el=document.getElementById("acheteur-content");

    el.querySelectorAll(".statut-radio").forEach(function(radio){
      radio.addEventListener("change", function(){
        var pid=radio.getAttribute("data-pid"), statut=radio.value;
        var showEst=ficheRequired(statut), showPrix=statut==="achete";
        var eW=el.querySelector('.est-wrap[data-pid="'+pid+'"]');
        var pW=el.querySelector('.prix-wrap[data-pid="'+pid+'"]');
        if (eW) eW.style.display=showEst?"":"none";
        if (pW) pW.style.display=showPrix?"":"none";
        el.querySelectorAll('input[name="statut-'+pid+'"]').forEach(function(r){
          var lbl=r.parentElement, sel=r.value===statut;
          lbl.style.borderColor=sel?"#0f6e56":"#e0ddd5";
          lbl.style.background=sel?"#e1f5ee":"#fff";
          lbl.style.fontWeight=sel?"600":"400";
        });
        // Afficher/masquer bouton fiche
        var ficheBtn=el.querySelector('.btn-open-fiche[data-pid="'+pid+'"]');
        if (ficheBtn) ficheBtn.parentElement.style.display=ficheRequired(statut)?"":"none";
        if (ficheRequired(statut)&&!ficheBtn) {
          // Insérer le bouton s'il n'existe pas encore
          var saveBtn=el.querySelector('.btn-save-retour[data-pid="'+pid+'"]');
          if (saveBtn) {
            var div=document.createElement("div");
            div.style.margin="8px 0";
            div.innerHTML='<button class="btn-open-fiche" data-pid="'+pid+'" style="font-size:13px;">📋 Remplir la fiche d\'estimation</button>';
            saveBtn.parentElement.insertBefore(div, saveBtn);
            div.querySelector(".btn-open-fiche").addEventListener("click", function(){
              var parcelle=state.parcelles.find(function(p){return p.id===pid;});
              var retour=state.retours.find(function(r){return r.parcelleId===pid;})||{};
              openFicheModalEFC(parcelle, retour, false);
            });
          }
        }
      });
    });

    el.querySelectorAll(".btn-open-fiche").forEach(function(btn){
      btn.addEventListener("click", function(){
        var pid=btn.getAttribute("data-pid");
        var parcelle=state.parcelles.find(function(p){return p.id===pid;});
        var retour=state.retours.find(function(r){return r.parcelleId===pid;})||{};
        openFicheModalEFC(parcelle, retour, false);
      });
    });

    el.querySelectorAll(".btn-save-retour").forEach(function(btn){
      btn.addEventListener("click", function(){
        var pid=btn.getAttribute("data-pid");
        var r=el.querySelector('input[name="statut-'+pid+'"]:checked');
        if (!r) { alert("Choisissez un statut."); return; }
        var statut=r.value;
        var desc=el.querySelector('.desc-input[data-pid="'+pid+'"]').value;
        var est=(el.querySelector('.est-input[data-pid="'+pid+'"]')||{}).value||"";
        var prix=(el.querySelector('.prix-input[data-pid="'+pid+'"]')||{}).value||"";
        var retourExist=state.retours.find(function(rx){return rx.parcelleId===pid;})||{};
        api("POST","/api/retours",{
          parcelleId:pid, statut, description:desc, estimation:est,
          achete:statut==="achete", prix:statut==="achete"?prix:"",
          fiche:null, ficheEFC:retourExist.ficheEFC||null
        }).then(function(d){
          var idx=state.retours.findIndex(function(rx){return rx.parcelleId===pid;});
          if (idx!==-1) state.retours[idx]=d.retour; else state.retours.push(d.retour);
          renderAcheteurContent();
        }).catch(function(e){ alert("Erreur: "+e.message); });
      });
    });

    // PDF viewer + sélection de pages acheteur

    el.querySelectorAll(".btn-acheteur-select-pages").forEach(function(btn){
      btn.addEventListener("click", function(){
        openPdfPageSelectorAcheteur(btn.getAttribute("data-id"), btn.getAttribute("data-filename"));
      });
    });
  }

  // Sélecteur de pages acheteur
  function openPdfPageSelectorAcheteur(pdfId, filename) {
    state.pdfSelectorId=pdfId; state.pdfSelectedPages=[]; state.pdfPages=[];
    var url='/api/proxy-pdf?url='+encodeURIComponent(filename);
    var overlay=document.getElementById("pdf-modal-overlay");
    var modal  =document.getElementById("pdf-modal");
    overlay.style.cssText="display:block;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;";
    modal.style.cssText="display:flex;flex-direction:column;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(98vw,900px);height:93vh;background:#fff;border-radius:14px;z-index:101;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,0.35);";

    modal.innerHTML=
      '<div style="padding:13px 20px;border-bottom:1px solid #e0ddd5;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">'+
        '<div>'+
          '<p style="margin:0;font-weight:700;font-size:15px;">Selectionnez vos ventes</p>'+
          '<p style="margin:2px 0 0;font-size:12px;color:#6f6e69;">Faites defiler et cliquez directement sur une page pour la selectionner</p>'+
        '</div>'+
        '<button id="btn-close-modal" style="font-size:22px;border:none;background:none;cursor:pointer;color:#6f6e69;padding:4px 10px;">x</button>'+
      '</div>'+
      '<div style="display:flex;flex:1;overflow:hidden;">'+
        '<div id="ach-viewer" style="flex:1;overflow-y:auto;background:#404040;padding:20px;display:flex;flex-direction:column;gap:14px;">'+
          '<p style="color:#ccc;text-align:center;font-size:13px;padding:40px 0;">Chargement du PDF...</p>'+
        '</div>'+
        '<div style="width:200px;flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid #e0ddd5;">'+
          '<div style="padding:10px 12px;border-bottom:1px solid #e0ddd5;background:#f7f6f3;flex-shrink:0;">'+
            '<p style="margin:0;font-size:12px;font-weight:700;">Selectionnees</p>'+
          '</div>'+
          '<div id="ach-sel-list" style="flex:1;overflow-y:auto;padding:8px 12px;">'+
            '<p style="color:#a3a098;font-size:12px;margin:0;">Aucune</p>'+
          '</div>'+
          '<div style="padding:10px 12px;border-top:1px solid #e0ddd5;flex-shrink:0;">'+
            '<p id="ach-sel-count" style="margin:0 0 6px;font-size:11px;color:#6f6e69;">Aucune vente selectionnee</p>'+
            '<button id="btn-modal-confirm" class="primary" style="width:100%;font-size:12px;" disabled>Ajouter a mes parcelles</button>'+
            '<button id="btn-modal-cancel" style="width:100%;margin-top:5px;font-size:12px;">Annuler</button>'+
          '</div>'+
        '</div>'+
      '</div>';

    document.getElementById("btn-close-modal").addEventListener("click", closePdfModal);
    document.getElementById("btn-modal-cancel").addEventListener("click", closePdfModal);
    overlay.addEventListener("click", closePdfModal);
    modal.addEventListener("click", function(e){e.stopPropagation();});
    document.getElementById("btn-modal-confirm").addEventListener("click", confirmAcheteurPageSelection);

    if (typeof pdfjsLib==="undefined") {
      document.getElementById("ach-viewer").innerHTML='<p style="color:#f88;text-align:center;padding:40px;">PDF.js non disponible.</p>';
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    pdfjsLib.getDocument(url).promise.then(function(doc){
      _pdfCache[url]=doc;
      var total=doc.numPages;
      var viewer=document.getElementById("ach-viewer");
      if (!viewer) return;
      viewer.innerHTML='<p style="color:#ccc;text-align:center;font-size:13px;">Analyse des dates ('+total+' pages)...</p>';

      var datePromises=[];
      for (var i=1;i<=total;i++) {
        (function(n){
          datePromises.push(
            doc.getPage(n).then(function(page){
              return page.getTextContent().then(function(tc){
                var text=tc.items.map(function(it){return it.str;}).join(' ');
                var date=extractDateFromText(text);
                return {num:n, date:date, dateStr:date?date.toLocaleDateString('fr-FR'):null};
              });
            })
          );
        })(i);
      }

      Promise.all(datePromises).then(function(infos){
        var dated=infos.filter(function(p){return p.date;}).sort(function(a,b){return a.date-b.date;});
        var undated=infos.filter(function(p){return !p.date;});
        state.pdfPages=dated.concat(undated);

        viewer=document.getElementById("ach-viewer");
        if (!viewer) return;
        viewer.innerHTML='';

        state.pdfPages.forEach(function(p){
          var wrap=document.createElement('div');
          wrap.setAttribute('data-page',p.num);
          wrap.style.cssText='position:relative;cursor:pointer;border:4px solid transparent;border-radius:6px;overflow:hidden;flex-shrink:0;transition:border-color 0.15s,box-shadow 0.15s;';

          var canvas=document.createElement('canvas');
          canvas.style.cssText='display:block;width:100%;background:#ddd;';

          var lbl=document.createElement('div');
          lbl.style.cssText='position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.72);color:#fff;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;pointer-events:none;';
          lbl.textContent=p.dateStr?'Vente du '+p.dateStr:'Page '+p.num;

          var chk=document.createElement('div');
          chk.style.cssText='display:none;position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;background:#0f6e56;color:#fff;font-size:20px;font-weight:700;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);pointer-events:none;';
          chk.innerHTML='v';

          wrap.appendChild(canvas);
          wrap.appendChild(lbl);
          wrap.appendChild(chk);
          viewer.appendChild(wrap);

          doc.getPage(p.num).then(function(page){
            var vp=page.getViewport({scale:1});
            var scale=620/vp.width;
            var sv=page.getViewport({scale:scale});
            canvas.width=sv.width;
            canvas.height=sv.height;
            page.render({canvasContext:canvas.getContext('2d'),viewport:sv});
          }).catch(function(){});

          wrap.addEventListener('click',function(){
            var num=parseInt(wrap.getAttribute('data-page'));
            var idx=state.pdfSelectedPages.indexOf(num);
            if (idx===-1){
              state.pdfSelectedPages.push(num);
              wrap.style.borderColor='#0f6e56';
              wrap.style.boxShadow='0 0 0 3px #e1f5ee';
              chk.style.display='flex';
            } else {
              state.pdfSelectedPages.splice(idx,1);
              wrap.style.borderColor='transparent';
              wrap.style.boxShadow='none';
              chk.style.display='none';
            }
            updateAcheteurSelPanel();
          });
        });
      });
    }).catch(function(){
      var v=document.getElementById("ach-viewer");
      if(v) v.innerHTML='<p style="color:#f88;text-align:center;padding:40px;">Impossible de charger le PDF.</p>';
    });
  }

  function updateAcheteurSelPanel() {
    var n=state.pdfSelectedPages.length;
    var btn=document.getElementById("btn-modal-confirm");
    var countEl=document.getElementById("ach-sel-count");
    var list=document.getElementById("ach-sel-list");
    if (btn) btn.disabled=!n;
    if (countEl) countEl.textContent=n>0?n+' selectionnee'+(n>1?'s':''):'Aucune vente selectionnee';
    if (!list) return;
    if (!n){list.innerHTML='<p style="color:#a3a098;font-size:12px;margin:0;">Aucune</p>';return;}
    var ordered=state.pdfPages.filter(function(p){return state.pdfSelectedPages.indexOf(p.num)!==-1;});
    list.innerHTML=ordered.map(function(p){
      return '<div style="padding:5px 0;border-bottom:1px solid #e0ddd5;font-size:11px;">'+
        '<strong>Page '+p.num+'</strong>'+(p.dateStr?'<br><span style="color:#0f6e56;">'+p.dateStr+'</span>':'')+
        '</div>';
    }).join('');
  }


  function confirmAcheteurPageSelection() {
    var selectedNums=state.pdfSelectedPages;
    var ordered=state.pdfPages.filter(function(p){return selectedNums.indexOf(p.num)!==-1;});
    if (!ordered.length) ordered=selectedNums.map(function(n){return {num:n,dateStr:null};});
    var lignes=ordered.map(function(p){return p.dateStr?"Vente du "+p.dateStr:"Page "+p.num;});
    var pageNums=ordered.map(function(p){return p.num;});
    var pdfId=state.pdfSelectorId;
    if (!ordered.length) return;
    var btn=document.getElementById("btn-modal-confirm");
    if (btn){btn.disabled=true;btn.textContent="Ajout…";}
    api("POST","/api/parcelles-acheteur",{lignes:lignes, pageNums:pageNums, pdfId})
      .then(function(d){
        state.parcelles=state.parcelles.concat(d.parcelles||[]);
        state.affectations=state.affectations.concat(d.affectations||[]);
        closePdfModal();
        renderAcheteurContent();
      })
      .catch(function(e){ alert("Erreur : "+e.message); if(btn){btn.disabled=false;btn.textContent="Ajouter à mes parcelles";} });
  }

  // ══════════════════════════════════════════════════════════════════
  // FICHE D'ESTIMATION MODAL
  // ══════════════════════════════════════════════════════════════════
  var MARGES = [-0.225,-0.20,-0.175,-0.15,-0.125,-0.10,-0.075,-0.05,-0.025,0,0.025,0.05,0.075,0.10,0.125,0.15,0.175];
  var MARGE_LABELS = ["-22%","-20%","-17%","-15%","-12%","-10%","-7%","-5%","-2%","0%","+2%","+5%","+7%","+10%","+12%","+15%","+17%"];

  function defaultFiche() {
    return {
      article:"", ratioST_T:"0,50", ratioST_M3:"0,65",
      prixExploitST:"", prixExploitTonne:"", prixExploitM3:"",
      volumeCahier:"", volumeEFC:"", objectifPrix:"",
      montantExpl:"", montantFrais:"0",
      bc:[
        {essence:"DOUGLAS",pct:"",volume:"",prixVente:"",coutTrans:""},
        {essence:"EPICEAS",pct:"",volume:"",prixVente:"",coutTrans:""},
        {essence:"SAPINS", pct:"",volume:"",prixVente:"",coutTrans:""},
        {essence:"PINS",   pct:"",volume:"",prixVente:"",coutTrans:""},
        {essence:"MELEZES",pct:"",volume:"",prixVente:"",coutTrans:""}
      ],
      bpv:   {pct:"",volume:"",prixVente:"",coutTrans:""},
      bpg:   {pct:"",volume:"",prixVente:"",coutTrans:""},
      tritus:{pct:"",volume:"",prixVente:"",coutTrans:""},
      poteaux:{pct:"",volume:"",prixVente:"",coutTrans:""},
      coutDivers:"0", commentaires:""
    };
  }

  function calcFiche(f) {
    var res={bc:[], bcVol:0, bcCA:0, bcCATrans:0, bcCoutMarge:0, others:{}};
    f.bc.forEach(function(row,i){
      var vol=parseFr(row.volume), prix=parseFr(row.prixVente), ct=parseFr(row.coutTrans);
      var ca=vol*prix, caT=vol*ct, cM=ca*0.15;
      res.bc.push({ca,caTrans:caT,coutMarge:cM});
      res.bcVol+=vol; res.bcCA+=ca; res.bcCATrans+=caT; res.bcCoutMarge+=cM;
    });
    ["bpv","bpg","tritus","poteaux"].forEach(function(k){
      var row=f[k], vol=parseFr(row.volume), prix=parseFr(row.prixVente), ct=parseFr(row.coutTrans);
      var ca=vol*prix, caT=vol*ct;
      res.others[k]={ca,caTrans:caT,coutMarge:ca*0.15};
    });
    res.caLot   = res.bcCA + res.others.bpv.ca + res.others.bpg.ca + res.others.tritus.ca + res.others.poteaux.ca;
    res.coutTransTotal = res.bcCATrans + res.others.bpv.caTrans + res.others.bpg.caTrans + res.others.tritus.caTrans + res.others.poteaux.caTrans;
    res.margeEFC= res.caLot*0.15;
    res.coutExpl= parseFr(f.montantExpl);
    res.prixBase= res.caLot - res.coutExpl - res.coutTransTotal;
    var volEFC  = parseFr(f.volumeEFC)||1;
    res.priceTable = MARGES.map(function(m,i){
      var p=res.prixBase - res.caLot*m;
      return {prix:Math.round(p), perStere:(p/volEFC).toFixed(2), label:MARGE_LABELS[i], margeVal:Math.round(res.caLot*m)};
    });
    return res;
  }


  window.closeFicheModal=function() {
    var overlay=document.getElementById("fiche-modal-overlay");
    var modal  =document.getElementById("fiche-modal");
    if (overlay) overlay.style.display="none";
    if (modal)   modal.style.display="none";
  }



// ============================================================
// FICHE EFC - ESTIMATION FORESTIERE COMPLETE
// Basée sur TABLEUR_ESTIM_EFC_type_BD
// ============================================================

window.openFicheModalEFC=function(parcelle, retour, modeRetour) {
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
    ].join('\n');
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
api("POST","/api/retours",{parcelleId:parcelle.id, ficheEFC:ficheEFC}).then(function(d){
  var idx=state.retours.findIndex(function(rx){return rx.parcelleId===parcelle.id;});
  if(idx!==-1) state.retours[idx]=d.retour; else state.retours.push(d.retour);
  var btn=document.querySelector('.btn-save-retour[data-pid="'+parcelle.id+'"]');
  if(btn) btn.click();
});
    closeFicheModal();
  });

  var cancelBtn = document.getElementById('efc-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeFicheModal);
}

window.closeFicheModal=function() {
  var overlay = document.getElementById('fiche-modal-overlay');
  var modal   = document.getElementById('fiche-modal');
  if (overlay) overlay.style.display = 'none';
  if (modal)   modal.style.display   = 'none';
}

  init();
})();