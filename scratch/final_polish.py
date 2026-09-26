"""
Final pass cleanup for the remaining 13 specific items.
"""

import os
import re

APP_DIR = r"d:\office\my-work\supportnova\client\app"

TARGETS = [
    (r"#[cC][bB][dD]5[eE]1", "var(--nw-border-strong)"),
    (r"#[eE]2[eE]8[fF]0", "var(--nw-border)"),
    (r"#[fF][eE][fF]9[cC]3", "var(--nw-warning-dim)"),
    (r"#[fF][eE][fF]08[aA]", "rgba(217,164,65,0.3)"),
    (r"#[fF]{3}5[fF]5", "var(--nw-danger-dim)"),
    (r"background:\s*['\"]#FFF5F5['\"]", "background: 'var(--nw-danger-dim)'"),
    (r"background:\s*['\"]#FFF['\"]", "background: 'var(--nw-elevated)'"),
    (r"background:\s*['\"]#F8FAFC['\"]", "background: 'var(--nw-elevated)'"),
]

def clean_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for pat, repl in TARGETS:
        new_content = re.sub(pat, repl, new_content)

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Final polished: {os.path.relpath(path, APP_DIR)}")

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for f in files:
            if f.endswith('.jsx'):
                clean_file(os.path.join(root, f))
    print("Final pass complete!")

if __name__ == "__main__":
    main()
