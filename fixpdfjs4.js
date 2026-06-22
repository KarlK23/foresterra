var fs=require('fs');
var s=fs.readFileSync('public/app.js','utf8');
var old="    bindPdfAcheteurBtns();\n    analyzePdfDates('/api/proxy-pdf?url='+encodeURIComponent(filename),";
var idx=s.indexOf(old);
console.log('found:',idx);
if(idx!==-1){
  var proxyCode=`    var proxyUrl='/api/proxy-pdf?url='+encodeURIComponent(filename);
    if(typeof pdfjsLib!=='undefined'){
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfjsLib.getDocument(proxyUrl).promise.then(function(doc){
        var viewer=document.getElementById('patron-pdf-viewer');
        if(!viewer)return;
        viewer.innerHTML='';
        for(var i=1;i<=doc.numPages;i++){(function(n){
          var c=document.createElement('canvas');
          c.style.cssText='display:block;width:100%;margin-bottom:8px;background:#fff;';
          viewer.appendChild(c);
          doc.getPage(n).then(function(p){
            var vp=p.getViewport({scale:1});
            var sc=(viewer.offsetWidth-20)/vp.width;
            var sv=p.getViewport({scale:sc});
            c.width=sv.width;c.height=sv.height;
            p.render({canvasContext:c.getContext('2d'),viewport:sv});
          });
        })(i);}
      }).catch(function(){
        var v=document.getElementById('patron-pdf-viewer');
        if(v)v.innerHTML='<p style="color:#f88;text-align:center;padding:40px;">Impossible de charger le PDF.</p>';
      });
    }
    bindPdfAcheteurBtns();
    analyzePdfDates(proxyUrl,`;
  s=s.slice(0,idx)+proxyCode+s.slice(idx+old.length);
  fs.writeFileSync('public/app.js',s);
  console.log('ok');
}
