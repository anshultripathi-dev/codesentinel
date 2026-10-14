"""Picklable transforms (must live in an importable module, not __main__)."""
import numpy as np


def log1p_clip(x):
    return np.log1p(np.clip(x, 0, None))
