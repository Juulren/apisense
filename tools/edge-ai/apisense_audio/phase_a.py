"""Phase A of docs/PLAN_EDGE_AI_ESP32.md: check the node's features on the public datasets.

    python -m apisense_audio.phase_a extract kaggle  --root <.../versions/3> --out data/features
    python -m apisense_audio.phase_a extract beenobee --root data/datasets/bee_nobee --out data/features
    python -m apisense_audio.phase_a extract obh --root data/datasets/obh/Current_Audio.zip --out data/features
    python -m apisense_audio.phase_a report --features data/features --out data/phase_a_report.md

This is a CHECK of the features, not an approval gate: the datasets are loose recordings from other
microphones and climates. Every split is by group (hive or place), never by fragments of one recording.
"""
from __future__ import annotations

import argparse
import csv
import re
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path

import numpy as np

from .baseline import HiveBaseline
from .datasets import Item, bee_nobee_items, kaggle_file_items, obh_items
from .features import FEATURE_NAMES


def _kaggle_job(args):
    return kaggle_file_items(*args)


def _save(items: list[Item], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        x=np.array([i.features for i in items]),
        group=np.array([i.group for i in items]),
        label=np.array([i.label for i in items]),
        when=np.array([i.when.isoformat() if i.when else "" for i in items]),
        source=np.array([i.source for i in items]),
        extra=np.array([";".join(f"{k}={v}" for k, v in i.extra.items()) for i in items]),
    )


def extract(dataset: str, root: Path, out: Path, limit: int | None, workers: int) -> None:
    if dataset == "kaggle":
        with open(next(root.glob("all_data_updated.csv")), encoding="utf8") as handle:
            by_stem = {Path(r["file name"]).stem: r for r in csv.DictReader(handle)}
        jobs = []
        for wav in sorted(next(root.glob("sound_files/sound_files")).glob("*.wav")):
            row = by_stem.get(re.sub(r"__segment\d+$", "", wav.stem))
            if row:
                jobs.append((wav, row))
        if limit:
            jobs = jobs[:limit]
        with ProcessPoolExecutor(workers) as pool:
            items = [i for chunk in pool.map(_kaggle_job, jobs, chunksize=8) for i in chunk]
    elif dataset == "beenobee":
        items = list(bee_nobee_items(root, limit))
    elif dataset == "obh":
        items = list(obh_items(root, limit))
    else:
        raise SystemExit("dataset must be kaggle, beenobee or obh")
    _save(items, out / f"{dataset}.npz")
    print(f"{dataset}: {len(items)} windows -> {out / (dataset + '.npz')}")


# ---------------------------------------------------------------- evaluation (numpy only)


def _standardize(train: np.ndarray, test: np.ndarray):
    mean, std = train.mean(axis=0), train.std(axis=0) + 1e-9
    return (train - mean) / std, (test - mean) / std


def _fit_logistic(x: np.ndarray, y: np.ndarray, steps: int = 400, lr: float = 0.1, l2: float = 1e-2):
    w, b = np.zeros(x.shape[1]), 0.0
    weight = np.where(y == 1, 0.5 / max(y.mean(), 1e-9), 0.5 / max(1 - y.mean(), 1e-9))  # balanced classes
    for _ in range(steps):
        p = 1 / (1 + np.exp(-(x @ w + b)))
        g = (p - y) * weight
        w -= lr * (x.T @ g / len(y) + l2 * w)
        b -= lr * g.mean()
    return w, b


