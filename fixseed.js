var fs=require('fs');
var s=fs.readFileSync('seed.js','utf8');
s=s.replace(
  'seed().catch(console.error);',
  'seed().catch(console.error).finally(()=>process.exit(0));'
);
fs.writeFileSync('seed.js',s);
console.log('ok');
