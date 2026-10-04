"""Writes the plain-text copy of the prospect e-mail templates from their text source, so the two never differ:

    python3 build_prospect_emails_txt.py

  ../source/prospect-emails.md  ->  ../01_Sales/Prospect_Email_Templates.txt

Each "# " chapter becomes a block title in capitals, each "## " template a numbered block with its details table as
"Item: value" lines, its subject line or note options as a starred list and its quoted body as plain paragraphs.
The chapter "How to use these templates" stays in the Word document only.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)
SRC = os.path.join(PKG, 'source', 'prospect-emails.md')
OUT = os.path.join(PKG, '01_Sales', 'Prospect_Email_Templates.txt')
RULE, THIN = '=' * 70, '-' * 70
CLOSINGS = ('Respectfully,', 'Best regards,', 'Kind regards,', 'Warm regards,', 'Sincerely,')


def body(lines):
    """Quoted lines as e-mail paragraphs: a blank line between paragraphs, none inside a list or the signature."""
    out, prev_list, in_sig = [], False, False
    for ln in lines:
        is_list = bool(re.match(r'(- |\d+\. )', ln))
        if ln in CLOSINGS:
            in_sig = True
            out += ['', ln]
        elif in_sig or (is_list and prev_list):
            out.append(ln)
        else:
            out += ['', ln]
        prev_list = is_list
    return out[1:] if out and out[0] == '' else out


def main():
    raw = open(SRC, encoding='utf-8').read()
    meta = dict(l.split(':', 1) for l in re.match(r'---\n(.*?)\n---\n', raw, re.S).group(1).splitlines() if ':' in l)
    text = raw.split('\n---\n', 1)[1]
    out = ['iNXT BrokerVerse OOTB: Prospect e-mail templates',
           f"iorta TechNXT, version {meta['version'].strip()}, {meta['date'].strip()}",
           'Replace every [placeholder] before sending. Prices exclude 12% VAT.']
    n, skip, quote, options = 0, False, [], False

    def flush():
        nonlocal quote
        if quote:
            out.extend(([''] if options else ['', 'BODY:', '']) + body(quote))
            quote = []

    for ln in text.splitlines():
        if ln.startswith('# '):
            flush()
            skip = ln[2:].strip() == 'How to use these templates'
            if not skip:
                out += ['', RULE, ln[2:].strip().upper(), RULE]
            continue
        if skip:
            continue
        if ln.startswith('## '):
            flush()
            n += 1
            options = False
            out += ['', THIN, f'{n}. {ln[3:].strip()}', THIN, '']
        elif ln.startswith('> '):
            quote.append(ln[2:].rstrip())
        elif ln.startswith('|'):
            cells = [c.strip() for c in ln.strip('|').split('|')]
            if cells[0] in ('Item', '') or set(cells[0]) <= set('-'):
                continue
            out.append(f'{cells[0]}: {cells[1]}')
        elif ln.rstrip().endswith(':') and 'options' in ln.lower():
            flush()
            options = 'note' in ln.lower()
            out += ['', ln.strip().upper(), '']
        elif ln.startswith('- '):
            out.append('  * ' + ln[2:].strip())
        elif ln.strip():
            flush()
            out += ['', ln.strip()]
        else:
            if quote:
                flush()
                out.append('')
    flush()
    txt = re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip() + '\n'
    open(OUT, 'w', encoding='utf-8').write(txt)
    print(f'{n} templates written to', os.path.relpath(OUT, PKG))


if __name__ == '__main__':
    main()
