var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.split('  var _fichePfunction(e){ alert("Erreur sauvegarde: "+e.message); });\n  }\n').join('');
fs.writeFileSync('public/app.js',s);
console.log('ok - taille:'+fs.readFileSync('public/app.js').length);