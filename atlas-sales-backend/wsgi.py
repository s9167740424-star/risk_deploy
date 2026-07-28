"""WSGI entrypoint for PythonAnywhere / production WSGI servers."""
from app import create_app

application = create_app()
