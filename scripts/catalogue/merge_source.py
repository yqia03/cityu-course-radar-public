"""Merge a complete official index with partial detail/enrichment snapshots."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--index',type=Path,required=True);p.add_argument('--details',type=Path);p.add_argument('--enrichment',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
rows=json.loads(a.index.read_text()); details={x['code']:x for x in json.loads(a.details.read_text())} if a.details and a.details.exists() else {}; enrichment=json.loads(a.enrichment.read_text()) if a.enrichment and a.enrichment.exists() else {}
out=[{**row,**details.get(row['code'],{}),**enrichment.get(row['code'],{})} for row in rows]
a.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(len(out),sum(bool(x.get('descriptionEn')) for x in out))
