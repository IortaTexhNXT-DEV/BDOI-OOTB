#!/usr/bin/env python3
"""md2docx.py: convert a TISPH Markdown document into a Word file built on the
iorta TechNXT document template (Document_template_Format1.docx).

The template is opened with python-docx, so its styles, cover art, header and
footer are kept. The cover texts, Document Control, Acronyms, pending-items and
sign-off tables are filled from the source; the template's sample sections are
replaced with the document content.

Run it isolated, because the template is untrusted input:

    python3 -I md2docx.py SOURCE.md OUTPUT.docx --template Document_template_Format1.docx \
        [--title "Cover title"] [--version "0.9 Draft"] [--date "10 October 2026"] \
        [--subtitle "Toyota Insurance Services Philippines"] [--prepared-by "iorta TechNXT"] \
        [--glossary-from other.md ...] [--toc-levels 2] [--signoff-title "Document Sign-Off"] \
        [--chapter-breaks] [--no-pdf-pass]

Without --no-pdf-pass the script converts the result to PDF with LibreOffice
(soffice) to read the page of every heading, then writes those page numbers
into the table of contents. Word refreshes the TOC field when the file opens
(updateFields is set in settings.xml).

An image on a line of its own (![Caption](path), the path absolute or relative to
the source) is placed at the width of the text with its caption.

Mermaid diagrams are rendered to PNG when a mermaid build and Playwright are
available (see find_mermaid); otherwise each diagram is converted into a table
or numbered steps. Raw diagram text is never written.
"""
import argparse
import copy
import datetime as dt
import glob
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from xml.sax.saxutils import escape as _xesc

from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.opc.packuri import PackURI
from docx.opc.part import XmlPart
from docx.oxml import parse_xml
from docx.oxml.ns import qn

W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NSDECL = ('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
          'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
          'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
          'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')

# ---------------------------------------------------------------- page geometry
PORTRAIT = dict(w=11907, h=16839)
MARGIN = 1440
TEXT_W_PORTRAIT = PORTRAIT['w'] - 2 * MARGIN      # 9027 twips
TEXT_W_LANDSCAPE = PORTRAIT['h'] - 2 * MARGIN     # 13959 twips

FONT = 'Segoe UI'
MONO = 'Consolas'
BODY_COLOR = '101820'
HEAD_COLOR = '0F4761'
NUM_COLOR = '003399'
BRAND_BLUE = '1D74BA'
BORDER_COLOR = '808080'
HEADER_FILL = 'E8F0F8'
CODE_FILL = 'F3F5F8'
TABLE_SZ = 16          # half-points: 8 pt, as the template tables

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
          'September', 'October', 'November', 'December']

warnings = []


def warn(msg):
    warnings.append(msg)


def xesc(s):
    return _xesc(s, {'"': '&quot;'})


# ============================================================ Markdown parsing
LIST_RE = re.compile(r'^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$')
FENCE_RE = re.compile(r'^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$')
HEAD_RE = re.compile(r'^(#{1,6})\s+(.*?)\s*#*\s*$')
IMAGE_RE = re.compile(r'^!\[([^\]]*)\]\(([^)\s]+)\)\s*$')
HR_RE = re.compile(r'^\s{0,3}([-*_])(\s*\1){2,}\s*$')
TABLE_SEP_RE = re.compile(r'^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$')


def leading(s):
    return len(s) - len(s.lstrip(' '))


def split_row(line):
    """Split a table row on '|' that are not escaped and not inside code spans."""
    s = line.strip()
    if s.startswith('|'):
        s = s[1:]
    if s.endswith('|') and not s.endswith('\\|'):
        s = s[:-1]
    cells, cur, i, tick = [], '', 0, 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s) and s[i + 1] == '|':
            cur += '\\|'
            i += 2
            continue
        if c == '`':
            j = i
            while j < len(s) and s[j] == '`':
                j += 1
            n = j - i
            if tick == 0:
                # opening only if a closing run of the same length follows
                if s.find('`' * n, j) != -1:
                    tick = n
            elif n == tick:
                tick = 0
            cur += s[i:j]
            i = j
            continue
        if c == '|' and tick == 0:
            cells.append(cur.strip())
            cur = ''
        else:
            cur += c
        i += 1
    cells.append(cur.strip())
    return [c.replace('\\|', '|') for c in cells]


def starts_block(lines, i):
    l = lines[i]
    if HEAD_RE.match(l) or FENCE_RE.match(l) or HR_RE.match(l) or IMAGE_RE.match(l):
        return True
    if l.lstrip().startswith('>'):
        return True
    if LIST_RE.match(l):
        return True
    if l.lstrip().startswith('|') and i + 1 < len(lines) and TABLE_SEP_RE.match(lines[i + 1]):
        return True
    return False


def parse_blocks(lines):
    blocks = []
    i, n = 0, len(lines)
    while i < n:
        l = lines[i]
        if not l.strip():
            i += 1
            continue
        m = FENCE_RE.match(l)
        if m:
            ind, fence, lang = len(m.group(1)), m.group(2), m.group(3).lower()
            body = []
            i += 1
            while i < n and not re.match(r'^\s*' + re.escape(fence[0]) + '{%d,}\\s*$' % len(fence), lines[i]):
                ln = lines[i]
                body.append(ln[min(ind, leading(ln)):])
                i += 1
            i += 1
            blocks.append({'t': 'code', 'lang': lang, 'text': '\n'.join(body)})
            continue
        m = HEAD_RE.match(l)
        if m:
            blocks.append({'t': 'heading', 'level': len(m.group(1)), 'text': m.group(2).strip()})
            i += 1
            continue
        m = IMAGE_RE.match(l)
        if m:
            blocks.append({'t': 'image', 'alt': m.group(1).strip(), 'src': m.group(2)})
            i += 1
            continue
        if HR_RE.match(l):
            blocks.append({'t': 'hr'})
            i += 1
            continue
        if l.lstrip().startswith('|') and i + 1 < n and TABLE_SEP_RE.match(lines[i + 1]):
            header = split_row(l)
            i += 2
            rows = []
            while i < n and lines[i].lstrip().startswith('|'):
                rows.append(split_row(lines[i]))
                i += 1
            ncol = len(header)
            rows = [(r + [''] * ncol)[:ncol] if len(r) <= ncol else r[:ncol - 1] + [' | '.join(r[ncol - 1:])]
                    for r in rows]
            blocks.append({'t': 'table', 'header': header, 'rows': rows})
            continue
        if l.lstrip().startswith('>'):
            q = []
            while i < n and lines[i].lstrip().startswith('>'):
                q.append(re.sub(r'^\s*>\s?', '', lines[i]))
                i += 1
            blocks.append({'t': 'quote', 'blocks': parse_blocks(q)})
            continue
        if LIST_RE.match(l):
            blk, i = parse_list(lines, i)
            blocks.append(blk)
            continue
        # paragraph
        para = [l]
        i += 1
        while i < n and lines[i].strip() and not starts_block(lines, i):
            para.append(lines[i])
            i += 1
        text = ''
        for k, pl in enumerate(para):
            hard = pl.endswith('  ') or pl.rstrip().endswith('\\')
            seg = pl.strip()
            if seg.endswith('\\'):
                seg = seg[:-1]
            text += seg
            if k < len(para) - 1:
                text += '\n' if hard else ' '
        blocks.append({'t': 'para', 'text': text})
    return blocks


def parse_list(lines, i):
    m = LIST_RE.match(lines[i])
    indent = len(m.group(1))
    ordered = m.group(2)[0].isdigit()
    start = int(re.match(r'\d+', m.group(2)).group(0)) if ordered else 1
    items = []
    n = len(lines)
    while i < n:
        m = LIST_RE.match(lines[i])
        if not m or len(m.group(1)) != indent or (m.group(2)[0].isdigit()) != ordered:
            break
        content_indent = m.start(3)
        body = [m.group(3)]
        i += 1
        while i < n:
            l = lines[i]
            if not l.strip():
                j = i
                while j < n and not lines[j].strip():
                    j += 1
                if j < n and leading(lines[j]) > indent and not (
                        LIST_RE.match(lines[j]) and len(LIST_RE.match(lines[j]).group(1)) <= indent):
                    body.extend([''] * (j - i))
                    i = j
                    continue
                break
            mm = LIST_RE.match(l)
            if mm and len(mm.group(1)) <= indent:
                break
            if leading(l) <= indent and not mm:
                if body and body[-1] == '':
                    break
                if HEAD_RE.match(l) or FENCE_RE.match(l) or l.lstrip().startswith(('|', '>')) or HR_RE.match(l):
                    break
            body.append(l[min(leading(l), content_indent):] if leading(l) > indent else l.strip())
            i += 1
        items.append({'blocks': parse_blocks(body)})
    return {'t': 'list', 'ordered': ordered, 'start': start, 'items': items}, i


# ============================================================ inline rendering
INLINE_RE = re.compile(
    r'(?P<code>(?P<tk>`+)(?P<ct>.+?)(?<!`)(?P=tk)(?!`))'
    r'|(?P<bold>\*\*(?=\S)(?P<bt>.+?)(?<=\S)\*\*)'
    r'|(?P<ubold>(?<![\w])__(?=\S)(?P<ubt>.+?)(?<=\S)__(?![\w]))'
    r'|(?P<ital>(?<![\*\w\\])\*(?=[^\s*])(?P<it>.+?)(?<=[^\s\\*])\*(?!\*))'
    r'|(?P<uital>(?<![\w\\])_(?=[^\s_])(?P<uit>.+?)(?<=[^\s_])_(?![\w]))'
    r'|(?P<link>\[(?P<lt>[^\]]+)\]\((?P<lu>[^)\s]+)(?:\s+"[^"]*")?\))'
    r'|(?P<br><br\s*/?>)'
    r'|(?P<auto><(?P<au>https?://[^>\s]+)>)'
)
ESC_RE = re.compile(r'\\([\\`*_{}\[\]()#+\-.!|<>~])')


def inline_tokens(text, fmt=frozenset()):
    """Return a list of (text, fmt) where fmt is a set of b, i, code, br, link:<url>."""
    out = []
    pos = 0
    for m in INLINE_RE.finditer(text):
        if m.start() < pos:
            continue
        if m.start() > pos:
            out.append((ESC_RE.sub(r'\1', text[pos:m.start()]), fmt))
        if m.group('code'):
            ct = m.group('ct')
            if ct.startswith(' ') and ct.endswith(' ') and len(ct) > 2:
                ct = ct[1:-1]
            out.append((ct, fmt | {'code'}))
        elif m.group('bold'):
            out.extend(inline_tokens(m.group('bt'), fmt | {'b'}))
        elif m.group('ubold'):
            out.extend(inline_tokens(m.group('ubt'), fmt | {'b'}))
        elif m.group('ital'):
            out.extend(inline_tokens(m.group('it'), fmt | {'i'}))
        elif m.group('uital'):
            out.extend(inline_tokens(m.group('uit'), fmt | {'i'}))
        elif m.group('link'):
            url = m.group('lu')
            sub = inline_tokens(m.group('lt'), fmt)
            if re.match(r'https?://', url):
                sub = [(t, f | {'link:' + url}) for t, f in sub]
            out.extend(sub)
        elif m.group('br'):
            out.append(('\n', fmt))
        elif m.group('auto'):
            out.append((m.group('au'), fmt | {'link:' + m.group('au')}))
        pos = m.end()
    if pos < len(text):
        out.append((ESC_RE.sub(r'\1', text[pos:]), fmt))
    return out


def plain(text):
    return ''.join(t for t, f in inline_tokens(text))


class Ctx:
    """Conversion state shared by the renderers."""

    def __init__(self, doc):
        self.doc = doc
        self.bm_id = 1000
        self.links = {}

    def link_rid(self, url):
        if url not in self.links:
            self.links[url] = self.doc.part.relate_to(url, RT.HYPERLINK, is_external=True)
        return self.links[url]


def rpr(fmt, size=None, color=None, bold=False, italic=False, font=None):
    parts = []
    code = 'code' in fmt
    f = MONO if code else (font or FONT)
    parts.append(f'<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:cs="{f}" w:eastAsia="{f}"/>')
    if bold or 'b' in fmt:
        parts.append('<w:b/><w:bCs/>')
    if italic or 'i' in fmt:
        parts.append('<w:i/><w:iCs/>')
    link = any(x.startswith('link:') for x in fmt)
    if link:
        parts.append(f'<w:color w:val="{BRAND_BLUE}"/><w:u w:val="single"/>')
    elif code:
        parts.append('<w:color w:val="1F3B57"/>')
    elif color:
        parts.append(f'<w:color w:val="{color}"/>')
    if size:
        sz = size - 2 if code else size
        parts.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
    if code:
        parts.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{CODE_FILL}"/>')
    return '<w:rPr>' + ''.join(parts) + '</w:rPr>'


def runs_xml(ctx, text, size=None, color=None, bold=False, italic=False, base_fmt=frozenset()):
    out = []
    for t, f in inline_tokens(text, frozenset(base_fmt)):
        if not t:
            continue
        rp = rpr(f, size, color, bold, italic)
        pieces = t.split('\n')
        xml = ''
        for k, piece in enumerate(pieces):
            if k:
                xml += f'<w:r>{rp}<w:br/></w:r>'
            if piece:
                xml += f'<w:r>{rp}<w:t xml:space="preserve">{xesc(piece)}</w:t></w:r>'
        url = next((x[5:] for x in f if x.startswith('link:')), None)
        if url:
            xml = f'<w:hyperlink r:id="{ctx.link_rid(url)}" w:history="1">{xml}</w:hyperlink>'
        out.append(xml)
    return ''.join(out)


