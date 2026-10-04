"""Refreshes the table of contents of built documents and writes a PDF next to each (LibreOffice, headless).

    python3 refresh.py ../05_Delivery/*.docx
"""
import os, shutil, socket, subprocess, sys, tempfile, time
import uno
from com.sun.star.beans import PropertyValue

def prop(n, v):
    p = PropertyValue(); p.Name = n; p.Value = v; return p

# a free port and a private LibreOffice profile, so several builds can run side by side without sharing an instance
with socket.socket() as _s:
    _s.bind(('127.0.0.1', 0))
    port = _s.getsockname()[1]
profile = tempfile.mkdtemp(prefix='bv-soffice-')
proc = subprocess.Popen(['soffice', f'-env:UserInstallation=file://{profile}', '--headless', '--invisible', '--norestore',
                         f'--accept=socket,host=127.0.0.1,port={port};urp;'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
ctx = None
for _ in range(60):
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
        ctx = resolver.resolve(f'uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext')
        break
    except Exception:
        time.sleep(1)
desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
for path in sys.argv[1:]:
    url = uno.systemPathToFileUrl(os.path.abspath(path))
    doc = desktop.loadComponentFromURL(url, '_blank', 0, (prop('Hidden', True),))
    idx = doc.getDocumentIndexes()
    for i in range(idx.getCount()):
        idx.getByIndex(i).update()
    doc.storeToURL(url, (prop('FilterName', 'MS Word 2007 XML'),))
    doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(path[:-5] + '.pdf')), (prop('FilterName', 'writer_pdf_Export'),))
    doc.close(True)
    print('refreshed', path)
try:
    desktop.terminate()
except Exception:
    pass
proc.wait(timeout=30)
shutil.rmtree(profile, ignore_errors=True)
