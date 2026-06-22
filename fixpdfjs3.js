var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
s=s.replace(
  "bindPdfAcheteurBtns();\n    analyzePdfDates(\"/api/proxy-pdf?url=\"+encodeURIComponent(filename),",
  `// Charger le PDF dans le viewer patron avec PDF.js
    var proxyUrl='/api/proxy-pdf?url='+encodeURIComponent(filename);
    if(typeof pdfjsLib!=='undefined'){
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfjsLib.getDocument(proxyUrl).promise.then(function(doc){
        var viewer=document.getElementById('patron-pdf-viewer');
        if(!viewer)return;
        viewer.innerHTML='';
        for(var i=1;i<=doc.numPages;i++){
          (function(n){
            var canvas=document.createElement('canvas');
            canvas.style.cssText='display:block;width:100%;margin-bottom:8px;background:#fff;';
            viewer.appendChild(canvas);
            doc.getPage(n).then(function(page){
              var vp=page.getViewport({scale:1});
              var scale=(viewer.offsetWidth-20)/vp.width;
              var sv=page.getViewport({scale:scale});
              canvas.width=sv.width;canvas.height=sv.height;
              page.render({canvasContext:canvas.getContext('2d'),viewport:sv});
            });
          })(i);
        }
      }).catch(function(){
        var v=document.getElementById('patron-pdf-viewer');
        if(v)v.innerHTML='<p style="color:#f88;text-align:center;padding:40px;">Impossible de charger le PDF.</p>';
      });
    }
    bindPdfAcheteurBtns();
    analyzePdfDates(proxyUrl,`
);
fs.writeFileSync('public/app.js',s);
console.log('ok');
