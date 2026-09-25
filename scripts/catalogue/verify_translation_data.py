#!/usr/bin/env python3
"""Check a translated catalogue's coverage and preservation of official fields."""
import argparse,json,re
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__); p.add_argument('--source',type=Path,required=True); p.add_argument('--translated',type=Path,required=True);p.add_argument('--departments',type=Path);a=p.parse_args()
sources=json.loads(a.source.read_text()); translated=json.loads(a.translated.read_text())
assert len({x['code'] for x in sources}) == len(sources), 'Duplicate source codes'
assert len({x['code'] for x in translated}) == len(translated), 'Duplicate translated codes'
by_code={x['code']:x for x in translated}
assert set(by_code) == {x['code'] for x in sources}, 'Source and translated course code sets differ'
for source in sources:
 target=by_code[source['code']]
 for key in ('titleEn','descriptionEn','sourceUrl','department','credits','academicYear'):
  assert source.get(key)==target.get(key), f"{source['code']}: source field changed: {key}"
 for key in ('titleZhHans','titleZhHant'):
  assert target.get(key) and re.search(r'[\u3400-\u9fff]',target[key]), f"{source['code']}: missing Chinese title: {key}"
 suffix=re.search(r'\s+([IVX]{1,5})$',source['titleEn'])
 if suffix:
  for key in ('titleZhHans','titleZhHant'): assert target[key].endswith(' '+suffix.group(1)), f"{source['code']}: sequence number changed"
 if source.get('descriptionEn'):
  for key in ('descriptionZhHans','descriptionZhHant'):
   assert target.get(key) and re.search(r'[\u3400-\u9fff]',target[key]), f"{source['code']}: missing Chinese description: {key}"
  normalized_source=re.sub(r'\s+',' ',source['descriptionEn']).strip()
  assert normalized_source.startswith(target['descriptionSummaryEn'].rstrip('…')), f"{source['code']}: English summary is not a source excerpt"
 else:
  assert target['descriptionZhHans'] is None and target['descriptionZhHant'] is None, f"{source['code']}: invented description"
 assert target['translation']['reviewStatus']=='needs-human-review', f"{source['code']}: unexpected review claim"
if a.departments:
 departments=json.loads(a.departments.read_text())
 assert set(departments)=={x['department'] for x in sources}, 'Department dictionary coverage differs'
print(json.dumps({'courses':len(translated),'sourceFieldsPreserved':True,'codeSetPreserved':True,'courseSequenceNumbersPreserved':True,'titlesCovered':len(translated),'descriptionsCovered':sum(bool(x.get('descriptionEn')) for x in sources),'sourceExcerptIntegrity':True},indent=2))
