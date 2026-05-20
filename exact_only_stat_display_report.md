<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>英傑一覧 | 信On 支援ツール</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{--bg:#100b07;--card:#1c140d;--gold:#d8ad55;--line:#7a5a29;--text:#f4ead2;--muted:#cbb98f;--red:#7b281c}
*{box-sizing:border-box}
body{margin:0;color:var(--text);font-family:system-ui,"Yu Gothic",sans-serif;background:radial-gradient(circle at top,rgba(139,45,32,.28),transparent 38%),linear-gradient(#160c06,#050403)}
header{padding:14px 16px;background:#1b0f08;border-bottom:1px solid var(--gold);position:sticky;top:0;z-index:3}
header a{color:#f4d38b;text-decoration:none;font-size:13px}
main{max-width:1280px;margin:auto;padding:16px}
.card{background:rgba(28,20,13,.92);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px;box-shadow:0 10px 28px rgba(0,0,0,.28)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
input,select,button{font:inherit}
input,select{padding:8px;border-radius:8px;border:1px solid var(--line);background:#070707;color:var(--text)}
button{padding:9px 12px;border-radius:8px;border:1px solid var(--gold);background:linear-gradient(#7b281c,#3f110c);color:#fff;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.hero{border:1px solid var(--line);background:#0d0a07;border-radius:12px;padding:10px}
.hero strong{color:#ffe1a1}
.meta{font-size:12px;color:var(--muted)}
.badge{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 7px;margin:2px;font-size:12px;background:#130d08}
.stats{font-size:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:6px}
.stat{background:#16100b;border:1px solid #3f3019;border-radius:6px;padding:3px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #3f3019;padding:5px;white-space:nowrap}
th{background:#24170b;color:#ffe1a1;position:sticky;top:52px}
.tableWrap{max-height:62vh;overflow:auto}
@media(max-width:760px){main{padding:8px}.row input,.row select,.row button{width:100%}.stats{grid-template-columns:repeat(2,1fr)}}
</style>

<meta name="description" content="internal_id基準で英傑名・職・因子・ステータスを検索できます。">
<meta property="og:title" content="英傑一覧">
<meta property="og:description" content="internal_id基準で英傑名・職・因子・ステータスを検索できます。">
<meta property="og:type" content="website">
<meta property="og:image" content="ogp.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">

</head>
<body>
<header><a href="index.html">← トップへ戻る</a></header>
<main>
<section class="card">
<h1>英傑一覧</h1>
<div class="meta">internal_id基準の英傑マスター確認ページ。新規追加後のCSVも読み込める。</div>
</section>

<section class="card">
<h2>検索</h2>
<div class="row">
<input id="q" placeholder="英傑名 / internal_id">
<select id="job"><option value="">職すべて</option></select>
<select id="factor"><option value="">因子すべて</option></select>
<select id="viewMode">
<option value="card">カード表示</option>
<option value="table">表表示</option>
</select>
<input type="file" id="csvFile" accept=".csv">
<button id="loadBtn">CSV差し替え</button>
<button id="resetBtn">標準へ戻す</button>
</div>
<div id="status" class="meta" style="margin-top:8px">読込中...</div>
</section>

<section class="card">
<div id="result"></div>
</section>
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
 const res=await fetch("data/jinpo_eiketsu_master.csv?v=20260515154758",{cache:"no-store"});
 rows=parseCSV(await res.text());
 standardRows=rows.slice();
 setupFilters();
 render();
}
function uniq(vals){return [...new Set(vals.filter(v=>v&&v!="未確認"&&v!="対象外"))].sort((a,b)=>String(a).localeCompare(String(b),"ja"));}
function setupFilters(){
 document.getElementById("job").innerHTML='<option value="">職すべて</option>'+uniq(rows.map(r=>r["職"])).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 document.getElementById("factor").innerHTML='<option value="">因子すべて</option>'+uniq(rows.flatMap(r=>[r["因子1"],r["因子2"],r["因子3"],r["因子4"]])).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 document.getElementById("status").textContent=`英傑 ${rows.length}件`;
}
function filtered(){
 const q=document.getElementById("q").value.trim();
 const job=document.getElementById("job").value;
 const factor=document.getElementById("factor").value;
 return rows.filter(r=>{
  if(q && !String((r.internal_id||"")+" "+(r["英傑名"]||"")).includes(q)) return false;
  if(job && r["職"]!==job) return false;
  if(factor && ![r["因子1"],r["因子2"],r["因子3"],r["因子4"]].includes(factor)) return false;
  return true;
 });
}
function render(){
 const list=filtered();
 document.getElementById("status").textContent=`英傑 ${rows.length}件 / 表示 ${list.length}件`;
 if(document.getElementById("viewMode").value==="table") renderTable(list); else renderCards(list);
}
function renderCards(list){
 document.getElementById("result").innerHTML=`<div class="grid">${list.map(r=>`
  <div class="hero">
    <strong>${esc(r.internal_id)} ${esc(r["英傑名"])}</strong>
    <div class="meta">${esc(r["職"])} / コスト ${esc(r["コスト"])} / external_id ${esc(r.external_id||"未確認")}</div>
    <div>${[r["因子1"],r["因子2"],r["因子3"],r["因子4"]].filter(Boolean).map(f=>`<span class="badge">${esc(f)}</span>`).join("")}</div>
    <div class="stats">${["生命","気合","腕力","耐久力","器用さ","知力","魅力","土属性","水属性","火属性","風属性"].map(s=>`<div class="stat">${esc(s)} ${esc(r[s])}</div>`).join("")}</div>
  </div>`).join("")}</div>`;
}
function renderTable(list){
 const keys=["internal_id","英傑名","職","コスト","因子1","因子2","因子3","因子4","生命","気合","腕力","耐久力","器用さ","知力","魅力","土属性","水属性","火属性","風属性","external_id"];
 document.getElementById("result").innerHTML=`<div class="tableWrap"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${list.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
["q","job","factor","viewMode"].forEach(id=>{document.getElementById(id).addEventListener("input",render);document.getElementById(id).addEventListener("change",render);});
document.getElementById("loadBtn").addEventListener("click",async()=>{
 const f=document.getElementById("csvFile").files[0]; if(!f){alert("CSVを選択してください");return;}
 rows=parseCSV(await f.text()); setupFilters(); render();
});
document.getElementById("resetBtn").addEventListener("click",()=>{rows=standardRows.slice();setupFilters();render();});
loadDefault().catch(e=>document.getElementById("status").textContent="読込失敗: "+e.message);
</script>
</body>
</html>
