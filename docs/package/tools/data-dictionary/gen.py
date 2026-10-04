import json, re
from col_generic import GCOL, NOUN
try:
    from col_specific import TCOL
except ImportError:
    TCOL = {}

D = json.load(open('db.json'))
M = json.load(open('mig.json'))
COMMENTS = M['comments']

FK = {}      # (table, col) -> (ftable, fcol)
CHECKS = {}  # (table, col) -> [values]
for name, ct, t, cols, ft, fcols, dl, ul, df in D['cons']:
    if ct == 'f' and ',' not in cols:
        FK[(t, cols)] = (ft, fcols)
    if ct == 'c':
        m = re.match(r"CHECK \(\(\(?(\w+) = ANY \(ARRAY\[(.*)\]\)\)\)?\)$", df)
        if m:
            vals = re.findall(r"'([^']*)'::text", m.group(2))
            CHECKS[(t, m.group(1))] = vals


NO_COMMENT = {'commission_referrers.id', 'reinsurers.id', 'disbursements.payee_type', 'package_bundle_sections.property', 'package_sections.property', 'premium_charge_rules.lines',
              'disbursements.purpose', 'product_templates.version', 'winback_campaigns.offers',
              'roles.code', 'leads.status', 'quotes.status', 'policies.status', 'endorsements.status', 'endorsements.endorsement_type', 'commissions.status', 'product_templates.status', 'claim_field_changes.action', 'receivables.status', 'journal_vouchers.status', 'renewals.status', 'claims.status', 'login_history.method', 'receipts.payment_mode'}


def noun(t):
    return NOUN.get(t) or t.rstrip('s').replace('_', ' ')


def words(s):
    return s.replace('_', ' ').strip()


PAST = re.compile(r'(ed|en|ent|wn|ld|id|nt)$')


def rule(t, c, dtype, default):
    e = noun(t)
    if (t, c) in FK:
        ft, fc = FK[(t, c)]
        base = c[:-3] if c.endswith('_id') else c
        fnoun = noun(ft)
        if base.replace('_', ' ') in (fnoun, ft.rstrip('s')) or base == ft.rstrip('s') or base == ft[:-1]:
            return f"{fnoun[0].upper() + fnoun[1:]} this {e} belongs to ({ft}.{fc})", 'fk'
        return f"{words(base).capitalize()}: link to the {fnoun} ({ft}.{fc})", 'fk-role'
    if c.endswith('_at') and 'timestamp' in dtype:
        w = words(c[:-3])
        if PAST.search(w.split()[-1]):
            return f"Date and time the {e} was {w}", 'at'
        return f"Date and time of the {w}", 'at'
    if c.endswith('_by'):
        w = words(c[:-3])
        return f"User who {w} the {e}", 'by'
    if c.endswith('_date') and dtype == 'date':
        return f"Date of the {words(c[:-5])}", 'date'
    if c.endswith('_due_on') and dtype == 'date':
        return f"Date by which the {words(c[:-7])} is due", 'date'
    if c.endswith('_on') and dtype == 'date':
        return f"Date the {e} was {words(c[:-3])}", 'date'
    if c.startswith('is_') or c.startswith('has_'):
        return f"Yes when the {e} is {words(c[3:] if c.startswith('is_') else c)}", 'bool'
    if c.endswith('_count'):
        return f"Number of {words(c[:-6])}", 'count'
    if c.endswith('_pct') or c.endswith('_percent'):
        return f"{words(c.rsplit('_', 1)[0]).capitalize()} in percent", 'pct'
    if c.endswith('_id'):
        return f"Identifier of the related {words(c[:-3])}", 'id'
    return words(c).capitalize(), 'fallback'


def describe(t, c, dtype, default):
    key = f'{t}.{c}'
    e = noun(t)
    how = 'tcol'
    if key in TCOL:
        base = TCOL[key]
        if (t, c) in FK and '(' + FK[(t, c)][0] + '.' not in base:
            base += ' (%s.%s)' % FK[(t, c)]
    elif c in GCOL:
        base = GCOL[c]; how = 'gcol'
        if (t, c) in FK and '(' not in base:
            base += ' (%s.%s)' % FK[(t, c)]
    else:
        base, how = rule(t, c, dtype, default)
    base = base.replace('{e}', e)
    if c == 'id' and default.startswith("('"):
        m = re.match(r"\('([a-z_]+)'.*gen_random_bytes\((\d+)\)", default)
        if m:
            base += f"; generated as '{m.group(1)}' followed by {int(m.group(2)) * 2} random hexadecimal characters"
    elif c == 'id' and default.startswith('nextval'):
        base += '; sequential number'
    com = None if key in NO_COMMENT else COMMENTS.get(key)
    if com:
        if '|' in com and len(com) < 200:
            vals = [v.strip() for v in com.split('|') if v.strip()]
            if not (t, c) in CHECKS:
                base += '. Values: ' + ', '.join(vals)
        elif how != 'tcol' and com.lower() not in base.lower():
            base += '. ' + com[0].upper() + com[1:]
    if (t, c) in CHECKS and 'Values:' not in base:
        base += '. Values: ' + ', '.join(CHECKS[(t, c)])
    if not base.endswith('.'):
        base += '.'
    return base, how
