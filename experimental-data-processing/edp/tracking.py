"""Linear trajectory experiments from labs 6–9."""

import matplotlib.pyplot as plt
import numpy as np

from edp.filters import filter_series, linear_observer, motion, simulate, smooth_series
from edp.plots import lines, rmse, save, write_table


def run_linear(transition, process, initial, prior, observations, noise=16.):
    jacobian = np.eye(1, len(initial))
    observe = linear_observer(observations[:, None], jacobian, np.array([[noise]]))
    return filter_series(transition, process, initial, prior, len(observations), observe)


def biased_motion(output, rng, trials):
    count = 160
    time = np.arange(count)
    transition, process = motion(1, 0.12)
    trajectory = 80 + 3 * time + 0.5 * 0.18 * time**2
    measured = trajectory + rng.normal(0, 4, count)
    # Subtract the known deterministic trajectory offset before filtering.
    offset = 0.5 * 0.18 * time**2
    initial = [measured[0], 2]
    prior = np.diag([16., 9.])
    baseline = run_linear(transition, process, initial, prior, measured)[1][:, 0]
    corrected = run_linear(transition, process, initial, prior, measured - offset)[1][:, 0] + offset
    figure, axes = plt.subplots(2, 1, figsize=(9, 6))
    lines(axes[0], [("Синтетический маршрут", trajectory), ("GPS", measured),
                    ("Базовая модель", baseline), ("С учётом ускорения", corrected)], "Положение, м")
    lines(axes[1], [("Базовая модель", baseline - trajectory),
                    ("С учётом ускорения", corrected - trajectory)], "Ошибка, м")
    save(figure, output, "model-bias.png")
    write_table(output, ["model", "rmse_m", "mean_error_m"],
                [(name, rmse(trajectory, values), (values - trajectory).mean())
                 for name, values in [("baseline", baseline), ("with_acceleration", corrected)]])


def correlated_noise(output, rng, trials):
    acceleration_std, measurement_std = 0.18, 4.
    transition, process = motion(1, acceleration_std)
    initial = [0., 3., 0., 0.]
    covariance = np.diag([2., 1., acceleration_std**2, measurement_std**2])
    count = 180

    figure, axes = plt.subplots(2, 2, figsize=(11, 7))
    rows = []
    for axis, (name, title, acceleration_correlation, measurement_correlation) in zip(axes.flat, [
        ("white", "Белый шум", 0., 0.),
        ("process", "Коррелировано ускорение", 0.88, 0.),
        ("measurement", "Коррелированы измерения", 0., 0.88),
        ("both", "Оба шума коррелированы", 0.88, 0.88),
    ]):
        extended_transition = np.array([
            [1., 1., 0.5, 0.], [0., 1., 1., 0.],
            [0., 0., acceleration_correlation, 0.], [0., 0., 0., measurement_correlation],
        ])
        extended_process = np.diag([
            0., 0., acceleration_std**2 * (1 - acceleration_correlation**2),
            measurement_std**2 * (1 - measurement_correlation**2),
        ])
        jacobian = np.array([[1., 0., 0., 1.]])
        errors, variances = [], []
        for _ in range(trials):
            starting_point = rng.multivariate_normal(initial, covariance)
            actual = simulate(rng, starting_point, extended_transition, extended_process, count)
            measured = (actual @ jacobian.T)[:, 0]
            _, baseline, _, baseline_covariance = run_linear(
                transition, process, initial[:2], covariance[:2, :2], measured, measurement_std**2
            )
            observe = linear_observer(measured[:, None], jacobian, np.zeros((1, 1)))
            _, augmented, _, augmented_covariance = filter_series(
                extended_transition, extended_process, initial, covariance, count, observe
            )
            errors.append([baseline[:, 0] - actual[:, 0], augmented[:, 0] - actual[:, 0]])
            variances.append([baseline_covariance[:, 0, 0], augmented_covariance[:, 0, 0]])
        empirical = np.sqrt(np.mean(np.square(errors), axis=0))
        theoretical = np.sqrt(np.mean(variances, axis=0))
        lines(axis, [("Белый шум · RMSE", empirical[0]), ("Модель AR(1) · RMSE", empirical[1]),
                     ("Белый шум · расчётное σ", theoretical[0]), ("AR(1) · расчётное σ", theoretical[1])],
              "Ошибка положения, м")
        axis.set_title(title)
        rows.append((name, *np.sqrt(np.mean(np.square(errors), axis=(0, 2)))))
    save(figure, output, "correlated-noise.png")
    write_table(output, ["scenario", "white_noise_position_rmse_m", "ar1_position_rmse_m"], rows)


def trial_states(rng, transition, process, initial, covariance, count):
    starting_point = rng.multivariate_normal(initial, covariance)
    truth = simulate(rng, starting_point, transition, process, count)
    measurements = truth[:, 0] + rng.normal(0, 20, count)
    return truth, measurements


