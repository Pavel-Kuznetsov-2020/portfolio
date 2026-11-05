import argparse
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
from matplotlib import pyplot as plt


def simulate(rng, trials, steps, initial, acceleration_sigma):
    states = np.empty((trials, steps, 2))
    states[:, 0] = initial
    accelerations = rng.normal(0, acceleration_sigma, (trials, steps - 1))
    for step in range(1, steps):
        position, velocity = states[:, step - 1].T
        acceleration = accelerations[:, step - 1]
        states[:, step, 0] = position + velocity + 0.5 * acceleration
        states[:, step, 1] = velocity + acceleration
    return states[:, :, 0], states[:, :, 0] + rng.normal(0, 20, (trials, steps))


def filter_positions(measurements, initial, variance=10000, acceleration_variance=0.04, gain=None):
    trials, steps = measurements.shape
    transition = np.array([[1.0, 1.0], [0.0, 1.0]])
    influence = np.array([0.5, 1.0])
    process_noise = acceleration_variance * np.outer(influence, influence)
    covariance = variance * np.eye(2)
    states = np.empty((trials, steps, 2))
    states[:, 0] = initial
    predicted = np.full((trials, steps), np.nan)
    sigma_predicted = np.full(steps, np.nan)
    sigma_filtered = np.full(steps, np.nan)
    gains = np.full((steps, 2), np.nan)
    sigma_filtered[0] = np.sqrt(variance)
    for step in range(1, steps):
        estimate = states[:, step - 1] @ transition.T
        prior = transition @ covariance @ transition.T + process_noise
        chosen_gain = prior[:, 0] / (prior[0, 0] + 400) if gain is None else gain
        residual = measurements[:, step] - estimate[:, 0]
        states[:, step] = estimate + residual[:, None] * chosen_gain
        covariance = prior - np.outer(chosen_gain, prior[0])
        predicted[:, step] = estimate[:, 0]
        sigma_predicted[step] = np.sqrt(max(prior[0, 0], 0))
        sigma_filtered[step] = np.sqrt(max(covariance[0, 0], 0))
        gains[step] = chosen_gain
    future = np.full((trials, steps), np.nan)
    future[:, 6:] = states[:, :-6, 0] + 6 * states[:, :-6, 1]
    return states[:, :, 0], predicted, future, sigma_filtered, sigma_predicted, gains


def rmse(truth, estimate):
    result = np.full(truth.shape[1], np.nan)
    valid = np.isfinite(estimate).all(axis=0)
    valid[:3] = False
    result[valid] = np.sqrt(np.mean((truth[:, valid] - estimate[:, valid]) ** 2, axis=0))
    return result


def plot(output, name, title, ylabel, series):
    figure, axis = plt.subplots(figsize=(9.5, 4.8), layout="constrained")
    for label, values in series:
        axis.plot(values, label=label, linewidth=1.4)
    axis.set(title=title, xlabel="Время, с", ylabel=ylabel)
    axis.grid(alpha=0.25)
    axis.legend()
    figure.savefig(output / f"{name}.png", dpi=140)
    plt.close(figure)


def run(output, trials, seed):
    output.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    initial = (5, 1)
    truth, measurements = simulate(rng, max(trials, 3), 200, initial, 0.2)
    filtered, predicted, future, sigma, sigma_prior, gains = filter_positions(measurements, initial)
    for index in range(3):
        plot(output, f"0{index + 1}-trajectory", f"Траектория {index + 1}", "Положение, м",
             [("Истина", truth[index]), ("Измерения", measurements[index]), ("Фильтр", filtered[index])])
    plot(output, "04-gain", "Коэффициент Калмана", "Коэффициент", [("Положение", gains[:, 0])])
    plot(output, "05-sigma", "Неопределённость положения", "Стандартное отклонение, м", [("Фильтр", sigma)])
    plot(output, "06-future", "Прогноз на шесть шагов", "Положение, м",
         [("Истина", truth[0]), ("Измерения", measurements[0]), ("Прогноз", future[0])])

    def error(estimate):
        return rmse(truth[:trials], estimate[:trials])

    filtered_error = error(filtered)
    predicted_error = error(predicted)
    plot(output, "07-errors", "Ошибки оценки", "RMSE, м",
         [("До измерения", predicted_error), ("После измерения", filtered_error), ("Прогноз", error(future))])
    plot(output, "08-measurement-noise", "Фильтр и шум измерения", "Ошибка, м",
         [("RMSE фильтра", filtered_error), ("σ измерения", np.full(200, 20))])
    tighter = filter_positions(measurements, initial, variance=100)[0]
    plot(output, "09-initial-uncertainty", "Начальная неопределённость", "RMSE, м",
         [("P₀ = 10000 I", filtered_error), ("P₀ = 100 I", error(tighter))])
    plot(output, "10-filter-error", "Оценка после измерения", "Ошибка, м",
         [("RMSE", filtered_error), ("Расчётное σ", sigma)])
    plot(output, "11-prediction-error", "Оценка до измерения", "Ошибка, м",
         [("RMSE", predicted_error), ("Расчётное σ", sigma_prior)])

    deterministic, deterministic_meas = simulate(rng, trials, 200, initial, 0)
    det_filter, det_predict, _, det_sigma, det_prior, det_gains = filter_positions(
        deterministic_meas, initial, acceleration_variance=0)
    plot(output, "12-deterministic-gain", "Детерминированная модель", "Коэффициент",
         [("Положение", det_gains[:, 0])])
    plot(output, "13-deterministic-filter", "Детерминированная модель после измерения", "Ошибка, м",
         [("RMSE", rmse(deterministic, det_filter)), ("Расчётное σ", det_sigma)])
    plot(output, "14-deterministic-predict", "Детерминированная модель до измерения", "Ошибка, м",
         [("RMSE", rmse(deterministic, det_predict)), ("Расчётное σ", det_prior)])
    wrong_filter, _, wrong_future, wrong_sigma, _, _ = filter_positions(
        measurements, initial, acceleration_variance=0)
    plot(output, "15-mismatched-errors", "Стохастическое движение при Q = 0", "RMSE, м",
         [("Фильтр", error(wrong_filter)), ("Прогноз", error(wrong_future))])
    plot(output, "16-mismatched-sigma", "Неопределённость при Q = 0", "Ошибка, м",
         [("RMSE", error(wrong_filter)), ("Расчётное σ", wrong_sigma)])
    alternate_gains = filter_positions(measurements, initial, acceleration_variance=1)[-1]
    plot(output, "17-process-noise", "Влияние шума движения на коэффициент Калмана", "Коэффициент",
         [("Дисперсия 0,04", gains[:, 0]), ("Дисперсия 1", alternate_gains[:, 0])])

    alt_truth, alt_measurements = simulate(rng, trials, 200, (100, 5), 0.2)
    optimal, _, _, _, _, optimal_gains = filter_positions(alt_measurements, (100, 5))
    understated = filter_positions(alt_measurements, (100, 5), gain=optimal_gains[-10] / 5)[0]
    plot(output, "18-fixed-gain", "Заниженный фиксированный коэффициент", "RMSE, м",
         [("Адаптивный", rmse(alt_truth, optimal)), ("Фиксированный", rmse(alt_truth, understated))])
    print(f"{trials} прогонов · RMSE фильтра на последнем шаге: {filtered_error[-1]:.2f} м")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Воспроизводимый эксперимент с линейным фильтром Калмана.")
    parser.add_argument("--trials", type=int, default=500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=Path("kalman-results"))
    args = parser.parse_args()
    if args.trials < 1:
        parser.error("--trials must be at least 1")
    run(args.output, args.trials, args.seed)
