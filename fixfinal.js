var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  /const upload = multer\(\{ storage: multer\.diskStorage\(\{.*?\}\), limits: \{ fileSize: 200 \* 1024 \* 1024 \} \}\);/,
  'const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });'
);
s=s.replace(
  'fs.createReadStream(req.file.path).pipe(stream); stream.on("finish",function(){fs.unlink(req.file.path,function(){});});',
  'require("stream").Readable.from(req.file.buffer).pipe(stream);'
);
fs.writeFileSync('server.js',s);
console.log('ok');
