var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
var lines=s.split('\n');
lines[1368]=lines[1368].split("d'achat").join("d\\'achat");
fs.writeFileSync('public/app.js',lines.join('\n'));
console.log('ok - taille:'+fs.readFileSync('public/app.js').length);