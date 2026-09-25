#!/usr/bin/env python3
"""Merge official HTML records with verified PDF and editorial-summary fallbacks."""
import argparse,json,hashlib
from collections import Counter
from pathlib import Path
from import_cityu import atomic_json,parse

def main():
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('--directory',type=Path,default=Path(__file__).parent); a=ap.parse_args(); root=a.directory
    courses=json.loads((root/'courses-official.json').read_text())
    report=json.loads((root/'import-report.json').read_text())
    academic_year=Counter(c['academicYear'] for c in courses if c['academicYear']!='current').most_common(1)[0][0]
    year_segment='/'+academic_year.replace('/','')+'/'
    enrich={}
    for filename in ('description-enrichment.json','summary-overrides.json','course-overrides.json'):
        path=root/filename
        if path.exists(): enrich.update(json.loads(path.read_text()))
    skipped=[]
    index={c['code']:c for c in json.loads((root/'courses-index.json').read_text())}
    if len(courses)!=len(index) or {c['code'] for c in courses}!=set(index):
        raise ValueError('Refusing to finalize a partial or duplicate catalogue: detail codes must match the full index.')
    for c in courses:
        original=index[c['code']]
        c['department']=original['department']
        if 'departments' not in c:
            cached=root/'cache'/(hashlib.sha256(original['sourceUrl'].encode()).hexdigest()+'.html')
            if cached.exists():
                p=parse(cached.read_text())
                c['departmentText']=p.fields.get('div_offering_dept') or c['department']
                c['departments']=p.fieldLines.get('div_offering_dept') or [c['department']]
            else:
                c['departments']=[c['department']]
                c['departmentText']=c['department']
        if c.get('descriptionEn'):
            c['descriptionSource']='official-catalogue-html'; c['descriptionSourceUrl']=c['sourceUrl']
        elif c['code'] in enrich:
            override=enrich[c['code']]
            if year_segment not in override.get('descriptionSourceUrl',''):
                skipped.append(c['code']); continue
            c.update(override)
    report.update({
        'primaryDepartments':len({c['department'] for c in courses}),
        'departments':dict(Counter(c['department'] for c in courses)),
        'jointlyOfferedCourses':[c['code'] for c in courses if len(c['departments'])>1],
        'withDescriptionAfterPdfFallback':sum(bool(c['descriptionEn']) for c in courses),
        'pdfDescriptions':sum(c.get('descriptionSource')=='official-syllabus-pdf' for c in courses),
        'editorialSyllabusSummaries':sum(c.get('descriptionSource')=='editorial-summary-of-official-syllabus' for c in courses),
        'recoveredDetailCodes':[c['code'] for c in courses if c['dataStatus']=='official-syllabus'],
        'unresolvedDetailFailures':[c['code'] for c in courses if c['dataStatus']=='index-only'],
        'missingDescriptionCodes':[c['code'] for c in courses if not c['descriptionEn']],
        'skippedOverridesFromDifferentYear':skipped,
        'variableCreditCourses':[{'code':c['code'],'creditsText':c.get('creditsText')} for c in courses if c['credits'] is None],
    })
    atomic_json(root/'courses-complete.json',courses); atomic_json(root/'import-report.json',report)
    print(json.dumps({k:v for k,v in report.items() if k not in ('departments','failures')},ensure_ascii=False,indent=2))
if __name__=='__main__': main()
