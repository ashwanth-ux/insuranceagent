"""Normalises the Ditto Data Lab tables (scraped 2026-10-05) into src/data/ditto-{term,health}.json, keyed to the Kyfr KB insurer slugs."""
import json, re, sys
SC = '/private/tmp/claude-501/-Users-macbook-Downloads/8c3efb38-f63c-4523-8484-a05cb88fc019/scratchpad/web/'

LIFE = {
 'Life Insurance Corporation of India':'lic','LIC':'lic','HDFC Life':'hdfc-life','Axis Max Life':'axis-max-life','Tata AIA Life':'tata-aia-life','Tata AIA':'tata-aia-life',
 'ICICI Prudential Life':'icici-prudential-life','ICICI Prudential':'icici-prudential-life','SBI Life':'sbi-life','Bajaj Life':'bajaj-allianz-life','Bajaj Allianz Life':'bajaj-allianz-life',
 'Canara HSBC Life':'canara-hsbc-life','PNB MetLife':'pnb-metlife','PNB Metlife':'pnb-metlife','Bandhan Life':'bandhan-life','Aditya Birla Sun Life':'aditya-birla-sun-life',
 'Kotak Mahindra Life':'kotak-life','Kotak Life':'kotak-life','Reliance Nippon Life':'reliance-nippon-life','Star Union Dai-ichi':'star-union-dai-ichi-life','Star Union Dai-ichi Life':'star-union-dai-ichi-life',
 'Pramerica Life':'pramerica-life','Aviva Life':'aviva-life','Shriram Life':'shriram-life','IndiaFirst Life':'indiafirst-life','Bharti AXA Life':'bharti-axa-life',
 'Future Generali Life':'future-generali-life','Edelweiss Tokio Life':'edelweiss-life','Edelweiss Life':'edelweiss-life','Ageas Federal Life':'ageas-federal-life',
 'Acko Life':'acko-life','Go Digit Life':'go-digit-life','Sahara India Life':'sahara-life','Exide Life':'exide-life','CreditAccess Life':'creditaccess-life',
}
HEALTH = {
 'Acko':'acko-general','Aditya Birla':'aditya-birla-health','Bajaj General':'bajaj-allianz-general','Care':'care-health','Chola MS':'cholamandalam-ms-general','Cholamandalam':'cholamandalam-ms-general',
 'Digit':'go-digit-general','Galaxy Health and Allied Insurance Co. Ltd.':'galaxy-health','Galaxy Health':'galaxy-health','Generali Central':'future-generali-general','Generali Central (Formerly Future Generali)':'future-generali-general',
 'HDFC ERGO':'hdfc-ergo','ICICI Lombard':'icici-lombard','IFFCO Tokio':'iffco-tokio','IndusInd General':'reliance-general','IndusInd General (Formerly Reliance General)':'reliance-general',
 'Liberty':'liberty-general','Magma General':'magma-general','Magma HDI':'magma-general','Manipal Cigna':'manipalcigna-health','Narayana Health Insurance Limited':'narayana-health','Narayana Health':'narayana-health',
 'National':'national-insurance','National Insurance':'national-insurance','Navi':'navi-general','New India':'new-india-assurance','New India Assurance':'new-india-assurance','Niva Bupa':'niva-bupa','Niva Bupa (Formerly Max Bupa)':'niva-bupa',
 'Oriental':'oriental-insurance','Oriental Insurance':'oriental-insurance','Raheja QBE':'raheja-qbe','Royal Sundaram':'royal-sundaram','SBI General':'sbi-general',
 'Shriram (Mainly Personal Accident, Not health)':'shriram-general','Shriram':'shriram-general','Star':'star-health','Star Health':'star-health','Tata AIG':'tata-aig',
 'United':'united-india','United India':'united-india','Universal Sompo':'universal-sompo','ZUNO (Edelweiss)':'zuno-general','Zuno (Formerly Edelweiss General)':'zuno-general','Zurich Kotak':'zurich-kotak',
}

LIFE_KEYS = [('life insurance corporation','lic'),('acko life','acko-life'),('aditya birla','aditya-birla-sun-life'),('ageas','ageas-federal-life'),('aviva','aviva-life'),('axis max','axis-max-life'),
 ('bajaj','bajaj-allianz-life'),('bandhan','bandhan-life'),('bharti axa','bharti-axa-life'),('canara','canara-hsbc-life'),('creditaccess','creditaccess-life'),('edelweiss','edelweiss-life'),('exide','exide-life'),
 ('generali','future-generali-life'),('digit','go-digit-life'),('hdfc life','hdfc-life'),('icici prudential','icici-prudential-life'),('indiafirst','indiafirst-life'),('nippon','reliance-nippon-life'),
 ('kotak','kotak-life'),('pnb','pnb-metlife'),('pramerica','pramerica-life'),('sbi life','sbi-life'),('sahara','sahara-life'),('shriram','shriram-life'),('star union','star-union-dai-ichi-life'),('tata aia','tata-aia-life')]