def backward_smoothing(output, rng, trials):
    transition, process = motion(1, 0.2)
    initial = [5., 1.]
    covariance = np.diag([10000., 10000.])
    count = 200
    errors, variances = [], []
    for _ in range(trials):
        truth, observations = trial_states(rng, transition, process, initial, covariance, count)
        predicted, filtered, prior, posterior = run_linear(transition, process, initial, covariance, observations, 400.)
        smoothed, smoothed_covariance = smooth_series(transition, predicted, filtered, prior, posterior)
        errors.append([filtered - truth, smoothed - truth])
        variances.append([np.diagonal(posterior, axis1=1, axis2=2),
                          np.diagonal(smoothed_covariance, axis1=1, axis2=2)])
    empirical = np.sqrt(np.mean(np.square(errors), axis=0))
    theoretical = np.sqrt(np.mean(variances, axis=0))
    figure, axis = plt.subplots(figsize=(9, 4))
    lines(axis, [("Измерения", observations), ("Эталон", truth[:, 0]),
                 ("KF", filtered[:, 0]), ("RTS", smoothed[:, 0])], "Положение, м")
    save(figure, output, "trajectory.png")
    figure, axes = plt.subplots(2, 1, figsize=(9, 6))
    for component, axis in enumerate(axes):
        lines(axis, [("KF RMSE", empirical[0, :, component]), ("RTS RMSE", empirical[1, :, component]),
                     ("KF σ", theoretical[0, :, component]), ("RTS σ", theoretical[1, :, component])],
              ("Ошибка положения, м", "Ошибка скорости, м/с")[component])
    save(figure, output, "backward-smoothing.png")
    write_table(output, ["step", "kf_position_rmse", "rts_position_rmse", "kf_velocity_rmse",
                        "rts_velocity_rmse", "kf_position_std", "rts_position_std",
                        "kf_velocity_std", "rts_velocity_std"], [
        (index, *empirical[:, index, 0], *empirical[:, index, 1],
         *theoretical[:, index, 0], *theoretical[:, index, 1]) for index in range(count)
    ])


def dropouts(output, rng, trials):
    transition, process = motion(1, 0.2)
    initial = [5., 1.]
    covariance = np.diag([10000., 10000.])
    count, horizon = 200, 6
    forecast_transition = np.linalg.matrix_power(transition, horizon)
    forecast_process = np.zeros_like(process)
    for _ in range(horizon):
        forecast_process = transition @ forecast_process @ transition.T + process
    figure, axes = plt.subplots(2, 2, figsize=(11, 7))
    rows = []
    per_step = []
    for axis, rate in zip(axes.flat, (0.2, 0.3, 0.5, 0.7)):
        errors, variances = [], []
        missing_rates = []
        for _ in range(trials):
            truth, observations = trial_states(rng, transition, process, initial, covariance, count)
            missing = rng.random(count) < rate
            observations[missing] = np.nan
            predicted, filtered, prior, posterior = run_linear(
                transition, process, initial, covariance, observations, 400.
            )
            forecast = filtered[:-horizon] @ forecast_transition.T
            forecast_covariance = forecast_transition @ posterior[:-horizon] @ forecast_transition.T + forecast_process
            errors.append([predicted[horizon:] - truth[horizon:], filtered[horizon:] - truth[horizon:],
                           forecast - truth[horizon:]])
            variances.append([prior[horizon:, 0, 0], posterior[horizon:, 0, 0], forecast_covariance[:, 0, 0]])
            missing_rates.append(missing.mean())
        empirical = np.sqrt(np.mean(np.square(errors), axis=0))
        theoretical = np.sqrt(np.mean(variances, axis=0))
        for index, label in enumerate(("Прогноз на шаг", "После обновления", "Прогноз на 6 шагов")):
            steps = np.arange(horizon, count)
            axis.plot(steps, empirical[index, :, 0], color=f"C{index}", label=label)
            axis.plot(steps, theoretical[index], color=f"C{index}", linestyle=":", alpha=0.8)
        axis.set(xlabel="Шаг", ylabel="RMSE и расчётное σ, м")
        axis.grid(alpha=0.2)
        axis.set_title(f"Вероятность пропуска {rate:.0%}")
        per_step.extend((rate, step, *empirical[:, index, 0], *theoretical[:, index])
                        for index, step in enumerate(range(horizon, count)))
        pooled = np.sqrt(np.mean(np.square(errors), axis=(0, 2)))
        rows.append((rate, np.mean(missing_rates), *pooled[:, 0], *pooled[:, 1]))
    axes[0, 0].legend()
    save(figure, output, "gnss-dropouts.png")
    write_table(output, ["dropout_probability", "actual_dropout_rate", "prior_position_rmse",
                        "filtered_position_rmse", "six_step_position_rmse", "prior_velocity_rmse",
                        "filtered_velocity_rmse", "six_step_velocity_rmse"], rows)
    write_table(output, ["dropout_probability", "step", "prior_rmse_m", "filtered_rmse_m",
                        "six_step_rmse_m", "prior_std_m", "filtered_std_m", "six_step_std_m"],
                per_step, "errors-by-step.csv")
