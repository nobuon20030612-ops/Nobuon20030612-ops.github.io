(function(){
  'use strict';
  var MANIFEST_PATH='data/compact_search_v2/jinpo_unified_search_manifest.json';
  var manifest=null,manifestPromise=null;
  var buffers=new Map(),lruSeq=0,MAX_RAW_CACHE=96*1024*1024;
  var STAT_OFFSETS={'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41};
  var FORM_CODE={'衡軛':'kouyaku','鶴翼':'kakuyoku','魚鱗':'gyorin','方円':'hoen'};
  function norm(v){return String(v==null?'':v).trim().replace(/山中鹿之助/g,'山中鹿之介').replace(/・/g,'').replace(/[\s　]+/g,'');}
  function eikInternalId(id){id=Number(id);return Number.isInteger(id)&&id>0?'EIK_'+String(id).padStart(4,'0'):'';}
  function numericHeroId(v){
    if(typeof v==='number'&&Number.isInteger(v)&&v>0)return v;
    var s=String(v==null?'':v).trim(),m=s.match(/^EIK_(\d+)$/i);if(m)return Number(m[1]);
    if(/^\d+$/.test(s))return Number(s);return -1;
  }
  async function loadManifest(){
    if(manifest)return manifest;if(manifestPromise)return manifestPromise;
    manifestPromise=fetch(MANIFEST_PATH,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(MANIFEST_PATH+' HTTP '+r.status);return r.json();}).then(function(m){
      manifest=m;
      manifest._heroNameToIds=Object.create(null);
      (m.hero_names||[]).forEach(function(n,i){if(!n)return;var k=norm(n);if(!manifest._heroNameToIds[k])manifest._heroNameToIds[k]=[];manifest._heroNameToIds[k].push(i);});
      manifest._bondNameToId=Object.create(null);
      (m.bond_names||[]).forEach(function(n,i){if(n)manifest._bondNameToId[norm(n)]=i;});
      return manifest;
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
  function normalFiveSixUnsupported(q){var c=Number(q&&q.count)||0;return q&&q.mode!=='grade3'&&(c===5||c===6);}
  function evictIfNeeded(keep){
    var total=0;buffers.forEach(function(v){total+=v.rawBytes||0;});if(total<=MAX_RAW_CACHE)return;
    var arr=[];buffers.forEach(function(v,k){if(k!==keep)arr.push([k,v.last||0,v.rawBytes||0]);});arr.sort(function(a,b){return a[1]-b[1];});
    for(var i=0;i<arr.length&&total>MAX_RAW_CACHE;i++){var v=buffers.get(arr[i][0]);if(v){total-=v.rawBytes||0;buffers.delete(arr[i][0]);}}
  }
  async function loadData(q,token,silent){
    var m=await loadManifest(),info=datasetInfo(m,q);if(!info)throw new Error('統一検索DBなし: '+[q.mode,q.count,q.formation,q.sourceType,q.sortStat].join('/'));
    var key=cacheKey(q,info),hit=buffers.get(key);if(hit){hit.last=++lruSeq;return hit;}
    if(!silent)self.postMessage({type:'progress',token:token,phase:'download',message:'検索DB '+q.formation+' '+q.count+'因縁 読込中',bytes:info.gzip_bytes||0});
    var zipped=await cachedFetch(info.file,m.version);if(!silent)self.postMessage({type:'progress',token:token,phase:'decompress',message:'検索DB 展開中',bytes:zipped.byteLength});
    var ab=await gunzip(zipped),dv=new DataView(ab);
    if(ab.byteLength<16||String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='JCF1')throw new Error('compact DB magic不一致');
    var recSize=dv.getUint16(6,true);if(recSize!==Number(m.record_size||52))throw new Error('compact DB record size不一致');
    var rows=Math.floor((ab.byteLength-16)/recSize);if(rows!==Number(info.rows||0))throw new Error('compact DB件数不一致 '+rows+' != '+info.rows);
    var obj={ab:ab,dv:dv,rows:rows,recSize:recSize,info:info,rawBytes:ab.byteLength,last:++lruSeq};buffers.set(key,obj);evictIfNeeded(key);return obj;
  }
  function nameGroups(names,m){
    var out=[];(Array.isArray(names)?names:[]).forEach(function(n){var ids=(m._heroNameToIds[norm(n)]||[]).map(Number).filter(function(x){return x>0;});out.push(ids);});return out;
  }
  function exactIds(values){return (Array.isArray(values)?values:[]).map(numericHeroId).filter(function(x){return x>0;});}
  function ownedGroups(q,m){
    var exact=exactIds(q.ownedInternalIds);if(exact.length)return exact.map(function(id){return[id];});
    return nameGroups(q.ownedNames,m);
  }
  function excludedIds(q,m){
    var exact=exactIds(q.excludedInternalIds);if(exact.length)return exact;
    var seen=Object.create(null),out=[];nameGroups(q.excludedNames,m).forEach(function(g){g.forEach(function(id){if(!seen[id]){seen[id]=1;out.push(id);}});});return out;
  }
  function hasHero(dv,base,id){for(var i=0;i<6;i++)if(dv.getUint16(base+i*2,true)===id)return true;return false;}
  function hasAnyHero(dv,base,ids){for(var j=0;j<ids.length;j++)if(hasHero(dv,base,ids[j]))return true;return false;}
  function statAt(dv,base,stat){var o=STAT_OFFSETS[stat];return o==null?0:dv.getUint16(base+o,true);}
  function totalAt(dv,base){return dv.getUint32(base+43,true);}function tieAt(dv,base){return dv.getUint32(base+48,true);}
  function better(dv,a,b,rules){for(var i=0;i<rules.length;i++){var k=rules[i]&&rules[i].stat;if(!k)continue;var av=statAt(dv,a,k),bv=statAt(dv,b,k);if(av!==bv)return av>bv;}var at=totalAt(dv,a),bt=totalAt(dv,b);if(at!==bt)return at>bt;return tieAt(dv,a)<tieAt(dv,b);}
  function worse(dv,a,b,rules){return better(dv,b,a,rules);}
  function heapPush(heap,off,dv,rules){heap.push(off);var i=heap.length-1;while(i>0){var p=(i-1)>>1;if(!worse(dv,heap[i],heap[p],rules))break;var t=heap[i];heap[i]=heap[p];heap[p]=t;i=p;}}
  function heapDown(heap,i,dv,rules){for(;;){var l=i*2+1,r=l+1,w=i;if(l<heap.length&&worse(dv,heap[l],heap[w],rules))w=l;if(r<heap.length&&worse(dv,heap[r],heap[w],rules))w=r;if(w===i)return;var t=heap[i];heap[i]=heap[w];heap[w]=t;i=w;}}
  function materialize(dv,base,q,m,rowIndex,source){
    var names=[],numericIds=[],internalIds=[];
    for(var i=0;i<6;i++){var id=dv.getUint16(base+i*2,true);numericIds.push(id);internalIds.push(eikInternalId(id));names.push((m.hero_names||[])[id]||('英傑#'+id));}
    var count=Number(q.count)||0,bonds=[],bondNumeric=[];for(var b=0;b<count;b++){var bi=dv.getUint8(base+12+b);if(bi){bondNumeric.push(bi);bonds.push((m.bond_names||[])[bi]||String(bi));}}
    var rid='compact_v2_'+(q.mode==='grade3'?'g3':'n')+'_'+count+'_'+(FORM_CODE[q.formation]||'f')+'_'+tieAt(dv,base).toString(16)+'_'+rowIndex;
    var row={result_id:rid,record_type:'COMPACT_SEARCH_V2',source_file:source,formation:String(q.formation||''),grade3_flag:q.mode==='grade3'?'等級3以下ON':'通常',bond_count:count,eiketsu_ids:names.join('|'),eiketsu_names:names.join('|'),eiketsu_internal_ids:internalIds.join('|'),eiketsu_numeric_ids:numericIds.join('|'),bond_ids:bonds.join('|'),bond_names:bonds.join('|'),bond_numeric_ids:bondNumeric.join('|'),stat_status:'ステータス計算済み',calc_source:'COMPACT_SEARCH_V2'};
    Object.keys(STAT_OFFSETS).forEach(function(k){row[k]=statAt(dv,base,k);});row['総合値']=totalAt(dv,base);row.total_score=row['総合値'];row.factor4_usage_count=dv.getUint8(base+47);return row;
  }
  function materializeFirst(data,q,m,limit){var rows=[],base=16;for(var i=0;i<data.rows&&i<limit;i++,base+=data.recSize)rows.push(materialize(data.dv,base,q,m,i,data.info.file));return rows;}

  async function search(q,token){
    if(normalFiveSixUnsupported(q))throw new Error('通常5・6因縁は検索対象外です（等級3以下ON専用）');
    var started=performance.now(),m=await loadManifest(),data=await loadData(q,token,false),dv=data.dv,rec=data.recSize;
    var owned=ownedGroups(q,m),excluded=excludedIds(q,m);
    if(owned.some(function(g){return !g.length;}))return {rows:[],scanned:data.rows,matched:0,ms:performance.now()-started,info:data.info};
    var rawRules=Array.isArray(q.rules)?q.rules:[],rules=[],thresholds=[];rawRules.forEach(function(r){if(!r||!r.stat)return;rules.push({stat:String(r.stat)});var n=Number(r.threshold);if(r.threshold!==null&&r.threshold!==''&&Number.isFinite(n))thresholds.push({stat:String(r.stat),v:n});});
    var f4max=(q.factor4Max===null||q.factor4Max===undefined||q.factor4Max==='')?null:Number(q.factor4Max),limit=Math.max(1,Number(q.limit||500)||500),heap=[],matched=0,base=16;
    var fullInfo=fullDatasetInfo(m,q),noFilters=owned.length===0&&excluded.length===0&&thresholds.length===0&&f4max===null;

    /* Top500正式運用: 初期表示は事前生成済みTop500を直接返す。
       単一ステータス優先は事前生成済みSortTop500内で並べ替える。
       複数優先・閾値・所持/除外・文曲条件は全件DBを検索して正確な上位500件を返す。 */
    var matchedOverride=null;
    if(q.sourceType!=='full'&&fullInfo&&noFilters){
      var fullRows=Number(fullInfo.rows||0);matchedOverride=fullRows;
      if(q.sourceType==='top'&&rules.length===0){
        var direct=materializeFirst(data,q,m,Math.min(limit,data.rows));
        return {rows:direct,scanned:fullRows,matched:fullRows,ms:performance.now()-started,info:data.info,sourceType:'top'};
      }
    }else if(q.sourceType==='top'&&noFilters&&rules.length===0){
      var directFallback=materializeFirst(data,q,m,Math.min(limit,data.rows));
      return {rows:directFallback,scanned:data.rows,matched:data.rows,ms:performance.now()-started,info:data.info,sourceType:'top'};
    }

    for(var idx=0;idx<data.rows;idx++,base+=rec){
      var ok=true;
      for(var oi=0;oi<owned.length&&ok;oi++)if(!hasAnyHero(dv,base,owned[oi]))ok=false;
      for(var ei=0;ei<excluded.length&&ok;ei++)if(hasHero(dv,base,excluded[ei]))ok=false;
      if(ok&&f4max!==null){var f4=dv.getUint8(base+47);if(f4===255||f4>f4max)ok=false;}
      for(var ti=0;ti<thresholds.length&&ok;ti++)if(statAt(dv,base,thresholds[ti].stat)<thresholds[ti].v)ok=false;
      if(!ok)continue;matched++;
      if(heap.length<limit)heapPush(heap,base,dv,rules);else if(better(dv,base,heap[0],rules)){heap[0]=base;heapDown(heap,0,dv,rules);}
    }
    heap.sort(function(a,b){return better(dv,a,b,rules)?-1:(better(dv,b,a,rules)?1:0);});
    var rows=heap.map(function(off){return materialize(dv,off,q,m,Math.floor((off-16)/rec),data.info.file);});
    return {rows:rows,scanned:(matchedOverride===null?data.rows:Number(fullInfo&&fullInfo.rows||data.rows)),matched:(matchedOverride===null?matched:matchedOverride),ms:performance.now()-started,info:data.info,sourceType:q.sourceType||'full'};
  }

  function exactBondIds(names,m){var out=[];for(var i=0;i<(Array.isArray(names)?names:[]).length;i++){var id=m._bondNameToId[norm(names[i])];if(id==null)return [];out.push(Number(id));}return out;}
  async function lookupExact(q,token){
    var started=performance.now(),m=await loadManifest();
    var heroIds=exactIds(q.heroInternalIds);if(heroIds.length!==6)return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'hero_internal_ids_invalid'};
    var count=Number(q.count)||0;if(count<5||count>9)return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'bond_count_invalid'};
    if(normalFiveSixUnsupported(q))return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'normal_5_6_not_supported'};
    var bondIds=exactBondIds(q.bondNames,m);if(bondIds.length!==count)return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'bond_names_invalid'};
    var dataQ={mode:q.mode==='grade3'?'grade3':'normal',count:count,formation:String(q.formation||''),sourceType:'full',sortStat:''};
    var data=await loadData(dataQ,token,true),dv=data.dv,rec=data.recSize,base=16;
    for(var idx=0;idx<data.rows;idx++,base+=rec){
      var heroOk=true;for(var h=0;h<heroIds.length&&heroOk;h++)if(!hasHero(dv,base,heroIds[h]))heroOk=false;
      if(!heroOk)continue;
      var bondOk=true;for(var w=0;w<bondIds.length&&bondOk;w++){var found=false;for(var b=0;b<count;b++){if(dv.getUint8(base+12+b)===bondIds[w]){found=true;break;}}if(!found)bondOk=false;}
      if(!bondOk)continue;
      return {row:materialize(dv,base,dataQ,m,idx,data.info.file),matched:1,scanned:idx+1,ms:performance.now()-started};
    }
    return {row:null,matched:0,scanned:data.rows,ms:performance.now()-started};
  }

  self.onmessage=function(ev){
    var d=ev.data||{};if(d.type==='clear'){buffers.clear();return;}
    var token=d.token;
    if(d.type==='search'){
      search(d.query||{},token).then(function(r){self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});
      return;
    }
    if(d.type==='lookupExact'){
      lookupExact(d.query||{},token).then(function(r){self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});
    }
  };
})();
