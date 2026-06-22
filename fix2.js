var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  '{ resource_type: "raw", public_id: id, folder: "foresterra", format: "pdf" }',
  '{ resource_type: "raw", public_id: id, folder: "foresterra", format: "pdf", access_mode: "public", type: "upload" }'
);
fs.writeFileSync('server.js',s);
console.log('ok');
