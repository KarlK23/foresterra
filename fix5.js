var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace(
  "var url = pdf.filename;",
  "var url = '/api/proxy-pdf?url='+encodeURIComponent(pdf.filename);"
);
s=s.replace(
  "var url=filename;",
  "var url='/api/proxy-pdf?url='+encodeURIComponent(filename);"
);
s=s.replace(
  "analyzePdfDates(filename,",
  "analyzePdfDates('/api/proxy-pdf?url='+encodeURIComponent(filename),"
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
