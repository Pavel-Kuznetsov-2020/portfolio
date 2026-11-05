from functools import partial

from edp.radar import radar_experiment

run = partial(radar_experiment, heterogeneous=True)
