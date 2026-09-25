#!/usr/bin/env python3
"""Import the public CityUHK catalogue. Standard library only; cache + retry + throttling.
Usage: python3 import_cityu.py --output-dir ./cityu-data [--index-only] [--delay 0.35]
Current catalogue rolls forward; use --year 202627 for an immutable academic-year URL.
"""
import argparse, concurrent.futures, hashlib, html, json, os, re, subprocess, threading, time
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.department=''; self.head=None; self.anchor=None; self.courses=[]
        self.divstack=[]; self.fields={}; self.fieldLines={}; self.texts=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('h1','h2'):
            self.head={'tag':tag,'class':a.get('class',''),'parts':[]}
        if tag=='a': self.anchor={'href':a.get('href',''),'parts':[]}
        if tag=='div': self.divstack.append({'id':a.get('id'),'parts':[]})
        if tag in ('p','br','li','tr'):
            for d in self.divstack: d['parts'].append('\n')
    def handle_data(self,data):
        self.texts.append(data)
        if self.head: self.head['parts'].append(data)
        if self.anchor: self.anchor['parts'].append(data)
        for d in self.divstack: d['parts'].append(data)
    def handle_endtag(self,tag):
        if self.head and tag==self.head['tag']:
            if 'head' in self.head['class'].split() and 'd_' in self.head['class']:
                self.department=clean(''.join(self.head['parts']))
            self.head=None
        if tag=='a' and self.anchor:
            a=self.anchor
            m=re.search(r'(?:^|/)course/([A-Z0-9]+)\.htm$',a['href'],re.I)
            if m:
                code=m.group(1).upper(); label=clean(''.join(a['parts']))
                title=re.sub(r'^'+re.escape(code)+r'\s*[-–:]?\s*','',label)
                self.courses.append({'code':code,'titleEn':title,'department':self.department,'href':a['href']})
            self.anchor=None
        if tag=='div' and self.divstack:
            d=self.divstack.pop()
            if d['id']:
                self.fields[d['id']]=clean(''.join(d['parts']))
                self.fieldLines[d['id']]=[clean(x) for x in ''.join(d['parts']).split('\n') if clean(x)]

def clean(s): return re.sub(r'\s+',' ',html.unescape(s)).strip()
def parse(s):
    p=Extractor(); p.feed(s); return p

def atomic_json(path,value):
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temp.replace(path)

