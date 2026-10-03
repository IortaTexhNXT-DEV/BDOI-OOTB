"""Build the eleven BrokerVerse Solution Architecture documents (.docx and .pdf) in docs/architecture.

    python3 docs/architecture/tools/render_diagrams.py      # diagrams/*.dot, *.seq -> PNG + SVG (ER diagrams from the snapshot)
    python3 docs/architecture/tools/build_architecture.py   # tools/src/NN_*.md -> NN_BrokerVerse_*.docx / .pdf
    python3 docs/architecture/tools/build_architecture.py 03 # one document only

Pipeline: python-docx writes each document (cover, document control, table of contents field, body, related documents,
glossary); LibreOffice (UNO, headless) updates the table of contents and page fields and saves the final .docx and the
.pdf. Fonts: Nunito (python3 docs/manual/tools/install_fonts.py); without it LibreOffice substitutes a sans-serif font.

Source format (tools/src/NN_*.md), one block per blank-line-separated paragraph:
    # Chapter / ## Section / ### Subsection      (chapters and sections are numbered automatically)
    plain text with **bold**, *italic*, `code`
    1. numbered steps        - bullets
    | a | b | tables (first row = header; |---| rows skipped); {widths: 20,80} and {size: 8} before a table
    ![Caption](diagram)      diagrams/diagram.png with a numbered caption (wide diagrams get a landscape page)
    > **Note:** / **Recommended:** / **Gap:** text     call-out box
    {generate: name}         generated content (see GENERATORS: database inventory, load-test results ...)
    \\pagebreak
Glossary: tools/src/glossary.md; each document lists only the terms it uses.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor, Emu
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                                   # docs/architecture
REPO = os.path.dirname(os.path.dirname(ROOT))
SRC = os.path.join(HERE, 'src')
DIAGRAMS = os.path.join(ROOT, 'diagrams')
SNAPSHOT = os.path.join(HERE, 'data', 'db_snapshot.json')
LOGO = os.path.join(REPO, 'brokerverse', 'public', 'bdoi', 'iorta-technxt.png')
sys.path.insert(0, HERE)
import table_catalog as catalog  # noqa: E402

PRODUCT = 'BrokerVerse OOTB'
SERIES = 'Solution Architecture'
VERSION = '1.1'
HISTORY = [
    ('1.0', '29 September 2026', 'Initial issue'),
    ('1.1', '29 September 2026', 'Updated to the current system: placement journey, co-insurance, posting rules, period end and BIR tax, bank reconciliation, document numbering, commission rate matrix, single PDF engine, uploads and go-live imports, housekeeping, business time zone, broker roles, deployment on the BrokerVerse URL'),
]
DATE = '29 September 2026'
AUTHOR = 'iorta TechNXT'
FONT = 'Nunito'
BLUE = RGBColor(0x00, 0x65, 0xB3)
CYAN = RGBColor(0x00, 0xAC, 0xF1)
TEXT = RGBColor(0x1F, 0x29, 0x37)
GREY = RGBColor(0x5B, 0x67, 0x76)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
HEX_BLUE, HEX_CYAN, HEX_BG, HEX_AMBER = '0065B3', '00ACF1', 'EAF6FD', 'E0B23A'
PAGE_W, PAGE_H, MARGIN = Cm(21.0), Cm(29.7), Cm(2.0)
PORTRAIT_W = PAGE_W - 2 * MARGIN
LANDSCAPE_W = PAGE_H - 2 * MARGIN

DOCS = [
    ('01', 'Solution_Component_Diagram_Application_Architecture', 'Solution Component Diagram and Application Architecture'),
    ('02', 'Database_Design', 'Database Design'),
    ('03', 'Database_Inventory', 'Database Inventory'),
    ('04', 'Technology_Stack', 'Technology Stack'),
    ('05', 'Shared_Service_Components', 'Shared Service Components'),
    ('06', 'Capacity_and_Performance', 'Capacity and Performance'),
    ('07', 'High_Availability_and_Resiliency', 'High Availability and Resiliency'),
    ('08', 'RTO_and_RPO', 'RTO and RPO'),
    ('09', 'Backup_and_Recovery', 'Backup and Recovery'),
    ('10', 'Data_Archival_Housekeeping_and_Restoration', 'Data Archival, Housekeeping and Restoration'),
    ('11', 'Monitoring', 'Monitoring'),
]


# ------------------------------------------------------------------ low-level helpers (same approach as docs/manual/tools/build_manual.py)
def set_font(obj, size=None, bold=None, color=None, italic=None, name=FONT):
    f = obj.font
    f.name = name
    rpr = obj.element.get_or_add_rPr() if hasattr(obj, 'element') else None
    if rpr is not None:
        fonts = rpr.find(qn('w:rFonts'))
        if fonts is None:
            fonts = OxmlElement('w:rFonts'); rpr.insert(0, fonts)
        for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
            fonts.set(qn(a), name)
    if size: f.size = Pt(size)
    if bold is not None: f.bold = bold
    if italic is not None: f.italic = italic
    if color is not None: f.color.rgb = color


def shade(cell, hex_fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_fill)
    tcpr.append(shd)


def cell_margins(cell, top=50, bottom=50, left=90, right=90):
    tcpr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement('w:tcMar')
    for k, v in (('top', top), ('bottom', bottom), ('start', left), ('end', right), ('left', left), ('right', right)):
        e = OxmlElement(f'w:{k}'); e.set(qn('w:w'), str(v)); e.set(qn('w:type'), 'dxa'); mar.append(e)
    tcpr.append(mar)


def table_borders(table, color='C9D6E3', size=4, left_only=None):
    tblpr = table._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        e = OxmlElement(f'w:{edge}')
        if left_only:
            val, sz, col = ('single', left_only[1], left_only[0]) if edge == 'left' else ('nil', 0, 'auto')
        else:
            val, sz, col = 'single', size, color
        e.set(qn('w:val'), val); e.set(qn('w:sz'), str(sz)); e.set(qn('w:space'), '0'); e.set(qn('w:color'), col)
        borders.append(e)
    tblpr.append(borders)


def fixed_layout(table, widths):
    tblpr = table._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblpr.append(lay)
    for old in tblpr.findall(qn('w:tblW')):
        tblpr.remove(old)
    tw = OxmlElement('w:tblW'); tw.set(qn('w:w'), str(int(sum(widths) / 635))); tw.set(qn('w:type'), 'dxa'); tblpr.append(tw)
    for i, gc in enumerate(table._tbl.tblGrid.findall(qn('w:gridCol'))):
        gc.set(qn('w:w'), str(int(widths[i] / 635)))
    for row in table.rows:
        for i, c in enumerate(row.cells):
            c.width = widths[i]


def repeat_header(row):
    e = OxmlElement('w:tblHeader'); e.set(qn('w:val'), 'true'); row._tr.get_or_add_trPr().append(e)


def no_split(row):
    e = OxmlElement('w:cantSplit'); e.set(qn('w:val'), 'true'); row._tr.get_or_add_trPr().append(e)


def para_border(p, edge='bottom', color=HEX_CYAN, size=12, space=4):
    ppr = p._p.get_or_add_pPr()
    pbdr = OxmlElement('w:pBdr')
    e = OxmlElement(f'w:{edge}'); e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), str(size)); e.set(qn('w:space'), str(space)); e.set(qn('w:color'), color)
    pbdr.append(e); ppr.append(pbdr)


def add_field(par, instr, placeholder=''):
    r = par.add_run(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'begin'); r._r.append(fc)
    r = par.add_run(); it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = f' {instr} '; r._r.append(it)
    r = par.add_run(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'separate'); r._r.append(fc)
    r = par.add_run(placeholder)
    r2 = par.add_run(); fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), 'end'); r2._r.append(fc)
    return r


INLINE = re.compile(r'(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)')


def add_inline(par, text, size=None, color=None, bold=None):
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith('**'):
            r = par.add_run(part[2:-2]); set_font(r, size=size, bold=True, color=color)
        elif part.startswith('`'):
            r = par.add_run(part[1:-1]); set_font(r, size=(size or 10) - 1, color=RGBColor(0x0B, 0x3D, 0x7A), name='Liberation Mono')
        elif part.startswith('*') and len(part) > 2:
            r = par.add_run(part[1:-1]); set_font(r, size=size, italic=True, color=color, bold=bold)
        else:
            r = par.add_run(part); set_font(r, size=size, color=color, bold=bold)


def setup_styles(doc):
    st = doc.styles
    normal = st['Normal']
    set_font(normal, size=10, color=TEXT)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.1
    lang = OxmlElement('w:lang'); lang.set(qn('w:val'), 'en-PH'); normal.element.get_or_add_rPr().append(lang)
    for name, size, color, before, after in (('Heading 1', 18, BLUE, 0, 8), ('Heading 2', 13.5, BLUE, 12, 4), ('Heading 3', 11.5, CYAN, 8, 3)):
        s = st[name]
        set_font(s, size=size, bold=True, color=color)
        s.font.italic = False
        s.paragraph_format.space_before = Pt(before)
        s.paragraph_format.space_after = Pt(after)
        s.paragraph_format.keep_with_next = True
    s = st['List Bullet']; set_font(s, size=10, color=TEXT); s.paragraph_format.space_after = Pt(2)
    cap = st.add_style('Figure Caption', 1); cap.base_style = normal
    set_font(cap, size=8.5, italic=True, color=GREY)
    cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER; cap.paragraph_format.space_after = Pt(8)
    step = st.add_style('Step', 1); step.base_style = normal
    step.paragraph_format.left_indent = Cm(0.7); step.paragraph_format.first_line_indent = Cm(-0.7)
    step.paragraph_format.space_after = Pt(3); step.paragraph_format.tab_stops.add_tab_stop(Cm(0.7))
    cell = st.add_style('Table Text', 1); cell.base_style = normal
    set_font(cell, size=8.5, color=TEXT)
    cell.paragraph_format.space_after = Pt(0); cell.paragraph_format.line_spacing = 1.0


# ------------------------------------------------------------------ sections, header / footer
def section_layout(sec, landscape=False):
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width, sec.page_height = PAGE_H, PAGE_W
    else:
        sec.orientation = WD_ORIENT.PORTRAIT
        sec.page_width, sec.page_height = PAGE_W, PAGE_H
    sec.left_margin = sec.right_margin = MARGIN
    sec.top_margin, sec.bottom_margin = Cm(2.2), Cm(2.0)
    sec.header_distance, sec.footer_distance = Cm(1.0), Cm(1.0)


def clear_tabs(p):
    """Clear the centre / right tab stops of the Header and Footer styles (Word: 8.25 / 16.51 cm; python-docx template: 3 / 6 in)."""
    for pos in (Cm(8.255), Cm(16.51), Emu(2971800), Emu(5943600)):
        p.paragraph_format.tab_stops.add_tab_stop(pos, WD_TAB_ALIGNMENT.CLEAR)


def header_footer(sec, num, title, width):
    for part in (sec.header, sec.footer, sec.first_page_header, sec.first_page_footer):
        part.is_linked_to_previous = False
    hp = sec.header.paragraphs[0]
    hp.text = ''
    clear_tabs(hp)
    hp.paragraph_format.tab_stops.add_tab_stop(width, WD_TAB_ALIGNMENT.RIGHT)
    r = hp.add_run(f'{PRODUCT}  |  {num} {title}'); set_font(r, size=8, bold=True, color=BLUE)
    r = hp.add_run(f'\t{SERIES}  ·  Version {VERSION}'); set_font(r, size=8, color=GREY)
    para_border(hp, 'bottom', HEX_CYAN, 6, 4)
    fp = sec.footer.paragraphs[0]
    fp.text = ''
    clear_tabs(fp)
    fp.paragraph_format.tab_stops.add_tab_stop(width, WD_TAB_ALIGNMENT.RIGHT)
    para_border(fp, 'top', 'C9D6E3', 4, 4)
    r = fp.add_run(f'{DATE}  ·  Prepared by {AUTHOR}  ·  Confidential'); set_font(r, size=8, color=GREY)
    r = fp.add_run('\tPage '); set_font(r, size=8, color=GREY)
    set_font(add_field(fp, 'PAGE', '1'), size=8, bold=True, color=BLUE)
    r = fp.add_run(' of '); set_font(r, size=8, color=GREY)
    set_font(add_field(fp, 'NUMPAGES', '1'), size=8, color=GREY)
    for part in (sec.first_page_header, sec.first_page_footer):
        part.paragraphs[0].text = ''


# ------------------------------------------------------------------ front matter
def kv_table(doc, rows, key_w=Cm(4.2)):
    t = doc.add_table(rows=len(rows), cols=2)
    fixed_layout(t, [key_w, PORTRAIT_W - key_w])
    table_borders(t)
    for i, (k, v) in enumerate(rows):
        a, b = t.rows[i].cells
        shade(a, HEX_BG)
        for c in (a, b):
            cell_margins(c, 60, 60, 110, 110)
        ra = a.paragraphs[0].add_run(k); set_font(ra, size=9.5, bold=True, color=BLUE)
        add_inline(b.paragraphs[0], v, size=9.5)
    return t


def grid_table(doc, rows, widths_pct, size=8.5, width=None):
    width = width or PORTRAIT_W
    ncols = len(rows[0])
    t = doc.add_table(rows=len(rows), cols=ncols)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    total = sum(widths_pct)
    fixed_layout(t, [Emu(int(width * w / total)) for w in widths_pct])
    table_borders(t)
    for i, row in enumerate(rows):
        tr = t.rows[i]
        no_split(tr)
        for j, val in enumerate(row):
            c = tr.cells[j]
            cell_margins(c, 45, 45, 80, 80)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER if i == 0 else WD_CELL_VERTICAL_ALIGNMENT.TOP
            p = c.paragraphs[0]; p.style = doc.styles['Table Text']
            for k, part in enumerate(str(val).split('<br>')):
                if k:
                    p = c.add_paragraph(style='Table Text')
                if i == 0:
                    add_inline(p, part.strip(), size=size, color=WHITE, bold=True)
                else:
                    add_inline(p, part.strip(), size=size)
            if i == 0:
                shade(c, HEX_BLUE)
            elif i % 2 == 0:
                shade(c, 'F3F9FE')
        if i == 0:
            repeat_header(tr)
    return t


def cover(doc, num, title):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(40)
    if os.path.exists(LOGO):
        p.add_run().add_picture(LOGO, height=Cm(1.8))
    band = doc.add_table(rows=1, cols=1)
    band.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = band.rows[0].cells[0]
    shade(c, HEX_BLUE); cell_margins(c, 520, 520, 450, 450)
    table_borders(band, color=HEX_BLUE)
    fixed_layout(band, [PORTRAIT_W])
    p = c.paragraphs[0]
    r = p.add_run(PRODUCT); set_font(r, size=40, bold=True, color=WHITE)
    p.paragraph_format.space_after = Pt(2)
    p = c.add_paragraph(); r = p.add_run('Insurance broking platform by iorta TechNXT'); set_font(r, size=13, color=RGBColor(0xEA, 0xF6, 0xFD))
    p.paragraph_format.space_after = Pt(22)
    p = c.add_paragraph(); r = p.add_run(f'{SERIES}  ·  Document {num} of {len(DOCS):02d}'); set_font(r, size=12, bold=True, color=RGBColor(0x9F, 0xDD, 0xF8))
    p.paragraph_format.space_after = Pt(4)
    p = c.add_paragraph(); r = p.add_run(title); set_font(r, size=25, bold=True, color=WHITE)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(30)
    kv_table(doc, [('Product', PRODUCT), ('Document', f'{num}  {title}'), ('Version', VERSION), ('Date', DATE),
                   ('Prepared by', AUTHOR), ('Classification', 'Confidential: for the client, iorta TechNXT and authorised partners')])
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(70)
    r = p.add_run(f'Prepared by {AUTHOR}'); set_font(r, size=10, bold=True, color=GREY)
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def heading_plain(doc, text):
    h = doc.add_paragraph()
    r = h.add_run(text); set_font(r, size=18, bold=True, color=BLUE)
    h.paragraph_format.space_after = Pt(8)
    para_border(h, 'bottom', HEX_CYAN, 12, 6)
    return h


def document_control(doc, num, title):
    heading_plain(doc, 'Document control')
    kv_table(doc, [('Document', f'{PRODUCT} {SERIES}: {num} {title}'), ('Document ID', f'BV-SA-{num}'), ('Version', VERSION),
                   ('Status', 'Issued for review'), ('Date', DATE), ('Prepared by', AUTHOR),
                   ('Source baseline', 'BrokerVerse source repository, branch brokerverse-platform (backend/, brokerverse/, deploy/, docker-compose.yml, .github/workflows, docs/)')])
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
    r = p.add_run('Version history'); set_font(r, size=12, bold=True, color=BLUE)
    grid_table(doc, [['Version', 'Date', 'Author', 'Change']] + [[v, d, AUTHOR, c] for v, d, c in HISTORY], [12, 18, 20, 50], size=9)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
    r = p.add_run('Review and approval'); set_font(r, size=12, bold=True, color=BLUE)
    grid_table(doc, [['Role', 'Name', 'Signature', 'Date'], ['Solution architect', '', '', ''], ['DevOps / infrastructure lead', '', '', ''],
                     ['Information security', '', '', ''], ['Business owner', '', '', '']], [34, 30, 20, 16], size=9)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
    r = p.add_run('Conventions'); set_font(r, size=12, bold=True, color=BLUE)
    for text in ('Statements of fact are derived from the code, configuration and database of the baseline above (file paths are given '
                 'relative to the repository). Figures measured on the local test system are labelled **test data** or **indicative**.',
                 'Targets, sizes, retention periods and thresholds that are not facts of the code are labelled '
                 '**Recommended / to be confirmed by the business and DevOps**.',
                 'Items marked **Gap** are defects or missing capabilities found while preparing this document.'):
        p = doc.add_paragraph(style='List Bullet'); add_inline(p, text)
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def toc(doc):
    heading_plain(doc, 'Contents')
    p = doc.add_paragraph()
    add_field(p, 'TOC \\o "1-2" \\h \\z \\u', 'Right-click and choose Update Field to build the table of contents.')


# ------------------------------------------------------------------ generated content
def snapshot():
    return json.load(open(SNAPSHOT, encoding='utf-8'))


def kb(n):
    return f'{n / 1024:,.0f}'


def gen_domain_summary():
    s = snapshot()['tables']
    missing = sorted(set(s) - set(catalog.TABLES))
    if missing:
        print(f'  warning: tables not described in tools/table_catalog.py: {", ".join(missing)}')
    rows = [['Domain', 'Tables', 'Rows (test data)', 'Size KB (test data)', 'Tables']]
    for code, label in catalog.DOMAINS:
        names = [t for t, v in catalog.TABLES.items() if v[0] == code]
        rows.append([label, str(len(names)), f'{sum(s[t]["rows"] for t in names):,}', kb(sum(s[t]['totalBytes'] for t in names)), ', '.join(sorted(names))])
    rows.append(['**Total**', f'**{len(s)}**', f'**{sum(v["rows"] for v in s.values()):,}**', f'**{kb(sum(v["totalBytes"] for v in s.values()))}**', ''])
    return ('table', rows, [17, 7, 10, 10, 56], 8)


def key_columns(name, info):
    cols = list(info['pk'])
    for u in info['unique']:
        if u not in cols:
            cols.append(u.replace(',', '+'))
    fks = [f['column'] for f in info['fks'] if f['column'] not in cols]
    out = [f'PK {"+".join(info["pk"])}' if info['pk'] else 'no PK']
    if info['unique']:
        out.append('UK ' + ', '.join(u.replace(',', '+') for u in info['unique'][:2]))
    if fks:
        more = f' +{len(fks) - 4}' if len(fks) > 4 else ''
        out.append('FK ' + ', '.join(fks[:4]) + more)
    if info['jsonb']:
        out.append('JSONB ' + ', '.join(info['jsonb'][:3]))
    return '<br>'.join(out)


def gen_inventory():
    s = snapshot()['tables']
    blocks = []
    for code, label in catalog.DOMAINS:
        names = sorted(t for t, v in catalog.TABLES.items() if v[0] == code)
        rows = [['Table', 'Purpose', 'Key columns', 'Rows', 'KB', 'Idx', 'Retention', 'Owner module']]
        for t in names:
            dom, mod, purpose, ret = catalog.TABLES[t]
            info = s[t]
            rows.append([f'**{t}**', purpose, key_columns(t, info), f'{info["rows"]:,}', kb(info['totalBytes']), str(info['indexes']),
                         catalog.RETENTION[ret], mod])
        blocks.append(('h3', f'{label} ({len(names)} tables)'))
        blocks.append(('table', rows, [16, 25, 22, 6, 5, 4, 10, 12], 7))
    return blocks


def gen_unindexed_fks():
    s = snapshot()['tables']
    rows = [['Table', 'Foreign-key columns without an index whose first column is the FK column']]
    for t in sorted(s):
        cols = [f['column'] for f in s[t]['fks'] if not f['indexed']]
        if cols:
            rows.append([t, ', '.join(cols)])
    return ('table', rows, [24, 76], 7.5)


def gen_settings_groups():
    g = snapshot()['settingsByGroup']
    rows = [['Group', 'Keys', 'Group', 'Keys', 'Group', 'Keys']]
    items = list(g.items())
    per = (len(items) + 2) // 3
    for i in range(per):
        row = []
        for k in range(3):
            j = i + k * per
            row += [items[j][0], str(items[j][1])] if j < len(items) else ['', '']
        rows.append(row)
    rows.append(['**Total**', f'**{sum(g.values())}**', '', '', '', ''])
    return ('table', rows, [22, 11, 22, 11, 22, 12], 8.5)


def gen_number_sequences():
    s = snapshot()
    rows = [['Counter (sequences.name)', 'Year', 'Last value (test data)', 'Counter', 'Year', 'Last value (test data)']]
    items = s['numberSequences']
    half = (len(items) + 1) // 2
    for i in range(half):
        a = items[i]
        b = items[i + half] if i + half < len(items) else None
        rows.append([a['name'], a['period'], str(a['value'])] + ([b['name'], b['period'], str(b['value'])] if b else ['', '', '']))
    return ('table', rows, [24, 9, 17, 24, 9, 17], 8)


def gen_db_facts():
    s = snapshot()
    t = s['tables']
    rows = [['Item', 'Value (local test database)'],
            ['PostgreSQL version', s['version']],
            ['Database size', f'{s["sizeBytes"] / 1024 / 1024:,.1f} MB (test data)'],
            ['Server time zone', s['timezone']],
            ['Tables (schema public)', str(len(t))],
            ['Columns by type', ', '.join(f'{k} {v}' for k, v in s['columnTypes'].items())],
            ['Indexes', f'{s["indexCount"]} ({s["uniqueIndexCount"]} unique incl. {len(t)} primary keys, {len(s["partialIndexes"])} partial, {len(s["ginIndexes"])} GIN)'],
            ['Foreign keys', f'{sum(len(v["fks"]) for v in t.values())} ({sum(1 for v in t.values() for f in v["fks"] if not f["indexed"])} without a supporting index)'],
            ['Identity sequences (serial / identity columns)', f'{len(s["sequences"])}'],
            ['Document-number counters (table sequences)', f'{len(s["numberSequences"])} counters for {s["numberSequences"][0]["period"] if s["numberSequences"] else "-"}'],
            ['Extensions', ', '.join(f'{e["name"]} {e["version"]}' for e in s['extensions'])],
            ['Application functions', ', '.join(s['functions'])],
            ['Triggers', ', '.join(f'{x["name"]} ({x["table"]})' for x in s['triggers'])],
            ['Views / materialised views', ', '.join(s.get('views') or []) or 'none'],
            ['Migrations applied', f'{len(s["migrations"])} ({s["migrations"][0]["name"]} to {s["migrations"][-1]["name"]})'],
            ['Application settings (app_settings)', f'{sum(s["settingsByGroup"].values())} keys in {len(s["settingsByGroup"])} groups'],
            ['Scheduled jobs (scheduled_jobs)', str(len(s['scheduledJobs']))],
            ['Snapshot taken', s['collectedAt']]]
    return ('table', rows, [32, 68], 8.5)


def gen_largest_tables():
    s = snapshot()['tables']
    top = sorted(s.items(), key=lambda kv: -kv[1]['rows'])[:15]
    rows = [['Table', 'Rows (test data)', 'Total size KB', 'Average row bytes', 'Retention class']]
    for t, v in top:
        rows.append([t, f'{v["rows"]:,}', kb(v['totalBytes']), str(v['avgRowBytes'] or '-'), catalog.RETENTION[catalog.TABLES[t][3]]])
    return ('table', rows, [28, 16, 16, 18, 22], 8.5)


def gen_loadtest():
    rows = [['Endpoint', 'Clients', 'Requests', 'Req/s', 'p50 ms', 'p95 ms', 'p99 ms', 'Max ms', 'Non-2xx']]
    for c in (10, 50):
        p = os.path.join(HERE, f'loadtest-results-c{c}.json')
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding='utf-8'))
        for r in d['results']:
            bad = sum(v for k, v in r['statuses'].items() if not k.startswith('2'))
            rows.append([r['endpoint'], str(c), f'{r["requests"]:,}', f'{r["throughputRps"]:,}', str(r['p50ms']), str(r['p95ms']), str(r['p99ms']),
                         str(r['maxMs']), str(bad)])
    return ('table', rows, [36, 8, 10, 8, 7, 7, 7, 8, 9], 7.5)


GENERATORS = {
    'domain_summary': gen_domain_summary, 'inventory': gen_inventory, 'unindexed_fks': gen_unindexed_fks,
    'settings_groups': gen_settings_groups, 'number_sequences': gen_number_sequences, 'db_facts': gen_db_facts,
    'largest_tables': gen_largest_tables, 'loadtest': gen_loadtest,
}


# ------------------------------------------------------------------ body builder
class Builder:
    def __init__(self, doc, num, title):
        self.doc, self.num, self.title = doc, num, title
        self.fig = 0
        self.widths = None
        self.size = None
        self.ch = 0
        self.sec = 0
        self.missing = []
        self.text = []

    def portrait(self):
        """Return to a portrait section after a landscape figure (short text after the figure stays on its page)."""
        if getattr(self, 'in_landscape', False):
            self.in_landscape = False
            self.new_section(False)

    def heading(self, level, text):
        self.portrait()
        self.text.append(text)
        if level == 1:
            self.ch += 1; self.sec = 0
            text = f'{self.ch}  {text}'
        elif level == 2:
            self.sec += 1
            text = f'{self.ch}.{self.sec}  {text}'
        p = self.doc.add_paragraph(style=f'Heading {level}')
        add_inline(p, text)
        self.last_heading = p._p
        if level == 1:
            p.paragraph_format.page_break_before = True
            para_border(p, 'bottom', HEX_CYAN, 12, 6)

    def paragraph(self, text):
        self.text.append(text)
        add_inline(self.doc.add_paragraph(), text)

    def steps(self, items):
        self.portrait()
        self.text.extend(items)
        for i, it in enumerate(items, 1):
            p = self.doc.add_paragraph(style='Step')
            r = p.add_run(f'{i}.\t'); set_font(r, bold=True, color=CYAN)
            add_inline(p, it)

    def bullets(self, items):
        self.portrait()
        self.text.extend(items)
        for it in items:
            add_inline(self.doc.add_paragraph(style='List Bullet'), it)

    def table(self, rows, widths=None, size=None):
        self.portrait()
        ncols = max(len(r) for r in rows)
        rows = [r + [''] * (ncols - len(r)) for r in rows]
        for r in rows:
            self.text.extend(r)
        widths = widths or self.widths
        if not widths or len(widths) != ncols:
            if widths:
                print(f'  warning: {len(widths)} widths for a {ncols}-column table starting {rows[0][:2]}')
            widths = [100 / ncols] * ncols
        grid_table(self.doc, rows, widths, size=size or self.size or 8.5)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)
        self.widths = None
        self.size = None

    def new_section(self, landscape):
        sec = self.doc.add_section(WD_SECTION.NEW_PAGE)
        section_layout(sec, landscape)
        sec.different_first_page_header_footer = False
        header_footer(sec, self.num, self.title, LANDSCAPE_W if landscape else PORTRAIT_W)

    def image(self, caption, name):
        self.text.append(caption)
        path = os.path.join(DIAGRAMS, name + '.png')
        if not os.path.exists(path):
            self.missing.append(name)
            self.paragraph(f'[Diagram not available: {name}]')
            return
        w, h = Image.open(path).size
        nat_w, nat_h = Cm(w / 200 * 2.54), Cm(h / 200 * 2.54)
        landscape = nat_w > PORTRAIT_W * 1.3 and w > h * 1.15
        max_w = LANDSCAPE_W if landscape else PORTRAIT_W
        max_h = Cm(12.0) if landscape else Cm(22.5)
        width = min(nat_w, max_w)
        if width * h / w > max_h:
            width = Emu(int(max_h * w / h))
        if not landscape or getattr(self, 'in_landscape', False):
            self.portrait()
        if landscape:
            # A heading directly before a landscape figure moves onto the landscape page with it, so it is not left
            # alone at the bottom of a portrait page.
            body = self.doc.element.body
            moved = getattr(self, 'last_heading', None)
            moved = moved if moved is not None and len(body) > 1 and body[-2] is moved else None
            if moved is not None:
                body.remove(moved)
            prev = body[-2] if len(body) > 1 else None
            empty = prev is not None and prev.tag == qn('w:p') and prev.find(qn('w:pPr') + '/' + qn('w:sectPr')) is not None
            if empty:
                # The current section has no content yet (it started right after another landscape page): turn it
                # into a landscape section instead of leaving an empty portrait page.
                sec = self.doc.sections[-1]
                section_layout(sec, True)
                header_footer(sec, self.num, self.title, LANDSCAPE_W)
            else:
                self.new_section(True)
            if moved is not None:
                body.insert(len(body) - 1, moved)
        p = self.doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4); p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        p.add_run().add_picture(path, width=Emu(int(width)))
        self.fig += 1
        cp = self.doc.add_paragraph(style='Figure Caption')
        r = cp.add_run(f'Figure {self.fig}. '); set_font(r, size=8.5, bold=True, italic=True, color=BLUE)
        add_inline(cp, caption, size=8.5, color=GREY)
        if landscape:
            self.in_landscape = True

    def callout(self, text):
        self.portrait()
        self.text.append(text)
        m = re.match(r'\*\*(\w[\w /]*):\*\*\s*(.*)', text)
        kind = m.group(1).lower() if m else 'note'
        warm = kind.startswith(('recommended', 'gap', 'important', 'caution', 'finding', 'limitation'))
        t = self.doc.add_table(rows=1, cols=1)
        fixed_layout(t, [PORTRAIT_W])
        table_borders(t, left_only=(HEX_AMBER if warm else HEX_CYAN, 24))
        c = t.rows[0].cells[0]
        shade(c, 'FFF6DD' if warm else HEX_BG); cell_margins(c, 80, 80, 150, 130)
        for k, part in enumerate(text.split('<br>')):
            p = c.paragraphs[0] if k == 0 else c.add_paragraph()
            p.paragraph_format.space_after = Pt(2)
            add_inline(p, part.strip(), size=9)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(0)

    def generated(self, name):
        out = GENERATORS[name]()
        for block in (out if isinstance(out, list) else [out]):
            if block[0] == 'table':
                self.table(block[1], block[2], block[3])
            elif block[0] == 'h3':
                self.heading(3, block[1])


def parse_and_build(b, text):
    for block in re.split(r'\n\s*\n', text.strip()):
        lines = [l.rstrip() for l in block.split('\n') if l.strip() and not l.strip().startswith('<!--')]
        while lines and re.match(r'^\{(widths|size):', lines[0].strip()):
            d = lines.pop(0).strip()
            if d.startswith('{widths:'):
                b.widths = [float(x) for x in d[8:-1].split(',')]
            else:
                b.size = float(d[6:-1])
        if not lines:
            continue
        first = lines[0].strip()
        if first == '\\pagebreak':
            b.doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE); continue
        m = re.match(r'^\{generate:\s*(\w+)\}$', first)
        if m:
            b.generated(m.group(1)); continue
        m = re.match(r'^(#{1,3})\s+(.*)', first)
        if m:
            b.heading(len(m.group(1)), m.group(2)); lines = lines[1:]
            if not lines:
                continue
            first = lines[0].strip()
        if first.startswith('|'):
            rows = []
            for l in lines:
                cells = [c.strip().replace('\x00', '|') for c in l.strip().replace('\\|', '\x00').strip('|').split('|')]
                if all(re.fullmatch(r':?-{2,}:?', c) for c in cells):
                    continue
                rows.append(cells)
            b.table(rows)
        elif first.startswith('!['):
            for l in lines:
                mm = re.match(r'!\[(.*)\]\((.*)\)', l.strip())
                if mm:
                    b.image(mm.group(1), mm.group(2))
        elif first.startswith('>'):
            b.callout('<br>'.join(l.strip()[1:].strip() for l in lines))
        elif re.match(r'^\d+\.\s', first):
            items = []
            for l in lines:
                if re.match(r'^\s*\d+\.\s', l):
                    items.append(re.sub(r'^\s*\d+\.\s+', '', l))
                else:
                    items[-1] += ' ' + l.strip()
            b.steps(items)
        elif first.startswith('- '):
            items = []
            for l in lines:
                if l.strip().startswith('- '):
                    items.append(l.strip()[2:])
                else:
                    items[-1] += ' ' + l.strip()
            b.bullets(items)
        else:
            b.paragraph(' '.join(l.strip() for l in lines))


def load_glossary():
    rows = []
    for line in open(os.path.join(SRC, 'glossary.md'), encoding='utf-8'):
        if line.startswith('|') and not re.match(r'^\|\s*-', line):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if cells[0] != 'Term':
                rows.append(cells)
    return rows


def uses(term, text):
    keys = [k.strip() for k in re.split(r'\s*/\s*|\s*\(|\)', term) if k.strip()]
    for k in keys:
        flags = 0 if (k.isupper() or any(ch.isdigit() for ch in k)) else re.IGNORECASE
        if re.search(r'(?<![A-Za-z0-9])' + re.escape(k) + r'(?![A-Za-z0-9])', text, flags):
            return True
    return False


def build_docx(num, slug, title, path):
    doc = Document()
    sec = doc.sections[0]
    section_layout(sec)
    sec.different_first_page_header_footer = True
    setup_styles(doc)
    header_footer(sec, num, title, PORTRAIT_W)
    cp = doc.core_properties
    cp.title = f'{PRODUCT} {SERIES}: {num} {title}'
    cp.subject = SERIES; cp.author = AUTHOR; cp.keywords = f'{PRODUCT}, solution architecture, {title}'
    cover(doc, num, title)
    document_control(doc, num, title)
    toc(doc)
    b = Builder(doc, num, title)
    src = next(f for f in sorted(os.listdir(SRC)) if f.startswith(num + '_'))
    parse_and_build(b, open(os.path.join(SRC, src), encoding='utf-8').read())
    # Related documents
    rel = '\n\n'.join(['# Related documents',
                       'This document is one of eleven that together form the BrokerVerse OOTB Solution Architecture. They are maintained and issued together (source and build: `docs/architecture/README.md`).',
                       '{widths: 10,50,40}\n| No. | Document | File |\n|---|---|---|\n' + '\n'.join(
                           f'| {n} | {t}{" (this document)" if n == num else ""} | `{n}_BrokerVerse_{s}.pdf` |' for n, s, t in DOCS)])
    parse_and_build(b, rel)
    body = '\n'.join(b.text)
    terms = [r for r in load_glossary() if uses(r[0], body)]
    gl = '# Glossary\n\nTerms and abbreviations used in this document.\n\n{widths: 24,76}\n| Term | Meaning |\n|---|---|\n' + '\n'.join(f'| {t} | {d} |' for t, d in terms)
    parse_and_build(b, gl)
    doc.save(path)
    return b, len(terms)


# ------------------------------------------------------------------ LibreOffice: update the table of contents and fields, export .docx and .pdf
UNO_SCRIPT = r'''
import sys, time, uno
from com.sun.star.beans import PropertyValue
def P(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p
pipe = sys.argv[1]
jobs = [sys.argv[i:i + 3] for i in range(2, len(sys.argv), 3)]
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
for i in range(60):
    try:
        ctx = resolver.resolve(f'uno:pipe,name={pipe};urp;StarOffice.ComponentContext'); break
    except Exception:
        time.sleep(1)
desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
for src, out_docx, out_pdf in jobs:
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (P('Hidden', True),))
    for _ in range(2):
        idx = doc.getDocumentIndexes()
        for i in range(idx.getCount()):
            idx.getByIndex(i).update()
        doc.getTextFields().refresh()
        doc.refresh()
    doc.storeToURL(uno.systemPathToFileUrl(out_docx), (P('FilterName', 'MS Word 2007 XML'),))
    fd = (P('Quality', 90), P('ReduceImageResolution', True), P('MaxImageResolution', 300), P('ExportBookmarks', True), P('UseTaggedPDF', True))
    doc.storeToURL(uno.systemPathToFileUrl(out_pdf), (P('FilterName', 'writer_pdf_Export'), P('FilterData', uno.Any('[]com.sun.star.beans.PropertyValue', fd))))
    doc.close(True)
    print('exported', out_pdf, flush=True)
try:
    desktop.terminate()
except Exception:
    pass
'''


def libreoffice(jobs):
    work = tempfile.mkdtemp(prefix='bv-arch-lo-')
    pipe = f'bvarch{os.getpid()}'
    profile = 'file://' + os.path.join(work, 'profile')
    office = subprocess.Popen(['soffice', f'-env:UserInstallation={profile}', '--headless', '--invisible', '--nologo', '--norestore',
                               f'--accept=pipe,name={pipe};urp;StarOffice.ComponentContext'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        script = os.path.join(work, 'export.py')
        open(script, 'w').write(UNO_SCRIPT)
        args = [a for job in jobs for a in job]
        subprocess.run([sys.executable, script, pipe, *args], check=True, timeout=1800)
    finally:
        try:
            office.wait(timeout=60)
        except Exception:
            office.kill()
        shutil.rmtree(work, ignore_errors=True)


def main():
    only = set(sys.argv[1:])
    tmp = tempfile.mkdtemp(prefix='bv-arch-')
    jobs = []
    for num, slug, title in DOCS:
        if only and num not in only:
            continue
        raw = os.path.join(tmp, f'{num}.docx')
        b, nterms = build_docx(num, slug, title, raw)
        print(f'{num} {title}: {b.ch} chapters, {b.fig} figures, {nterms} glossary terms{"; missing diagrams: " + ", ".join(b.missing) if b.missing else ""}')
        base = os.path.join(ROOT, f'{num}_BrokerVerse_{slug}')
        jobs.append((raw, base + '.docx', base + '.pdf'))
    libreoffice(jobs)
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
