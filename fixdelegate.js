var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
// Supprimer le listener direct dans bindPatronEvents
s=s.replace(
  `document.getElementById("btn-upload-pdf").addEventListener("click", function(){
      var input = document.getElementById("pdf-file-input");
      if (!input.files||!input.files[0]) { alert("Choisis un fichier PDF."); return; }
      var fd = new FormData(); fd.append("pdf", input.files[0]);
      fetch("/api/pdfs",{method:"POST",body:fd,credentials:"same-origin"}).then(function(r){return r.json();}).then(function(d){
        if (d.error) throw new Error(d.error);
        state.pdfs.push(d.pdf); renderPatronContent();
      }).catch(function(e){ alert("Erreur upload: "+e.message); });
    });`,
  ''
);
// Ajouter le listener délégué dans renderPatronApp une seule fois
s=s.replace(
  'document.getElementById("btn-logout").addEventListener("click", logout);\n    renderPatronContent();',
  `document.getElementById("btn-logout").addEventListener("click", logout);
    document.getElementById("patron-content").addEventListener("click", function(e){
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
    renderPatronContent();`
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
