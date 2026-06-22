var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  'const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });',
  'const upload = multer({ storage: multer.diskStorage({destination:function(req,file,cb){cb(null,UPLOADS_DIR);},filename:function(req,file,cb){cb(null,genId("tmp")+".pdf");}}), limits: { fileSize: 200 * 1024 * 1024 } });'
);
s=s.replace(
  'Readable.from(req.file.buffer).pipe(stream);',
  'fs.createReadStream(req.file.path).pipe(stream); stream.on("finish",function(){fs.unlink(req.file.path,function(){});});'
);
fs.writeFileSync('server.js',s);
console.log('ok');
