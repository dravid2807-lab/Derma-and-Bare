import sys
from pathlib import Path

# Add root directory to sys.path for serverless deployments
root_dir = str(Path(__file__).parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from app import app

# Export wsgi app for Vercel serverless deployment
app = app

