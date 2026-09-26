import os
import re

files = []
for root, dirs, filenames in os.walk('client/app'):
    for f in filenames:
        if f.endswith('.jsx'):
            files.append(os.path.join(root, f))

patterns = [
    ('white_bg', re.compile(r'background:\s*[\'"](#fff|white)', re.I)),
    ('light_bg', re.compile(r'background:\s*[\'"](#f[0-9a-f]{5}|#e[0-9a-f]{5})', re.I)),
    ('dark_text', re.compile(r'color:\s*[\'"](#0f172a|#1e293b|#334155)', re.I)),
    ('light_border', re.compile(r'border:\s*[\'"][^\'"]*(#e2e8f0|#cbd5e1|#e5e7eb|#d1d5db)', re.I)),
]

found_count = 0
for p in files:
    with open(p, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, l in enumerate(lines):
        for name, pat in patterns:
            m = pat.search(l)
            if m:
                found_count += 1
                print(f'{p}:{idx+1} [{name}] -> {l.strip()[:110]}')

print(f'\nTotal occurrences found: {found_count}')