def _auc(score: np.ndarray, y: np.ndarray) -> float:
    pos, neg = score[y == 1], score[y == 0]
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    ranks = np.argsort(np.argsort(np.concatenate([pos, neg]))) + 1.0
    return float((ranks[: len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def leave_one_group_out(x: np.ndarray, y: np.ndarray, groups: np.ndarray, min_each: int = 30):
    """AUC and balanced accuracy for each held-out group that has both classes."""
    rows = []
    for g in sorted(set(groups)):
        test = groups == g
        train = ~test
        if min(y[test].sum(), (1 - y[test]).sum()) < min_each or len(set(y[train])) < 2:
            continue
        xtr, xte = _standardize(x[train], x[test])
        w, b = _fit_logistic(xtr, y[train])
        s = xte @ w + b
        pred = s > 0
        bal = 0.5 * (pred[y[test] == 1].mean() + (~pred[y[test] == 0]).mean())
        rows.append((g, int(test.sum()), _auc(s, y[test]), float(bal)))
    return rows


def hive_drift(x: np.ndarray, when: np.ndarray, y_queen: np.ndarray, train_windows: int = 120):
    """One hive in time order: learn the usual sound from the first windows that have a queen,
    then see how often the later windows of each kind are flagged 'different' (3 of 4)."""
    order = np.argsort(when)
    x, y_queen = x[order], y_queen[order]
    hours = np.array([datetime.fromisoformat(w).hour + datetime.fromisoformat(w).minute / 60 for w in when[order]])
    with_queen = np.where(y_queen == 1)[0]
    if len(with_queen) < train_windows + 30:
        return None
    train_idx = with_queen[:train_windows]
    model = HiveBaseline.fit(x[train_idx], hours[train_idx])
    rest = np.arange(train_idx[-1] + 1, len(x))
    flags, recent = [], []
    for i in rest:
        recent = (recent + [model.score(x[i], hours[i]) > model.threshold])[-4:]
        flags.append(sum(recent) >= 3)
    flags = np.array(flags)
    labels = y_queen[rest]
    out = {
        "trained_on": train_windows,
        "tested_queen": int((labels == 1).sum()),
        "tested_noqueen": int((labels == 0).sum()),
        "flag_rate_queen": float(flags[labels == 1].mean()) if (labels == 1).any() else float("nan"),
        "flag_rate_noqueen": float(flags[labels == 0].mean()) if (labels == 0).any() else float("nan"),
    }
    return out


def hive_separation(x, when, source, lab, seed: int = 0, train_share: float = 0.3):
    """Inside one hive: learn the usual sound from a random 30 % of the RECORDINGS that have a queen,
    then compare the scores of the other queen recordings with those of the queenless ones.
    Splits by recording (never by segment of one recording). Returns AUC of the score and the share
    of windows over the threshold for each kind."""
    stems = np.array([re.sub(r"__segment\d+\.wav$", "", str(v)) for v in source])
    queen = lab == "queen"
    q_stems = np.array(sorted(set(stems[queen])))
    if len(q_stems) < 10 or (~queen).sum() < 30:
        return None
    rng = np.random.default_rng(seed)
    chosen = set(rng.choice(q_stems, size=max(2, int(len(q_stems) * train_share)), replace=False))
    in_train = np.array([st in chosen for st in stems]) & queen
    if in_train.sum() < 30:
        return None
    hours = np.array([datetime.fromisoformat(w).hour + datetime.fromisoformat(w).minute / 60 for w in when])
    model = HiveBaseline.fit(x[in_train], hours[in_train])
    test = ~in_train
    scores = np.array([model.score(x[i], hours[i]) for i in np.where(test)[0]])
    y = (~queen[test]).astype(float)
    return {
        "trained_on": int(in_train.sum()),
        "auc": _auc(scores, y),
        "over_queen": float((scores[y == 0] > model.threshold).mean()),
        "over_noqueen": float((scores[y == 1] > model.threshold).mean()),
        "n_queen": int((y == 0).sum()),
        "n_noqueen": int((y == 1).sum()),
    }


def report(features: Path, out: Path) -> None:
    lines = ["# Fase A: comprobación de las características con datasets públicos", "",
             "Comprobación de las características, **no una puerta de aprobación**: son grabaciones sueltas, de otros micrófonos y otros climas. No miden falsas alarmas por día.", ""]
    names = FEATURE_NAMES
    k = features / "kaggle.npz"
    if k.exists():
        d = np.load(k)
        x, g, lab, when = d["x"], d["group"], d["label"], d["when"]
        y = (lab == "queen").astype(float)
        lines += [f"## Kaggle beehive-sounds ({len(x)} ventanas de 60 s)", "",
                  "Colmenas: " + ", ".join(f"{h} ({int((g == h).sum())})" for h in sorted(set(g))), "",
                  "**¿Se ve la reina en las características?** Entrenado con tres colmenas y probado en la cuarta (AUC 0,5 = azar, 1 = perfecto):", "",
                  "| Colmena de prueba | Ventanas | AUC | Exactitud balanceada |", "|---|---|---|---|"]
        for gname, n, auc, bal in leave_one_group_out(x, y, g):
            lines.append(f"| {gname} | {n} | {auc:.2f} | {bal:.2f} |")
        lines += ["", "**Cambio en una misma colmena** (aprende con las primeras ventanas con reina; después, ¿cuántas ventanas marca como «diferente» cuando hay y cuando no hay reina?):", "",
                  "| Colmena | Aprendió con | Probadas con reina | Marcadas | Probadas sin reina | Marcadas |", "|---|---|---|---|---|---|"]
        for h in sorted(set(g)):
            m = g == h
            r = hive_drift(x[m], when[m], y[m])
            if r is None:
                lines.append(f"| {h} | — | datos insuficientes | | | |")
            else:
                lines.append(f"| {h} | {r['trained_on']} | {r['tested_queen']} | {r['flag_rate_queen']:.0%} | {r['tested_noqueen']} | {r['flag_rate_noqueen']:.0%} |")
        lines += ["", "**Misma colmena, sin depender del orden en el tiempo** (aprende con el 30 % de las grabaciones con reina, elegidas al azar; compara las demás grabaciones con y sin reina; AUC 0,5 = no las distingue):", "",
                  "| Colmena | Aprendió con | Con reina | Sin reina | AUC de la puntuación | Con reina sobre el umbral | Sin reina sobre el umbral |", "|---|---|---|---|---|---|---|"]
        for h in sorted(set(g)):
            m = g == h
            r = hive_separation(x[m], when[m], d["source"][m], lab[m])
            if r is None:
                lines.append(f"| {h} | — | datos insuficientes | | | | |")
            else:
                lines.append(f"| {h} | {r['trained_on']} | {r['n_queen']} | {r['n_noqueen']} | {r['auc']:.2f} | {r['over_queen']:.0%} | {r['over_noqueen']:.0%} |")
        lines += ["", "Una colmena sin reina marcada con mucha más frecuencia que una con reina indica que las características ven el cambio. Las ventanas «con reina» marcadas miden falsas alarmas **solo de forma orientativa**: los registros no son días seguidos.", ""]
    b = features / "beenobee.npz"
    if b.exists():
        d = np.load(b)
        x, g, lab = d["x"], d["group"], d["label"]
        keep = np.isin(lab, ["bee", "nobee"])
        x, g, y = x[keep], g[keep], (lab[keep] == "bee").astype(float)
        lines += [f"## To bee or not to bee ({len(x)} ventanas de 10 s, solo las de una etiqueta)", "",
                  "Abeja / no abeja, una grabación fuera en cada vuelta:", "", "| Grabación fuera | Ventanas | AUC | Exactitud balanceada |", "|---|---|---|---|"]
        for gname, n, auc, bal in leave_one_group_out(x, y, g, min_each=20):
            lines.append(f"| {gname} | {n} | {auc:.2f} | {bal:.2f} |")
        lines.append("")
    o = features / "obh.npz"
    if o.exists():
        d = np.load(o)
        x, g, lab = d["x"], d["group"], d["label"]
        lines += [f"## Open Source Beehives ({len(x)} ventanas de 30 s)", "", "Ventanas por estado: " + ", ".join(f"{s} ({int((lab == s).sum())})" for s in sorted(set(lab))), ""]
        active = lab == "Active"
        for state in sorted(set(lab) - {"Active"}):
            sel = active | (lab == state)
            y = (lab[sel] == state).astype(float)
            if y.sum() < 30:
                continue
            rows = leave_one_group_out(x[sel], y, g[sel], min_each=10)
            if rows:
                lines.append(f"- **{state} contra Active**, un lugar fuera en cada vuelta: " + "; ".join(f"{a} AUC {c:.2f}" for a, _, c, _ in rows))
        lines.append("")
    out.write_text("\n".join(lines), encoding="utf8")
    print(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("extract")
    e.add_argument("dataset")
    e.add_argument("--root", type=Path, required=True)
    e.add_argument("--out", type=Path, default=Path("data/features"))
    e.add_argument("--limit", type=int)
    e.add_argument("--workers", type=int, default=6)
    r = sub.add_parser("report")
    r.add_argument("--features", type=Path, default=Path("data/features"))
    r.add_argument("--out", type=Path, default=Path("data/phase_a_report.md"))
    a = ap.parse_args()
    if a.cmd == "extract":
        extract(a.dataset, a.root, a.out, a.limit, a.workers)
    else:
        report(a.features, a.out)


if __name__ == "__main__":
    main()
