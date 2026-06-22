var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
// Déplacer le listener change sur #app dans renderPatronApp
s=s.replace(
  `document.getElementById("patron-content").addEventListener("change", function(e){
      if(e.target && e.target.id==="filtre-acheteur"){ state.filtreAcheteur=e.target.value||null; renderPatronContent(); }
      if(e.target && e.target.id==="filtre-pdf"){ state.filtrePdf=e.target.value||null; renderPatronContent(); }
    });
    document.getElementById("patron-content").addEventListener("click", function(e){
      if(e.target && e.target.id==="btn-reset-filtres"){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); }`,
  `document.getElementById("patron-content").addEventListener("click", function(e){
      if(e.target && e.target.id==="btn-reset-filtres"){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); }`
);
// Ajouter le listener change sur root dans renderPatronApp
s=s.replace(
  `document.getElementById("btn-logout").addEventListener("click", logout);
    document.getElementById("patron-content").addEventListener("click", function(e){`,
  `document.getElementById("btn-logout").addEventListener("click", logout);
    root.addEventListener("change", function(e){
      if(e.target && e.target.id==="filtre-acheteur"){ state.filtreAcheteur=e.target.value||null; renderPatronContent(); }
      if(e.target && e.target.id==="filtre-pdf"){ state.filtrePdf=e.target.value||null; renderPatronContent(); }
    });
    document.getElementById("patron-content").addEventListener("click", function(e){`
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
