import sys
import os

# Add root directory and server directory to sys.path so server modules resolve on Vercel
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
server_dir = os.path.join(root_dir, "server")

for d in (root_dir, server_dir, current_dir):
    if d and d not in sys.path:
        sys.path.insert(0, d)

try:
    from server.app import app
except Exception:
    try:
        from app import app
    except Exception as err:
        print(f"[VERCEL BOOT ERROR] Failed to import FastAPI app: {err}")
        raise err
