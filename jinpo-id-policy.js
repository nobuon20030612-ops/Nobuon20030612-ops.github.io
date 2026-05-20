/**
 * jinpo-id-policy.js
 * 独自ID運用ルール。
 *
 * - アプリ内の英傑識別は internal_id のみ使用。
 * - external_id は元サイト/formations_master照合や画像参照の補助に限定。
 * - 名前に (〇〇) があるものは別バージョンとして完全に別 internal_id。
 */
(function(){
  "use strict";

  function getInternalId(hero){
    return hero?.internal_id || "";
  }

  function getExternalId(hero){
    const v = hero?.external_id || hero?.image_external_id || "";
    if(!v || v === "未確認") return "";
    return String(v).trim();
  }

  function isVariantName(name){
    return /\(.+\)|（.+）/.test(String(name || ""));
  }

  function heroIdentityKey(hero){
    return getInternalId(hero);
  }

  function heroDisplayName(hero){
    return hero?.["英傑名"] || hero?.name || "";
  }

  window.JinpoIdPolicy = {
    getInternalId,
    getExternalId,
    isVariantName,
    heroIdentityKey,
    heroDisplayName
  };
})();
