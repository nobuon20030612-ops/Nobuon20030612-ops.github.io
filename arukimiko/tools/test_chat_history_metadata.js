#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'jinpo-ai-chat.js'),'utf8');
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
check('normalize response preserves structured data',/data\s*:\s*data\.data\s*&&\s*typeof data\.data===['"]object['"]\s*\?\s*data\.data\s*:\s*null/.test(src));
check('conversation repair metadata stored',/conversationRepair\s*:\s*true[\s\S]{0,600}repairTargetDomain/.test(src));
check('conversation repair preserved query stored',/preservedQuery\s*:\s*String\(result\.data\.preservedQuery/.test(src));
check('hero refinement metadata stored',/heroRefinement\s*:\s*result\.data\.heroRefinement\s*\|\|\s*null/.test(src));
check('site condition metadata stored',/siteConditions\s*:\s*Array\.isArray\(result\.data\.siteConditions\)/.test(src));
check('known term guidance marker stored',/knownTermGuidance\s*:\s*!!result\.data\.knownTermGuidance/.test(src));
check('known term key stored',/termKey\s*:\s*String\(result\.data\.termKey/.test(src));
check('known term normalized value stored',/normalizedTerm\s*:\s*String\(result\.data\.normalizedTerm/.test(src));
check('known term approximate marker stored',/approximateTerm\s*:\s*!!result\.data\.approximateTerm/.test(src));
check('large history metadata is pruned',/function pruneHistoryMetadata\s*\(/.test(src)&&/heroRefinement/.test(src)&&/3500000/.test(src));
console.log(`CHAT HISTORY METADATA: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
