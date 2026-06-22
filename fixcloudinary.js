var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  '{ resource_type: "raw", public_id: id, folder: "foresterra", format: "pdf", access_mode: "public", type: "upload" }',
  '{ resource_type: "image", public_id: id, folder: "foresterra", format: "pdf" }'
);
fs.writeFileSync('server.js',s);
console.log('ok');
