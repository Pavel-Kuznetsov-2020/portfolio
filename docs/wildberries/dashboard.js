const controls = Object.fromEntries(["sku", "week", "basis", "change", "ad-change"].map((id) => [id, document.getElementById(id)]));
const money = (value) => value === null ? "—" : Math.round(value).toLocaleString("ru-RU") + " ₽";
const number = (value) => value === null ? "—" : value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const percent = (value) => value === null ? "—" : number(value * 100) + "%";
const { ratio, sum } = wb;
const element = (tag, value) => Object.assign(document.createElement(tag), { textContent: value });

function table(id, headings, rows) {
  const head = document.createElement("thead");
  const header = document.createElement("tr");
  header.append(...headings.map((label) => Object.assign(element("th", label), { scope: "col" })));
  head.append(header);
  const body = document.createElement("tbody");
  for (const cells of rows) {
    const row = document.createElement("tr");
    row.append(...cells.map((value) => {
      const cell = element("td", "");
      cell.append(value);
      return cell;
    }));
    body.append(row);
  }
  document.getElementById(id).replaceChildren(head, body);
}

function compare(id, entries, labels, format, warning = (values) => values[1] < 0) {
  const numbers = entries.flatMap(([, values]) => values.filter((value) => value !== null));
  const minimum = Math.min(0, ...numbers);
  const maximum = Math.max(0, ...numbers);
  const position = (value) => (value - minimum) * 100 / (maximum - minimum || 1);
  const zero = position(0);
  const legend = element("ul", "");
  legend.className = "chart-legend";
  labels.forEach((label, index) => {
    const item = element("li", "");
    const swatch = element("span", "");
    swatch.className = "swatch";
    swatch.style.backgroundColor = index === 0 ? "#8099ad" : "#137c83";
    item.append(swatch, document.createTextNode(label));
    legend.append(item);
  });
  document.getElementById(id).replaceChildren(legend, ...entries.map(([sku, values]) => {
    const row = element("div", "");
    row.className = "compare-row";
    row.append(element("strong", sku));
    values.forEach((value, index) => {
      const track = element("div", "");
      track.className = "track";
      const axis = element("div", "");
      axis.className = "zero";
      axis.style.left = zero + "%";
      track.append(axis);
      if (value !== null) {
        const fill = element("div", "");
        fill.className = "fill" + (index === 0 ? " reference" : warning(values) ? " loss" : "");
        fill.style.left = Math.min(zero, position(value)) + "%";
        fill.style.width = Math.abs(position(value) - zero) + "%";
        track.append(fill);
      }
      const label = element("span", format(value));
      label.className = "compare-value";
      label.setAttribute("aria-label", labels[index] + ": " + format(value));
      row.append(track, label);
    });
    return row;
  }));
}

function speed(sku, end, window) {
  const cutoff = Date.parse(end);
  return sum(wb.funnel.filter((row) => row.sku === sku && Date.parse(row.day) <= cutoff
    && Date.parse(row.day) > cutoff - window * 86400000), "orders") / window;
}

const colors = ["#137c83", "#335ba6", "#a04936", "#79539c"];

function svgNode(tag, attributes, label = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.textContent = label;
  return node;
}

