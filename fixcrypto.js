var fs=require('fs');
var s=fs.readFileSync('server.js','utf8');
s='const crypto = require("crypto");\n'+s;
fs.writeFileSync('server.js',s);
console.log('ok');
