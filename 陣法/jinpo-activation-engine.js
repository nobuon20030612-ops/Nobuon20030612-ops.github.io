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

  function heroFactorEntries(hero){
    if(!hero) return [];
    return ["因子1","因子2","因子3","因子4"].map((key, factorIndex)=>({
      key,
      factorIndex,
      factor:String(hero[key]||"").trim()
    })).filter(x=>x.factor && x.factor !== "-" && x.factor !== "対象外");
  }

  function bitCount(n){
    n = Number(n) >>> 0;
    let c = 0;
    while(n){ n &= n - 1; c++; }
    return c;
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
   * 1因縁について成立可能な全割当を列挙する。
   * 同じ英傑が必要因子2個を同時提供する扱いにはしない。
   * 因子4と同名因子を将来ほかのslotにも持つ場合は、非因子4を優先する。
   */
  function enumerateInenAssignments(inen, heroes){
    const required = inenFactors(inen);
    if(required.length !== 3 || heroes.length !== 3 || heroes.some(h=>!h)) return [];

    const heroOptions = heroes.map((hero, idx)=>({
      slotIndex: idx,
      hero,
      entries: heroFactorEntries(hero)
    }));
    const requiredIndexed = required.map((factor, idx)=>({factor, idx}));
    const used = new Set();
    const current = [];
    const out = [];

    function dfs(reqIdx){
      if(reqIdx >= requiredIndexed.length){
        out.push(current.map(x=>({...x, providedFactors:x.providedFactors.slice()})));
        return;
      }
      const req = requiredIndexed[reqIdx];
      for(let h=0; h<heroOptions.length; h++){
        if(used.has(h)) continue;
        const matches = heroOptions[h].entries.filter(x=>x.factor === req.factor);
        if(!matches.length) continue;
        // 同名因子が複数slotに存在しても、文曲不要のslotを先に採用。
        matches.sort((a,b)=>(a.factorIndex===3)-(b.factorIndex===3) || a.factorIndex-b.factorIndex);
        const chosen = matches[0];
        used.add(h);
        current.push({
          requiredFactor: req.factor,
          requiredIndex: req.idx,
          heroIndex: h,
          heroInternalId: heroOptions[h].hero.internal_id || "",
          heroName: heroOptions[h].hero["英傑名"] || heroOptions[h].hero.name || "",
          providedFactors: heroOptions[h].entries.map(x=>x.factor),
          providedFactorIndex: chosen.factorIndex,
          usesFactor4: chosen.factorIndex === 3
        });
        dfs(reqIdx+1);
        current.pop();
        used.delete(h);
      }
    }
    dfs(0);

    const seen = new Set();
    return out.filter(assigns=>{
      const key = assigns.map(a=>`${a.requiredIndex}:${a.heroIndex}:${a.providedFactorIndex}`).join("|");
      if(seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a,b)=>{
      const ma = a.reduce((m,x)=>m|(x.usesFactor4?(1<<x.heroIndex):0),0);
      const mb = b.reduce((m,x)=>m|(x.usesFactor4?(1<<x.heroIndex):0),0);
      if(bitCount(ma)!==bitCount(mb)) return bitCount(ma)-bitCount(mb);
      if(ma!==mb) return ma-mb;
      const sa=a.map(x=>x.heroIndex).join("");
      const sb=b.map(x=>x.heroIndex).join("");
      return sa.localeCompare(sb);
    });
  }

  function matchInenByDistinctHeroes(inen, heroes){
    const required = inenFactors(inen);
    if(required.length !== 3 || heroes.length !== 3 || heroes.some(h=>!h)) {
      return {activated:false, provided:[], missing:required, assignments:[], assignmentCandidates:[]};
    }

    const candidates = enumerateInenAssignments(inen, heroes);
    if(candidates.length){
      return {
        activated:true,
        provided:required.slice(),
        missing:[],
        assignments:candidates[0].map(x=>({...x,providedFactors:x.providedFactors.slice()})),
        assignmentCandidates:candidates
      };
    }

    // リーチ判定用: 何個まで別英傑割当できるかを全探索
    const heroOptions = heroes.map((hero, idx)=>({slotIndex:idx,hero,entries:heroFactorEntries(hero)}));
    const requiredIndexed = required.map((factor, idx)=>({factor, idx}));
    let best = [];
    function dfsBest(reqIdx, usedSet, current){
      if(current.length > best.length) best = current.slice();
      if(reqIdx >= requiredIndexed.length) return;
      const req = requiredIndexed[reqIdx];
      for(let h=0; h<heroOptions.length; h++){
        if(usedSet.has(h)) continue;
        const matches=heroOptions[h].entries.filter(x=>x.factor===req.factor);
        if(matches.length){
          matches.sort((a,b)=>(a.factorIndex===3)-(b.factorIndex===3) || a.factorIndex-b.factorIndex);
          const chosen=matches[0];
          const nextUsed = new Set(usedSet); nextUsed.add(h);
          dfsBest(reqIdx+1, nextUsed, current.concat([{
            requiredFactor:req.factor,
            requiredIndex:req.idx,
            heroIndex:h,
            heroInternalId:heroOptions[h].hero.internal_id || "",
            heroName:heroOptions[h].hero["英傑名"] || "",
            providedFactors:heroOptions[h].entries.map(x=>x.factor),
            providedFactorIndex:chosen.factorIndex,
            usesFactor4:chosen.factorIndex===3
          }]));
        }
      }
      dfsBest(reqIdx+1, usedSet, current);
    }
    dfsBest(0, new Set(), []);

    const provided = best.map(a=>a.requiredFactor);
    const missing = requiredIndexed.filter(r=>!best.some(a=>a.requiredIndex === r.idx)).map(r=>r.factor);
    return {activated:false, provided, missing, assignments:best, assignmentCandidates:[]};
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
        assignments: match.assignments,
        assignmentCandidates: match.assignmentCandidates
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

  function assignmentGlobalFactor4Mask(lineSlots, assignments){
    let mask = 0;
    (assignments||[]).forEach(a=>{
      if(!a || !a.usesFactor4) return;
      const rel=Number(a.heroIndex);
      if(!Number.isInteger(rel) || rel<0 || rel>=lineSlots.length) return;
      const slot=Number(lineSlots[rel]);
      if(slot>=1 && slot<=6) mask |= 1 << (slot-1);
    });
    return mask;
  }

  function chooseMinimalFactor4Plan(activatedFlat){
    let states = new Map([[0,{signature:"",choices:[]}]]);
    for(let bi=0; bi<activatedFlat.length; bi++){
      const act=activatedFlat[bi];
      const candidates=[];
      (act.occurrences||[]).forEach((occ,oi)=>{
        const all = Array.isArray(occ.assignmentCandidates) && occ.assignmentCandidates.length
          ? occ.assignmentCandidates : [Array.isArray(occ.assignments)?occ.assignments:[]];
        all.forEach((assigns,ai)=>{
          const mask=assignmentGlobalFactor4Mask(occ.lineSlots||[],assigns);
          const heroSig=(assigns||[]).map(a=>Number(a.heroIndex)).join("");
          candidates.push({mask,occurrence:occ,assignments:assigns,signature:`${String(oi).padStart(2,"0")}:${String(ai).padStart(2,"0")}:${heroSig}`});
        });
      });
      if(!candidates.length) throw new Error(`文曲最小化候補なし: ${act && act.name || bi}`);
      const byMask=new Map();
      candidates.forEach(c=>{
        const old=byMask.get(c.mask);
        if(!old || c.signature<old.signature) byMask.set(c.mask,c);
      });
      const next=new Map();
      states.forEach((state,stateMask)=>{
        byMask.forEach(c=>{
          const union=stateMask|c.mask;
          const signature=state.signature+"|"+c.signature;
          const existing=next.get(union);
          if(!existing || signature<existing.signature){
            next.set(union,{signature,choices:state.choices.concat([c])});
          }
        });
      });
      states=next;
    }
    if(!states.size) return {mask:0,slots:[],choices:[]};
    const masks=Array.from(states.keys()).sort((a,b)=>bitCount(a)-bitCount(b) || a-b);
    const mask=masks[0],state=states.get(mask);
    (state.choices||[]).forEach((choice,idx)=>{
      const act=activatedFlat[idx];
      if(!act || !choice) return;
      act.lineSlots=(choice.occurrence.lineSlots||[]).slice();
      act.heroes=(choice.occurrence.heroes||[]).slice();
      act.assignments=(choice.assignments||[]).map(x=>({...x,providedFactors:Array.isArray(x.providedFactors)?x.providedFactors.slice():[]}));
      act.selectedOccurrence=choice.occurrence;
    });
    const slots=[];
    for(let slot=1;slot<=6;slot++) if(mask&(1<<(slot-1))) slots.push(slot);
    return {mask,slots,choices:state.choices||[]};
  }

  function calculateFormation(placement, formationName, inenMaster, configMap){
    const config = configMap[formationName];
    if(!config) throw new Error(`未定義の陣形: ${formationName}`);
    const lines = config.activeLines || [];
    const lineResults = lines.map(line=>calculateLineResult(line, placement, inenMaster));

    // 因縁数は「発動した因縁の種類数」。
    // 同じ因縁が複数ラインで成立しても1因縁として数える。
    // ライン発光・成立詳細用に activatedOccurrences は全ライン分を保持する。
    // 文曲(因子4)は全ライン/全割当を横断し、編成全体の必要人数が最小になる計画を別途選ぶ。
    const activatedOccurrences = [];
    const activatedFlat = [];
    const activatedByName = new Map();
    lineResults.forEach((lr,lineIndex)=>{
      for(const a of lr.activated){
        const occurrence = {...a, lineSlots:lr.lineSlots, heroes:lr.heroes, lineIndex};
        activatedOccurrences.push(occurrence);
        const no = String(a.inen && (a.inen["No"] || a.inen.no) || "").trim();
        const key = no ? ("no:"+no) : ("name:"+String(a.name || "").trim());
        if(!activatedByName.has(key)){
          const uniqueAct = {...occurrence, occurrences:[occurrence]};
          activatedByName.set(key, uniqueAct);
          activatedFlat.push(uniqueAct);
        }else{
          activatedByName.get(key).occurrences.push(occurrence);
        }
      }
    });

    const factor4Plan = chooseMinimalFactor4Plan(activatedFlat);

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
      activatedOccurrences,
      factor4Mask: factor4Plan.mask,
      factor4Slots: factor4Plan.slots.slice(),
      factor4UsageCount: factor4Plan.slots.length,
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
    heroFactorEntries,
    inenFactors,
    enumerateInenAssignments,
    matchInenByDistinctHeroes,
    calculateLineResult,
    calculateFormation,
    placementKey,
    buildPlacementFromNames
  };
})();
