"""Build the iNXT BrokerVerse client presentation (16:9 PowerPoint) with python-pptx.

    python3 docs/package/tools/build_sales_deck.py
    soffice --headless --convert-to pdf --outdir docs/package/01_Sales docs/package/01_Sales/iNXT_BrokerVerse_Client_Presentation.pptx

Screens are the user manual screenshots in docs/package/source/manual-images (UAT data set). Facts come from the
documentation package sources (docs/package/source), the user manual and the pricing workbook. Items that iorta
TechNXT must still supply are written as [to confirm].
"""
import io
import os

from PIL import Image, ImageChops
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
LOGO = os.path.join(REPO, 'brokerverse', 'public', 'bdoi', 'iorta-technxt.png')
SHOTS = os.path.join(REPO, 'docs', 'package', 'source', 'manual-images')
OUT = os.path.join(REPO, 'docs', 'package', '01_Sales', 'iNXT_BrokerVerse_Client_Presentation.pptx')

NAVY = RGBColor(0x0F, 0x47, 0x61)
NAVY_DARK = RGBColor(0x0B, 0x2A, 0x4A)
BLUE = RGBColor(0x00, 0x72, 0xD8)
TEXT = RGBColor(0x1F, 0x29, 0x37)
MUTED = RGBColor(0x5B, 0x67, 0x78)
LIGHT = RGBColor(0xF3, 0xF6, 0xFA)
LINE = RGBColor(0xD5, 0xDE, 0xEA)
PALE = RGBColor(0xE6, 0xF1, 0xFC)
PALE_NAVY = RGBColor(0xE4, 0xEC, 0xF1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
AMBER = RGBColor(0xB4, 0x5F, 0x06)
PALE_AMBER = RGBColor(0xFE, 0xF3, 0xE2)
GREEN = RGBColor(0x1E, 0x7B, 0x4A)
PALE_GREEN = RGBColor(0xE5, 0xF4, 0xEA)
FONT = 'Calibri'

SW, SH = 13.333, 7.5
LOGO_RATIO = 604 / 178
FOOTER = 'iNXT BrokerVerse  |  Client presentation'


# ------------------------------------------------------------------ primitives
def rect(s, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, radius=None, lw=0.75):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid(); sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line; sh.line.width = Pt(lw)
    sh.shadow.inherit = False
    if radius is not None:
        sh.adjustments[0] = radius
    return sh


def text(s, x, y, w, h, runs, size=14, color=TEXT, bold=False, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
         italic=False, margin=0.0, spacing=0, line_spacing=None):
    """runs: str, or list of paragraphs; a paragraph is str or list of (text, {opts})."""
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    for side in ('margin_left', 'margin_right', 'margin_top', 'margin_bottom'):
        setattr(tf, side, Inches(margin))
    tf.vertical_anchor = anchor
    paras = runs if isinstance(runs, list) else runs.split('\n')
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = align
        if spacing:
            para.space_after = Pt(spacing)
        if line_spacing:
            para.line_spacing = line_spacing
        parts = p if isinstance(p, list) else [(p, {})]
        for t, o in parts:
            r = para.add_run(); r.text = t
            f = r.font; f.name = FONT; f.size = Pt(o.get('size', size)); f.bold = o.get('bold', bold)
            f.italic = o.get('italic', italic); f.color.rgb = o.get('color', color)
    return tb


def bullets(s, x, y, w, h, items, size=13, color=TEXT, spacing=5, label_color=NAVY, marker=BLUE):
    """items: str or (label, text); a str starting with '  ' is a second-level item."""
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame; tf.word_wrap = True; tf.auto_size = None
    for side in ('margin_left', 'margin_right', 'margin_top', 'margin_bottom'):
        setattr(tf, side, Inches(0.02))
    for i, it in enumerate(items):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.space_after = Pt(spacing)
        level2 = isinstance(it, str) and it.startswith('  ')
        pPr = para._p.get_or_add_pPr()
        indent = 0.42 if level2 else 0.22
        pPr.set('marL', str(int(Inches(indent)))); pPr.set('indent', str(-int(Inches(0.2))))
        bu_clr = pPr.makeelement(qn('a:buClr'), {})
        srgb = bu_clr.makeelement(qn('a:srgbClr'), {'val': '%02X%02X%02X' % tuple(MUTED if level2 else marker)})
        bu_clr.append(srgb); pPr.append(bu_clr)
        pPr.append(pPr.makeelement(qn('a:buFont'), {'typeface': 'Arial'}))
        pPr.append(pPr.makeelement(qn('a:buChar'), {'char': '–' if level2 else '•'}))
        sz = size - 1 if level2 else size
        if isinstance(it, tuple):
            lab, body = it
            r = para.add_run(); r.text = lab + '  '
            r.font.bold = True; r.font.color.rgb = label_color; r.font.size = Pt(sz); r.font.name = FONT
            r = para.add_run(); r.text = body
            r.font.color.rgb = color; r.font.size = Pt(sz); r.font.name = FONT
        else:
            r = para.add_run(); r.text = it.strip()
            r.font.color.rgb = MUTED if level2 else color; r.font.size = Pt(sz); r.font.name = FONT
    return tb


def card(s, x, y, w, h, fill=LIGHT, line=LINE):
    return rect(s, x, y, w, h, fill=fill, line=line, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)


def chip(s, x, y, label, fill=PALE, color=NAVY, size=10.5, h=0.3, w=None):
    w = w or max(0.6, len(label) * size * 0.0082 + 0.36)
    rect(s, x, y, w, h, fill=fill, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
    text(s, x, y, w, h, label, size=size, bold=True, color=color, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    return w


def arrow(s, x, y, w, h, fill=BLUE):
    return rect(s, x, y, w, h, fill=fill, shape=MSO_SHAPE.RIGHT_ARROW)


def table(s, x, y, w, rows, widths, size=11, header_fill=NAVY, row_h=0.3, bold_first=False, fills=None):
    """rows[0] is the header. widths in inches (sum = w)."""
    shp = s.shapes.add_table(len(rows), len(rows[0]), Inches(x), Inches(y), Inches(w), Inches(row_h * len(rows)))
    tbl = shp.table
    tblPr = tbl._tbl.tblPr
    for k in ('bandRow', 'firstRow'):
        tblPr.set(k, '0')
    style = tblPr.find(qn('a:tableStyleId'))
    if style is not None:
        style.text = '{5940675A-B579-460E-94D1-54222C63F5DA}'   # no style, table grid
    for j, cw in enumerate(widths):
        tbl.columns[j].width = Inches(cw)
    for i, row in enumerate(rows):
        tbl.rows[i].height = Inches(row_h)
        for j, val in enumerate(row):
            c = tbl.cell(i, j)
            c.margin_left = c.margin_right = Inches(0.07)
            c.margin_top = c.margin_bottom = Inches(0.03)
            c.vertical_anchor = MSO_ANCHOR.MIDDLE
            c.fill.solid()
            if i == 0:
                c.fill.fore_color.rgb = header_fill
            elif fills and fills.get((i, j)):
                c.fill.fore_color.rgb = fills[(i, j)]
            else:
                c.fill.fore_color.rgb = WHITE if i % 2 else LIGHT
            tf = c.text_frame; tf.word_wrap = True
            lines = str(val).split('\n')
            for k, ln in enumerate(lines):
                para = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
                r = para.add_run(); r.text = ln
                r.font.name = FONT; r.font.size = Pt(size)
                r.font.bold = (i == 0) or (bold_first and j == 0)
                r.font.color.rgb = WHITE if i == 0 else (NAVY if (bold_first and j == 0) else TEXT)
            _cell_border(c)
    return shp


def _cell_border(cell, color='D5DEEA'):
    tcPr = cell._tc.get_or_add_tcPr()
    for tag in ('a:lnL', 'a:lnR', 'a:lnT', 'a:lnB'):
        ln = tcPr.find(qn(tag))
        if ln is None:
            ln = tcPr.makeelement(qn(tag), {'w': '6350'}); tcPr.append(ln)
        fill = ln.makeelement(qn('a:solidFill'), {})
        clr = fill.makeelement(qn('a:srgbClr'), {'val': color})
        fill.append(clr); ln.append(fill)


# ------------------------------------------------------------------ screenshots
_cache = {}


def prepared(name, crop=None, top=0.055):
    """A screenshot without the header strip and the empty background around the content, as JPEG bytes.
    crop: (left, top, right, bottom) fractions of the trimmed image."""
    key = (name, crop, top)
    if key in _cache:
        return _cache[key]
    im = Image.open(os.path.join(SHOTS, name + '.png')).convert('RGB')
    if top:
        im = im.crop((0, int(im.height * top), im.width, im.height))
    bg = Image.new('RGB', im.size, im.getpixel((im.width - 3, im.height - 3)))
    diff = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 14 else 0)
    box = diff.getbbox()
    if box:
        pad = 10
        im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
    if crop:
        l, t, r, b = crop
        im = im.crop((int(im.width * l), int(im.height * t), int(im.width * r), int(im.height * b)))
    if im.width > 1800:
        im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=88, optimize=True)
    _cache[key] = (buf.getvalue(), im.size)
    return _cache[key]


def screen(s, name, x, y, w, h, caption=None, crop=None, top=0.055, valign='top'):
    data, (iw, ih) = prepared(name, crop, top)
    cap_h = 0.3 if caption else 0
    bh = h - cap_h
    scale = min(w / iw, bh / ih)
    pw, ph = iw * scale, ih * scale
    px = x + (w - pw) / 2
    py = y if valign == 'top' else y + (bh - ph) / 2
    pic = s.shapes.add_picture(io.BytesIO(data), Inches(px), Inches(py), Inches(pw), Inches(ph))
    pic.line.color.rgb = LINE; pic.line.width = Pt(0.75)
    if caption:
        text(s, x, py + ph + 0.05, w, 0.25, caption, size=9.5, color=MUTED, italic=True,
             align=PP_ALIGN.CENTER)
    return pic


# ------------------------------------------------------------------ deck
class Deck:
    def __init__(self):
        self.prs = Presentation()
        self.prs.slide_width = Inches(SW); self.prs.slide_height = Inches(SH)
        self.blank = self.prs.slide_layouts[6]
        self.n = 0

    def slide(self, title=None, kicker=None, notes=''):
        s = self.prs.slides.add_slide(self.blank)
        self.n += 1
        bg = s.background.fill; bg.solid(); bg.fore_color.rgb = WHITE
        if title is not None:
            rect(s, 0, 0, SW, 0.95, fill=NAVY)
            rect(s, 0, 0.95, SW, 0.05, fill=BLUE)
            if kicker:
                text(s, 0.5, 0.12, 10.5, 0.25, kicker.upper(), size=10.5, bold=True, color=RGBColor(0x9C, 0xC8, 0xF0))
                text(s, 0.5, 0.34, 11.5, 0.5, title, size=24, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
            else:
                text(s, 0.5, 0.2, 11.5, 0.6, title, size=26, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
            # footer
            rect(s, 0.5, 6.98, SW - 1.0, 0.01, fill=LINE)
            s.shapes.add_picture(LOGO, Inches(0.5), Inches(7.07), height=Inches(0.28))
            text(s, 0.5 + 0.28 * LOGO_RATIO + 0.2, 7.07, 7.0, 0.28, FOOTER, size=9.5, color=MUTED,
                 anchor=MSO_ANCHOR.MIDDLE)
            text(s, SW - 1.5, 7.07, 1.0, 0.28, str(self.n), size=9.5, color=MUTED, align=PP_ALIGN.RIGHT,
                 anchor=MSO_ANCHOR.MIDDLE)
        if notes:
            s.notes_slide.notes_text_frame.text = notes.strip()
        return s

    def save(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.prs.save(path)


def module_slide(d, title, kicker, items, shots, notes, who=None, outputs=None, text_w=5.55, size=13):
    """Text on the left, one or two screens on the right."""
    s = d.slide(title, kicker, notes)
    y = 1.25
    if who:
        text(s, 0.5, y, 1.0, 0.3, 'Who', size=10.5, bold=True, color=MUTED, anchor=MSO_ANCHOR.MIDDLE)
        x = 1.05
        for wlab in who:
            x += chip(s, x, y, wlab) + 0.08
        y += 0.45
    bh = 6.85 - y - (0.75 if outputs else 0)
    bullets(s, 0.5, y, text_w, bh, items, size=size)
    if outputs:
        card(s, 0.5, 6.1, text_w, 0.72, fill=PALE_NAVY, line=None)
        text(s, 0.65, 6.14, text_w - 0.3, 0.66, [[('Outputs  ', {'bold': True, 'color': NAVY}), (outputs, {})]],
             size=10.5, anchor=MSO_ANCHOR.MIDDLE)
    sx = 0.5 + text_w + 0.35
    sw = SW - 0.5 - sx
    if len(shots) == 1:
        nm, cap, crop = shots[0]
        screen(s, nm, sx, 1.25, sw, 5.6, cap, crop)
    else:
        (n1, c1, k1), (n2, c2, k2) = shots
        screen(s, n1, sx, 1.25, sw, 2.85, c1, k1)
        screen(s, n2, sx, 4.2, sw, 2.7, c2, k2)
    return s


# ------------------------------------------------------------------ content
def build():
    d = Deck()

    # 1. Title -----------------------------------------------------------
    s = d.slide(notes="""
Opening (2 minutes). Thank the attendees by name and confirm the time available.
Purpose of the session: show how iNXT BrokerVerse runs a Philippine non-life broker from the first prospect to the
month-end close, in one system, and agree the next step.
Ask who owns the decision and who will use the system day to day, so the walk-through can stress the right modules.
Fill in the client name and the date on this slide before sending the file.""")
    rect(s, 7.6, 0, SW - 7.6, SH, fill=NAVY_DARK)
    rect(s, 7.6, 0, 0.08, SH, fill=BLUE)
    s.shapes.add_picture(LOGO, Inches(0.7), Inches(0.6), height=Inches(0.62))
    text(s, 0.7, 2.0, 6.6, 0.4, 'CLIENT PRESENTATION', size=13, bold=True, color=BLUE)
    text(s, 0.7, 2.4, 6.7, 1.0, 'iNXT BrokerVerse', size=44, bold=True, color=NAVY_DARK)
    text(s, 0.7, 3.35, 6.6, 1.0, 'The insurance broking platform for Philippine non-life brokers, from prospect to '
         'renewal to month-end close', size=18, color=NAVY)
    rect(s, 0.7, 4.55, 1.2, 0.05, fill=BLUE)
    text(s, 0.7, 4.75, 6.5, 1.2, [
        [('Out-of-the-box (OOTB) version', {'bold': True})],
        'Prepared for: [Client name]',
        'Date: [03 October 2026]',
    ], size=13, color=TEXT, spacing=4)
    text(s, 0.7, 6.75, 6.5, 0.35, 'iorta TechNXT  |  Confidential: for the named recipient', size=10, color=MUTED)
    screen(s, 's-exec-dashboard', 8.2, 1.25, 4.6, 4.2, None, crop=(0, 0, 1, 0.78))
    text(s, 8.2, 5.65, 4.6, 0.9, 'Executive Dashboard: premium, active policies, new business, claims rate, '
         'retention and receivables, live from the transactions', size=11.5, color=RGBColor(0xC9, 0xDB, 0xEC),
         align=PP_ALIGN.CENTER)

    # 2. Agenda ----------------------------------------------------------
    s = d.slide('Agenda', notes="""
Walk through the agenda in under a minute. The core of the session is parts 3 and 4: the modules and the controls.
If time is short, offer to skip the persona view and go from the controls straight to deployment and commercials.
Ask whether there is a topic the audience wants first, for example accounting and BIR for a finance-led audience.""")
    items = [
        ('1', 'Who we are', 'iorta TechNXT and iNXT BrokerVerse'),
        ('2', 'What a Philippine broker has to handle', 'Market, regulation and the daily work'),
        ('3', 'The platform', 'Module map and the end-to-end journey'),
        ('4', 'Module walk-through', 'From sales and placement to accounting, BIR tax and reinsurance'),
        ('5', 'Controls, data privacy and security', 'Maker-checker, authority limits, approval notifications'),
        ('6', 'Who does what', 'The eight delivered roles'),
        ('7', 'Delivery', 'Technology, deployment, implementation timeline, support'),
        ('8', 'Commercials and next steps', 'Perpetual or subscription, then demo, workshop, proposal'),
    ]
    for i, (num, head, sub) in enumerate(items):
        col, row = i // 4, i % 4
        x = 0.7 + col * 6.2; y = 1.45 + row * 1.32
        rect(s, x, y, 0.75, 0.75, fill=NAVY if col == 0 else BLUE, shape=MSO_SHAPE.OVAL)
        text(s, x, y, 0.75, 0.75, num, size=22, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.95, y + 0.02, 5.0, 0.4, head, size=18, bold=True, color=NAVY_DARK)
        text(s, x + 0.95, y + 0.4, 5.0, 0.4, sub, size=13, color=MUTED)

    # 3. About iorta TechNXT ----------------------------------------------
    s = d.slide('About iorta TechNXT', 'Who we are', notes="""
Replace every item marked [to confirm] with approved company facts before the file leaves the office.
The facts that are already firm: iorta TechNXT publishes iNXT BrokerVerse, implements it with a configure-not-customise
approach, provides L2 application support and L3 engineering, and can host the test and production environments.
Keep this slide short (1 to 2 minutes). The audience cares more about what the system does for their team.""")
    cards = [
        ('Who we are', ['Insurance technology company and publisher of iNXT BrokerVerse',
                        'Founded: [to confirm]', 'Head office and Philippine presence: [to confirm]',
                        'Team size and delivery centres: [to confirm]']),
        ('What we deliver', ['The iNXT BrokerVerse platform, OOTB version for Philippine non-life brokers',
                             'Implementation: configuration, data load, training, UAT, go-live and hypercare',
                             'Production support: L2 application support and L3 engineering',
                             'Optional hosting on AWS, Azure or with a local partner']),
        ('How we work', ['Configure, do not customise: the broker is fitted to the product through masters and settings',
                         'Written acceptance at the end of each phase',
                         'One service desk, severity targets, monthly service report',
                         'Changes priced openly at published day rates']),
        ('References', ['Client references that may be named: [to confirm]',
                        'Other insurance products of iorta TechNXT: [to confirm]',
                        'Certifications held: [to confirm]',
                        'Contact: [account manager, mobile, e-mail]']),
    ]
    for i, (head, lines) in enumerate(cards):
        x = 0.5 + i * 3.1
        card(s, x, 1.35, 2.92, 5.35)
        rect(s, x, 1.35, 2.92, 0.08, fill=BLUE)
        text(s, x + 0.2, 1.55, 2.6, 0.4, head, size=16, bold=True, color=NAVY)
        bullets(s, x + 0.15, 2.05, 2.65, 4.5, lines, size=12, spacing=8)

    # 4. Challenges --------------------------------------------------------
    s = d.slide('What a Philippine non-life broker has to handle', 'The market and the work', notes="""
Market facts come from the Insurance Commission key data for 2024 (preliminary) and the 2025 non-life premium ranking,
as summarised in our commercial note. Check them against the published originals before quoting them outside the
meeting.
Message: most brokers are small or mid-size, every broker places with many insurers, and the work is as much accounting
and compliance as it is sales. A sales tool or a CRM covers only the left half of this slide.
Ask: which of these points costs your team the most time today. Note the answer for the demo.""")
    card(s, 0.5, 1.3, 4.3, 5.5, fill=NAVY_DARK, line=None)
    text(s, 0.75, 1.45, 3.9, 0.4, 'The market', size=17, bold=True, color=WHITE)
    facts = [('About 67', 'licensed insurance brokers (IC key data 2024, preliminary)'),
             ('PHP 20 million', 'minimum paid-up capital for a broker, PHP 50 million for an insurance and reinsurance broker'),
             ('PHP 149.11 billion', 'non-life gross premiums written in 2025; the top three insurers hold about a third'),
             ('Under PHP 100 million', 'commission income of most brokers; three earn more than PHP 2 billion each')]
    for i, (big, small) in enumerate(facts):
        y = 2.0 + i * 1.18
        text(s, 0.75, y, 3.9, 0.45, big, size=20, bold=True, color=RGBColor(0x7F, 0xBE, 0xF5))
        text(s, 0.75, y + 0.45, 3.9, 0.7, small, size=11.5, color=WHITE)
    text(s, 5.15, 1.3, 7.6, 0.4, 'What the system has to get right every day', size=17, bold=True, color=NAVY)
    needs = [
        ('Many insurers per risk', 'Offers from several insurers, co-insurance shares that total 100%, a lead insurer, confirmations'),
        ('Premium taxes', 'VAT 12%, documentary stamp tax 12.5%, local government tax by city or municipality, fire service tax 2%'),
        ('Client money', 'Collect premium, issue the official receipt, remit to each insurer on its terms, watch the premium warranty'),
        ('Commission', 'Broker-billed and direct-bill business, debit notes to insurers, BIR Form 2307 received, referrer payouts net of EWT'),
        ('BIR and the books', 'Form 2307, VAT Summary, SAWT, QAP and SLSP; month-end close, bank and insurer reconciliation'),
        ('Controls', 'Maker-checker on money and configuration, signing authority, segregation of duties, audit trail'),
        ('Data Privacy Act', 'Consent per purpose, data subject requests on time, breach notice within 72 hours'),
    ]
    for i, (lab, body) in enumerate(needs):
        y = 1.82 + i * 0.71
        rect(s, 5.15, y + 0.06, 0.08, 0.5, fill=BLUE)
        text(s, 5.4, y, 2.3, 0.62, lab, size=13, bold=True, color=NAVY_DARK, anchor=MSO_ANCHOR.MIDDLE)
        text(s, 7.7, y, 5.1, 0.62, body, size=12, color=TEXT, anchor=MSO_ANCHOR.MIDDLE)

    # 5. Platform at a glance ----------------------------------------------
    s = d.slide('The platform at a glance', 'One system for the whole broker', notes="""
Read the map from top to bottom: the front office creates the business, the money layer moves premium and commission,
the finance layer closes the books and files BIR, and everything sits on one set of masters, roles and controls.
Stress that accounting is inside the product: every business event posts to the general ledger through posting rules
the broker can see and approve. There is no separate accounting package to reconcile.
Integrations run through one monitored outbox: SMS and Viber, CTPL authentication and the LTO feed, insurer APIs with
a mapping per insurer, bank payment files, the BIR EIS, plus e-mail, payment links and statement files. Every connector is
delivered in test mode; each partner accepts its side during onboarding.
The compliance layer is in the product too: the AML/CFT toolkit, the IC registers and the BIR returns.""")
    layers = [
        ('Front office', NAVY, ['Sales & Marketing\nProspects, Quick Quote,\nQuotations', 'Placement\nBroker Slips,\nPlacement Slips',
                                'Policy servicing\nIssue, endorsements,\nclient view', 'Claims\nRegistration to\nsettlement',
                                'Renewals\nQueue, notices,\nnegotiations']),
        ('Money and insurers', BLUE, ['Billing and receipts\nInvoices, official\nreceipts, e-mail', 'Collections\nAgeing, reminders,\ncredit control',
                                      'Remittance\nTo insurers,\ndirect bill', 'Commission\nReferrers and\nincentive programmes',
                                      'Reinsurance\nTreaties, cessions,\nrecoveries']),
        ('Finance and compliance', NAVY_DARK, ['General ledger\nPosting rules,\njournals', 'Period end\nMonth-end and\nyear-end close',
                                               'Reconciliation\nBank and insurer\nstatements', 'BIR and AML\nReturns, EOPT,\nAMLC reports',
                                               'Reports\nDashboards, Report\nBuilder, My Work']),
    ]
    bx, bw, gap = 2.45, 1.62, 0.1
    for r, (lab, col, boxes) in enumerate(layers):
        y = 1.3 + r * 1.32
        rect(s, 0.5, y, 1.8, 1.18, fill=col, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
        text(s, 0.6, y, 1.6, 1.18, lab, size=13, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)
        for i, b in enumerate(boxes):
            x = bx + i * (bw + gap)
            card(s, x, y, bw, 1.18, fill=WHITE, line=col)
            head, rest = b.split('\n', 1)
            text(s, x + 0.08, y + 0.08, bw - 0.16, 0.32, head, size=12, bold=True, color=col, align=PP_ALIGN.CENTER)
            text(s, x + 0.08, y + 0.42, bw - 0.16, 0.72, rest.replace('\n', ' '), size=10.5, color=TEXT, align=PP_ALIGN.CENTER)
    # foundation
    y = 5.32
    rect(s, 0.5, y, 10.5, 1.5, fill=PALE_NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
    text(s, 0.7, y + 0.08, 10, 0.3, 'Foundation shared by every module', size=12.5, bold=True, color=NAVY)
    found = ['Product Configurator', 'Masters and Configuration', 'Users, roles, Authority Matrix', 'Segregation of Duties',
             'Maker-checker', 'Audit Trail', 'Notifications', 'E-mail Outbox', 'Data Privacy', 'Document Numbering',
             'Schedules', 'Upload templates']
    x, yy = 0.7, y + 0.45
    for f in found:
        w = len(f) * 10 * 0.0082 + 0.36
        if x + w > 10.85:
            x = 0.7; yy += 0.42
        chip(s, x, yy, f, fill=WHITE, size=10)
        x += w + 0.08
    # integrations
    rect(s, 11.2, 1.3, 1.63, 5.52, fill=LIGHT, line=LINE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
    text(s, 11.25, 1.38, 1.53, 0.3, 'Connects to', size=12, bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    ints = ['E-mail (SMTP); SMS and Viber', 'CTPL authentication; LTO feed', 'Insurer APIs; insurer statement files',
            'Bank payment and statement files', 'BIR EIS and DAT files; AMLC report files', 'PayMongo and Dragonpay links',
            'REST API with OpenAPI']
    for i, t in enumerate(ints):
        text(s, 11.3, 1.8 + i * 0.7, 1.45, 0.66, t, size=10, color=TEXT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if i:
            rect(s, 11.55, 1.78 + i * 0.7, 0.93, 0.01, fill=LINE)

    # 6. End-to-end journey -------------------------------------------------
    s = d.slide('The end-to-end journey: prospect to renewal to month-end', 'How the work flows', notes="""
This is the backbone of the demo. Each step is its own screen, usually done by a different team, and each leaves a
numbered document behind, so anyone can follow a policy from the lead to the money and back.
Point out the two blue approval markers: money and period close always need a second person.
The journey per line is configurable: a private car is quoted and issued straight from the quotation; fire, IAR,
marine, casualty and engineering need a Placement Slip confirmed by every insurer before the policy can be issued.""")
    steps = [('1', 'Lead', 'LD-', 'Sales, Operations'), ('2', 'Broker Slip', 'BS-  OFR-', 'Processing'),
             ('3', 'Quotation Slip', 'QT-', 'Sales, Processing'), ('4', 'Placement Slip', 'PS-', 'Processing'),
             ('5', 'Policy issue', 'POL-  CL-  INV-', 'Processing'), ('6', 'Payment capture', '', 'Front office'),
             ('7', 'Official receipt', 'OR-', 'Accounting'),
             ('8', 'Commission', 'PV-', 'Accounting, two users'), ('9', 'Remittance', 'REM-  SET-', 'Accounting, two users'),
             ('10', 'Endorsement', 'END-', 'Operations, Processing'), ('11', 'Claim', 'CLM-', 'Claims, two users'),
             ('12', 'Renewal', 'new term', 'Operations, Sales'), ('13', 'Month-end', 'BRC-  MEC-', 'Accounting, Manager')]
    approvals = {'3', '8', '9', '11', '12', '13'}
    w, h, gap = 1.62, 1.55, 0.13
    for i, (num, name, doc, who) in enumerate(steps):
        row = 0 if i < 7 else 1
        k = i if row == 0 else i - 7
        x = 0.5 + k * (w + gap) + (0 if row == 0 else (w + gap) / 2)
        y = 1.45 if row == 0 else 3.55
        col = NAVY if row == 0 else NAVY_DARK
        shp = rect(s, x, y, w, h, fill=WHITE, line=col, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08, lw=1.25)
        rect(s, x, y, w, 0.42, fill=col, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
        text(s, x, y, w, 0.42, f'{num}  {name}', size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
             anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.05, y + 0.5, w - 0.1, 0.35, doc, size=11, bold=True, color=BLUE, align=PP_ALIGN.CENTER)
        text(s, x + 0.05, y + 0.85, w - 0.1, 0.6, who, size=10.5, color=MUTED, align=PP_ALIGN.CENTER)
        if num in approvals:
            rect(s, x + w - 0.36, y + h - 0.36, 0.26, 0.26, fill=BLUE, shape=MSO_SHAPE.OVAL)
            text(s, x + w - 0.36, y + h - 0.36, 0.26, 0.26, '2', size=10, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if row == 0 and k < 6:
            arrow(s, x + w + 0.005, y + h / 2 - 0.09, 0.12, 0.18, fill=LINE)
        if row == 1 and k < 5:
            arrow(s, x + w + 0.005, y + h / 2 - 0.09, 0.12, 0.18, fill=LINE)
    text(s, 0.5, 5.35, 12.3, 0.3, [[('2', {'bold': True, 'color': BLUE}),
                                     ('  marks a step that a second user approves (maker-checker).', {})]], size=11, color=MUTED)
    card(s, 0.5, 5.75, 6.05, 1.1, fill=PALE, line=None)
    text(s, 0.7, 5.8, 5.7, 1.0, [[('Placement journey by line.  ', {'bold': True, 'color': NAVY}),
                                  ('Motor: quotation straight to policy. Fire, IAR, Marine, Casualty, Engineering: '
                                   'Placement Slip required. Set per line in Master > Configuration.', {})]],
         size=11.5, anchor=MSO_ANCHOR.MIDDLE)
    card(s, 6.78, 5.75, 6.05, 1.1, fill=PALE, line=None)
    text(s, 6.98, 5.8, 5.7, 1.0, [[('One trail.  ', {'bold': True, 'color': NAVY}),
                                   ('Every step posts to the ledger by posting rule and is kept in the Audit Trail, so '
                                    'a policy can be followed from lead to remittance and claim.', {})]],
         size=11.5, anchor=MSO_ANCHOR.MIDDLE)

    # 7. Sales and quotation --------------------------------------------------
    module_slide(d, 'Sales and quotation', 'Module walk-through: front office', [
        ('Prospects', 'individual or corporate (TIN required for corporate), one by one or by Excel upload'),
        ('Quick Quote and Compare Insurers', 'prices a package from each insurer\'s rate table and prints a comparison without commission'),
        ('Motor quotation in five steps', 'vehicle, plan, covers including CTPL and Auto Passenger PA, accessories, discount and commission'),
        ('Server-side pricing', 'every quotation is priced again from the configured rates and taxes; a premium changed in the browser is refused'),
        ('Client approval online', 'a signed link valid for 168 hours; the client accepts and the Processing Team is told'),
        ('Payment links', 'PayMongo or Dragonpay; a paid link creates the official receipt'),
        ('Sales Dashboard', 'prospects, quotations, conversion, policies issued and premium per account executive'),
    ], [('s-quotations', 'Operations > Quotation: status of every quotation', (0, 0, 1, 0.62)),
        ('s-sales-dashboard', 'Dashboard > Sales Dashboard', (0, 0, 1, 0.8))],
        who=['Sales & Marketing', 'Operations', 'Processing Team'],
        outputs='Quotation PDF, insurer comparison, Lead Conversion Funnel report', notes="""
Show this from the account executive's point of view: one list of prospects, a quotation in minutes, the client
accepts from a link, and the payment link takes the money.
Key control to mention: the server recalculates every premium from the configured rate tables and taxes, so a premium
typed over in the browser is refused. Discounts are limited by the Authority Matrix.
Question for the audience: how many quotations per month, and which lines are quoted most. Motor and fire usually lead.""")

    # 8. Placement --------------------------------------------------------------
    module_slide(d, 'Placement with insurers', 'Module walk-through: front office', [
        ('Broker Slip (Request for Quotation)', 'presents one risk to several insurers; each offer or decline is recorded'),
        ('Compare offers', 'side by side: gross premium, rate, deductibles, difference to the best offer; choose the security'),
        ('Placement Slip', 'the firm order to the lead and the co-insurers; each confirms its share with its policy or certificate number'),
        ('Co-insurance', 'shares must total exactly 100% with one lead; premium, commission, remittance and claims follow the shares'),
        ('Journey per line', 'a line that requires a Placement Slip cannot be issued until every insurer has confirmed'),
        ('Record Issued Policy and direct placement', 'for business the insurer has already issued'),
    ], [('p-rfq-compare', 'Broker Slip: Compare offers', (0, 0, 1, 1)),
        ('p-ps-list', 'Operations > Placement Slips: draft, sent, bound, issued', (0, 0, 1, 0.75))],
        who=['Processing Team'],
        outputs='Broker Slip and Placement Slip PDFs, Placement Pipeline, Market Response (hit ratio), Co-insurance Register', notes="""
This is where most broker systems stop being useful for commercial lines. Walk through one fire or IAR risk:
the Broker Slip goes to three insurers, two offer and one declines, the comparison picks the lead, and the Placement
Slip records each insurer's share and confirmation.
The money trail follows the shares automatically. In the manual example (IAR, PHP 125,000,000.00 sum insured, 60/40
co-insurance) one client bill is split into payables per insurer, and the Co-insurance Register shows each share.
Question: what share of your premium is co-insured, and how many insurers do you place with in a typical month.""")

    # 9. Policy servicing, endorsements, claims -----------------------------------
    module_slide(d, 'Policy servicing, endorsements and claims', 'Module walk-through: front office', [
        ('Policy issue', 'from the Placement Slip, or Convert Policy for motor; client record and premium bill created'),
        ('Motor KYC', 'government ID (type, number and image), chassis, motor and plate or MV file number before issue'),
        ('Policy detail', 'policy schedule PDF, invoice, accounting entries, documents and related records in one place'),
        ('Endorsements', 'personal details, motor details, coverage change, extension, cancellation; extra or return premium billed'),
        ('Claims', 'registration checks the loss date against the policy period and unpaid premium'),
        '  Preliminary Loss Advice e-mail to the insurer; acknowledgement letter, claims data sheet, discharge voucher',
        '  settlement approved by a second Claims user; settlement cash through the broker tracked by insurer share',
        ('Claims Dashboard', 'open and overdue claims, claims by line and region'),
    ], [('s-policy-detail', 'Operations > Policy: policy detail', (0, 0, 1, 0.72)),
        ('c-claim-detail', 'Operations > Claims: claim detail', (0, 0, 1, 0.62))],
        who=['Operations', 'Processing Team', 'Claims'],
        outputs='Policy schedule, endorsement, claim documents, Claims Position and Claims Ageing reports', notes="""
Servicing is where client satisfaction is won or lost. Show the policy detail first: everything about the policy on
one screen, including the accounting entries it created.
For claims, two controls matter to management: a claim is refused when the loss date is outside the policy period or
the premium is unpaid (both configurable), and the settlement needs a second Claims user.
Question: how many claims a month, and do you pay any claims through your own account.""")

    # 10. Renewals --------------------------------------------------------------
    module_slide(d, 'Renewals', 'Module walk-through: retention', [
        ('Pipeline', 'every policy enters the renewal pipeline 90 days before expiry'),
        ('Notices', 'first, second and final notice at 60, 30 and 15 days, in order'),
        ('Renewal Queue', 'days to expiry, status, risk level, owner and contact attempts'),
        ('Renewal Batch', 'notices for up to 500 policies at once'),
        ('Negotiations', 'contacts with the client recorded; renewal terms approved by the Processing Team'),
        ('At-Risk Policies and Lapse Management', 'retention risk score, grace period, win-back campaigns'),
        ('Renewal issue', 'the accepted renewal quotation becomes the next term; commission accrues to the original referrer'),
        ('Retention Analytics and Performance', 'renewal rate, premium retention and cycle time against target'),
    ], [('o-renewal-queue', 'Operations > Renewals > Renewal Queue', (0, 0, 1, 0.85)),
        ('o-renewal-negotiations', 'Operations > Renewals > Negotiations', (0, 0, 1, 0.9))],
        who=['Operations', 'Sales & Marketing', 'Processing Team'],
        outputs='Renewal notices, Renewal Retention report, retention rate on the Executive Dashboard', notes="""
Renewals are the cheapest premium a broker writes. The point of this slide is that nothing expires unnoticed:
the pipeline starts at 90 days, notices go at 60, 30 and 15 days, and an unrenewed policy lapses 30 days after expiry.
All of these day counts are settings, not code.
Question: what is your current retention rate, and how do you follow up renewals today.""")

    # 11. Billing, receipts, collections ---------------------------------------------
    module_slide(d, 'Billing, official receipts and collections', 'Module walk-through: money', [
        ('Billing', 'the bill is raised when the policy, endorsement or renewal is issued; billing statement PDF with payment instructions'),
        ('Payment capture and official receipt', 'front office records the payment; only Accounting posts the official receipt'),
        ('New: documents by e-mail', 'E-mail receipt and E-mail invoice send the PDF as an attachment, with To, Cc and a note'),
        '  optional automatic e-mail when a receipt is recorded or a bill is issued (off until switched on)',
        '  attachment size guard; attachment names shown in the E-mail Outbox',
        ('Collections', 'ageing by bucket, payment reminders before the due date and then on repeat'),
        ('Credit Control', 'Instalment Plans, Premium Warranty Monitor, Client Credit Limits, Remittance Ageing'),
        ('Open entry matching', 'match, unmatch and write off small differences'),
    ], [('a-receipts', 'Accounts > Receipts', (0, 0, 1, 0.9)),
        ('a-cc-warranty', 'Accounts > Credit Control > Premium Warranty Monitor', (0, 0, 1, 0.9))],
        who=['Accounting', 'Front office'],
        outputs='Official receipt, premium invoice, SOA / Premium Receivable, Receivables Ageing, Collection Report', notes="""
Two messages. First, segregation: the front office records the client's payment, but only Accounting issues the
official receipt. Second, new in this release: the official receipt and the premium invoice go to the client by e-mail
with the PDF attached, either from the screen (E-mail receipt, E-mail invoice) or automatically when the broker
switches it on. The commission debit note e-mail to insurers now carries the debit note PDF, and the policy issued
e-mail carries the policy schedule.
The Premium Warranty Monitor shows broker-billed policies whose premium is unpaid near or past the insurer's payment
warranty, so Accounting can remind the client or ask for an extension.
Question: how do you send official receipts today, and how many receipts a month.""")

    # 12. Remittance and direct bill ---------------------------------------------------
    module_slide(d, 'Remittance to insurers and direct bill', 'Module walk-through: money', [
        ('Automated Processing', 'draft remittances per insurer from collected, unremitted premium, net of commission, by share'),
        ('Due dates', 'from each insurer\'s remittance terms (days after collection)'),
        ('Approval Workflow', 'remittances, settlements, transfers and adjustments approved by another user, levels by amount'),
        ('Settlement', 'raises the insurer payment voucher; bank result of the transfer recorded'),
        ('Statements and reconciliation', 'remittance statements for insurers; matching with the bank'),
        ('Direct bill', 'the client pays the insurer; the broker bills commission plus 12% VAT on a debit note'),
        '  the insurer pays net of 10% EWT and issues BIR Form 2307; the debit note e-mail carries the PDF',
    ], [('a-rem-tracking', 'Accounts > Remittance > Tracking', (0, 0, 1, 0.85)),
        ('a-rem-directbill-dn', 'Accounts > Remittance > Direct Bill Processing > Debit Notes', (0, 0, 1, 0.75))],
        who=['Accounting', 'Second approver'],
        outputs='Remittance statement, Remittance Summary, Due to Insurers by Co-insurer, Aged Payables to Insurers, Commission Receivable (Direct Bill)', notes="""
This is the part insurers audit. The system knows, per policy and per insurer share, how much was collected and how much
is still held, so the remittance is built from the collections rather than from a spreadsheet.
Every remittance needs a second user, and the approval level depends on the amount.
For direct bill, explain that no premium bill or collection reminder is raised; the broker bills its commission with
VAT on a debit note and records the insurer's payment and Form 2307.
Question: how many insurers do you remit to each month, and which are on direct bill.""")

    # 13. Commission and incentives ---------------------------------------------------
    module_slide(d, 'Commission and incentives', 'Module walk-through: money', [
        ('Commission Rate Matrix', 'commission rates by insurer and product, with referrer sharing'),
        ('Commission Dashboard', 'brokerage income, commission to referrers, net margin, outstanding payable, WHT'),
        ('Referrer payouts', 'payable only when the premium is fully collected and the referrer has a bank account on file'),
        '  paid by payment voucher less EWT (5% individual, 10% corporate), approved by a second user',
        ('Referrers do not sign in', 'Sales & Marketing enter their business; they are paid from the referrer master'),
        ('Incentive programmes', 'premium volume, policy count, renewal rate or conversion targets for account executives'),
        '  Accounting calculates, a second Accounting user approves; Accounting cannot change the programmes it pays',
    ], [('s-commission-dashboard', 'Commission > Commission Dashboard', (0, 0, 1, 0.62)),
        ('a-inc-calculations', 'Accounts > Incentive > Calculations', (0, 0, 1, 1))],
        who=['Accounting', 'Sales & Marketing'],
        outputs='Broker Commission Statement, Incentive Results, BIR Form 2307 for payees', notes="""
Commission is the broker's revenue, so show it as a dashboard first: income, what goes to referrers, the margin.
Two rules prevent the most common leak: referrer commission becomes payable only when the premium is fully collected,
and only to a referrer with a bank account on file. Payouts are net of expanded withholding tax and need a second user.
Question: how many referrers or sub-agents do you pay, and how often.""")

    # 14. Accounting, period end, reconciliation ---------------------------------------
    s = d.slide('Accounting, period end and reconciliation', 'Module walk-through: finance', notes="""
For a finance audience this is the most important slide. The general ledger is inside the platform: each business event
(policy issued, receipt applied, remittance, direct-bill commission) posts through a posting rule that the broker can
read and simulate, and a change to a rule needs a second user's approval before it reaches the ledger.
Month-end close is one run per period with fixed steps and a checklist; the Accounting Manager approves it.
Bank reconciliation imports the bank file, auto-matches, and is prepared by Accounting and approved by the Accounting
Manager. Insurer statements are imported and matched against the remittances.
Question: how many days does your month-end close take today, and how many bank accounts do you reconcile.""")
    bullets(s, 0.5, 1.25, 5.55, 5.6, [
        ('Posting rules and account determination', 'each business event posts by its rule; changes approved in Configuration Approvals'),
        ('Journals', 'journal vouchers, correction and reversal JVs, recurring journals, all with maker-checker'),
        ('Month-End Close', 'one run per period: accruals, recurring journals, commission deferral, FX revaluation, then the close checklist'),
        ('Period control', 'soft close, close and lock; postings into a soft-closed period only by the Accounting Manager'),
        ('Year-End Close', 'income and expense to retained earnings in adjustment period 13; financial statements'),
        ('Bank Reconciliation', 'statement import (BDO, BPI, Metrobank, generic formats), auto-match, bank items, stale cheques'),
        ('Insurer Reconciliation', 'insurer statements of account imported and matched to the broker\'s remittances'),
        ('Go-live balances', 'opening trial balance and open items imported with templates'),
    ], size=12.5)
    screen(s, 'a-br-workspace', 6.4, 1.25, 6.43, 2.75, 'Accounts > Bank Reconciliation > Reconciliation Workspace',
           crop=(0, 0, 1, 0.6))
    screen(s, 'a-pe-close', 6.4, 4.15, 3.15, 2.75, 'Period End > Month-End Close', crop=(0, 0, 1, 1))
    screen(s, 'a-ir-statements', 9.68, 4.15, 3.15, 2.75, 'Insurer Reconciliation', crop=(0, 0, 1, 1))

    # 15. BIR tax ---------------------------------------------------------------
    s = d.slide('BIR tax working papers', 'Module walk-through: compliance', notes="""
The tax outputs are built from the same ledger lines and vouchers, so the working papers agree with the books.
Form 2307 works both ways: certificates the broker issues to its payees, and certificates received from insurers and
clients, which feed the SAWT.
Filing deadlines are the BIR's, not settings of the system; the broker's tax adviser confirms them.
Question: who prepares your BIR returns today, in-house or an external accountant.""")
    table(s, 0.5, 1.35, 6.3, [
        ['BIR return or attachment', 'Report in iNXT BrokerVerse', 'Period'],
        ['2550M / 2550Q VAT return', 'VAT Summary', 'Month or quarter'],
        ['SLSP', 'SLSP Sales, SLSP Purchases', 'Quarter'],
        ['1601-EQ with QAP', 'QAP', 'Quarter'],
        ['Income tax return with SAWT', 'SAWT', 'Quarter'],
        ['Form 2307 to payees', 'BIR Form 2307, Issued by us', 'Quarter'],
        ['Form 2307 from insurers, clients', 'BIR Form 2307, Received', 'Quarter'],
    ], [2.45, 2.55, 1.3], size=11.5, row_h=0.42, bold_first=True)
    bullets(s, 0.5, 4.5, 6.3, 2.4, [
        ('Premium taxes', 'VAT, documentary stamp tax, local government tax per city or municipality and fire service tax, set per line'),
        ('Tax codes with ATC', 'Master > Finance > Taxation'),
        ('Withholding', 'EWT on commission paid to referrers; 10% withheld by insurers on direct-bill commission'),
        ('Output', 'every report as Excel, CSV or PDF on the company letterhead'),
    ], size=12.5)
    screen(s, 'a-tax-2307', 7.1, 1.35, 5.73, 2.9, 'Accounts > Tax > BIR Form 2307', crop=(0, 0, 1, 1))
    screen(s, 'a-tax-vat', 7.1, 4.4, 5.73, 2.45, 'Accounts > Tax > VAT Summary', crop=(0, 0, 1, 1))

    # 16. Reports and dashboards ---------------------------------------------------
    s = d.slide('Reports and dashboards', 'Module walk-through: management information', notes="""
The catalogue reports in seven groups, each with a preview on screen and a download as Excel, CSV or PDF with the
letterhead. Users see only the reports their role allows.
Dashboards read live figures: they change as soon as a transaction is saved. The Executive Dashboard compares the
key figures with targets set in configuration.
Question: which management reports does your board or principal ask for every month. Note any that are not in the list
for the workshop.""")
    groups = [
        ('Production and placement', 'Production Register, Premium by Product / Month / Insurer, New Business vs Renewals, Lead Conversion Funnel, Placement Pipeline, Market Response, Co-insurance Register, Cession Register'),
        ('Claims and renewals', 'Claims Position, Claims Ageing, Renewal Retention'),
        ('Insurers and commission', 'Remittance Summary, Broker Commission Statement, Commission Receivable (Direct Bill), Due to Insurers by Co-insurer, Aged Payables to Insurers, Incentive Results'),
        ('Receivables and cash', 'SOA / Premium Receivable, Receivables Ageing, Collection Report, Receipts Register, Payables / Disbursement Register'),
        ('Ledger and period end', 'Journal Register, Trial Balance, Trial Balance Movement, General Ledger Detail, Income Statement, Balance Sheet, Month-End Close Status'),
        ('BIR tax and bank', 'VAT Summary, SAWT, QAP, SLSP Sales and Purchases; Bank Reconciliation Statement, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines, Bank Book'),
    ]
    text(s, 0.5, 1.2, 6.2, 0.4, 'Catalogue reports, plus the Report Builder', size=16, bold=True, color=NAVY)
    for i, (g, body) in enumerate(groups):
        y = 1.65 + i * 0.86
        rect(s, 0.5, y + 0.05, 0.08, 0.7, fill=BLUE)
        text(s, 0.7, y, 6.0, 0.3, g, size=12, bold=True, color=NAVY_DARK)
        text(s, 0.7, y + 0.28, 6.0, 0.56, body, size=10.5, color=TEXT)
    screen(s, 's-exec-dashboard', 7.0, 1.25, 5.83, 3.0, 'Dashboard > Executive Dashboard', crop=(0, 0, 1, 0.75))
    text(s, 7.0, 4.45, 5.83, 0.3, 'Dashboards', size=13, bold=True, color=NAVY)
    text(s, 7.0, 4.78, 5.83, 1.0, 'Executive, Sales, Processing, Claims and Commission dashboards, plus the collections, '
         'renewal, remittance, reinsurance and product analytics screens. Figures are live and filtered by period.',
         size=11.5)
    card(s, 7.0, 5.85, 5.83, 1.0, fill=PALE, line=None)
    text(s, 7.2, 5.9, 5.5, 0.9, [[('Every report  ', {'bold': True, 'color': NAVY}),
                                  ('Preview on screen with totals, then Excel, CSV or PDF on the letterhead. Access by '
                                   'role. The Production Register, Collection Report and Claims Position are generated '
                                   'every morning.', {})]], size=11, anchor=MSO_ANCHOR.MIDDLE)

    # 16b. Compliance, connections and branding ----------------------------------------------
    s = d.slide('Compliance, connections and your brand', 'Module walk-through: what this release adds', notes="""
Six areas that a Philippine broker asks about since this release. Each has an optional segment in the Demo Script.
Keep the honest line for each: the compliance officer confirms the AML thresholds and the AMLC file codes; the
accountant confirms the IC working papers; the tax adviser confirms ATCs, invoice wording and VAT treatment; each
partner (SMS gateway, CTPL provider, insurer, bank, BIR EIS) accepts its side of the connection during onboarding.
The IC and NPC registers come with the compliance package of this release.""")
    adds = [('AML/CFT toolkit', 'Client onboarding, risk rating and EDD, list screening, covered and suspicious '
                                'transaction alerts, cases and AMLC report files; a Compliance Officer role'),
            ('IC and NPC registers', 'Licence register with the commission hold, fit and proper, insurer certificate check, '
                                     'complaints register (RA 11765), IC working papers, breach register on the 72-hour clock'),
            ('BIR and EOPT', '0619-E, 1601-EQ, 1604-E and 2551Q reconciled to the ledger, DAT files, EOPT sales invoices, '
                             'EIS connector, CAS books pack, overriding commission from insurers'),
            ('Integrations', 'SMS and Viber, CTPL authentication and COC series, LTO feed, insurer APIs, bank payment files; '
                             'one outbox with retries; delivered in test mode'),
            ('Distribution', 'Lead assignment, channels, dealer programmes with bank letters, fleets, marine open covers, '
                             'facultative placements, comparison reports, campaigns'),
            ('Your brand, your day', 'Theme, logo and sign-in page; branded documents and e-mails; e-signatures; My Work '
                                     'for each person; Report Builder and BI extract')]
    for i, (h, b) in enumerate(adds):
        col, row = i % 3, i // 3
        x = 0.5 + col * 4.15; y = 1.3 + row * 2.8
        card(s, x, y, 3.98, 2.6, fill=LIGHT)
        rect(s, x, y, 3.98, 0.08, fill=BLUE if row == 0 else NAVY)
        text(s, x + 0.25, y + 0.3, 3.5, 0.5, h, size=15, bold=True, color=NAVY_DARK)
        text(s, x + 0.25, y + 0.9, 3.5, 1.6, b, size=12)

    # 17. Reinsurance ------------------------------------------------------------
    module_slide(d, 'Reinsurance', 'Module walk-through: specialty', [
        ('Treaty master', 'quota share, surplus, excess of loss and stop loss; reinsurers, shares and period'),
        '  a new or changed treaty needs a second user\'s approval; reinsurers rated A- or better',
        ('Treaty Dashboard', 'active treaties, capacity, utilisation, premium ceded and claims recovered'),
        ('Cession Tracking', 'policies ceded per treaty with cession %, ceded premium and commission; bordereau'),
        ('Claims Recovery', 'amounts recoverable under treaties; register the recovery'),
        ('Reconciliation', 'our figures against the reinsurer\'s statement; variances above 1% flagged for review'),
        ('Posting', 'confirmed cessions and settled recoveries post through their posting rules'),
    ], [('p-ri-treaties', 'Reinsurance > Treaty Dashboard', (0, 0, 1, 0.85)),
        ('p-ri-cessions', 'Reinsurance > Cession Tracking', (0, 0, 1, 0.75))],
        who=['Processing Team', 'Claims', 'Accounting'],
        outputs='Reinsurance Cession Register, bordereaux (CSV), reinsurance analytics', notes="""
Relevant mainly to insurance and reinsurance brokers. If the prospect does not place reinsurance, spend 30 seconds here
and move on.
For a reinsurance broker: treaties are approved by a second user, cessions are tracked per policy, recoveries are
registered against claims, and the reinsurer's statement is reconciled with a 1% variance threshold.""")

    # 18. Controls: maker-checker and authority ------------------------------------------
    s = d.slide('Controls built in: maker-checker and signing authority', 'Governance', notes="""
This slide is for the compliance officer, the internal auditor and the CFO.
Maker-checker: the person who enters a transaction cannot approve it, and the system refuses if they try.
The Authority Matrix sets approval limits per transaction type and per role or user, in PHP; a new limit takes effect
only after another administrator approves it. Replace the seeded defaults with the board-approved signing authority.
Segregation of duties is checked when roles are assigned: the seeded rules block placement with payment and claims
with payment, and warn on sales with collection.
Question: who signs payments today, and up to what amount.""")
    rows = [['Transaction', 'Maker', 'Checker'],
            ['Quotation approval', 'Quotation creator', 'Another user'],
            ['Renewal terms', 'Operations, Sales', 'Processing Team'],
            ['Claim settlement', 'Claims user', 'Another Claims user'],
            ['Journal voucher', 'Accounting', 'Another Accounting user'],
            ['Payment voucher, cheque, commission payout', 'Accounting', 'Another Accounting user'],
            ['Remittance, settlement, adjustment', 'Accounting', 'Another user, level by amount'],
            ['Direct-bill debit note', 'Accounting', 'Another Accounting user'],
            ['Month-end and year-end close', 'Accounting', 'Accounting Manager'],
            ['Bank and insurer reconciliation', 'Accounting', 'Accounting Manager'],
            ['Posting rule, account determination', 'Accounting, Admin', 'Second approver'],
            ['Reinsurance treaty, incentive batch', 'Creator', 'Another user']]
    table(s, 0.5, 1.3, 7.2, rows, [3.2, 1.9, 2.1], size=11, row_h=0.43)
    x0 = 8.0
    ctrls = [('Authority Matrix', 'approval limits in PHP per transaction type and role or user; a new limit needs a second administrator'),
             ('Delegations', 'time-bound, revocable delegation of approval authority for leave or travel'),
             ('Segregation of Duties', 'rules on pairs of roles checked at assignment: block or warn'),
             ('Access Reviews', 'recertification of every active user; revoke signs the user out'),
             ('Period control', 'no posting into closed or locked periods')]
    for i, (lab, body) in enumerate(ctrls):
        y = 1.3 + i * 1.12
        card(s, x0, y, 4.83, 1.0, fill=LIGHT)
        rect(s, x0, y, 0.08, 1.0, fill=BLUE)
        text(s, x0 + 0.25, y + 0.07, 4.45, 0.3, lab, size=13, bold=True, color=NAVY)
        text(s, x0 + 0.25, y + 0.38, 4.45, 0.6, body, size=11, color=TEXT)

    # 19. Controls: notifications and audit ----------------------------------------------
    s = d.slide('Approval notifications and audit trail', 'Governance', notes="""
New in this release: every maker-checker flow now notifies the people who can approve, and tells the maker the
decision, with the reason when rejected. That covers payment vouchers and cheques, journal vouchers including bank and
year-end adjustments, posting rule and account determination changes, authority limits and access reviews, commission
payouts, insurer and bank reconciliations, month-end close, warranty extensions, remittance settlements, adjustments
and transfers, treaty changes and captured premium payments.
One setting switches all approval notifications on or off. A notification that cannot be created is logged and never
blocks the transaction.
The Audit Trail records who changed what, with the values before and after, for every create, update, approval and
sign-in.""")
    # flow diagram
    flow = [('Maker submits', 'payment voucher, JV, remittance, close run, rule change ...'),
            ('Approvers notified', 'bell notification to every user who can approve'),
            ('Checker decides', 'approve or reject with a reason; never the maker'),
            ('Maker told', 'approved and in effect, or rejected with the reason')]
    for i, (h, b) in enumerate(flow):
        x = 0.5 + i * 3.12
        col = NAVY if i % 2 == 0 else BLUE
        rect(s, x, 1.35, 2.75, 1.45, fill=WHITE, line=col, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08, lw=1.5)
        rect(s, x, 1.35, 2.75, 0.45, fill=col, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
        text(s, x, 1.35, 2.75, 0.45, f'{i + 1}  {h}', size=13, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
             anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.12, 1.88, 2.51, 0.85, b, size=11, color=TEXT, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if i < 3:
            arrow(s, x + 2.78, 1.95, 0.3, 0.25, fill=LINE)
    chip(s, 0.5, 2.98, 'New in this release: every maker-checker flow', fill=PALE_GREEN, color=GREEN, size=11)
    text(s, 5.0, 2.98, 7.8, 0.3, 'One switch: notification.approval_requests (on in the delivered set-up)', size=11,
         color=MUTED, anchor=MSO_ANCHOR.MIDDLE)
    screen(s, 'gs-notif-page', 0.5, 3.5, 4.0, 3.38, 'Notification page: requests and decisions', crop=(0, 0, 1, 0.72))
    screen(s, 'ad-audit', 4.75, 3.5, 4.3, 3.38, 'Master > Audit Trail', crop=(0, 0, 1, 0.75))
    bullets(s, 9.3, 3.5, 3.55, 3.4, [
        ('Audit Trail', 'user, record, action, before and after values, IP and time'),
        ('Sign-in history', 'every attempt with result and reason'),
        ('E-mail Outbox', 'every e-mail queued and sent, with attachments'),
        ('User Access Matrix', 'roles, status, last sign-in, two-factor, downloadable'),
    ], size=11.5)

    # 20. Data privacy and security --------------------------------------------------
    s = d.slide('Data privacy and security', 'Data Privacy Act of 2012 (RA 10173)', notes="""
New in this release, the data privacy functions under Master > Data Privacy:
Consent is recorded per purpose (processing, marketing, sharing with insurers and reinsurers), with the channel, the
privacy notice version and the evidence. A withdrawal is stamped on the record, never deleted, so the history is the
evidence.
Data Subject Requests: access, rectification, erasure or blocking, objection, portability and withdrawal of consent,
numbered DSR-, due a set number of days after receipt (15 calendar days in the delivered set-up, for the DPO to
confirm), assigned with a notification, and a daily job reminds the privacy team of overdue requests.
Export gives the personal data held about a client or prospect as JSON or Excel. Anonymise overwrites the personal data
once the retention period is over; it is refused while there is open business or the records must still be kept.
Amounts, numbers and dates stay for the books.
The broker remains the personal information controller and its DPO decides the purposes, the retention and the breach
notices. iorta TechNXT acts as processor when it hosts or supports.""")
    text(s, 0.5, 1.2, 7.0, 0.35, 'Data privacy: new in this release', size=16, bold=True, color=NAVY)
    priv = [('Consent', 'per purpose: processing, marketing, sharing with insurers; channel, notice version, evidence; withdrawals kept in the history'),
            ('Consent Register', 'consents given, refused and withdrawn across clients and prospects'),
            ('Data Subject Requests', 'access, rectification, erasure or blocking, objection, portability, withdrawal of consent; numbered, due date, assignee'),
            ('Export personal data', 'everything held about a client or prospect, as JSON or Excel, noted on the request'),
            ('Anonymise', 'personal fields overwritten in the party, its policies, quotations, claims and slips; refused while records must be kept')]
    for i, (lab, body) in enumerate(priv):
        y = 1.65 + i * 0.66
        rect(s, 0.5, y + 0.06, 0.08, 0.52, fill=BLUE)
        text(s, 0.72, y, 2.2, 0.64, lab, size=12.5, bold=True, color=NAVY_DARK, anchor=MSO_ANCHOR.MIDDLE)
        text(s, 2.95, y, 4.6, 0.64, body, size=11, anchor=MSO_ANCHOR.MIDDLE)
    # request flow
    text(s, 0.5, 5.05, 7.0, 0.3, 'A data subject request in the system', size=12, bold=True, color=NAVY)
    fl = ['Logged\nDSR- number', 'Assigned\nnotified', 'Export, correct\nor anonymise', 'Closed\nwith outcome']
    for i, t in enumerate(fl):
        x = 0.5 + i * 1.78
        rect(s, x, 5.45, 1.55, 0.85, fill=PALE if i % 2 else PALE_NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
        text(s, x, 5.45, 1.55, 0.85, t, size=11, bold=True, color=NAVY, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if i < 3:
            arrow(s, x + 1.57, 5.77, 0.19, 0.2, fill=LINE)
    text(s, 0.5, 6.4, 7.0, 0.5, 'Overdue requests reminded daily. Retention years, due days and notice version are settings '
         'for the broker\'s DPO.', size=10.5, color=MUTED)
    card(s, 7.85, 1.2, 4.98, 5.68, fill=LIGHT)
    text(s, 8.1, 1.32, 4.6, 0.35, 'Security', size=16, bold=True, color=NAVY)
    bullets(s, 8.05, 1.78, 4.65, 5.0, [
        ('Named users only', 'no shared or referrer sign-in'),
        ('Passwords', '8+ characters, mixed case, digit and symbol, history of 5, 90-day age; lockout after 5 tries'),
        ('Two-factor', 'TOTP authenticator app, compulsory per role when set'),
        ('Sessions', '30-minute access token, idle sign-out, sessions ended on password or role change'),
        ('Permissions', 'checked by the server on every request, not only hidden in the menu'),
        ('Encryption', 'TLS in transit; storage encryption of database, files and backups recommended on every option'),
        ('Application', 'controls mapped to the OWASP Top 10; signed, expiring file links'),
        ('Breach support', 'facts from logs and audit data so the DPO can notify within 72 hours'),
    ], size=11.5, spacing=4)

    # 21. Persona view --------------------------------------------------------------
    s = d.slide('Who does what: the eight delivered roles', 'Persona view', notes="""
The role model is delivered ready to use. Each user holds a role; the menus and the server permissions follow it.
Referrers and sub-agents do not sign in: Sales & Marketing enter their business and they are paid from the referrer
master. That keeps the user count, and the licence cost, to the broker's own staff.
The System Administrator and Operations roles hold the data privacy permissions in the delivered set-up; the broker
can move them to its DPO's role.
Ask the audience to map their own teams to these roles. The answer drives the user count for the proposal.""")
    rows = [['Role', 'Daily work in iNXT BrokerVerse', 'Approves'],
            ['System Administrator', 'Users and roles, masters, configuration, document numbering, schedules, data privacy', 'Authority limits (second admin), configuration'],
            ['Sales & Marketing', 'Prospects, quotations, payment capture, referrer business, renewal follow-up', 'Takes part in incentive programmes'],
            ['Processing Team', 'Broker Slips, Placement Slips, policy issue, endorsements, reinsurance, product configurator', 'Quotations, renewal terms, treaties'],
            ['Operations', 'Client servicing, endorsements, renewals, payment capture, data subject requests', '-'],
            ['Claims', 'Claim registration, follow-up with insurers, settlement, reinsurance recoveries', 'Settlements of another Claims user'],
            ['Accounting', 'Receipts, collections, disbursements, remittance, commission, journals, reconciliation, BIR', 'Vouchers, JVs, remittances, debit notes, incentives'],
            ['Accounting Manager', 'Everything Accounting does, plus period control', 'Month-end and year-end close, bank and insurer reconciliation, credit control, posting rules'],
            ['Compliance Officer', 'AML/CFT: client due diligence, screening, transaction alerts, cases, AMLC report files', 'EDD reviews, screening decisions, cases for filing']]
    table(s, 0.5, 1.3, 12.33, rows, [2.3, 5.83, 4.2], size=11, row_h=0.55, bold_first=True)
    text(s, 0.5, 6.45, 12.3, 0.4, 'Each role lands on its own dashboard. Roles can be added or adjusted in Master > Generals > '
         'User Management, with Role Permissions and the User Access Matrix for review.', size=11, color=MUTED)

    # 22. Technology and deployment ------------------------------------------------------
    s = d.slide('Technology and deployment options', 'Delivery', notes="""
The stack is mainstream and portable: a React web application, a Node.js API and PostgreSQL 16. No proprietary
middleware, no per-CPU database licence.
Four hosting options. On AWS and Azure the region is Singapore, which is a cross-border transfer the broker documents
under the Data Privacy Act; AWS has a Manila Local Zone with a limited set of services. A broker that wants the system of
record in the Philippines uses a local partner or its own data centre.
Infrastructure is optional and priced separately; the broker may host itself at no fee, with our deployment guide and
set-up support at day rates. The monthly prices are indicative estimates from public list prices and cover the standing
environment set of the tier: Dev, UAT and Production for small and medium brokers; Dev, SIT, UAT and Production with high
availability for large brokers. A temporary Pre-Prod, restored from a production backup for the go-live rehearsal and
each major release, is billed per month of use. Daily backups, monitoring and patching are included; hosting fees do not
increase yearly. Confirm with the provider before quoting.""")
    stack = [('Web application', 'React 18 single-page application in the browser; no client install'),
             ('API', 'Node.js 22 with Express; stateless REST API, OpenAPI and Postman collection'),
             ('Database', 'PostgreSQL 16, time zone Asia/Manila; file store for documents'),
             ('Scheduler', 'built-in jobs in Manila time: expiries, notices, reminders, e-mail, reports'),
             ('Run as', 'containers (Docker) or Node.js with a process manager')]
    text(s, 0.5, 1.2, 4.5, 0.35, 'Technology', size=16, bold=True, color=NAVY)
    for i, (lab, body) in enumerate(stack):
        y = 1.65 + i * 0.68
        rect(s, 0.5, y + 0.05, 0.08, 0.56, fill=BLUE)
        text(s, 0.72, y, 4.2, 0.3, lab, size=12, bold=True, color=NAVY_DARK)
        text(s, 0.72, y + 0.28, 4.2, 0.4, body, size=10.5)
    opts = [('AWS', 'Singapore region', 'ECS Fargate, RDS PostgreSQL Multi-AZ, S3 and CloudFront, WAF'),
            ('Microsoft Azure', 'Southeast Asia (Singapore)', 'Container Apps, PostgreSQL Flexible Server, Front Door'),
            ('Local partner', 'Data held in the Philippines', 'VMs with a Philippine hosting partner, second site for DR'),
            ('On-premise', 'Broker\'s data centre', 'Broker hosts at no fee; deployment guide and set-up support')]
    text(s, 5.3, 1.2, 7.5, 0.35, 'Deployment options', size=16, bold=True, color=NAVY)
    for i, (h, sub, body) in enumerate(opts):
        x = 5.3 + i * 1.9
        card(s, x, 1.65, 1.78, 2.2, fill=WHITE, line=NAVY)
        rect(s, x, 1.65, 1.78, 0.42, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.25)
        text(s, x, 1.65, 1.78, 0.42, h, size=12.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.08, 2.12, 1.62, 0.5, sub, size=10.5, bold=True, color=BLUE, align=PP_ALIGN.CENTER)
        text(s, x + 0.08, 2.65, 1.62, 1.15, body, size=10, align=PP_ALIGN.CENTER)
    text(s, 5.3, 4.05, 7.5, 0.3, 'Indicative hosting per month, full environment set (optional, PHP, excl. VAT)', size=12,
         bold=True, color=NAVY)
    table(s, 5.3, 4.4, 7.53, [
        ['Tier (named users)', 'AWS', 'Azure', 'Local partner'],
        ['Small (1 to 25)', '43,000.00', '46,000.00', '42,000.00'],
        ['Medium (26 to 100)', '69,000.00', '73,000.00', '67,000.00'],
        ['Large (101 to 300)', '143,000.00', '150,000.00', '135,000.00'],
        ['Enterprise (above 300)', '256,000.00', '269,000.00', '242,000.00'],
    ], [2.43, 1.7, 1.7, 1.7], size=11, row_h=0.36, bold_first=True)
    text(s, 0.5, 5.25, 4.5, 1.6, [[('Every option  ', {'bold': True, 'color': NAVY}),
                                   ('separate Dev, UAT and production environments (and SIT for large brokers), HTTPS, daily backups with point-in-time '
                                    'restore, monitoring, and production with two API instances and a standby database.',
                                    {})]], size=11)
    text(s, 5.3, 6.3, 7.5, 0.6, 'Small and medium: Dev, UAT, Production. Large: Dev, SIT, UAT, Production. Temporary Pre-Prod '
         'billed per month of use. Self-hosting has no hosting fee.', size=10.5, color=MUTED)

    # 23. Implementation ------------------------------------------------------------
    s = d.slide('Implementation approach and timeline', 'Delivery', notes="""
Configure, do not customise: the broker is fitted to the product through masters and settings, not code changes.
A requirement that configuration cannot meet goes into the fit-gap register and becomes a change request only if the
steering committee approves it; it does not move the go-live by default.
Data drives the timeline. The data requests go out in week 1: insurer agreements, commission rates, chart of accounts,
in-force policies, open receivables and the trial balance. Every load uses the delivered upload templates and is
rehearsed before cutover.
The size is agreed at mobilisation: small 8 weeks, medium 12 weeks, large 16 to 20 weeks to hypercare exit. Hypercare
always covers the first month-end close.""")
    phases = ['Mobilise, discovery and fit-gap', 'Environments and configuration', 'Data migration and integrations',
              'Training, system test and UAT', 'Cutover and go-live', 'Hypercare to first month-end']
    for i, p in enumerate(phases):
        x = 0.5 + i * 2.06
        rect(s, x, 1.3, 2.1, 0.75, fill=NAVY if i < 4 else BLUE, shape=MSO_SHAPE.CHEVRON if i else MSO_SHAPE.PENTAGON)
        text(s, x + 0.35, 1.3, 1.45, 0.75, p, size=10.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
             anchor=MSO_ANCHOR.MIDDLE)
    # gantt
    gx, gy, gw = 2.6, 2.45, 9.2
    wk = gw / 20
    text(s, 0.5, gy - 0.05, 2.0, 0.3, 'Week', size=10.5, bold=True, color=MUTED)
    for k in range(20):
        text(s, gx + k * wk, gy - 0.05, wk, 0.3, str(k + 1), size=9.5, color=MUTED, align=PP_ALIGN.CENTER)
    plans = [('Small', 'up to 25 users, 1 office', 6, 2, '8 weeks'),
             ('Medium', '26 to 75 users, up to 3 offices', 9, 3, '12 weeks'),
             ('Large (variant)', 'one office cluster, simple mix', 12, 4, '16 weeks'),
             ('Large', 'more than 75 users, many insurers', 14, 6, '20 weeks')]
    for i, (lab, sub, build_w, hyper_w, tot) in enumerate(plans):
        y = gy + 0.4 + i * 0.66
        text(s, 0.5, y - 0.02, 2.05, 0.3, lab, size=12, bold=True, color=NAVY_DARK)
        text(s, 0.5, y + 0.25, 2.05, 0.3, sub, size=9, color=MUTED)
        rect(s, gx, y + 0.02, build_w * wk - 0.03, 0.42, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
        text(s, gx, y + 0.02, build_w * wk, 0.42, 'Mobilise to cutover', size=10, color=WHITE, anchor=MSO_ANCHOR.MIDDLE,
             align=PP_ALIGN.CENTER)
        rect(s, gx + build_w * wk, y + 0.02, hyper_w * wk - 0.03, 0.42, fill=BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
             radius=0.2)
        text(s, gx + build_w * wk, y + 0.02, hyper_w * wk, 0.42, 'Hypercare', size=10, color=WHITE,
             anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)
        text(s, gx + (build_w + hyper_w) * wk + 0.05, y + 0.02, 1.2, 0.42, tot, size=10.5, bold=True, color=NAVY,
             anchor=MSO_ANCHOR.MIDDLE)
    for i, (h, b) in enumerate([('Configure, do not customise', 'masters, settings and templates; gaps go to a register'),
                                ('Data drives the timeline', 'data requests in week 1; templates for every load'),
                                ('Key users own the result', 'one key user per team tests, signs and trains'),
                                ('Evidence for every acceptance', 'written sign-off at the end of each phase')]):
        x = 0.5 + i * 3.1
        card(s, x, 5.6, 2.95, 1.25, fill=PALE_NAVY, line=None)
        text(s, x + 0.15, 5.67, 2.65, 0.35, h, size=12, bold=True, color=NAVY)
        text(s, x + 0.15, 6.03, 2.65, 0.8, b, size=11)

    # 24. Support -------------------------------------------------------------------
    s = d.slide('Support model', 'After go-live', notes="""
Three levels. The broker's key users and System Administrator are the first line: how-to questions, user and password
resets, settings and master data. iorta TechNXT application support is L2: triage, reproduction, configuration and data
corrections under change control. iorta TechNXT engineering is L3: code defects, performance, infrastructure,
security incidents and releases.
Standard hours are 8:00 to 18:00 Manila time, Monday to Friday, except Philippine regular holidays. 24x7 cover for
Severity 1 is an option. The targets shown are our standard proposal; the support agreement fixes the final values.
AMC or the subscription covers corrections, product updates, regulatory form updates released for all customers and
standard support.""")
    lv = [('L1', 'Broker key users and System Administrator', 'How-to, users and roles, password and two-factor resets, settings, master data, ticket with evidence'),
          ('L2', 'iorta TechNXT application support', 'Triage, reproduction, configuration and data corrections under change control, workarounds, known errors'),
          ('L3', 'iorta TechNXT engineering', 'Code defects, performance, infrastructure, security incidents, root cause, fixes and releases')]
    for i, (k, who, what) in enumerate(lv):
        y = 1.3 + i * 1.2
        w = 5.6 - i * 0.0
        rect(s, 0.5, y, 0.95, 1.05, fill=[NAVY_DARK, NAVY, BLUE][i], shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
        text(s, 0.5, y, 0.95, 1.05, k, size=22, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        card(s, 1.55, y, 4.6, 1.05, fill=LIGHT)
        text(s, 1.7, y + 0.06, 4.35, 0.3, who, size=12.5, bold=True, color=NAVY)
        text(s, 1.7, y + 0.38, 4.35, 0.65, what, size=10.5)
    text(s, 0.5, 5.0, 5.65, 0.3, 'Service hours', size=13, bold=True, color=NAVY)
    bullets(s, 0.5, 5.35, 5.65, 1.5, [
        ('Standard', '8:00 to 18:00 Manila time, Monday to Friday, except Philippine regular holidays'),
        ('Optional', '24x7 for Severity 1, reported by telephone'),
        ('Maintenance window', 'agreed with the broker; default Saturday 20:00 to Sunday 06:00'),
    ], size=11.5, spacing=3)
    text(s, 6.5, 1.25, 6.3, 0.3, 'Severity levels and targets (standard proposal)', size=13, bold=True, color=NAVY)
    table(s, 6.5, 1.62, 6.33, [
        ['Severity', 'First response', 'Restore or workaround', 'Update'],
        ['P1 Critical', '30 minutes', '4 service hours', 'Every hour'],
        ['P2 High', '2 service hours', '2 business days', 'Every 4 hours'],
        ['P3 Medium', '1 business day', '5 business days', 'Every 3 days'],
        ['P4 Low', '2 business days', 'Planned', 'Weekly'],
    ], [1.45, 1.55, 1.85, 1.48], size=11, row_h=0.42, bold_first=True)
    bullets(s, 6.5, 3.95, 6.33, 2.9, [
        ('P1 examples', 'nobody can sign in, official receipts cannot be issued, journals post wrong amounts'),
        ('One service desk', 'support portal or mailbox for all tickets, telephone for P1'),
        ('Monthly service report', 'tickets, targets met, problems, releases, backups and DR drills'),
        ('Releases', 'tested in UAT with a regression run before production'),
        ('Covered by AMC or subscription', 'corrections, OOTB updates, regulatory form updates, standard support'),
    ], size=11.5, spacing=4)

    # 25. Commercial models ------------------------------------------------------------
    s = d.slide('Commercial models', 'Commercials', notes="""
Two models, same product. Prices are per named user, in PHP, excluding 12% VAT, on graduated slabs: the first 25 users
at the Small rate, users 26 to 100 at the Medium rate, and so on, so the price never drops when a broker crosses a
tier and the effective price per user falls as it grows.
Perpetual: one-time licence on go-live, AMC at 22% of the licence fee a year from Year 2 after a 12-month warranty,
increasing 5% a year.
Subscription: monthly in advance, increasing 5% at each anniversary, with a minimum number of billable users; the
onboarding fee equals the implementation fee because the set-up work is the same.
Implementation is calculated from base man-days per tier plus 6 man-days per extra line of business, at the blended
day rate of PHP 16,100.00. Quotations are valid 90 days. The pricing workbook governs where figures differ.""")
    for i, (head, sub, rowsx, notes_l) in enumerate([
        ('Model A: perpetual licence with AMC', 'One-time licence per named user, payable on go-live',
         [['Tier', 'Licence per user', 'Implementation, reference'],
          ['Small (1 to 25)', 'PHP 90,000.00', 'PHP 1,130,000.00 (5 lines)'],
          ['Medium (26 to 100)', 'PHP 78,000.00', 'PHP 2,090,000.00 (8 lines)'],
          ['Large (101 to 300)', 'PHP 66,000.00', 'PHP 3,700,000.00 (12 lines)'],
          ['Enterprise (above 300)', 'PHP 54,000.00', 'PHP 5,800,000.00 (16 lines)']],
         ['AMC 22% of the licence fee a year, from Year 2 (12-month warranty)', 'AMC increases 5% each year',
          'Lowest cost over five years: 13% to 18% below subscription']),
        ('Model B: subscription', 'Per named user per month, billed monthly in advance',
         [['Tier', 'Per user per month', 'Minimum billable users'],
          ['Small (1 to 25)', 'PHP 3,200.00', '10'],
          ['Medium (26 to 100)', 'PHP 2,800.00', '26'],
          ['Large (101 to 300)', 'PHP 2,400.00', '101'],
          ['Enterprise (above 300)', 'PHP 2,000.00', '301']],
         ['Increases 5% at each contract anniversary', 'Onboarding fee equal to the implementation fee',
          'Lower Year 1 cash; break-even with perpetual in Year 4'])]):
        x = 0.5 + i * 6.25
        card(s, x, 1.25, 6.08, 4.35, fill=WHITE, line=NAVY if i == 0 else BLUE)
        rect(s, x, 1.25, 6.08, 0.5, fill=NAVY if i == 0 else BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
        text(s, x + 0.2, 1.25, 5.7, 0.5, head, size=15, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.2, 1.82, 5.7, 0.3, sub, size=11, color=MUTED)
        table(s, x + 0.15, 2.18, 5.78, rowsx, [1.85, 1.6, 2.33] if i == 0 else [1.95, 1.9, 1.93], size=10.5,
              row_h=0.33, bold_first=True, header_fill=NAVY if i == 0 else BLUE)
        bullets(s, x + 0.2, 4.0, 5.7, 1.5, notes_l, size=11.5, spacing=3)
    cards = [('Implementation', 'Base man-days by tier plus 6 per extra line of business, at PHP 16,100.00 a day. Payable 40% signing, 40% UAT sign-off, 20% go-live.'),
             ('Infrastructure', 'Optional and quoted separately: AWS, Azure or local partner. Self-hosting has no fee.'),
             ('Change requests', 'Day rates: BA PHP 18,000.00, developer PHP 16,000.00, QA PHP 12,000.00, PM PHP 22,000.00. Example: 5 days, PHP 81,050.00.')]
    for i, (h, b) in enumerate(cards):
        x = 0.5 + i * 4.16
        card(s, x, 5.75, 4.0, 1.12, fill=PALE_NAVY, line=None)
        text(s, x + 0.15, 5.79, 3.7, 0.3, h, size=12, bold=True, color=NAVY)
        text(s, x + 0.15, 6.08, 3.7, 0.78, b, size=10.5)

    # 26. Indicative investment ----------------------------------------------------------
    s = d.slide('Indicative investment for reference brokers', 'Commercials', notes="""
These are the reference user counts from the pricing workbook, including implementation or onboarding, excluding VAT
and optional items. They show the shape of the decision rather than a quotation for this prospect.
Our recommendation: subscription for Small and Medium brokers, for lower Year 1 cash and no capital approval;
perpetual for Large and Enterprise brokers, or any broker planning four years or more ahead.
At the recommended prices the Year 1 subscription is about 2.3% of estimated commission income for a Small broker and
0.8% for an Enterprise broker, within the 3% to 7% of revenue that insurers and brokers typically spend on IT.
The income figures per tier are estimates mapped to the IC ranking.
Close the slide by offering to run the workbook with the prospect's own user count and lines of business.""")
    table(s, 0.5, 1.3, 7.6, [
        ['Reference broker', 'Perpetual, 5 years', 'Subscription, 5 years', 'Break-even'],
        ['Small: 15 users, 5 lines', 'PHP 3,760,107.00', 'PHP 4,312,764.00', 'Year 4'],
        ['Medium: 60 users, 8 lines', 'PHP 11,792,173.00', 'PHP 13,892,748.00', 'Year 4'],
        ['Large: 180 users, 12 lines', 'PHP 29,767,284.00', 'PHP 35,660,251.00', 'Year 4'],
        ['Enterprise: 400 users, 16 lines', 'PHP 57,817,674.00', 'PHP 70,118,348.00', 'Year 4'],
    ], [2.55, 1.85, 1.95, 1.25], size=11.5, row_h=0.5, bold_first=True)
    text(s, 0.5, 3.9, 7.6, 0.3, 'Year 1 subscription as a share of estimated commission income', size=13, bold=True,
         color=NAVY)
    bars = [('Small', 2.3), ('Medium', 1.8), ('Large', 1.2), ('Enterprise', 0.8)]
    for i, (lab, pct) in enumerate(bars):
        y = 4.35 + i * 0.5
        text(s, 0.5, y, 1.3, 0.4, lab, size=11.5, bold=True, color=NAVY_DARK, anchor=MSO_ANCHOR.MIDDLE)
        rect(s, 1.85, y + 0.07, 5.0, 0.26, fill=LIGHT)
        rect(s, 1.85, y + 0.07, 5.0 * pct / 3.0, 0.26, fill=BLUE)
        text(s, 1.95 + 5.0 * pct / 3.0, y, 1.0, 0.4, f'{pct}%', size=11.5, bold=True, color=NAVY, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 0.5, 6.4, 7.6, 0.45, 'Prices in PHP, excluding 12% VAT. Totals include implementation or onboarding and '
         'exclude hosting and optional services. Valid 90 days. Income per tier is an estimate.', size=10, color=MUTED)
    card(s, 8.5, 1.3, 4.33, 5.55, fill=NAVY_DARK, line=None)
    text(s, 8.75, 1.45, 3.9, 0.4, 'Our recommendation', size=16, bold=True, color=WHITE)
    recs = [('Small and Medium brokers', 'Subscription: lower Year 1 cash, no capital approval, about 2% of commission income.'),
            ('Large and Enterprise brokers', 'Perpetual: 13% to 18% lower cost over five years for the reference user counts.'),
            ('Every broker', 'Infrastructure quoted separately, with self-hosting always shown, so the software price stays comparable.'),
            ('Your figures', 'We run the pricing workbook with your user count and lines of business for the proposal.')]
    for i, (h, b) in enumerate(recs):
        y = 2.0 + i * 1.2
        text(s, 8.75, y, 3.9, 0.3, h, size=12.5, bold=True, color=RGBColor(0x7F, 0xBE, 0xF5))
        text(s, 8.75, y + 0.32, 3.9, 0.85, b, size=11.5, color=WHITE)

    # 27. Why iorta TechNXT -------------------------------------------------------------
    s = d.slide('Why iorta TechNXT and iNXT BrokerVerse', 'The case', notes="""
Summarise in four points and stop. Each point can be proven in the demo.
1. Built for Philippine non-life broking: taxes, BIR, LGU rates, local banks, local payment gateways, Data Privacy Act.
2. One system: the front office, the money and the books, so there is nothing to reconcile between systems.
3. Controls the auditor expects, already in the product.
4. A predictable project and price: configure-not-customise, 8 to 20 weeks, published prices and day rates.
Evidence to quote: 497 test cases prepared for this release, 480 passed, with the remaining items tracked in the defect
register; a user manual opened per screen with F1 and role guides; the go-live data workbench with its workbooks and the
upload templates.""")
    why = [('Built for the Philippines', 'Premium taxes by city, BIR returns and DAT files, EOPT invoices, AML/CFT and AMLC '
                                         'reports, IC registers, CTPL authentication, local bank files, Data Privacy Act functions'),
           ('One system, one ledger', 'Prospect, placement, policy, claims and renewals in the same system as billing, remittance, '
                                      'commission, the general ledger and the month-end close'),
           ('Controls in the product', 'Maker-checker on money and configuration, Authority Matrix, segregation of duties, '
                                       'access reviews, approval notifications, audit trail'),
           ('Predictable delivery', 'Configure, do not customise; 8, 12 or 16 to 20 weeks; written acceptance per phase; '
                                    'hypercare through the first month-end close'),
           ('Open pricing', 'Published per-user prices on graduated slabs, perpetual or subscription, AMC terms and day rates '
                            'for change requests'),
           ('Ready to hand over', '497 test cases for release 1.0; user manual with in-screen help and role guides; '
                                  'go-live data workbench; reports book, support runbooks and data dictionary')]
    for i, (h, b) in enumerate(why):
        col, row = i % 3, i // 3
        x = 0.5 + col * 4.15; y = 1.3 + row * 2.8
        card(s, x, y, 3.98, 2.6, fill=LIGHT)
        rect(s, x, y, 3.98, 0.08, fill=BLUE if row == 0 else NAVY)
        rect(s, x + 0.25, y + 0.35, 0.5, 0.5, fill=NAVY if row == 0 else BLUE, shape=MSO_SHAPE.OVAL)
        text(s, x + 0.25, y + 0.35, 0.5, 0.5, str(i + 1), size=15, bold=True, color=WHITE, align=PP_ALIGN.CENTER,
             anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.9, y + 0.33, 2.95, 0.55, h, size=14.5, bold=True, color=NAVY_DARK, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.25, y + 1.0, 3.5, 1.5, b, size=11.5)

    # 28. Next steps --------------------------------------------------------------------
    s = d.slide('Next steps', 'Proposed path to a decision', notes="""
Agree the next step before the meeting ends, with a date and owner for each.
Demo: 60 minutes for the full team or 30 minutes for management, run on the UAT data set, with the prospect's own
examples where they send them in advance.
Workshop: half a day with the process owners to confirm users, lines of business, insurers, volumes, hosting and
integrations. Its output sizes the implementation.
Proposal: commercials from the pricing workbook with the agreed user count and lines, valid 90 days.
Contract: licence or subscription agreement, data processing agreement, support agreement; then the kick-off.
Durations in weeks are planning assumptions [to confirm with the account manager].""")
    steps = [('1', 'Demo', 'Your team sees its own day in the system: 60 or 30 minutes on the UAT data set',
              'Week 1 [to confirm]'),
             ('2', 'Discovery workshop', 'Users, lines of business, insurers, volumes, hosting, integrations, data sources',
              'Week 2 to 3 [to confirm]'),
             ('3', 'Proposal', 'Commercials from the pricing workbook, implementation plan, hosting option',
              'Within 5 working days of the workshop [to confirm]'),
             ('4', 'Contract and kick-off', 'Licence or subscription, data processing and support agreements; mobilisation',
              'On signing')]
    for i, (n, h, b, when) in enumerate(steps):
        x = 0.5 + i * 3.1
        rect(s, x, 1.4, 2.9, 3.4, fill=WHITE, line=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06, lw=1.25)
        rect(s, x, 1.4, 2.9, 0.95, fill=NAVY if i % 2 == 0 else BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.15)
        text(s, x + 0.2, 1.4, 0.6, 0.95, n, size=30, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.75, 1.4, 2.05, 0.95, h, size=16, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.2, 2.5, 2.5, 1.5, b, size=12.5)
        text(s, x + 0.2, 4.1, 2.5, 0.6, when, size=11, bold=True, color=BLUE)
        if i < 3:
            arrow(s, x + 2.93, 2.85, 0.15, 0.3, fill=LINE)
    card(s, 0.5, 5.15, 12.33, 1.7, fill=PALE_NAVY, line=None)
    text(s, 0.75, 5.25, 6.0, 0.35, 'What we ask from you for the demo and workshop', size=13, bold=True, color=NAVY)
    bullets(s, 0.75, 5.65, 6.3, 1.2, ['Two or three recent policies, one claim and one remittance to use as examples',
                                       'The teams and number of users per team', 'Lines of business and insurers you place with'],
            size=11.5, spacing=2)
    text(s, 7.3, 5.25, 5.3, 0.35, 'Contact', size=13, bold=True, color=NAVY)
    text(s, 7.3, 5.65, 5.3, 1.2, ['[Account manager name], iorta TechNXT', '[Mobile number]  |  [E-mail address]',
                                  '[Website]'], size=12, spacing=3)

    d.save(OUT)
    print('wrote', OUT, d.n, 'slides')


if __name__ == '__main__':
    build()
