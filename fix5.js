var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.split('function openFicheModalEFC(').join('window.openFicheModalEFC=function(');
s=s.split('function closeFicheModal(').join('window.closeFicheModal=function(');
fs.writeFileSync('public/app.js',s);
console.log('ok - taille:'+fs.readFileSync('public/app.js').length);