class Fetcher:
    def __init__(self,cache,delay):
        self.cache=cache; cache.mkdir(parents=True,exist_ok=True)
        self.delay=delay; self.lock=threading.Lock(); self.last=0; self.requests=0
    def get(self,url):
        path=self.cache/(hashlib.sha256(url.encode()).hexdigest()+'.html')
        if path.exists(): return path.read_text(encoding='utf-8')
        for attempt in range(4):
            with self.lock:
                wait=self.delay-(time.monotonic()-self.last)
                if wait>0: time.sleep(wait)
                self.last=time.monotonic(); self.requests+=1
            proc=subprocess.run(['curl','--fail','--location','--silent','--show-error','--max-time','30','--user-agent','CityUCourseCommunity/1.0 (public academic catalogue import)',url],capture_output=True)
            if proc.returncode==0:
                body=proc.stdout.decode('utf-8',errors='replace')
                path.write_text(body,encoding='utf-8'); return body
            if attempt==3: raise RuntimeError(proc.stderr.decode(errors='replace').strip())
            time.sleep(min(2**(attempt+1),12))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output-dir',type=Path,default=Path(__file__).parent)
    ap.add_argument('--index-only',action='store_true')
    ap.add_argument('--delay',type=float,default=0.35)
    ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--year',default='current')
    args=ap.parse_args(); out=args.output_dir; out.mkdir(parents=True,exist_ok=True)
    fetch=Fetcher(out/'cache',args.delay)
    roots={'ug':f'https://www.cityu.edu.hk/catalogue/ug/{args.year}/catalogue/B/B_course_index_full.htm', 'pg':f'https://www.cityu.edu.hk/catalogue/pg/{args.year}/catalogue/TP/TP_course_index_full.htm'}
    allcourses={}; counts={}; rawcounts={}; generated={}; failures=[]
    for level,url in roots.items():
        source=fetch.get(url)
        p=parse(source)
        courses={}
        for c in p.courses:
            if c['code'] in courses: continue
            c['sourceUrl']=urljoin(url,c.pop('href')); c['level']=level; c['levels']=[level]
            c['credits']=None; c['descriptionEn']=None; c['academicYear']=args.year
            courses[c['code']]=c
        rawcounts[level]=len(p.courses); counts[level]=len(courses)
        stamp=re.search(r'generated on ([^<]+) -->',source)
        generated[level]=stamp.group(1) if stamp else None
        if len(courses)<500: raise RuntimeError(f'Suspiciously small {level} index ({len(courses)}). Refusing incomplete import.')
        for code,c in courses.items():
            if code in allcourses:
                allcourses[code]['levels'].append(level)
                allcourses[code].setdefault('alternateSourceUrls',[]).append(c['sourceUrl'])
            else: allcourses[code]=c
    courses=sorted(allcourses.values(),key=lambda c:c['code'])
    # Infer fixed academic year only from a fetched page's official year-labelled PDF links later.
    atomic_json(out/'courses-index.json',courses)
    print(json.dumps({'stage':'index','counts':counts,'uniqueCourses':len(courses),'output':str(out/'courses-index.json')},ensure_ascii=False),flush=True)
    report={'fetchedAt':datetime.now(timezone.utc).isoformat(),'sources':roots,'sourceGeneratedAt':generated,'indexLinks':rawcounts,'uniquePerCatalogue':counts,'uniqueCourses':len(courses),'gatewayEducationCourses':sum(c['code'].startswith('GE') for c in courses),'crossLevelCourses':sum(len(c['levels'])>1 for c in courses),'scope':'All unique course codes listed in current public undergraduate and postgraduate course indices; this is not a guarantee every listed course is offered this term. Masters, professional doctorate and research full indices were identical in the 2026/27 snapshot.','failures':failures}
    atomic_json(out/'import-report.json',report)
    if args.index_only: return
    done=0
    def detail(c):
        c=dict(c)
        try:
            source=fetch.get(c['sourceUrl']); p=parse(source); f=p.fields
            if not f.get('div_course_code_and_title'): raise RuntimeError('Expected course title field missing')
            c['titleEn']=re.sub(r'^'+re.escape(c['code'])+r'\s*[-–:]?\s*','',f['div_course_code_and_title'])
            c['departmentText']=f.get('div_offering_dept') or c['department']
            c['departments']=p.fieldLines.get('div_offering_dept') or [c['department']]
            c['creditsText']=f.get('div_course_credits')
            try: c['credits']=float(c['creditsText'])
            except (TypeError,ValueError): c['credits']=None
            if c['credits'] is not None and c['credits'].is_integer(): c['credits']=int(c['credits'])
            c['descriptionEn']=f.get('div_course_aims') or None
            c['offeringTerm']=f.get('div_course_offering_term') or None
            c['duration']=f.get('div_course_duration') or None
            c['assessmentCoursework']=f.get('div_assessment_coursework_pct') or None
            c['assessmentExam']=f.get('div_assessment_exam_pct') or None
            pdf=re.search(r'href=[\"\'](https?://[^\"\']*/([0-9]{6})/course/'+re.escape(c['code'])+r'\.pdf)[\"\']',source,re.I)
            if pdf:
                c['syllabusUrl']=pdf.group(1).replace('http:','https:'); year=pdf.group(2); c['academicYear']=year[:4]+'/'+year[4:]
                c['sourceUrl']=c['sourceUrl'].replace('/current/','/'+year+'/')
            c['dataStatus']='official'
        except Exception as e:
            c['dataStatus']='index-only'; failures.append({'code':c['code'],'error':str(e)})
        return c
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for c in pool.map(detail,courses):
            results.append(c); done+=1
            if done%100==0:
                atomic_json(out/'courses-progress.json',results)
                print(json.dumps({'stage':'details','completed':done,'total':len(courses),'failures':len(failures),'networkRequests':fetch.requests}),flush=True)
    results.sort(key=lambda c:c['code'])
    atomic_json(out/'courses-official.json',results)
    report.update({'detailsSucceeded':sum(c['dataStatus']=='official' for c in results),'withDescription':sum(bool(c['descriptionEn']) for c in results),'withCredits':sum(c['credits'] is not None for c in results),'departments':dict(Counter(c['department'] for c in results)),'finishedAt':datetime.now(timezone.utc).isoformat()})
    atomic_json(out/'import-report.json',report)
    print(json.dumps(report,ensure_ascii=False),flush=True)
if __name__=='__main__': main()
