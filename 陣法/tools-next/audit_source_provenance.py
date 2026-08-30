#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source-next' / '英傑一覧.csv'
REPORT_DIR = ROOT / '_jinpo-next-report'
REPORT = REPORT_DIR / 'source_provenance_report.json'

PROVENANCE_FIELDS = [
    '因子確認状態','因子確認日','因子1出典','因子2出典','因子3出典','因子4出典',
    '能力値確認状態','能力値確認日','能力値出典','確認メモ',
]
FACTOR_SOURCE_FIELDS = ['因子1出典','因子2出典','因子3出典','因子4出典']
ALLOWED_STATUS = {'', '未確認', '暫定', '確認済'}


def fail(message: str, details: list[dict] | None = None) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({
        'status': 'FAIL',
        'error': message,
        'details': details or [],
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    raise RuntimeError(message)


def parse_date(value: str, row_label: str, field: str) -> None:
    if not value:
        return
    try:
        date.fromisoformat(value)
    except ValueError:
        fail(f'{row_label}: {field} は YYYY-MM-DD 形式で入力してください: {value}')


def main() -> None:
    if not SOURCE.exists():
        fail('source-next/英傑一覧.csv がありません')
    raw = SOURCE.read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError as e:
        fail(f'英傑一覧.csvをUTF-8で読めません: {e}')
    if '\ufffd' in text:
        fail('英傑一覧.csvに置換文字U+FFFDを検出')

    reader = csv.DictReader(text.splitlines())
    headers = list(reader.fieldnames or [])
    missing = [x for x in PROVENANCE_FIELDS if x not in headers]
    if missing:
        fail('英傑一覧.csvの出典管理列が不足: ' + ', '.join(missing))

    rows = list(reader)
    errors: list[dict] = []
    counts = {'確認済': 0, '暫定': 0, '未確認': 0, '空欄': 0}
    ability_counts = {'確認済': 0, '暫定': 0, '未確認': 0, '空欄': 0}

    for row in rows:
        no = str(row.get('番号','')).strip()
        name = str(row.get('名前','')).strip()
        label = f'番号{no} {name}'
        factor_status = str(row.get('因子確認状態','')).strip()
        factor_date = str(row.get('因子確認日','')).strip()
        factor_sources = [str(row.get(k,'')).strip() for k in FACTOR_SOURCE_FIELDS]
        ability_status = str(row.get('能力値確認状態','')).strip()
        ability_date = str(row.get('能力値確認日','')).strip()
        ability_source = str(row.get('能力値出典','')).strip()

        if factor_status not in ALLOWED_STATUS:
            errors.append({'row': label, 'field': '因子確認状態', 'value': factor_status, 'error': '許可されない状態'})
        if ability_status not in ALLOWED_STATUS:
            errors.append({'row': label, 'field': '能力値確認状態', 'value': ability_status, 'error': '許可されない状態'})
        try:
            parse_date(factor_date, label, '因子確認日')
            parse_date(ability_date, label, '能力値確認日')
        except RuntimeError:
            raise

        if factor_status in {'暫定','確認済'} and not factor_date:
            errors.append({'row': label, 'field': '因子確認日', 'error': f'{factor_status}なのに確認日が空'})
        if any(factor_sources) and factor_status not in {'暫定','確認済'}:
            errors.append({'row': label, 'field': '因子確認状態', 'error': '因子出典がある場合は暫定または確認済が必要'})
        if factor_status == '未確認' and factor_date:
            errors.append({'row': label, 'field': '因子確認日', 'error': '未確認なのに確認日が入っています'})
        if factor_status == '確認済' and not all(factor_sources):
            errors.append({'row': label, 'field': '因子1～4出典', 'error': '確認済は4スロットすべての出典が必要（空因子の確認も含む）'})
        if factor_status == '暫定' and not any(factor_sources):
            errors.append({'row': label, 'field': '因子1～4出典', 'error': '暫定は少なくとも1スロットの出典が必要'})

        if ability_status in {'暫定','確認済'} and not ability_date:
            errors.append({'row': label, 'field': '能力値確認日', 'error': f'{ability_status}なのに確認日が空'})
        if ability_source and ability_status not in {'暫定','確認済'}:
            errors.append({'row': label, 'field': '能力値確認状態', 'error': '能力値出典がある場合は暫定または確認済が必要'})
        if ability_status == '未確認' and ability_date:
            errors.append({'row': label, 'field': '能力値確認日', 'error': '未確認なのに確認日が入っています'})
        if ability_status in {'暫定','確認済'} and not ability_source:
            errors.append({'row': label, 'field': '能力値出典', 'error': f'{ability_status}なのに出典が空'})

        factor_bucket = factor_status if factor_status in {'確認済','暫定','未確認'} else '空欄'
        ability_bucket = ability_status if ability_status in {'確認済','暫定','未確認'} else '空欄'
        counts[factor_bucket] += 1
        ability_counts[ability_bucket] += 1

    if errors:
        fail(f'出典管理監査で{len(errors)}件の不整合を検出', errors[:50])

    report = {
        'status': 'PASS',
        'rows': len(rows),
        'factor_provenance': counts,
        'ability_provenance': ability_counts,
        'schema_fields': PROVENANCE_FIELDS,
        'note': '出典管理列は研究用メタデータで、検索DB計算入力には使用しない。',
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERROR:', e, file=sys.stderr)
        raise SystemExit(1)
