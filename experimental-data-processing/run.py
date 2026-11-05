"""Run a selected lab or the complete portfolio demonstration."""

import argparse
from pathlib import Path
import runpy

import numpy as np

ROOT = Path(__file__).resolve().parent
LABS = {f"lab-{number:02d}": ROOT / "labs" / f"lab-{number:02d}" for number in range(1, 13)}
PROJECTS = {**LABS, "final-project": ROOT / "final-project"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", choices=[*PROJECTS, "all"])
    parser.add_argument("--output", type=Path, default=ROOT / "results")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--trials", type=int, default=60)
    parser.add_argument("--data-dir", type=Path, help="Folder with z1.txt, z2.txt and z3.txt for the final project")
    args = parser.parse_args()
    if args.trials < 1 or args.seed < 0:
        parser.error("trials must be positive and seed must be nonnegative")
    if args.data_dir is not None and args.project != "final-project":
        parser.error("--data-dir applies to final-project")
    projects = PROJECTS if args.project == "all" else {args.project: PROJECTS[args.project]}
    for name, folder in projects.items():
        destination = args.output / name
        destination.mkdir(parents=True, exist_ok=True)
        experiment = runpy.run_path(str(folder / "run.py"))["run"]
        if name == "lab-05":
            experiment(destination, args.trials, args.seed)
        else:
            inputs = {"data_dir": args.data_dir} if name == "final-project" else {}
            experiment(destination, np.random.default_rng(args.seed), args.trials, **inputs)
        print(f"{name}: {destination}")


if __name__ == "__main__":
    main()
