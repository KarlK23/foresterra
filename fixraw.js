var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s=s.replace(
  '{ resource_type: "image", public_id: id, folder: "foresterra", format: "pdf" }',
  '{ resource_type: "raw", public_id: id, folder: "foresterra", use_filename: true, unique_filename: false }'
);
fs.writeFileSync('server.js',s);
console.log('ok');
