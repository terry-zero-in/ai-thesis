#!/usr/bin/env python3
"""Launcher: run the paper dashboard from anywhere (`python3 kalshi/serve.py`)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from kalshi_weather.cli import main  # noqa: E402

sys.exit(main(["dashboard"] + sys.argv[1:]))
