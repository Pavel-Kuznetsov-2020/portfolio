"""Regression and smoothing experiments from labs 1–4."""

import matplotlib.pyplot as plt
import numpy as np

from edp.plots import lines, rmse, save, write_table


def exponential(series, alpha):
    result = np.array(series, dtype=float)
    for index in range(1, len(result)):
        result[index] = alpha * series[index] + (1 - alpha) * result[index - 1]
    return result


def two_sided(series, alpha):
    return exponential(exponential(series, alpha)[::-1], alpha)[::-1]


def rolling(series, window):
    padded = np.pad(series, (window - 1, 0), mode="edge")
    return np.convolve(padded, np.ones(window) / window, mode="valid")


def solar_proxy(rng):
    months = np.arange(480)
    spots = 12 + 130 * (0.5 + 0.5 * np.sin(months * 2 * np.pi / 132))**2
    spots = np.maximum(0, spots + rng.normal(0, 11, size=len(months)))
    flux = 67 + 0.57 * spots + 0.0017 * spots**2 + rng.normal(0, 6, size=len(months))
    return spots, flux


def solar_regression(output, rng, trials):
    spots, flux = solar_proxy(rng)
    split = int(0.75 * len(spots))
    figure, axis = plt.subplots(figsize=(9, 4))
    axis.plot(np.arange(split, len(flux)), flux[split:], label="Синтетический F10.7", alpha=0.6)
    rows = []
    for degree in (1, 2, 3):
        design = np.polynomial.polynomial.polyvander(spots, degree)
        weights, *_ = np.linalg.lstsq(design[:split], flux[:split], rcond=None)
        estimated = design @ weights
        axis.plot(np.arange(split, len(flux)), estimated[split:], label=f"Степень {degree}")
        rows.append((degree, rmse(flux[:split], estimated[:split]), rmse(flux[split:], estimated[split:])))
    axis.set(xlabel="Месяц", ylabel="F10.7, sfu")
    axis.legend()
    save(figure, output, "solar-regression.png")
    write_table(output, ["degree", "train_rmse_sfu", "test_rmse_sfu"], rows)


def noise_smoothing(output, rng, trials):
    figure, axes = plt.subplots(2, 1, figsize=(9, 6))
    rows = []
    for axis, noise in zip(axes, (2., 6.)):
        trial_errors = []
        for _ in range(trials):
            truth = rng.normal(0, 0.4, 150).cumsum()
            measured = truth + rng.normal(0, noise, len(truth))
            smoothed = exponential(measured, 0.2)
            averaged = rolling(measured, 9)
            trial_errors.append([rmse(truth, values) for values in (measured, smoothed, averaged)])
        lines(axis, [("Сигнал", truth), ("Измерения", measured), ("EMA", smoothed),
                     ("Среднее, окно 9", averaged)], "Координата")
        axis.set_title(f"σ измерений = {noise:g}")
        rows.append((noise, *np.mean(trial_errors, axis=0)))
    save(figure, output, "noise-smoothing.png")
    write_table(output, ["noise_std", "raw_mean_rmse", "ema_mean_rmse", "moving_average_mean_rmse"], rows)


def smoothing_limits(output, rng, trials):
    time = np.arange(180)
    scenarios = {"acceleration": 0.012 * np.maximum(time - 55, 0)**2,
                 "periodic": 12 * np.sin(time / 7)}
    figure, axes = plt.subplots(2, 1, figsize=(9, 6))
    rows = []
    for axis, (name, truth) in zip(axes, scenarios.items()):
        measured = truth + rng.normal(0, 3, len(truth))
        series = [("Сигнал", truth), ("Измерения", measured)]
        for alpha in (0.15, 0.4):
            forward = exponential(measured, alpha)
            both = two_sided(measured, alpha)
            series.extend([(f"EMA {alpha}", forward), (f"В обе стороны {alpha}", both)])
            rows.append((name, alpha, rmse(truth, forward), rmse(truth, both)))
        lines(axis, series, "Координата")
        axis.set_title("Ускорение" if name == "acceleration" else "Периодический сигнал")
    save(figure, output, "smoothing-limits.png")
    write_table(output, ["scenario", "alpha", "forward_rmse", "two_sided_rmse"], rows)


def surface_smoothing(output, rng, trials):
    _, flux = solar_proxy(rng)
    weights = np.ones(13)
    weights[[0, -1]] = 0.5
    monthly = np.convolve(np.pad(flux, 6, mode="edge"), weights / weights.sum(), mode="valid")
    figure, axis = plt.subplots(figsize=(9, 4))
    lines(axis, [("F10.7", flux), ("13-месячное среднее", monthly), ("Двустороннее EMA", two_sided(flux, 0.18))],
          "F10.7, sfu", "Месяц")
    save(figure, output, "monthly-smoothing.png")

    grid = np.linspace(-3, 3, 50)
    east, north = np.meshgrid(grid, grid)
    truth = np.sin(east) * np.cos(north) + 0.8 * np.exp(-east**2 - north**2)
    measured = truth + rng.normal(0, 0.3, size=truth.shape)
    smoothed = np.apply_along_axis(two_sided, 0, np.apply_along_axis(two_sided, 1, measured, 0.45), 0.45)
    figure, axes = plt.subplots(1, 3, figsize=(11, 4), subplot_kw={"projection": "3d"})
    for axis, (title, values) in zip(axes, [("Эталон", truth), ("С шумом", measured), ("Сглаженная", smoothed)]):
        axis.plot_surface(east, north, values, cmap="viridis", vmin=-1, vmax=1.5)
        axis.set_title(title)
        axis.set_zlim(-2, 2)
    save(figure, output, "surface-smoothing.png")
    write_table(output, ["surface", "rmse"], [("noisy", rmse(truth, measured)), ("smoothed", rmse(truth, smoothed))])
