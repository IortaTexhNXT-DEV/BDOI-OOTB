import os, json
from playwright.sync_api import sync_playwright
S=os.path.dirname(os.path.abspath(__file__))
BASE='https://brokerverse-dev.inxtuniverse.com'
def open_ctx(p):
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', proxy={'server': os.environ['HTTPS_PROXY']})
    c=b.new_context(viewport={'width':1600,'height':1000}, storage_state=f'{S}/state.json')
    return b,c
LOGO='/tmp/claude-0/-home-user-FinVerse/ab4c70bb-a602-5d59-bc82-b37694d4f406/scratchpad/logo_chip.png'
WRITES=[]
ALLOW_POST=[]   # regexes of read-only POST endpoints, filled in after observing traffic
import re
def guard(c):
    def handle(route, req):
        if req.method!='GET' and 'brokerverse-api' in req.url and not any(re.search(a, req.url) for a in ALLOW_POST):
            WRITES.append((req.method, req.url, (req.post_data or '')[:300]))
            return route.abort()
        return route.continue_()
    c.route('**/*', handle)
    c.route('**/bdo.png', lambda r,q: r.fulfill(path=LOGO, content_type='image/png'))
    c.route('**/Mask-group-1.png', lambda r,q: r.fulfill(path=S+'/avatar.png', content_type='image/png'))
