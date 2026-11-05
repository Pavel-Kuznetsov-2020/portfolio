const drilling = (() => {
  const { reference, managers, year } = drillingData;
  const kindNames = { drill: "Бурение", install: "Монтаж" };
  const accounts = reference.map((row) => row[0]).filter(Boolean);
  const filters = new Map(reference.filter((row) => row[8]).map((row) => [row[8], row[9]]));
  const pipes = new Map(reference.filter((row) => row[5]).map((row) => [row[5], row[6]]));
  const installations = { "Адаптер": 48000, "Кессон": 89000, "Летний вариант": 31500 };
  const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const sum = (list, get) => list.reduce((total, item) => total + (Number(get(item)) || 0), 0);
  const iso = (serial) => new Date((serial - 25569) * 86400000).toISOString().slice(0, 10);

  function constructions(soil) {
    return reference.filter((row) => row[12] === soil).map((row) => row[11]).filter((value, index, list) =>
      value && list.indexOf(value) === index);
  }

  function quote({ kind, input }) {
    if (kind === "install") {
      const base = Number(input[7]);
      const commission = Number(input[8]);
      return { total: round(base + commission), lines: [["Обустройство", base], ["Комиссия", commission]] };
    }
    const [metres, soil, construction, filter, rate, adjustment, commission] = input.slice(6);
    const tier = reference.filter((row) => row[11] === construction && row[12] === soil && row[13] >= metres)
      .sort((left, right) => left[13] - right[13])[0];
    const perMetre = rate !== "";
    const base = perMetre ? metres * rate : (tier?.[14] ?? 0);
    const filterPrice = filters.get(filter) ?? 0;
    return {
      total: round(base + Number(adjustment) + Number(commission) + filterPrice),
      valid: perMetre || Boolean(tier),
      lines: [
        [perMetre ? "Метраж × цена за метр" : "Фиксированный тариф" + (tier ? " до " + tier[13] + " м" : ""), base],
        ["Фильтр", filterPrice], ["Корректировка", Number(adjustment)], ["Комиссия", Number(commission)],
      ],
    };
  }

  function orderDetails(order, cash) {
    const { kind, ops, input } = order;
    const price = quote(order);
    const transactions = cash.filter((row) => row[3] === order.id);
    const paidIn = sum(transactions.filter((row) => row[5] === kindNames[kind]), (row) => row[1]);
    const costs = [];
    const obligations = [];
    const addCost = (label, value, category) => {
      const amount = Number(value) || 0;
      if (amount) costs.push([label, round(amount)]);
      if (category && amount) {
        const paid = sum(transactions.filter((row) => row[5] === category), (row) => row[2]);
        obligations.push([label, round(amount), round(paid), round(amount - paid)]);
      }
    };
    if (kind === "drill") {
      const [payRate, pipe1, metres1, pipe2, metres2, pipe3, metres3, other] = ops;
      if (payRate !== "") {
        const wage = payRate <= 1 ? price.total * payRate : input[6] * payRate;
        addCost("Бурильщик", wage, "ЗП бурильщика");
      }
      addCost("Фильтр", filters.get(input[9]));
      const pipeTotal = sum([[pipe1, metres1], [pipe2, metres2], [pipe3, metres3]], ([pipe, metres]) =>
        Math.ceil((metres || 0) / 3) * 3 * (pipes.get(pipe) || 0));
      addCost("Трубы · секции по 3 м", pipeTotal);
      addCost("Амортизация", price.total * reference[0][18]);
      addCost("Менеджер", input[12], "ЗП менеджера");
      addCost("Иные расходы", other);
    } else {
      const [equipment, installer, labour, correction, other] = ops;
      addCost("Оборудование", equipment);
      addCost("Монтажник", installer, "ЗП монтажника");
      addCost("Копачи", labour, "ЗП копачи");
      addCost("Менеджер", Number(input[8]) + Number(correction), "ЗП менеджера");
      addCost("Иные расходы", other);
    }
    return {
      price, transactions, paidIn: round(paidIn), debt: round(price.total - paidIn),
      costs, obligations, margin: round(price.total - sum(costs, (row) => row[1])), status: ops.at(-1),
    };
  }

  function finance(cash) {
    const allExpenses = [...new Set(cash.filter((row) => row[2]).map((row) => row[5]))].sort((a, b) => a.localeCompare(b, "ru"));
    const months = Array.from({ length: 12 }, (_, index) => {
      const prefix = year + "-" + String(index + 1).padStart(2, "0");
      const rows = cash.filter((row) => iso(row[0]).startsWith(prefix));
      const drill = sum(rows.filter((row) => row[5] === "Бурение"), (row) => row[1]);
      const install = sum(rows.filter((row) => row[5] === "Монтаж"), (row) => row[1]);
      const byCategory = Object.fromEntries(allExpenses.map((category) => [
        category, round(sum(rows.filter((row) => row[5] === category), (row) => row[2])),
      ]));
      const expense = sum(Object.values(byCategory), (value) => value);
      return { month: index + 1, drill, install, income: drill + install, expense,
        profit: round(drill + install - expense), byCategory };
    });
    const balances = accounts.map((name) => {
      const rows = cash.filter((row) => row[4] === name);
      return [name, round(sum(rows.filter((row) => ["Инвестиции", "Бурение", "Монтаж"].includes(row[5])), (row) => row[1]) -
        sum(rows, (row) => row[2]))];
    });
    return { months, balances, allExpenses };
  }

  function managerStats(orders, month) {
    return managers.flatMap(({ name }) => Object.keys(kindNames).map((kind) => {
      const matches = orders.filter((order) => order.input[2] === name && order.kind === kind &&
        Number(iso(order.input[1]).slice(5, 7)) === month);
      const closed = matches.filter((order) => order.ops.at(-1) === "готово");
      return [name, kindNames[kind], matches.length, closed.length, matches.length ? closed.length / matches.length : null,
        round(sum(closed, (order) => quote(order).total))];
    }));
  }

  return { kindNames, accounts, filters, installations, constructions, iso, quote, orderDetails, finance, managerStats, round, sum };
})();
