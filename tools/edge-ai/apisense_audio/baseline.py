"""Each hive's own "usual sound": a robust baseline and a persistence rule.

The node does not say *why* a sound is different (there is no evidence to
support causes). It learns what one hive normally sounds like at each time of
day and reports 0 (usual) or 1 (different). Everything below is arrays and
thresholds, so it can be exported to the ESP32 unchanged.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

import numpy as np

from .features import FEATURE_NAMES

HOUR_BUCKETS = 8  # 3-hour slots; the bees' day has sharp edges (foraging starts and stops)
MIN_BUCKET_WINDOWS = 20
Z_CLIP = 8.0
_BIN_HZ = 16_000 / 1024  # one FFT bin


def scale_floor(name: str) -> float:
    """The smallest spread worth trusting, in the feature's own unit.

    A single floor would make 0.5 Hz mean something for frequencies and nothing
    for 0-1 flatness, so each kind of feature has its own."""
    spread = name.endswith("_std")
    if name.startswith("flatness"):
        return 0.01 if spread else 0.02
    if name.startswith(("dominant_hz", "centroid_hz")):
        return (1 if spread else 2) * _BIN_HZ
    return 0.5 if spread else 1.0  # dB


FLOORS = np.array([scale_floor(n) for n in FEATURE_NAMES])


def bucket_of(hour: float) -> int:
    return int(hour % 24) // (24 // HOUR_BUCKETS)


def _robust(values: np.ndarray):
    center = np.median(values, axis=0)
    scale = 1.4826 * np.median(np.abs(values - center), axis=0)
    return center, np.maximum(scale, FLOORS)


@dataclass
class HiveBaseline:
    center: np.ndarray  # (buckets, features); a bucket without enough data copies the global row
    scale: np.ndarray
    threshold: float
    persistence: tuple[int, int] = (3, 4)  # alarm if 3 of the last 4 windows exceed
    names: list[str] = field(default_factory=lambda: list(FEATURE_NAMES))

    @classmethod
    def fit(cls, windows: np.ndarray, hours: np.ndarray, quantile: float = 0.995, margin: float = 1.25):
        """Learn the usual sound from windows recorded while nothing unusual was going on."""
        windows = np.asarray(windows, dtype=float)
        hours = np.asarray(hours, dtype=float)
        if windows.ndim != 2 or windows.shape[1] != len(FEATURE_NAMES):
            raise ValueError("windows must be (n, %d)" % len(FEATURE_NAMES))
        if len(windows) < 30:
            raise ValueError("at least 30 windows are needed to learn a baseline")
        global_center, global_scale = _robust(windows)
        center = np.tile(global_center, (HOUR_BUCKETS, 1))
        scale = np.tile(global_scale, (HOUR_BUCKETS, 1))
        buckets = np.array([bucket_of(h) for h in hours])
        for b in range(HOUR_BUCKETS):
            chosen = windows[buckets == b]
            if len(chosen) >= MIN_BUCKET_WINDOWS:
                center[b], scale[b] = _robust(chosen)
        model = cls(center, scale, threshold=0.0)
        # The threshold comes from the same windows the centre and scale were fitted on, so these
        # scores run a little low; the margin covers that, and the day-split evaluation is what
        # tells whether it is enough.
        training = np.array([model.score(w, h) for w, h in zip(windows, hours)])
        model.threshold = float(np.quantile(training, quantile) * margin)
        return model

    def score(self, window: np.ndarray, hour: float) -> float:
        """How far this window is from the hive's usual sound at this hour (0 = typical)."""
        b = bucket_of(hour)
        z = np.clip((np.asarray(window, dtype=float) - self.center[b]) / self.scale[b], -Z_CLIP, Z_CLIP)
        return float(np.sqrt(np.mean(z * z)))

    def to_dict(self) -> dict:
        return {
            "format": "apisense-hive-baseline-v1",
            "names": self.names,
            "center": self.center.tolist(),
            "scale": self.scale.tolist(),
            "threshold": self.threshold,
            "persistence": list(self.persistence),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "HiveBaseline":
        if data.get("format") != "apisense-hive-baseline-v1":
            raise ValueError("unknown baseline format")
        return cls(
            np.array(data["center"], dtype=float),
            np.array(data["scale"], dtype=float),
            float(data["threshold"]),
            tuple(data["persistence"]),
            list(data["names"]),
        )

    def dumps(self) -> str:
        return json.dumps(self.to_dict())


class Detector:
    """Turns window scores into the node's one-number verdict (0 usual, 1 different)."""

    def __init__(self, baseline: HiveBaseline):
        self.baseline = baseline
        self._recent: list[bool] = []

    def reset(self) -> None:
        """Forget recent windows (call when time was not recorded in between)."""
        self._recent = []

    def update(self, window: np.ndarray, hour: float) -> tuple[int, float]:
        score = self.baseline.score(window, hour)
        need, of = self.baseline.persistence
        self._recent = (self._recent + [score > self.baseline.threshold])[-of:]
        return (1 if sum(self._recent) >= need else 0), score
