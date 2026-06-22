var fs=require('fs');
var s=fs.readFileSync('public/style.css','utf8');
s=s+'\n#fiche-modal{position:fixed!important;top:40px!important;left:40px!important;right:40px!important;bottom:40px!important;z-index:9999!important;overflow:auto!important;background:white!important;}\n#fiche-modal-overlay{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;z-index:9998!important;background:rgba(0,0,0,0.5)!important;}\n';
fs.writeFileSync('public/style.css',s);
console.log('ok');