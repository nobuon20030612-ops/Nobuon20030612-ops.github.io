(function(){
  'use strict';
  var MANIFEST_PATH='data/bond56_index/bond56_manifest.json';
  var STATS=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];
  var STAT_INDEX=Object.create(null);STATS.forEach(function(s,i){STAT_INDEX[s]=i;});
  var FORM_CODE={'衡軛':'kouyaku','鶴翼':'kakuyoku','魚鱗':'gyorin','方円':'hoen'};
  var manifest=null,model=null,core=null,bondsets=null,prepared=false;
  var fileCache=new Map(),groupMaxCache=new Map(),groupMinCache=new Map(),tripleMaskMaxCache=new Map(),tripleMaskMinCache=new Map(),bsAggCache=new Map(),cycleScratch=new Map(),disjointScratch=new Map();
  var heroBase=null,heroPlain=null,heroTensei=null,heroNames=null,heroInternal=null,heroFactorAvail=null,factorStride=0,bondRates=null,bondReq=null;
  var bsCount=0,bsBondCount=null,bsBondIds=null,bondsetLookup=null;
  var maxHero=0,maxBond=0;

  function norm(v){return String(v==null?'':v).trim().replace(/・/g,'').replace(/[\s　]+/g,'');}
  function numericHeroId(v){if(typeof v==='number'&&Number.isInteger(v)&&v>0)return v;var s=String(v==null?'':v).trim(),m=s.match(/^EIK_(\d+)$/i);if(m)return Number(m[1]);if(/^\d+$/.test(s))return Number(s);return -1;}
  function progress(token,message,bytes){self.postMessage({type:'progress',token:token,phase:'bond56',message:message,bytes:Number(bytes||0)});}
  function magic(dv,o){return String.fromCharCode(dv.getUint8(o),dv.getUint8(o+1),dv.getUint8(o+2),dv.getUint8(o+3));}
  async function sha16(ab){var h=new Uint8Array(await crypto.subtle.digest('SHA-256',ab)),s='';for(var i=0;i<8;i++)s+=h[i].toString(16).padStart(2,'0');return s;}
  async function gunzip(ab){var u=new Uint8Array(ab,0,Math.min(2,ab.byteLength));if(u.length<2||u[0]!==0x1f||u[1]!==0x8b)return ab;if(typeof DecompressionStream==='undefined')throw new Error('5・6因縁モードにはDecompressionStream(gzip)対応ブラウザが必要です');return new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}
  async function loadManifest(){if(manifest)return manifest;var r=await fetch(new URL(MANIFEST_PATH,self.location.href).href,{cache:'no-store'});if(!r.ok)throw new Error(MANIFEST_PATH+' HTTP '+r.status);manifest=await r.json();if(!manifest||!manifest.version||!manifest.files)throw new Error('5・6因縁manifest不正');return manifest;}
  async function loadRaw(name,token,silent){if(fileCache.has(name))return fileCache.get(name);var m=await loadManifest(),info=m.files[name];if(!info)throw new Error('5・6因縁索引なし: '+name);if(!silent)progress(token,'5・6因縁モード データ読込中',info.gzip_bytes||0);var r=await fetch(new URL(info.file,self.location.href).href,{cache:'no-store'});if(!r.ok)throw new Error(info.file+' HTTP '+r.status);var z=await r.arrayBuffer();if(Number(info.gzip_bytes||0)&&z.byteLength!==Number(info.gzip_bytes))throw new Error('5・6因縁索引サイズ不一致: '+name);if(String(info.sha256_16||'')!==(await sha16(z)))throw new Error('5・6因縁索引整合性不一致: '+name);if(!silent)progress(token,'5・6因縁モード データ展開中',z.byteLength);var ab=await gunzip(z);if(Number(info.raw_bytes||0)&&ab.byteLength!==Number(info.raw_bytes))throw new Error('5・6因縁索引展開サイズ不一致: '+name);fileCache.set(name,ab);return ab;}

  function buildModelArrays(){
    maxHero=Number(model.maxHeroId||0);maxBond=Number(model.maxBondId||0);var n=(maxHero+1)*11;
    heroBase=new Int32Array(n);heroPlain=new Int32Array(n);heroTensei=new Int32Array(n);heroNames=new Array(maxHero+1);heroInternal=new Array(maxHero+1);
    factorStride=(model.factors||[]).length;heroFactorAvail=new Uint8Array((maxHero+1)*factorStride);
    for(var h=1;h<=maxHero;h++){var x=model.heroes[h];if(!x)continue;heroNames[h]=String(x.n||'');heroInternal[h]=String(x.i||('EIK_'+String(h).padStart(4,'0')));for(var si=0;si<11;si++){heroBase[h*11+si]=Number(x.s[si]||0);heroPlain[h*11+si]=Number(x.p[si]||0);heroTensei[h*11+si]=Number(x.t[si]||0);}var seen=Object.create(null);for(var fi=0;fi<4;fi++){var f=Number(x.f[fi]||0);if(!f)continue;var prev=seen[f]||0,cur=(fi===3)?2:1;if(prev===1||cur===1)seen[f]=1;else seen[f]=2;}Object.keys(seen).forEach(function(k){heroFactorAvail[h*factorStride+Number(k)]=seen[k];});}
    bondRates=new Int32Array((maxBond+1)*11);bondReq=new Uint16Array((maxBond+1)*3);
    for(var b=1;b<=maxBond;b++){var bx=model.bonds[b];if(!bx)continue;for(var j=0;j<11;j++)bondRates[b*11+j]=Number(bx.m[j]||0);for(var q=0;q<3;q++)bondReq[b*3+q]=Number(bx.r[q]||0);}
  }

  function parseCore(ab){
    var dv=new DataView(ab);if(magic(dv,0)!=='B56I'||dv.getUint16(4,true)!==2)throw new Error('5・6因縁core形式不一致');
    var maxid=dv.getUint32(8,true),mc=dv.getUint32(12,true),gc=dv.getUint32(16,true),midc=dv.getUint32(20,true),tc=dv.getUint32(24,true),o=28;
    var maskLo=new BigUint64Array(mc),maskHi=new BigUint64Array(mc);for(var i=0;i<mc;i++,o+=16){maskLo[i]=dv.getBigUint64(o,true);maskHi[i]=dv.getBigUint64(o+8,true);}
    var gA=new Uint16Array(gc),gB=new Uint16Array(gc),gMask=new Uint16Array(gc),gCnt=new Uint16Array(gc),gOff=new Uint32Array(gc);
    for(var g=0;g<gc;g++,o+=12){gA[g]=dv.getUint16(o,true);gB[g]=dv.getUint16(o+2,true);gMask[g]=dv.getUint16(o+4,true);gCnt[g]=dv.getUint16(o+6,true);gOff[g]=dv.getUint32(o+8,true);}
    var mids=new Uint16Array(midc);for(var mi=0;mi<midc;mi++,o+=2)mids[mi]=dv.getUint16(o,true);
    var tKey=new Uint32Array(tc),tMask=new Uint16Array(tc),maskCounts=new Uint32Array(mc);
    for(var t=0;t<tc;t++,o+=8){var a=dv.getUint16(o,true),b=dv.getUint16(o+2,true),c=dv.getUint16(o+4,true),mm=dv.getUint16(o+6,true);tKey[t]=(a<<18)|(b<<9)|c;tMask[t]=mm;maskCounts[mm]++;}
    var maskOff=new Uint32Array(mc+1);for(var k=0;k<mc;k++)maskOff[k+1]=maskOff[k]+maskCounts[k];var cursor=new Uint32Array(maskOff),maskOrder=new Uint32Array(tc);for(var z=0;z<tc;z++){var mm2=tMask[z];maskOrder[cursor[mm2]++]=z;}
    if(maxid!==maxHero)throw new Error('5・6因縁coreと英傑正本の世代不一致');
    return {mc:mc,gc:gc,tc:tc,maskLo:maskLo,maskHi:maskHi,gA:gA,gB:gB,gMask:gMask,gCnt:gCnt,gOff:gOff,mids:mids,tKey:tKey,tMask:tMask,maskOff:maskOff,maskOrder:maskOrder};
  }
  function parseBondsets(ab){var dv=new DataView(ab);if(magic(dv,0)!=='B56B')throw new Error('5・6因縁bondset形式不一致');var count=dv.getUint32(8,true),lo=new BigUint64Array(count),hi=new BigUint64Array(count),o=12;for(var i=0;i<count;i++,o+=16){lo[i]=dv.getBigUint64(o,true);hi[i]=dv.getBigUint64(o+8,true);}return{count:count,lo:lo,hi:hi};}
  function enumerateMaskBonds(lo,hi,fn){var bit=0,x=lo;while(x){if(x&1n)fn(bit+1);x>>=1n;bit++;}bit=64;x=hi;while(x){if(x&1n)fn(bit+1);x>>=1n;bit++;}}
  function prepareBondsets(){bsCount=bondsets.count;bsBondCount=new Uint8Array(bsCount);bsBondIds=new Uint8Array(bsCount*6);for(var i=0;i<bsCount;i++){var n=0;enumerateMaskBonds(bondsets.lo[i],bondsets.hi[i],function(b){if(n<6)bsBondIds[i*6+n]=b;n++;});if(n!==5&&n!==6)throw new Error('5・6因縁bondset件数不正');bsBondCount[i]=n;}}
  async function ensurePrepared(token){if(prepared)return;var mab=await loadRaw('bond56_model.json.gz',token,false);model=JSON.parse(new TextDecoder('utf-8').decode(mab));buildModelArrays();core=parseCore(await loadRaw('bond56_core.bin.gz',token,false));bondsets=parseBondsets(await loadRaw('bondsets.bin.gz',token,false));prepareBondsets();prepared=true;}

  function bsBonds(id){var n=bsBondCount[id],out=new Array(n),o=id*6;for(var i=0;i<n;i++)out[i]=bsBondIds[o+i];return out;}
  function bsAgg(si){var key=String(si),hit=bsAggCache.get(key);if(hit)return hit;var arr=new Uint32Array(bsCount);for(var id=0;id<bsCount;id++){var s=0,n=bsBondCount[id],o=id*6;for(var j=0;j<n;j++)s+=bondRates[bsBondIds[o+j]*11+si];arr[id]=s;}bsAggCache.set(key,arr);return arr;}
  function groupMax(si,full){var key=(full?'f':'b')+si,hit=groupMaxCache.get(key);if(hit)return hit;var out=new Uint32Array(core.gc),src=full?heroTensei:heroBase;for(var g=0;g<core.gc;g++){var best=0,off=core.gOff[g],n=core.gCnt[g];for(var j=0;j<n;j++){var h=core.mids[off+j],v=src[h*11+si];if(v>best)best=v;}out[g]=best;}groupMaxCache.set(key,out);return out;}
  function groupMin(si,full){var key=(full?'f':'b')+si,hit=groupMinCache.get(key);if(hit)return hit;var out=new Uint32Array(core.gc),src=full?heroPlain:heroBase;for(var g=0;g<core.gc;g++){var best=0xffffffff,off=core.gOff[g],n=core.gCnt[g];for(var j=0;j<n;j++){var h=core.mids[off+j],v=src[h*11+si];if(v<best)best=v;}out[g]=best===0xffffffff?0:best;}groupMinCache.set(key,out);return out;}
  function tripleMaskMax(si,full){var key=(full?'f':'b')+si,hit=tripleMaskMaxCache.get(key);if(hit)return hit;var out=new Uint32Array(core.mc),src=full?heroTensei:heroBase;for(var m=0;m<core.mc;m++){var best=0,a=core.maskOff[m],b=core.maskOff[m+1];for(var p=a;p<b;p++){var ti=core.maskOrder[p],keyv=core.tKey[ti],h1=keyv>>>18,h2=(keyv>>>9)&511,h3=keyv&511,v=src[h1*11+si]+src[h2*11+si]+src[h3*11+si];if(v>best)best=v;}out[m]=best;}tripleMaskMaxCache.set(key,out);return out;}
  function tripleMaskMin(si,full){var key=(full?'f':'b')+si,hit=tripleMaskMinCache.get(key);if(hit)return hit;var out=new Uint32Array(core.mc),src=full?heroPlain:heroBase;for(var m=0;m<core.mc;m++){var best=0xffffffff,a=core.maskOff[m],b=core.maskOff[m+1];for(var p=a;p<b;p++){var ti=core.maskOrder[p],keyv=core.tKey[ti],h1=keyv>>>18,h2=(keyv>>>9)&511,h3=keyv&511,v=src[h1*11+si]+src[h2*11+si]+src[h3*11+si];if(v<best)best=v;}out[m]=best===0xffffffff?0:best;}tripleMaskMinCache.set(key,out);return out;}
  function globalMax(si,full){var src=full?heroTensei:heroBase,best=0;for(var h=1;h<=maxHero;h++){if(!model.heroes[h])continue;var v=src[h*11+si];if(v>best)best=v;}return best;}
  function globalMin(si,full){var src=full?heroPlain:heroBase,best=0xffffffff;for(var h=1;h<=maxHero;h++){if(!model.heroes[h])continue;var v=src[h*11+si];if(v<best)best=v;}return best===0xffffffff?0:best;}
  function formationBonus(form,si){var a=model.formationBonus&&model.formationBonus[form];return Number(a&&a[si]||0);}
  function ubOne(sum,bsid,form,si){var raw=Math.floor(Number(sum)*Number(bsAgg(si)[bsid])/10000);var v=Math.floor(raw*(100+formationBonus(form,si))/100);return Math.max(0,Math.min(65535,v));}
  function statFromSum(sum,bsid,form,si){var raw=0,n=bsBondCount[bsid],bo=bsid*6;for(var j=0;j<n;j++){var rate=bondRates[bsBondIds[bo+j]*11+si];if(rate)raw+=Math.floor(Number(sum)*rate/10000);}var v=Math.floor(raw*(100+formationBonus(form,si))/100);return Math.max(0,Math.min(65535,v));}
  function primarySpec(q){var ss=q.sumSort||{},s1=STAT_INDEX[String(ss.stat1||'')],s2=STAT_INDEX[String(ss.stat2||'')];if(ss.enabled&&s1!=null&&s2!=null)return{kind:'sum',idx:[s1,s2],max:131070};var rs=Array.isArray(q.rules)?q.rules:[];if(rs.length&&STAT_INDEX[String(rs[0].stat||'')]!=null)return{kind:'one',idx:[STAT_INDEX[String(rs[0].stat)]],max:65535};return{kind:'total',idx:[0,1,2,3,4,5,6,7,8,9,10],max:720885};}
  function primaryFromValues(vals,spec){if(spec.kind==='one')return vals[spec.idx[0]];if(spec.kind==='sum')return vals[spec.idx[0]]+vals[spec.idx[1]];var s=0;for(var i=0;i<11;i++)s+=vals[i];return s;}
  function ubPrimary(sumForStat,bsid,form,spec){var x=0;for(var i=0;i<spec.idx.length;i++){var si=spec.idx[i];x+=ubOne(sumForStat(si),bsid,form,si);}return Math.min(spec.max,x);}
  function feasibleUbPrimary(sumForStat,bsid,form,ctx){var x=0;for(var i=0;i<ctx.spec.idx.length;i++){var si=ctx.spec.idx[i],v=ubOne(sumForStat(si),bsid,form,si),mx=ctx.maxLimit[si];if(mx!==null&&v>mx)v=mx;x+=v;}return Math.min(ctx.spec.max,x);}
  function parseRules(q){var out=[];(Array.isArray(q.rules)?q.rules:[]).forEach(function(r){if(!r||STAT_INDEX[String(r.stat||'')]==null)return;var min=Number(r.threshold),max=Number(r.maxThreshold),hasMin=r.threshold!==null&&r.threshold!==''&&Number.isFinite(min),hasMax=r.maxThreshold!==null&&r.maxThreshold!==''&&Number.isFinite(max);out.push({si:STAT_INDEX[String(r.stat)],min:hasMin?min:null,max:hasMax?max:null});});return out;}
  function meetsThresholds(vals,rr){for(var i=0;i<rr.length;i++){var x=vals[rr[i].si];if(rr[i].min!==null&&x<rr[i].min)return false;if(rr[i].max!==null&&x>rr[i].max)return false;}return true;}
  function canMeetMinimum(sumForStat,bsid,form,rr){for(var i=0;i<rr.length;i++){if(rr[i].min===null)continue;if(ubOne(sumForStat(rr[i].si),bsid,form,rr[i].si)<rr[i].min)return false;}return true;}
  function canMeetRangeBounds(upperSumForStat,lowerSumForStat,bsid,form,ctx){for(var si=0;si<11;si++){var mn=ctx.minLimit[si],mx=ctx.maxLimit[si];if(mn!==null&&ubOne(upperSumForStat(si),bsid,form,si)<mn)return false;if(mx!==null&&statFromSum(lowerSumForStat(si),bsid,form,si)>mx)return false;}return true;}

  function calcStats(sums,bsid,form){var vals=new Int32Array(11),n=bsBondCount[bsid],bo=bsid*6;for(var si=0;si<11;si++){var raw=0;for(var j=0;j<n;j++){var rate=bondRates[bsBondIds[bo+j]*11+si];if(rate)raw+=Math.floor(sums[si]*rate/10000);}vals[si]=Math.floor(raw*(100+formationBonus(form,si))/100);}return vals;}
  function totalVals(v){var s=0;for(var i=0;i<11;i++)s+=v[i];return s;}
  function placementBaseSums(p){var s=new Int32Array(11);for(var k=0;k<6;k++){var h=p[k],o=h*11;for(var si=0;si<11;si++)s[si]+=heroBase[o+si];}return s;}
  function fullmaxSums(p,f4mask){var s=new Int32Array(11);for(var k=0;k<6;k++){var h=p[k],src=(f4mask&(1<<k))?heroPlain:heroTensei,o=h*11;for(var si=0;si<11;si++)s[si]+=src[o+si];}return s;}

  var PERMS=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  function assignmentMasks(line,bid){var out=0;for(var pi=0;pi<6;pi++){var perm=PERMS[pi],mask=0,ok=true;for(var ri=0;ri<3;ri++){var f=bondReq[bid*3+ri],h=line[perm[ri]],av=heroFactorAvail[h*factorStride+f];if(!av){ok=false;break;}if(av===2)mask|=(1<<perm[ri]);}if(ok)out|=(1<<mask);}return out;}
  function pop6(m){var c=0;for(;m;m&=m-1)c++;return c;}
  function minimalF4(p,form,bsid){var lines=model.activeLines[form],states=[0],n=bsBondCount[bsid],bo=bsid*6;for(var bj=0;bj<n;bj++){var bid=bsBondIds[bo+bj],opts=[],seenOpt=new Uint8Array(64);for(var li=0;li<lines.length;li++){var ln=lines[li],line=[p[ln[0]],p[ln[1]],p[ln[2]]],relSet=assignmentMasks(line,bid);for(var rm=0;rm<8;rm++)if(relSet&(1<<rm)){var gm=0;if(rm&1)gm|=1<<ln[0];if(rm&2)gm|=1<<ln[1];if(rm&4)gm|=1<<ln[2];if(!seenOpt[gm]){seenOpt[gm]=1;opts.push(gm);}}}if(!opts.length)return 255;var seen=new Uint8Array(64),next=[];for(var si=0;si<states.length;si++)for(var oi=0;oi<opts.length;oi++){var u=states[si]|opts[oi];if(!seen[u]){seen[u]=1;next.push(u);}}states=next;}var best=255,bits=99;for(var i=0;i<states.length;i++){var m=states[i],c=pop6(m);if(c<bits||(c===bits&&m<best)){best=m;bits=c;}}return best;}

  function canonicalCycle(p){var s=p.slice(),vars=[];[0,2,4].forEach(function(sh){vars.push(s.slice(sh).concat(s.slice(0,sh)));});var rev=[s[0],s[5],s[4],s[3],s[2],s[1]];[0,2,4].forEach(function(sh){vars.push(rev.slice(sh).concat(rev.slice(0,sh)));});vars.sort(function(a,b){for(var i=0;i<6;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;});return vars[0];}
  function stableKey(p,bsid){return p.map(function(x){return String(x).padStart(3,'0');}).join('-')+'-'+String(bsid).padStart(6,'0');}
  // 正しい組み合わせ重複定義: 同じ6英傑 + 同じ発動因縁集合は、配置順だけ違っても1件。
  // bsid は発動因縁集合を一意に表す。
  function semanticComboKey(p,bsid){var a=p.slice().sort(function(x,y){return x-y;});return a.join(',')+'#'+String(bsid);}
  function sameSixDistinct(p){var s=new Set(p);return s.size===6;}
  function containsAllRequired(p,req){if(!req.length)return true;for(var i=0;i<req.length;i++)if(p.indexOf(req[i])<0)return false;return true;}
  function betterCand(a,b,ctx){var ss=ctx.sumSort;if(ss.enabled){var a1=a.mv[ss.s1],a2=a.mv[ss.s2],b1=b.mv[ss.s1],b2=b.mv[ss.s2],as=a1+a2,bs=b1+b2;if(as!==bs)return as>bs;var ap=ss.preferSecond?a2:a1,bp=ss.preferSecond?b2:b1;if(ap!==bp)return ap>bp;var ao=ss.preferSecond?a1:a2,bo=ss.preferSecond?b1:b2;if(ao!==bo)return ao>bo;}else{for(var i=0;i<ctx.priority.length;i++){var si=ctx.priority[i],av=a.mv[si],bv=b.mv[si];if(av!==bv)return av>bv;}}if(a.mt!==b.mt)return a.mt>b.mt;return a.tie<b.tie;}
  function worseCand(a,b,ctx){return betterCand(b,a,ctx);}
  function heapPush(heap,x,ctx){heap.push(x);var i=heap.length-1;while(i>0){var p=(i-1)>>1;if(!worseCand(heap[i],heap[p],ctx))break;var t=heap[i];heap[i]=heap[p];heap[p]=t;i=p;}}
  function heapDown(heap,i,ctx){for(;;){var l=i*2+1,r=l+1,w=i;if(l<heap.length&&worseCand(heap[l],heap[w],ctx))w=l;if(r<heap.length&&worseCand(heap[r],heap[w],ctx))w=r;if(w===i)return;var t=heap[i];heap[i]=heap[w];heap[w]=t;i=w;}}
  function currentWorstPrimary(ctx){return ctx.heap.length<ctx.limit?-1:primaryFromValues(ctx.heap[0].mv,ctx.spec);}
  function makeRow(c,ctx){var names=c.p.map(function(h){return heroNames[h]||('英傑#'+h);}),internals=c.p.map(function(h){return heroInternal[h]||('EIK_'+String(h).padStart(4,'0'));}),bids=bsBonds(c.bsid),bn=bids.map(function(b){return model.bonds[b].n;});var row={result_id:'bond56_'+ctx.count+'_'+(FORM_CODE[ctx.form]||'f')+'_'+c.tie,record_type:'BOND56_DYNAMIC_V1',source_file:'data/bond56_index',formation:ctx.form,grade3_flag:'5・6因縁モード',bond_count:ctx.count,eiketsu_ids:names.join('|'),eiketsu_names:names.join('|'),eiketsu_internal_ids:internals.join('|'),eiketsu_numeric_ids:c.p.join('|'),bond_ids:bn.join('|'),bond_names:bn.join('|'),bond_numeric_ids:bids.join('|'),stat_status:'ステータス計算済み',calc_source:'BOND56_DYNAMIC_V1',factor4_usage_count:pop6(c.f4)};for(var i=0;i<11;i++)row[STATS[i]]=c.baseVals[i];row['総合値']=totalVals(c.baseVals);row.total_score=row['総合値'];if(ctx.full){var fm={};for(var j=0;j<11;j++)fm[STATS[j]]=c.fmVals[j];row.fullmax_stats=fm;row.fullmax_total=totalVals(c.fmVals);row.search_stat_mode='fullmax';}return row;}

  function queryContext(q){
    var spec=primarySpec(q),rr=parseRules(q),priority=[];
    (Array.isArray(q.rules)?q.rules:[]).forEach(function(r){var si=STAT_INDEX[String(r&&r.stat||'')];if(si!=null)priority.push(si);});
    var minLimit=new Array(11).fill(null),maxLimit=new Array(11).fill(null),invalidRange=false;
    for(var ri=0;ri<rr.length;ri++){var r=rr[ri],si=r.si;if(r.min!==null){var mn=Math.ceil(r.min);if(minLimit[si]===null||mn>minLimit[si])minLimit[si]=mn;}if(r.max!==null){var mx=Math.floor(r.max);if(maxLimit[si]===null||mx<maxLimit[si])maxLimit[si]=mx;}}
    for(var rsi=0;rsi<11;rsi++)if(minLimit[rsi]!==null&&maxLimit[rsi]!==null&&minLimit[rsi]>maxLimit[rsi])invalidRange=true;
    var ss=q.sumSort||{},s1=STAT_INDEX[String(ss.stat1||'')],s2=STAT_INDEX[String(ss.stat2||'')],sumSort={enabled:!!(ss.enabled&&s1!=null&&s2!=null),s1:s1,s2:s2,preferSecond:ss.tiePrefer==='second'};
    var excluded=new Uint8Array(maxHero+1),ex=(Array.isArray(q.excludedInternalIds)?q.excludedInternalIds:[]).map(numericHeroId).filter(function(x){return x>0&&x<=maxHero;});ex.forEach(function(h){excluded[h]=1;});
    var req=(Array.isArray(q.ownedInternalIds)?q.ownedInternalIds:[]).map(numericHeroId).filter(function(x){return x>0&&x<=maxHero;});req=Array.from(new Set(req));
    var f4=(q.factor4Max===null||q.factor4Max===undefined||q.factor4Max==='')?null:Number(q.factor4Max);
    return{q:q,count:Number(q.count),form:String(q.formation||''),full:String(q.statMode||'base')==='fullmax',spec:spec,ranges:rr,minLimit:minLimit,maxLimit:maxLimit,invalidRange:invalidRange,priority:priority,sumSort:sumSort,excluded:excluded,required:req,f4max:Number.isFinite(f4)?f4:null,limit:Math.max(1,Number(q.limit||500)||500),heap:[],heapSemantic:new Map(),matchedSeen:0,matchedSemantic:new Set(),pruned:false,orderedMids:new Map(),orderedTriples:new Map(),heroOrder:null,countOnly:!!q.__countOnly,hitCap:Math.max(1,Number(q.__hitCap||100000)||100000),hitCapReached:false};
  }
  function heroHeuristic(h,ctx){var src=ctx.full?heroTensei:heroBase,o=h*11;if(ctx.spec.kind==='one')return src[o+ctx.spec.idx[0]];if(ctx.spec.kind==='sum')return src[o+ctx.spec.idx[0]]+src[o+ctx.spec.idx[1]];var s=0;for(var i=0;i<11;i++)s+=src[o+i];return s;}
  function orderedMids(gid,ctx){var hit=ctx.orderedMids.get(gid);if(hit)return hit;var off=core.gOff[gid],n=core.gCnt[gid],a=[];for(var i=0;i<n;i++){var h=core.mids[off+i];if(!ctx.excluded[h])a.push(h);}if(!ctx.countOnly)a.sort(function(x,y){var rx=ctx.required.indexOf(x)>=0?1:0,ry=ctx.required.indexOf(y)>=0?1:0;if(rx!==ry)return ry-rx;var d=heroHeuristic(y,ctx)-heroHeuristic(x,ctx);return d||x-y;});ctx.orderedMids.set(gid,a);return a;}
  function globalHeroOrder(ctx){if(ctx.heroOrder)return ctx.heroOrder;var a=[];for(var h=1;h<=maxHero;h++)if(model.heroes[h]&&!ctx.excluded[h])a.push(h);if(!ctx.countOnly)a.sort(function(x,y){var rx=ctx.required.indexOf(x)>=0?1:0,ry=ctx.required.indexOf(y)>=0?1:0;if(rx!==ry)return ry-rx;var d=heroHeuristic(y,ctx)-heroHeuristic(x,ctx);return d||x-y;});ctx.heroOrder=a;return a;}
  function tripleMaskFor(a,b,c){if(a>b){var t=a;a=b;b=t;}if(b>c){var t2=b;b=c;c=t2;}if(a>b){var t3=a;a=b;b=t3;}var key=(a<<18)|(b<<9)|c,lo=0,hi=core.tc-1;while(lo<=hi){var m=(lo+hi)>>1,v=core.tKey[m];if(v===key)return core.tMask[m];if(v<key)lo=m+1;else hi=m-1;}return -1;}
  var fixedCycleTemplates=null,fixedDisjointTemplates=null;
  function maskKey(lo,hi){return lo.toString(16)+':'+hi.toString(16);}
  function ensureBondsetLookup(){if(bondsetLookup)return bondsetLookup;bondsetLookup=new Map();for(var i=0;i<bondsets.count;i++)bondsetLookup.set(maskKey(bondsets.lo[i],bondsets.hi[i]),i);return bondsetLookup;}
  function maskBitCount(lo,hi){var n=0,x=lo;while(x){x&=x-1n;n++;}x=hi;while(x){x&=x-1n;n++;}return n;}
  function permutationTemplates(){
    if(fixedCycleTemplates&&fixedDisjointTemplates)return;
    var vals=[0,1,2,3,4,5],perms=[];
    (function rec(a,rest){if(!rest.length){perms.push(a.slice());return;}for(var i=0;i<rest.length;i++){var n=rest[i],r=rest.slice(0,i).concat(rest.slice(i+1));a.push(n);rec(a,r);a.pop();}})([],vals);
    fixedCycleTemplates=[];fixedDisjointTemplates=[];var seenC=new Set(),seenD=new Set();
    perms.forEach(function(p){var c=canonicalCycle(p),ck=c.join(',');if(!seenC.has(ck)){seenC.add(ck);fixedCycleTemplates.push(c);}
      var a=p.slice(0,3).sort(function(x,y){return x-y;}),b=p.slice(3).sort(function(x,y){return x-y;}),swap=false;for(var j=0;j<3;j++){if(a[j]!==b[j]){swap=a[j]>b[j];break;}}var d=(swap?b.concat(a):a.concat(b)),dk=d.join(',');if(!seenD.has(dk)){seenD.add(dk);fixedDisjointTemplates.push(d);}
    });
  }
  function bondsetForPlacement(p,form,count){var lines=model.activeLines[form],lo=0n,hi=0n;if(!lines)return -1;for(var li=0;li<lines.length;li++){var ln=lines[li],tm=tripleMaskFor(p[ln[0]],p[ln[1]],p[ln[2]]);if(tm<0)continue;lo|=core.maskLo[tm];hi|=core.maskHi[tm];}if(maskBitCount(lo,hi)!==count)return -1;var hit=ensureBondsetLookup().get(maskKey(lo,hi));return hit===undefined?-1:hit;}
  function enumerateFixedRequired(ctx){
    permutationTemplates();var req=ctx.required.slice().sort(function(a,b){return a-b;}),sets=[];
    if(req.length===6)sets.push(req);
    else if(req.length===5){for(var h=1;h<=maxHero;h++){if(!model.heroes[h]||ctx.excluded[h]||req.indexOf(h)>=0)continue;sets.push(req.concat([h]).sort(function(a,b){return a-b;}));}}
    else return null;
    var templates=(ctx.form==='魚鱗'||ctx.form==='方円')?fixedCycleTemplates:fixedDisjointTemplates,seen=0;
    for(var si=0;si<sets.length&&!ctx.hitCapReached;si++){var hs=sets[si];for(var ti=0;ti<templates.length&&!ctx.hitCapReached;ti++){var t=templates[ti],p=new Array(6);for(var k=0;k<6;k++)p[k]=hs[t[k]];var bs=bondsetForPlacement(p,ctx.form,ctx.count);if(bs<0)continue;seen++;considerPlacement(p,bs,placementBaseSums(p),ctx);}}
    return{scannedSkeletons:seen,stopped:false,fixedRequired:true};
  }
  function sumHeroStat(hs,si,full){var src=full?heroTensei:heroBase,s=0;for(var i=0;i<hs.length;i++)s+=src[hs[i]*11+si];return s;}
  function sumHeroStatMin(hs,si,full){var src=full?heroPlain:heroBase,s=0;for(var i=0;i<hs.length;i++)s+=src[hs[i]*11+si];return s;}
  function branchUbCycle(fixed,chosen,remainingGroups,includeGlobal,bsid,ctx){var full=ctx.full;return feasibleUbPrimary(function(si){var s=sumHeroStat(fixed,si,full)+sumHeroStat(chosen,si,full);for(var k=0;k<remainingGroups.length;k++)s+=groupMax(si,full)[remainingGroups[k]];if(includeGlobal)s+=globalMax(si,full);return s;},bsid,ctx.form,ctx);}
  function branchCanMeetCycle(fixed,chosen,remainingGroups,includeGlobal,bsid,ctx){var full=ctx.full;return canMeetRangeBounds(function(si){var s=sumHeroStat(fixed,si,full)+sumHeroStat(chosen,si,full);for(var k=0;k<remainingGroups.length;k++)s+=groupMax(si,full)[remainingGroups[k]];if(includeGlobal)s+=globalMax(si,full);return s;},function(si){var s=sumHeroStatMin(fixed,si,full)+sumHeroStatMin(chosen,si,full);for(var k=0;k<remainingGroups.length;k++)s+=groupMin(si,full)[remainingGroups[k]];if(includeGlobal)s+=globalMin(si,full);return s;},bsid,ctx.form,ctx);}
  function considerPlacement(p,bsid,baseSums,ctx){
    if(ctx.hitCapReached)return;
    if(!sameSixDistinct(p)||!containsAllRequired(p,ctx.required))return;
    for(var i=0;i<6;i++)if(ctx.excluded[p[i]])return;
    var sem=semanticComboKey(p,bsid),f4=null,baseVals=null,fmVals=null,mv=null;
    if(ctx.countOnly){
      var needF4=ctx.f4max!==null||(ctx.full&&ctx.ranges.length>0);
      if(needF4){f4=minimalF4(p,ctx.form,bsid);if(f4===255)return;if(ctx.f4max!==null&&pop6(f4)>ctx.f4max)return;}
      if(ctx.ranges.length){
        if(ctx.full){var cfs=fullmaxSums(p,f4),cfv=calcStats(cfs,bsid,ctx.form);if(!meetsThresholds(cfv,ctx.ranges))return;}
        else{var cbv=calcStats(baseSums||placementBaseSums(p),bsid,ctx.form);if(!meetsThresholds(cbv,ctx.ranges))return;}
      }
      // 同じ6人＋同じ因縁集合は、並びが違ってもHIT数では1件。
      if(ctx.matchedSemantic.has(sem))return;
      ctx.matchedSemantic.add(sem);ctx.matchedSeen++;
      if(ctx.matchedSeen>=ctx.hitCap)ctx.hitCapReached=true;
      return;
    }
    if(ctx.full||ctx.f4max!==null){f4=minimalF4(p,ctx.form,bsid);if(f4===255)return;if(ctx.f4max!==null&&pop6(f4)>ctx.f4max)return;}
    if(ctx.full){var fs=fullmaxSums(p,f4),fv=calcStats(fs,bsid,ctx.form);if(!meetsThresholds(fv,ctx.ranges))return;mv=fv;fmVals=fv;}
    else{baseVals=calcStats(baseSums||placementBaseSums(p),bsid,ctx.form);if(!meetsThresholds(baseVals,ctx.ranges))return;mv=baseVals;}
    if(!ctx.matchedSemantic.has(sem)){ctx.matchedSemantic.add(sem);ctx.matchedSeen++;}
    var tie=stableKey(p,bsid),probe={mv:mv,mt:totalVals(mv),tie:tie};
    if(ctx.heap.length>=ctx.limit&&!betterCand(probe,ctx.heap[0],ctx))return;
    if(f4===null){f4=minimalF4(p,ctx.form,bsid);if(f4===255)return;}
    if(!baseVals)baseVals=calcStats(baseSums||placementBaseSums(p),bsid,ctx.form);
    var c={p:p.slice(),bsid:bsid,f4:f4,baseVals:baseVals,fmVals:fmVals,mv:mv,mt:probe.mt,tie:tie,semanticKey:sem};
    var existing=ctx.heapSemantic.get(sem);
    if(existing){
      if(!betterCand(c,existing,ctx))return;
      var ei=ctx.heap.indexOf(existing);
      if(ei>=0){ctx.heap[ei]=c;ctx.heapSemantic.set(sem,c);for(var hi=(ctx.heap.length>>1)-1;hi>=0;hi--)heapDown(ctx.heap,hi,ctx);}
      return;
    }
    if(ctx.heap.length<ctx.limit){heapPush(ctx.heap,c,ctx);ctx.heapSemantic.set(sem,c);return;}
    if(betterCand(c,ctx.heap[0],ctx)){
      var oldWorst=ctx.heap[0];if(oldWorst&&oldWorst.semanticKey)ctx.heapSemantic.delete(oldWorst.semanticKey);
      ctx.heap[0]=c;ctx.heapSemantic.set(sem,c);heapDown(ctx.heap,0,ctx);
    }
  }

  function parseSkeleton(ab,expectedType,count){var dv=new DataView(ab);if(magic(dv,0)!=='B56S'||dv.getUint16(4,true)!==2||dv.getUint8(6)!==expectedType||dv.getUint8(7)!==count)throw new Error('5・6因縁skeleton形式不一致');var n=Number(dv.getBigUint64(8,true)),rec=expectedType===2?12:(expectedType===3?16:8);if(ab.byteLength!==16+n*rec)throw new Error('5・6因縁skeleton件数不一致');return{dv:dv,n:n,rec:rec,type:expectedType};}
  async function loadSkeleton(type,count,token){var prefix=type===2?'cycle2':(type===3?'cycle3':'disjoint'),name=prefix+'_c'+count+'.bin.gz';return parseSkeleton(await loadRaw(name,token,false),type,count);}
  function cycleFixed(type,dv,o){var g1=dv.getUint32(o,true),g2=dv.getUint32(o+4,true),g3=type===3?dv.getUint32(o+8,true):-1,bs=dv.getUint32(o+(type===3?12:8),true);if(type===3)return{g1:g1,g2:g2,g3:g3,bs:bs,A:core.gA[g1],C:core.gB[g1],E:core.gB[g2]};var a1=core.gA[g1],b1=core.gB[g1],a2=core.gA[g2],b2=core.gB[g2],C=(a1===a2||a1===b2)?a1:b1,A=(a1===C)?b1:a1,E=(a2===C)?b2:a2;return{g1:g1,g2:g2,g3:-1,bs:bs,A:A,C:C,E:E};}
  function cycleScratchFor(data,ctx,onePriorityTie,twoPriorityTie,secondaryCapped){
    var key=String(data.type)+':'+String(data.n),s=cycleScratch.get(key);
    if(!s){s={next:new Int32Array(data.n),head:new Int32Array(720886),tieHead:null,secondHead:null,secondCapTotalHead:null};cycleScratch.set(key,s);}
    s.next.fill(-2);s.head.subarray(0,ctx.spec.max+1).fill(-1);
    if(onePriorityTie){if(!s.tieHead)s.tieHead=new Int32Array(720886);s.tieHead.fill(-1);}
    if(twoPriorityTie){if(!s.secondHead)s.secondHead=new Int32Array(65536);s.secondHead.fill(-1);}
    if(secondaryCapped){if(!s.secondCapTotalHead)s.secondCapTotalHead=new Int32Array(720886);s.secondCapTotalHead.fill(-1);}
    return s;
  }
  function buildCycleBucket(data,ctx,token){
    var primarySi=ctx.spec.kind==='one'?ctx.spec.idx[0]:-1,primaryCap=primarySi>=0?ctx.maxLimit[primarySi]:null;
    var canPrimaryTie=primarySi>=0&&primaryCap!==null&&primaryCap>=0&&primaryCap<65535&&ctx.priority.length>=1&&ctx.priority.length<=2;
    var onePriorityTie=canPrimaryTie&&ctx.priority.length===1;
    var twoPriorityTie=canPrimaryTie&&ctx.priority.length===2;
    var secondarySi=twoPriorityTie?ctx.priority[1]:-1,secondaryCap=secondarySi>=0?ctx.maxLimit[secondarySi]:null;
    var secondaryCapped=twoPriorityTie&&secondaryCap!==null&&secondaryCap>=0&&secondaryCap<65535;
    var scratch=cycleScratchFor(data,ctx,onePriorityTie,twoPriorityTie,secondaryCapped),head=scratch.head,next=scratch.next;
    var tieHead=onePriorityTie?scratch.tieHead:null;
    var secondHead=twoPriorityTie?scratch.secondHead:null;
    var secondCapTotalHead=secondaryCapped?scratch.secondCapTotalHead:null;
    var dv=data.dv,rec=data.rec,full=ctx.full,src=full?heroTensei:heroBase,lowerSrc=full?heroPlain:heroBase,inc=data.type===2;
    var needMark=new Uint8Array(11),need=[];
    for(var ri=0;ri<ctx.ranges.length;ri++)needMark[ctx.ranges[ri].si]=1;
    for(var pi=0;pi<ctx.spec.idx.length;pi++)needMark[ctx.spec.idx[pi]]=1;
    if(twoPriorityTie)needMark[secondarySi]=1;
    if(onePriorityTie||secondaryCapped)for(var ati=0;ati<11;ati++)needMark[ati]=1;
    for(var si0=0;si0<11;si0++)if(needMark[si0])need.push(si0);
    var gmaxByStat=new Array(11),gminByStat=new Array(11),rateByStat=new Array(11),globalMaxByStat=new Int32Array(11),globalMinByStat=new Int32Array(11),formMul=new Int16Array(11);
    for(var ni=0;ni<need.length;ni++){var si=need[ni];gmaxByStat[si]=groupMax(si,full);gminByStat[si]=groupMin(si,full);rateByStat[si]=bsAgg(si);globalMaxByStat[si]=inc?globalMax(si,full):0;globalMinByStat[si]=inc?globalMin(si,full):0;formMul[si]=100+formationBonus(ctx.form,si);}
    var boundVals=new Int32Array(11);
    progress(token,'5・6因縁モード 検索順を構築中',data.n);
    for(var i=0,o=16;i<data.n;i++,o+=rec){
      var g1=dv.getUint32(o,true),g2=dv.getUint32(o+4,true),g3=-1,bs,A,C,E;
      if(data.type===3){g3=dv.getUint32(o+8,true);bs=dv.getUint32(o+12,true);A=core.gA[g1];C=core.gB[g1];E=core.gB[g2];}
      else{bs=dv.getUint32(o+8,true);var a1=core.gA[g1],b1=core.gB[g1],a2=core.gA[g2],b2=core.gB[g2];C=(a1===a2||a1===b2)?a1:b1;A=(a1===C)?b1:a1;E=(a2===C)?b2:a2;}
      if(ctx.excluded[A]||ctx.excluded[C]||ctx.excluded[E]||A===C||C===E||A===E)continue;
      var ok=true;
      for(var ns=0;ns<need.length;ns++){
        var sidx=need[ns],sum=src[A*11+sidx]+src[C*11+sidx]+src[E*11+sidx]+gmaxByStat[sidx][g1]+gmaxByStat[sidx][g2]+globalMaxByStat[sidx];
        if(g3>=0)sum+=gmaxByStat[sidx][g3];
        var raw=Math.floor(sum*rateByStat[sidx][bs]/10000),v=Math.floor(raw*formMul[sidx]/100);if(v<0)v=0;else if(v>65535)v=65535;
        var mn=ctx.minLimit[sidx],mx=ctx.maxLimit[sidx];
        if(mn!==null&&v<mn){ok=false;break;}
        if(mx!==null){
          var lowSum=lowerSrc[A*11+sidx]+lowerSrc[C*11+sidx]+lowerSrc[E*11+sidx]+gminByStat[sidx][g1]+gminByStat[sidx][g2]+globalMinByStat[sidx];
          if(g3>=0)lowSum+=gminByStat[sidx][g3];
          if(statFromSum(lowSum,bs,ctx.form,sidx)>mx){ok=false;break;}
          if(v>mx)v=mx;
        }
        boundVals[sidx]=v;
      }
      if(!ok)continue;
      var ub=0;if(ctx.spec.kind==='one')ub=boundVals[ctx.spec.idx[0]];else if(ctx.spec.kind==='sum')ub=boundVals[ctx.spec.idx[0]]+boundVals[ctx.spec.idx[1]];else{for(var ts=0;ts<11;ts++)ub+=boundVals[ts];}
      if(ub>ctx.spec.max)ub=ctx.spec.max;
      if(onePriorityTie&&ub===primaryCap){
        var totalUb=0;for(var ti=0;ti<11;ti++)totalUb+=boundVals[ti];if(totalUb>720885)totalUb=720885;next[i]=tieHead[totalUb];tieHead[totalUb]=i;
      }else if(twoPriorityTie&&ub===primaryCap){
        var secUb=boundVals[secondarySi];
        if(secondaryCapped&&secUb===secondaryCap){var totalUb2=0;for(var ti2=0;ti2<11;ti2++)totalUb2+=boundVals[ti2];if(totalUb2>720885)totalUb2=720885;next[i]=secondCapTotalHead[totalUb2];secondCapTotalHead[totalUb2]=i;}
        else{next[i]=secondHead[secUb];secondHead[secUb]=i;}
      }else{next[i]=head[ub];head[ub]=i;}
    }
    return{data:data,head:head,next:next,tieHead:tieHead,secondHead:secondHead,secondCapTotalHead:secondCapTotalHead,primaryCap:canPrimaryTie?primaryCap:null,secondarySi:secondarySi,secondaryCap:secondaryCapped?secondaryCap:null,tieMode:onePriorityTie?1:(twoPriorityTie?2:0)};
  }
  function expandCycleRecord(bucket,idx,ctx){if(ctx.hitCapReached)return;var d=bucket.data,dv=d.dv,o=16+idx*d.rec,x=cycleFixed(d.type,dv,o),fixed=[x.A,x.C,x.E],worst=currentWorstPrimary(ctx);if(d.type===3){var l1=orderedMids(x.g1,ctx),l2=orderedMids(x.g2,ctx),l3=orderedMids(x.g3,ctx);for(var i=0;i<l1.length&&!ctx.hitCapReached;i++){var B=l1[i];if(B===x.A||B===x.C||B===x.E)continue;var ub1=branchUbCycle(fixed,[B],[x.g2,x.g3],false,x.bs,ctx);if(ctx.heap.length>=ctx.limit&&ub1<currentWorstPrimary(ctx)){ctx.pruned=true;continue;}if(!branchCanMeetCycle(fixed,[B],[x.g2,x.g3],false,x.bs,ctx))continue;for(var j=0;j<l2.length&&!ctx.hitCapReached;j++){var D=l2[j];if(D===x.A||D===x.C||D===x.E||D===B)continue;var ub2=branchUbCycle(fixed,[B,D],[x.g3],false,x.bs,ctx);if(ctx.heap.length>=ctx.limit&&ub2<currentWorstPrimary(ctx)){ctx.pruned=true;continue;}if(!branchCanMeetCycle(fixed,[B,D],[x.g3],false,x.bs,ctx))continue;for(var k=0;k<l3.length&&!ctx.hitCapReached;k++){var F=l3[k];if(F===x.A||F===x.C||F===x.E||F===B||F===D)continue;var p=canonicalCycle([x.A,B,x.C,D,x.E,F]),s=placementBaseSums(p);considerPlacement(p,x.bs,s,ctx);}}}}else{var a=orderedMids(x.g1,ctx),b=orderedMids(x.g2,ctx),fill=globalHeroOrder(ctx);for(var ii=0;ii<a.length&&!ctx.hitCapReached;ii++){var B2=a[ii];if(B2===x.A||B2===x.C||B2===x.E)continue;var u1=branchUbCycle(fixed,[B2],[x.g2],true,x.bs,ctx);if(ctx.heap.length>=ctx.limit&&u1<currentWorstPrimary(ctx)){ctx.pruned=true;continue;}if(!branchCanMeetCycle(fixed,[B2],[x.g2],true,x.bs,ctx))continue;for(var jj=0;jj<b.length&&!ctx.hitCapReached;jj++){var D2=b[jj];if(D2===x.A||D2===x.C||D2===x.E||D2===B2)continue;var u2=branchUbCycle(fixed,[B2,D2],[],true,x.bs,ctx);if(ctx.heap.length>=ctx.limit&&u2<currentWorstPrimary(ctx)){ctx.pruned=true;continue;}if(!branchCanMeetCycle(fixed,[B2,D2],[],true,x.bs,ctx))continue;for(var kk=0;kk<fill.length&&!ctx.hitCapReached;kk++){var F2=fill[kk];if(F2===x.A||F2===x.C||F2===x.E||F2===B2||F2===D2)continue;if(tripleMaskFor(x.A,x.E,F2)>=0)continue;var p2=canonicalCycle([x.A,B2,x.C,D2,x.E,F2]),s2=placementBaseSums(p2);considerPlacement(p2,x.bs,s2,ctx);}}}}
  }
  async function searchCycle(ctx,token){
    var d2=await loadSkeleton(2,ctx.count,token),d3=await loadSkeleton(3,ctx.count,token),b2=buildCycleBucket(d2,ctx,token),b3=buildCycleBucket(d3,ctx,token),max=ctx.spec.max,stopped=false;
    progress(token,'5・6因縁モード 上位候補を検索中',d2.n+d3.n);
    var cap=(b2.primaryCap!==null&&b3.primaryCap===b2.primaryCap&&b2.tieMode===b3.tieMode)?b2.primaryCap:null,mode=cap===null?0:b2.tieMode;
    if(mode===1){
      for(var sec=720885;sec>=0;sec--){
        if(ctx.heap.length>=ctx.limit&&currentWorstPrimary(ctx)===cap&&sec<ctx.heap[0].mt){ctx.pruned=true;stopped=true;break;}
        for(var ti=b3.tieHead[sec];ti>=0;ti=b3.next[ti])expandCycleRecord(b3,ti,ctx);
        for(var tj=b2.tieHead[sec];tj>=0;tj=b2.next[tj])expandCycleRecord(b2,tj,ctx);
      }
      if(ctx.heap.length>=ctx.limit&&currentWorstPrimary(ctx)===cap)return{scannedSkeletons:d2.n+d3.n,stopped:true};
      max=cap-1;
    }else if(mode===2){
      var ssi=b2.secondarySi,scap=(b2.secondaryCap!==null&&b3.secondaryCap===b2.secondaryCap)?b2.secondaryCap:null,maxSec=65535;
      if(scap!==null){
        for(var tot=720885;tot>=0;tot--){
          if(ctx.heap.length>=ctx.limit&&currentWorstPrimary(ctx)===cap&&ctx.heap[0].mv[ssi]===scap&&tot<ctx.heap[0].mt){ctx.pruned=true;stopped=true;break;}
          for(var cti=b3.secondCapTotalHead[tot];cti>=0;cti=b3.next[cti])expandCycleRecord(b3,cti,ctx);
          for(var ctj=b2.secondCapTotalHead[tot];ctj>=0;ctj=b2.next[ctj])expandCycleRecord(b2,ctj,ctx);
        }
        if(ctx.heap.length>=ctx.limit&&currentWorstPrimary(ctx)===cap&&ctx.heap[0].mv[ssi]===scap)return{scannedSkeletons:d2.n+d3.n,stopped:true};
        maxSec=scap-1;
      }
      for(var sec2=maxSec;sec2>=0;sec2--){
        if(ctx.heap.length>=ctx.limit&&currentWorstPrimary(ctx)===cap&&sec2<ctx.heap[0].mv[ssi]){ctx.pruned=true;stopped=true;break;}
        for(var sti=b3.secondHead[sec2];sti>=0;sti=b3.next[sti])expandCycleRecord(b3,sti,ctx);
        for(var stj=b2.secondHead[sec2];stj>=0;stj=b2.next[stj])expandCycleRecord(b2,stj,ctx);
      }
      if(ctx.heap.length>=ctx.limit&&currentWorstPrimary(ctx)===cap)return{scannedSkeletons:d2.n+d3.n,stopped:true};
      max=cap-1;
    }
    for(var score=max;score>=0;score--){if(ctx.heap.length>=ctx.limit&&score<currentWorstPrimary(ctx)){ctx.pruned=true;stopped=true;break;}for(var i=b3.head[score];i>=0;i=b3.next[i])expandCycleRecord(b3,i,ctx);for(var j=b2.head[score];j>=0;j=b2.next[j])expandCycleRecord(b2,j,ctx);}
    return{scannedSkeletons:d2.n+d3.n,stopped:stopped};
  }

  function tripleHeroes(ti){var k=core.tKey[ti];return[k>>>18,(k>>>9)&511,k&511];}
  function tripleHeuristic(ti,ctx){var h=tripleHeroes(ti);return heroHeuristic(h[0],ctx)+heroHeuristic(h[1],ctx)+heroHeuristic(h[2],ctx);}
  function orderedTriples(mask,ctx){var hit=ctx.orderedTriples.get(mask);if(hit)return hit;var a=[],s=core.maskOff[mask],e=core.maskOff[mask+1];for(var p=s;p<e;p++){var ti=core.maskOrder[p],h=tripleHeroes(ti);if(ctx.excluded[h[0]]||ctx.excluded[h[1]]||ctx.excluded[h[2]])continue;a.push(ti);}if(!ctx.countOnly)a.sort(function(x,y){var d=tripleHeuristic(y,ctx)-tripleHeuristic(x,ctx);if(d)return d;return core.tKey[x]-core.tKey[y];});ctx.orderedTriples.set(mask,a);return a;}
  function disjoint(a,b){return a[0]!==b[0]&&a[0]!==b[1]&&a[0]!==b[2]&&a[1]!==b[0]&&a[1]!==b[1]&&a[1]!==b[2]&&a[2]!==b[0]&&a[2]!==b[1]&&a[2]!==b[2];}
  function buildDisjointBucket(data,ctx,token){var key=String(data.n),scratch=disjointScratch.get(key);if(!scratch){scratch={head:new Int32Array(720886),next:new Int32Array(data.n)};disjointScratch.set(key,scratch);}var head=scratch.head,next=scratch.next,dv=data.dv,full=ctx.full;head.subarray(0,ctx.spec.max+1).fill(-1);next.fill(-2);progress(token,'5・6因縁モード 検索順を構築中',data.n);for(var i=0,o=16;i<data.n;i++,o+=8){var m1=dv.getUint16(o,true),m2=dv.getUint16(o+2,true),bs=dv.getUint32(o+4,true),upper=function(si){var mx=tripleMaskMax(si,full);return mx[m1]+mx[m2];},lower=function(si){var mn=tripleMaskMin(si,full);return mn[m1]+mn[m2];};if(!canMeetRangeBounds(upper,lower,bs,ctx.form,ctx))continue;var ub=feasibleUbPrimary(upper,bs,ctx.form,ctx);next[i]=head[ub];head[ub]=i;}return{data:data,head:head,next:next};}
  function branchUbDisjoint(h1,m2,bs,ctx){return feasibleUbPrimary(function(si){return sumHeroStat(h1,si,ctx.full)+tripleMaskMax(si,ctx.full)[m2];},bs,ctx.form,ctx);}
  function branchCanMeetDisjoint(h1,m2,bs,ctx){return canMeetRangeBounds(function(si){return sumHeroStat(h1,si,ctx.full)+tripleMaskMax(si,ctx.full)[m2];},function(si){return sumHeroStatMin(h1,si,ctx.full)+tripleMaskMin(si,ctx.full)[m2];},bs,ctx.form,ctx);}
  function expandDisjoint(bucket,idx,ctx){if(ctx.hitCapReached)return;var dv=bucket.data.dv,o=16+idx*8,m1=dv.getUint16(o,true),m2=dv.getUint16(o+2,true),bs=dv.getUint32(o+4,true),l1=orderedTriples(m1,ctx),l2=orderedTriples(m2,ctx);for(var i=0;i<l1.length&&!ctx.hitCapReached;i++){var h1=tripleHeroes(l1[i]),ub=branchUbDisjoint(h1,m2,bs,ctx);if(ctx.heap.length>=ctx.limit&&ub<currentWorstPrimary(ctx)){ctx.pruned=true;continue;}if(!branchCanMeetDisjoint(h1,m2,bs,ctx))continue;for(var j=0;j<l2.length&&!ctx.hitCapReached;j++){if(m1===m2&&l2[j]<=l1[i])continue;var h2=tripleHeroes(l2[j]);if(!disjoint(h1,h2))continue;var p1=h1.concat(h2),p2=h2.concat(h1),p=(function(){for(var k=0;k<6;k++){if(p1[k]<p2[k])return p1;if(p1[k]>p2[k])return p2;}return p1;})(),s=placementBaseSums(p);considerPlacement(p,bs,s,ctx);}}}
  async function searchDisjoint(ctx,token){var d=await loadSkeleton(4,ctx.count,token),b=buildDisjointBucket(d,ctx,token);progress(token,'5・6因縁モード 上位候補を検索中',d.n);var stopped=false;for(var score=ctx.spec.max;score>=0;score--){if(ctx.heap.length>=ctx.limit&&score<currentWorstPrimary(ctx)){ctx.pruned=true;stopped=true;break;}for(var i=b.head[score];i>=0;i=b.next[i])expandDisjoint(b,i,ctx);}return{scannedSkeletons:d.n,stopped:stopped};}

  function countCycleData(data,ctx){var bucket={data:data};for(var i=0;i<data.n&&!ctx.hitCapReached;i++)expandCycleRecord(bucket,i,ctx);}
  function countDisjointData(data,ctx){var bucket={data:data};for(var i=0;i<data.n&&!ctx.hitCapReached;i++)expandDisjoint(bucket,i,ctx);}
  async function countHits(q,token){var started=performance.now();if(q.mode!=='bond56')throw new Error('5・6因縁専用Workerのmodeが不正です');await ensurePrepared(token);var c=Number(q.count),form=String(q.formation||'');if(c!==5&&c!==6)throw new Error('5・6因縁モードは5または6因縁専用です');if(['衡軛','鶴翼','魚鱗','方円'].indexOf(form)<0)throw new Error('陣形が不正です');var cq=Object.assign({},q,{__countOnly:true,__hitCap:Math.max(1,Number(q.hitCap||100000)||100000)}),ctx=queryContext(cq);if(ctx.invalidRange||ctx.required.length>6||ctx.required.some(function(h){return ctx.excluded[h];}))return{matched:0,matchedComplete:true,hitCapReached:false,ms:performance.now()-started};progress(token,'HIT件数を集計中',ctx.hitCap);if(ctx.required.length>=5){enumerateFixedRequired(ctx);return{matched:ctx.matchedSeen,matchedComplete:!ctx.hitCapReached,hitCapReached:ctx.hitCapReached,hitCap:ctx.hitCap,ms:performance.now()-started};}if(form==='魚鱗'||form==='方円'){var d2=await loadSkeleton(2,c,token),d3=await loadSkeleton(3,c,token);countCycleData(d2,ctx);if(!ctx.hitCapReached)countCycleData(d3,ctx);}else{var d=await loadSkeleton(4,c,token);countDisjointData(d,ctx);}return{matched:ctx.matchedSeen,matchedComplete:!ctx.hitCapReached,hitCapReached:ctx.hitCapReached,hitCap:ctx.hitCap,ms:performance.now()-started};}

  async function search(q,token){var started=performance.now();if(q.mode!=='bond56')throw new Error('5・6因縁専用Workerのmodeが不正です');var c=Number(q.count),form=String(q.formation||'');if((c!==5&&c!==6)||!model&&false){}await ensurePrepared(token);if(c!==5&&c!==6)throw new Error('5・6因縁モードは5または6因縁専用です');if(['衡軛','鶴翼','魚鱗','方円'].indexOf(form)<0)throw new Error('陣形が不正です');var ctx=queryContext(q);if(ctx.invalidRange||ctx.required.length>6||ctx.required.some(function(h){return ctx.excluded[h];}))return{rows:[],matched:0,matchedComplete:true,scanned:0,ms:performance.now()-started,statMode:ctx.full?'fullmax':'base'};var meta=ctx.required.length>=5?enumerateFixedRequired(ctx):((form==='魚鱗'||form==='方円')?await searchCycle(ctx,token):await searchDisjoint(ctx,token));ctx.heap.sort(function(a,b){return betterCand(a,b,ctx)?-1:(betterCand(b,a,ctx)?1:0);});var rows=ctx.heap.map(function(x){return makeRow(x,ctx);});var complete=ctx.heap.length<ctx.limit&&!ctx.pruned;return{rows:rows,matched:complete?ctx.matchedSeen:Math.max(ctx.matchedSeen,rows.length),matchedComplete:complete,scanned:meta.scannedSkeletons,ms:performance.now()-started,sourceType:'bond56-dynamic',statMode:ctx.full?'fullmax':'base'};}

  async function lookupExact(q,token){await ensurePrepared(token);var p=(Array.isArray(q.heroInternalIds)?q.heroInternalIds:[]).map(numericHeroId);if(p.length!==6||p.some(function(h){return h<=0||!model.heroes[h];}))return{row:null,matched:0,reason:'hero_internal_ids_invalid'};var names=Array.isArray(q.bondNames)?q.bondNames:[],bids=[];for(var i=0;i<names.length;i++){var found=0;for(var b=1;b<=maxBond;b++)if(norm(model.bonds[b].n)===norm(names[i])){found=b;break;}if(!found)return{row:null,matched:0,reason:'bond_names_invalid'};bids.push(found);}var lo=0n,hi=0n;bids.forEach(function(b){var bit=b-1;if(bit<64)lo|=1n<<BigInt(bit);else hi|=1n<<BigInt(bit-64);});var bs=-1;for(var id=0;id<bondsets.count;id++)if(bondsets.lo[id]===lo&&bondsets.hi[id]===hi){bs=id;break;}if(bs<0)return{row:null,matched:0};var form=String(q.formation||''),lines=model.activeLines[form];if(!lines)return{row:null,matched:0};var unionLo=0n,unionHi=0n;for(var li=0;li<lines.length;li++){var ln=lines[li],tm=tripleMaskFor(p[ln[0]],p[ln[1]],p[ln[2]]);if(tm<0)continue;unionLo|=core.maskLo[tm];unionHi|=core.maskHi[tm];}if(unionLo!==lo||unionHi!==hi)return{row:null,matched:0};var ctx=queryContext({mode:'bond56',count:Number(q.count),formation:form,statMode:q.statMode||'base',rules:[],sumSort:{},limit:1,ownedInternalIds:[],excludedInternalIds:[]}),base=placementBaseSums(p),f4=minimalF4(p,form,bs);if(f4===255)return{row:null,matched:0};var bv=calcStats(base,bs,form),fm=null,mv=bv;if(ctx.full){fm=calcStats(fullmaxSums(p,f4),bs,form);mv=fm;}var c={p:p.slice(),bsid:bs,f4:f4,baseVals:bv,fmVals:fm,mv:mv,mt:totalVals(mv),tie:stableKey(p,bs)};return{row:makeRow(c,ctx),matched:1,scanned:1};}

  self.onmessage=function(ev){var d=ev.data||{},token=d.token;if(d.type==='manifestVersion'){loadManifest().then(function(m){self.postMessage({type:'done',token:token,result:{version:String(m.version||'')}});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});return;}if(d.type==='search'){search(d.query||{},token).then(function(r){r.manifestVersion=String(manifest&&manifest.version||'');self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});return;}if(d.type==='countHits'){countHits(d.query||{},token).then(function(r){r.manifestVersion=String(manifest&&manifest.version||'');self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});return;}if(d.type==='lookupExact'){lookupExact(d.query||{},token).then(function(r){r.manifestVersion=String(manifest&&manifest.version||'');self.postMessage({type:'done',token:token,result:r});}).catch(function(e){self.postMessage({type:'error',token:token,message:e&&e.message?e.message:String(e)});});}}
})();
