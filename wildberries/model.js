const wb = (() => {
  const products = [
    { sku: "DEMO-01", model: "Органайзер", category: "Хранение", liters: 1.8, cost: 360, tax: .06, vat: .05, mode: "income", price: 1190 },
    { sku: "DEMO-02", model: "Органайзер", category: "Хранение", liters: 2.4, cost: 540, tax: .15, vat: .05, mode: "profit", price: 1590 },
    { sku: "DEMO-03", model: "Набор коробок", category: "Хранение", liters: 4.1, cost: 1460, tax: .06, vat: .05, mode: "income", price: 1890 },
    { sku: "DEMO-04", model: "Чехол", category: "Текстиль", liters: .8, cost: 250, tax: .06, vat: .05, mode: "off", price: 790 },
  ];
  const start = Date.UTC(2026, 1, 2);
  const dayMs = 86400000;
  const iso = (offset) => new Date(start + offset * dayMs).toISOString().slice(0, 10);
  const dates = Array.from({ length: 14 }, (_, index) => iso(index));
  let seed = 20260202;
  function integer(minimum, maximum) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return minimum + Math.floor(seed / 4294967296 * (maximum - minimum + 1));
  }
  const daySku = products.flatMap((product, sku) => {
    let available = [145, 130, 182, 35][sku];
    const receipts = [{ 5: 150, 11: 85 }, { 6: 124 }, {}, { 7: 58, 12: 24 }][sku];
    return dates.map((day, index) => {
      const replenishment = receipts[index] || 0;
      available += replenishment;
      const price = product.price + ([0, 0, -70, 0][sku] * Number(index >= 7)) + integer(-2, 2) * 10;
      const finished = Math.round(price * integer(83, 89) / 100);
      const desired = integer([13, 9, 3, 7][sku], [31, 24, 13, 20][sku]);
      const units = Math.min(desired, available);
      available -= units;
      return { product, sku, day, index, units, available, price, finished };
    });
  });
  const funnel = products.flatMap((product, sku) => {
    const first = sku < 2 ? -30 : 0;
    return Array.from({ length: 14 - first }, (_, index) => {
      const offset = index + first;
      const entry = offset >= 0 ? daySku[sku * dates.length + offset] : null;
      const orders = entry ? entry.units : integer(7, 27);
      const baskets = Math.max(orders, Math.round(orders * integer(155, 265) / 100) + integer(2, 14));
      return { day: iso(offset), sku: product.sku, category: product.category,
        opens: baskets * integer(4, 7) + integer(10, 85), baskets, orders,
        orderSum: orders * (entry ? entry.price : product.price) };
    });
  });
  const completed = products.flatMap((product, sku) => dates.map((day) => ({
    day, sku: product.sku, category: product.category,
    buyouts: [85, 71, 26, 39][sku] + integer(-5, 7), cancels: [16, 31, 31, 15][sku] + integer(-3, 5),
  })));
  const rates = [
    { category: "Хранение", from: "2026-01-01", commission: .17, acquiring: .015 },
    { category: "Хранение", from: "2026-02-09", commission: .18, acquiring: .015 },
    { category: "Текстиль", from: "2026-01-01", commission: .15, acquiring: .015 },
  ];
  const ktr = [{ week: dates[0], value: 1.05 }, { week: dates[7], value: 1.1 }];
  const orders = daySku.map(({ product, sku, day, price, finished }) => ({
    day, sku: product.sku, price, finished,
    base: integer(45, 57), extra: integer(10, 14), reverse: 40 + sku * 4 + integer(0, 5),
  }));
  const ads = daySku.flatMap(({ product, sku, day, index, units }) => {
    let attributionLeft = Math.floor(units * .65);
    return [8, 9, 7].map((type, kind) => {
      const burst = sku === 1 && index >= 8 && index <= 11 && type === 9;
      const impressions = integer(260, 1650) * (burst ? 2 : 1);
      const clicks = Math.round(impressions * integer(15, 60) / 1000);
      const attributed = Math.min(attributionLeft, Math.round(clicks * integer(3, 11) / 100));
      attributionLeft -= attributed;
      return { day, sku: product.sku, campaign: `SIM-${sku + 1}${kind + 1}`, type, impressions, clicks,
        orders: attributed, spend: Math.round(impressions * (burst ? 7.2 : integer(16, 58) / 100)) };
    });
  });
  const stock = daySku.flatMap(({ product, day, available }) => {
    const first = Math.round(available * integer(54, 69) / 100);
    return [{ day, sku: product.sku, warehouse: "Склад A", available: first },
      { day, sku: product.sku, warehouse: "Склад B", available: available - first }];
  });
  const storage = stock.map((row) => ({ day: row.day, sku: row.sku, warehouse: row.warehouse,
    expense: Math.round(row.available * (row.sku === "DEMO-03" ? 2.1 : .7)) }));
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  const ratio = (numerator, denominator) => denominator === 0 ? null : numerator / denominator;
  const rateOf = (rows) => ratio(sum(rows, "buyouts"), sum(rows, "buyouts") + sum(rows, "cancels"));
  const key = (row) => row.day + "|" + row.sku;
  const lookup = (rows) => new Map(rows.map((row) => [key(row), row]));
  function group(rows) {
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(key(row))) groups.set(key(row), []);
      groups.get(key(row)).push(row);
    }
    return groups;
  }
  const funnelByKey = lookup(funnel);
  const adsByKey = group(ads);
  const storageByKey = group(storage);
  const stockByKey = group(stock);

  function calculate(change = 0, basis = "buyouts", adChange = 0) {
    return orders.map((order) => {
      const product = products.find(({ sku }) => sku === order.sku);
      const daily = funnelByKey.get(key(order));
      const campaignRows = adsByKey.get(key(order)).map((row) => ({
        ...row, spend: row.spend * (1 + adChange / 100),
      }));
      const cutoff = Date.parse(order.day);
      const recent = funnel.filter((row) => row.sku === order.sku && Date.parse(row.day) < cutoff);
      const rollingOrders = sum(recent.filter((row) => Date.parse(row.day) >= cutoff - 30 * dayMs), "orders");
      const rollingRecords = recent.filter((row) => Date.parse(row.day) >= cutoff - 15 * dayMs).length;
      const windows = completed.filter((row) => row.day === order.day);
      const own = windows.filter((row) => row.sku === order.sku);
      const category = windows.filter((row) => row.category === product.category);
      const tiers = [
        ["Артикул", rollingOrders > 20 && rollingRecords > 10 ? rateOf(own) : null],
        ["Предмет", category.length > 1 ? rateOf(category) : null],
        ["Все товары", rateOf(windows)],
      ];
      const [buyoutSource, buyout] = tiers.find(([, value]) => value !== null && value > 0);
      const activeRate = rates.filter((row) => row.category === product.category && row.from <= order.day).at(-1);
      const coefficient = ktr.filter((row) => row.week <= order.day).at(-1).value;
      const direct = (order.base + order.extra * Math.ceil(Math.max(0, product.liters - 1))) * coefficient;
      const logistics = direct / buyout + order.reverse * (1 / buyout - 1);
      const price = order.price * (1 + change / 100);
      const finished = order.finished * (1 + change / 100);
      const orderSum = daily.orderSum * (1 + change / 100);
      const potential = orderSum * buyout;
      const fee = price * (activeRate.commission + activeRate.acquiring);
      const storageExpense = sum(storageByKey.get(key(order)), "expense");
      const advertising = sum(campaignRows, "spend");
      const vat = product.mode === "off" ? 0 : finished * product.vat / 1.05;
      const incomeBase = finished - vat;
      const expenseBase = incomeBase - product.cost - fee - logistics - (ratio(storageExpense + advertising, daily.orders) ?? 0);
      const tax = product.mode === "off" ? 0 : product.mode === "income"
        ? incomeBase * product.tax : (expenseBase < 0 ? incomeBase * .01 : expenseBase * product.tax);
      const unit = price - product.cost - fee - logistics - vat - tax;
      const marginBefore = price ? potential * unit / price : 0;
      const net = marginBefore - storageExpense - advertising;
      const adOrders = sum(campaignRows, "orders");
      const adClicks = sum(campaignRows, "clicks");
      const impressions = sum(campaignRows, "impressions");
      return { ...daily, ...order, model: product.model, price, finished, orderSum, potential, buyout, buyoutSource,
        opens: daily.opens, baskets: daily.baskets, orders: daily.orders, storage: storageExpense, advertising,
        adOrders, adClicks, impressions, net, marginBefore, fee, vat, tax, unit, logistics,
        base: basis === "buyouts" ? potential : orderSum, available: sum(stockByKey.get(key(order)), "available"),
        auto: sum(campaignRows.filter((row) => row.type === 8), "spend"),
        auction: sum(campaignRows.filter((row) => row.type === 9), "spend"),
        other: sum(campaignRows.filter((row) => ![8, 9].includes(row.type)), "spend") };
    });
  }

  function summarize(rows) {
    const preAd = sum(rows, "marginBefore") - sum(rows, "storage");
    const net = sum(rows, "net");
    const ad = sum(rows, "advertising");
    const stock = rows.at(-1).available;
    const zeroDays = rows.filter((row) => row.available === 0).length;
    const idleDays = rows.filter((row) => row.available === 0 && row.orders === 0).length;
    const orders = sum(rows, "orders");
    const drr = ratio(ad, sum(rows, "base"));
    const limit = preAd < 0 ? null : ratio(preAd, sum(rows, "base"));
    return { preAd, net, ad, stock, zeroDays, idleDays, orders, drr, limit };
  }

  function diagnose(summary) {
    if (summary.preAd < 0 && summary.orders > 0) return "economics";
    if (summary.idleDays > 0 || summary.zeroDays >= 2) return "stock";
    if (summary.preAd >= 0 && summary.net < 0 && summary.orders > 0) return "advertising";
    if (summary.net < 0) return "review";
    return "stable";
  }

  return { products, dates, funnel, completed, rates, ktr, orders, ads, storage, stock, calculate, summarize, diagnose, sum, ratio };
})();
