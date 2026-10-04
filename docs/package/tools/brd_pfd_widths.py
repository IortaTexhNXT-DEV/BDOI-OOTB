"""Sets column widths of the tables of the Business Requirements Document and the Process Flow Document
(post-processing of build_doc.py output, named in DOCUMENTS of build_all.py)."""
import sys
import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm

W = {
    ('ID', 'Requirement and acceptance', 'Pri', 'Source', 'Met by'): [2.0, 8.0, 0.9, 1.5, 3.5],
    ('Item', 'Specification'): [3.0, 12.9],
    ('Topic', 'Rule'): [3.0, 12.9],
    ('At a glance', ''): [2.9, 13.0],
    ('Column', 'Meaning'): [3.4, 12.5],
    ('Area', 'Requirements', 'Must', 'Should', 'Could', 'IC', 'BIR', 'NPC', 'AMLC'): [5.9, 2.2, 1.2, 1.3, 1.2, 1.0, 1.0, 1.0, 1.1],
    ('Flow', 'Business requirement areas (Business Requirements Document)'): [2.0, 13.9],
    ('No.', 'Flow', 'Trigger', 'Main roles'): [1.1, 5.4, 4.6, 4.8],
}

path = sys.argv[1]
d = docx.Document(path)
done = 0
for t in d.tables:
    key = tuple(c.text for c in t.rows[0].cells)
    widths = W.get(key)
    if not widths:
        continue
    tblpr = t._tbl.tblPr
    for old in tblpr.findall(qn('w:tblLayout')):
        tblpr.remove(old)
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblpr.append(lay)
    for old in tblpr.findall(qn('w:tblW')):
        tblpr.remove(old)
    tw = OxmlElement('w:tblW'); tw.set(qn('w:w'), str(int(sum(widths) * 567))); tw.set(qn('w:type'), 'dxa'); tblpr.append(tw)
    for i, gc in enumerate(t._tbl.tblGrid.findall(qn('w:gridCol'))):
        gc.set(qn('w:w'), str(int(widths[i] * 567)))
    for row in t.rows:
        for i, c in enumerate(row.cells):
            c.width = Cm(widths[i])
    done += 1
d.save(path)
print('widths set on', done, 'tables')
