import sys
import os

# Ensure root and server directories are in sys.path for Vercel
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
server_dir = os.path.join(root_dir, "server")

for d in (root_dir, server_dir, current_dir):
    if d and d not in sys.path:
        sys.path.insert(0, d)

from server.app import app
