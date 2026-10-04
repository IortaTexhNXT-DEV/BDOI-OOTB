"""Sets column widths of the product functionality tables (post-processing of build_doc.py output)."""
import sys
import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm

W = {
    ('Aspect', 'Detail'): [3.6, 12.3],
    ('Area', 'Capability'): [3.6, 12.3],
    ('Item', 'BrokerVerse OOTB'): [3.6, 12.3],
    ('Acronym / Symbol', 'Definition / Meaning'): [4.0, 11.9],
    ('#', 'Step', 'What happens', 'Who'): [0.8, 3.4, 7.6, 4.1],
    ('Line of business', 'Request for Quotation', 'Quotation Slip', 'Placement Slip', 'Record Issued Policy'): [4.7, 2.8, 2.8, 2.8, 2.8],
    ('Event', 'Journal (summary)'): [4.4, 11.5],
    ('Group', 'Reports'): [3.0, 12.9],
    ('Included in OOTB', 'Notes'): [5.0, 10.9],
    ('Outside OOTB, available as a change request or optional service', 'Examples'): [5.0, 10.9],
    ('Option', 'Form', 'Data location'): [3.0, 9.4, 3.5],
    ('Size', 'Typical profile', 'Duration to hypercare exit', 'Go-live'): [2.0, 8.0, 2.9, 3.0],
    ('Level', 'Who', 'Scope'): [1.4, 5.0, 9.5],
    ('Severity', 'First response', 'Restore or workaround'): [4.0, 5.0, 6.9],
    ('#', 'Capability', 'BrokerVerse OOTB', 'Note', 'Vendor B', 'Vendor C'): [0.9, 6.6, 2.4, 2.8, 1.6, 1.6],
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
