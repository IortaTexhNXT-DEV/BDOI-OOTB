"""Builds the iNXT BrokerVerse brochure (A4) with python-docx."""
import os, sys
import docx
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor, Emu

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, 'img')
OUT = sys.argv[1]

FONT = 'Segoe UI'
NAVY = '0B2A4A'
NAVY2 = '0F4761'
BLUE = '0072D8'
LIGHT = 'E8F2FC'
LIGHT2 = 'D3E6FA'
PALE = 'F4F8FC'
GREYBG = 'F1F3F6'
TEXT = '1E2B38'
MUTED = '51606F'
WHITE = 'FFFFFF'
SKY = '9CC9F5'

PAGE_W = 21.0
MARGIN = 1.4
CONTENT = PAGE_W - 2 * MARGIN   # 18.2 cm


def rgb(h):
    return RGBColor.from_string(h)


# ---------- low level helpers ----------

def set_font(run, size, bold=False, color=TEXT, italic=False):
    run.font.name = FONT
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = OxmlElement('w:rFonts'); rpr.insert(0, fonts)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        fonts.set(qn(a), FONT)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = rgb(color)


def spacing(par, before=0, after=0, line=None):
    pf = par.paragraph_format
    pf.space_before = Pt(before)
    pf.space_after = Pt(after)
    if line:
        pf.line_spacing = line


def add_par(container, text='', size=9.5, bold=False, color=TEXT, align=None, before=0, after=3, line=1.12,
            italic=False, first=False):
    """Adds a paragraph. `first` reuses the empty first paragraph of a new cell."""
    if first and hasattr(container, 'paragraphs') and container.paragraphs and not container.paragraphs[0].text \
            and len(container.paragraphs) == 1 and not container.paragraphs[0].runs:
        par = container.paragraphs[0]
    else:
        par = container.add_paragraph()
    spacing(par, before, after, line)
    if align:
        par.alignment = align
    if text:
        rich(par, text, size, bold, color, italic)
    return par


def rich(par, text, size, bold=False, color=TEXT, italic=False):
    """**bold** segments inside text."""
    parts = text.split('**')
    for i, part in enumerate(parts):
        if part:
            set_font(par.add_run(part), size, bold or (i % 2 == 1), color, italic)


def letterspace(run, twips):
    rpr = run._element.get_or_add_rPr()
    sp = OxmlElement('w:spacing'); sp.set(qn('w:val'), str(twips)); rpr.append(sp)


def shade(cell, fill):
    tcpr = cell._element.get_or_add_tcPr()
    for old in tcpr.findall(qn('w:shd')):
        tcpr.remove(old)
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), fill)
    tcpr.append(shd)


def margins(cell, top=0.15, left=0.2, bottom=0.15, right=0.2):
    tcpr = cell._element.get_or_add_tcPr()
    mar = OxmlElement('w:tcMar')
    for side, v in (('top', top), ('start', left), ('left', left), ('bottom', bottom), ('end', right), ('right', right)):
        el = OxmlElement(f'w:{side}')
        el.set(qn('w:w'), str(int(v * 567))); el.set(qn('w:type'), 'dxa')
        mar.append(el)
    tcpr.append(mar)


def cell_border(cell, side, color, size=8):
    tcpr = cell._element.get_or_add_tcPr()
    b = tcpr.find(qn('w:tcBorders'))
    if b is None:
        b = OxmlElement('w:tcBorders'); tcpr.append(b)
    el = OxmlElement(f'w:{side}')
    el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), str(size)); el.set(qn('w:space'), '0'); el.set(qn('w:color'), color)
    b.append(el)


def valign(cell, how='center'):
    cell.vertical_alignment = {'center': WD_CELL_VERTICAL_ALIGNMENT.CENTER, 'top': WD_CELL_VERTICAL_ALIGNMENT.TOP,
                               'bottom': WD_CELL_VERTICAL_ALIGNMENT.BOTTOM}[how]


