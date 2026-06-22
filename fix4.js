var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
var proxy=`
// ---------- PROXY PDF CLOUDINARY ----------
app.get("/api/proxy-pdf", requireAuth, function(req, res) {
  var url = req.query.url;
  if (!url || !url.startsWith("https://res.cloudinary.com/")) {
    return res.status(400).json({ error: "URL invalide" });
  }
  var https = require("https");
  https.get(url, function(r) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Access-Control-Allow-Origin", "*");
    r.pipe(res);
  }).on("error", function(e) {
    res.status(500).json({ error: e.message });
  });
});
`;
s=s.replace('// ---------- FALLBACK ----------', proxy+'// ---------- FALLBACK ----------');
fs.writeFileSync('server.js',s);
console.log('ok');
