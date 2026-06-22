var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
// Fixer toutes les fonctions qui ont await mais ne sont pas async
s=s.replace(/app\.(get|post|delete)\("([^"]+)", (requireAuth|requirePatron), function \(req, res\)/g, 
  'app.$1("$2", $3, async function (req, res)');
s=s.replace(/app\.(get|post|delete)\("([^"]+)", function \(req, res\)/g, 
  'app.$1("$2", async function (req, res)');
fs.writeFileSync('server.js',s);
console.log('ok - routes fixed');
