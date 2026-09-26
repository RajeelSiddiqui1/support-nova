"""
Scratch script to perform automated dark-theme token replacement across the remaining Next.js frontend pages.
"""

import os
import re

PAGE_FILES = [
    r"d:\office\my-work\supportnova\client\app\admin\dashboard\page.jsx",
    r"d:\office\my-work\supportnova\client\app\admin\tickets\page.jsx",
    r"d:\office\my-work\supportnova\client\app\admin\tickets\[id]\page.jsx",
    r"d:\office\my-work\supportnova\client\app\admin\policies\page.jsx",
    r"d:\office\my-work\supportnova\client\app\agent\workspace\page.jsx",
    r"d:\office\my-work\supportnova\client\app\agent\chat-tickets\page.jsx",
    r"d:\office\my-work\supportnova\client\app\reviewer\queue\page.jsx",
    r"d:\office\my-work\supportnova\client\app\customer\submit\page.jsx",
    r"d:\office\my-work\supportnova\client\app\customer\chat\page.jsx",
]

REPLACEMENTS = [
    # Backgrounds & Gradients
    (r"background:\s*['\"]linear-gradient\(135deg,\s*#F8FAFC[^'\"]+\)['\"]", "background: 'var(--nw-base)'"),
    (r"background:\s*['\"]#F8FAFC['\"]", "background: 'var(--nw-elevated)'"),
    (r"background:\s*['\"]#FFFFFF['\"]", "background: 'var(--nw-surface)'"),
    (r"background:\s*['\"]#FFF['\"]", "background: 'var(--nw-surface)'"),
    (r"background:\s*['\"]#F1F5F9['\"]", "background: 'var(--nw-elevated)'"),
    (r"rgba\(255,\s*255,\s*255,\s*0\.8[0-9]*\)", "var(--nw-surface)"),
    (r"rgba\(255,\s*255,\s*255,\s*0\.9[0-9]*\)", "var(--nw-surface)"),
    (r"rgba\(255,\s*255,\s*255,\s*0\.7[0-9]*\)", "var(--nw-surface)"),
    (r"rgba\(248,\s*250,\s*252,\s*0\.[0-9]+\)", "var(--nw-elevated)"),
    (r"rgba\(245,\s*243,\s*255,\s*0\.[0-9]+\)", "var(--nw-elevated)"),
    (r"rgba\(15,\s*23,\s*42,\s*0\.[0-9]+\)", "var(--nw-overlay)"),

    # Borders
    (r"rgba\(226,\s*232,\s*240,\s*0\.[0-9]+\)", "var(--nw-border)"),
    (r"border:\s*['\"]1px solid #E2E8F0['\"]", "border: '1px solid var(--nw-border)'"),
    (r"border:\s*['\"]1px solid #CBD5E1['\"]", "border: '1px solid var(--nw-border-strong)'"),
    (r"border:\s*['\"]1\.5px solid #CBD5E1['\"]", "border: '1px solid var(--nw-border-strong)'"),
    (r"border:\s*['\"]1px solid rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)['\"]", "border: '1px solid var(--nw-border)'"),
    
    # Shadows
    (r"rgba\(148,\s*163,\s*184,\s*0\.[0-9]+\)", "rgba(11, 14, 20, 0.4)"),

    # Text Colors
    (r"color:\s*['\"]#0F172A['\"]", "color: 'var(--nw-text-primary)'"),
    (r"color:\s*['\"]#1E293B['\"]", "color: 'var(--nw-text-primary)'"),
    (r"color:\s*['\"]#334155['\"]", "color: 'var(--nw-text-secondary)'"),
    (r"color:\s*['\"]#475569['\"]", "color: 'var(--nw-text-secondary)'"),
    (r"color:\s*['\"]#64748B['\"]", "color: 'var(--nw-text-muted)'"),
    (r"color:\s*['\"]#94A3B8['\"]", "color: 'var(--nw-text-muted)'"),
    (r"color:\s*['\"]#CBD5E1['\"]", "color: 'var(--nw-text-muted)'"),

    # Role Colors in pastels
    (r"bg:\s*['\"]#F5F3FF['\"],\s*color:\s*['\"]#7C3AED['\"]", "bg: 'var(--nw-accent-dim)', color: 'var(--nw-accent)'"),
    (r"bg:\s*['\"]#ECFDF5['\"],\s*color:\s*['\"]#059669['\"]", "bg: 'var(--nw-success-dim)', color: 'var(--nw-success)'"),
    (r"bg:\s*['\"]#FFFBEB['\"],\s*color:\s*['\"]#D97706['\"]", "bg: 'var(--nw-warning-dim)', color: 'var(--nw-warning)'"),
    (r"bg:\s*['\"]#FFF1F2['\"],\s*color:\s*['\"]#E11D48['\"]", "bg: 'var(--nw-danger-dim)', color: 'var(--nw-danger)'"),
    (r"bg:\s*['\"]#EFF6FF['\"],\s*color:\s*['\"]#2563EB['\"]", "bg: 'var(--nw-info-dim)', color: 'var(--nw-info)'"),
]

def convert_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content

    # 1. Update glass definitions
    content = re.sub(
        r"const glass = \{[^}]+\}",
        "const glass = { background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)' }",
        content
    )
    content = re.sub(
        r"const glass = \(extra = \{\}\) => \(\{[^}]+\}\)",
        "const glass = (extra = {}) => ({ background: 'var(--nw-surface)', border: '1px solid var(--nw-border)', borderRadius: 16, boxShadow: '0 4px 24px rgba(11,14,20,0.3)', ...extra })",
        content
    )

    # 2. Update Tooltip
    content = re.sub(
        r"background:\s*['\"]rgba\(255,\s*255,\s*255,\s*0\.9[0-9]*\)['\"]",
        "background: 'var(--nw-elevated)'",
        content
    )

    # 3. Apply regex substitutions
    for pattern, replacement in REPLACEMENTS:
        content = re.sub(pattern, replacement, content)

    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Converted: {os.path.basename(filepath)}")
    else:
        print(f"No changes needed: {os.path.basename(filepath)}")

if __name__ == "__main__":
    for p in PAGE_FILES:
        convert_file(p)
    print("Done!")
