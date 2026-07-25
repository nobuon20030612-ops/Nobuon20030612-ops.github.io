(function(){
  'use strict';
  var MANIFEST_PATH='data/compact_search_v2/jinpo_unified_search_manifest.json';
  var manifest=null,manifestPromise=null;
  var buffers=new Map(),lruSeq=0,MAX_RAW_CACHE=96*1024*1024;
  var STAT_OFFSETS={'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41};
  var FORM_CODE={'衡軛':'kouyaku','鶴翼':'kakuyoku','魚鱗':'gyorin','方円':'hoen'};
  function norm(v){return String(v==null?'':v).trim().replace(/山中鹿之助/g,'山中鹿之介').replace(/・/g,'').replace(/[\s　]+/g,'');}
  async function loadManifest(){
    if(manifest)return manifest;if(manifestPromise)return manifestPromise;
    manifestPromise=fetch(MANIFEST_PATH,{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error(MANIFEST_PATH+' HTTP '+r.status);return r.json();}).then(function(m){
      manifest=m;manifest._heroNameToId=Object.create(null);(m.hero_names||[]).forEach(function(n,i){if(n)manifest._heroNameToId[norm(n)]=i;});return manifest;
    });return manifestPromise;
  }
  async function cachedFetch(url,version){
    var u=new URL(url,self.location.href);u.searchParams.set('v',version||'1');
    if(typeof caches!=='undefined'){
      try{
        var cname='jinpo-unified-compact-'+String(version||'1').replace(/[^a-zA-Z0-9_.-]/g,'_');
        var cache=await caches.open(cname),hit=await cache.match(u.href);if(hit)return await hit.arrayBuffer();
        var res=await fetch(u.href,{cache:'force-cache'});if(!res.ok)throw new Error(url+' HTTP '+res.status);
        try{await cache.put(u.href,res.clone());}catch(e){}return await res.arrayBuffer();
      }catch(e){}
    }
    var r=await fetch(u.href,{cache:'force-cache'});if(!r.ok)throw new Error(url+' HTTP '+r.status);return r.arrayBuffer();
  }
  async function gunzip(ab){
    var head=new Uint8Array(ab,0,Math.min(2,ab.byteLength));if(head.length<2||head[0]!==0x1f||head[1]!==0x8b)return ab;
    if(typeof DecompressionStream==='undefined')throw new Error('DecompressionStream(gzip)未対応');
    return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  function datasetInfo(m,q){
    var c=String(Number(q.count)||0),f=String(q.formation||''),mode=q.mode==='grade3'?'grade3':'normal';
    if(q.sourceType==='sort'&&mode==='normal')return m.sort_top&&m.sort_top.normal&&m.sort_top.normal[c]&&m.sort_top.normal[c][f]&&m.sort_top.normal[c][f][q.sortStat];
    if(q.sourceType==='top')return m.top&&m.top[mode]&&m.top[mode][c]&&m.top[mode][c][f];
    return m.datasets&&m.datasets[mode]&&m.datasets[mode][c]&&m.datasets[mode][c][f];
  }
  function fullDatasetInfo(m,q){var c=String(Number(q.count)||0),f=String(q.formation||''),mode=q.mode==='grade3'?'grade3':'normal';return m.datasets&&m.datasets[mode]&&m.datasets[mode][c]&&m.datasets[mode][c][f];}
  function cacheKey(q,info){return [q.mode||'normal',q.sourceType||'full',q.count,q.formation,q.sortStat||'',info&&info.file||''].join('|');}
  function evictIfNeeded(keep){
    var total=0;buffers.forEach(function(v){total+=v.rawBytes||0;});if(total<=MAX_RAW_CACHE)return;
    var arr=[];buffers.forEach(function(v,k){if(k!==keep)arr.push([k,v.last||0,v.rawBytes||0]);});arr.sort(function(a,b){return a[1]-b[1];});
    for(var i=0;i<arr.length&&total>MAX_RAW_CACHE;i++){var v=buffers.get(arr[i][0]);if(v){total-=v.rawBytes||0;buffers.delete(arr[i][0]);}}
  }
  async function loadData(q,token){
    var m=await loadManifest(),info=datasetInfo(m,q);if(!info)throw new Error('統一検索DBなし: '+[q.mode,q.count,q.formation,q.sourceType,q.sortStat].join('/'));
    var key=cacheKey(q,info),hit=buffers.get(key);if(hit){hit.last=++lruSeq;return hit;}
    self.postMessage({type:'progress',token:token,phase:'download',message:'検索DB '+q.formation+' '+q.count+'因縁 読込中',bytes:info.gzip_bytes||0});
    var zipped=await cachedFetch(info.file,m.version);self.postMessage({type:'progress',token:token,phase:'decompress',message:'検索DB 展開中',bytes:zipped.byteLength});
    var ab=await gunzip(zipped),dv=new DataView(ab);
    if(ab.byteLength<16||String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='JCF1')throw new Error('compact DB magic不一致');
    var recSize=dv.getUint16(6,true);if(recSize!==Number(m.record_size||52))throw new Error('compact DB record size不一致');
    var rows=Math.floor((ab.byteLength-16)/recSize);if(rows!==Number(info.rows||0))throw new Error('compact DB件数不一致 '+rows+' != '+info.rows);
    var obj={ab:ab,dv:dv,rows:rows,recSize:recSize,info:info,rawBytes:ab.byteLength,last:++lruSeq};buffers.set(key,obj);evictIfNeeded(key);return obj;
  }
  function idsFromNames(names,m){var out=[];(Array.isArray(names)?names:[]).forEach(function(n){var id=m._heroNameToId[norm(n)];out.push(id==null?-1:Number(id));});return out;}
  function hasHero(dv,base,id){for(var i=0;i<6;i++)if(dv.getUint16(base+i*2,true)===id)return true;return false;}
  function statAt(dv,base,stat){var o=STAT_OFFSETS[stat];return o==null?0:dv.getUint16(base+o,true);}
  function totalAt(dv,base){return dv.getUint32(base+43,true);}function tieAt(dv,base){return dv.getUint32(base+48,true);}
  function better(dv,a,b,rules){for(var i=0;i<rules.length;i++){var k=rules[i]&&rules[i].stat;if(!k)continue;var av=statAt(dv,a,k),bv=statAt(dv,b,k);if(av!==bv)return av>bv;}var at=totalAt(dv,a),bt=totalAt(dv,b);if(at!==bt)return at>bt;return tieAt(dv,a)<tieAt(dv,b);}
  function worse(dv,a,b,rules){return better(dv,b,a,rules);}
  function heapPush(heap,off,dv,rules){heap.push(off);var i=heap.length-1;while(i>0){var p=(i-1)>>1;if(!worse(dv,heap[i],heap[p],rules))break;var t=heap[i];heap[i]=heap[p];heap[p]=t;i=p;}}
  function heapDown(heap,i,dv,rules){for(;;){var l=i*2+1,r=l+1,w=i;if(l<heap.length&&worse(dv,heap[l],heap[w],rules))w=l;if(r<heap.length&&worse(dv,heap[r],heap[w],rules))w=r;if(w===i)return;var t=heap[i];heap[i]=heap[w];heap[w]=t;i=w;}}
  function materialize(dv,base,q,m,rowIndex,source){
    var names=[];for(var i=0;i<6;i++){var id=dv.getUint16(base+i*2,true);names.push((m.hero_names||[])[id]||('英傑#'+id));}
    var count=Number(q.count)||0,bonds=[];for(var b=0;b<count;b++){var bi=dv.getUint8(base+12+b);if(bi)bonds.push((m.bond_names||[])[bi]||String(bi));}
    var rid='compact_v2_'+(q.mode==='grade3'?'g3':'n')+'_'+count+'_'+(FORM_CODE[q.formation]||'f')+'_'+tieAt(dv,base).toString(16)+'_'+rowIndex;
    var row={result_id:rid,record_type:'COMPACT_SEARCH_V2',source_file:source,formation:String(q.formation||''),grade3_flag:q.mode==='grade3'?'等級3以下ON':'通常',bond_count:count,eiketsu_ids:names.join('|'),eiketsu_names:names.join('|'),eiketsu_internal_ids:'',bond_ids:bonds.join('|'),bond_names:bonds.join('|'),stat_status:'ステータス計算済み',calc_source:'COMPACT_SEARCH_V2'};
    Object.keys(STAT_OFFSETS).forEach(function(k){row[k]=statAt(dv,base,k);});row['総合値']=totalAt(dv,base);row.total_score=row['総合値'];row.factor4_usage_count=dv.getUint8(base+47);return row;
  }
  function materializeFirst(data,q,m,limit){var rows=[],base=16;for(var i=0;i<data.rows&&i<limit;i++,base+=data.recSize)rows.push(materialize(data.dv,base,q,m,i,data.info.file));return rows;}

  async function search(q,token){
    var started=performance.now(),m=await loadManifest(),data=await loadData(q,token),dv=data.dv,rec=data.recSize;
    var owned=idsFromNames(q.ownedNames,m),excluded=idsFromNames(q.excludedNames,m);if(owned.some(function(x){return x<0;}))return {rows:[],scanned:data.rows,matched:0,ms:performance.now()-started,info:data.info};excluded=excluded.filter(function(x){return x>=0;});
    var rawRules=Array.isArray(q.rules)?q.rules:[],rules=[],thresholds=[];rawRules.forEach(function(r){if(!r||!r.stat)return;rules.push({stat:String(r.stat)});var n=Number(r.threshold);if(r.threshold!==null&&r.threshold!==''&&Number.isFinite(n))thresholds.push({stat:String(r.stat),v:n});});
    var f4max=(q.factor4Max===null||q.factor4Max===undefined||q.factor4Max==='')?null:Number(q.factor4Max),limit=Math.max(1,Number(q.limit||500)||500),heap=[],matched=0,base=16;
    var fullInfo=fullDatasetInfo(m,q),noFilters=owned.length===0&&excluded.length===0&&thresholds.length===0&&f4max===null;

    /* Phase1互換: 既存の小型Top300/優先Top300を先に即表示し、301〜500件目は全件compact DBからバックグラウンド拡張する。
       Top DBと全件DBの件数が矛盾する旧シード系データは、正しいHIT件数を優先して全件DBへ切り替える。 */
    if(q.sourceType!=='full'&&fullInfo&&noFilters){
      var fullRows=Number(fullInfo.rows||0);
      if(fullRows<data.rows){
        /* 既存Topに検索シードが含まれるケースは、現行表示件数を変えない。 */
        var seeded=materializeFirst(data,q,m,Math.min(limit,data.rows));return {rows:seeded,scanned:data.rows,matched:data.rows,ms:performance.now()-started,info:data.info,sourceType:q.sourceType};
      }else if(fullRows<=limit&&data.rows!==fullRows){
        var fqSmall=Object.assign({},q,{sourceType:'full',sortStat:''});
        data=await loadData(fqSmall,token);dv=data.dv;rec=data.recSize;base=16;
      }else if(data.rows<limit&&fullRows>data.rows){
        var partialRows=materializeFirst(data,q,m,Math.min(limit,data.rows));
        self.postMessage({type:'partial',token:token,result:{rows:partialRows,scanned:fullRows,matched:fullRows,ms:performance.now()-started,info:data.info,sourceType:q.sourceType,partial:true}});
        var fq=Object.assign({},q,{sourceType:'full',sortStat:''});
        data=await loadData(fq,token);dv=data.dv;rec=data.recSize;base=16;
      }else if(q.sourceType==='top'&&rules.length===0){
        var direct=materializeFirst(data,q,m,Math.min(limit,fullRows||data.rows));return {rows:direct,scanned:fullRows||data.rows,matched:fullRows||data.rows,ms:performance.now()-started,info:data.info,sourceType:'top'};
      }
    }else if(q.sourceType==='top'&&noFilters&&rules.length===0){
      var directFallback=materializeFirst(data,q,m,limit);return {rows:directFallback,scanned:data.rows,matched:data.rows,ms:performance.now()-started,info:data.info,sourceType:'top'};
    }

    for(var idx=0;idx<data.rows;idx++,base+=rec){
      var ok=true;for(var oi=0;oi<owned.length&&ok;oi++)if(!hasHero(dv,base,owned[oi]))ok=false;for(var ei=0;ei<excluded.length&&ok;ei++)if(hasHero(dv,base,excluded[ei]))ok=false;
      if(ok&&f4max!==null){var f4=dv.getUint8(base+47);if(f4===255||f4>f4max)ok=false;}for(var ti=0;ti<thresholds.length&&ok;ti++)if(statAt(dv,base,thresholds[ti].stat)<thresholds[ti].v)ok=false;if(!ok)continue;matched++;
      if(heap.length<limit)heapPush(heap,base,dv,rules);else if(better(dv,base,heap[0],rules)){heap[0]=base;heapDown(heap,0,dv,rules);}
    }
    heap.sort(function(a,b){return better(dv,a,b,rules)?-1:(better(dv,b,a,rules)?1:0);});
    var rows=heap.map(function(off){return materialize(dv,off,q,m,Math.floor((off-16)/rec),data.info.file);});
    return {rows:rows,scanned:data.rows,matched:matched,ms:performance.now()-started,info:data.info,sourceType:q.sourceType||'full'};
  }
  self.onmessage=function(ev){var d=ev.data||{};if(d.type==='clear'){buffers.clear();return;}if(d.type!=='search')return;var token=d.token;search(d.query||{},token).then(function(r){self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});};
})();
