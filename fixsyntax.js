var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace(
  'if(e.target && e.target.id==="btn-reset-filtres"){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); }\n      }\n      if(e.target && e.target.id==="btn-upload-pdf"){',
  'if(e.target && e.target.id==="btn-reset-filtres"){ state.filtreAcheteur=null; state.filtrePdf=null; renderPatronContent(); }\n      if(e.target && e.target.id==="btn-upload-pdf"){'
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
