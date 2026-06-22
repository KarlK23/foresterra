var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace(
  `var filtreAch=document.getElementById("filtre-acheteur");
    if(filtreAch) filtreAch.addEventListener("change",function(){ state.filtreAcheteur=this.value||null; renderPatronContent(); });
    var filtrePdf=document.getElementById("filtre-pdf");
    if(filtrePdf) filtrePdf.addEventListener("change",function(){ state.filtrePdf=this.value||null; renderPatronContent(); });
    var btnReset=document.getElementById("btn-reset-filtres");
    if(btnReset) btnReset.addEventListener("click",function(){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); });`,
  ``
);
s=s.replace(
  `document.getElementById("patron-content").addEventListener("click", function(e){`,
  `document.getElementById("patron-content").addEventListener("change", function(e){
      if(e.target && e.target.id==="filtre-acheteur"){ state.filtreAcheteur=e.target.value||null; renderPatronContent(); }
      if(e.target && e.target.id==="filtre-pdf"){ state.filtrePdf=e.target.value||null; renderPatronContent(); }
    });
    document.getElementById("patron-content").addEventListener("click", function(e){
      if(e.target && e.target.id==="btn-reset-filtres"){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); }`
);
s=s.replace(
  `if(e.target && e.target.id==="btn-upload-pdf"){`,
  `}
      if(e.target && e.target.id==="btn-upload-pdf"){`
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
