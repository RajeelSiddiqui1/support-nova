"""
Cleanup script to replace all remaining light badge/card backgrounds, borders, and text
with dark theme tokens across all JSX files in client/app.
"""

import os
import re

APP_DIR = r"d:\office\my-work\supportnova\client\app"

TOKEN_REPLACEMENTS = [
    # Red / Danger pastels
    (r"background:\s*['\"]#(?:fef2f2|fee2e2|fff1f2)['\"]", "background: 'var(--nw-danger-dim)'"),
    (r"background:\s*['\"]#(?:fef2f2|fee2e2|fff1f2)15['\"]", "background: 'var(--nw-danger-dim)'"),
    (r"background:\s*['\"]#FECDD3['\"]", "background: 'var(--nw-danger-dim)'"),
    (r"border:\s*['\"](?:1px|1\.5px)\s+solid\s+#(?:fca5a5|f87171|fecdd3)['\"]", "border: '1px solid rgba(193,73,91,0.3)'"),

    # Blue / Info pastels
    (r"background:\s*['\"]#(?:eff6ff|ebf8ff|f0f9ff)['\"]", "background: 'var(--nw-info-dim)'"),
    (r"border:\s*['\"](?:1px|1\.5px)\s+solid\s+#(?:bfdbfe|93c5fd)['\"]", "border: '1px solid rgba(74,155,201,0.3)'"),

    # Green / Success pastels
    (r"background:\s*['\"]#(?:ecfdf5|f0fdf4)['\"]", "background: 'var(--nw-success-dim)'"),
    (r"border:\s*['\"](?:1px|1\.5px)\s+solid\s+#(?:a7f3d0|86efac|6ee7b7)['\"]", "border: '1px solid rgba(79,166,137,0.3)'"),

    # Yellow / Warning pastels
    (r"background:\s*['\"]#(?:fffbeb|fef3c7|fff7ed)['\"]", "background: 'var(--nw-warning-dim)'"),
    (r"border:\s*['\"](?:1px|1\.5px)\s+solid\s+#(?:fcd34d|fde68a|fed7aa)['\"]", "border: '1px solid rgba(217,164,65,0.3)'"),

    # Purple / Accent pastels
    (r"background:\s*['\"]#(?:f5f3ff|faf5ff)['\"]", "background: 'var(--nw-accent-dim)'"),
    (r"border:\s*['\"](?:1px|1\.5px)\s+solid\s+#(?:ddd6fe|e9d5ff|c4b5fd)['\"]", "border: '1px solid rgba(201,111,74,0.3)'"),

    # Generic light backgrounds
    (r"background:\s*['\"]#(?:fafafa|f9fafb|f8fafc|f1f5f9)['\"]", "background: 'var(--nw-elevated)'"),
    (r"background:\s*['\"]#(?:ffffff|fff)['\"]", "background: 'var(--nw-elevated)'"),
    (r"background:\s*['\"]white['\"]", "background: 'var(--nw-elevated)'"),

    # Light borders
    (r"border:\s*['\"](?:1px|1\.5px)\s+solid\s+#(?:e2e8f0|cbd5e1|e5e7eb|d1d5db)['\"]", "border: '1px solid var(--nw-border-strong)'"),
    (r"borderTop:\s*['\"]1px\s+solid\s+#(?:f1f5f9|e2e8f0)['\"]", "borderTop: '1px solid var(--nw-border)'"),
    (r"borderBottom:\s*['\"]1px\s+solid\s+#(?:f1f5f9|e2e8f0)['\"]", "borderBottom: '1px solid var(--nw-border)'"),

    # Contrast fixes on text within dark tags
    (r"color:\s*['\"]#1e40af['\"]", "color: 'var(--nw-info)'"),
    (r"color:\s*['\"]#1e1b4b['\"]", "color: 'var(--nw-text-secondary)'"),
    (r"color:\s*['\"]#4338ca['\"]", "color: 'var(--nw-accent)'"),
    (r"color:\s*['\"]#dc2626['\"]", "color: '#E8758A'"),
    (r"color:\s*['\"]#047857['\"]", "color: 'var(--nw-success)'"),
]

def clean_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for pat, repl in TOKEN_REPLACEMENTS:
        new_content = re.sub(pat, repl, new_content, flags=re.IGNORECASE)

    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {os.path.relpath(path, APP_DIR)}")

def main():
    for root, dirs, files in os.walk(APP_DIR):
        for f in files:
            if f.endswith('.jsx'):
                clean_file(os.path.join(root, f))
    print("All component light accents cleaned!")

if __name__ == "__main__":
    main()
