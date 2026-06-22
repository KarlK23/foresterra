var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
var idx=s.indexOf("'<iframe src=\"'+filename+'\"");
console.log('iframe at index:',idx);
if(idx!==-1){
  var start=s.lastIndexOf("'<div style=\"flex:1;", idx);
  var end=s.indexOf("</div>'+", idx)+("</div>'+").length;
  var replacement="'<div style=\"flex:1;overflow-y:auto;background:#404040;padding:10px;\" id=\"patron-pdf-viewer\"><p style=\"color:#ccc;text-align:center;padding:40px;\">Chargement...</p></div>'+";
  s=s.slice(0,start)+replacement+s.slice(end);
  fs.writeFileSync('public/app.js',s);
  console.log('ok');
} else { console.log('not found'); }
