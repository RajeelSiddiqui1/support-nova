import sys
import os

# Add the project and backend directories so backend modules resolve on Vercel.
project_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
server_dir = os.path.join(project_dir, "server")
for directory in (project_dir, server_dir):
    if directory not in sys.path:
        sys.path.insert(0, directory)

from server.app import app
