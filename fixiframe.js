var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace(
  "'<iframe src=\"'+filename+'\" style=\"width:100%;height:100%;border:none;display:block;\"></iframe></div>'+",
  "'<iframe src=\"'+filename+'\" style=\"width:100%;height:100%;border:none;display:block;\" crossorigin=\"anonymous\"></iframe></div>'+"
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
