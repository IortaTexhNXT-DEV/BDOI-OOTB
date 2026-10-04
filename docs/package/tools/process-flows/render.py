"""Draws the swimlane diagrams of the Process Flow Document from flows.py:

    cd docs/package/tools/process-flows
    python3 render.py              every flow
    python3 render.py f01 f05      only the flows named

Each flow becomes source/process-flow-images/<id>.png. The lanes are columns (one per role), the steps
run from top to bottom, and every box carries the number of its step in the document, so the picture and the
numbered steps of source/process-flows.md read together. Edit the steps in flows.py, then run this script.

The picture is drawn as SVG and turned into PNG with the Chromium of Playwright (PW_CHROMIUM, else the first
chrome found under /opt/pw-browsers).
"""
import glob
import html
import math
import os
import sys

from flows import FLOWS, LANES

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'source', 'process-flow-images')

NAVY, INK, GRID = '#0B2A4A', '#1F2933', '#C9D3DF'
FILL = {'task': '#FFFFFF', 'system': '#E6F2F1', 'decision': '#FFF4D6', 'start': '#DCEFE3', 'end': '#E4E7EB',
        'external': '#F3EEF9'}
STROKE = {'task': NAVY, 'system': '#2C7A7B', 'decision': '#B7791F', 'start': '#2F855A', 'end': '#52606D',
          'external': '#6B46C1'}
FONT = "Nunito, 'Liberation Sans', Arial, sans-serif"
HEAD_H, ROW_H, TOP, BOTTOM = 46, 70, 10, 12
BOX_H, DEC_H = 50, 56
MIN_LANE_W, BOX_MAX_W = 176, 196
FS = 12.5


