var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  'filename:function(req,file,cb){cb(null,genId("tmp")+".pdf");}',
  'filename:function(req,file,cb){cb(null,"tmp_"+Math.random().toString(36).slice(2,9)+".pdf");}'
);
fs.writeFileSync('server.js',s);
console.log('ok');
