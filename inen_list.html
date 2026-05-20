<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>因縁一覧 | 信On 支援ツール</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--card:#1c140d;--gold:#d8ad55;--line:#7a5a29;--text:#f4ead2;--muted:#cbb98f}
*{box-sizing:border-box}
body{margin:0;color:var(--text);font-family:system-ui,"Yu Gothic",sans-serif;background:radial-gradient(circle at top,rgba(139,45,32,.28),transparent 38%),linear-gradient(#160c06,#050403)}
header{padding:14px 16px;background:#1b0f08;border-bottom:1px solid var(--gold);position:sticky;top:0;z-index:3}
header a{color:#f4d38b;text-decoration:none;font-size:13px}
main{max-width:1280px;margin:auto;padding:16px}
.card{background:rgba(28,20,13,.92);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
input,select,button{font:inherit}
input,select{padding:8px;border-radius:8px;border:1px solid var(--line);background:#070707;color:var(--text)}
button{padding:9px 12px;border-radius:8px;border:1px solid var(--gold);background:linear-gradient(#7b281c,#3f110c);color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
.inen{border:1px solid var(--line);background:#0d0a07;border-radius:12px;padding:10px}
.inen strong{color:#ffe1a1}
.meta{font-size:12px;color:var(--muted)}
.badge{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 7px;margin:2px;font-size:12px;background:#130d08}
.effect{color:#ffd166}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #3f3019;padding:5px;white-space:nowrap}
th{background:#24170b;color:#ffe1a1;position:sticky;top:52px}
.tableWrap{max-height:62vh;overflow:auto}
@media(max-width:760px){main{padding:8px}.row input,.row select,.row button{width:100%}}
</style>

<meta name="description" content="因縁名・必要因子・効果を検索できます。">
<meta property="og:title" content="因縁一覧">
<meta property="og:description" content="因縁名・必要因子・効果を検索できます。">
<meta property="og:type" content="website">
<meta property="og:image" content="ogp.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">

</head>
<body>
<header><a href="index.html">← トップへ戻る</a></header>
<main>
<section class="card">
<h1>因縁一覧</h1>
<div class="meta">因縁名・必要因子3個・効果を確認するページ。</div>
</section>

<section class="card">
<h2>検索</h2>
<div class="row">
<input id="q" placeholder="因縁名 / 因子">
<select id="factor"><option value="">因子すべて</option></select>
<select id="viewMode"><option value="card">カード表示</option><option value="table">表表示</option></select>
<input type="file" id="csvFile" accept=".csv">
<button id="loadBtn">CSV差し替え</button>
<button id="resetBtn">標準へ戻す</button>
</div>
<div id="status" class="meta" style="margin-top:8px">読込中...</div>
</section>

<section class="card"><div id="result"></div></section>
</main>
<script>
let rows=[], standardRows=[];
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function parseCSV(text){
 const data=[];let row=[],field="",q=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
  if(q){if(c=='"'&&n=='"'){field+='"';i++;}else if(c=='"')q=false;else field+=c;}
  else{if(c=='"')q=true;else if(c==","){row.push(field);field="";}else if(c=="\n"){row.push(field);data.push(row);row=[];field="";}else if(c!="\r")field+=c;}
 }
 if(field.length||row.length){row.push(field);data.push(row);}
 const header=data.shift()||[];
 return data.filter(r=>r.some(v=>String(v).trim()!="")).map(r=>{const o={};header.forEach((h,i)=>o[h]=r[i]??"");return o;});
}
async function loadDefault(){
 const res=await fetch("data/jinpo_inen_master.csv?v=20260515154758",{cache:"no-store"});
 rows=parseCSV(await res.text());
 standardRows=rows.slice();
 setupFilters(); render();
}
function uniq(vals){return [...new Set(vals.filter(v=>v&&v!="未確認"&&v!="対象外"))].sort((a,b)=>String(a).localeCompare(String(b),"ja"));}
function setupFilters(){
 const factors=uniq(rows.flatMap(r=>[r["因子1"],r["因子2"],r["因子3"]]));
 document.getElementById("factor").innerHTML='<option value="">因子すべて</option>'+factors.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 document.getElementById("status").textContent=`因縁 ${rows.length}件`;
}
function effects(r){return ["特大","大","中","小"].filter(k=>r[k]&&r[k]!="対象外").map(k=>`${r[k]}(${k})`);}
function filtered(){
 const q=document.getElementById("q").value.trim();
 const factor=document.getElementById("factor").value;
 return rows.filter(r=>{
  const hay=[r["因縁名"],r["因縁種類"],r["因子1"],r["因子2"],r["因子3"]].join(" ");
  if(q && !hay.includes(q)) return false;
  if(factor && ![r["因子1"],r["因子2"],r["因子3"]].includes(factor)) return false;
  return true;
 });
}
function render(){
 const list=filtered();
 document.getElementById("status").textContent=`因縁 ${rows.length}件 / 表示 ${list.length}件`;
 if(document.getElementById("viewMode").value==="table") renderTable(list); else renderCards(list);
}
function renderCards(list){
 document.getElementById("result").innerHTML=`<div class="grid">${list.map(r=>`
  <div class="inen">
    <strong>${esc(r.inen_id||r["因縁ID"]||"")} ${esc(r["因縁名"])}</strong>
    <div class="meta">${esc(r["因縁種類"]||"")}</div>
    <div>${[r["因子1"],r["因子2"],r["因子3"]].map(f=>`<span class="badge">${esc(f)}</span>`).join("")}</div>
    <div class="effect">${effects(r).map(e=>`<span class="badge">${esc(e)}</span>`).join("") || "効果未確認"}</div>
  </div>`).join("")}</div>`;
}
function renderTable(list){
 const keys=["inen_id","因縁種類","因縁名","因子1","因子2","因子3","特大","大","中","小"];
 document.getElementById("result").innerHTML=`<div class="tableWrap"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${list.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
["q","factor","viewMode"].forEach(id=>{document.getElementById(id).addEventListener("input",render);document.getElementById(id).addEventListener("change",render);});
document.getElementById("loadBtn").addEventListener("click",async()=>{const f=document.getElementById("csvFile").files[0];if(!f){alert("CSVを選択してください");return;}rows=parseCSV(await f.text());setupFilters();render();});
document.getElementById("resetBtn").addEventListener("click",()=>{rows=standardRows.slice();setupFilters();render();});
loadDefault().catch(e=>document.getElementById("status").textContent="読込失敗: "+e.message);
</script>
</body>
</html>
