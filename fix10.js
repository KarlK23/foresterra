var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
var idx=s.indexOf('var btnUp=document.getElementById("btn-upload-pdf");btnUp.repl');
console.log('found at:',idx);
if(idx!==-1){
  var start=s.indexOf('var btnUp=document.getElementById("btn-upload-pdf")');
  var end=s.indexOf('function(){', start)+('function(){').length;
  s=s.slice(0,start)+'document.getElementById("btn-upload-pdf").addEventListener("click", function(){'+s.slice(end);
  fs.writeFileSync('public/app.js',s);
  console.log('ok');
} else { console.log('not found'); }
