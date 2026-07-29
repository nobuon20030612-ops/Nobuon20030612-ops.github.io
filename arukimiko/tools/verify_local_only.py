from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SELF = Path(__file__).resolve()
brand = ''.join(chr(x) for x in (103, 101, 109, 105, 110, 105))
brain_file = '-'.join(('jinpo', 'bot', 'ai', 'brain')) + '.js'
config_file = '-'.join(('jinpo', 'bot', 'ai', 'config')) + '.js'
brain_global = '_'.join(('JINPO', 'BOT', 'AI', 'BRAIN'))

banned_names = {brain_file, config_file}
banned_tokens = [
    brand,
    'firebase-' + 'ai.js',
    'get' + 'GenerativeModel',
    'Function' + 'CallingMode',
    brain_global,
    '高性能' + 'AI',
    'AI' + '診断',
]
issues = []
for p in ROOT.rglob('*'):
    if not p.is_file() or p.resolve() == SELF:
        continue
    rel = p.relative_to(ROOT).as_posix()
    if p.name in banned_names:
        issues.append(f'forbidden file: {rel}')
        continue
    if p.suffix.lower() not in {'.js', '.css', '.html', '.txt', '.json'}:
        continue
    text = p.read_text(encoding='utf-8', errors='ignore')
    for token in banned_tokens:
        if token in text:
            issues.append(f'forbidden token {token!r}: {rel}')
if issues:
    print('LOCAL-ONLY CHECK: FAIL')
    print('\n'.join(issues))
    sys.exit(1)
print('LOCAL-ONLY CHECK: PASS')
