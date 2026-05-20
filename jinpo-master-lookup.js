/**
 * jinpo-master-lookup.js
 * formations_master_*.json を読み込み、英傑6人IDセットから事前計算済み結果を取得する。
 *
 * 対応想定JSON:
 * [
 *   {
 *     "bond_count": 8,
 *     "eiketsu_ids": [58679116, ...],
 *     "bond_ids": [...],
 *     "bonus_stats_sum": {"生命":10643, ...}
 *   }
 * ]
 */
(function(){
  "use strict";

  const STAT_ORDER = ["生命","気合","腕力","耐久力","器用さ","知力","魅力","土属性","水属性","火属性","風属性"];

  function normalizeId(v){
    return String(v ?? "").trim();
  }

  function keyFromIds(ids){
    return ids.map(normalizeId).filter(Boolean).sort((a,b)=>{
      const na = Number(a), nb = Number(b);
      if(!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    }).join("|");
  }

  function extractRows(data){
    if(Array.isArray(data)) return data;
    if(data && Array.isArray(data.data)) return data.data;
    if(data && Array.isArray(data.items)) return data.items;
    if(data && Array.isArray(data.results)) return data.results;
    if(data && typeof data === "object"){
      const arrays = Object.values(data).filter(Array.isArray);
      if(arrays.length) return arrays.flat();
    }
    return [];
  }

  function getIdsFromRow(row){
    return row.eiketsu_ids || row.eiketsuIds || row.members || row.member_ids || row.ids || [];
  }

  function getStatsFromRow(row){
    return row.bonus_stats_sum || row.bonusStatsSum || row.stats || row.stat_boosts || row.statBoosts || {};
  }

  class JinpoMasterLookup {
    constructor(){
      this.rows = [];
      this.byKey = new Map();
      this.loadedFiles = [];
    }

    clear(){
      this.rows = [];
      this.byKey.clear();
      this.loadedFiles = [];
    }

    addData(data, sourceName=""){
      const rows = extractRows(data);
      let added = 0;
      for(const row of rows){
        const ids = getIdsFromRow(row);
        if(!Array.isArray(ids) || ids.length !== 6) continue;
        const key = keyFromIds(ids);
        if(!key) continue;
        const normalized = {
          sourceName,
          key,
          bond_count: row.bond_count ?? row.bondCount ?? "",
          eiketsu_ids: ids.map(normalizeId),
          bond_ids: row.bond_ids || row.bondIds || [],
          bonus_stats_sum: getStatsFromRow(row),
          raw: row
        };
        this.rows.push(normalized);
        // 同一キーが複数ある場合は因縁数が高いものを優先
        const old = this.byKey.get(key);
        if(!old || Number(normalized.bond_count || 0) > Number(old.bond_count || 0)){
          this.byKey.set(key, normalized);
        }
        added++;
      }
      if(sourceName) this.loadedFiles.push({sourceName, added});
      return added;
    }

    async loadFile(file){
      const text = await file.text();
      const data = JSON.parse(text);
      return this.addData(data, file.name);
    }

    lookupByIds(ids){
      return this.byKey.get(keyFromIds(ids)) || null;
    }

    lookupByPlacement(placement){
      const ids = [1,2,3,4,5,6].map(slot=>{
        const h = placement[slot];
        return h?.id || h?.ID || h?.image_id || h?.英傑番号 || h?.番号 || "";
      });
      return this.lookupByIds(ids);
    }

    getSummary(){
      return {
        rows: this.rows.length,
        keys: this.byKey.size,
        loadedFiles: this.loadedFiles
      };
    }
  }

  window.JinpoMasterLookup = new JinpoMasterLookup();
  window.JinpoMasterLookupUtils = {
    STAT_ORDER,
    keyFromIds,
    extractRows,
    getIdsFromRow,
    getStatsFromRow
  };
})();