for _n in []: pass

def life_slug(nm):
    l = nm.lower()
    return next((slug for k, slug in LIFE_KEYS if k in l), None)

def num(x):
    x = x.replace(',', '').replace('x', '').replace('%', '').strip()
    if x in ('', 'NA', '-', '—'): return None
    x = x.rstrip('+')
    try: return float(x)
    except: return None

def fy(h):
    m = re.search(r'FY\s*(20\d\d)\s*[-–]\s*(?:20)?(\d\d)', h)
    return f'FY{m.group(1)}-{m.group(2)}' if m else None

def window(h):
    m = re.search(r'\(.*?FY\s*(20\d\d)\s*[-–]\s*(20\d\d)', h) or re.search(r'FY\s*(20\d\d)\s*[-–]\s*(20\d\d)', h)
    return f'FY{m.group(1)}-{m.group(2)}' if m else None

def build(path, mapping, keymap, bench_note):
    T = json.load(open(SC + path + '.tables.json'))
    out = {'metrics': {}, 'unmapped': set(), 'insights': T[0]['rows'][1:]}
    for tb in T[1:]:
        rows = tb['rows']; hdr = rows[0]; title = tb['h']
        key = next((k for pat, k in keymap if re.search(pat, title, re.I)), None)
        if not key: continue
        years = [fy(h) for h in hdr[2:]] if key != 'network' else []
        m = {'title': title, 'avgWindow': window(hdr[1]) if key != 'network' else None, 'rows': {}, 'median': None, 'mean': None}
        for r in rows[1:]:
            nm = r[0].strip()
            if nm in ('Median', 'Mean'):
                m[nm.lower()] = num(r[1]); continue
            slug = mapping.get(nm) or mapping.get(re.sub(r'\s+', ' ', nm)) or (life_slug(nm) if mapping is LIFE else None)
            if not slug: out['unmapped'].add(nm); continue
            if key == 'network':
                m['rows'][slug] = {'value': num(r[1]), 'display': r[1]}; continue
            m['rows'][slug] = {'avg': num(r[1]), 'years': {y: num(v) for y, v in zip(years, r[2:]) if y and num(v) is not None}}
        out['metrics'][key] = m
    out['unmapped'] = sorted(out['unmapped'])
    return out

term = build('ditto_term_lab', LIFE, [(r'Claim Settlement Ratio \(CSR\)$|^Claim Settlement Ratio', 'csr'), (r'Amount Settlement', 'asr'), (r'Complaints', 'complaints10k'), (r'Within 30 Days', 'd30'), (r'Business Volumes', 'volumeCr'), (r'Amount Paid in Death', 'deathPaidCr'), (r'Solvency', 'solvency')], '')
health = build('ditto_health_lab', HEALTH, [(r'^CSR', 'csr'), (r'^ICR', 'icr'), (r'Business Volumes', 'gwpCr'), (r'Complaints', 'complaints10k'), (r'Network', 'network')], '')

term.update({'source': 'Ditto Term Insurance Data Lab (joinditto.in/term-insurance/data-lab), published 6 Aug 2026, scraped 2026-10-05. Built from IRDAI Annual Reports and insurer public disclosures L-39 (30-day), L-40 (CSR), L-41 (complaints). Individual business only.',
  'benchmarks': {'csr': '97%+', 'asr': '90%+', 'complaints10k': '<20', 'gwpCr': '₹5,000 Cr+', 'solvency': '≥1.5x (IRDAI minimum)'}, 'latest': 'FY2025-26'})
health.update({'source': 'Ditto Health Insurance Data Lab (joinditto.in/health-insurance/data-lab), published 7 Sep 2026, scraped 2026-10-05. CSR from insurer public disclosure NL-37; complaints from NL-45; ICR from IRDAI Annual Reports; network from insurer websites.',
  'benchmarks': {'csr': '90%+', 'icr': '55–85%', 'gwpCr': '₹2,500 Cr+', 'complaints10k': '<20 for general insurers, <40 for standalone health insurers', 'network': '10,000+'}, 'latest': 'FY2025-26',
  'caveats': ['Galaxy and Narayana are new with very little data; Ditto itself says not to rank them above established insurers.', 'Shriram General is mainly personal accident, not health.', 'CSR formula: Claims Paid / (Opening + Reported − Closed − Closing).']})
for n, d in (('term', term), ('health', health)):
    json.dump(d, open(f'src/data/ditto-{n}.json', 'w'), ensure_ascii=False, indent=1)
    print(n, {k: len(v['rows']) for k, v in d['metrics'].items()}, 'unmapped:', d['unmapped'])
