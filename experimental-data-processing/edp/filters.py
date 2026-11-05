"""State-space models for the tracking experiments."""

import numpy as np


def motion(step, acceleration_std, dimensions=1):
    transition = np.array([[1., step], [0., 1.]])
    acceleration = np.array([step**2 / 2, step])
    process_covariance = acceleration_std**2 * np.outer(acceleration, acceleration)
    return (
        np.kron(np.eye(dimensions), transition),
        np.kron(np.eye(dimensions), process_covariance),
    )


def simulate(rng, initial, transition, process_covariance, count):
    states = np.empty((count, len(initial)))
    states[0] = initial
    noise = rng.multivariate_normal(np.zeros(len(initial)), process_covariance, size=count - 1)
    for index in range(1, count):
        states[index] = transition @ states[index - 1] + noise[index - 1]
    return states


def angle_wrap(angle):
    return (angle + np.pi) % (2 * np.pi) - np.pi


def polar_measurement(state, origin):
    east, north = state[[0, 2]] - origin
    distance = max(np.hypot(east, north), 1e-8)
    bearing = np.arctan2(east, north)
    jacobian = np.array([
        [east / distance, 0, north / distance, 0],
        [north / distance**2, 0, -east / distance**2, 0],
    ])
    return np.array([distance, bearing]), jacobian


def polar_to_cartesian(measurement):
    distance, bearing = measurement
    sine, cosine = np.sin(bearing), np.cos(bearing)
    return np.array([distance * sine, distance * cosine]), np.array([
        [sine, distance * cosine],
        [cosine, -distance * sine],
    ])


def filter_series(transition, process_covariance, initial, covariance, count, observe):
    """Apply a linear or extended Kalman filter with an optional update at each step."""
    state = np.array(initial, dtype=float)
    covariance = covariance.copy()
    predicted = np.empty((count, len(state)))
    filtered = np.empty_like(predicted)
    prior = np.empty((count, len(state), len(state)))
    posterior = np.empty_like(prior)
    identity = np.eye(len(state))

    for index in range(count):
        if index:
            state = transition @ state
            covariance = transition @ covariance @ transition.T + process_covariance
        predicted[index], prior[index] = state, covariance
        update = observe(index, state)
        if update is not None:
            residual, jacobian, measurement_covariance = update
            cross = covariance @ jacobian.T
            innovation_covariance = jacobian @ cross + measurement_covariance
            gain = np.linalg.solve(innovation_covariance, cross.T).T
            state = state + gain @ residual
            complement = identity - gain @ jacobian
            covariance = complement @ covariance @ complement.T + gain @ measurement_covariance @ gain.T
        filtered[index], posterior[index] = state, covariance

    return predicted, filtered, prior, posterior


def smooth_series(transition, predicted, filtered, prior, posterior):
    states = filtered.copy()
    covariances = posterior.copy()
    for index in range(len(states) - 2, -1, -1):
        gain = np.linalg.solve(prior[index + 1], transition @ posterior[index]).T
        states[index] += gain @ (states[index + 1] - predicted[index + 1])
        covariances[index] += gain @ (covariances[index + 1] - prior[index + 1]) @ gain.T
    return states, covariances


def linear_observer(measurements, jacobian, covariance):
    def observe(index, state):
        value = measurements[index]
        if not np.isfinite(value).all():
            return None
        return value - jacobian @ state, jacobian, covariance
    return observe


def radar_observer(measurements, modes, origins, covariance):
    def observe(index, state):
        channels = modes[index]
        predicted, jacobian = polar_measurement(state, origins[index])
        residual = measurements[index] - predicted
        residual[1] = angle_wrap(residual[1])
        return residual[channels], jacobian[channels], covariance[index][np.ix_(channels, channels)]
    return observe
