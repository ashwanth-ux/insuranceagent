"""IRDAI Handbook on Indian Insurance Statistics 2024-25 (Part I and Part II) → src/data/irdai-handbook.json
Tables used: 10 (individual policies in force), 18 (duration-wise settlement of individual death claims), 53 (status of claims, general and health).
Usage: python3 scripts/build-handbook.py "<dir containing Part I.xlsx and Part II.xlsx>" """
import openpyxl, json, re, sys
D = sys.argv[1] if len(sys.argv) > 1 else '.'
LIFE_KEYS = [('lic','lic'),('acko','acko-life'),('aditya birla','aditya-birla-sun-life'),('sunlife','aditya-birla-sun-life'),('bandhan','bandhan-life'),('aegas','ageas-federal-life'),('ageas','ageas-federal-life'),('aviva','aviva-life'),
 ('bajaj','bajaj-allianz-life'),('bharti','bharti-axa-life'),('credit','creditaccess-life'),('canara','canara-hsbc-life'),('edelweiss','edelweiss-life'),('future','future-generali-life'),('generali','future-generali-life'),
 ('godigit','go-digit-life'),('go digit','go-digit-life'),('hdfc','hdfc-life'),('icici','icici-prudential-life'),('indiafirst','indiafirst-life'),('kotak','kotak-life'),('axis max','axis-max-life'),('max life','axis-max-life'),
 ('pnb','pnb-metlife'),('pramerica','pramerica-life'),('reliance','reliance-nippon-life'),('sahara','sahara-life'),('sbi','sbi-life'),('shriram','shriram-life'),('star union','star-union-dai-ichi-life'),('tata','tata-aia-life'),('exide','exide-life')]
GEN_KEYS = [('national insurance','national-insurance'),('new india','new-india-assurance'),('oriental','oriental-insurance'),('united india','united-india'),('acko','acko-general'),('bajaj','bajaj-allianz-general'),
 ('bharti','bharti-axa-general'),('cholamandalam','cholamandalam-ms-general'),('future generali','future-generali-general'),('go digit','go-digit-general'),('hdfc ergo','hdfc-ergo'),('icici','icici-lombard'),('iffco','iffco-tokio'),
 ('zurich kotak','zurich-kotak-general'),('kshema','kshema-general'),('liberty','liberty-general'),('magma','magma-general'),('navi','navi-general'),('raheja','raheja-qbe'),('reliance general','reliance-general'),
 ('royal sundaram','royal-sundaram'),('sbi general','sbi-general'),('shriram','shriram-general'),('tata aig','tata-aig'),('universal sompo','universal-sompo'),('zuno','zuno-general'),('agriculture','agriculture-insurance-company'),('ecgc','ecgc'),
 ('aditya birla health','aditya-birla-health'),('care health','care-health'),('galaxy','galaxy-health'),('manipalcigna','manipalcigna-health'),('narayana','narayana-health'),('niva bupa','niva-bupa'),('reliance health','reliance-health'),('star health','star-health')]
def slug(name, keys):
    l = re.sub(r'\s+', ' ', str(name).lower()).strip()
    return next((s for k, s in keys if k in l), None)
num = lambda x: x if isinstance(x, (int, float)) else None
def blocks(hdr, keys, total_labels=('private total','grand total','total')):
    """Insurer blocks in a wide table: returns [(slug, start_col, end_col)] from the names row."""
    idx = [(j, c) for j, c in enumerate(hdr) if j > 0 and c not in (None, '')]
    out = []
    for n, (j, c) in enumerate(idx):
        end = idx[n+1][0] if n+1 < len(idx) else len(hdr)
        s = slug(c, keys)
        if s: out.append((s, j, end))
    return out

out = {'source': 'IRDAI Handbook on Indian Insurance Statistics 2024-25 (published 3 Feb 2026), Part I tables 10 and 18, Part II table 53', 'table10': {}, 'table18': {}, 'table53': {}}

