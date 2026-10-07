"""GI Council segment-wise gross direct premium, FY2025-26 (provisional), parsed from scripts/gic_segment_march_2026.xlsx into src/data/gic.json."""
import openpyxl, json, re
wb = openpyxl.load_workbook('scripts/gic_segment_march_2026.xlsx', data_only=True)

KEYS = [('acko','acko-general'),('bajaj','bajaj-allianz-general'),('cholamandalam','cholamandalam-ms-general'),('generali','future-generali-general'),('go digit','go-digit-general'),('hdfc ergo general','hdfc-ergo'),
 ('hdfc ergo health','hdfc-ergo-health'),('icici lombard','icici-lombard'),('iffco','iffco-tokio'),('indusind','reliance-general'),('reliance general','reliance-general'),('kshema','kshema-general'),('liberty','liberty-general'),
 ('magma','magma-general'),('national insurance','national-insurance'),('navi','navi-general'),('new india','new-india-assurance'),('oriental','oriental-insurance'),('raheja','raheja-qbe'),('royal sundaram','royal-sundaram'),
 ('sbi general','sbi-general'),('shriram','shriram-general'),('tata aig','tata-aig'),('united india','united-india'),('universal sompo','universal-sompo'),('zuno','zuno-general'),('zurich','zurich-kotak-general'),
 ('kotak','kotak-mahindra-general'),('agriculture','agriculture-insurance-company'),('ecgc','ecgc'),('galaxy','galaxy-health'),('aditya birla','aditya-birla-health'),('care health','care-health'),('manipal','manipalcigna-health'),
 ('narayana','narayana-health'),('niva','niva-bupa'),('star health','star-health'),('reliance health','reliance-health')]
def slug(n):
    l = n.lower()
    return next((s for k, s in KEYS if k in l), None)

def read(sheet, cols):
    ws = wb[sheet]; hdr = None; out = {}; cur = None; section = None
    for r in ws.iter_rows(values_only=True):
        a = r[0]
        if a is None and hdr is None and len(r) > 2 and isinstance(r[1], str):
            hdr = [str(x).strip() if x else None for x in r]; continue
        if a is None: continue
        if isinstance(a, str) and a.strip() in ('General Insurers', 'Standalone Health Insurers', 'Specialised Insurers', 'Public Sector Insurers', 'Private Sector Insurers'): section = a.strip(); continue
        if hdr is None: continue
        if str(a).strip() == 'Previous Year':
            if cur: out[cur]['prev'] = {k: r[hdr.index(c)] for k, c in cols.items() if c in hdr}
            continue
        if isinstance(r[1], (int, float)) or isinstance(r[len(r)-1], (int, float)):
            s = slug(str(a))
            if s and not str(a).lower().startswith(('total', 'grand', 'public', 'private')):
                cur = s; out[s] = {'name': str(a).strip(), 'section': section, 'cur': {k: r[hdr.index(c)] for k, c in cols.items() if c in hdr}}
            else: cur = None
    return out

seg = read('Segmentwise Report', {'motorTotal': 'Motor Total', 'motorOD': 'Motor OD', 'motorTP': 'Motor TP', 'health': 'Health', 'pa': 'P.A.', 'total': 'Grand Total'})
hp = read('Health Portfolio', {'retail': 'Health-Retail', 'group': 'Health-Group', 'govt': 'Health-Government schemes', 'overseas': 'Overseas Medical', 'total': 'Grand Total'})
r = lambda x: round(x, 2) if isinstance(x, (int, float)) else None
out = {'source': 'General Insurance Council, Gross Direct Premium Income underwritten by non-life insurers within India (segment wise), April 2025–March 2026 (provisional & unaudited), ₹ crore. gicouncil.in/segmentwise-report', 'period': 'FY2025-26', 'prevPeriod': 'FY2024-25', 'insurers': {}}
for s, d in seg.items():
    row = {'name': d['name'], 'section': d['section'], 'motor': {k: r(v) for k, v in d['cur'].items()}, 'motorPrev': {k: r(v) for k, v in d.get('prev', {}).items()}}
    if s in hp: row['healthSplit'] = {k: r(v) for k, v in hp[s]['cur'].items()}
    out['insurers'][s] = row
tot_motor = sum((v['motor'].get('motorTotal') or 0) for v in out['insurers'].values())
for v in out['insurers'].values(): v['motorShare'] = round((v['motor'].get('motorTotal') or 0) / tot_motor * 100, 2) if tot_motor else None
out['totals'] = {'motorTotal': round(tot_motor, 1)}
json.dump(out, open('src/data/gic.json', 'w'), ensure_ascii=False, indent=1)
print(len(out['insurers']), 'insurers; total motor ₹cr', round(tot_motor))
for s, v in sorted(out['insurers'].items(), key=lambda x: -(x[1]['motor'].get('motorTotal') or 0))[:14]:
    print(f"  {s:28s} motor ₹{v['motor']['motorTotal']:>9,.0f} cr  share {v['motorShare']:5.2f}%  OD {v['motor']['motorOD']:>8,.0f}  TP {v['motor']['motorTP']:>8,.0f}")
