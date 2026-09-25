#!/usr/bin/env python3
"""Fill missing course descriptions from the official linked PDF syllabi.
Requires pdfplumber and pypdf (`python -m pip install pdfplumber pypdf`). Run after, or during, import_cityu.py.
Writes description-enrichment.json keyed by course code; never overwrites source data.
"""
import argparse, json, re, subprocess, time, unicodedata
from pathlib import Path
from io import BytesIO
from pypdf import PdfReader
import pdfplumber
from import_cityu import atomic_json, clean

def extract_abstract(blob,code):
    # Several CityU PDF responses contain leading blank lines that break xref offsets.
    start=blob.find(b'%PDF-')
    if start<0: raise ValueError('Official URL did not return a PDF')
    # pdfplumber reconstructs legacy law syllabi words more accurately than pypdf.
    with pdfplumber.open(BytesIO(blob[start:])) as reader:
        pages=[page.extract_text() or '' for page in reader.pages]
    # Remove running page headers such as "2         BME8121: Human Machine Interface".
    text='\n'.join(re.sub(r'^\s*\d+\s+'+re.escape(code)+r'\s*:[^\n]*\n','',p) for p in pages)
    text=unicodedata.normalize('NFKC',text)
    patterns=[r'\n\s*(?:\d+[.)]\s*)?Abstract\s*\n(.*?)(?=\n\s*(?:\d+[.)]\s*)?Course Intended Learning Outcomes)', r'\n\s*(?:\d+[.)]\s*)?Course Aims\s*\n(.*?)(?=\n\s*(?:\d+[.)]\s*)?(?:Course Intended Learning Outcomes|CILOs))']
    for pattern in patterns:
        m=re.search(pattern,text,re.S|re.I)
        if m:
            abstract=clean(m.group(1))
            if 30<len(abstract)<18000: return abstract
    raise ValueError('No unambiguous Abstract/Course Aims section found')

def main():
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('--directory',type=Path,default=Path(__file__).parent); ap.add_argument('--input',type=Path); ap.add_argument('--delay',type=float,default=1.0)
    a=ap.parse_args(); root=a.directory; source=a.input or (root/'courses-official.json' if (root/'courses-official.json').exists() else root/'courses-progress.json')
    courses=json.loads(source.read_text()); dest=root/'description-enrichment.json'; results=json.loads(dest.read_text()) if dest.exists() else {}; cache=root/'syllabi-cache'; cache.mkdir(exist_ok=True); errors=[]
    for c in courses:
        code=c['code']
        if c.get('descriptionEn') or code in results or not c.get('syllabusUrl'): continue
        path=cache/(code+'.pdf')
        try:
            if not path.exists():
                time.sleep(a.delay)
                r=subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','45','--retry','2',c['syllabusUrl']],capture_output=True)
                if r.returncode: raise RuntimeError(r.stderr.decode(errors='replace').strip())
                path.write_bytes(r.stdout)
            description=extract_abstract(path.read_bytes(),code)
            results[code]={'descriptionEn':description,'descriptionSource':'official-syllabus-pdf','descriptionSourceUrl':c['syllabusUrl']}
            atomic_json(dest,results)
            print(json.dumps({'code':code,'descriptionLength':len(description),'enriched':len(results)}),flush=True)
        except Exception as e:
            errors.append({'code':code,'sourceUrl':c['syllabusUrl'],'error':str(e)})
    atomic_json(root/'syllabi-enrichment-report.json',{'input':str(source),'enriched':len(results),'failures':errors})
    print(json.dumps({'enriched':len(results),'failures':len(errors)}),flush=True)
if __name__=='__main__': main()
