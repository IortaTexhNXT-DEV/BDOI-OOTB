"""Renders the Test Strategy and Test Plan diagrams (graphviz dot) into source/qa-images.

    cd docs/package/tools
    python3 qa-diagrams/render.py
"""
import glob
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'source', 'qa-images')

os.makedirs(OUT, exist_ok=True)
for src in sorted(glob.glob(os.path.join(HERE, '*.dot'))):
    png = os.path.join(OUT, os.path.basename(src)[:-4] + '.png')
    subprocess.run(['dot', '-Tpng', '-Gdpi=160', src, '-o', png], check=True)
    print(os.path.relpath(png, os.path.join(HERE, '..')))