function dailyColumns(id, title, dates, series) {
  const values = series.flatMap((item) => item.values);
  const highest = Math.max(1, ...values);
  const tickStep = Math.max(1, Math.ceil(highest / 4));
  const scaleMax = tickStep * 4;
  const groupWidth = 700 / dates.length;
  const barWidth = Math.min(24, groupWidth * .78 / series.length);
  const x = (index) => 61 + groupWidth * (index + .5);
  const y = (value) => 170 - value * 150 / scaleMax;
  const svg = svgNode("svg", { viewBox: "0 0 790 205", role: "img", "aria-label": title });
  for (let tick = 0; tick <= scaleMax; tick += tickStep) {
    svg.append(svgNode("line", { x1: 61, x2: 761, y1: y(tick), y2: y(tick), stroke: tick === 0 ? "#90a5b0" : "#d8e4e9" }));
    svg.append(svgNode("text", { x: 51, y: y(tick) + 4, "text-anchor": "end" }, number(tick)));
  }
  dates.forEach((date, index) => {
    svg.append(svgNode("text", { x: x(index), y: 190, "text-anchor": "middle" }, date.slice(8) + "." + date.slice(5, 7)));
  });
  const legend = element("ul", "");
  legend.className = "chart-legend";
  series.forEach(({ label, values }, index) => {
    const color = colors[wb.products.findIndex((product) => product.sku === label)];
    values.forEach((value, position) => {
      const left = x(position) + (index - series.length / 2) * barWidth;
      const bar = svgNode("rect", { x: left, y: value ? y(value) : y(0) - 2,
        width: Math.max(1, barWidth - 2), height: value ? y(0) - y(value) : 2, rx: 1, fill: color,
        "data-value": value });
      bar.append(svgNode("title", {}, `${dates[position]} · ${label}: ${number(value)} шт.`));
      svg.append(bar);
    });
    const item = element("li", "");
    const swatch = element("span", "");
    swatch.className = "swatch";
    swatch.style.backgroundColor = color;
    item.append(swatch, document.createTextNode(label));
    legend.append(item);
  });
  document.getElementById(id).replaceChildren(svg, legend);
}

const diagnoses = {
  economics: {
    label: "Убыток до рекламы", priority: 0,
    evidence: (summary) => `Маржа до рекламы ${money(summary.preAd)} · остаток ${number(summary.stock)} шт.`,
    action: "Проверить цену распродажи и себестоимость. До проверки приостановить повторную закупку.",
    target: "scenario", link: "Проверка цены",
  },
  advertising: {
    label: "Убыток после рекламы", priority: 1,
    evidence: (summary) => `ДРР ${percent(summary.drr)} при расчётном пороге ${percent(summary.limit)}`,
    action: "Разобрать расходы по кампаниям и проверить сценарий сокращения рекламных затрат.",
    target: "ad-section", link: "Кампании",
  },
  stock: {
    label: "Перебои с наличием", priority: 2,
    evidence: (summary) => `${number(summary.zeroDays)} дн. с нулём на конец дня · ${number(summary.idleDays)} без заказов и остатка`,
    action: "Сверить даты пополнения и пересмотреть запас. Проверить доступность прежде, чем менять цену или рекламу.",
    target: "stock-section", link: "Динамика остатка",
  },
  review: {
    label: "Проверка расходов", priority: 3,
    evidence: (summary) => `Итоговая маржа ${money(summary.net)}`,
    action: "Проверить отдельные дни и источник расходов.",
    target: "scenario", link: "Экономика сценария",
  },
  stable: {
    label: "Без сигнала", priority: 4,
    evidence: (summary) => `Маржа ${money(summary.net)} · остаток ${number(summary.stock)} шт.`,
    action: "Продолжить мониторинг маржи и доступности.",
    target: "stock-section", link: "Динамика остатка",
  },
};

const groupBySku = (rows) => [...new Set(rows.map((row) => row.sku))]
  .map((sku) => [sku, rows.filter((row) => row.sku === sku)]);
const selectedRows = (rows, dates, sku) =>
  rows.filter((row) => dates.includes(row.day) && (!sku || row.sku === sku));
const signedMoney = (value) => (value > 0 ? "+" : "") + money(value);

