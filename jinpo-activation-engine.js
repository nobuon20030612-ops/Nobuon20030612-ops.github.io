/**
 * jinpo-activation-engine.js
 * 英傑6人配置 → ラインごとの因縁成立 / リーチ / 残り必要因子 を判定する。
 */
(function(){
  "use strict";

  const STAT_KEYS = ["生命","気合","腕力","耐久力","器用さ","知力","魅力","土属性","水属性","火属性","風属性"];

  function parseCSV(text){
    const rows=[]; let row=[], field="", q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i], n=text[i+1];
      if(q){
        if(c === '"' && n === '"'){ field+='"'; i++; }
        else if(c === '"') q=false;
        else field += c;
      }else{
        if(c === '"') q=true;
        else if(c === ","){ row.push(field); field=""; }
        else if(c === "\n"){ row.push(field); rows.push(row); row=[]; field=""; }
        else if(c !== "\r") field += c;
      }
    }
    if(field.length || row.length){ row.push(field); rows.push(row); }
    const header=rows.shift()||[];
    return rows.filter(r=>r.some(v=>String(v).trim()!=="")).map(r=>{
      const o={}; header.forEach((h,i)=>o[h]=r[i]??""); return o;
    });
  }

  async function loadCSV(path){
    const res = await fetch(path, {cache:"no-store"});
    if(!res.ok) throw new Error(`${path} を読み込めません HTTP ${res.status}`);
    return parseCSV(await res.text());
  }

  function heroFactors(hero){
    if(!hero) return [];
    return ["因子1","因子2","因子3","因子4"]
      .map(k=>String(hero[k]||"").trim())
      .filter(v=>v && v !== "-");
  }

  function inenFactors(inen){
    return ["因子1","因子2","因子3"]
      .map(k=>String(inen[k]||"").trim())
      .filter(v=>v && v !== "-");
  }

  function normalizeEffect(inen){
    const list = [];
    for(const key of ["特大","大","中","小"]){
      const value = String(inen[key] || "").trim();
      if(value) list.push(`${value}(${key})`);
    }
    return list;
  }

  /**
   * 必要因子を、ライン上の3英傑へ1つずつ割り当てられるか判定。
   * 同じ英傑が必要因子2個を同時提供する扱いにはしない。
   */
  function matchInenByDistinctHeroes(inen, heroes){
    const required = inenFactors(inen);
    if(required.length !== 3 || heroes.length !== 3 || heroes.some(h=>!h)) {
      return {activated:false, provided:[], missing:required, assignments:[]};
    }

    const heroOptions = heroes.map((hero, idx)=>({
      slotIndex: idx,
      hero,
      factors: heroFactors(hero)
    }));

    const used = new Set();
    const assignments = [];
    const requiredIndexed = required.map((factor, idx)=>({factor, idx}));

    // 重複因子にも対応するため順番を保って探索
    function dfs(reqIdx){
      if(reqIdx >= requiredIndexed.length) return true;
      const req = requiredIndexed[reqIdx];
      for(let h=0; h<heroOptions.length; h++){
        if(used.has(h)) continue;
        if(heroOptions[h].factors.includes(req.factor)){
          used.add(h);
          assignments.push({
            requiredFactor: req.factor,
            requiredIndex: req.idx,
            heroIndex: h,
            heroName: heroOptions[h].hero["英傑名"] || heroOptions[h].hero.name || "",
            providedFactors: heroOptions[h].factors
          });
          if(dfs(reqIdx+1)) return true;
          assignments.pop();
          used.delete(h);
        }
      }
      return false;
    }

    if(dfs(0)){
      return {
        activated:true,
        provided:required.slice(),
        missing:[],
        assignments:assignments.slice()
      };
    }

    // リーチ判定用: 何個まで別英傑割当できるかを全探索
    let best = [];
    function dfsBest(reqIdx, usedSet, current){
      if(current.length > best.length) best = current.slice();
      if(reqIdx >= requiredIndexed.length) return;
      const req = requiredIndexed[reqIdx];

      // この因子を誰かに割り当てる
      for(let h=0; h<heroOptions.length; h++){
        if(usedSet.has(h)) continue;
        if(heroOptions[h].factors.includes(req.factor)){
          const nextUsed = new Set(usedSet);
          nextUsed.add(h);
          dfsBest(reqIdx+1, nextUsed, current.concat([{
            requiredFactor:req.factor,
            requiredIndex:req.idx,
            heroIndex:h,
            heroName:heroOptions[h].hero["英傑名"] || "",
            providedFactors:heroOptions[h].factors
          }]));
        }
      }
      // この因子を未充足として飛ばす
      dfsBest(reqIdx+1, usedSet, current);
    }
    dfsBest(0, new Set(), []);

    const provided = best.map(a=>a.requiredFactor);
    const missing = requiredIndexed
      .filter(r=>!best.some(a=>a.requiredIndex === r.idx))
      .map(r=>r.factor);

    return {
      activated:false,
      provided,
      missing,
      assignments:best
    };
  }

  function calculateLineResult(lineSlots, placement, inenMaster){
    const heroes = lineSlots.map(slot=>placement[slot] || null);
    const activated = [];
    const reach = [];
    const all = [];

    for(const inen of inenMaster){
      const match = matchInenByDistinctHeroes(inen, heroes);
      const row = {
        inen,
        name: inen["因縁名"],
        type: inen["因縁種類"],
        factors: inenFactors(inen),
        effects: normalizeEffect(inen),
        activated: match.activated,
        provided: match.provided,
        missing: match.missing,
        assignments: match.assignments
      };
      all.push(row);
      if(match.activated) activated.push(row);
      else if(match.provided.length === 2 && match.missing.length === 1) reach.push(row);
    }

    return {
      lineSlots,
      heroes,
      activated,
      reach,
      all
    };
  }

  function calculateFormation(placement, formationName, inenMaster, configMap){
    const config = configMap[formationName];
    if(!config) throw new Error(`未定義の陣形: ${formationName}`);
    const lines = config.activeLines || [];
    const lineResults = lines.map(line=>calculateLineResult(line, placement, inenMaster));

    const activatedFlat = [];
    const seen = new Set();
    for(const lr of lineResults){
      for(const a of lr.activated){
        const key = `${a.name}|${lr.lineSlots.join("-")}`;
        if(!seen.has(key)){
          seen.add(key);
          activatedFlat.push({...a, lineSlots:lr.lineSlots, heroes:lr.heroes});
        }
      }
    }

    const reachFlat = [];
    const seenReach = new Set();
    for(const lr of lineResults){
      for(const r of lr.reach){
        const key = `${r.name}|${lr.lineSlots.join("-")}|${r.missing.join("|")}`;
        if(!seenReach.has(key)){
          seenReach.add(key);
          reachFlat.push({...r, lineSlots:lr.lineSlots, heroes:lr.heroes});
        }
      }
    }

    return {
      formationName,
      config,
      lineResults,
      activated: activatedFlat,
      reach: reachFlat
    };
  }

  function placementKey(placement){
    return [1,2,3,4,5,6].map(s=>placement[s]?.["英傑名"] || "").join("|");
  }

  function buildPlacementFromNames(names, eiketsuMaster){
    const byName = new Map(eiketsuMaster.map(e=>[e["英傑名"], e]));
    const p = {};
    names.forEach((name, idx)=>p[idx+1] = byName.get(name) || null);
    return p;
  }

  window.JinpoActivationEngine = {
    STAT_KEYS,
    parseCSV,
    loadCSV,
    heroFactors,
    inenFactors,
    matchInenByDistinctHeroes,
    calculateLineResult,
    calculateFormation,
    placementKey,
    buildPlacementFromNames
  };
})();
