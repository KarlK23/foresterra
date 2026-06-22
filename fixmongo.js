var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
// Rendre toutes les routes async
s=s.replace(/app\.(get|post|delete)\(("\/api\/[^"]+"), ?(requireAuth|requirePatron)?, ?function \(req, res\) \{/g, function(match, method, path, mid) {
  if(mid) return 'app.'+method+'('+path+', '+mid+', async function (req, res) {';
  return 'app.'+method+'('+path+', async function (req, res) {';
});
// Remplacer loadDb() par await loadDb()
s=s.replace(/const db = loadDb\(\)/g, 'const db = await loadDb()');
// Remplacer saveDb(db) par await saveDb(db)
s=s.replace(/saveDb\(db\)/g, 'await saveDb(db)');
fs.writeFileSync('server.js',s);
console.log('ok');
