var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  'const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });',
  'const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });'
);
fs.writeFileSync('server.js',s);
console.log('ok');
