import json, re
from collections import Counter
from pathlib import Path

analysis = json.loads(Path('.graphify_analysis.json').read_text(encoding='utf-8'))
extraction = json.loads(Path('.graphify_extract.json').read_text(encoding='utf-8'))
label_of = {n['id']: n.get('label', n['id']) for n in extraction['nodes']}
communities = {int(k): v for k, v in analysis['communities'].items()}

MANUAL = {
    0: 'Lease & Calendar Operations', 1: 'Appearance Settings UI', 2: 'Visit Booking Forms',
    3: 'Lease Draft Editing', 4: 'Common Areas & CRUD Lists', 5: 'AppSync Dispatch & Events',
    6: 'Maps & Incomplete Records', 7: 'Storage S3 API Routes', 8: 'Public Listing Pages',
    9: 'Leases & Properties Lists', 10: 'Contacts & Appointments Rules', 11: 'Theme & Fonts Setup',
    12: 'Lease Rules Engine', 13: 'Booking & Public UI Tests', 14: 'Foundation DB Schema',
    15: 'UI Primitives & Icons', 16: 'Lease-Contact Components', 17: 'AppSync Appointment Handlers',
    18: 'Calendar & UI Libraries', 19: 'Test Harness & Vitest', 20: 'Theme Icons & Palette',
    21: 'App Sidebar & Navigation', 22: 'Leases DB Schema', 23: 'Requests & Visits Pages',
    24: 'Auth Pages', 25: 'Calendar Toolbar & Dates', 26: 'Auth Claims & Resolver Context',
    27: 'Password Reset Form', 28: 'Infra Dependencies & CDK', 29: 'Ops Scripts & Health Checks',
    30: 'Appointment Sheet UI', 31: 'Favorites & Charts', 32: 'Appointment Dialog & Mutations',
    33: 'Visitor Requests Backend', 34: 'Auth Actions API', 35: 'Property & Unit Forms',
    36: 'Leaflet Maps', 37: 'Calendar Page', 38: 'Unit Filtering', 39: 'Contact Form',
    40: 'Unit Dialog Form', 41: 'ERP Auth Pages & Config', 42: 'Calendar Notifications DB',
    43: 'Misc Utilities', 44: 'Misc Utilities', 45: 'Request Rules & Validation',
    46: 'Dev & Testing Dependencies', 47: 'Units Filtering Logic', 48: 'Storage Buckets & Listings Schema',
    49: 'CloudFormation Deploy', 50: 'Listing Details UI', 51: 'Functions Dependencies',
    52: 'Playwright E2E Tests', 53: 'Playwright Specs', 54: 'App Header & Breadcrumb',
    55: 'Auth Provider & Session', 56: 'Appointment Details & Editor', 57: 'GraphQL Query Modules',
    58: 'Ownership Rules', 59: 'Backup Tooling', 60: 'Misc Utilities',
    61: 'UI Components Config', 62: 'Search & Quick Filters', 63: 'ERP Page Catalog',
    64: 'Dynamo & Persistence Tooling', 65: 'App Layout & Motion', 66: 'Calendar Component Tests',
    67: 'Calendar Feed Hook', 68: 'Misc Utilities', 69: 'Placeholder Pages',
    70: 'TypeScript Config', 71: 'PFE Metrics & Deploy Notes', 72: 'Budget & Search Params',
    73: 'Mailer & SMTP', 74: 'CI Steps', 75: 'Misc Utilities', 76: 'Misc Utilities',
    77: 'Backup Integration Tests', 78: 'Public Buy/Rent Pages', 79: 'Search Filters',
    80: 'Requests & Visit Settings Ops', 81: 'Spec Decisions Matrix', 82: 'Appointment Decisions Logic',
    83: 'CI Lint Config', 84: 'Mail Events & Change Records', 85: 'Logs & Metrics Scripts',
    86: 'Appointment List UI', 87: 'AWS SDK Patch Tooling', 88: 'Misc Utilities',
    89: 'CI Workflow', 90: 'Misc Utilities', 91: 'Charts & Recharts', 92: 'Appointment Labels',
    93: 'Misc Utilities', 94: 'Misc Utilities', 95: 'Load Test Script',
    96: 'Metrics Kinesis Dashboard', 97: 'Misc Utilities', 98: 'Docker Compose Config',
}

STOPWORDS = {'with', 'test', 'tests', 'page', 'from', 'that', 'this', 'into', 'them', 'more', 'than', 'upon', 'null', 'props', 'value', 'default', 'component'}

def auto_label(members):
    words = Counter()
    for i in members[:60]:
        lab = label_of.get(i, '').lower()
        for w in re.split(r'[^a-z0-9]+', lab):
            if len(w) > 3 and w not in STOPWORDS:
                words[w] += 1
    top = words.most_common(1)
    return (top[0][0].capitalize() + ' Concepts') if top else 'Misc Community'

labels = {}
for cid, members in communities.items():
    labels[cid] = MANUAL.get(cid) or auto_label(members)

Path('.graphify-tmp/labels.json').write_text(json.dumps(labels), encoding='utf-8')
sample = {k: labels[k] for k in sorted(labels)[:10]}
print('sample:', sample)
print('total labels:', len(labels))
