from pathlib import Path
import json,sys,re
from playwright.sync_api import sync_playwright
root=Path('/mnt/data/arukimiko_stage13z9_work/歩き巫女_v3.69.0実Bot演出適合統合候補_stage13Z9')
bot=root/'arukimiko'
out=root/'reports'/'stage13z9_browser_integration.json'
loader=(bot/'loader.js').read_text(encoding='utf-8')
def arr(name):
    m=re.search(r'var\s+'+name+r'=\[(.*?)\];',loader,re.S)
    return re.findall(r"'([^']+\.js)'",m.group(1))
visual=arr('visualScripts'); common=arr('coreCommon'); jinpo=arr('coreJinpo'); tail=arr('coreTail')
m=re.search(r'var\s+lazyGroups=\{(.*?)\n\s*\};',loader,re.S)
lazy=[]
for key,body in re.findall(r'(\w+):\[(.*?)\](?:,|$)',m.group(1),re.S):
    if key!='firebase': lazy += re.findall(r"'([^']+\.js)'",body)
# De-duplicate preserving order.
seq=[]
for name in visual+common+jinpo+lazy+tail:
    if name not in seq: seq.append(name)
checks=[];console=[];errors=[]
def ck(name,ok,detail=''): checks.append({'name':name,'ok':bool(ok),'detail':detail})
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.on('console',lambda m: console.append({'type':m.type,'text':m.text}))
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.set_content('<!doctype html><html><head></head><body><main id="site">Stage13Z9 isolated exact-source browser audit</main></body></html>',wait_until='domcontentloaded')
    # Exact CSS content.
    for cssname in ['jinpo-ai-chat.css','jinpo-bot-adv-theme.css','arukimiko-expression-runtime-stage13z9.css']:
        page.add_style_tag(content=(bot/cssname).read_text(encoding='utf-8'))
    page.add_script_tag(content="""
      window.JINPO_BOT_BASE_URL='https://local.invalid/arukimiko/';
      window.JINPO_BOT_PAGE_MODE='top';
      window.JINPO_BOT_DISABLE_JINPO_GUIDE=true;
      window.ARUKIMIKO_SHARED={version:'3.69.0-local-only',baseUrl:window.JINPO_BOT_BASE_URL,pageMode:'top',loading:true,ready:false,uiReady:false};
      window.ARUKIMIKO_LOAD_METRICS={version:'3.69.0',mode:'top'};
    """)
    for name in seq:
        page.add_script_tag(content=(bot/name).read_text(encoding='utf-8'))
    # Simulate loader completion only after exact ordered scripts are evaluated.
    page.evaluate("""() => { ARUKIMIKO_SHARED.loading=false; ARUKIMIKO_SHARED.ready=true; ARUKIMIKO_SHARED.uiReady=true; window.dispatchEvent(new CustomEvent('arukimiko-ready',{detail:{isolatedAudit:true}})); }""")
    page.add_script_tag(content=(bot/'arukimiko-expression-runtime-stage13z9.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(bot/'arukimiko-expression-adapter-stage13z9.js').read_text(encoding='utf-8'))
    page.wait_for_function("window.JINPO_AI_CHAT && document.getElementById('jinpoAiRoot')",timeout=20000)
    page.wait_for_function("window.ARUKIMIKO_EXPRESSION_ADAPTER&&window.ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().installed",timeout=15000)
    ck('target-version',page.evaluate("ARUKIMIKO_SHARED.version==='3.69.0-local-only'"))
    ck('adapter-exact-flag',page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().verifiedAgainstExactTargetZip===true"))
    ck('target-sha-flag',page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().targetZipSha256==='c2763b849e6ad7a58bb4f5755b2025b39b2a38e08a8e0a809db79f01192d4d67'"))
    ck('transport-wrapped',page.evaluate("JINPO_AI_TRANSPORT&&JINPO_AI_TRANSPORT.__arukimikoExpressionStage13Z9===true"))
    page.evaluate("JINPO_AI_CHAT.open()")
    page.wait_for_timeout(200)
    ck('ui-open',page.locator('#jinpoAiWindow').evaluate("e=>e.classList.contains('isOpen')"))
    ck('single-face-layer',page.locator('#jinpoAiWindowCharacter .arukimikoFxFace').count()==1)
    # Real normal conversation through exact v3.69 transport.
    before=page.locator('.jinpoAiMessageRow.assistant').count()
    page.evaluate("JINPO_AI_CHAT.send('こんにちは')")
    page.wait_for_function(f"document.querySelectorAll('.jinpoAiMessageRow.assistant').length>{before}",timeout=20000)
    page.wait_for_timeout(1300)
    logs=page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.getLogs()")
    ck('normal-transport-start',any(x['type']=='transport' and x['detail'].startswith('start:') for x in logs))
    ck('normal-result-reply',any(x['type']=='transport' and 'result:reply:' in x['detail'] for x in logs),logs[-18:])
    # Same-name family then singular pronoun should ask which candidate and classify cannot.
    before=page.locator('.jinpoAiMessageRow.assistant').count()
    page.evaluate("JINPO_AI_CHAT.send('真田幸村を全部教えて')")
    page.wait_for_function(f"document.querySelectorAll('.jinpoAiMessageRow.assistant').length>{before}",timeout=30000)
    page.wait_for_timeout(1500)
    before=page.locator('.jinpoAiMessageRow.assistant').count()
    page.evaluate("JINPO_AI_CHAT.send('その人の技能は？')")
    page.wait_for_function(f"document.querySelectorAll('.jinpoAiMessageRow.assistant').length>{before}",timeout=30000)
    page.wait_for_timeout(1500)
    logs=page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.getLogs()")
    tail=logs[-40:]
    ck('same-name-not-success',not any(x['type']=='transport' and 'result:success:' in x['detail'] for x in tail),tail)
    answer=page.locator('.jinpoAiMessageRow.assistant .jinpoAiBubble').last.text_content()
    same_cannot=any(x['type']=='transport' and 'result:cannot:' in x['detail'] for x in tail)
    ck('same-name-clarification-cannot',same_cannot,{'answer':answer,'logs':tail})
    # Search-like wording through real UI: searching may appear, but result must not become success solely by search mode.
    before=page.locator('.jinpoAiMessageRow.assistant').count()
    page.evaluate("JINPO_AI_CHAT.send('最新情報を検索して')")
    page.wait_for_function(f"document.querySelectorAll('.jinpoAiMessageRow.assistant').length>{before}",timeout=30000)
    page.wait_for_timeout(1600)
    logs=page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.getLogs()")
    tail=logs[-40:]
    ck('search-state-seen',any(x['type']=='state' and x['detail']=='searching' for x in tail),tail)
    ck('search-not-success',not any(x['type']=='transport' and 'result:success:' in x['detail'] for x in tail),tail)
    # Hydrated/non-live assistant row ignored.
    page.evaluate("ARUKIMIKO_EXPRESSION_RUNTIME.play('idle')")
    page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.notify('idle')")
    # Force no active flow by allowing prior finalization then add row.
    page.wait_for_function("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().activeTransportToken===0",timeout=10000)
    before_ignored=page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().stats.historyRowsIgnored")
    page.evaluate("JINPO_AI_CHAT.addMessage('assistant','履歴復元テスト行')")
    page.wait_for_timeout(250)
    after_ignored=page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().stats.historyRowsIgnored")
    ck('history-row-ignored',after_ignored>before_ignored,{'before':before_ignored,'after':after_ignored})
    # Minimize and restore.
    page.locator('.jinpoAiHeaderMinBtn').click(); page.wait_for_timeout(700)
    ck('minimized',page.locator('#jinpoAiWindow').evaluate("e=>e.classList.contains('isMinimized')"))
    page.locator('.jinpoAiHeaderMinBtn').click(); page.wait_for_timeout(650)
    ck('restored',not page.locator('#jinpoAiWindow').evaluate("e=>e.classList.contains('isMinimized')"))
    # Transport re-assignment recovery.
    page.evaluate("window.JINPO_AI_TRANSPORT=window.JINPO_BOT_PERSONA.wrapped")
    page.evaluate("window.ARUKIMIKO_EXPRESSION_ADAPTER.refreshTransport('browser-reassign-test')")
    page.wait_for_timeout(350)
    ck('transport-rewrapped',page.evaluate("JINPO_AI_TRANSPORT.__arukimikoExpressionStage13Z9===true"))
    # Typing input notice, no duplicate layers.
    page.locator('#jinpoAiInput').fill('次の入力'); page.wait_for_timeout(260)
    ck('typing-input-notice',page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics().stats.inputNotices>0"))
    ck('single-face-layer-after-flows',page.locator('#jinpoAiWindowCharacter .arukimikoFxFace').count()==1)
    # Resize coverage.
    for w,h in [(320,568),(375,667),(768,1024),(1366,768),(1920,1080)]:
        page.set_viewport_size({'width':w,'height':h}); page.wait_for_timeout(80)
        box=page.locator('#jinpoAiWindow').bounding_box(); ck(f'resize-{w}x{h}',box is not None and box['width']>0 and box['height']>0,box)
    diag=page.evaluate("ARUKIMIKO_EXPRESSION_ADAPTER.diagnostics()")
    ck('bounded-transport-verifier',diag['transportVerifyCount']<=60,diag)
    ck('no-storage-access-flag',diag['storageAccess'] is False,diag)
    browser.close()
known=[e for e in errors if 'root is not defined' in e]
unexpected=[e for e in errors if 'root is not defined' not in e]
report={'source_sequence':seq,'checks':checks,'passed':sum(x['ok'] for x in checks),'total':len(checks),'console':console,'page_errors':errors,'known_preexisting_errors':known,'unexpected_page_errors':unexpected,'all_passed':all(x['ok'] for x in checks) and not unexpected}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':report['passed'],'total':report['total'],'known_errors':len(known),'unexpected_errors':len(unexpected),'all_passed':report['all_passed']},ensure_ascii=False))
sys.exit(0 if report['all_passed'] else 1)
