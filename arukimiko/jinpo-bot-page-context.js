/*
 * 歩き巫女 ページ文脈 v1.1.0
 * TOP/各ツールページで「ここ何？」「これどう使う？」の意味解釈を補助する。
 * 陣法操作そのものは扱わない。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_PAGE_CONTEXT)return;
  var VERSION='1.1.0';
  function S(v){var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();}
  function path(){var p='';try{p=decodeURIComponent(location.pathname||'');}catch(e){p=String(location.pathname||'');}return p;}
  function mode(){
    if(window.JINPO_BOT_PAGE_MODE)return String(window.JINPO_BOT_PAGE_MODE);
    var p=path();
    if(p==='/'||/\/index\.html$/i.test(p))return 'top';
    if(/\/陣法\/jinpo\.html$/i.test(p))return 'jinpo';
    return 'site';
  }
  function title(){
    var t=S(document&&document.title||'');
    return t.replace(/\s*[|｜].*$/,'')||'たいらの野望';
  }
  function visibleLabels(){
    var out=[];
    try{
      var nodes=document.querySelectorAll('img[alt],button[aria-label],a[aria-label]');
      for(var i=0;i<nodes.length&&out.length<40;i++){
        var n=nodes[i],v=S(n.getAttribute('alt')||n.getAttribute('aria-label')||'');
        if(v&&out.indexOf(v)<0)out.push(v);
      }
    }catch(e){}
    return out;
  }
  function snapshot(){return {version:VERSION,mode:mode(),path:path(),title:title(),labels:visibleLabels()};}
  function isTop(){return mode()==='top';}
  window.JINPO_BOT_PAGE_CONTEXT={version:VERSION,snapshot:snapshot,mode:mode,isTop:isTop};
})();
