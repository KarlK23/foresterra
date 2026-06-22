var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace(
  'var btnUp=document.getElementById("btn-upload-pdf");if(btnUp._bound)return;btnUp._bound=true;btnUp.addEventListener("click", function(){',
  'var btnUp=document.getElementById("btn-upload-pdf");btnUp.replaceWith(btnUp.cloneNode(true));btnUp=document.getElementById("btn-upload-pdf");btnUp.addEventListener("click", function(){'
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
