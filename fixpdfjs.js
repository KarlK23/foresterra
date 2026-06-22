var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
// Remplacer l'iframe par un canvas PDF.js
s=s.replace(
  `'<div style="flex:1;overflow:hidden;border-right:1px solid #e0ddd5;">'+
        '<iframe src="'+filename+'" style="width:100%;height:100%;border:none;display:block;" crossorigin="anonymous"></iframe></div>'+`,
  `'<div style="flex:1;overflow:hidden;border-right:1px solid #e0ddd5;background:#404040;overflow-y:auto;" id="patron-pdf-viewer">'+
        '<p style="color:#ccc;text-align:center;padding:40px;font-size:13px;">Chargement...</p></div>'+`
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
