#!/usr/bin/env python3
"""Validate a complete translated candidate and promote a concise, archival snapshot."""
import argparse
import hashlib
import json
from pathlib import Path
from import_cityu import atomic_json


def promote(rows, report, previous):
    expected = report['uniqueCourses']
    if len(rows) != expected or len({r['code'] for r in rows}) != expected:
        raise ValueError('Candidate does not match the complete official index')
    if report.get('unresolvedDetailFailures') or report.get('missingDescriptionCodes'):
        raise ValueError('Resolve source failures before promoting')
    result = []
    for row in rows:
        for field in ('titleEn', 'titleZhHans', 'titleZhHant', 'descriptionEn', 'descriptionZhHans', 'descriptionZhHant', 'descriptionSummaryEn', 'sourceUrl'):
            if not row.get(field):
                raise ValueError(f"{row['code']}: missing {field}")
        # Ship a bounded English extract, not a copy of the full syllabus/abstract.
        # The raw source stays in the ignored import cache; its hash remains auditable.
        item = dict(row)
        item['sourceDescriptionSha256'] = hashlib.sha256(row['descriptionEn'].encode()).hexdigest()
        item['descriptionEn'] = row['descriptionSummaryEn']
        item.pop('descriptionSummaryEn', None)
        item['descriptionIsExcerpt'] = True
        item['archived'] = False
        result.append(item)
    current_codes = {r['code'] for r in rows}
    archived = [{**r, 'archived': True} for r in previous if r['code'] not in current_codes]
    result.extend(archived)
    return sorted(result, key=lambda r: r['code']), len(archived)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('data/courses.json'))
    args = parser.parse_args()
    rows = json.loads(args.input.read_text())
    report = json.loads(args.report.read_text())
    previous = json.loads(args.output.read_text()) if args.output.exists() else []
    output, archived = promote(rows, report, previous)
    atomic_json(args.output, output)
    print(json.dumps({'current': len(rows), 'archived': archived, 'total': len(output), 'englishExcerptPolicy': 'First source sentence, at most 600 characters', 'sha256': hashlib.sha256(args.output.read_bytes()).hexdigest()}))


if __name__ == '__main__':
    main()
