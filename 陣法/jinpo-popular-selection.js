(function(){
  'use strict';
  if(window.JINPO_POPULAR_SELECTION) return;
  var selectedIds=[
    'EIK_0253','EIK_0230','EIK_0188','EIK_0083','EIK_0198','EIK_0082','EIK_0242','EIK_0215','EIK_0241','EIK_0245',
    'EIK_0084','EIK_0099','EIK_0104','EIK_0073','EIK_0107','EIK_0081','EIK_0258','EIK_0207','EIK_0187','EIK_0068'
  ];
  var selectedIdSet=new Set(selectedIds);
  function internalId(hero){return String(hero&&(hero.internal_id||hero.id||hero.ID||hero['internal_id'])||'').trim();}
  function cost(hero){var v=Number(hero&&(hero['コスト']!==undefined?hero['コスト']:hero.cost));return Number.isFinite(v)?v:999;}
  function isSelectedHero(hero){return selectedIdSet.has(internalId(hero));}
  function isPopularHero(hero){return !!hero&&(cost(hero)<=6||isSelectedHero(hero));}
  window.JINPO_POPULAR_SELECTION={
    schema:'jinpo-popular-selection/v1',
    searchCounts:[6,7,8,9],
    selectedIds:selectedIds.slice(),
    selectedIdSet:selectedIdSet,
    internalId:internalId,
    cost:cost,
    isSelectedHero:isSelectedHero,
    isPopularHero:isPopularHero
  };
})();