def table(doc_or_cell, rows, widths, gap=None):
    """Borderless fixed-layout table with column widths in cm."""
    t = doc_or_cell.add_table(rows=rows, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    tblpr = t._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblpr.append(lay)
    borders = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{side}'); el.set(qn('w:val'), 'nil'); borders.append(el)
    tblpr.append(borders)
    tw = OxmlElement('w:tblW'); tw.set(qn('w:w'), str(int(sum(widths) * 567))); tw.set(qn('w:type'), 'dxa')
    for old in tblpr.findall(qn('w:tblW')):
        tblpr.remove(old)
    tblpr.append(tw)
    cm = OxmlElement('w:tblCellMar')
    for side in ('left', 'right'):
        el = OxmlElement(f'w:{side}'); el.set(qn('w:w'), '0'); el.set(qn('w:type'), 'dxa'); cm.append(el)
    tblpr.append(cm)
    grid = t._tbl.tblGrid
    for i, gc in enumerate(grid.findall(qn('w:gridCol'))):
        gc.set(qn('w:w'), str(int(widths[i] * 567)))
    for row in t.rows:
        for i, c in enumerate(row.cells):
            c.width = Cm(widths[i])
    return t


def height(row, cm, exact=False):
    row.height = Cm(cm)
    row.height_rule = WD_ROW_HEIGHT_RULE.EXACTLY if exact else WD_ROW_HEIGHT_RULE.AT_LEAST


def no_split(row):
    trpr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:cantSplit'); trpr.append(el)


def picture(container, path, width_cm, align=WD_ALIGN_PARAGRAPH.CENTER, before=0, after=0, first=True):
    par = add_par(container, align=align, before=before, after=after, line=1.0, first=first)
    par.add_run().add_picture(path, width=Cm(width_cm))
    return par


def spacer(container, pts, first=False):
    par = add_par(container, first=first, before=0, after=0, line=1.0)
    set_font(par.add_run(' '), 1)
    par.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
    par.paragraph_format.line_spacing = Pt(pts)
    return par


def page_break(doc):
    par = doc.add_paragraph(); spacing(par, 0, 0, 1.0)
    par.add_run().add_break(WD_BREAK.PAGE)


# ---------- design blocks ----------

def kicker(container, text, color=BLUE, first=False, before=0, after=2):
    par = add_par(container, first=first, before=before, after=after)
    r = par.add_run(text.upper()); set_font(r, 8.5, True, color); letterspace(r, 30)
    return par


def heading(container, text, size=20, color=NAVY, first=False, before=0, after=6):
    return add_par(container, text, size, True, color, first=first, before=before, after=after, line=1.0)


def section_title(doc, kick, title, intro=None):
    kicker(doc, kick)
    heading(doc, title)
    # thin blue rule
    t = table(doc, 1, [2.2, CONTENT - 2.2])
    height(t.rows[0], 0.09, exact=True)
    shade(t.cell(0, 0), BLUE)
    for c in t.rows[0].cells:
        spacing(c.paragraphs[0], 0, 0, 1.0)
        c.paragraphs[0].paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
        c.paragraphs[0].paragraph_format.line_spacing = Pt(1)
    if intro:
        add_par(doc, intro, 10.5, color=MUTED, before=8, after=8, line=1.18)
    else:
        spacer(doc, 8)


def feature_card(cell, number, title, body, fill=PALE):
    """Card: number badge, title, body; cell is the outer cell."""
    shade(cell, fill)
    margins(cell, 0.22, 0.25, 0.2, 0.25)
    cell_border(cell, 'left', BLUE, 24)
    par = add_par(cell, first=True, before=0, after=2, line=1.0)
    r = par.add_run(f'{number:02d}  '); set_font(r, 9, True, BLUE)
    r = par.add_run(title); set_font(r, 10.5, True, NAVY)
    add_par(cell, body, 8.6, color=TEXT, after=0, line=1.12)


def stat_tiles(doc, stats, fill=LIGHT, num_color=NAVY, label_color=MUTED, gap=0.18):
    n = len(stats)
    w = (CONTENT - gap * (n - 1)) / n
    widths = []
    for i in range(n):
        widths.append(w)
        if i < n - 1:
            widths.append(gap)
    t = table(doc, 1, widths)
    for i, (num, label) in enumerate(stats):
        c = t.cell(0, i * 2)
        shade(c, fill); margins(c, 0.18, 0.15, 0.18, 0.15); valign(c)
        add_par(c, num, 20 if len(num) < 6 else 13, True, num_color, WD_ALIGN_PARAGRAPH.CENTER, first=True, after=0, line=1.0)
        add_par(c, label, 8.5, False, label_color, WD_ALIGN_PARAGRAPH.CENTER, after=0, line=1.0)
    return t


def bullets(cell, items, size=8.8, color=TEXT, mark_color=BLUE, after=2):
    for it in items:
        par = add_par(cell, after=after, line=1.1)
        par.paragraph_format.left_indent = Cm(0.35)
        par.paragraph_format.first_line_indent = Cm(-0.35)
        r = par.add_run('■  '); set_font(r, size - 3, True, mark_color)
        rich(par, it, size, False, color)


def caption(container, text):
    add_par(container, text, 7.8, False, MUTED, WD_ALIGN_PARAGRAPH.LEFT, before=2, after=0, italic=True)


def footer(section):
    f = section.footer
    f.is_linked_to_previous = False
    par = f.paragraphs[0]
    spacing(par, 0, 0, 1.0)
    par.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = par.add_run('iNXT BrokerVerse  |  iorta TechNXT'); set_font(r, 7.5, False, MUTED)
    r = par.add_run('\t\t'); set_font(r, 7.5)
    # page number field
    r = par.add_run(); set_font(r, 7.5, False, MUTED)
    for kind, txt in (('begin', None), (None, 'PAGE'), ('end', None)):
        if kind:
            el = OxmlElement('w:fldChar'); el.set(qn('w:fldCharType'), kind); r._r.append(el)
        else:
            el = OxmlElement('w:instrText'); el.set(qn('xml:space'), 'preserve'); el.text = txt; r._r.append(el)
    tabs = par.paragraph_format.tab_stops
    from docx.enum.text import WD_TAB_ALIGNMENT
    tabs.add_tab_stop(Cm(CONTENT), WD_TAB_ALIGNMENT.RIGHT)


# ---------- document ----------

doc = docx.Document()
st = doc.styles['Normal']
st.font.name = FONT; st.font.size = Pt(9.5)
st.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
spacing(st, 0, 0)
sec = doc.sections[0]
sec.page_width = Cm(21.0); sec.page_height = Cm(29.7)
sec.left_margin = sec.right_margin = Cm(MARGIN)
sec.top_margin = Cm(1.2); sec.bottom_margin = Cm(1.2)
sec.header_distance = Cm(0.6); sec.footer_distance = Cm(0.6)
sec.different_first_page_header_footer = True
footer(sec)
cp = doc.core_properties
cp.title = 'iNXT BrokerVerse'; cp.subject = 'Product brochure'; cp.author = 'iorta TechNXT'; cp.comments = ''

# ===== Page 1: cover =====
t = table(doc, 1, [9.0, CONTENT - 9.0])
picture(t.cell(0, 0), os.path.join(IMG, 'logo.png'), 6.2, WD_ALIGN_PARAGRAPH.LEFT)
c = t.cell(0, 1); valign(c, 'center')
add_par(c, 'Product brochure', 9, True, NAVY, WD_ALIGN_PARAGRAPH.RIGHT, first=True, after=0)
add_par(c, 'Out-of-the-box (OOTB) edition', 9, False, MUTED, WD_ALIGN_PARAGRAPH.RIGHT, after=0)
spacer(doc, 14)

band = table(doc, 1, [CONTENT])
c = band.cell(0, 0); shade(c, NAVY); margins(c, 0.9, 0.9, 0.7, 0.9)
height(band.rows[0], 18.8)
par = add_par(c, first=True, after=6)
r = par.add_run('INSURANCE BROKING PLATFORM FOR THE PHILIPPINES'); set_font(r, 9, True, SKY); letterspace(r, 40)
par = add_par(c, after=4, line=1.0)
r = par.add_run('iNXT '); set_font(r, 40, False, WHITE)
r = par.add_run('BrokerVerse'); set_font(r, 40, True, WHITE)
add_par(c, 'Placement, policy servicing, broker accounting and BIR working papers in one system, '
           'built for Philippine non-life insurance brokers.', 15, False, WHITE, after=14, line=1.15)
inner = table(c, 1, [0.12, 10.0])
shade(inner.cell(0, 0), BLUE)
ic = inner.cell(0, 1); margins(ic, 0.0, 0.35, 0.0, 0.1)
add_par(ic, 'From the first quotation to the month-end close: every slip, policy, receipt, remittance and journal '
            'in one place, with maker-checker on the money and an audit trail on every change.',
        10, False, LIGHT2, first=True, after=0, line=1.2)
spacer(c, 16)
picture(c, os.path.join(IMG, 's-exec-dashboard.png'), CONTENT - 1.8)
add_par(c, 'Executive Dashboard: premium, policies, new business, claims, retention and receivables against target.',
        8, False, SKY, before=4, after=0, italic=True)
spacer(doc, 10)
stat_tiles(doc, [('854', 'APIs'), ('39', 'reports'), ('16', 'scheduled jobs'), ('7', 'personas'), ('497', 'test cases')])
add_par(doc, 'Figures of the OOTB release test of 03 and 04 October 2026: 480 of the 497 test cases passed, '
             'a 23-step policy life cycle passed end to end, and every role was checked on all 173 menu screens.',
        7.8, False, MUTED, WD_ALIGN_PARAGRAPH.CENTER, before=5, after=0)
page_break(doc)

# ===== Page 2: the problem =====
section_title(doc, 'Why brokers change systems', 'Where a broker’s time goes today',
              'A Philippine non-life broker earns its commission on placement and service, yet much of the day goes '
              'to re-keying the same risk, premium and share into e-mails, spreadsheets and ledgers. These are the '
              'five gaps we hear most, and what BrokerVerse does about each of them.')
pains = [
    ('Manual placement',
     'Broker slips go out by e-mail, offers come back as PDFs, and the chosen shares are typed again into the '
     'quotation, the policy and the bill.',
     'Request for Quotation sends one slip to every insurer approached, records each offer or decline, ranks the '
     'offers and carries the chosen lead and co-insurer shares into the Placement Slip and the policy.'),
    ('Spreadsheets for remittance',
     'Premium collected for each insurer is worked out by hand, net of commission and per co-insurer share, '
     'month after month.',
     'Automated Processing builds the remittance per insurer from collected premium, net of commission and by '
     'share, with approval levels by amount, a settlement voucher and Remittance Ageing on each insurer’s terms.'),
    ('BIR compliance effort',
     'VAT, withholding tax and alphalists are rebuilt from the books at each deadline, and Forms 2307 are tracked '
     'in folders.',
     'Taxes are split when the policy is billed. VAT Summary, SAWT, QAP and SLSP come out of the ledger in the BIR '
     'column order, and BIR Form 2307 is issued and received with its own number series.'),
    ('Slow renewals',
     'Expiring policies are found late, notices depend on someone remembering, and lapses are noticed after the fact.',
     'Every policy enters the renewal pipeline 90 days before expiry, notices go out at 60, 30 and 15 days, '
     'at-risk policies are scored, and lapses after the 30-day grace period are tracked for win-back.'),
    ('Audit gaps',
     'Approvals happen by e-mail or signature, changes leave no trace, and the books stay open after the month '
     'is reported.',
     'Maker-checker on quotations, vouchers, remittances, settlements and closes, with notifications to the approvers; '
     'an audit trail with before and after values; 52 number series; periods that soft-close, close and lock.'),
]
t = table(doc, 1, [6.6, 0.25, CONTENT - 6.85])
for i, txt in enumerate(['TODAY', '', 'WITH BROKERVERSE']):
    c = t.cell(0, i)
    if txt:
        par = add_par(c, first=True, after=3)
        r = par.add_run(txt); set_font(r, 8.5, True, MUTED if i == 0 else BLUE); letterspace(r, 30)
for title, pain, fix in pains:
    row = t.add_row(); no_split(row)
    a, gap, b = row.cells
    shade(a, GREYBG); margins(a, 0.25, 0.3, 0.25, 0.3)
    add_par(a, title, 11, True, NAVY, first=True, after=2, line=1.0)
    add_par(a, pain, 8.8, False, MUTED, after=0, line=1.15)
    shade(b, LIGHT); margins(b, 0.25, 0.35, 0.25, 0.3); cell_border(b, 'left', BLUE, 24)
    add_par(b, fix, 9.2, False, TEXT, first=True, after=0, line=1.18)
    valign(b, 'center')
    spacer_row = t.add_row(); height(spacer_row, 0.22, exact=True)
spacer(doc, 6)
t = table(doc, 1, [CONTENT])
c = t.cell(0, 0); shade(c, NAVY); margins(c, 0.35, 0.5, 0.35, 0.5)
par = add_par(c, first=True, after=0, line=1.2)
r = par.add_run('One record, many teams. '); set_font(r, 10.5, True, WHITE)
r = par.add_run('A risk entered once by Sales & Marketing is the same record the Processing Team places, Operations '
                'services, Claims settles and Accounting bills, receipts, remits and closes. Each step leaves a '
                'numbered document and a journal from its posting rule.')
set_font(r, 10, False, LIGHT2)
page_break(doc)

# ===== Page 3: platform end to end (1) =====
section_title(doc, 'The platform', 'One system, end to end',
              'BrokerVerse covers the whole broking cycle and the accounting of a broker. The flow below is the path '
              'every piece of business takes; the modules that follow are all part of the OOTB edition.')
steps = ['Prospect', 'Request for\nQuotation', 'Quotation', 'Placement\nSlip', 'Policy', 'Bill and\nofficial receipt',
         'Remittance', 'Commission', 'Close and\nBIR']
n = len(steps); w = CONTENT / n
t = table(doc, 1, [w] * n)
height(t.rows[0], 1.25)
for i, s in enumerate(steps):
    c = t.cell(0, i); shade(c, NAVY if i % 2 == 0 else BLUE); valign(c); margins(c, 0.1, 0.05, 0.1, 0.05)
    lines = s.split('\n')
    add_par(c, lines[0], 8.2, True, WHITE, WD_ALIGN_PARAGRAPH.CENTER, first=True, after=0, line=1.0)
    if len(lines) > 1:
        add_par(c, lines[1], 8.2, True, WHITE, WD_ALIGN_PARAGRAPH.CENTER, after=0, line=1.0)
add_par(doc, 'Endorsements, claims and renewals run on the issued policy. Collections, reconciliation and period end '
             'run on the money that follows.', 8, False, MUTED, WD_ALIGN_PARAGRAPH.CENTER, before=4, after=8)

features = [
    ('Sales and quotation',
     'Prospects with bulk upload, Quick Quote and Compare Insurers for packaged products, and a five-step motor '
     'quotation with CTPL and Auto Passenger PA. The server re-prices every quotation from the configured rates. '
     'The client approves online through a signed link.'),
    ('Placement with insurers',
     'Request for Quotation (broker slip) to several insurers, offers and declines recorded, Compare offers with the '
     'best offer and market capacity. Placement Slip firm order with each insurer’s confirmation; shares total '
     '100% with one lead.'),
    ('Policy issuance and servicing',
     'Issue from a bound Placement Slip, from an accepted quotation, or with Record Issued Policy. The client, the '
     'bill and the commission are created at issue. Motor issue requires government ID, chassis, motor and plate '
     'or MV file number.'),
    ('Endorsements',
     'Personal details, motor details and coverage changes, extensions and cancellations (full, partial, pro-rata). '
     'Coverage changes are priced again; additional premium is billed and return premium is credited and netted '
     'on the insurer’s next remittance.'),
    ('Claims',
     'Claim registration with the Preliminary Loss Advice to the insurer, adjuster follow-up, settlement by maker '
     'and approval by a second Claims user, co-insurer shares, claims paid through the broker, claim letters on the '
     'letterhead.'),
    ('Renewals',
     'Renewal pipeline 90 days ahead, notices at 60, 30 and 15 days, renewal batches of up to 500 policies, '
     'Renewal Queue, At-Risk Policies, Negotiations, Lapse Management with win-back campaigns, Retention Analytics.'),
    ('Billing and official receipts',
     'Premium invoices on issue, endorsement and renewal. Official receipts from the OR series, posted only by '
     'Accounting after verifying the payment. Receipt and invoice PDFs e-mailed to the client. Payment links '
     'through PayMongo or Dragonpay.'),
    ('Collections and credit control',
     'Collections with ageing (current, 1-30, 31-60, 61-90, over 90 days) and daily reminders. Instalment Plans, '
     'Premium Warranty Monitor, Client Credit Limits and Remittance Ageing under Credit Control.'),
]
grid = table(doc, 0, [(CONTENT - 0.3) / 2, 0.3, (CONTENT - 0.3) / 2])
num = 1
for i in range(0, len(features), 2):
    row = grid.add_row(); no_split(row)
    feature_card(row.cells[0], num, *features[i]); num += 1
    feature_card(row.cells[2], num, *features[i + 1]); num += 1
    gap = grid.add_row(); height(gap, 0.28, exact=True)
spacer(doc, 4)
t = table(doc, 1, [CONTENT])
picture(t.cell(0, 0), os.path.join(IMG, 'p-rfq-compare.png'), CONTENT - 3.4)
caption(t.cell(0, 0), '        Request for Quotation BS-2026-00047, tab Compare offers: offers ranked by gross premium, '
                      'best offer marked, lead and shares chosen for the Placement Slip.')
page_break(doc)

# ===== Page 4: platform end to end (2) =====
kicker(doc, 'The platform, continued')
features2 = [
    ('Remittance and direct bill',
     'Remittance per insurer and per co-insurer share, approval levels by amount (PHP 100,000 and PHP 1,000,000), '
     'settlement and insurer payment voucher. Direct bill: commission debit notes with 12% VAT, collection net of '
     '10% EWT.'),
    ('Commission',
     'Commission Rate Matrix by insurer, product, line and policy type. Accrued at issue, payable to referrers when '
     'the premium is fully collected, paid by voucher less withholding tax, clawed back on return premium.'),
    ('General ledger and period end',
     'Posting rules turn each business event into a balanced journal. Journal, Correction and Reversal JV with '
     'approval, Recurring Journals, Month-End Close with checklist, Year-End Close and Financial Statements.'),
    ('Bank and insurer reconciliation',
     'Bank statements imported in BDO, BPI, Metrobank or generic layout, six matching rules, adjustments, stale '
     'cheques, reconciliation approved by the Accounting Manager. Insurer statements imported with a differences report.'),
    ('BIR tax',
     'BIR Form 2307 issued by the broker and received from insurers and clients, VAT Summary, SAWT, QAP, SLSP Sales '
     'and SLSP Purchases. Tax codes carry rate, BIR ATC and GL account.'),
    ('Reinsurance',
     'Treaties (quota share, surplus, excess of loss, stop loss) with approval, cession tracking and bordereaux, '
     'claims recovery, reinsurer statement reconciliation and treaty analytics.'),
    ('Incentives',
     'Incentive programmes for account executives on premium, policy count, renewal rate or conversion. '
     'Calculations approved by a second Accounting user, statements per person, accrual and payment through posting rules.'),
    ('Reports and dashboards',
     '39 catalogue reports on screen, in Excel, CSV or PDF on the company letterhead, with scheduled delivery by '
     'e-mail. Executive, Sales, Processing, Claims and Commission dashboards with live figures.'),
    ('Security and control',
     'Seven roles checked by the server on every request, two-step verification, lockout and password policy, '
     'Authority Matrix, Delegations, Segregation of Duties, Access Reviews and an Audit Trail with before and after values.'),
    ('Data privacy',
     'Consent Register per purpose, Data Subject Requests register with due dates, personal data export for access '
     'and portability, and anonymisation once the retention period of the records has passed.'),
]
grid = table(doc, 0, [(CONTENT - 0.3) / 2, 0.3, (CONTENT - 0.3) / 2])
for i in range(0, len(features2), 2):
    row = grid.add_row(); no_split(row)
    feature_card(row.cells[0], num, *features2[i]); num += 1
    feature_card(row.cells[2], num, *features2[i + 1]); num += 1
    gap = grid.add_row(); height(gap, 0.28, exact=True)
spacer(doc, 4)
t = table(doc, 1, [(CONTENT - 0.4) / 2, 0.4, (CONTENT - 0.4) / 2])
picture(t.cell(0, 0), os.path.join(IMG, 'a-receipts.png'), (CONTENT - 0.4) / 2)
caption(t.cell(0, 0), 'Accounts > Receipts: official receipts against open bills.')
picture(t.cell(0, 2), os.path.join(IMG, 'a-br-workspace.png'), (CONTENT - 0.4) / 2)
caption(t.cell(0, 2), 'Bank Reconciliation: balance per bank and per books agree.')
spacer(doc, 12)
t = table(doc, 1, [CONTENT])
c = t.cell(0, 0); shade(c, NAVY); margins(c, 0.4, 0.5, 0.4, 0.5)
par = add_par(c, first=True, after=6)
r = par.add_run('NEW IN THIS RELEASE'); set_font(r, 8.5, True, SKY); letterspace(r, 30)
inner = table(c, 1, [5.6, 0.3, 5.6, 0.3, 5.4])
news = [('Approval notifications', 'Every maker-checker flow tells the people who can approve it, and the maker hears of the approval or rejection with the reason.'),
        ('Documents by e-mail', 'Official receipts and premium invoices e-mailed to the client with the PDF attached; debit notes and policy schedules attached too.'),
        ('Data privacy registers', 'Consent Register and Data Subject Requests under Master > Data Privacy, with personal data export and anonymisation.')]
for k, (title, body) in enumerate(news):
    ic = inner.cell(0, k * 2)
    add_par(ic, title, 10, True, WHITE, first=True, after=2, line=1.0)
    add_par(ic, body, 8.4, False, LIGHT2, after=0, line=1.15)
page_break(doc)

# ===== Page 5: personas and Philippine features =====
section_title(doc, 'Seven personas', 'Built around the people who do the work',
              'Each user signs in with a personal ID and sees only the menus of the role. The server applies the same '
              'permissions on every request, and the person who enters a transaction cannot approve it.')
personas = [
    ('Sales & Marketing', 'Account executives',
     'Prospects, quick quotes and motor quotations sent for online approval; own pipeline, premium and commission on '
     'the Sales Dashboard; renewal follow-up.'),
    ('Processing Team', 'Placement and policy processing',
     'Request for Quotation to the market, offer comparison, Placement Slips, policy issue, endorsements, renewal '
     'approvals, motor tariff and products, reinsurance.'),
    ('Operations', 'Client servicing',
     'Clients and their policies in one view, endorsement requests, payment capture for verification, Open Items '
     'worklist of expiring policies and pending payments.'),
    ('Claims', 'Claims officers',
     'Claims Dashboard, registration with the insurer notice, adjuster follow-up, settlement with a second approver, '
     'claim letters, reinsurance recoveries.'),
    ('Accounting', 'Finance team',
     'Receipts, collections, remittance, direct bill, commission payouts, vouchers, journals, bank reconciliation, '
     'month-end preparation, BIR reports and Form 2307.'),
    ('Accounting Manager', 'Finance approver',
     'Approves month-end and year-end close and bank reconciliations, reopens periods, posts into soft-closed '
     'periods, reviews the close status.'),
    ('System Administrator', 'IT and set-up',
     'Users and roles, company and letterhead, insurers and credit terms, number series, posting rules, '
     'configuration, schedules and the audit trail.'),
]
t = table(doc, 0, [4.6, CONTENT - 4.6])
for i, (role, who, what) in enumerate(personas):
    row = t.add_row(); no_split(row)
    a, b = row.cells
    shade(a, NAVY if i % 2 == 0 else NAVY2); margins(a, 0.16, 0.3, 0.16, 0.2); valign(a)
    add_par(a, role, 10, True, WHITE, first=True, after=0, line=1.0)
    add_par(a, who, 7.8, False, SKY, after=0, line=1.0)
    shade(b, PALE if i % 2 == 0 else WHITE); margins(b, 0.16, 0.35, 0.16, 0.3); valign(b)
    add_par(b, what, 8.8, False, TEXT, first=True, after=0, line=1.15)
spacer(doc, 14)
kicker(doc, 'Philippine rules built in')
heading(doc, 'Configured for the Philippine market from day one', 15, after=6)
ph = [
    ('CTPL and motor',
     ['CTPL 1-year and 3-year tariff per vehicle class in the motor template',
      'CTPL inclusive of taxes and never discounted',
      'Auto Passenger PA priced per seat',
      'Certificate number and authentication code on the policy']),
    ('Taxes on premium',
     ['DST 12.5%, LGT 0.75%, VAT 12%, FST 2% on fire and IAR',
      'Taxes per line of business and LGU rates per city',
      'Premium taxes booked to their own accounts, due to insurers',
      'Return premium reverses the taxes']),
    ('BIR outputs',
     ['BIR Form 2307 issued and received, CWT series',
      'VAT Summary for the VAT return',
      'SAWT, QAP, SLSP Sales and Purchases in BIR column order',
      'EWT codes with ATC, for example WI139, WC139, WI515']),
    ('Insurance Commission records',
     ['Registers of slips, placements, policies, claims and renewals',
      'Premium due to insurers kept apart from commission income',
      'Remittance terms per insurer and Remittance Ageing',
      'Reports in Excel, CSV and PDF for examination']),
    ('Data Privacy Act',
     ['Consent per purpose with notice version and channel',
      'Data subject requests numbered DSR- with due dates',
      'Personal data export and anonymisation with retention rules',
      'Role-based access, audit trail, signed document links']),
    ('Local formats',
     ['PHP amounts and Asia/Manila business time',
      'TIN, 4-digit ZIP code, Philippine mobile numbers',
      'PhilSys ID, UMID, passport and other KYC IDs',
      'Bank statement layouts for BDO, BPI and Metrobank']),
]
cw = (CONTENT - 0.5) / 3
t = table(doc, 0, [cw, 0.25, cw, 0.25, cw])
for r0 in range(0, 6, 3):
    row = t.add_row(); no_split(row)
    for k in range(3):
        title, items = ph[r0 + k]
        c = row.cells[k * 2]; shade(c, LIGHT); margins(c, 0.2, 0.25, 0.2, 0.25)
        cell_border(c, 'top', BLUE, 24)
        add_par(c, title, 10, True, NAVY, first=True, after=4, line=1.0)
        bullets(c, items, 8.3)
    gap = t.add_row(); height(gap, 0.25, exact=True)
page_break(doc)

# ===== Page 6: deployment and implementation =====
section_title(doc, 'Deployment', 'Hosted where your data should live',
              'The same build runs in the cloud or in a Philippine data centre: a web application, a stateless API, '
              'PostgreSQL 16 and a file store. Each option is sized to the broker and confirmed by a performance test in UAT.')
deploy = [
    ('AWS', 'Singapore region', ['Reference deployment', 'CloudFront, load balancer, containers', 'RDS PostgreSQL Multi-AZ, encrypted', 'Automated backups with point-in-time restore']),
    ('Microsoft Azure', 'Southeast Asia region', ['No code change needed', 'Front Door with WAF', 'Container Apps, PostgreSQL Flexible Server', 'Zone-redundant high availability']),
    ('Local partner', 'Philippine data centre', ['Data held in the Philippines', 'Managed virtual machines', 'PostgreSQL with streaming standby', 'Off-site copy in a second site']),
    ('On-premise', 'Broker’s own servers', ['Docker or Node.js with PM2', 'nginx reverse proxy and TLS', 'Backups with WAL archiving', 'Broker IT runs the platform']),
]
cw = (CONTENT - 0.75) / 4
t = table(doc, 1, [cw, 0.25, cw, 0.25, cw, 0.25, cw])
for k, (name, where, items) in enumerate(deploy):
    c = t.cell(0, k * 2); shade(c, PALE); margins(c, 0.0, 0.0, 0.2, 0.0)
    inner = table(c, 1, [cw])
    h = inner.cell(0, 0); shade(h, NAVY if k % 2 == 0 else BLUE); margins(h, 0.2, 0.25, 0.2, 0.2)
    add_par(h, name, 11.5, True, WHITE, first=True, after=0, line=1.0)
    add_par(h, where, 8, False, LIGHT2, after=0, line=1.0)
    spacer(c, 6)
    for it in items:
        par = add_par(c, after=2, line=1.1)
        par.paragraph_format.left_indent = Cm(0.55); par.paragraph_format.first_line_indent = Cm(-0.3)
        par.paragraph_format.right_indent = Cm(0.2)
        r = par.add_run('■ '); set_font(r, 5.5, True, BLUE)
        rich(par, it, 8.2)
add_par(doc, 'The Data Privacy Act does not require data to stay in the Philippines but keeps the broker accountable '
             'for data held abroad. Brokers who want the system of record in the country choose a local partner or '
             'on-premise hosting.', 8, False, MUTED, before=6, after=8, italic=True)
stat_tiles(doc, [('PostgreSQL 16', 'database of record'), ('Node.js 22', 'stateless API'), ('React 18', 'browser application, no install'), ('Asia/Manila', 'business time zone')], fill=PALE)
spacer(doc, 14)

kicker(doc, 'Implementation')
heading(doc, 'Live in 8, 12 or 16 to 20 weeks', 15, after=4)
add_par(doc, '**Configure, do not customise.** BrokerVerse is fitted to the broker through master data and settings: '
             'insurers and credit terms, products and the motor tariff, commission, tax codes, chart of accounts, '
             'posting rules, number series and approvals. Hypercare lasts until the first month-end close is done.',
        9.2, False, TEXT, after=8, line=1.18)
sizes = [
    ('8', 'weeks', 'Small broker', 'One office, up to 25 users, up to 10 insurers, up to 5,000 in-force policies.', 'Go-live at the start of week 7; hypercare weeks 7 and 8.'),
    ('12', 'weeks', 'Medium broker', 'Up to 3 offices, 26 to 75 users, up to 25 insurers, up to 25,000 in-force policies.', 'Go-live at the start of week 10; hypercare weeks 10 to 12.'),
    ('16-20', 'weeks', 'Large broker', 'More than 3 offices and 75 users, many insurers, more than 25,000 in-force policies.', 'Go-live at the start of week 15 (20-week plan); hypercare to week 20.'),
]
cw = (CONTENT - 0.5) / 3
t = table(doc, 1, [cw, 0.25, cw, 0.25, cw])
for k, (n_, unit, name, profile, golive) in enumerate(sizes):
    c = t.cell(0, k * 2); shade(c, LIGHT); margins(c, 0.25, 0.3, 0.25, 0.3)
    par = add_par(c, first=True, after=0, line=1.0)
    r = par.add_run(n_); set_font(r, 26, True, BLUE)
    r = par.add_run(' ' + unit); set_font(r, 10, True, NAVY)
    add_par(c, name, 10.5, True, NAVY, after=3, line=1.0)
    add_par(c, profile, 8.3, False, TEXT, after=3, line=1.12)
    add_par(c, golive, 8.3, True, NAVY2, after=0, line=1.12)
spacer(doc, 10)
phases = ['Mobilise', 'Discover', 'Set-up', 'Configure', 'Migrate data', 'Train', 'SIT', 'UAT', 'Cutover', 'Go-live', 'Hypercare']
w = CONTENT / len(phases)
t = table(doc, 1, [w] * len(phases)); height(t.rows[0], 0.9)
for i, s in enumerate(phases):
    c = t.cell(0, i); shade(c, NAVY if i < 9 else BLUE); valign(c); margins(c, 0.05, 0.02, 0.05, 0.02)
    if i % 2 == 1 and i < 9:
        shade(c, NAVY2)
    add_par(c, s, 7.6, True, WHITE, WD_ALIGN_PARAGRAPH.CENTER, first=True, after=0, line=1.0)
spacer(doc, 10)
t = table(doc, 1, [CONTENT])
c = t.cell(0, 0); shade(c, GREYBG); margins(c, 0.25, 0.4, 0.25, 0.4); cell_border(c, 'left', NAVY, 24)
add_par(c, 'What OOTB means', 10, True, NAVY, first=True, after=2)
add_par(c, 'The broker uses the delivered screens, workflows, reports and printed documents. Customisation of screens, '
           'reports or documents and new integrations (insurer systems, core banking, bank payment files, SMS, BIR '
           'eFPS or eBIRForms) are outside the OOTB scope and are handled as change requests, estimated and priced '
           'before any work starts.', 8.8, False, TEXT, after=0, line=1.15)
page_break(doc)

# ===== Page 7: support and why iorta =====
section_title(doc, 'Production support', 'Support that knows the product',
              'After hypercare, iorta TechNXT supports BrokerVerse through one service desk. The broker’s key users '
              'and System Administrator handle the first line; iorta TechNXT handles analysis, fixes and releases.')
levels = [
    ('L1', 'Broker key users and System Administrator', 'How-to questions, users and passwords, settings and master data, logging the ticket with the evidence.'),
    ('L2', 'iorta TechNXT application support', 'Triage, reproduction, analysis with request IDs and the audit trail, configuration and data corrections under change control, workarounds.'),
    ('L3', 'iorta TechNXT engineering', 'Code defects, performance, infrastructure, security incidents, root-cause analysis, fixes and releases.'),
]
t = table(doc, 0, [1.6, 5.2, CONTENT - 6.8])
for i, (lv, who, what) in enumerate(levels):
    row = t.add_row(); no_split(row)
    a, b, c3 = row.cells
    shade(a, BLUE); valign(a); margins(a, 0.15, 0.1, 0.15, 0.1)
    add_par(a, lv, 14, True, WHITE, WD_ALIGN_PARAGRAPH.CENTER, first=True, after=0, line=1.0)
    for cc in (b, c3):
        shade(cc, PALE if i % 2 == 0 else WHITE); valign(cc); margins(cc, 0.15, 0.3, 0.15, 0.25)
    add_par(b, who, 9.2, True, NAVY, first=True, after=0, line=1.1)
    add_par(c3, what, 8.6, False, TEXT, first=True, after=0, line=1.12)
spacer(doc, 10)
t = table(doc, 1, [8.3, 0.4, CONTENT - 8.7])
left = t.cell(0, 0)
add_par(left, 'Service levels (standard proposal)', 10.5, True, NAVY, first=True, after=4)
sev = [('Severity', 'First response', 'Restore or workaround'),
       ('P1 Critical', '30 minutes', '4 service hours'),
       ('P2 High', '2 service hours', '2 business days'),
       ('P3 Medium', '1 business day', '5 business days'),
       ('P4 Low', '2 business days', 'Planned')]
st_ = table(left, 0, [2.5, 2.7, 3.1])
for i, rowv in enumerate(sev):
    row = st_.add_row()
    for k, v in enumerate(rowv):
        c = row.cells[k]; margins(c, 0.08, 0.15, 0.08, 0.1)
        if i == 0:
            shade(c, NAVY); add_par(c, v, 8.2, True, WHITE, first=True, after=0)
        else:
            shade(c, LIGHT if i % 2 else WHITE); add_par(c, v, 8.4, k == 0, NAVY if k == 0 else TEXT, first=True, after=0)
add_par(left, 'Standard support 8:00 to 18:00 Philippine time, Monday to Friday; 24 x 7 cover for P1 available as an option. '
              'Final targets are fixed in the support agreement.', 7.8, False, MUTED, before=4, after=0, italic=True)
right = t.cell(0, 2)
add_par(right, 'How changes are handled', 10.5, True, NAVY, first=True, after=4)
bullets(right, ['Monthly planned releases, tested first in the test environment',
                'Database snapshot before every release; rollback by image tag',
                'Configuration changes recorded in the audit trail with old and new values',
                'Posting rule changes proposed by one user and approved by another',
                'Problem records and root-cause analysis for every P1',
                'Monthly service review with ticket and target figures'], 8.6)
spacer(doc, 14)

kicker(doc, 'Why iorta TechNXT')
heading(doc, 'A finished product, documented and tested', 15, after=6)
why = [
    ('Built for Philippine broking', 'CTPL tariff, premium taxes, BIR working papers, IC records and the Data Privacy Act are part of the product, not a project.'),
    ('Tested before you see it', '497 test cases, a 634-test business rule regression on PostgreSQL and a full UAT cycle of 371 business steps from set-up to month-end close.'),
    ('Documented for your team', 'A 186-page user manual, seven role decks, a reports book, architecture, compliance matrix, data migration, training and support documents.'),
    ('Configuration over code', 'Settings, masters, posting rules and the Product Configurator change the system. Upgrades stay simple because the code is the same for every broker.'),
    ('Accounting that closes', 'Every event posts through a posting rule; maker-checker, period locks, bank reconciliation and month-end checklist give the auditors their trail.'),
    ('Open and portable', 'React, Node.js and PostgreSQL with permissively licensed components; 854 APIs documented in OpenAPI; runs on AWS, Azure or your own servers.'),
]
cw = (CONTENT - 0.3) / 2
t = table(doc, 0, [cw, 0.3, cw])
for i in range(0, len(why), 2):
    row = t.add_row(); no_split(row)
    for k in range(2):
        title, body = why[i + k]
        c = row.cells[k * 2]
        margins(c, 0.12, 0.0, 0.12, 0.1)
        inner = table(c, 1, [0.18, cw - 0.18])
        shade(inner.cell(0, 0), BLUE)
        ic = inner.cell(0, 1); margins(ic, 0.05, 0.3, 0.05, 0.1)
        add_par(ic, title, 10, True, NAVY, first=True, after=1, line=1.0)
        add_par(ic, body, 8.6, False, TEXT, after=0, line=1.13)
page_break(doc)

# ===== Page 8: back cover =====
t = table(doc, 1, [CONTENT])
c = t.cell(0, 0)
picture(c, os.path.join(IMG, 's-sales-dashboard.png'), CONTENT)
caption(c, 'Sales Dashboard: prospects, quotations, conversion, policies issued and premium for the sales team.')
spacer(doc, 10)
t = table(doc, 1, [(CONTENT - 0.4) / 2, 0.4, (CONTENT - 0.4) / 2])
picture(t.cell(0, 0), os.path.join(IMG, 'a-pe-close.png'), (CONTENT - 0.4) / 2)
caption(t.cell(0, 0), 'Month-End Close: one run per period, approved by a second user.')
picture(t.cell(0, 2), os.path.join(IMG, 'a-tax-2307.png'), (CONTENT - 0.4) / 2)
caption(t.cell(0, 2), 'BIR Form 2307 per payee and quarter, issued and received.')
spacer(doc, 14)
band = table(doc, 1, [CONTENT])
c = band.cell(0, 0); shade(c, NAVY); margins(c, 0.8, 0.9, 0.8, 0.9)
par = add_par(c, first=True, after=6)
r = par.add_run('SEE IT WITH YOUR OWN DATA'); set_font(r, 9, True, SKY); letterspace(r, 40)
add_par(c, 'Book a walk-through of BrokerVerse', 22, True, WHITE, after=6, line=1.0)
add_par(c, 'We run your own example, a motor policy or a co-insured fire risk, from quotation to official receipt, '
           'remittance and month-end close, on the delivered system.', 10.5, False, LIGHT2, after=14, line=1.2)
inner = table(c, 1, [8.3, 8.1])
a = inner.cell(0, 0); b = inner.cell(0, 1)
add_par(a, 'iorta TechNXT', 14, True, WHITE, first=True, after=4)
for label, val in (('Address', '[address]'), ('Telephone', '[phone]'), ('E-mail', '[e-mail]'), ('Website', '[website]')):
    par = add_par(a, after=2)
    r = par.add_run(f'{label}   '); set_font(r, 8.5, True, SKY)
    r = par.add_run(val); set_font(r, 9.5, False, WHITE)
valign(b, 'center')
add_par(b, 'Contact person', 8.5, True, SKY, first=True, after=1)
add_par(b, '[name, designation]', 9.5, False, WHITE, after=8)
add_par(b, 'Commercial models', 8.5, True, SKY, after=1)
add_par(b, 'Subscription per user per month, or perpetual licence with annual maintenance. Hosting quoted separately.',
        9, False, WHITE, after=0, line=1.15)
spacer(doc, 12)
t = table(doc, 1, [7.0, CONTENT - 7.0])
picture(t.cell(0, 0), os.path.join(IMG, 'logo.png'), 5.2, WD_ALIGN_PARAGRAPH.LEFT)
c = t.cell(0, 1); valign(c, 'center')
add_par(c, 'iNXT BrokerVerse, OOTB edition, version 1.0. Product facts and figures are taken from the system and its '
           'release test of 03 October 2026. Timelines, service levels and prices are confirmed in the proposal and '
           'the agreements. BrokerVerse produces records and working papers; filings with the BIR, the Insurance '
           'Commission and the National Privacy Commission remain with the broker.',
        7.3, False, MUTED, WD_ALIGN_PARAGRAPH.LEFT, first=True, after=0, line=1.15)

doc.save(OUT)
print('saved', OUT)
