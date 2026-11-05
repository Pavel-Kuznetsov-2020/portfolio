const retail = (() => {
  const { stores, products, batches } = retailData;
  const price = (id) => products.find(([product]) => product === id)[2];
  const sum = (items, read) => items.reduce((value, item) => value + read(item), 0);
  const types = { "Поступление": 1, "Входящий перевод": 1, "Исходящий перевод": -1, "Продажа": -1, "Списание": -1 };
  const batchCost = (id) => batches.find(([batch]) => batch === id)[3] /
    sum(retailData.events.filter((row) => row[1] === id && row[4] === "Поступление"), (row) => row[5]);
  function weekStart(end) {
    return new Date(Date.parse(end) - 6 * 86400000).toISOString().slice(0, 10);
  }
  function stock(events, end) {
    const start = weekStart(end);
    return stores.flatMap(([store]) => products.map(([product]) => {
      const rows = events.filter((row) => row[2] === store && row[3] === product && row[0] <= end);
      const weekly = rows.filter((row) => row[0] >= start);
      const qty = sum(rows, (row) => types[row[4]] * row[5]);
      const movement = (type) => sum(weekly.filter((row) => row[4] === type), (row) => row[5]);
      return { store, product, qty, sale: movement("Продажа"), received: movement("Поступление"),
        transfer: movement("Входящий перевод") - movement("Исходящий перевод"), waste: movement("Списание"),
        cost: sum(rows, (row) => types[row[4]] * row[5] * batchCost(row[1])), potential: qty * price(product),
        wasteCost: sum(weekly.filter((row) => row[4] === "Списание"), (row) => row[5] * batchCost(row[1])),
      };
    }));
  }
  function transfer(events, { from, to, product, qty }) {
    const end = retailData.weeks.at(-1);
    const lots = batches.map(([batch]) => [batch, sum(events.filter((row) =>
      row[1] === batch && row[2] === from && row[3] === product), (row) => types[row[4]] * row[5])]);
    if (from === to || !Number.isInteger(qty) || qty <= 0 || qty > sum(lots, (row) => row[1])) return null;
    const movements = [];
    for (const [batch, available] of lots) {
      const moved = Math.min(qty, available);
      if (!moved) continue;
      movements.push([end, batch, from, product, "Исходящий перевод", moved],
        [end, batch, to, product, "Входящий перевод", moved]);
      qty -= moved;
    }
    return [...events, ...movements];
  }
  return { weekStart, stock, transfer, batchCost, types };
})();