# ---- Table 18: duration-wise settlement of individual death claims
ws = openpyxl.load_workbook(f'{D}/Part I.xlsx', data_only=True)['18']
R = [list(r) for r in ws.iter_rows(values_only=True)]
hdr = R[2]; years_row = R[3]
lab = lambda r: str(r[0] or '').strip().lower()
num_rows = {}; amt_rows = {}
section = 'num'
for i, r in enumerate(R):
    l = lab(r)
    if 'benefit amount' in l: section = 'amt'
    if l.startswith('within 30'): (num_rows if section == 'num' else amt_rows)['w30'] = i
    if l.startswith('total claims settled'): (num_rows if section == 'num' else amt_rows)['tot'] = i
for s, a, b in blocks(hdr, LIFE_KEYS):
    d = {}
    for j in range(a, b):
        y = years_row[j]
        if not isinstance(y, str) or not re.match(r'20\d\d-\d\d', y): continue
        wn, tn, wa, ta = num(R[num_rows['w30']][j]), num(R[num_rows['tot']][j]), num(R[amt_rows['w30']][j]), num(R[amt_rows['tot']][j])
        if tn:
            d[y] = {'within30Num': wn, 'totalNum': tn, 'within30Amt': wa, 'totalAmt': ta, 'pct30Num': round(100 * wn / tn, 2) if wn is not None else None, 'pct30Amt': round(100 * wa / ta, 2) if (wa is not None and ta) else None}
    if d: out['table18'][s] = d

# ---- Table 10: individual policies in force at year end (thousands), grand total row
ws = openpyxl.load_workbook(f'{D}/Part I.xlsx', data_only=True)['10']
R = [list(r) for r in ws.iter_rows(values_only=True)]
hdr = R[2]; years_row = R[3]
gt = next(i for i, r in enumerate(R) if str(r[0] or '').lower().startswith('business in force at end of the financial year = a+b'))
for s, a, b in blocks(hdr, LIFE_KEYS):
    d = {}
    for j in range(a, b):
        y = years_row[j]
        v = num(R[gt][j])
        if isinstance(y, str) and re.match(r'20\d\d-\d\d', y) and v is not None: d[y] = round(v, 2)
    if d: out['table10'][s] = d

# ---- Table 53: status of claims, general and health insurers
ws = openpyxl.load_workbook(f'{D}/Part II.xlsx', data_only=True)['53']
R = [list(r) for r in ws.iter_rows(values_only=True)]
yr = {j: c for j, c in enumerate(R[1]) if isinstance(c, str) and re.match(r'20\d\d-\d\d', c)}
FIELDS = ['osStart', 'intimated', 'paid', 'repudiated', 'closed', 'osEnd', 'lt3m', 'm3to6', 'm6to12', 'y1to3', 'y3to5', 'y5plus']
for r in R[4:]:
    if not isinstance(r[1], str): continue
    s = slug(r[1], GEN_KEYS)
    if not s or isinstance(r[0], str): continue
    d = {}
    for j, y in yr.items():
        vals = [num(r[j + k]) for k in range(12)]
        if vals[2] is None: continue
        rec = dict(zip(FIELDS, vals))
        # Quirk: for FY2023-24 the age analysis of standalone health insurers is reported as claim COUNTS, not percentages.
        # Convert counts to a share of claims paid. Ignore insurers with under 1,000 claims, where a percentage is noise.
        ages = ['lt3m', 'm3to6', 'm6to12', 'y1to3', 'y3to5', 'y5plus']
        paid = rec['paid'] or 0
        if paid < 1000:
            for k in ages: rec[k] = None
        elif any((rec[k] or 0) > 100 for k in ages):
            for k in ages: rec[k] = round(100 * rec[k] / paid, 4) if rec[k] is not None else None
            rec['ageFromCounts'] = True
        decided = (rec['paid'] or 0) + (rec['repudiated'] or 0)
        rec['paidShareOfDecided'] = round(100 * rec['paid'] / decided, 2) if decided else None
        d[y] = rec
    if d: out['table53'][s] = d
json.dump(out, open('src/data/irdai-handbook.json', 'w'), ensure_ascii=False)
print({k: len(v) for k, v in out.items() if isinstance(v, dict)})