function review(baseline, dates) {
  const entries = groupBySku(selectedRows(baseline, dates, "")).map(([sku, rows]) => {
    const summary = wb.summarize(rows);
    const code = wb.diagnose(summary);
    return { sku, summary, code, ...diagnoses[code] };
  }).sort((left, right) => left.priority - right.priority);
  table("review", ["Артикул", "Сигнал", "Основание", "Маржа после расходов"], entries.map((entry) => {
    const button = element("button", entry.sku);
    button.type = "button";
    button.setAttribute("aria-label", "Разобрать " + entry.sku);
    button.setAttribute("aria-pressed", String(controls.sku.value === entry.sku));
    button.addEventListener("click", () => {
      controls.sku.value = entry.sku;
      render();
      document.getElementById("detail-title").focus();
    });
    const badge = element("span", entry.label);
    badge.className = "badge " + entry.code;
    return [button, badge, entry.evidence(entry.summary), money(entry.summary.net)];
  }));
  const selected = entries.find((entry) => entry.sku === controls.sku.value);
  const detail = document.getElementById("sku-detail");
  detail.hidden = !selected;
  if (!selected) return;
  const title = document.getElementById("detail-title");
  title.textContent = selected.sku + " · " + selected.label;
  title.tabIndex = -1;
  document.getElementById("detail-facts").replaceChildren(
    element("dt", "Основание"), element("dd", selected.evidence(selected.summary)),
    element("dt", "Следующее действие"), element("dd", selected.action),
  );
  const anchor = element("a", selected.link);
  anchor.href = "#" + selected.target;
  const scenario = element("a", "Сценарий цены и рекламы");
  scenario.href = "#scenario";
  document.getElementById("detail-links").replaceChildren(anchor, ...(selected.target === "scenario" ? [] : [scenario]));
  table("weeks", ["Неделя", "Заказы", "МП до рекламы", "Реклама", "Итоговая маржа", "ДРР", "Дней с нулём"],
    [0, 1].map((week) => {
      const items = selectedRows(baseline, wb.dates.slice(week * 7, week * 7 + 7), selected.sku);
      const result = wb.summarize(items);
      return [week ? "09–15 февраля" : "02–08 февраля", number(result.orders), money(result.preAd), money(result.ad),
        money(result.net), percent(result.drr), number(result.zeroDays)];
    }));
}

function campaignDetail(dates, sku, adChange) {
  document.getElementById("campaigns").hidden = !sku;
  if (!sku) return;
  const records = selectedRows(wb.ads, dates, sku);
  const kinds = { 8: "Автореклама", 9: "Аукцион", 7: "Прочая" };
  const campaigns = [...new Set(records.map((row) => row.campaign))].map((campaign) => {
    const rows = records.filter((row) => row.campaign === campaign);
    const spend = sum(rows, "spend") * (1 + adChange / 100);
    const orders = sum(rows, "orders");
    return { campaign, type: kinds[rows[0].type], spend, orders, impressions: sum(rows, "impressions"), clicks: sum(rows, "clicks") };
  }).sort((left, right) => right.spend - left.spend);
  table("campaign-table", ["Кампания", "Тип", "Расход", "Показы", "Клики", "Заказы рекламы", "CPO"],
    campaigns.map((row) => [row.campaign, row.type, money(row.spend), number(row.impressions), number(row.clicks),
      number(row.orders), money(ratio(row.spend, row.orders))]));
}