def p_xml(inner, style=None, ppr=''):
    st = f'<w:pStyle w:val="{style}"/>' if style else ''
    return f'<w:p {NSDECL}><w:pPr>{st}{ppr}</w:pPr>{inner}</w:p>'


def el(xml):
    return parse_xml(xml)


# ============================================================ numbering
class Numbering:
    """Adds abstract numbering definitions for headings, bullets and ordered lists."""

    def __init__(self, doc):
        self.root = doc.part.numbering_part.element
        ids = [int(x) for x in self.root.xpath('//w:abstractNum/@w:abstractNumId')]
        self.next_abs = max(ids + [0]) + 10
        nids = [int(x) for x in self.root.xpath('//w:num/@w:numId')]
        self.next_num = max(nids + [0]) + 10
        self.bullet_abs = self._add_abs(self._bullet_levels())
        self.decimal_abs = self._add_abs(self._decimal_levels())
        self.bullet_num = self.new_num(self.bullet_abs)

    def _add_abs(self, levels_xml, extra=''):
        aid = self.next_abs
        self.next_abs += 1
        xml = (f'<w:abstractNum {NSDECL} w:abstractNumId="{aid}"><w:multiLevelType w:val="hybridMultilevel"/>'
               f'{extra}{levels_xml}</w:abstractNum>')
        e = el(xml)
        # abstractNum elements must precede num elements
        first_num = self.root.find(qn('w:num'))
        if first_num is not None:
            first_num.addprevious(e)
        else:
            self.root.append(e)
        return aid

    def new_num(self, abs_id, start=None):
        nid = self.next_num
        self.next_num += 1
        ov = ''
        if start is not None:
            ov = f'<w:lvlOverride w:ilvl="0"><w:startOverride w:val="{start}"/></w:lvlOverride>'
        self.root.append(el(f'<w:num {NSDECL} w:numId="{nid}"><w:abstractNumId w:val="{abs_id}"/>{ov}</w:num>'))
        return nid

    @staticmethod
    def _bullet_levels():
        chars = ['•', '–', '◦', '•', '–', '◦', '•', '–', '◦']
        out = ''
        for i in range(9):
            left = 360 + 360 * i
            out += (f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="bullet"/>'
                    f'<w:lvlText w:val="{chars[i]}"/><w:lvlJc w:val="left"/>'
                    f'<w:pPr><w:ind w:left="{left}" w:hanging="300"/></w:pPr>'
                    f'<w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:hint="default"/>'
                    f'<w:color w:val="{BRAND_BLUE}"/></w:rPr></w:lvl>')
        return out

    @staticmethod
    def _decimal_levels():
        fmts = ['decimal', 'lowerLetter', 'lowerRoman'] * 3
        out = ''
        for i in range(9):
            left = 400 + 380 * i
            out += (f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="{fmts[i]}"/>'
                    f'<w:lvlText w:val="%{i + 1}."/><w:lvlJc w:val="left"/>'
                    f'<w:pPr><w:ind w:left="{left}" w:hanging="360"/></w:pPr>'
                    f'<w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:hint="default"/></w:rPr></w:lvl>')
        return out

    def heading_list(self, levels=3):
        """Multilevel heading numbering 1. / 1.1 / 1.1.1, linked to Heading 1-3."""
        out = ''
        sizes = [28, 24, 22]
        hang = [500, 720, 900]
        for i in range(9):
            txt = '.'.join(f'%{k + 1}' for k in range(i + 1)) + ('.' if i == 0 else '')
            sz = sizes[min(i, 2)]
            hg = hang[min(i, 2)]
            style = ''
            out += (f'<w:lvl w:ilvl="{i}"><w:start w:val="1"/><w:numFmt w:val="decimal"/>{style}'
                    f'<w:lvlText w:val="{txt}"/><w:lvlJc w:val="left"/>'
                    f'<w:pPr><w:tabs><w:tab w:val="num" w:pos="{hg}"/></w:tabs><w:ind w:left="{hg}" w:hanging="{hg}"/></w:pPr>'
                    f'<w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:hint="default"/><w:b/><w:i w:val="0"/>'
                    f'<w:color w:val="{NUM_COLOR}"/><w:sz w:val="{sz}"/></w:rPr></w:lvl>')
        aid = self._add_abs(out)
        # multilevel, not hybrid
        a = self.root.xpath(f'//w:abstractNum[@w:abstractNumId="{aid}"]')[0]
        a.find(qn('w:multiLevelType')).set(qn('w:val'), 'multilevel')
        return aid


# ============================================================ styles
def setup_styles(doc, toc_levels):
    st = doc.styles.element

    def get(sid):
        r = st.xpath(f'w:style[@w:styleId="{sid}"]')
        return r[0] if r else None

    def replace(sid, xml):
        old = get(sid)
        new = el(xml)
        if old is not None:
            old.addprevious(new)
            old.getparent().remove(old)
        else:
            st.append(new)

    f = f'<w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}" w:eastAsia="{FONT}"/>'
    replace('Normal', f'<w:style {NSDECL} w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>'
                      f'<w:qFormat/><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr>'
                      f'<w:rPr>{f}<w:color w:val="{BODY_COLOR}"/><w:sz w:val="22"/><w:szCs w:val="22"/>'
                      f'<w:lang w:val="en-GB"/></w:rPr></w:style>')
    specs = {1: (28, 360, 140), 2: (24, 280, 100), 3: (22, 220, 80)}
    for lvl, (sz, before, after) in specs.items():
        sid = f'Heading{lvl}'
        replace(sid, f'<w:style {NSDECL} w:type="paragraph" w:styleId="{sid}"><w:name w:val="heading {lvl}"/>'
                     f'<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>'
                     f'<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="{before}" w:after="{after}" '
                     f'w:line="264" w:lineRule="auto"/><w:outlineLvl w:val="{lvl - 1}"/></w:pPr>'
                     f'<w:rPr>{f}<w:b/><w:bCs/><w:color w:val="{HEAD_COLOR}"/><w:sz w:val="{sz}"/>'
                     f'<w:szCs w:val="{sz}"/></w:rPr></w:style>')
    toc_tabs = {1: (0, 500), 2: (300, 1020), 3: (600, 1500)}
    for lvl in range(1, 4):
        sid = f'TOC{lvl}'
        left, tab = toc_tabs[lvl]
        bold = '<w:b/>' if lvl == 1 else ''
        replace(sid, f'<w:style {NSDECL} w:type="paragraph" w:styleId="{sid}"><w:name w:val="toc {lvl}"/>'
                     f'<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/>'
                     f'<w:pPr><w:tabs><w:tab w:val="left" w:pos="{tab}"/><w:tab w:val="right" w:leader="dot" '
                     f'w:pos="{TEXT_W_PORTRAIT}"/></w:tabs><w:spacing w:before="{60 if lvl == 1 else 0}" w:after="60" '
                     f'w:line="240" w:lineRule="auto"/><w:ind w:left="{left}" w:right="400" w:hanging="{0}"/></w:pPr>'
                     f'<w:rPr>{f}{bold}<w:noProof/><w:color w:val="{BODY_COLOR}"/><w:sz w:val="{20 if lvl == 1 else 19}"/>'
                     f'</w:rPr></w:style>')
    if get('Hyperlink') is None:
        st.append(el(f'<w:style {NSDECL} w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>'
                     f'<w:rPr><w:color w:val="{BRAND_BLUE}"/><w:u w:val="single"/></w:rPr></w:style>'))
    if get('Caption') is None:
        st.append(el(f'<w:style {NSDECL} w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/>'
                     f'<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>'
                     f'<w:pPr><w:keepNext/><w:spacing w:before="120" w:after="80"/></w:pPr>'
                     f'<w:rPr><w:b/><w:color w:val="{HEAD_COLOR}"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>'))


# ============================================================ tables
def cell_paragraphs(ctx, text, size, bold=False, align=None, numbering=None):
    """Turn a table-cell string (may hold <br/>, <ul><li>) into paragraph XML."""
    jc = f'<w:jc w:val="{align}"/>' if align else ''
    ppr = f'<w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/>{jc}'
    out = []
    parts = re.split(r'(<ul>.*?</ul>|<ol>.*?</ol>)', text, flags=re.S | re.I)
    for part in parts:
        if not part:
            continue
        lm = re.match(r'<(ul|ol)>(.*)</\1>', part, re.S | re.I)
        if lm:
            items = re.findall(r'<li>(.*?)</li>', lm.group(2), re.S | re.I)
            for k, it in enumerate(items):
                if lm.group(1).lower() == 'ul':
                    num = f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{numbering.bullet_num}"/></w:numPr>'
                    ind = '<w:ind w:left="220" w:hanging="200"/>'
                    out.append(p_xml(runs_xml(ctx, it.strip(), size, bold=bold), None,
                                     num + f'<w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/>{ind}'))
                else:
                    out.append(p_xml(runs_xml(ctx, f'{k + 1}. ' + it.strip(), size, bold=bold), None, ppr))
            continue
        part = part.strip()
        part = re.sub(r'^(<br\s*/?>)+|(<br\s*/?>)+$', '', part)
        if part:
            out.append(p_xml(runs_xml(ctx, part, size, bold=bold), None, ppr))
    if not out:
        out.append(p_xml('', None, ppr))
    return ''.join(out)


def measure(text):
    """Return (longest word, total length) of a cell's visible text."""
    t = plain(re.sub(r'<br\s*/?>|</?(ul|ol|li)>', ' ', text))
    words = re.split(r'\s+', t)
    longest = max((len(w) for w in words), default=0)
    return longest, len(t)


def col_widths(header, rows, avail, size):
    ncol = len(header)
    cw = size * 5.6          # twips per average character (size in half-points)
    pad = 260
    mins, prefs = [], []
    for c in range(ncol):
        cells = [header[c]] + [r[c] for r in rows]
        lw = max([measure(x)[0] for x in cells[1:]] + [math.ceil(measure(header[c])[0] * 1.15)])
        lw = max(lw, 3)
        tot = [measure(x)[1] for x in cells]
        mx = max(tot)
        avg = sum(tot[1:]) / max(1, len(tot) - 1) if len(tot) > 1 else tot[0]
        mins.append(min(lw, 22) * cw + pad)
        prefs.append(max(min(lw, 22) * cw + pad, min(mx, max(avg * 1.6, lw), 90) * cw + pad))
    return mins, prefs


def allocate(mins, prefs, avail):
    if sum(prefs) <= avail:
        scale = avail / sum(prefs)
        w = [p * scale for p in prefs]
    elif sum(mins) >= avail:
        # keep narrow columns at their minimum; squeeze the wide ones (long words break)
        small = [m <= 1300 for m in mins]
        fixed = sum(m for m, sm in zip(mins, small) if sm)
        big = sum(m for m, sm in zip(mins, small) if not sm) or 1
        room = max(avail - fixed, avail * 0.3)
        w = [m if sm else m * room / big for m, sm in zip(mins, small)]
        tot = sum(w)
        w = [x * avail / tot for x in w]
    else:
        extra = avail - sum(mins)
        span = sum(p - m for p, m in zip(prefs, mins)) or 1
        w = [m + extra * (p - m) / span for p, m in zip(prefs, mins)]
    w = [int(x) for x in w]
    w[-1] += avail - sum(w)
    return w


def needs_landscape(header, rows):
    if len(header) < 6:
        return False
    mins, prefs = col_widths(header, rows, TEXT_W_PORTRAIT, TABLE_SZ)
    comfortable = sum(max(m, min(p, 26 * TABLE_SZ * 5.6 + 230)) for m, p in zip(mins, prefs))
    return sum(mins) > TEXT_W_PORTRAIT * 1.02 or (len(header) >= 7 and comfortable > TEXT_W_PORTRAIT * 1.45)


def table_xml(ctx, numbering, header, rows, avail, widths=None, size=TABLE_SZ, header_align=None,
              first_col_bold=False, min_row_h=None):
    ncol = len(header)
    if widths is None:
        mins, prefs = col_widths(header, rows, avail, size)
        widths = allocate(mins, prefs, avail)
    else:
        tot = sum(widths)
        widths = [int(w * avail / tot) for w in widths]
        widths[-1] += avail - sum(widths)
    b = f'w:val="single" w:sz="4" w:space="0" w:color="{BORDER_COLOR}"'
    tblpr = (f'<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>'
             f'<w:tblBorders><w:top {b}/><w:left {b}/><w:bottom {b}/><w:right {b}/><w:insideH {b}/><w:insideV {b}/>'
             f'</w:tblBorders><w:tblLayout w:type="fixed"/>'
             f'<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
             f'<w:bottom w:w="0" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>'
             f'<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" '
             f'w:noHBand="0" w:noVBand="1"/></w:tblPr>')
    grid = '<w:tblGrid>' + ''.join(f'<w:gridCol w:w="{w}"/>' for w in widths) + '</w:tblGrid>'
    trs = []
    hdr_cells = ''
    for c, h in enumerate(header):
        hdr_cells += (f'<w:tc><w:tcPr><w:tcW w:w="{widths[c]}" w:type="dxa"/>'
                      f'<w:shd w:val="clear" w:color="auto" w:fill="{HEADER_FILL}"/><w:vAlign w:val="center"/></w:tcPr>'
                      f'{cell_paragraphs(ctx, h, size, bold=True, align=header_align, numbering=numbering)}</w:tc>')
    trs.append(f'<w:tr><w:trPr><w:cantSplit/><w:tblHeader/><w:trHeight w:val="400"/></w:trPr>{hdr_cells}</w:tr>')
    for r in rows:
        tcs = ''
        total = sum(len(x) for x in r)
        for c, v in enumerate(r):
            tcs += (f'<w:tc><w:tcPr><w:tcW w:w="{widths[c]}" w:type="dxa"/></w:tcPr>'
                    f'{cell_paragraphs(ctx, v, size, bold=(first_col_bold and c == 0), numbering=numbering)}</w:tc>')
        trpr = '<w:cantSplit/>' if total < 700 else ''
        if min_row_h:
            trpr += f'<w:trHeight w:val="{min_row_h}"/>'
        trs.append(f'<w:tr><w:trPr>{trpr}</w:trPr>{tcs}</w:tr>')
    return f'<w:tbl {NSDECL}>{tblpr}{grid}{"".join(trs)}</w:tbl>'