def wrap(text, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        if cur and len(cur) + 1 + len(w) > width:
            lines.append(cur)
            cur = w
        else:
            cur = f'{cur} {w}'.strip()
    if cur:
        lines.append(cur)
    return lines


def layout(flow):
    lanes = flow['lanes']
    steps = flow['steps']
    row = -1
    for s in steps:
        if s.get('same'):
            s['_row'] = row
        else:
            row += 1
            s['_row'] = row
        s['_lane'] = lanes.index(s['lane'])
    rows = row + 1
    height = HEAD_H + TOP + rows * ROW_H + BOTTOM
    lane_w = max(MIN_LANE_W, math.ceil(height / 1.25 / len(lanes)))
    width = lane_w * len(lanes)
    return lane_w, width, height


def svg(flow):
    lane_w, width, height = layout(flow)
    steps = {s['n']: s for s in flow['steps']}
    box_w = min(lane_w - 26, BOX_MAX_W)
    chars = int((box_w - 22) / (FS * 0.5))
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
           f'font-family="{FONT}">',
           '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
           f'<path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>',
           f'<rect width="{width}" height="{height}" fill="#FFFFFF"/>']
    for i, lane in enumerate(flow['lanes']):
        x = i * lane_w
        out.append(f'<rect x="{x}" y="0" width="{lane_w}" height="{height}" fill="{"#F6F8FB" if i % 2 == 0 else "#FFFFFF"}" '
                   f'stroke="{GRID}" stroke-width="1"/>')
        out.append(f'<rect x="{x}" y="0" width="{lane_w}" height="{HEAD_H}" fill="{NAVY}" stroke="#FFFFFF" stroke-width="1"/>')
        name = LANES.get(lane, lane)
        lines = wrap(name, int((lane_w - 12) / 7.2))
        y0 = HEAD_H / 2 - (len(lines) - 1) * 8 + 5
        for k, ln in enumerate(lines):
            out.append(f'<text x="{x + lane_w / 2}" y="{y0 + k * 16}" font-size="13.5" font-weight="700" fill="#FFFFFF" '
                       f'text-anchor="middle">{html.escape(ln)}</text>')

    def centre(s):
        return s['_lane'] * lane_w + lane_w / 2, HEAD_H + TOP + s['_row'] * ROW_H + ROW_H / 2

    def half_h(s):
        return (DEC_H if s.get('kind') == 'decision' else BOX_H) / 2

    def half_w(s):
        return box_w / 2

    occupied = {(s['_lane'], s['_row']) for s in steps.values()}
    edges = []
    order = flow['steps']
    for idx, s in enumerate(order):
        targets = s.get('to')
        if targets is None:
            targets = [order[idx + 1]['n']] if idx + 1 < len(order) and s.get('kind') != 'end' else []
        for t in targets:
            label = ''
            if isinstance(t, (tuple, list)):
                t, label = t
            edges.append((s, steps[t], label))

    lines_svg, labels_svg = [], []
    used = set()
    for a, b, label in edges:
        ax, ay = centre(a)
        bx, by = centre(b)
        dashed = ' stroke-dasharray="5 4"' if b['_row'] <= a['_row'] and not (b['_row'] == a['_row'] and a['_lane'] != b['_lane']) else ''
        if b['_row'] > a['_row'] and a['_lane'] == b['_lane']:
            between = any((a['_lane'], r) in occupied for r in range(a['_row'] + 1, b['_row']))
            if not between:
                pts = [(ax, ay + half_h(a)), (bx, by - half_h(b))]
            else:
                gx = ax + half_w(a) + 9
                pts = [(ax + half_w(a), ay), (gx, ay), (gx, by), (bx + half_w(b), by)]
        elif b['_row'] == a['_row']:
            sign = 1 if b['_lane'] > a['_lane'] else -1
            used.add((a['n'], sign))
            pts = [(ax + sign * half_w(a), ay), (bx - sign * half_w(b), by)]
        elif b['_row'] > a['_row']:
            sign = 1 if b['_lane'] > a['_lane'] else -1
            lo, hi = sorted((a['_lane'], b['_lane']))
            row_clear = not any((ln, a['_row']) in occupied for ln in range(lo, hi + 1) if ln != a['_lane'])
            col_clear = not any((b['_lane'], r) in occupied for r in range(a['_row'] + 1, b['_row']))
            if row_clear and col_clear and (a['n'], sign) not in used:
                used.add((a['n'], sign))
                pts = [(ax + sign * half_w(a), ay), (bx, ay), (bx, by - half_h(b))]
            else:
                gy = by - half_h(b) - (ROW_H - BOX_H) / 2 + 4
                pts = [(ax, ay + half_h(a)), (ax, gy), (bx, gy), (bx, by - half_h(b))]
        else:
            # back edge: out of the right side, up the gutter of the rightmost lane, into the target's right side
            gx = max(a['_lane'], b['_lane']) * lane_w + lane_w - 7
            pts = [(ax + half_w(a), ay), (gx, ay), (gx, by), (bx + half_w(b), by)]
        d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        lines_svg.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="1.4"{dashed} marker-end="url(#a)"/>')
        if label:
            (x1, y1), (x2, y2) = pts[0], pts[1]
            lx, ly = (x1 + x2) / 2, (y1 + y2) / 2
            if abs(y2 - y1) > abs(x2 - x1):
                lx += 4
                anchor = 'start'
            else:
                ly -= 4
                anchor = 'middle'
            w = len(label) * 6.4 + 6
            rx = lx - (w / 2 if anchor == 'middle' else 2)
            labels_svg.append(f'<rect x="{rx:.1f}" y="{ly - 11:.1f}" width="{w:.1f}" height="14" fill="#FFFFFF" opacity="0.9"/>'
                              f'<text x="{lx:.1f}" y="{ly:.1f}" font-size="11" font-style="italic" fill="#7B341E" '
                              f'text-anchor="{anchor}">{html.escape(label)}</text>')
    out += lines_svg

    for s in order:
        cx, cy = centre(s)
        kind = s.get('kind', 'task')
        fill, stroke = FILL[kind], STROKE[kind]
        w, h = box_w, half_h(s) * 2
        if kind == 'decision':
            out.append(f'<polygon points="{cx},{cy - h / 2} {cx + w / 2},{cy} {cx},{cy + h / 2} {cx - w / 2},{cy}" '
                       f'fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
            text_w = int(chars * 0.72)
        else:
            rx = h / 2 if kind in ('start', 'end') else 7
            out.append(f'<rect x="{cx - w / 2}" y="{cy - h / 2}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
                       f'stroke="{stroke}" stroke-width="1.6"/>')
            text_w = chars if kind not in ('start', 'end') else chars - 2
        lines = wrap(s['text'], text_w)
        if len(lines) > 3:
            raise SystemExit(f"{flow['id']} step {s['n']}: text too long for the box: {s['text']}")
        y0 = cy - (len(lines) - 1) * 7 + 4.5
        for k, ln in enumerate(lines):
            out.append(f'<text x="{cx}" y="{y0 + k * 14}" font-size="{FS}" fill="{INK}" text-anchor="middle">{html.escape(ln)}</text>')
        bx, by = cx - w / 2 + (w * 0.22 if kind == 'decision' else 0), cy - h / 2 + (h * 0.22 if kind == 'decision' else 0)
        out.append(f'<circle cx="{bx}" cy="{by}" r="11" fill="{stroke}"/>'
                   f'<text x="{bx}" y="{by + 4.3}" font-size="11.5" font-weight="700" fill="#FFFFFF" text-anchor="middle">{s["n"]}</text>')
    out += labels_svg
    out.append('</svg>')
    return '\n'.join(out), width, height


def chromium():
    exe = os.environ.get('PW_CHROMIUM') or next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))), None)
    return exe


def main(names):
    from playwright.sync_api import sync_playwright
    os.makedirs(OUT, exist_ok=True)
    todo = [f for f in FLOWS if not names or f['id'] in names or f['id'].split('_')[0] in names]
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium())
        page = browser.new_page(device_scale_factor=2)
        for f in todo:
            doc, w, h = svg(f)
            page.set_viewport_size({'width': int(w), 'height': int(h)})
            page.set_content(f'<html><body style="margin:0">{doc}</body></html>')
            page.locator('svg').screenshot(path=os.path.join(OUT, f['id'] + '.png'))
            print('drew', f['id'], f'{w}x{h}')
        browser.close()


if __name__ == '__main__':
    main(sys.argv[1:])
