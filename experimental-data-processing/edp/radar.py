"""Radar tracking with converted measurements, EKF, and RTS smoothing."""

import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse
import numpy as np

from edp.filters import (
    angle_wrap, filter_series, motion, polar_measurement, polar_to_cartesian,
    radar_observer, simulate, smooth_series,
)
from edp.plots import lines, rmse, save, write_table


def measure(states, origins):
    relative = states[:, [0, 2]] - origins
    return np.column_stack((np.linalg.norm(relative, axis=1), np.arctan2(relative[:, 0], relative[:, 1])))


def noisy_measurements(rng, truth, origins, deviations):
    return measure(truth, origins) + rng.normal(size=(len(truth), 2)) * deviations


def converted_measurements(output, rng, trials):
    transition, process = motion(1, 0.0, 2)
    count = 150
    jacobian = np.eye(4)[[0, 2]]
    figure, axes = plt.subplots(1, 2, figsize=(10, 4))
    rows = []
    for axis, (scenario, initial) in zip(axes, [
        ("far", [1600., 8., 2600., -12.]),
        ("near", [25., 8., 60., -12.]),
    ]):
        truth = simulate(rng, initial, transition, process, count)
        for distance_std, angle_std in [(20., 0.02), (50., 0.0015)]:
            polar_covariance = np.diag([distance_std**2, angle_std**2])
            errors = []
            for _ in range(trials):
                raw = noisy_measurements(rng, truth, np.zeros(2), [distance_std, angle_std])
                measurements, transforms = zip(*(polar_to_cartesian(point) for point in raw))
                covariances = [matrix @ polar_covariance @ matrix.T for matrix in transforms]

                def observe(index, state):
                    return measurements[index] - jacobian @ state, jacobian, covariances[index]

                _, filtered, _, _ = filter_series(transition, process, initial,
                                                  np.diag([2500., 100., 2500., 100.]), count, observe)
                errors.append(filtered[:, [0, 2]] - truth[:, [0, 2]])
            step_errors = np.sqrt(np.mean(np.square(errors), axis=(0, 2)))
            axis.plot(step_errors, label=f"σᵣ {distance_std:g} м · σᵦ {angle_std:g} рад")
            rows.append((scenario, distance_std, angle_std, *np.sqrt(np.mean(np.square(errors), axis=(0, 1)))))
        axis.set(xlabel="Шаг", ylabel="RMSE, м", title="Далёкая цель" if scenario == "far" else "Близкая цель")
        axis.legend()
        axis.grid(alpha=0.25)
    save(figure, output, "converted-radar.png")
    write_table(output, ["scenario", "range_std_m", "bearing_std_rad", "east_rmse_m", "north_rmse_m"], rows)