# ============================================================ mermaid
def find_mermaid():
    """Locate a mermaid build and a Node Playwright install."""
    cands = []
    roots = [os.environ.get('MERMAID_NODE_MODULES', '')]
    scratch = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    roots += [os.path.join(scratch, 'bv', 'brokerverse', 'node_modules')]
    try:
        roots.append(subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, timeout=20).stdout.strip())
    except Exception:
        pass
    for r in roots:
        if r and os.path.isfile(os.path.join(r, 'mermaid', 'dist', 'mermaid.min.js')):
            cands.append(os.path.join(r, 'mermaid', 'dist', 'mermaid.min.js'))
    if not cands:
        return None
    try:
        groot = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return None
    if not os.path.isdir(os.path.join(groot, 'playwright')):
        return None
    return {'mermaid': cands[0], 'node_path': groot}


RENDER_JS = r"""
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [mjs, src, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent('<html><body style="margin:0;background:#fff"><div id="d"></div></body></html>');
  await page.addScriptTag({ path: mjs });
  const code = fs.readFileSync(src, 'utf8');
  await page.evaluate(async (code) => {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Segoe UI, Arial, sans-serif' });
    const { svg } = await mermaid.render('g', code);
    document.getElementById('d').innerHTML = svg;
  }, code);
  const el = await page.$('#d svg');
  await el.screenshot({ path: out, omitBackground: false });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
"""


def render_mermaid(info, code, tmpdir, idx):
    src = os.path.join(tmpdir, f'd{idx}.mmd')
    out = os.path.join(tmpdir, f'd{idx}.png')
    js = os.path.join(tmpdir, 'render.js')
    with open(src, 'w') as f:
        f.write(code)
    with open(js, 'w') as f:
        f.write(RENDER_JS)
    env = dict(os.environ, NODE_PATH=info['node_path'])
    r = subprocess.run(['node', js, info['mermaid'], src, out], capture_output=True, text=True, env=env, timeout=120)
    if r.returncode != 0 or not os.path.isfile(out):
        raise RuntimeError(r.stderr[-400:])
    return out


def clean_label(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] == '"':
        s = s[1:-1]
    parts = re.split(r'<br\s*/?>', s, flags=re.I)
    s = parts[0]
    for nxt in parts[1:]:
        n = nxt.strip()
        if re.match(r'^(\(|and\b|or\b|of\b|for\b|to\b|with\b|in\b|on\b|the\b|a\b|by\b|from\b)', n) or s.rstrip().endswith((',', ':', ';', '.', '+', '-', '/')):
            s = s.rstrip() + ' ' + n
        else:
            s = s.rstrip() + ', ' + n
    s = re.sub(r'</?[a-z][^>]*>', '', s, flags=re.I)
    s = s.replace('#quot;', '"').replace('#40;', '(').replace('#41;', ')')
    s = re.sub(r',\s*,', ',', s)
    s = re.sub(r'\(\s*,\s*', '(', s)
    s = re.sub(r'\s+', ' ', s).strip(' ,')
    return s


NODE_SHAPES = [('(((', ')))'), ('((', '))'), ('([', '])'), ('[[', ']]'), ('[(', ')]'), ('{{', '}}'),
               ('[/', '/]'), ('[\\', '\\]'), ('[/', '\\]'), ('[\\', '/]'), ('[', ']'), ('(', ')'), ('{', '}'), ('>', ']')]


def parse_node(tok, nodes, order, group):
    """Parse 'id["label"]' or 'id' and register it. Returns id."""
    tok = tok.strip()
    m = re.match(r'^([\w.\-]+)(.*)$', tok, re.S)
    if not m:
        return None
    nid, rest = m.group(1), m.group(2).strip()
    rest = re.sub(r':::[\w-]+$', '', rest)
    label = None
    shape = 'box'
    for o, c in NODE_SHAPES:
        if rest.startswith(o) and rest.endswith(c) and len(rest) >= len(o) + len(c):
            label = rest[len(o):len(rest) - len(c)]
            shape = 'decision' if o == '{' else ('db' if o == '[(' else 'box')
            break
    if nid not in nodes:
        nodes[nid] = {'label': nid, 'shape': 'box', 'group': group}
        order.append(nid)
    if label is not None:
        lab = label.strip()
        if len(lab) >= 2 and lab[0] == lab[-1] == '"':
            lab = lab[1:-1]
        first = re.split(r'<br\s*/?>', lab, flags=re.I)
        nodes[nid]['label'] = clean_label(label)
        nodes[nid]['short'] = clean_label(first[0])
        nodes[nid]['rest'] = clean_label(', '.join(first[1:])) if len(first) > 1 else ''
        nodes[nid]['shape'] = shape
    if group and not nodes[nid].get('group'):
        nodes[nid]['group'] = group
    return nid


EDGE_RE = re.compile(
    r'\s*(?:'
    r'(?P<a>(?:<)?(?:-{2,}|={2,}|-\.+-?)(?:>|x|o)?)\|(?P<l1>[^|]*)\|'
    r'|(?P<b>-{2,}|={2,}|-\.)\s*(?P<l2>[^->|=][^>]*?)\s*(?P<b2>-{2,}>|={2,}>|\.->|\.-)'
    r'|(?P<c><?(?:-{2,}|={2,}|-\.+-?)(?:>|x|o)?)'
    r')\s*')


def split_edges(line):
    """Split 'A -->|x| B --> C' into nodes and connectors."""
    parts, conns = [], []
    pos = 0
    depth = 0
    quote = False
    i = 0
    buf_start = 0
    while i < len(line):
        ch = line[i]
        if ch == '"':
            quote = not quote
        if not quote:
            if ch in '[({':
                depth += 1
            elif ch in '])}':
                depth = max(0, depth - 1)
            elif depth == 0:
                m = EDGE_RE.match(line, i)
                if m and (m.group('a') or m.group('b') or m.group('c')) and m.end() > i:
                    conn = m.group(0)
                    if re.search(r'[-=.]{2,}|-\.', conn):
                        parts.append(line[buf_start:i])
                        label = (m.group('l1') or m.group('l2') or '').strip()
                        dotted = '.' in (m.group('a') or m.group('b') or m.group('c') or '')
                        both = conn.strip().startswith('<')
                        conns.append({'label': clean_label(label) if label else '', 'dotted': dotted, 'both': both})
                        i = m.end()
                        buf_start = i
                        continue
        i += 1
    parts.append(line[buf_start:])
    return [p.strip() for p in parts], conns


def mermaid_to_blocks(code):
    """Convert a mermaid diagram into tables or numbered steps (list of block dicts)."""
    lines = [l.rstrip() for l in code.split('\n')]
    lines = [l for l in lines if l.strip() and not l.strip().startswith('%%')]
    if not lines:
        return []
    kind = lines[0].strip().split()[0]
    body = [l.strip() for l in lines[1:]]
    if kind in ('flowchart', 'graph'):
        return flow_blocks(body)
    if kind == 'sequenceDiagram':
        return seq_blocks(body)
    if kind.startswith('stateDiagram'):
        return state_blocks(body)
    if kind == 'erDiagram':
        return er_blocks(body)
    if kind == 'pie':
        title = None
        rows = []
        for l in body:
            if l.startswith('title'):
                title = l[5:].strip()
            m = re.match(r'"([^"]+)"\s*:\s*([\d.]+)', l)
            if m:
                rows.append([m.group(1), m.group(2)])
        tot = sum(float(r[1]) for r in rows) or 1
        rows = [[a, b, f'{float(b) * 100 / tot:.0f}%'] for a, b in rows]
        out = []
        if title:
            out.append({'t': 'caption', 'text': title})
        out.append({'t': 'table', 'header': ['Category', 'Count', 'Share'], 'rows': rows})
        return out
    if kind == 'quadrantChart':
        return quadrant_blocks(body)
    warn(f'unsupported mermaid diagram type {kind}; shown as steps')
    return [{'t': 'list', 'ordered': True, 'start': 1,
             'items': [{'blocks': [{'t': 'para', 'text': clean_label(l)}]} for l in body]}]


def flow_blocks(body):
    nodes, order, edges, groups = {}, [], [], []
    stack = []
    for l in body:
        if re.match(r'^(classDef|class|style|linkStyle|click|direction)\b', l):
            continue
        m = re.match(r'^subgraph\s+(.*)$', l)
        if m:
            g = m.group(1).strip()
            gm = re.match(r'^([\w.\-]+)\s*\[(.*)\]$', g)
            name = clean_label(gm.group(2)) if gm else clean_label(g)
            gid = gm.group(1) if gm else g
            stack.append(name)
            groups.append((gid, name))
            continue
        if l == 'end':
            if stack:
                stack.pop()
            continue
        grp = stack[-1] if stack else None
        parts, conns = split_edges(l)
        if not conns:
            for tok in re.split(r'\s*&\s*', l):
                parse_node(tok, nodes, order, grp)
            continue
        ids = []
        for p in parts:
            ids.append([parse_node(t, nodes, order, grp) for t in re.split(r'\s*&\s*', p) if t.strip()])
        for k, c in enumerate(conns):
            for a in ids[k]:
                for b in ids[k + 1]:
                    if a and b:
                        edges.append((a, b, c))
    gid_names = {gid: name for gid, name in groups}
    # edges to or from a subgraph id refer to the group
    for nid in list(nodes):
        if nid in gid_names and nodes[nid]['label'] == nid:
            nodes[nid]['label'] = gid_names[nid]
            nodes[nid]['isgroup'] = True
    out = []
    lab = lambda i: nodes[i]['label']
    decisions = any(n['shape'] == 'decision' for n in nodes.values())
    if groups and any(n.get('group') and not n.get('isgroup') for n in nodes.values()):
        rows = []
        for gid, name in groups:
            for nid in order:
                if nodes[nid].get('group') == name and not nodes[nid].get('isgroup'):
                    rows.append([name, lab(nid)])
        ungrouped = [nid for nid in order if not nodes[nid].get('group') and not nodes[nid].get('isgroup')]
        for nid in ungrouped:
            rows.append(['Other elements', lab(nid)])
        for k in range(len(rows) - 1, 0, -1):
            if rows[k][0] == rows[k - 1][0] and rows[k][0]:
                rows[k][0] = ''
        out.append({'t': 'table', 'header': ['Group', 'Element'], 'rows': rows, 'first_bold': True})
    if not edges:
        if not out:
            out.append({'t': 'list', 'ordered': False, 'start': 1,
                        'items': [{'blocks': [{'t': 'para', 'text': lab(n)}]} for n in order]})
        return out
    outd, ind_ = {}, {}
    for a_, b_, c_ in edges:
        outd[a_] = outd.get(a_, 0) + 1
        ind_[b_] = ind_.get(b_, 0) + 1
    used = set(x for e in edges for x in e[:2])
    starts = [x for x in used if ind_.get(x, 0) == 0]
    if (not decisions and len(starts) == 1 and all(v <= 1 for v in outd.values())
            and all(v <= 1 for v in ind_.values()) and len(edges) == len(used) - 1 and len(used) >= 3):
        nxt = {a_: (b_, c_) for a_, b_, c_ in edges}
        x = starts[0]
        items = []
        conn = None
        while x is not None:
            t = lab(x)
            if conn and conn['label']:
                t = f'*({conn["label"]})* ' + t
            items.append({'blocks': [{'t': 'para', 'text': t}]})
            x, conn = nxt.get(x, (None, None))
        out.append({'t': 'list', 'ordered': True, 'start': 1, 'items': items})
        return out
    if decisions:
        # numbered steps in order of first appearance along the edges
        seq = []
        for a, b, c in edges:
            for x in (a, b):
                if x not in seq:
                    seq.append(x)
        for x in order:
            if x not in seq:
                seq.append(x)
        num = {x: k + 1 for k, x in enumerate(seq)}
        rows = []
        for x in seq:
            nxt = []
            for a, b, c in edges:
                if a == x:
                    t = f'{c["label"]}: ' if c['label'] else ''
                    nxt.append(f'{t}step {num[b]} ({lab(b)})' if len(lab(b)) < 60 else f'{t}step {num[b]}')
            kind = 'Decision' if nodes[x]['shape'] == 'decision' else 'Step'
            rows.append([str(num[x]), (f'**{kind}:** ' if kind == 'Decision' else '') + lab(x),
                         '<br/>'.join(nxt) if nxt else 'End'])
        out.append({'t': 'table', 'header': ['No.', 'Step', 'Next'], 'rows': rows})
        return out
    members = {}
    for nid in order:
        if nodes[nid].get('group'):
            members.setdefault(nodes[nid]['group'], []).append(nid)

    def short(i):
        n = nodes[i]
        if len(n['label']) <= 45 or not n.get('rest'):
            return n['label']
        g = n.get('group')
        if g and len(members.get(g, [])) == 1:
            return g
        return n.get('short') or n['label']
    multi = [n for n in order if short(n) != nodes[n]['label']]
    if out:
        pass
    elif multi:
        used = []
        for a, b, c in edges:
            for x in (a, b):
                if x not in used:
                    used.append(x)
        out.append({'t': 'table', 'header': ['Element', 'Details'], 'first_bold': True,
                    'rows': [[short(n), nodes[n]['label'][len(short(n)):].lstrip(' ,') or nodes[n].get('rest')]
                             for n in used if short(n) != nodes[n]['label']]})
    rows = []
    for a, b, c in edges:
        lbl = c['label']
        if c['both']:
            lbl = (lbl + ' ' if lbl else '') + '(both directions)'
        rows.append([short(a), lbl or '-', short(b)])
    out.append({'t': 'table', 'header': ['From', 'Connection', 'To'], 'rows': rows})
    return out


