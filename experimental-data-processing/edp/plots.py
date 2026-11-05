"""Small helpers for the figures and reproducible metric tables."""

import csv

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


def rmse(actual, estimated, axis=None):
    return np.sqrt(np.mean((actual - estimated)**2, axis=axis))


def save(figure, output, filename):
    figure.tight_layout()
    figure.savefig(output / filename, dpi=140, bbox_inches="tight")
    plt.close(figure)


def write_table(output, header, rows, filename="metrics.csv"):
    with (output / filename).open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(header)
        writer.writerows(rows)


def lines(axis, series, ylabel, xlabel="Шаг"):
    for label, values in series:
        axis.plot(values, label=label)
    axis.set(xlabel=xlabel, ylabel=ylabel)
    axis.grid(alpha=0.25)
    axis.legend()