def radar_experiment(output, rng, trials, heterogeneous=False):
    count = 200 if heterogeneous else 500
    initial = [1000., 100., 1000., 100.]
    transition, process = motion(1, 0.3, 2)
    covariance = np.diag([2500., 100., 2500., 100.])
    modes = [np.array([0, 1])] * count
    deviations = np.tile([50., 0.004], (count, 1))
    origins = np.zeros((count, 2))
    if heterogeneous:
        modes[1::2] = [np.array([1])] * (count // 2)
        deviations[1::2, 1] = 0.001
        origins[1::2] = [900., -600.]
    noise_covariances = np.eye(2)[None, :, :] * deviations[:, None, :]**2
    errors = []
    for _ in range(trials):
        truth = simulate(rng, initial, transition, process, count)
        observations = noisy_measurements(rng, truth, origins, deviations)
        observer = radar_observer(observations, modes, origins, noise_covariances)
        predicted, filtered, _, _ = filter_series(transition, process, initial, covariance, count, observer)
        reference = measure(truth, np.zeros(2))
        residuals = np.array([measure(predicted, np.zeros(2)) - reference, measure(filtered, np.zeros(2)) - reference])
        residuals[:, :, 1] = angle_wrap(residuals[:, :, 1])
        errors.append(residuals)
    empirical = np.sqrt(np.mean(np.square(errors), axis=0))
    figure, axes = plt.subplots(2, 1, figsize=(9, 6))
    for channel, ylabel in enumerate(("RMSE дальности, м", "RMSE азимута, рад")):
        lines(axes[channel], [("Прогноз", empirical[0, :, channel]), ("После обновления", empirical[1, :, channel])], ylabel)
    save(figure, output, "radar-errors.png")
    if not heterogeneous:
        figure, axes = plt.subplots(2, 1, figsize=(9, 6))
        forecast = measure(predicted, np.zeros(2))
        estimate = measure(filtered, np.zeros(2))
        for channel, ylabel in enumerate(("Дальность, м", "Азимут, рад")):
            lines(axes[channel], [("Радар", observations[:, channel]), ("Эталон", reference[:, channel]),
                                 ("Прогноз", forecast[:, channel]), ("EKF", estimate[:, channel])], ylabel)
        save(figure, output, "radar-measurements.png")
    figure, axis = plt.subplots(figsize=(7, 6))
    axis.plot(truth[:, 0], truth[:, 2], label="Эталон")
    axis.plot(filtered[:, 0], filtered[:, 2], "--", label="EKF")
    axis.set(xlabel="Восток, м", ylabel="Север, м", aspect="equal")
    axis.legend()
    save(figure, output, "radar-track.png")
    write_table(output, ["step", "sensor", "predicted_range_rmse_m", "filtered_range_rmse_m",
                        "predicted_bearing_rmse_rad", "filtered_bearing_rmse_rad"], [
        (index, "bearing_only" if len(channels) == 1 else "range_bearing",
         *empirical[:, index, 0], *empirical[:, index, 1])
        for index, channels in enumerate(modes)
    ])


def initial_position(observations, observation_covariance):
    positions, transform = polar_to_cartesian(observations[0])
    initial = [positions[0], 0., positions[1], 0.]
    covariance = np.diag([0., 100., 0., 100.])
    covariance[np.ix_([0, 2], [0, 2])] = transform @ observation_covariance @ transform.T
    return initial, covariance


def read_measurements(path):
    observations = np.loadtxt(path, ndmin=2)
    if observations.shape[0] < 2 or observations.shape[1] != 2:
        raise ValueError(f"{path.name}: ожидаются как минимум две строки «дальность азимут».")
    if not np.isfinite(observations).all() or np.any(observations[:, 0] <= 0):
        raise ValueError(f"{path.name}: дальность должна быть положительной, значения конечными.")
    return observations


def final_project(output, rng, trials, data_dir=None):
    transition, process = motion(1, 0.01, 2)
    measurement_covariance = np.diag([200.**2, 0.01**2])
    trajectories = []
    for index, initial in enumerate([
        [3200., 13., 5300., 9.], [3200., 17., 5300., 11.], [5600., -4., 4300., 21.],
    ], 1):
        if data_dir is None:
            truth = simulate(rng, initial, transition, process, 140)
            observations = noisy_measurements(rng, truth, np.zeros(2), [200., 0.01])
        else:
            truth = None
            observations = read_measurements(data_dir / f"z{index}.txt")
        trajectories.append((truth, observations))

    figure, axes = plt.subplots(1, 2, figsize=(12, 5))
    rows = []
    starts = []
    for index, (truth, observations) in enumerate(trajectories, 1):
        count = len(observations)
        initial, covariance = initial_position(observations, measurement_covariance)
        observer = radar_observer(observations, [np.array([0, 1])] * count, np.zeros((count, 2)),
                                  np.broadcast_to(measurement_covariance, (count, 2, 2)))
        # The first sample initializes the prior, so it is assimilated once.
        predicted, filtered, prior, posterior = filter_series(
            transition, process, initial, covariance, count,
            lambda step, state: observer(step, state) if step else None,
        )
        smoothed, smoothed_covariances = smooth_series(transition, predicted, filtered, prior, posterior)
        color = f"C{index - 1}"
        measured_xy = np.array([polar_to_cartesian(point)[0] for point in observations])
        axes[0].scatter(*measured_xy.T, s=5, color=color, alpha=0.2)
        axes[0].plot(filtered[:, 0], filtered[:, 2], ":", color=color, alpha=0.7)
        axes[0].plot(smoothed[:, 0], smoothed[:, 2], color=color, label=f"Цель {index}")
        write_table(output, ["step", "measured_east_m", "measured_north_m", "ekf_east_m", "ekf_north_m",
                            "rts_east_m", "rts_north_m", "rts_east_std_m", "rts_north_std_m"], [
            (step, *measured_xy[step], *filtered[step, [0, 2]], *smoothed[step, [0, 2]],
             *np.sqrt(smoothed_covariances[step, [0, 2], [0, 2]]))
            for step in range(count)
        ], f"track-{index}.csv")
        start = smoothed[0, [0, 2]]
        start_covariance = smoothed_covariances[0][np.ix_([0, 2], [0, 2])]
        variances, vectors = np.linalg.eigh(start_covariance)
        diameters = 2 * np.sqrt(5.991 * np.maximum(variances, 0))
        rotation = np.degrees(np.arctan2(vectors[1, 1], vectors[0, 1]))
        axes[1].add_patch(Ellipse(start, diameters[1], diameters[0], angle=rotation, color=color, alpha=0.24))
        axes[1].scatter(*start, color=color, label=f"Цель {index}")
        if truth is not None:
            axes[1].scatter(*truth[0, [0, 2]], marker="+", color=color, s=65)
        starts.append((start, start_covariance))
        start_error = "" if truth is None else np.linalg.norm(start - truth[0, [0, 2]])
        rows.append((index, *start, *np.sqrt(np.diag(start_covariance)), start_error))
    axes[0].set_title("Измерения, EKF (пунктир) и RTS")
    axes[1].set_title("Оценки старта · 95% эллипсы")
    for axis in axes:
        axis.autoscale_view()
        axis.set(xlabel="Восток, м", ylabel="Север, м", aspect="equal")
        axis.legend()
        axis.grid(alpha=0.2)
    save(figure, output, "radar-origins.png")
    write_table(output, ["target", "origin_east_m", "origin_north_m", "east_std_m", "north_std_m", "error_to_truth_m"], rows)
    pairs = []
    for left, (left_start, left_covariance) in enumerate(starts):
        for right in range(left + 1, len(starts)):
            right_start, right_covariance = starts[right]
            delta = left_start - right_start
            # Independent tracks imply a covariance sum for the difference.
            distance_squared = delta @ np.linalg.solve(left_covariance + right_covariance, delta)
            pairs.append((left + 1, right + 1, np.linalg.norm(delta), distance_squared, distance_squared <= 5.991))
    write_table(output, ["target_a", "target_b", "separation_m", "mahalanobis_squared",
                        "compatible_with_common_origin_at_95pct"], pairs, "origin-comparison.csv")