def seq_blocks(body):
    names = {}
    rows = []
    cond = []
    step = 0
    for l in body:
        m = re.match(r'^(participant|actor)\s+(\S+)(?:\s+as\s+(.*))?$', l)
        if m:
            names[m.group(2)] = clean_label(m.group(3) or m.group(2))
            continue
        if l == 'autonumber' or l.startswith(('activate', 'deactivate')):
            continue
        m = re.match(r'^(alt|opt|loop|par|critical|break|rect)\b\s*(.*)$', l)
        if m:
            word = {'alt': 'If', 'opt': 'Optional', 'loop': 'Repeat', 'par': 'In parallel',
                    'critical': 'Critical', 'break': 'Break', 'rect': ''}[m.group(1)]
            cond.append(m.group(1))
            if word:
                rows.append(['', f'**{word}: {clean_label(m.group(2))}**', '', ''])
            continue
        m = re.match(r'^(else|and)\b\s*(.*)$', l)
        if m:
            rows.append(['', f'**{"Otherwise" if m.group(1) == "else" else "And"}: {clean_label(m.group(2))}**'.replace(': **', '**'), '', ''])
            continue
        if l == 'end':
            if cond:
                c = cond.pop()
                if c != 'rect':
                    rows.append(['', '**End of ' + {'alt': 'condition', 'opt': 'optional part', 'loop': 'repeat',
                                                    'par': 'parallel part'}.get(c, 'block') + '**', '', ''])
            continue
        m = re.match(r'^[Nn]ote\s+(?:over|left of|right of)\s+([^:]+):\s*(.*)$', l)
        if m:
            who = ', '.join(names.get(x.strip(), x.strip()) for x in m.group(1).split(','))
            rows.append(['', f'*Note ({who}): {clean_label(m.group(2))}*', '', ''])
            continue
        m = re.match(r'^([\w.]+(?:-[\w.]+)*)\s*(-{1,2}>>|-{1,2}>|-{1,2}x|-{1,2}\))\s*[+-]?([\w.]+(?:-[\w.]+)*)\s*:\s*(.*)$', l)
        if m:
            step += 1
            a, b = names.get(m.group(1), m.group(1)), names.get(m.group(3), m.group(3))
            msg = clean_label(m.group(4))
            if m.group(2).startswith('--'):
                msg += ' (reply)'
            rows.append([str(step), a, b, msg])
            continue
    # merge the label rows into a 4-column table with spans emulated by text in column 2
    out_rows = []
    for r in rows:
        if r[0] == '' and r[2] == '' and r[3] == '':
            out_rows.append(['', r[1], '', ''])
        else:
            out_rows.append(r)
    return [{'t': 'table', 'header': ['Step', 'From', 'To', 'Message'], 'rows': out_rows}]


def state_blocks(body):
    rows = []
    for l in body:
        m = re.match(r'^(\[\*\]|[\w.\-]+)\s*-->\s*(\[\*\]|[\w.\-]+)\s*(?::\s*(.*))?$', l)
        if m:
            a = 'Start' if m.group(1) == '[*]' else m.group(1)
            b = 'End' if m.group(2) == '[*]' else m.group(2)
            rows.append([a, clean_label(m.group(3) or '-'), b])
    return [{'t': 'table', 'header': ['From state', 'Event or action', 'To state'], 'rows': rows}]


ER_CARD = {'||': 'exactly one', '|o': 'zero or one', 'o|': 'zero or one', '}|': 'one or more', '|{': 'one or more',
           '}o': 'zero or more', 'o{': 'zero or more'}


def er_blocks(body):
    rows = []
    attrs = {}
    cur = None
    for l in body:
        if cur:
            if l.startswith('}'):
                cur = None
                continue
            parts = l.split()
            if len(parts) >= 2:
                attrs[cur].append([parts[1], parts[0], ' '.join(p for p in parts[2:] if not p.startswith('"')),
                                   clean_label(' '.join(re.findall(r'"([^"]*)"', l)))])
            continue
        m = re.match(r'^([\w.\-]+)\s*\{$', l)
        if m:
            cur = m.group(1)
            attrs[cur] = []
            continue
        m = re.match(r'^([\w.\-"]+)\s+([|}o][|o])(--|\.\.)([|o][|{o])\s+([\w.\-"]+)\s*:\s*(.*)$', l)
        if m:
            left, cl, line, cr, right, label = m.groups()
            rows.append([left.strip('"'), f'{ER_CARD.get(cl, cl)} to {ER_CARD.get(cr, cr)}',
                         right.strip('"'), clean_label(label.strip('"'))])
    out = []
    if rows:
        out.append({'t': 'table', 'header': ['Table', 'Cardinality', 'Related table', 'Relationship'], 'rows': rows})
    for ent, a in attrs.items():
        if a:
            out.append({'t': 'caption', 'text': f'{ent}: key columns'})
            out.append({'t': 'table', 'header': ['Column', 'Type', 'Key', 'Note'], 'rows': a})
    return out


def quadrant_blocks(body):
    meta = {}
    pts = []
    for l in body:
        m = re.match(r'^(title|x-axis|y-axis|quadrant-\d)\s+(.*)$', l)
        if m:
            meta[m.group(1)] = m.group(2)
            continue
        m = re.match(r'^(.*?):\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]', l)
        if m:
            pts.append((m.group(1).strip(), float(m.group(2)), float(m.group(3))))
    xa = [s.strip() for s in meta.get('x-axis', 'Low --> High').split('-->')]
    ya = [s.strip() for s in meta.get('y-axis', 'Low --> High').split('-->')]

    def quad(x, y):
        if x >= 0.5 and y >= 0.5:
            return meta.get('quadrant-1', 'Q1')
        if x < 0.5 and y >= 0.5:
            return meta.get('quadrant-2', 'Q2')
        if x < 0.5 and y < 0.5:
            return meta.get('quadrant-3', 'Q3')
        return meta.get('quadrant-4', 'Q4')
    rows = [[n, f'{x:.2f}', f'{y:.2f}', quad(x, y)] for n, x, y in pts]
    rows.sort(key=lambda r: (-float(r[1]) - float(r[2])))
    out = []
    if 'title' in meta:
        out.append({'t': 'caption', 'text': meta['title']})
    hx = 'Likelihood' if 'likelihood' in meta.get('x-axis', '').lower() else 'X position'
    hy = 'Impact' if 'impact' in meta.get('y-axis', '').lower() else 'Y position'
    out.append({'t': 'para', 'text': f'Positions are on a scale of 0 to 1 ({xa[0]} to {xa[-1]}; {ya[0]} to {ya[-1]}).'})
    out.append({'t': 'table', 'header': ['Item', f'{hx} (0-1)', f'{hy} (0-1)', 'Quadrant'], 'rows': rows})
    return out


# ============================================================ document model
class Heading:
    def __init__(self, level, text, numbered, front=False, number=None):
        self.level = level
        self.text = text
        self.numbered = numbered
        self.front = front
        self.number = number
        self.bookmark = None
        self.page = None


def split_doc(md):
    """Return title, preamble blocks, sections [(heading block, blocks)]."""
    blocks = parse_blocks(md.split('\n'))
    title = None
    if blocks and blocks[0]['t'] == 'heading' and blocks[0]['level'] == 1:
        title = plain(blocks[0]['text'])
        blocks = blocks[1:]
    pre = []
    while blocks and not (blocks[0]['t'] == 'heading' and blocks[0]['level'] == 2):
        pre.append(blocks.pop(0))
    sections = []
    for b in blocks:
        if b['t'] == 'heading' and b['level'] == 2:
            sections.append([b, []])
        else:
            sections[-1][1].append(b)
    return title, pre, sections


def kv_table(blocks):
    for b in blocks:
        if b['t'] == 'table' and len(b['header']) == 2 and plain(b['header'][0]).lower() in ('item', 'field', 'property'):
            return {plain(r[0]).strip().lower(): r[1] for r in b['rows']}, b
    return {}, None


def label_of(b):
    if b['t'] == 'heading':
        return plain(b['text']).strip().lower()
    if b['t'] == 'para':
        m = re.match(r'^\*\*([^*]+)\*\*\s*:?$', b['text'].strip())
        if m:
            return m.group(1).strip().rstrip(':').lower()
    return None


def doc_control(blocks):
    """Split a document-control section into kv dict, change log rows, reviewers, approval rows, other blocks."""
    kv, kvb = kv_table(blocks)
    res = {'kv': kv, 'kv_block': kvb, 'changes': [], 'reviewers': None, 'approval': None, 'other': []}
    cur = None
    for b in blocks:
        lab = label_of(b)
        if lab:
            cur = lab
            continue
        if b is kvb or b['t'] == 'hr':
            continue
        if b['t'] == 'table':
            hdr = [plain(h).lower() for h in b['header']]
            if cur and 'change' in cur or ('version' in hdr and 'change' in ' '.join(hdr)):
                res['changes'] = [dict(zip(hdr, r)) for r in b['rows']]
                continue
            if cur and 'approv' in cur or ('signature' in hdr):
                res['approval'] = [dict(zip(hdr, r)) for r in b['rows']]
                continue
            if cur and 'review' in cur:
                res['reviewers'] = b
                continue
        res['other'].append((cur, b))
    return res


def parse_date(s):
    s = plain(s or '').strip()
    m = re.search(r'(\d{1,2})\s+(' + '|'.join(MONTHS) + r')\s+(\d{4})', s)
    if m:
        return f'{int(m.group(1)):02d} {m.group(2)} {m.group(3)}'
    m = re.search(r'\b(\d{1,2})/(\d{1,2})/(\d{4})\b', s)
    if m:
        return f'{int(m.group(1)):02d} {MONTHS[int(m.group(2)) - 1]} {m.group(3)}'
    return None


