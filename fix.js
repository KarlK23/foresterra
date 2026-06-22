var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace("var url = '/uploads/'+pdf.filename;","var url = pdf.filename;");
s=s.replace("src=\"/uploads/'+filename+'\"","src=\"'+filename+'\"");
s=s.replace("analyzePdfDates(\"/uploads/\"+filename,","analyzePdfDates(filename,");
s=s.replace("var url='/uploads/'+filename;","var url=filename;");
fs.writeFileSync('public/app.js',s);
console.log('ok');