function render() {
  const change = Math.min(100, Math.max(-90, controls.change.valueAsNumber || 0));
  const adChange = Math.min(100, Math.max(-100, controls["ad-change"].valueAsNumber || 0));
  const dates = controls.week.value === "" ? wb.dates : wb.dates.slice(Number(controls.week.value) * 7, Number(controls.week.value) * 7 + 7);
  const end = dates.at(-1);
  const baseline = wb.calculate(0, controls.basis.value);
  const baseRows = selectedRows(baseline, dates, controls.sku.value);
  const rows = selectedRows(wb.calculate(change, controls.basis.value, adChange), dates, controls.sku.value);
  const groups = groupBySku(rows);
  review(baseline, dates);
  campaignDetail(dates, controls.sku.value, adChange);
  const baseSummary = wb.summarize(baseRows);
  const scenarioSummary = wb.summarize(rows);
  table("scenario-result", ["Показатель", "Базовый период", "Сценарий", "Изменение"], [
    ["Маржа после расходов", money(baseSummary.net), money(scenarioSummary.net), signedMoney(scenarioSummary.net - baseSummary.net)],
    ["Расходы на рекламу", money(baseSummary.ad), money(scenarioSummary.ad), signedMoney(scenarioSummary.ad - baseSummary.ad)],
    ["ДРР", percent(baseSummary.drr), percent(scenarioSummary.drr),
      baseSummary.drr === null || scenarioSummary.drr === null ? "—" : number((scenarioSummary.drr - baseSummary.drr) * 100) + " п. п."],
  ]);
  const total = (key) => sum(rows, key);
  const metrics = [
    ["Заказы", number(total("orders"))], ["Заказы в рублях", money(total("orderSum"))],
    ["Потенциальные продажи", money(total("potential"))], ["Маржа после расходов", money(total("net"))],
    ["ДРР", percent(ratio(total("advertising"), total("base")))], ["Маржа на заказ", money(ratio(total("net"), total("orders")))],
  ];
  document.getElementById("metrics").replaceChildren(...metrics.map(([label, value]) => {
    const card = element("article", "");
    card.className = "metric";
    card.append(element("span", label), element("strong", value));
    return card;
  }));
  const preAd = (items) => sum(items, "marginBefore") - sum(items, "storage");
  compare("margin", groups.map(([sku, items]) => [sku, [preAd(items), sum(items, "net")]]),
    ["До рекламы", "После рекламы"], money);
  compare("ad-limit", groups.map(([sku, items]) => [sku, [
    preAd(items) < 0 ? null : ratio(preAd(items), sum(items, "base")),
    ratio(sum(items, "advertising"), sum(items, "base")),
  ]]), ["Порог ДРР", "Фактический ДРР"], percent,
  ([threshold, actual]) => actual !== null && (threshold === null || actual > threshold));
  dailyColumns("stock-trend", "Доступный остаток каждого артикула по дням", dates,
    groups.map(([sku, items]) => ({ label: sku, values: items.map((row) => row.available) })));
  dailyColumns("order-trend", "Заказы каждого артикула по дням", dates,
    groups.map(([sku, items]) => ({ label: sku, values: items.map((row) => row.orders) })));
  table("assortment", ["Артикул", "Модель", "Выкуп на конец периода", "МП до расходов", "Хранение", "Реклама", "МП после", "МП, %"],
    groups.map(([sku, items]) => {
      const last = items.at(-1);
      return [sku, last.model, percent(last.buyout) + " · " + last.buyoutSource, money(sum(items, "marginBefore")),
        money(sum(items, "storage")), money(sum(items, "advertising")), money(sum(items, "net")),
        percent(ratio(sum(items, "net"), sum(items, "base")))];
    }));
  table("funnel", ["Артикул", "Открытия карточки", "Корзины", "Заказы", "В корзину", "Из корзины в заказ"],
    groups.map(([sku, items]) => [sku, ...["opens", "baskets", "orders"].map((key) => number(sum(items, key))),
      percent(ratio(sum(items, "baskets"), sum(items, "opens"))), percent(ratio(sum(items, "orders"), sum(items, "baskets")))]));
  table("ads", ["Артикул", "Показы", "Клики", "Рекл. заказы", "CTR", "CPM", "CPO", "ДРР", "Авто / аукцион / прочая"],
    groups.map(([sku, items]) => [sku, ...["impressions", "adClicks", "adOrders"].map((key) => number(sum(items, key))),
      percent(ratio(sum(items, "adClicks"), sum(items, "impressions"))),
      money(ratio(1000 * sum(items, "advertising"), sum(items, "impressions"))),
      money(ratio(sum(items, "advertising"), sum(items, "adOrders")) ?? sum(items, "advertising")),
      percent(ratio(sum(items, "advertising"), sum(items, "base"))),
      ["auto", "auction", "other"].map((key) => money(sum(items, key))).join(" / ")]));
  table("stock", ["Артикул", "Остаток, шт.", "Дней с нулевым остатком", "Заказов/день · 3", "7", "14", "30"],
    groups.map(([sku, items]) => [sku, number(items.at(-1).available), number(items.filter((row) => row.available === 0).length),
      ...[3, 7, 14, 30].map((window) => number(speed(sku, end, window)))]));
  table("daily", ["Дата", "Артикул", "Заказы", "Цена до СПП", "Цена после СПП", "Выкуп", "Источник", "Логистика / выкуп", "Налог и НДС / выкуп", "МП после"],
    rows.map((row) => [row.day, row.sku, number(row.orders), money(row.price), money(row.finished), percent(row.buyout),
      row.buyoutSource, money(row.logistics), money(row.tax + row.vat), money(row.net)]));
}

controls.sku.append(...wb.products.map(({ sku, model }) => new Option(`${sku} · ${model}`, sku)));
for (const control of Object.values(controls)) control.addEventListener("input", render);
document.getElementById("reset").addEventListener("click", () => {
  controls.change.value = 0;
  controls["ad-change"].value = 0;
  render();
});
render();
