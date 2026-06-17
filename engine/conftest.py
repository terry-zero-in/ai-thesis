"""Put the engine package root on sys.path so `import hp1_factors` / `hp1_score`
resolves no matter where pytest is invoked from."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
