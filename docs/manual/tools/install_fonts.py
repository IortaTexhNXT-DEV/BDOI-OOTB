"""Install the Nunito font (the BDOI brand font) for LibreOffice from the front end's @fontsource package.

    pip install fonttools brotli
    python3 docs/manual/tools/install_fonts.py      # writes ~/.fonts/Nunito-*.ttf and refreshes the font cache

Without Nunito, LibreOffice substitutes another sans-serif font and the page count changes slightly.
"""
import os
import subprocess

from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '..', 'brokerverse', 'node_modules', '@fontsource', 'nunito', 'files')
DEST = os.path.expanduser('~/.fonts')


def main():
    os.makedirs(DEST, exist_ok=True)
    for weight, style in (('400', 'normal'), ('400', 'italic'), ('700', 'normal'), ('700', 'italic'), ('800', 'normal')):
        src = os.path.join(SRC, f'nunito-latin-{weight}-{style}.woff')
        font = TTFont(src)
        font.flavor = None
        out = os.path.join(DEST, f'Nunito-{weight}-{style}.ttf')
        font.save(out)
        print('installed', out)
    subprocess.run(['fc-cache', '-f'], check=False)


if __name__ == '__main__':
    main()
