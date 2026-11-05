const marketing = (() => {
  const { rates } = marketingData;
  function detail(row, projects) {
    const [week, manager, project, owned, paid, booked, held, extra] = row;
    const contacts = owned + paid;
    const bases = owned * rates.base + paid * rates.paid;
    const payout = Math.floor(contacts / 100) * rates.hundred + held * rates.meeting;
    const revenue = projects.find(([id]) => id === project)[2] * held;
    return { week, manager, project, contacts, booked, held, bases, payout, extra, revenue };
  }
  function totals(facts, plans) {
    const total = (items, read) => items.reduce((sum, item) => sum + read(item), 0);
    const sums = Object.fromEntries(["contacts", "booked", "held", "bases", "payout", "extra", "revenue"].map((key) =>
      [key, total(facts, (row) => row[key])]));
    const cost = sums.bases + sums.payout + sums.extra;
    return { ...sums, cost, profit: sums.revenue - cost, costPerMeeting: sums.held ? cost / sums.held : null,
      margin: sums.revenue ? (sums.revenue - cost) / sums.revenue : null,
      conversion: sums.contacts ? sums.held / sums.contacts : null,
      planContacts: total(plans, (row) => row[3]), planMeetings: total(plans, (row) => row[4]) };
  }
  return { detail, totals };
})();
