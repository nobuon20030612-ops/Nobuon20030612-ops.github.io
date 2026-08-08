(function(){
  'use strict';
// Top500正式運用: 初期表示・優先検索は最大500件で統一する。
  var MANIFEST_PATH='data/compact_search_v2/jinpo_unified_search_manifest.json';
  var MANIFEST_RECHECK_MS=60000;
  var manifest=null,manifestPromise=null,manifestCheckedAt=0;
  var buffers=new Map(),fullmaxBuffers=new Map(),recommendSumBuffers=new Map(),fullmaxRecommendBuffers=new Map(),lruSeq=0,MAX_RAW_CACHE=128*1024*1024;
  var STAT_OFFSETS={'生命':21,'気合':23,'腕力':25,'耐久力':27,'器用さ':29,'知力':31,'魅力':33,'土属性':35,'水属性':37,'火属性':39,'風属性':41};
  var FULLMAX_STAT_OFFSETS={'生命':0,'気合':2,'腕力':4,'耐久力':6,'器用さ':8,'知力':10,'魅力':12,'土属性':14,'水属性':16,'火属性':18,'風属性':20};
  var FORM_CODE={'衡軛':'kouyaku','鶴翼':'kakuyoku','魚鱗':'gyorin','方円':'hoen'};
  function norm(v){return String(v==null?'':v).trim().replace(/山中鹿之助/g,'山中鹿之介').replace(/・/g,'').replace(/[\s　]+/g,'');}
  function eikInternalId(id){id=Number(id);return Number.isInteger(id)&&id>0?'EIK_'+String(id).padStart(4,'0'):'';}
  function numericHeroId(v){
    if(typeof v==='number'&&Number.isInteger(v)&&v>0)return v;
    var s=String(v==null?'':v).trim(),m=s.match(/^EIK_(\d+)$/i);if(m)return Number(m[1]);
    if(/^\d+$/.test(s))return Number(s);return -1;
  }
  function clearDataBuffers(){buffers.clear();fullmaxBuffers.clear();recommendSumBuffers.clear();fullmaxRecommendBuffers.clear();}
  function prepareManifest(m){
    m._heroNameToIds=Object.create(null);
    (m.hero_names||[]).forEach(function(n,i){if(!n)return;var k=norm(n);if(!m._heroNameToIds[k])m._heroNameToIds[k]=[];m._heroNameToIds[k].push(i);});
    m._bondNameToId=Object.create(null);
    (m.bond_names||[]).forEach(function(n,i){if(n)m._bondNameToId[norm(n)]=i;});
    return m;
  }
  async function loadManifest(forceRefresh){
    var now=Date.now();
    if(manifest&&!forceRefresh&&(now-manifestCheckedAt)<MANIFEST_RECHECK_MS)return manifest;
    if(manifestPromise)return manifestPromise;
    manifestPromise=(async function(){
      var u=new URL(MANIFEST_PATH,self.location.href);
      if(forceRefresh||manifest)u.searchParams.set('_manifest_probe',String(Date.now()));
      var r=await fetch(u.href,{cache:'no-store'});if(!r.ok)throw new Error(MANIFEST_PATH+' HTTP '+r.status);
      var next=prepareManifest(await r.json()),prevVersion=manifest?String(manifest.version||''):'';
      var nextVersion=String(next.version||'');if(!nextVersion)throw new Error('検索DB manifest version欠落');
      manifestCheckedAt=Date.now();
      if(prevVersion&&prevVersion!==nextVersion)clearDataBuffers();
      manifest=next;await cleanupOldCaches(nextVersion);return manifest;
    })();
    try{return await manifestPromise;}finally{manifestPromise=null;}
  }
  function expectedHash16(v){var s=String(v||'').trim().toLowerCase();if(!/^[0-9a-f]{16}$/.test(s))throw new Error('検索DB manifest SHA-256不正/欠落: '+s);return s;}
  async function sha256_16(ab){
    if(!self.crypto||!self.crypto.subtle||typeof self.crypto.subtle.digest!=='function')throw new Error('検索DB整合性確認に必要なWeb Crypto未対応');
    var h=new Uint8Array(await self.crypto.subtle.digest('SHA-256',ab)),s='';for(var i=0;i<8;i++)s+=h[i].toString(16).padStart(2,'0');return s;
  }
  async function integrityOk(ab,expectedHash,expectedBytes){
    var expected=expectedHash16(expectedHash),bytes=Number(expectedBytes||0);if(bytes>0&&ab.byteLength!==bytes)return false;return (await sha256_16(ab))===expected;
  }
  async function cleanupOldCaches(version){
    if(typeof caches==='undefined'||!caches.keys)return;try{var keep='jinpo-unified-compact-'+String(version||'1').replace(/[^a-zA-Z0-9_.-]/g,'_'),keys=await caches.keys();for(var i=0;i<keys.length;i++)if(keys[i].indexOf('jinpo-unified-compact-')===0&&keys[i]!==keep)await caches.delete(keys[i]);}catch(e){}
  }
  async function fetchVerified(url,canonicalUrl,expectedHash,expectedBytes,retry){
    var res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(canonicalUrl+' HTTP '+res.status);var ab=await res.arrayBuffer();if(await integrityOk(ab,expectedHash,expectedBytes))return ab;
    if(!retry)throw new Error('検索DB整合性不一致（更新中またはキャッシュ不整合）: '+canonicalUrl);
    var repair=new URL(url);repair.searchParams.set('_repair',String(Date.now()));return fetchVerified(repair.href,canonicalUrl,expectedHash,expectedBytes,false);
  }
  async function cachedFetch(url,version,expectedHash,expectedBytes){
    expectedHash16(expectedHash);var u=new URL(url,self.location.href);u.searchParams.set('v',version||'1');
    var cname='jinpo-unified-compact-'+String(version||'1').replace(/[^a-zA-Z0-9_.-]/g,'_'),cache=null;
    if(typeof caches!=='undefined'){
      try{cache=await caches.open(cname);var hit=await cache.match(u.href);if(hit){var hab=await hit.arrayBuffer();if(await integrityOk(hab,expectedHash,expectedBytes))return hab;try{await cache.delete(u.href);}catch(e){}}}catch(e){cache=null;}
    }
    var ab=await fetchVerified(u.href,url,expectedHash,expectedBytes,true);
    if(cache){try{await cache.put(u.href,new Response(ab));}catch(e){}}
    return ab;
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
  function evictIfNeeded(keepType,keepKey){
    var total=0,arr=[];
    buffers.forEach(function(v,k){total+=v.rawBytes||0;if(!(keepType==='base'&&k===keepKey))arr.push(['base',k,v.last||0,v.rawBytes||0]);});
    fullmaxBuffers.forEach(function(v,k){total+=v.rawBytes||0;if(!(keepType==='fullmax'&&k===keepKey))arr.push(['fullmax',k,v.last||0,v.rawBytes||0]);});
    if(total<=MAX_RAW_CACHE)return;
    arr.sort(function(a,b){return a[2]-b[2];});
    for(var i=0;i<arr.length&&total>MAX_RAW_CACHE;i++){
      var map=arr[i][0]==='fullmax'?fullmaxBuffers:buffers,v=map.get(arr[i][1]);
      if(v){total-=v.rawBytes||0;map.delete(arr[i][1]);}
    }
  }
  async function loadData(q,token,silent){
    var m=await loadManifest(),info=datasetInfo(m,q);if(!info)throw new Error('統一検索DBなし: '+[q.mode,q.count,q.formation,q.sourceType,q.sortStat].join('/'));
    var key=cacheKey(q,info),hit=buffers.get(key);if(hit){hit.last=++lruSeq;return hit;}
    if(!silent)self.postMessage({type:'progress',token:token,phase:'download',message:'検索DB '+q.formation+' '+q.count+'因縁 読込中',bytes:info.gzip_bytes||0});
    var zipped=await cachedFetch(info.file,m.version,info.sha256_16,info.gzip_bytes);if(!silent)self.postMessage({type:'progress',token:token,phase:'decompress',message:'検索DB 展開中',bytes:zipped.byteLength});
    var ab=await gunzip(zipped),dv=new DataView(ab);
    if(ab.byteLength<16||String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='JCF1')throw new Error('compact DB magic不一致');
    var recSize=dv.getUint16(6,true);if(recSize!==Number(m.record_size||52))throw new Error('compact DB record size不一致');
    var rows=Math.floor((ab.byteLength-16)/recSize);if(rows!==Number(info.rows||0))throw new Error('compact DB件数不一致 '+rows+' != '+info.rows);
    var obj={ab:ab,dv:dv,rows:rows,recSize:recSize,info:info,rawBytes:ab.byteLength,last:++lruSeq};buffers.set(key,obj);evictIfNeeded('base',key);return obj;
  }
  function fullmaxInfo(m,q){
    var c=String(Number(q.count)||0),f=String(q.formation||''),mode=q.mode==='grade3'?'grade3':'normal';
    return m.fullmax_stats&&m.fullmax_stats[mode]&&m.fullmax_stats[mode][c]&&m.fullmax_stats[mode][c][f];
  }
  async function loadFullmaxStats(q,token,silent){
    var m=await loadManifest(),info=fullmaxInfo(m,q);if(!info)throw new Error('全MAX検索ステータスDBなし: '+[q.mode,q.count,q.formation].join('/'));
    var key=[q.mode||'normal',q.count,q.formation,info.file||''].join('|'),hit=fullmaxBuffers.get(key);if(hit){hit.last=++lruSeq;return hit;}
    if(!silent)self.postMessage({type:'progress',token:token,phase:'download',message:'全MAX込み合計DB '+q.formation+' '+q.count+'因縁 読込中',bytes:info.gzip_bytes||0});
    var zipped=await cachedFetch(info.file,m.version,info.sha256_16,info.gzip_bytes),ab=await gunzip(zipped),dv=new DataView(ab);
    if(ab.byteLength<16||String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='JMX1')throw new Error('全MAX検索DB magic不一致');
    var rec=dv.getUint16(6,true),rows=dv.getUint32(8,true);if(rec!==Number(m.fullmax_stats_record_size||26)||rows!==Number(info.rows||0)||ab.byteLength!==16+rows*rec)throw new Error('全MAX検索DB構造不一致');
    var obj={ab:ab,dv:dv,rows:rows,recSize:rec,info:info,rawBytes:ab.byteLength,last:++lruSeq};fullmaxBuffers.set(key,obj);evictIfNeeded('fullmax',key);return obj;
  }
  function fullmaxStatAt(fm,rowIndex,stat){var o=FULLMAX_STAT_OFFSETS[stat];return !fm||o==null?0:fm.dv.getUint16(16+rowIndex*fm.recSize+o,true);}
  function fullmaxTotalAt(fm,rowIndex){return !fm?0:fm.dv.getUint32(16+rowIndex*fm.recSize+22,true);}
  function metricStat(dv,base,stat,fm,recSize){if(!fm)return statAt(dv,base,stat);var rowIndex=Math.floor((base-16)/(recSize||52));return fullmaxStatAt(fm,rowIndex,stat);}
  function metricTotal(dv,base,fm,recSize){if(!fm)return totalAt(dv,base);var rowIndex=Math.floor((base-16)/(recSize||52));return fullmaxTotalAt(fm,rowIndex);}
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
  function normalizedSumSort(raw){var s1=String(raw&&raw.stat1||''),s2=String(raw&&raw.stat2||'');return {enabled:!!(raw&&raw.enabled&&STAT_OFFSETS[s1]&&STAT_OFFSETS[s2]),stat1:s1,stat2:s2,tiePrefer:(raw&&raw.tiePrefer==='second')?'second':'first'};}
  function better(dv,a,b,rules,sumSort,fm,recSize){
    var ss=normalizedSumSort(sumSort);
    if(ss.enabled){
      var a1=metricStat(dv,a,ss.stat1,fm,recSize),a2=metricStat(dv,a,ss.stat2,fm,recSize),b1=metricStat(dv,b,ss.stat1,fm,recSize),b2=metricStat(dv,b,ss.stat2,fm,recSize),as=a1+a2,bs=b1+b2;if(as!==bs)return as>bs;
      var ap=ss.tiePrefer==='second'?a2:a1,bp=ss.tiePrefer==='second'?b2:b1;if(ap!==bp)return ap>bp;
      var ao=ss.tiePrefer==='second'?a1:a2,bo=ss.tiePrefer==='second'?b1:b2;if(ao!==bo)return ao>bo;
    }else{for(var i=0;i<rules.length;i++){var k=rules[i]&&rules[i].stat;if(!k)continue;var av=metricStat(dv,a,k,fm,recSize),bv=metricStat(dv,b,k,fm,recSize);if(av!==bv)return av>bv;}}
    var at=metricTotal(dv,a,fm,recSize),bt=metricTotal(dv,b,fm,recSize);if(at!==bt)return at>bt;return tieAt(dv,a)<tieAt(dv,b);
  }
  function worse(dv,a,b,rules,sumSort,fm,recSize){return better(dv,b,a,rules,sumSort,fm,recSize);}
  function heapPush(heap,off,dv,rules,sumSort,fm,recSize){heap.push(off);var i=heap.length-1;while(i>0){var p=(i-1)>>1;if(!worse(dv,heap[i],heap[p],rules,sumSort,fm,recSize))break;var t=heap[i];heap[i]=heap[p];heap[p]=t;i=p;}}
  function heapDown(heap,i,dv,rules,sumSort,fm,recSize){for(;;){var l=i*2+1,r=l+1,w=i;if(l<heap.length&&worse(dv,heap[l],heap[w],rules,sumSort,fm,recSize))w=l;if(r<heap.length&&worse(dv,heap[r],heap[w],rules,sumSort,fm,recSize))w=r;if(w===i)return;var t=heap[i];heap[i]=heap[w];heap[w]=t;i=w;}}
  function attachFullmaxRow(row,fm,rowIndex){
    if(!row||!fm)return row;var stats={};Object.keys(FULLMAX_STAT_OFFSETS).forEach(function(k){stats[k]=fullmaxStatAt(fm,rowIndex,k);});row.fullmax_stats=stats;row.fullmax_total=fullmaxTotalAt(fm,rowIndex);row.search_stat_mode='fullmax';return row;
  }
  function attachFullmaxFromOffset(row,dv,fmBase){
    if(!row||!dv)return row;var stats={};Object.keys(FULLMAX_STAT_OFFSETS).forEach(function(k){stats[k]=dv.getUint16(fmBase+FULLMAX_STAT_OFFSETS[k],true);});row.fullmax_stats=stats;row.fullmax_total=dv.getUint32(fmBase+22,true);row.search_stat_mode='fullmax';return row;
  }
  function materialize(dv,base,q,m,rowIndex,source,fm){
    var names=[],numericIds=[],internalIds=[];
    for(var i=0;i<6;i++){var id=dv.getUint16(base+i*2,true);numericIds.push(id);internalIds.push(eikInternalId(id));names.push((m.hero_names||[])[id]||('英傑#'+id));}
    var count=Number(q.count)||0,bonds=[],bondNumeric=[];for(var b=0;b<count;b++){var bi=dv.getUint8(base+12+b);if(bi){bondNumeric.push(bi);bonds.push((m.bond_names||[])[bi]||String(bi));}}
    var rid='compact_v2_'+(q.mode==='grade3'?'g3':'n')+'_'+count+'_'+(FORM_CODE[q.formation]||'f')+'_'+tieAt(dv,base).toString(16)+'_'+rowIndex;
    var row={result_id:rid,record_type:'COMPACT_SEARCH_V2',source_file:source,formation:String(q.formation||''),grade3_flag:q.mode==='grade3'?'等級3以下ON':'通常',bond_count:count,eiketsu_ids:names.join('|'),eiketsu_names:names.join('|'),eiketsu_internal_ids:internalIds.join('|'),eiketsu_numeric_ids:numericIds.join('|'),bond_ids:bonds.join('|'),bond_names:bonds.join('|'),bond_numeric_ids:bondNumeric.join('|'),stat_status:'ステータス計算済み',calc_source:'COMPACT_SEARCH_V2'};
    Object.keys(STAT_OFFSETS).forEach(function(k){row[k]=statAt(dv,base,k);});row['総合値']=totalAt(dv,base);row.total_score=row['総合値'];row.factor4_usage_count=dv.getUint8(base+47);if(fm)attachFullmaxRow(row,fm,rowIndex);return row;
  }
  function materializeFirst(data,q,m,limit,fm){var rows=[],base=16;for(var i=0;i<data.rows&&i<limit;i++,base+=data.recSize)rows.push(materialize(data.dv,base,q,m,i,data.info.file,fm));return rows;}

  var RECOMMEND_FORMS=['衡軛','鶴翼','魚鱗','方円'];
  function recommendCounts(mode,m){
    var src=m&&m.datasets&&m.datasets[mode==='grade3'?'grade3':'normal']||{},out=[];
    (mode==='grade3'?[5,6,7,8,9]:[7,8,9]).forEach(function(c){if(src[String(c)])out.push(c);});return out;
  }
  function rowMetricStat(row,key){
    if(row&&row.search_stat_mode==='fullmax'&&row.fullmax_stats&&row.fullmax_stats[key]!=null)return Number(row.fullmax_stats[key])||0;
    return Number(row&&row[key])||0;
  }
  function rowMetricTotal(row){
    if(row&&row.search_stat_mode==='fullmax'&&row.fullmax_total!=null)return Number(row.fullmax_total)||0;
    return Number(row&&((row.total_score!=null)?row.total_score:row['総合値']))||0;
  }
  function recommendRowBetter(a,b,target,secondary){
    var av=rowMetricStat(a,target),bv=rowMetricStat(b,target);
    if(secondary){
      var asv=rowMetricStat(a,secondary),bsv=rowMetricStat(b,secondary),as=av+asv,bs=bv+bsv;if(as!==bs)return as>bs;
      if(av!==bv)return av>bv;if(asv!==bsv)return asv>bsv;
      var at=rowMetricTotal(a),bt=rowMetricTotal(b);if(at!==bt)return at>bt;
      var az=Number(a&&a.__recommendTie),bz=Number(b&&b.__recommendTie);if(Number.isFinite(az)&&Number.isFinite(bz)&&az!==bz)return az<bz;
    }else if(av!==bv)return av>bv;
    /* Single-stat recommendation keeps the existing stable-order semantics. */
    var ak=String(a&&a.result_id||''),bk=String(b&&b.result_id||'');return ak<bk;
  }
  function sortRecommendRows(rows,target,secondary,limit){
    rows.sort(function(a,b){return recommendRowBetter(a,b,target,secondary)?-1:(recommendRowBetter(b,a,target,secondary)?1:0);});
    if(rows.length>limit)rows.length=limit;return rows;
  }
  function recommendEntryBetter(a,b,secondary){
    if(secondary){
      if(a.sum!==b.sum)return a.sum>b.sum;if(a.primary!==b.primary)return a.primary>b.primary;if(a.secondary!==b.secondary)return a.secondary>b.secondary;if(a.total!==b.total)return a.total>b.total;
    }else if(a.primary!==b.primary)return a.primary>b.primary;
    if(a.tie!==b.tie)return a.tie<b.tie;if(a.count!==b.count)return a.count<b.count;return a.rowIndex<b.rowIndex;
  }
  function recommendEntryWorse(a,b,secondary){return recommendEntryBetter(b,a,secondary);}
  function recommendHeapPush(heap,item,secondary){heap.push(item);var i=heap.length-1;while(i>0){var p=(i-1)>>1;if(!recommendEntryWorse(heap[i],heap[p],secondary))break;var t=heap[i];heap[i]=heap[p];heap[p]=t;i=p;}}
  function recommendHeapDown(heap,i,secondary){for(;;){var l=i*2+1,r=l+1,w=i;if(l<heap.length&&recommendEntryWorse(heap[l],heap[w],secondary))w=l;if(r<heap.length&&recommendEntryWorse(heap[r],heap[w],secondary))w=r;if(w===i)return;var t=heap[i];heap[i]=heap[w];heap[w]=t;i=w;}}
  function recommendFilters(q,m){
    var owned=ownedGroups(q,m),excluded=excludedIds(q,m),thresholds=[];
    (Array.isArray(q.rules)?q.rules:[]).forEach(function(r){if(!r||!r.stat)return;var minN=Number(r.threshold),maxN=Number(r.maxThreshold),hasMin=r.threshold!==null&&r.threshold!==''&&Number.isFinite(minN),hasMax=r.maxThreshold!==null&&r.maxThreshold!==''&&Number.isFinite(maxN);if(hasMin||hasMax)thresholds.push({stat:String(r.stat),min:hasMin?minN:null,max:hasMax?maxN:null});});
    var f4max=(q.factor4Max===null||q.factor4Max===undefined||q.factor4Max==='')?null:Number(q.factor4Max);
    return {owned:owned,excluded:excluded,thresholds:thresholds,f4max:f4max,noFilters:owned.length===0&&excluded.length===0&&thresholds.length===0&&f4max===null};
  }
  function recommendRecordMatches(dv,base,filters,fm,recSize){
    var oi,ei,ti;for(oi=0;oi<filters.owned.length;oi++)if(!hasAnyHero(dv,base,filters.owned[oi]))return false;
    for(ei=0;ei<filters.excluded.length;ei++)if(hasHero(dv,base,filters.excluded[ei]))return false;
    if(filters.f4max!==null){var f4=dv.getUint8(base+47);if(f4===255||f4>filters.f4max)return false;}
    for(ti=0;ti<filters.thresholds.length;ti++){var range=filters.thresholds[ti],value=metricStat(dv,base,range.stat,fm,recSize);if(range.min!==null&&value<range.min)return false;if(range.max!==null&&value>range.max)return false;}
    return true;
  }
  function canUseRecommendSortTop(m,target){
    var counts=recommendCounts('normal',m),datasets=m&&m.datasets&&m.datasets.normal||{},sort=m&&m.sort_top&&m.sort_top.normal||{};
    for(var fi=0;fi<RECOMMEND_FORMS.length;fi++){var f=RECOMMEND_FORMS[fi];for(var ci=0;ci<counts.length;ci++){var c=String(counts[ci]),full=datasets[c]&&datasets[c][f];if(!full||Number(full.rows||0)<=0)continue;if(!(sort[c]&&sort[c][f]&&sort[c][f][target]))return false;}}
    return true;
  }
  async function recommendFromSortTop(q,token,m,target,limit){
    var counts=recommendCounts('normal',m),byForm=Object.create(null),matchedByForm=Object.create(null),scanned=0;
    for(var fi=0;fi<RECOMMEND_FORMS.length;fi++){
      var f=RECOMMEND_FORMS[fi],rows=[],matched=0;
      for(var ci=0;ci<counts.length;ci++){
        var c=counts[ci],full=fullDatasetInfo(m,{mode:'normal',count:c,formation:f});if(!full||Number(full.rows||0)<=0)continue;matched+=Number(full.rows||0);
        var dataQ={mode:'normal',count:c,formation:f,sourceType:'sort',sortStat:target};if(!datasetInfo(m,dataQ))continue;
        var data=await loadData(dataQ,token,false);scanned+=data.rows;rows=rows.concat(materializeFirst(data,dataQ,m,Math.min(limit,data.rows)));
      }
      byForm[f]=sortRecommendRows(rows,target,'',limit);matchedByForm[f]=matched;
    }
    var chosen='',bestRow=null;for(var i=0;i<RECOMMEND_FORMS.length;i++){var form=RECOMMEND_FORMS[i],list=byForm[form]||[];if(!list.length)continue;if(!bestRow||recommendRowBetter(list[0],bestRow,target,'')){bestRow=list[0];chosen=form;}}
    return {formation:chosen,rows:chosen?(byForm[chosen]||[]):[],matched:chosen?Number(matchedByForm[chosen]||0):0,scanned:scanned,sourceType:'recommend-sort-top'};
  }
  function recommendSumInfo(m,mode,target,secondary){return m&&m.recommend_sum_top&&m.recommend_sum_top[mode]&&m.recommend_sum_top[mode][target]&&m.recommend_sum_top[mode][target][secondary];}
  function fullmaxRecommendInfo(m,mode,target,secondary){
    if(secondary)return m&&m.fullmax_recommend_sum_top&&m.fullmax_recommend_sum_top[mode]&&m.fullmax_recommend_sum_top[mode][target]&&m.fullmax_recommend_sum_top[mode][target][secondary];
    return m&&m.fullmax_recommend_top&&m.fullmax_recommend_top[mode]&&m.fullmax_recommend_top[mode][target];
  }
  async function loadFullmaxRecommend(m,mode,target,secondary,token){
    var info=fullmaxRecommendInfo(m,mode,target,secondary);if(!info)return null;
    var key=[mode,target,secondary||'',info.file||''].join('|'),hit=fullmaxRecommendBuffers.get(key);if(hit)return hit;
    self.postMessage({type:'progress',token:token,phase:'download',message:'全MAXおすすめTop500 読込中',bytes:info.gzip_bytes||0});
    var zipped=await cachedFetch(info.file,m.version,info.sha256_16,info.gzip_bytes),ab=await gunzip(zipped),dv=new DataView(ab);
    if(ab.byteLength<16||String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='JMR1')throw new Error('全MAXおすすめDB magic不一致');
    var rec=dv.getUint16(6,true),rows=dv.getUint32(8,true);
    if(rec!==Number(m.fullmax_recommend_record_size||80)||rows!==Number(info.rows||0)||ab.byteLength!==16+rows*rec)throw new Error('全MAXおすすめDB構造不一致');
    var obj={ab:ab,dv:dv,rows:rows,recSize:rec,info:info};fullmaxRecommendBuffers.set(key,obj);return obj;
  }
  async function recommendFromFullmaxPrecomputed(q,token,m,target,secondary,limit){
    var mode=q.mode==='grade3'?'grade3':'normal',data=await loadFullmaxRecommend(m,mode,target,secondary,token);if(!data)return null;
    var codeToForm={1:'衡軛',2:'鶴翼',3:'魚鱗',4:'方円'},byForm=Object.create(null),matchedByForm=Object.create(null),counts=recommendCounts(mode,m);
    for(var fi=0;fi<RECOMMEND_FORMS.length;fi++){var f=RECOMMEND_FORMS[fi],matched=0;for(var ci=0;ci<counts.length;ci++){var full=fullDatasetInfo(m,{mode:mode,count:counts[ci],formation:f});if(full)matched+=Number(full.rows||0);}matchedByForm[f]=matched;byForm[f]=[];}
    for(var i=0,base=16;i<data.rows;i++,base+=data.recSize){
      var form=codeToForm[data.dv.getUint8(base)],count=data.dv.getUint8(base+1);if(!form||!count)continue;
      var baseOff=base+2,fmOff=base+54,mq={mode:mode,count:count,formation:form};
      var row=materialize(data.dv,baseOff,mq,m,i,data.info.file);attachFullmaxFromOffset(row,data.dv,fmOff);row.__recommendTie=tieAt(data.dv,baseOff);byForm[form].push(row);
    }
    for(var fj=0;fj<RECOMMEND_FORMS.length;fj++){var ff=RECOMMEND_FORMS[fj];if(byForm[ff].length>limit)byForm[ff].length=limit;}
    var chosen='',bestRow=null;for(var j=0;j<RECOMMEND_FORMS.length;j++){var f2=RECOMMEND_FORMS[j],list=byForm[f2]||[];if(!list.length)continue;if(!bestRow||recommendRowBetter(list[0],bestRow,target,secondary)){bestRow=list[0];chosen=f2;}}
    return {formation:chosen,rows:chosen?(byForm[chosen]||[]):[],matched:chosen?Number(matchedByForm[chosen]||0):0,scanned:data.rows,sourceType:'fullmax-recommend-top'};
  }
  async function loadRecommendSumTop(m,mode,target,secondary,token){
    var info=recommendSumInfo(m,mode,target,secondary);if(!info)return null;var key=[mode,target,secondary,info.file||''].join('|'),hit=recommendSumBuffers.get(key);if(hit)return hit;
    self.postMessage({type:'progress',token:token,phase:'download',message:'おすすめ合計Top500 読込中',bytes:info.gzip_bytes||0});
    var zipped=await cachedFetch(info.file,m.version,info.sha256_16,info.gzip_bytes),ab=await gunzip(zipped),dv=new DataView(ab);
    if(ab.byteLength<16||String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='JRS1')throw new Error('おすすめ合計DB magic不一致');
    var rec=dv.getUint16(6,true),rows=dv.getUint32(8,true);if(rec!==54||rows!==Number(info.rows||0)||ab.byteLength!==16+rows*rec)throw new Error('おすすめ合計DB構造不一致');
    var obj={ab:ab,dv:dv,rows:rows,recSize:rec,info:info};recommendSumBuffers.set(key,obj);return obj;
  }
  async function recommendFromSumTop(q,token,m,target,secondary,limit){
    var mode=q.mode==='grade3'?'grade3':'normal',data=await loadRecommendSumTop(m,mode,target,secondary,token);if(!data)return null;
    var codeToForm={1:'衡軛',2:'鶴翼',3:'魚鱗',4:'方円'},byForm=Object.create(null),matchedByForm=Object.create(null),counts=recommendCounts(mode,m);
    for(var fi=0;fi<RECOMMEND_FORMS.length;fi++){var f=RECOMMEND_FORMS[fi],matched=0;for(var ci=0;ci<counts.length;ci++){var full=fullDatasetInfo(m,{mode:mode,count:counts[ci],formation:f});if(full)matched+=Number(full.rows||0);}matchedByForm[f]=matched;byForm[f]=[];}
    for(var i=0,base=16;i<data.rows;i++,base+=data.recSize){var form=codeToForm[data.dv.getUint8(base)],count=data.dv.getUint8(base+1);if(!form||!count)continue;var originalBase=base+2,mq={mode:mode,count:count,formation:form};var row=materialize(data.dv,originalBase,mq,m,i,data.info.file);row.__recommendTie=tieAt(data.dv,originalBase);byForm[form].push(row);}
    for(var fj=0;fj<RECOMMEND_FORMS.length;fj++){var ff=RECOMMEND_FORMS[fj];if(byForm[ff].length>limit)byForm[ff].length=limit;}
    var chosen='',bestRow=null;for(var j=0;j<RECOMMEND_FORMS.length;j++){var f2=RECOMMEND_FORMS[j],list=byForm[f2]||[];if(!list.length)continue;if(!bestRow||recommendRowBetter(list[0],bestRow,target,secondary)){bestRow=list[0];chosen=f2;}}
    return {formation:chosen,rows:chosen?(byForm[chosen]||[]):[],matched:chosen?Number(matchedByForm[chosen]||0):0,scanned:data.rows,sourceType:'recommend-sum-top'};
  }
  async function recommendFromFull(q,token,m,target,secondary,limit,filters){
    var mode=q.mode==='grade3'?'grade3':'normal',counts=recommendCounts(mode,m),byForm=Object.create(null),matchedByForm=Object.create(null),scanned=0,useFullmax=String(q&&q.statMode||'base')==='fullmax';
    if(filters.owned.some(function(g){return !g.length;}))return {formation:'',rows:[],matched:0,scanned:0,sourceType:'recommend-full'};
    for(var fi=0;fi<RECOMMEND_FORMS.length;fi++){
      var f=RECOMMEND_FORMS[fi],heap=[],matched=0;
      for(var ci=0;ci<counts.length;ci++){
        var c=counts[ci],dataQ={mode:mode,count:c,formation:f,sourceType:'full',sortStat:''};if(!datasetInfo(m,dataQ))continue;
        var data=await loadData(dataQ,token,false),fm=useFullmax?await loadFullmaxStats(dataQ,token,false):null,dv=data.dv,rec=data.recSize,base=16;
        if(fm&&fm.rows!==data.rows)throw new Error('全MAX検索DBとcompact DBの件数不一致');
        scanned+=data.rows;
        for(var idx=0;idx<data.rows;idx++,base+=rec){
          if(!recommendRecordMatches(dv,base,filters,fm,rec))continue;matched++;
          var primary=metricStat(dv,base,target,fm,rec),second=secondary?metricStat(dv,base,secondary,fm,rec):0;
          var item={data:data,fm:fm,dv:dv,base:base,count:c,formation:f,rowIndex:idx,primary:primary,secondary:second,sum:primary+second,total:metricTotal(dv,base,fm,rec),tie:tieAt(dv,base)};
          if(heap.length<limit)recommendHeapPush(heap,item,secondary);else if(recommendEntryBetter(item,heap[0],secondary)){heap[0]=item;recommendHeapDown(heap,0,secondary);}
        }
      }
      heap.sort(function(a,b){return recommendEntryBetter(a,b,secondary)?-1:(recommendEntryBetter(b,a,secondary)?1:0);});
      byForm[f]=heap.map(function(it){var mq={mode:mode,count:it.count,formation:f};var row=materialize(it.dv,it.base,mq,m,it.rowIndex,it.data.info.file,it.fm);row.__recommendTie=it.tie;return row;});matchedByForm[f]=matched;
    }
    var chosen='',bestRow=null;for(var i=0;i<RECOMMEND_FORMS.length;i++){var form=RECOMMEND_FORMS[i],list=byForm[form]||[];if(!list.length)continue;if(!bestRow||recommendRowBetter(list[0],bestRow,target,secondary)){bestRow=list[0];chosen=form;}}
    return {formation:chosen,rows:chosen?(byForm[chosen]||[]):[],matched:chosen?Number(matchedByForm[chosen]||0):0,scanned:scanned,sourceType:useFullmax?'fullmax-recommend-full':'recommend-full'};
  }
  async function recommend(q,token){
    var started=performance.now(),m=await loadManifest(),target=String(q&&q.targetStat||'').trim(),secondary=String(q&&q.secondaryStat||'').trim(),limit=Math.max(1,Number(q&&q.limit||500)||500);
    if(STAT_OFFSETS[target]==null)throw new Error('おすすめ陣法のステータスが不正です: '+target);
    if(secondary===target)secondary='';if(secondary&&STAT_OFFSETS[secondary]==null)throw new Error('おすすめ陣法の第2ステータスが不正です: '+secondary);
    var filters=recommendFilters(q,m),result=null,mode=q.mode==='grade3'?'grade3':'normal',useFullmax=String(q&&q.statMode||'base')==='fullmax';
    if(useFullmax&&filters.noFilters&&fullmaxRecommendInfo(m,mode,target,secondary))result=await recommendFromFullmaxPrecomputed(q,token,m,target,secondary,limit);
    if(!useFullmax&&filters.noFilters&&secondary&&recommendSumInfo(m,mode,target,secondary))result=await recommendFromSumTop(q,token,m,target,secondary,limit);
    if(!result&&!useFullmax&&!secondary&&(q.mode!=='grade3')&&filters.noFilters&&canUseRecommendSortTop(m,target))result=await recommendFromSortTop(q,token,m,target,limit);
    if(!result)result=await recommendFromFull(q,token,m,target,secondary,limit,filters);
    result.ms=performance.now()-started;result.targetStat=target;result.secondaryStat=secondary;result.statMode=useFullmax?'fullmax':'base';return result;
  }

  async function search(q,token){
    if(normalFiveSixUnsupported(q))throw new Error('通常5・6因縁は検索対象外です（等級3以下ON専用）');
    var started=performance.now(),m=await loadManifest(),useFullmax=String(q&&q.statMode||'base')==='fullmax';
    var loadQ=Object.assign({},q);if(useFullmax){loadQ.sourceType='full';loadQ.sortStat='';}
    var data=await loadData(loadQ,token,false),fm=useFullmax?await loadFullmaxStats(loadQ,token,false):null,dv=data.dv,rec=data.recSize;
    if(fm&&fm.rows!==data.rows)throw new Error('全MAX検索DBとcompact DBの件数不一致');
    var owned=ownedGroups(q,m),excluded=excludedIds(q,m);
    if(owned.some(function(g){return !g.length;}))return {rows:[],scanned:data.rows,matched:0,ms:performance.now()-started,info:data.info,statMode:useFullmax?'fullmax':'base'};
    var rawRules=Array.isArray(q.rules)?q.rules:[],rules=[],thresholds=[];rawRules.forEach(function(r){if(!r||!r.stat)return;rules.push({stat:String(r.stat)});var minN=Number(r.threshold),maxN=Number(r.maxThreshold),hasMin=r.threshold!==null&&r.threshold!==''&&Number.isFinite(minN),hasMax=r.maxThreshold!==null&&r.maxThreshold!==''&&Number.isFinite(maxN);if(hasMin||hasMax)thresholds.push({stat:String(r.stat),min:hasMin?minN:null,max:hasMax?maxN:null});});
    var sumSort=normalizedSumSort(q.sumSort);
    var f4max=(q.factor4Max===null||q.factor4Max===undefined||q.factor4Max==='')?null:Number(q.factor4Max),limit=Math.max(1,Number(q.limit||500)||500),heap=[],matched=0,base=16;
    var fullInfo=fullDatasetInfo(m,q),noFilters=owned.length===0&&excluded.length===0&&thresholds.length===0&&f4max===null;

    /* 基礎値は既存Top/SortTopを利用。全MAX込みはfull dataset + sidecarを正として検索する。 */
    var matchedOverride=null;
    if(!useFullmax&&q.sourceType!=='full'&&fullInfo&&noFilters){
      var fullRows=Number(fullInfo.rows||0);matchedOverride=fullRows;
      if(q.sourceType==='top'&&rules.length===0){
        var direct=materializeFirst(data,q,m,Math.min(limit,data.rows));
        return {rows:direct,scanned:fullRows,matched:fullRows,ms:performance.now()-started,info:data.info,sourceType:'top',statMode:'base'};
      }
    }else if(!useFullmax&&q.sourceType==='top'&&noFilters&&rules.length===0){
      var directFallback=materializeFirst(data,q,m,Math.min(limit,data.rows));
      return {rows:directFallback,scanned:data.rows,matched:data.rows,ms:performance.now()-started,info:data.info,sourceType:'top',statMode:'base'};
    }

    for(var idx=0;idx<data.rows;idx++,base+=rec){
      var ok=true;
      for(var oi=0;oi<owned.length&&ok;oi++)if(!hasAnyHero(dv,base,owned[oi]))ok=false;
      for(var ei=0;ei<excluded.length&&ok;ei++)if(hasHero(dv,base,excluded[ei]))ok=false;
      if(ok&&f4max!==null){var f4=dv.getUint8(base+47);if(f4===255||f4>f4max)ok=false;}
      for(var ti=0;ti<thresholds.length&&ok;ti++){var range=thresholds[ti],value=metricStat(dv,base,range.stat,fm,rec);if(range.min!==null&&value<range.min)ok=false;if(range.max!==null&&value>range.max)ok=false;}
      if(!ok)continue;matched++;
      if(heap.length<limit)heapPush(heap,base,dv,rules,sumSort,fm,rec);else if(better(dv,base,heap[0],rules,sumSort,fm,rec)){heap[0]=base;heapDown(heap,0,dv,rules,sumSort,fm,rec);}
    }
    heap.sort(function(a,b){return better(dv,a,b,rules,sumSort,fm,rec)?-1:(better(dv,b,a,rules,sumSort,fm,rec)?1:0);});
    var rows=heap.map(function(off){return materialize(dv,off,q,m,Math.floor((off-16)/rec),data.info.file,fm);});
    return {rows:rows,scanned:(matchedOverride===null?data.rows:Number(fullInfo&&fullInfo.rows||data.rows)),matched:(matchedOverride===null?matched:matchedOverride),ms:performance.now()-started,info:data.info,sourceType:useFullmax?'fullmax-full':(q.sourceType||'full'),statMode:useFullmax?'fullmax':'base'};
  }

  function exactBondIds(names,m){var out=[];for(var i=0;i<(Array.isArray(names)?names:[]).length;i++){var id=m._bondNameToId[norm(names[i])];if(id==null)return [];out.push(Number(id));}return out;}
  async function lookupExact(q,token){
    var started=performance.now(),m=await loadManifest();
    var heroIds=exactIds(q.heroInternalIds);if(heroIds.length!==6)return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'hero_internal_ids_invalid'};
    var count=Number(q.count)||0;if(count<5||count>9)return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'bond_count_invalid'};
    if(normalFiveSixUnsupported(q))return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'normal_5_6_not_supported'};
    var bondIds=exactBondIds(q.bondNames,m);if(bondIds.length!==count)return {row:null,matched:0,scanned:0,ms:performance.now()-started,reason:'bond_names_invalid'};
    var useFullmax=String(q&&q.statMode||'base')==='fullmax';
    var dataQ={mode:q.mode==='grade3'?'grade3':'normal',count:count,formation:String(q.formation||''),sourceType:'full',sortStat:'',statMode:useFullmax?'fullmax':'base'};
    var data=await loadData(dataQ,token,true),fm=useFullmax?await loadFullmaxStats(dataQ,token,true):null,dv=data.dv,rec=data.recSize,base=16;
    if(fm&&fm.rows!==data.rows)throw new Error('全MAX検索DBとcompact DBの件数不一致');
    for(var idx=0;idx<data.rows;idx++,base+=rec){
      var heroOk=true;for(var h=0;h<heroIds.length&&heroOk;h++)if(!hasHero(dv,base,heroIds[h]))heroOk=false;
      if(!heroOk)continue;
      var bondOk=true;for(var w=0;w<bondIds.length&&bondOk;w++){var found=false;for(var b=0;b<count;b++){if(dv.getUint8(base+12+b)===bondIds[w]){found=true;break;}}if(!found)bondOk=false;}
      if(!bondOk)continue;
      return {row:materialize(dv,base,dataQ,m,idx,data.info.file,fm),matched:1,scanned:idx+1,ms:performance.now()-started};
    }
    return {row:null,matched:0,scanned:data.rows,ms:performance.now()-started};
  }

  self.onmessage=function(ev){
    var d=ev.data||{};if(d.type==='clear'){clearDataBuffers();return;}
    var token=d.token;
    if(d.type==='manifestVersion'){
      loadManifest(true).then(function(m){self.postMessage({type:'done',token:token,result:{version:String(m&&m.version||'')}});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});
      return;
    }
    if(d.type==='search'){
      search(d.query||{},token).then(function(r){r.manifestVersion=String(manifest&&manifest.version||'');self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});
      return;
    }
    if(d.type==='recommend'){
      recommend(d.query||{},token).then(function(r){r.manifestVersion=String(manifest&&manifest.version||'');self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});
      return;
    }
    if(d.type==='lookupExact'){
      lookupExact(d.query||{},token).then(function(r){r.manifestVersion=String(manifest&&manifest.version||'');self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});
    }
  };
})();
