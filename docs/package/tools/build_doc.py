"""Builds a BrokerVerse document in the iorta TechNXT template from a plain-text source file.

    python3 build_doc.py source/user-manual.md out/BrokerVerse_User_Manual.docx

Source format (one block per line group):
  front matter between --- lines: title, subtitle, version, date, prepared, reviewed, approved, acronyms (A=B; C=D)
  # Heading 1   ## Heading 2   ### Heading 3
  - bullet (two leading spaces per extra level)    1. numbered step
  | table | rows |  (first row is the header; a |---| row after it is ignored)
  ![Caption](path/to/image.png)
  > Note text (shaded note box)
  ```  code block  ```
  \\pagebreak
  Inline: **bold**, `code`.
Headings 1 are numbered by the template; headings 2 and 3 are numbered here (3.1, 3.1.2).
"""
import copy, os, re, sys
import docx
from docx.enum.text import WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, 'iorta_template.docx')
NAVY = RGBColor(0x0F, 0x47, 0x61)
TEXT = RGBColor(0x10, 0x18, 0x20)
FONT = 'Segoe UI'


def parse(path):
    raw = open(path, encoding='utf-8').read()
    meta = {}
    m = re.match(r'---\n(.*?)\n---\n', raw, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ':' in line:
                k, v = line.split(':', 1)
                meta[k.strip()] = v.strip()
        raw = raw[m.end():]
    return meta, raw.splitlines()


def set_font(run, size=11, bold=False, italic=False, mono=False, color=TEXT):
    run.font.name = 'Consolas' if mono else FONT
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn('w:rFonts'))
    if fonts is None:
        fonts = OxmlElement('w:rFonts'); rpr.insert(0, fonts)
    for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        fonts.set(qn(a), 'Consolas' if mono else FONT)
    run.font.size = Pt(size)
    run.font.bold = bold or None
    run.font.italic = italic or None
    if color is not None:
        run.font.color.rgb = color


def add_inline(par, text, size=11, bold=False, color=TEXT):
    for part in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text):
        if not part:
            continue
        if part.startswith('**'):
            set_font(par.add_run(part[2:-2]), size, True, color=color)
        elif part.startswith('`'):
            set_font(par.add_run(part[1:-1]), size - 1, mono=True, color=color)
        else:
            set_font(par.add_run(part), size, bold, color=color)


def shade(el_pr, fill):
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), fill)
    el_pr.append(shd)