# ============================================================ acronyms
COMMON_ACRONYMS = {
    'API': 'Application programming interface', 'BRD': 'Business Requirement Document (TISPH, v2.2, signed)',
    'FRS': 'Functional Requirement Specification', 'NFR': 'Non-functional requirement',
    'UAT': 'User acceptance testing', 'SIT': 'System integration testing', 'TISPH': 'Toyota Insurance Services Philippines',
    'TFS': 'Toyota Financial Services', 'TFSPH': 'Toyota Financial Services Philippines',
    'BIR': 'Bureau of Internal Revenue (Philippines)', 'SAP': 'SAP enterprise resource planning system (TISPH general ledger)',
    'GL': 'General ledger', 'CTPL': 'Compulsory Third Party Liability motor insurance', 'SOA': 'Statement of account',
    'OR': 'Official receipt', 'PDC': 'Post-dated cheque', 'EWT': 'Expanded withholding tax', 'VAT': 'Value-added tax',
    'TIN': 'Taxpayer identification number', 'GM': 'General Manager', 'SoD': 'Segregation of duties',
    'RBAC': 'Role-based access control', 'SLA': 'Service level agreement', 'SLO': 'Service level objective',
    'DR': 'Disaster recovery', 'BCP': 'Business continuity plan', 'RPO': 'Recovery point objective',
    'RTO': 'Recovery time objective', 'MTTR': 'Mean time to recover', 'MTBF': 'Mean time between failures',
    'PITR': 'Point-in-time restore', 'WAF': 'Web application firewall', 'TLS': 'Transport Layer Security',
    'MFA': 'Multi-factor authentication', 'SSO': 'Single sign-on', 'OIDC': 'OpenID Connect',
    'TOTP': 'Time-based one-time password', 'SMTP': 'Simple Mail Transfer Protocol', 'SFTP': 'SSH File Transfer Protocol',
    'CSV': 'Comma-separated values file', 'XLSX': 'Excel workbook file', 'PDF': 'Portable Document Format',
    'JSON': 'JavaScript Object Notation', 'HTTP': 'Hypertext Transfer Protocol', 'HTTPS': 'HTTP over TLS',
    'REST': 'Representational state transfer (API style)', 'CI': 'Continuous integration', 'CD': 'Continuous delivery',
    'CI/CD': 'Continuous integration and continuous delivery', 'RACI': 'Responsible, Accountable, Consulted, Informed',
    'SOW': 'Statement of Work', 'ADR': 'Architecture decision record', 'KT': 'Knowledge transfer',
    'FGA': 'Finance, General Accounting (TISPH department and BRD workbook)', 'CCD': 'Cash Control Department',
    'PDU': 'Payment and Disbursement Unit (Cash Control)', 'CCD-PDU': 'Cash Control Department, Payment and Disbursement Unit',
    'MOM': 'Minutes of meeting', 'BSM': 'Business solution mapping', 'LTO': 'Land Transportation Office',
    'COC': 'Certificate of cover (CTPL)', 'LGU': 'Local government unit', 'PA': 'Personal accident (insurance)',
    'DPO': 'Data Protection Officer', 'DPA': 'Data Privacy Act of 2012 (Philippines)', 'IC': 'Insurance Commission (Philippines)',
    'ID': 'Identifier', 'IT': 'Information technology', 'UI': 'User interface', 'UX': 'User experience',
    'QA': 'Quality assurance', 'PM': 'Project Manager', 'KPI': 'Key performance indicator', 'MBOS': 'Metrobank business online banking service',
    'BOC': 'Bank of Commerce', 'EIS': 'BIR Electronic Invoicing System', 'DAT': 'BIR data file format for alphalists and relief',
    'OTC': 'Over the counter', 'JV': 'Journal voucher', 'AP': 'Accounts payable', 'AR': 'Accounts receivable',
    'TRF': 'Transfer request form', 'NFT': 'Non-functional testing', 'SAST': 'Static application security testing',
    'DAST': 'Dynamic application security testing', 'ZAP': 'OWASP Zed Attack Proxy (security scanner)',
    'OWASP': 'Open Worldwide Application Security Project', 'WCAG': 'Web Content Accessibility Guidelines',
    'ARIA': 'Accessible Rich Internet Applications', 'TPS': 'Transactions per second', 'IOPS': 'Input/output operations per second',
    'AKS': 'Azure Kubernetes Service', 'ACR': 'Azure Container Registry', 'VNet': 'Azure virtual network',
    'HA': 'High availability', 'GZRS': 'Geo-zone-redundant storage', 'SOC': 'Security operations centre',
    'SMS': 'Short message service', 'URL': 'Uniform resource locator', 'SQL': 'Structured Query Language',
    'EC2': 'Amazon Elastic Compute Cloud', 'AWS': 'Amazon Web Services', 'PM2': 'Node.js process manager',
    'GLBA': 'Gramm-Leach-Bliley Act (United States)', 'PCI': 'Payment Card Industry', 'PCI DSS': 'Payment Card Industry Data Security Standard',
    'SOX': 'Sarbanes-Oxley Act (United States)', 'FFIEC': 'Federal Financial Institutions Examination Council (United States)',
    'SEC': 'Securities and Exchange Commission', 'GDPR': 'General Data Protection Regulation (European Union)',
    'DORA': 'Digital Operational Resilience Act (European Union)', 'CPU': 'Central processing unit',
    'ASVS': 'OWASP Application Security Verification Standard', 'STRIDE': 'Spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege',
    'RAID': 'Risks, assumptions, issues and dependencies', 'ERD': 'Entity-relationship diagram', 'SRS': 'Software Requirements Specification',
    'BI': 'Business intelligence', 'RMD': 'Risk Management Department', 'CR': 'Change request', 'GQ': 'Governance open question',
    'OPS': 'Operations (report prefix)', 'SLS': 'Sales (report prefix)', 'HR': 'Human resources', 'AML': 'Anti-money laundering',
    'FAQ': 'Frequently asked questions', 'E2E': 'End to end', 'PWA': 'Progressive web application', 'OTP': 'One-time password',
    'IP': 'Internet Protocol', 'DNS': 'Domain Name System', 'CDN': 'Content delivery network', 'PII': 'Personally identifiable information',
    'GST': 'Goods and services tax', 'DST': 'Documentary stamp tax', 'LGT': 'Local government tax', 'PHP': 'Philippine peso',
    'BS': 'Billing statement', 'BSI': 'Billing statement (insurer)', 'CBS': 'Commission billing statement', 'AC': 'Acceptance criterion',
    'MAN': 'Manual work package', 'EN': 'E-mail notification template', 'COMM': 'Commission (BRD module prefix)',
    'RMT': 'Remittance (FRS prefix)', 'DISB': 'Disbursement (BRD prefix)', 'INTG': 'Integration (BRD prefix)',
    'P95': '95th percentile', 'p95': '95th percentile', 'SPA': 'Single-page application', 'CORS': 'Cross-origin resource sharing',
    'CSRF': 'Cross-site request forgery', 'XSS': 'Cross-site scripting', 'JWT': 'JSON Web Token', 'HSTS': 'HTTP Strict Transport Security',
    'PKCE': 'Proof Key for Code Exchange (OAuth 2.0 extension)', 'GPS': 'Global Positioning System', 'ETL': 'Extract, transform, load',
    'CRM': 'Customer relationship management', 'CCDP': 'Cash Control Department, Payments', 'ITSM': 'IT service management',
    'NDA': 'Non-disclosure agreement', 'MSA': 'Master services agreement', 'AMC': 'Annual maintenance contract',
    'LOB': 'Line of business', 'OOTB': 'Out of the box', 'RI': 'Reinsurance', 'BV': 'BrokerVerse',
    'TBD': 'To be determined', 'N/A': 'Not applicable', 'VPN': 'Virtual private network', 'RDP': 'Remote Desktop Protocol',
    'OS': 'Operating system', 'CSPM': 'Cloud security posture management', 'HMAC': 'Hash-based message authentication code',
    'ISO': 'International Organization for Standardization', 'KYC': 'Know your customer', 'NSG': 'Network security group',
    'SDLC': 'Software development life cycle', 'SIEM': 'Security information and event management', 'SKU': 'Stock-keeping unit (Azure pricing tier)',
    'SMB': 'Server Message Block (file-sharing protocol)', 'WORM': 'Write once, read many (immutable storage)',
    'VA': 'Vulnerability assessment', 'DEV': 'Development environment', 'PROD': 'Production environment',
    'GB': 'Gigabyte', 'CWT': 'Creditable withholding tax', 'UTC': 'Coordinated Universal Time',
    'JPG': 'JPEG image file', 'PNG': 'Portable Network Graphics image file', 'MB': 'Megabyte',
    'SBOM': 'Software bill of materials', 'SSRF': 'Server-side request forgery', 'IDOR': 'Insecure direct object reference',
    'LOV': 'List of values', 'CAB': 'Change Advisory Board', 'FX': 'Foreign exchange', 'LRS': 'Locally redundant storage',
    'ZRS': 'Zone-redundant storage', 'SLI': 'Service level indicator', 'TCP': 'Transmission Control Protocol',
    'NPC': 'National Privacy Commission (Philippines)', 'ROI': 'Return on investment', 'CLI': 'Command-line interface',
    'IAR': 'Industrial All Risks (fire insurance)', 'OD': 'Own damage (motor cover)', 'AON': 'Acts of nature (motor cover)',
    'PD': 'Property damage (motor cover)', 'SI': 'Sum insured', 'TSI': 'Total sum insured', 'PV': 'Payment voucher',
    'NIA': 'Non-insurance accounting', 'AA': 'WCAG 2.1 conformance level AA', 'MBSS': 'Minimum Baseline Security Standard', 'TIS': 'Toyota Insurance Services', 'TPM': 'TISPH Project Manager', 'SP': 'Project Sponsor',
}


def harvest_glossaries(paths):
    out = {}
    for p in paths:
        try:
            with open(p, encoding='utf-8') as f:
                _, _, secs = split_doc(f.read())
        except OSError:
            continue
        for h, blocks in secs:
            if 'glossary' in plain(h['text']).lower() or 'acronym' in plain(h['text']).lower():
                for b in blocks:
                    if b['t'] == 'table' and len(b['header']) >= 2:
                        for r in b['rows']:
                            out.setdefault(plain(r[0]).strip(), plain(r[1]).strip())
    return out


def extract_acronyms(md, dictionary):
    text = re.sub(r'```.*?```', ' ', md, flags=re.S)
    text = re.sub(r'`[^`]*`', ' ', text)
    defs = {}
    # "Full Name (ABC)"
    for m in re.finditer(r'((?:[A-Z][\w\'-]*[ ,]+(?:(?:and|of|for|the|to|in|on|&)\s+)?){1,8})\(([A-Z][A-Za-z0-9/&-]{1,9})\)', text):
        words = m.group(1).strip(' ,').split()
        acr = m.group(2)
        initials = ''.join(w[0] for w in words if w[0].isupper())
        letters = re.sub(r'[^A-Z]', '', acr)
        if letters and initials.endswith(letters):
            k = len(letters)
            # keep the last k capitalised words plus any small words between them
            caps = [i for i, w in enumerate(words) if w[0].isupper()]
            start = caps[-k] if len(caps) >= k else 0
            defs.setdefault(acr, ' '.join(words[start:]).strip(' ,'))
    found = {}
    tokens = set(re.findall(r'(?<![\w/-])([A-Z][A-Z0-9]{1,}(?:/[A-Z]{2,})?|[A-Z][a-z][A-Z][A-Za-z]*)(?![\w-])', text))
    tokens |= set(re.findall(r'(?<![\w/-])(SoD|VNet|PCI DSS|CI/CD|CCD-PDU|N/A)(?![\w-])', text))
    unknown = []
    for t in sorted(tokens):
        if t in defs:
            found[t] = defs[t]
        elif t in dictionary:
            found[t] = dictionary[t]
        elif re.fullmatch(r'[A-Z]{2,6}', t):
            unknown.append(t)
    return found, unknown


