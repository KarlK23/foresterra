var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  'function(error, result) {\n        if (error) return res.status(500).json({ error: "Cloudinary: " + error.message });\n        const db = await loadDb();',
  'async function(error, result) {\n        if (error) return res.status(500).json({ error: "Cloudinary: " + error.message });\n        const db = await loadDb();'
);
fs.writeFileSync('server.js',s);
console.log('ok');