class Builder:
    def __init__(self, meta):
        self.d = docx.Document(TEMPLATE)
        self.meta = meta
        body = list(self.d.element.body.iterchildren())
        self.elements = body
        def h1(text):
            for e in body:
                st = e.find('.//' + qn('w:pStyle'))
                if e.tag == qn('w:p') and st is not None and st.get(qn('w:val')) == 'Heading1' and text in ''.join(t.text or '' for t in e.iter(qn('w:t'))):
                    return e
        self.signoff = h1('Sign-Off')
        intro = h1('Introduction')
        # sample content of the template between the acronyms table and the sign-off goes
        i0, i1 = body.index(intro), body.index(self.signoff)
        for e in body[i0:i1]:
            e.getparent().remove(e)
        # chapters are numbered here: 1 Document Control, 2 Acronyms, then the content, then the sign-off
        for e in body:
            st = e.find('.//' + qn('w:pStyle'))
            if e.tag == qn('w:p') and st is not None and st.get(qn('w:val')) == 'Heading1':
                np_ = e.find('.//' + qn('w:numPr'))
                if np_ is not None:
                    np_.getparent().remove(np_)
                ts = [t for t in e.iter(qn('w:t')) if (t.text or '').strip()]
                label = ''.join(t.text for t in ts).strip()
                for k, t in enumerate(ts):
                    t.text = ''
                if ts:
                    ts[0].text = {'Document Control': '1.  Document Control', 'Acronyms': '2.  Acronyms'}.get(label, label)
        # the template pads the contents page with empty lines; the document control starts its own page instead
        dc = h1('Document Control')
        k = body.index(dc) - 1
        while k > 0 and body[k].tag == qn('w:p') and not ''.join(t.text or '' for t in body[k].iter(qn('w:t'))).strip() and body[k].find('.//' + qn('w:pStyle')) is None:
            body[k].getparent().remove(body[k]); k -= 1
        ppr = dc.find(qn('w:pPr'))
        ppr.insert(1, OxmlElement('w:pageBreakBefore'))
        self.h = [2, 0, 0]
        self.ensure_styles()
        self.ensure_numbering()
        self.num_seq = 0

    # ----- styles and numbering ---------------------------------------------------------------
    def ensure_styles(self):
        styles = self.d.styles
        for name, size, level in (('Heading 2', 13, 1), ('Heading 3', 11.5, 2)):
            try:
                st = styles[name]
            except KeyError:
                st = styles.add_style(name, 1)
            st.base_style = styles['Normal']
            st.font.name = FONT; st.font.size = Pt(size); st.font.bold = True; st.font.color.rgb = NAVY
            pf = st.paragraph_format
            pf.space_before = Pt(12); pf.space_after = Pt(4); pf.keep_with_next = True
            ppr = st.element.get_or_add_pPr()
            ol = ppr.find(qn('w:outlineLvl'))
            if ol is None:
                ol = OxmlElement('w:outlineLvl'); ppr.append(ol)
            ol.set(qn('w:val'), str(level))
        for name in ('toc 2', 'toc 3'):
            try:
                styles[name]
            except KeyError:
                st = styles.add_style(name, 1); st.base_style = styles['toc 1']
                st.paragraph_format.left_indent = Cm(0.6 if name == 'toc 2' else 1.2)

    def ensure_numbering(self):
        numbering = self.d.part.numbering_part.element
        ids = [int(a.get(qn('w:abstractNumId'))) for a in numbering.findall(qn('w:abstractNum'))]
        nums = [int(n.get(qn('w:numId'))) for n in numbering.findall(qn('w:num'))]
        self.abs_bullet, self.abs_dec = max(ids) + 1, max(ids) + 2
        def abstract(aid, kind):
            a = OxmlElement('w:abstractNum'); a.set(qn('w:abstractNumId'), str(aid))
            mlt = OxmlElement('w:multiLevelType'); mlt.set(qn('w:val'), 'hybridMultilevel'); a.append(mlt)
            for lvl in range(3):
                l = OxmlElement('w:lvl'); l.set(qn('w:ilvl'), str(lvl))
                st = OxmlElement('w:start'); st.set(qn('w:val'), '1'); l.append(st)
                fmt = OxmlElement('w:numFmt'); fmt.set(qn('w:val'), 'bullet' if kind == 'b' else ('decimal' if lvl == 0 else 'lowerLetter')); l.append(fmt)
                txt = OxmlElement('w:lvlText'); txt.set(qn('w:val'), ['•', '–', '◦'][lvl] if kind == 'b' else f'%{lvl + 1}.'); l.append(txt)
                jc = OxmlElement('w:lvlJc'); jc.set(qn('w:val'), 'left'); l.append(jc)
                ppr = OxmlElement('w:pPr'); ind = OxmlElement('w:ind'); ind.set(qn('w:left'), str(360 + 360 * (lvl + 1))); ind.set(qn('w:hanging'), '300'); ppr.append(ind); l.append(ppr)
                a.append(l)
            return a
        first_num = numbering.find(qn('w:num'))
        for a in (abstract(self.abs_bullet, 'b'), abstract(self.abs_dec, 'd')):
            if first_num is not None:
                first_num.addprevious(a)
            else:
                numbering.append(a)
        self.numbering = numbering
        self.next_num = max(nums) + 1
        self.bullet_num = self.new_num(self.abs_bullet)

    def new_num(self, abs_id):
        n = OxmlElement('w:num'); n.set(qn('w:numId'), str(self.next_num))
        a = OxmlElement('w:abstractNumId'); a.set(qn('w:val'), str(abs_id)); n.append(a)
        if abs_id == self.abs_dec:
            ov = OxmlElement('w:lvlOverride'); ov.set(qn('w:ilvl'), '0')
            so = OxmlElement('w:startOverride'); so.set(qn('w:val'), '1'); ov.append(so); n.append(ov)
        self.numbering.append(n)
        self.next_num += 1
        return self.next_num - 1

    # ----- content -----------------------------------------------------------------------------
    def para(self, style=None):
        p = self.d.add_paragraph(style=style)
        self.signoff.addprevious(p._p)
        return p

    def heading(self, level, text):
        if level == 1:
            p = self.para('Heading 1')
            # page break before every chapter but the first
            # (the template already breaks the page after the acronyms)
            p.paragraph_format.page_break_before = self.h[0] > 2
            self.h = [self.h[0] + 1, 0, 0]
            add_inline(p, f'{self.h[0]}.  {text}', 16, True, NAVY)
        elif level == 2:
            self.h = [self.h[0], self.h[1] + 1, 0]
            p = self.para('Heading 2'); add_inline(p, f'{self.h[0]}.{self.h[1]}  {text}', 13, True, NAVY)
        else:
            self.h[2] += 1
            p = self.para('Heading 3'); add_inline(p, f'{self.h[0]}.{self.h[1]}.{self.h[2]}  {text}', 11.5, True, NAVY)

    def body(self, text):
        p = self.para()
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        add_inline(p, text, 10.5)

    def list_item(self, text, level, numbered):
        p = self.para()
        p.paragraph_format.space_after = Pt(3)
        ppr = p._p.get_or_add_pPr()
        numpr = OxmlElement('w:numPr')
        il = OxmlElement('w:ilvl'); il.set(qn('w:val'), str(level)); numpr.append(il)
        ni = OxmlElement('w:numId'); ni.set(qn('w:val'), str(self.cur_num if numbered else self.bullet_num)); numpr.append(ni)
        ppr.append(numpr)
        add_inline(p, text, 10.5)

    def note(self, text):
        p = self.para()
        shade(p._p.get_or_add_pPr(), 'EAF2FB')
        p.paragraph_format.left_indent = Cm(0.3); p.paragraph_format.space_after = Pt(8)
        add_inline(p, text, 10)

    def code(self, lines):
        for ln in lines or ['']:
            p = self.para()
            shade(p._p.get_or_add_pPr(), 'F3F4F6')
            p.paragraph_format.space_after = Pt(0); p.paragraph_format.left_indent = Cm(0.3)
            set_font(p.add_run(ln if ln else ' '), 8.5, mono=True)
        self.para().paragraph_format.space_after = Pt(4)

    def table(self, rows):
        cols = max(len(r) for r in rows)
        rows = [r + [''] * (cols - len(r)) for r in rows]
        t = self.d.add_table(rows=len(rows), cols=cols)
        t.style = self.d.styles['Table Grid'] if 'Table Grid' in [s.name for s in self.d.styles] else None
        self.signoff.addprevious(t._tbl)
        size = 9 if cols <= 4 else 8
        tblpr = t._tbl.tblPr
        borders = OxmlElement('w:tblBorders')
        for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
            el = OxmlElement(f'w:{edge}'); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), '4'); el.set(qn('w:color'), 'BFC7D1'); borders.append(el)
        tblpr.append(borders)
        # header row repeats on every page
        trpr = t.rows[0]._tr.get_or_add_trPr(); hdr = OxmlElement('w:tblHeader'); hdr.set(qn('w:val'), 'true'); trpr.append(hdr)
        for i, r in enumerate(rows):
            for j, val in enumerate(r):
                cell = t.cell(i, j)
                cell.paragraphs[0].paragraph_format.space_after = Pt(1)
                for k, chunk in enumerate(val.split('<br>')):
                    par = cell.paragraphs[0] if k == 0 else cell.add_paragraph()
                    add_inline(par, chunk.strip(), size, i == 0, NAVY if i == 0 else TEXT)
                if i == 0:
                    shade(cell._tc.get_or_add_tcPr(), 'DCE9F7')
        self.fit_columns(t, rows)
        self.para().paragraph_format.space_after = Pt(4)

    def fit_columns(self, t, rows, total_cm=15.9):
        """Column widths in proportion to the longest text of each column (bounded), instead of equal columns."""
        lens = []
        for j in range(len(rows[0])):
            longest = max((max((len(part) for part in r[j].split('<br>')), default=0) for r in rows), default=0)
            header_words = max((len(w) for w in rows[0][j].split()), default=0)
            lens.append(min(max(longest, header_words, 4), 48))
        weight = sum(lens)
        widths = [total_cm * n / weight for n in lens]
        # no column narrower than 1.6 cm: take the difference from the widest
        short = sum(max(0, 1.6 - w) for w in widths)
        widths = [max(w, 1.6) for w in widths]
        widths[widths.index(max(widths))] -= short
        tblpr = t._tbl.tblPr
        lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblpr.append(lay)
        for row in t.rows:
            for j, cell in enumerate(row.cells):
                cell.width = Cm(widths[j])

    def image(self, caption, path):
        if not os.path.exists(path):
            self.note(f'[Screen image not available: {caption}]'); return
        p = self.para(); p.alignment = 1
        p.add_run().add_picture(path, width=Cm(16))
        c = self.para(); c.alignment = 1
        set_font(c.add_run(caption), 9, italic=True, color=RGBColor(0x55, 0x5F, 0x6D))

    def pagebreak(self):
        self.para().add_run().add_break(WD_BREAK.PAGE)

    # ----- front matter and template tables ----------------------------------------------------
    def front(self):
        m = self.meta
        rep = {'Business Requirement': m.get('title', ''), ' Document': '', 'Sub headline': m.get('subtitle', ''),
               '27 March 2025': m.get('date', ''), 'Author': m.get('prepared', 'iorta TechNXT')}
        for t in self.d.element.body.iter(qn('w:t')):
            if t.text in rep:
                t.text = rep[t.text]
        # version "1" "." "0" runs
        vt = m.get('version', '1.0').split('.')
        seq = [t for t in self.d.element.body.iter(qn('w:t'))]
        for i in range(len(seq) - 3):
            if seq[i].text == 'Version - ' and seq[i + 1].text == '1' and seq[i + 2].text == '.' and seq[i + 3].text == '0':
                seq[i + 1].text, seq[i + 3].text = vt[0], vt[1] if len(vt) > 1 else '0'
        tables = self.d.tables
        dc = tables[0]
        vals = [m.get('date', ''), m.get('version', '1.0'), m.get('prepared', 'iorta TechNXT'), m.get('reviewed', ''), m.get('approved', ''), m.get('change', 'Initial issue')]
        for j, v in enumerate(vals):
            if j < len(dc.rows[1].cells):
                cell = dc.rows[1].cells[j]
                for p in cell.paragraphs[1:]:
                    p._p.getparent().remove(p._p)
                p0 = cell.paragraphs[0]
                for r in p0.runs:
                    r._r.getparent().remove(r._r)
                set_font(p0.add_run(v), 8)
        ac = tables[1]
        pairs = [a.split('=', 1) for a in m.get('acronyms', '').split(';') if '=' in a]
        while len(ac.rows) - 1 < len(pairs):
            ac._tbl.append(copy.deepcopy(ac.rows[-1]._tr))
        for i, row in enumerate(ac.rows[1:]):
            for j, cell in enumerate(row.cells[:2]):
                for p in cell.paragraphs:
                    for r in p.runs:
                        r._r.getparent().remove(r._r)
                if i < len(pairs):
                    set_font(cell.paragraphs[0].add_run(pairs[i][j].strip()), 8)
        # sign-off: heading text and the open items table
        ts = list(self.signoff.iter(qn('w:t')))
        for k, t in enumerate(ts):
            t.text = f'{self.h[0] + 1}.  Document Sign-Off' if k == 0 else ''
        self.signoff_page_break()
        items = tables[-2]
        for row in items.rows[1:]:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        r._r.getparent().remove(r._r)
        cells = items.rows[1].cells
        for j, v in enumerate(['1', m.get('open_item', 'No open items at the time of issue'), 'iorta TechNXT', 'Closed']):
            set_font(cells[j].paragraphs[0].add_run(v), 8)
        so = tables[-1]
        for row in so.rows[1:]:
            for cell in row.cells:
                for p in cell.paragraphs:
                    for r in p.runs:
                        r._r.getparent().remove(r._r)
        # table of contents: a field Word and LibreOffice refresh, replacing the sample entries
        body = list(self.d.element.body.iterchildren())
        tocs = [e for e in body if e.tag == qn('w:p') and e.find('.//' + qn('w:pStyle')) is not None and e.find('.//' + qn('w:pStyle')).get(qn('w:val')) == 'TOC1']
        anchor = tocs[0]
        p = OxmlElement('w:p')
        def fld(kind, text=None):
            r = OxmlElement('w:r')
            if kind == 'instr':
                it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = text; r.append(it)
            else:
                fc = OxmlElement('w:fldChar'); fc.set(qn('w:fldCharType'), kind); r.append(fc)
            return r
        for r in (fld('begin'), fld('instr', ' TOC \\o "1-2" \\h \\z \\u '), fld('separate')):
            p.append(r)
        r = OxmlElement('w:r'); t = OxmlElement('w:t'); t.text = 'Right-click and choose Update Field to refresh the contents.'; r.append(t); p.append(r)
        p.append(fld('end'))
        anchor.addprevious(p)
        for e in tocs:
            e.getparent().remove(e)
        settings = self.d.settings.element
        uf = OxmlElement('w:updateFields'); uf.set(qn('w:val'), 'true'); settings.append(uf)

    def signoff_page_break(self):
        ppr = self.signoff.find(qn('w:pPr'))
        pb = OxmlElement('w:pageBreakBefore'); ppr.insert(1, pb)

    def build(self, lines):
        i = 0
        para_buf = []
        def flush():
            if para_buf:
                self.body(' '.join(s.strip() for s in para_buf)); para_buf.clear()
        in_list_numbered = False
        while i < len(lines):
            ln = lines[i]
            s = ln.strip()
            if s.startswith('```'):
                flush(); j = i + 1; block = []
                while j < len(lines) and not lines[j].strip().startswith('```'):
                    block.append(lines[j]); j += 1
                self.code(block); i = j + 1; continue
            if not s:
                flush(); in_list_numbered = False; i += 1; continue
            m = re.match(r'^(#{1,3})\s+(.*)', s)
            if m:
                flush(); self.heading(len(m.group(1)), m.group(2)); i += 1; continue
            if s == '\\pagebreak':
                flush(); self.pagebreak(); i += 1; continue
            m = re.match(r'^!\[(.*?)\]\((.*?)\)', s)
            if m:
                flush(); self.image(m.group(1), m.group(2)); i += 1; continue
            if s.startswith('|'):
                flush(); rows = []
                while i < len(lines) and lines[i].strip().startswith('|'):
                    r = lines[i].strip().strip('|')
                    cells = [c.strip() for c in re.split(r'(?<!\\)\|', r)]
                    if not all(re.fullmatch(r':?-{2,}:?', c) for c in cells if c):
                        rows.append([c.replace('\\|', '|') for c in cells])
                    i += 1
                self.table(rows); continue
            if s.startswith('> '):
                flush(); self.note(s[2:]); i += 1; continue
            m = re.match(r'^(\s*)[-*]\s+(.*)', ln)
            if m:
                flush(); self.list_item(m.group(2), min(len(m.group(1)) // 2, 2), False); i += 1; continue
            m = re.match(r'^(\s*)\d+[.)]\s+(.*)', ln)
            if m:
                flush()
                if not in_list_numbered:
                    self.cur_num = self.new_num(self.abs_dec); in_list_numbered = True
                self.list_item(m.group(2), min(len(m.group(1)) // 2, 2), True); i += 1; continue
            para_buf.append(s); i += 1
        flush()

    def save(self, out):
        self.d.save(out)


def main(src, out):
    meta, lines = parse(src)
    b = Builder(meta)
    os.chdir(os.path.dirname(os.path.abspath(src)))
    b.build(lines)
    os.chdir(HERE)
    b.front()
    b.save(os.path.abspath(out) if os.path.isabs(out) else os.path.join(os.getcwd(), out))


if __name__ == '__main__':
    src, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
    main(src, out)