# ============================================================ builder
class Builder:
    def __init__(self, args, md_text, page_map=None):
        self.args = args
        self.md = md_text
        self.page_map = page_map or {}
        self.doc = Document(args.template)
        self.ctx = Ctx(self.doc)
        self.num = Numbering(self.doc)
        self.headings = []
        self.items = []          # list of (xml element or marker)
        self.diagram_count = 0
        self.diagram_mode = []

    # -------------------------------------------------- helpers
    def add(self, xml_or_el):
        e = el(xml_or_el) if isinstance(xml_or_el, str) else xml_or_el
        self.items.append(e)
        return e

    def body_para(self, text, ppr='', style=None, size=None, italic=False):
        jc = '<w:jc w:val="both"/>' if not style else ''
        self.add(p_xml(runs_xml(self.ctx, text, size=size, italic=italic), style, ppr + jc))

    def heading(self, level, text, numbered, front=False, page_break=False):
        h = Heading(level, plain(text), numbered, front)
        self.ctx.bm_id += 1
        h.bookmark = f'_Toc{self.ctx.bm_id + 300000000}'
        h.bm_id = self.ctx.bm_id
        self.headings.append(h)
        if front:
            num = f'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{self.front_num}"/></w:numPr>'
        elif numbered:
            num = f'<w:numPr><w:ilvl w:val="{level - 1}"/><w:numId w:val="{self.body_num}"/></w:numPr>'
        else:
            num = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr><w:ind w:left="0" w:firstLine="0"/>'
        pb = '<w:pageBreakBefore/>' if page_break else ''
        runs = runs_xml(self.ctx, text, base_fmt=frozenset())
        self.add(f'<w:p {NSDECL}><w:pPr><w:pStyle w:val="Heading{level}"/>{pb}{num}</w:pPr>'
                 f'<w:bookmarkStart w:id="{h.bm_id}" w:name="{h.bookmark}"/>{runs}'
                 f'<w:bookmarkEnd w:id="{h.bm_id}"/></w:p>')
        return h

    def small_heading(self, text):
        self.add(p_xml(runs_xml(self.ctx, text, size=20, bold=True, color=HEAD_COLOR), None,
                       '<w:keepNext/><w:spacing w:before="200" w:after="80"/>'))

    def table(self, header, rows, widths=None, landscape=None, first_bold=False, header_align=None, min_row_h=None):
        if landscape is None:
            landscape = needs_landscape(header, rows)
        avail = TEXT_W_LANDSCAPE if landscape else TEXT_W_PORTRAIT
        size = TABLE_SZ if len(header) < 9 else TABLE_SZ - 1
        xml = table_xml(self.ctx, self.num, header, rows, avail, widths, size, header_align, first_bold, min_row_h)
        e = self.add(xml)
        e.landscape = landscape
        # a small gap after each table
        self.add(p_xml('', None, '<w:spacing w:before="0" w:after="60" w:line="240" w:lineRule="auto"/>'
                       '<w:rPr><w:sz w:val="12"/></w:rPr>'))
        return e

    # -------------------------------------------------- blocks
    def render_blocks(self, blocks, list_level=0, list_num=None):
        for b in blocks:
            self.render_block(b, list_level, list_num)

    def render_block(self, b, list_level=0, list_num=None):
        t = b['t']
        if t == 'para':
            text = b['text']
            if re.fullmatch(r'\*\*[^*]+\*\*:?', text.strip()) and list_level == 0:
                self.small_heading(plain(text).rstrip(':'))
                return
            ind = f'<w:ind w:left="{400 + 380 * (list_level - 1)}"/>' if list_level else ''
            self.body_para(text, ind)
        elif t == 'heading':
            lvl = b['level']
            self.content_heading(lvl, b['text'])
        elif t == 'hr':
            return
        elif t == 'table':
            self.table(b['header'], b['rows'], first_bold=b.get('first_bold', False))
        elif t == 'caption':
            self.add(p_xml(runs_xml(self.ctx, b['text'], size=18, bold=True, color=HEAD_COLOR), 'Caption', ''))
        elif t == 'code':
            if b['lang'] == 'mermaid':
                self.diagram(b['text'])
            else:
                self.code_block(b['text'], list_level)
        elif t == 'quote':
            for qb in b['blocks']:
                if qb['t'] == 'para':
                    self.add(p_xml(runs_xml(self.ctx, qb['text'], italic=True), None,
                                   f'<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="{BRAND_BLUE}"/></w:pBdr>'
                                   '<w:ind w:left="300" w:right="300"/><w:spacing w:before="80" w:after="120"/>'))
                else:
                    self.render_block(qb, list_level, list_num)
        elif t == 'list':
            self.render_list(b, list_level)
        elif t == 'image':
            src = b['src'] if os.path.isabs(b['src']) else os.path.join(self.args.source_dir, b['src'])
            if not os.path.exists(src):
                warn(f'image not found: {b["src"]}')
                return
            self.picture(src)
            if b['alt']:
                self.add(p_xml(runs_xml(self.ctx, b['alt'], size=18, italic=True), 'Caption', ''))

    def render_list(self, b, level):
        if b['ordered']:
            nid = self.num.new_num(self.num.decimal_abs, start=b['start'])
        else:
            nid = self.num.bullet_num
        for item in b['items']:
            blocks = item['blocks']
            first = True
            for sb in blocks:
                if first and sb['t'] == 'para':
                    self.add(p_xml(runs_xml(self.ctx, sb['text']),
                                   None, f'<w:numPr><w:ilvl w:val="{level}"/><w:numId w:val="{nid}"/></w:numPr>'
                                         '<w:spacing w:after="60"/><w:jc w:val="left"/>'))
                    first = False
                    continue
                first = False
                if sb['t'] == 'list':
                    self.render_list(sb, level + 1)
                elif sb['t'] == 'para':
                    self.add(p_xml(runs_xml(self.ctx, sb['text']), None,
                                   f'<w:ind w:left="{400 + 380 * level}"/><w:spacing w:after="60"/>'))
                else:
                    self.render_block(sb, level + 1)
        # space after a top-level list
        if level == 0:
            self.add(p_xml('', None, '<w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/>'))

    def code_block(self, text, level=0):
        lines = text.split('\n')
        ind = 0 if not level else 400 + 380 * (level - 1)
        for k, ln in enumerate(lines):
            sp_b = 80 if k == 0 else 0
            sp_a = 80 if k == len(lines) - 1 else 0
            r = (f'<w:r><w:rPr><w:rFonts w:ascii="{MONO}" w:hAnsi="{MONO}" w:cs="{MONO}"/><w:color w:val="1F3B57"/>'
                 f'<w:sz w:val="17"/><w:szCs w:val="17"/></w:rPr><w:t xml:space="preserve">{xesc(ln) or " "}</w:t></w:r>')
            self.add(p_xml(r, None, f'<w:keepLines/>{"<w:keepNext/>" if k < len(lines) - 1 and len(lines) < 25 else ""}'
                                    f'<w:shd w:val="clear" w:color="auto" w:fill="{CODE_FILL}"/>'
                                    f'<w:spacing w:before="{sp_b}" w:after="{sp_a}" w:line="240" w:lineRule="auto"/>'
                                    f'<w:ind w:left="{ind + 120}" w:right="120"/>'))
        self.add(p_xml('', None, '<w:spacing w:before="0" w:after="60"/>'))

    def diagram(self, code):
        self.diagram_count += 1
        n = self.diagram_count
        if self.args.mermaid_info:
            try:
                png = render_mermaid(self.args.mermaid_info, code, self.args.tmpdir, f'{os.getpid()}_{n}')
                self.picture(png)
                self.diagram_mode.append('image')
                return
            except Exception as e:  # fall back to a table
                warn(f'diagram {n}: rendering failed ({e}); converted to a table')
        blocks = mermaid_to_blocks(code)
        self.diagram_mode.append('table')
        cap = f'Diagram {n}'
        if blocks and blocks[0]['t'] == 'caption':
            cap += ': ' + blocks.pop(0)['text']
        self.add(p_xml(runs_xml(self.ctx, cap, size=18, bold=True, color=HEAD_COLOR), 'Caption', ''))
        self.render_blocks(blocks)

    def picture(self, path):
        from docx.shared import Twips
        p = self.doc.add_paragraph()
        run = p.add_run()
        from PIL import Image
        with Image.open(path) as im:
            w, h = im.size
        max_w = TEXT_W_PORTRAIT
        max_h = 11000
        width = min(max_w, int(w / 2 * 15))
        if width * h / w > max_h:
            width = int(max_h * w / h)
        run.add_picture(path, width=Twips(width))
        p.paragraph_format.alignment = 1
        e = p._p
        e.getparent().remove(e)
        self.items.append(e)

    # -------------------------------------------------- headings of the content
    def content_heading(self, md_level, text):
        level = min(max(md_level - 1, 1), 3)
        txt = text.strip()
        m = re.match(r'^(\d+(?:\.\d+)*)\.?\s+(.*)$', plain(txt))
        if self.auto_numbering and m:
            c = list(self.counters)
            c[level - 1] += 1
            for k in range(level, 3):
                c[k] = 0
            expect = '.'.join(str(x) for x in c[:level])
            if m.group(1) == expect:
                self.counters = c
                raw = re.sub(r'^\s*\d+(?:\.\d+)*\.?\s+', '', txt, count=1)
                return self.heading(level, raw, True)
            warn(f'heading "{plain(txt)[:50]}" kept with its own number (Word numbering would show {expect})')
            return self.heading(level, txt, False)
        if not self.source_numbered and not re.match(r'^Appendix\b', plain(txt)):
            return self.heading(level, txt, True)
        return self.heading(level, txt, False)

    def check_numbering(self, sections):
        """Use Word numbering only if it reproduces the source numbers exactly."""
        counters = [0, 0, 0]
        ok = True
        any_num = False
        for h, blocks in sections:
            hs = [h] + [b for b in blocks if b['t'] == 'heading']
            for b in hs:
                lvl = min(max(b['level'] - 1, 1), 3)
                m = re.match(r'^(\d+(?:\.\d+)*)\.?\s+', plain(b['text']))
                if not m:
                    continue
                any_num = True
                counters[lvl - 1] += 1
                for k in range(lvl, 3):
                    counters[k] = 0
                expect = '.'.join(str(c) for c in counters[:lvl])
                if m.group(1) != expect:
                    ok = False
                    warn(f'heading number {m.group(1)} would render as {expect}: "{plain(b["text"])[:50]}"')
        return any_num, ok

    # -------------------------------------------------- whole document
    def build(self):
        a = self.args
        title_src, pre, sections = split_doc(self.md)
        # document control
        dc = {'kv': {}, 'changes': [], 'reviewers': None, 'approval': None, 'other': [], 'kv_block': None}
        rest = []
        for h, blocks in sections:
            if plain(h['text']).strip().lower() == 'document control':
                dc = doc_control(blocks)
            else:
                rest.append((h, blocks))
        sections = rest
        # preamble: version line and key-value table (test strategy style)
        pre_kv, pre_kvb = kv_table(pre)
        intro = []
        for b in pre:
            if b is pre_kvb or b['t'] == 'hr':
                continue
            if b['t'] == 'para' and re.match(r'^Version\s+[\d.]+', b['text']):
                m = re.match(r'^Version\s+([\d.]+(?:\s+Draft)?)\s*-\s*(.*?)\s*-\s*status:\s*(.*)$', b['text'])
                if m:
                    pre_kv.setdefault('version', m.group(1))
                    pre_kv.setdefault('date', m.group(2))
                    pre_kv.setdefault('status', m.group(3)[0].upper() + m.group(3)[1:])
                    continue
            intro.append(b)
        if pre_kv and not dc['kv']:
            dc['kv'] = pre_kv
            if pre_kvb is not None:
                extra = [[k.title(), pre_kv[k]] for k in ('version', 'date', 'status') if k in pre_kv
                         and not any(plain(r[0]).lower() == k for r in pre_kvb['rows'])]
                pre_kvb = dict(pre_kvb, rows=extra + pre_kvb['rows'])
                dc['kv_block'] = pre_kvb
        kv = dc['kv']
        version = a.version or plain(kv.get('version', '')) or '0.9 Draft'
        date = a.date or parse_date(kv.get('date')) or self.preamble_date(intro) or self.today()
        self.version, self.date = version, date
        title = a.title or plain(kv.get('document', '')) or title_src or 'Document'
        title = re.sub(r'^BrokerVerse (for )?TISPH:\s*', '', title)
        self.title = title
        # glossary
        gloss_rows = None
        rest = []
        for h, blocks in sections:
            ht = plain(h['text']).lower()
            if ('glossary' in ht or 'acronym' in ht) and any(b['t'] == 'table' for b in blocks):
                tb = [b for b in blocks if b['t'] == 'table'][0]
                gloss_rows = [[r[0], r[1]] for r in tb['rows']]
                continue
            rest.append((h, blocks))
        sections = rest
        if gloss_rows is None:
            dictionary = dict(COMMON_ACRONYMS)
            dictionary.update(harvest_glossaries(a.glossary_from or []))
            for kv_ in a.acronym:
                k_, _, v_ = kv_.partition('=')
                dictionary[k_.strip()] = v_.strip()
            found, unknown = extract_acronyms(self.md, dictionary)
            gloss_rows = [[k, v] for k, v in sorted(found.items(), key=lambda kv: kv[0].lower())]
            if unknown:
                warn('acronyms without a definition (left out): ' + ', '.join(unknown))
            self.acronym_source = 'extracted'
        else:
            self.acronym_source = 'glossary'
        self.source_numbered, ok = self.check_numbering(sections)
        warnings[:] = [w for w in warnings if not w.startswith('heading number')]
        self.auto_numbering = self.source_numbered
        self.first_number = 1
        for h, _ in sections:
            m = re.match(r'^(\d+)\.?\s+', plain(h['text']))
            if m:
                self.first_number = int(m.group(1)) if int(m.group(1)) in (0, 1) else 1
                break
        self.counters = [self.first_number - 1, 0, 0]
        # numbering instances
        front_abs = self.num.heading_list(levels=1)
        self.front_num = self.num.new_num(front_abs)
        body_abs = self.num.heading_list(levels=3)
        self.body_num = self.num.new_num(body_abs, start=self.first_number if self.first_number != 1 else None)

        # ---- front matter
        self.heading(1, 'Document Control', False, front=True, page_break=True)
        self.document_control_table(dc)
        has_terms = any(not re.fullmatch(r'[A-Z0-9/&\- ]+s?|[A-Z][a-z][A-Z]\w*', plain(r[0]).strip()) for r in gloss_rows)
        self.heading(1, 'Acronyms and Glossary' if has_terms else 'Acronyms', False, front=True)
        if gloss_rows:
            self.table(['Acronym / Symbol' if not has_terms else 'Acronym / Term', 'Definition / Meaning'],
                       gloss_rows, widths=[30, 70], landscape=False, first_bold=True)
        else:
            self.body_para('No acronyms are used in this document.')
        # ---- content
        first = True
        if intro:
            self.heading(1, 'Introduction', not self.source_numbered, page_break=True)
            self.render_blocks(intro)
            first = False
        pending_done = False
        for h, blocks in sections:
            ht = plain(h['text'])
            hd = self.content_heading(2, h['text'])
            if first or self.args.chapter_breaks:
                # page break before the first content heading (with --chapter-breaks, before every chapter)
                self.items[-1].find(qn('w:pPr')).insert(1, el(f'<w:pageBreakBefore {NSDECL}/>'))
                first = False
            if re.search(r'open questions|decisions (we need|tisph must|needed)|pending items', ht, re.I) and not pending_done:
                if self.pending_section(blocks):
                    pending_done = True
                    continue
            self.render_blocks(blocks)
        if not pending_done:
            self.heading(1, 'Pending Items', not self.source_numbered or self.auto_numbering)
            self.pending_table([['-', 'No pending items are recorded in this version.', '-', '-']])
        # ---- sign-off
        self.heading(1, a.signoff_title, not self.source_numbered or self.auto_numbering)
        self.signoff(dc)
        self.assemble()
        return self

    def preamble_date(self, intro):
        for b in intro:
            if b['t'] == 'para':
                d = parse_date(b['text'])
                if d:
                    return d
        return None

    @staticmethod
    def today():
        d = dt.date.today()
        return f'{d.day:02d} {MONTHS[d.month - 1]} {d.year}'

    # -------------------------------------------------- front tables
    def document_control_table(self, dc):
        kv = dc['kv']
        owner = plain(kv.get('owner', ''))
        reviewers = plain(kv.get('reviewers', ''))
        if not reviewers and dc['reviewers']:
            rv = dc['reviewers']
            reviewers = '; '.join(f'{plain(r[0])} ({plain(r[1])})' if len(r) > 1 and plain(r[1]) else plain(r[0])
                                  for r in rv['rows'])
        approvers = ''
        if dc['approval']:
            approvers = '; '.join(plain(r.get('role', '') or list(r.values())[0]) for r in dc['approval'])
        status = plain(kv.get('status', ''))
        rows = []
        changes = dc['changes'] or [{'version': self.version, 'date': self.date,
                                     'author': kv.get('author', 'iorta TechNXT'),
                                     'change': 'Initial issue' + (f' ({status[0].lower() + status[1:]})' if status else '')}]
        for k, c in enumerate(changes):
            author = plain(c.get('author', 'iorta TechNXT')) or 'iorta TechNXT'
            if owner and k == 0:
                author += '<br/>' + owner
            rv = (f'Pending review: {reviewers}' if reviewers else 'Pending review') if k == 0 else 'As above'
            ap = (f'Pending approval: {approvers}' if approvers else 'Pending approval') if k == 0 else 'As above'
            date = parse_date(c.get('date', '')) or plain(c.get('date', ''))
            rows.append([date, plain(c.get('version', '')), author, rv, ap, c.get('change', '')])
        self.table(['Date', 'Version', 'Author & Business Unit Info', 'Reviewed By & Business Unit Info',
                    'Approved By & Business Unit Info', 'Change History'], rows,
                   widths=[1300, 900, 1500, 1700, 1500, 2900], landscape=False)
        # document information
        info = [[k, v] for k, v in ((plain(r[0]), r[1]) for r in (dc['kv_block']['rows'] if dc['kv_block'] else
                                                                     [[kk.title(), vv] for kk, vv in kv.items()]))
                if k.lower() not in ('reviewers',)]
        info = [['Prepared by' if k.lower() == 'author' else k, v] for k, v in info]
        if info:
            self.small_heading('Document information')
            self.table(['Item', 'Value'], info, widths=[26, 74], landscape=False, first_bold=True)
        if dc['reviewers'] is not None:
            self.small_heading('Reviewers')
            self.table(dc['reviewers']['header'], dc['reviewers']['rows'])
        for cur, b in dc['other']:
            self.render_block(b)

    def pending_table(self, rows):
        self.table(['Serial Number', 'Description', 'Owner', 'Status'], rows, widths=[1250, 5000, 1300, 1477],
                   landscape=False, header_align='center')

    def pending_section(self, blocks):
        """Render an open-questions section as the template's pending-items table."""
        rows = []
        lead = []
        group = None
        used = False
        for b in blocks:
            if b['t'] == 'table' and not used:
                hdr = [plain(h).strip().lower() for h in b['header']]
                qcol = next((i for i, h in enumerate(hdr) if h in ('question', 'decision', 'description', 'item',
                                                                    'open question', 'issue')), None)
                if qcol is None:
                    lead.append(b)
                    continue
                idcol = 0 if qcol != 0 else None
                ocol = next((i for i, h in enumerate(hdr) if 'owner' in h or h in ('who', 'decided by')), None)
                scol = next((i for i, h in enumerate(hdr) if h == 'status'), None)
                for k, r in enumerate(b['rows']):
                    desc = r[qcol]
                    extra = []
                    for i, h in enumerate(b['header']):
                        if i in (qcol, idcol, ocol, scol) or not r[i].strip():
                            continue
                        extra.append(f'*{plain(h)}:* {r[i]}')
                    if extra:
                        desc += '<br/>' + '<br/>'.join(extra)
                    rows.append([r[idcol] if idcol is not None else str(k + 1), desc,
                                 r[ocol] if ocol is not None else 'TISPH', r[scol] if scol is not None else 'Open'])
                used = True
                continue
            if b['t'] == 'list' and b['ordered'] and not used:
                n0 = b['start']
                for k, it in enumerate(b['items']):
                    desc = self.list_item_text(it)
                    rows.append([str(n0 + k), desc, 'TISPH', 'Open' + (f' ({group})' if group else '')])
                continue
            if b['t'] == 'para' and re.fullmatch(r'\*\*[^*]+\*\*', b['text'].strip()) and not used:
                group = plain(b['text']).strip().rstrip('.').lower()
                continue
            lead.append(b)
        if not rows:
            return False
        for b in lead:
            if b['t'] != 'hr':
                self.render_block(b)
        self.pending_table(rows)
        return True

    def list_item_text(self, item):
        parts = []
        for sb in item['blocks']:
            if sb['t'] == 'para':
                parts.append(sb['text'])
            elif sb['t'] == 'list':
                parts.append('<ul>' + ''.join('<li>' + self.list_item_text(x) + '</li>' for x in sb['items']) + '</ul>')
        return '<br/>'.join(p for p in parts if not p.startswith('<ul>')) + ''.join(p for p in parts if p.startswith('<ul>'))

    def signoff(self, dc):
        rows = []
        if dc['approval']:
            for r in dc['approval']:
                role = r.get('role', '') or list(r.values())[0]
                rows.append([plain(r.get('date', '')), plain(r.get('signature', '')), plain(r.get('name', '')), role])
        else:
            rows = [['', '', '', 'TISPH Project Manager'], ['', '', '', 'TISPH Head of IT'],
                    ['', '', '', 'iorta TechNXT Delivery Lead']]
        self.table(['Sign Off Date', 'Signature', 'Approved By', 'Department & Project Role'], rows,
                   widths=[1500, 2900, 2200, 2427], landscape=False, header_align='center', min_row_h=700)

    # -------------------------------------------------- assembly
    def assemble(self):
        body = self.doc.element.body
        children = list(body.iterchildren())
        sect = children[-1]
        assert sect.tag == qn('w:sectPr')
        cover = children[0:2]
        toc_head = children[2]
        back = children[-2]
        for c in children:
            if c is not sect and c not in cover and c is not toc_head and c is not back:
                body.remove(c)
        self.fix_cover(cover)
        # TOC
        anchor = toc_head
        for e in self.toc_elements():
            anchor.addnext(e)
            anchor = e
        first_sect = copy.deepcopy(sect)
        first_sect.append(el(f'<w:titlePg {NSDECL}/>'))
        # schema order: titlePg after docGrid is invalid; place it before textDirection/docGrid
        tp = first_sect.find(qn('w:titlePg'))
        first_sect.remove(tp)
        dg = first_sect.find(qn('w:docGrid'))
        (dg if dg is not None else first_sect[-1]).addprevious(tp)
        p = el(f'<w:p {NSDECL}><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>')
        p.find(qn('w:pPr')).append(first_sect)
        anchor.addnext(p)
        anchor = p
        # the section break starts the next page: drop the page break of the first heading
        for e in self.items[:1]:
            pb = e.find(qn('w:pPr') + '/' + qn('w:pageBreakBefore'))
            if pb is not None:
                pb.getparent().remove(pb)
        # content, with landscape sections
        self.group_landscape()
        portrait_sect = copy.deepcopy(sect)
        land_sect = self.landscape_sectpr(sect)
        cur_land = False
        for e in self.items:
            land = getattr(e, 'landscape_group', False)
            if land != cur_land:
                # close the current section with a paragraph holding its sectPr
                sp = copy.deepcopy(land_sect if cur_land else portrait_sect)
                p = el(f'<w:p {NSDECL}><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>')
                p.find(qn('w:pPr')).append(sp)
                anchor.addnext(p)
                anchor = p
                cur_land = land
            anchor.addnext(e)
            anchor = e
        if cur_land:
            sp = copy.deepcopy(land_sect)
            p = el(f'<w:p {NSDECL}><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>')
            p.find(qn('w:pPr')).append(sp)
            anchor.addnext(p)
        # back cover on its own page
        ppr = back.find(qn('w:pPr'))
        if ppr is None:
            ppr = el(f'<w:pPr {NSDECL}/>')
            back.insert(0, ppr)
        ppr.insert(0, el(f'<w:pageBreakBefore {NSDECL}/>'))

    def group_landscape(self):
        """Mark runs of elements between landscape tables so they share one landscape section."""
        idx = [i for i, e in enumerate(self.items) if getattr(e, 'landscape', False)]
        if not idx:
            return
        groups = []
        start = idx[0]
        prev = idx[0]
        for i in idx[1:]:
            between = self.items[prev + 1:i]
            text_len = sum(len(''.join(x.itertext())) for x in between)
            if len(between) <= 8 and text_len < 900:
                prev = i
                continue
            groups.append((start, prev))
            start = prev = i
        groups.append((start, prev))
        for s, e in groups:
            # include the caption or heading immediately before the table
            while s > 0 and self.is_lead_in(self.items[s - 1]):
                s -= 1
            e = e + 1  # the spacer paragraph after the table
            for k in range(s, min(e + 1, len(self.items))):
                self.items[k].landscape_group = True

    @staticmethod
    def is_lead_in(e):
        if e.tag != qn('w:p'):
            return False
        ps = e.find(qn('w:pPr') + '/' + qn('w:pStyle'))
        if ps is not None and ps.get(qn('w:val')) in ('Caption', 'Heading2', 'Heading3'):
            return True
        txt = ''.join(e.itertext())
        return 0 < len(txt) < 260 and txt.rstrip().endswith(':')

    def landscape_sectpr(self, sect):
        s = copy.deepcopy(sect)
        pg = s.find(qn('w:pgSz'))
        pg.set(qn('w:w'), str(PORTRAIT['h']))
        pg.set(qn('w:h'), str(PORTRAIT['w']))
        pg.set(qn('w:orient'), 'landscape')
        mar = s.find(qn('w:pgMar'))
        # the footer band is scaled up for the wider page: keep text clear of it
        mar.set(qn('w:bottom'), str(int(mar.get(qn('w:bottom'))) + 420))
        rid = self.landscape_footer()
        for fr in s.findall(qn('w:footerReference')):
            if fr.get(qn('w:type')) == 'default':
                fr.set(qn('r:id'), rid)
        return s

    def landscape_footer(self):
        if hasattr(self, '_land_rid'):
            return self._land_rid
        dpart = self.doc.part
        src = None
        sect = self.doc.element.body.find(qn('w:sectPr'))
        for fr in sect.findall(qn('w:footerReference')):
            if fr.get(qn('w:type')) == 'default':
                src = dpart.related_parts[fr.get(qn('r:id'))]
        xml = copy.deepcopy(src.element)
        width = (PORTRAIT['h']) * 635 + 2000
        for ext in xml.iter(qn('wp:extent')):
            cx, cy = int(ext.get('cx')), int(ext.get('cy'))
            ncy = int(cy * width / cx)
            ext.set('cx', str(width))
            ext.set('cy', str(ncy))
            anchor = ext.getparent()
            pv = anchor.find(qn('wp:positionV'))
            off = pv.find(qn('wp:posOffset'))
            if off is not None:
                below = cy + int(off.text)
                off.text = str(below - ncy)
        for ext in xml.iter(qn('a:ext')):
            if ext.get('cx'):
                cx, cy = int(ext.get('cx')), int(ext.get('cy'))
                ext.set('cx', str(width))
                ext.set('cy', str(int(cy * width / cx)))
        partname = PackURI('/word/footer_landscape.xml')
        ct = 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml'
        from docx.parts.hdrftr import FooterPart
        part = FooterPart(partname, ct, xml, dpart.package)
        for rel in src.rels.values():
            if not rel.is_external:
                new_rid = part.relate_to(rel.target_part, rel.reltype)
                for blip in xml.iter(qn('a:blip')):
                    if blip.get(qn('r:embed')) == rel.rId:
                        blip.set(qn('r:embed'), new_rid)
        self._land_rid = dpart.relate_to(part, RT.FOOTER)
        return self._land_rid

    def toc_elements(self):
        levels = self.args.toc_levels
        out = []
        entries = [h for h in self.headings if h.level <= levels]
        numbers = self.heading_numbers()
        first = True
        for h in entries:
            num = numbers.get(id(h), '')
            page = str(self.page_map.get(h.bookmark, ''))
            lvl = h.level
            fld = ''
            if first:
                fld = (f'<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
                       f'<w:r><w:instrText xml:space="preserve"> TOC \\o "1-{levels}" \\h \\z \\u </w:instrText></w:r>'
                       f'<w:r><w:fldChar w:fldCharType="separate"/></w:r>')
                first = False
            rp = f'<w:rPr><w:noProof/>{"<w:b/>" if lvl == 1 else ""}</w:rPr>'
            numrun = f'<w:r>{rp}<w:t xml:space="preserve">{xesc(num)}</w:t></w:r><w:r>{rp}<w:tab/></w:r>' if num else ''
            ind = ''
            if not num:
                ind = f'<w:ind w:left="{[0, 300, 600][lvl - 1]}" w:hanging="0"/>'
            xml = (f'<w:p {NSDECL}><w:pPr><w:pStyle w:val="TOC{lvl}"/>{ind}</w:pPr>{fld}'
                   f'<w:hyperlink w:anchor="{h.bookmark}" w:history="1">{numrun}'
                   f'<w:r>{rp}<w:t xml:space="preserve">{xesc(h.text)}</w:t></w:r>'
                   f'<w:r>{rp}<w:tab/></w:r><w:r>{rp}<w:t>{page}</w:t></w:r></w:hyperlink></w:p>')
            out.append(el(xml))
        end = el(f'<w:p {NSDECL}><w:pPr><w:pStyle w:val="TOC1"/></w:pPr><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>')
        out.append(end)
        return out

    def heading_numbers(self):
        res = {}
        front = 0
        c = [getattr(self, 'first_number', 1) - 1, 0, 0]
        for h in self.headings:
            if h.front:
                front += 1
                res[id(h)] = f'{front}.'
            elif h.numbered:
                c[h.level - 1] += 1
                for k in range(h.level, 3):
                    c[k] = 0
                res[id(h)] = '.'.join(str(x) for x in c[:h.level]) + ('.' if h.level == 1 else '')
        self.number_of = res
        return res

    def fix_cover(self, cover):
        a = self.args
        title = self.title
        p1 = cover[1]
        # drop the VML fallbacks: Word 2010+ and LibreOffice use the DrawingML choice
        for fb in p1.iter('{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback'):
            pass
        for fb in list(p1.iter('{http://schemas.openxmlformats.org/markup-compatibility/2006}Fallback')):
            fb.getparent().remove(fb)
        title_sz = 44
        chars_per_line = 34
        if len(title) > 68:
            title_sz, chars_per_line = 36, 42

        def wrap_lines(text, width):
            n, cur = 1, 0
            for w in text.split():
                if cur and cur + 1 + len(w) > width:
                    n += 1
                    cur = len(w)
                else:
                    cur += (1 if cur else 0) + len(w)
            return n
        lines = wrap_lines(title, chars_per_line)
        line_h = int(title_sz / 2 * 1.3 * 12700)
        for txbx in p1.iter(qn('w:txbxContent')):
            text = ''.join(txbx.itertext())
            anchor = txbx
            while anchor.tag != qn('wp:anchor'):
                anchor = anchor.getparent()
            ext = anchor.find(qn('wp:extent'))
            sp_ext = next(e for e in anchor.iter(qn('a:ext')) if e.get('cx'))
            off_h = anchor.find(qn('wp:positionH')).find(qn('wp:posOffset'))
            off_v = anchor.find(qn('wp:positionV')).find(qn('wp:posOffset'))

            def geom(cx=None, cy=None, x=None, y=None, ext=ext, sp_ext=sp_ext, off_h=off_h, off_v=off_v):
                if cx is not None:
                    ext.set('cx', str(cx))
                    sp_ext.set('cx', str(cx))
                if cy is not None:
                    ext.set('cy', str(cy))
                    sp_ext.set('cy', str(cy))
                if x is not None and off_h is not None:
                    off_h.text = str(x)
                if y is not None and off_v is not None:
                    off_v.text = str(y)
            ts = list(txbx.iter(qn('w:t')))
            if text.startswith('Business Requirement'):
                ts[0].text = title
                for t in ts[1:]:
                    t.text = ''
                for r in txbx.iter(qn('w:rPr')):
                    for s in r.findall(qn('w:sz')) + r.findall(qn('w:szCs')):
                        s.set(qn('w:val'), str(title_sz))
                self.center(txbx)
                top = 1150000
                geom(cx=5731510, cy=line_h * lines + 120000, y=top)
                self.sub_y = top + line_h * lines + 260000
            elif text.startswith('Sub'):
                ts[0].text = a.subtitle
                for t in ts[1:]:
                    t.text = ''
                self.center(txbx)
                self._sub = (geom,)
            elif text.startswith('Date'):
                ts[1].text = self.date
                for t in ts[2:]:
                    t.text = ''
                geom(cx=2000000, x=5250000)
                self.right(txbx)
            elif text.startswith('Version'):
                ts[1].text = self.version
                for t in ts[2:]:
                    t.text = ''
                geom(cx=2000000, x=2780000)
                self.center(txbx)
            elif text.startswith('Prepared'):
                ts[-1].text = a.prepared_by
                geom(cx=2500000, x=194310)
        if hasattr(self, '_sub'):
            self._sub[0](cx=5731510, cy=420000, y=self.sub_y)

    @staticmethod
    def center(txbx, val='center'):
        for p in txbx.iter(qn('w:p')):
            ppr = p.find(qn('w:pPr'))
            if ppr is None:
                ppr = el(f'<w:pPr {NSDECL}/>')
                p.insert(0, ppr)
            for j in ppr.findall(qn('w:jc')):
                ppr.remove(j)
            jc = el(f'<w:jc {NSDECL} w:val="{val}"/>')
            rp = ppr.find(qn('w:rPr'))
            if rp is not None:
                rp.addprevious(jc)
            else:
                ppr.append(jc)

    def right(self, txbx):
        self.center(txbx, 'right')

    # -------------------------------------------------- package parts
    def finish(self, out):
        doc = self.doc
        setup_styles(doc, self.args.toc_levels)
        # settings: update fields on open
        s = doc.settings.element
        for u in s.findall(qn('w:updateFields')):
            s.remove(u)
        uf = el(f'<w:updateFields {NSDECL} w:val="true"/>')
        anchor = s.find(qn('w:hdrShapeDefaults'))
        if anchor is None:
            anchor = s.find(qn('w:footnotePr'))
        if anchor is not None:
            anchor.addprevious(uf)
        else:
            s.append(uf)
        # page number in the footers
        self.footer_page_numbers()
        normalise(doc.element.body)
        normalise(doc.styles.element)
        cp = doc.core_properties
        cp.author = self.args.prepared_by
        cp.last_modified_by = self.args.prepared_by
        cp.title = self.title
        cp.subject = self.args.subtitle
        cp.keywords = 'TISPH; BrokerVerse'
        cp.comments = ''
        cp.category = ''
        cp.revision = 1
        now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None, microsecond=0)
        cp.created = now
        cp.modified = now
        doc.save(out)
        self.postprocess(out)

    def footer_page_numbers(self):
        dpart = self.doc.part
        sect = self.doc.element.body.find(qn('w:sectPr'))
        parts = []
        for fr in sect.findall(qn('w:footerReference')):
            if fr.get(qn('w:type')) == 'default':
                parts.append(dpart.related_parts[fr.get(qn('r:id'))])
        if hasattr(self, '_land_rid'):
            parts.append(dpart.related_parts[self._land_rid])
        for part in parts:
            root = part.element
            if root.find('.//' + qn('w:instrText')) is not None:
                continue
            p = root.find(qn('w:p'))
            rp = (f'<w:rPr><w:rFonts w:ascii="{FONT}" w:hAnsi="{FONT}" w:cs="{FONT}"/><w:color w:val="FFFFFF"/>'
                  f'<w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>')
            runs = (f'<w:r {NSDECL}>{rp}<w:t xml:space="preserve">Page </w:t></w:r>'
                    f'<w:r {NSDECL}>{rp}<w:fldChar w:fldCharType="begin"/></w:r>'
                    f'<w:r {NSDECL}>{rp}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
                    f'<w:r {NSDECL}>{rp}<w:fldChar w:fldCharType="separate"/></w:r>'
                    f'<w:r {NSDECL}>{rp}<w:t>1</w:t></w:r>'
                    f'<w:r {NSDECL}>{rp}<w:fldChar w:fldCharType="end"/></w:r>')
            ppr = p.find(qn('w:pPr'))
            ppr.append(el(f'<w:jc {NSDECL} w:val="right"/>'))
            for r in re.findall(r'<w:r .*?</w:r>', runs):
                p.append(el(r))

    def postprocess(self, out):
        """Normalise app.xml (company, template) in the saved package."""
        import zipfile
        tmp = out + '.tmp'
        with zipfile.ZipFile(out) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == 'docProps/app.xml':
                    t = data.decode('utf-8')
                    t = re.sub(r'<Company>[^<]*</Company>|<Company/>', '<Company>iorta TechNXT</Company>', t)
                    t = re.sub(r'<TotalTime>\d+</TotalTime>', '<TotalTime>0</TotalTime>', t)
                    data = t.encode('utf-8')
                zout.writestr(item, data)
        os.replace(tmp, out)


# ============================================================ schema order
PPR_ORDER = ['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr',
             'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap',
             'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid',
             'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection',
             'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange']
RPR_ORDER = ['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline', 'shadow',
             'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color', 'spacing', 'w', 'kern',
             'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd', 'fitText', 'vertAlign', 'rtl', 'cs',
             'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath']


def _reorder(parent, order):
    rank = {qn('w:' + t): i for i, t in enumerate(order)}
    kids = list(parent)
    if all(k.tag in rank for k in kids):
        kids_sorted = sorted(kids, key=lambda k: rank[k.tag])
        if kids_sorted != kids:
            for k in kids:
                parent.remove(k)
            for k in kids_sorted:
                parent.append(k)


def normalise(root):
    for ppr in root.iter(qn('w:pPr')):
        _reorder(ppr, PPR_ORDER)
    for rpr in root.iter(qn('w:rPr')):
        if rpr.getparent().tag != qn('w:pPr') or True:
            _reorder(rpr, RPR_ORDER)


# ============================================================ PDF pass
def pdf_pages(docx_path, tmpdir):
    r = subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', tmpdir, docx_path],
                       capture_output=True, text=True, timeout=900)
    pdf = os.path.join(tmpdir, os.path.splitext(os.path.basename(docx_path))[0] + '.pdf')
    if not os.path.isfile(pdf):
        raise RuntimeError('PDF conversion failed: ' + r.stderr[-300:])
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
    return pdf, txt.split('\f')


def norm(s):
    return re.sub(r'[^a-z0-9]+', '', s.lower())


def heading_pages(builder, pages):
    numbers = builder.number_of
    res = {}
    npages = [norm(p) for p in pages]
    cur = 2
    toc_end = 2
    # skip the TOC pages: find the page of the first front heading text after the TOC
    for k in range(1, len(npages)):
        if 'tableofcontents' in npages[k]:
            toc_end = k
            break
    while toc_end + 1 < len(pages) and re.search(r'\.{5,}', pages[toc_end + 1]):
        toc_end += 1
    cur = toc_end + 1
    # a heading is a line of its own that starts with its number and text; the same words in the body
    # text of an earlier page (a table of chapters, a cross-reference) do not count
    plines = [[norm(line) for line in p.split('\n') if line.strip()] for p in pages]
    for h in builder.headings:
        key = norm(numbers.get(id(h), '') + h.text)[:40]
        key2 = norm(h.text)[:40]
        found = None
        for k in range(cur, len(npages)):
            if any(line.startswith(key) for line in plines[k]):
                found = k
                break
        if found is None:
            for k in range(cur, len(npages)):
                if key in npages[k] or key2 in npages[k]:
                    found = k
                    break
        if found is None:
            warn(f'page of heading not found: {h.text[:50]}')
            continue
        cur = found
        res[h.bookmark] = found + 1
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source')
    ap.add_argument('output')
    ap.add_argument('--template', required=True)
    ap.add_argument('--title')
    ap.add_argument('--subtitle', default='Toyota Insurance Services Philippines')
    ap.add_argument('--prepared-by', default='iorta TechNXT')
    ap.add_argument('--version')
    ap.add_argument('--date', help='dd Month yyyy')
    ap.add_argument('--glossary-from', nargs='*', default=[])
    ap.add_argument('--toc-levels', type=int, default=2)
    ap.add_argument('--signoff-title', default='Document Sign-Off')
    ap.add_argument('--acronym', action='append', default=[], metavar='KEY=DEFINITION',
                    help='add or override an acronym definition (repeatable)')
    ap.add_argument('--chapter-breaks', action='store_true', help='start every chapter on a new page')
    ap.add_argument('--no-pdf-pass', action='store_true')
    ap.add_argument('--keep-pdf', help='write the final PDF here')
    ap.add_argument('--report', help='write a JSON report here')
    args = ap.parse_args()
    args.source_dir = os.path.dirname(os.path.abspath(args.source))
    if args.date:
        args.date = parse_date(args.date) or args.date
    with open(args.source, encoding='utf-8') as f:
        md = f.read()
    args.tmpdir = tempfile.mkdtemp(prefix='md2docx_')
    args.mermaid_info = find_mermaid() if '```mermaid' in md else None
    try:
        b = Builder(args, md).build()
        b.finish(args.output)
        pdf = None
        if not args.no_pdf_pass:
            pdf, pages = pdf_pages(args.output, args.tmpdir)
            pmap = heading_pages(b, pages)
            warnings[:] = []
            b2 = Builder(args, md, pmap).build()
            b2.finish(args.output)
            pdf, pages = pdf_pages(args.output, args.tmpdir)
            pmap2 = heading_pages(b2, pages)
            if pmap2 != pmap:
                diff = sum(1 for k in pmap if pmap2.get(k) != pmap[k])
                warn(f'{diff} TOC page numbers moved after the second pass')
            b = b2
            if args.keep_pdf:
                shutil.copy(pdf, args.keep_pdf)
        rep = {'output': args.output, 'title': b.title, 'version': b.version, 'date': b.date,
               'diagrams': b.diagram_count, 'diagram_modes': b.diagram_mode,
               'auto_numbering': b.auto_numbering, 'acronyms': b.acronym_source,
               'pages': len(pages) - (1 if pages and not pages[-1].strip() else 0) if pdf else None,
               'warnings': warnings}
        if args.report:
            with open(args.report, 'w') as f:
                json.dump(rep, f, indent=1)
        print(json.dumps({k: v for k, v in rep.items() if k != 'diagram_modes'}, indent=1))
    finally:
        shutil.rmtree(args.tmpdir, ignore_errors=True)


if __name__ == '__main__':
    main()
