const { accounts, constructions, filters, installations, iso, kindNames, round, sum } = drilling;
const byId = (id) => document.getElementById(id);
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("ru-RU", {
  month: "long", timeZone: "UTC",
}).format(new Date(Date.UTC(2026, index, 1))));
const moneyFormatter = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2, minimumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 });
const money = (amount) => moneyFormatter.format(amount);
const date = (serial) => iso(serial).split("-").reverse().join(".");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));
const option = (label, value = label) => '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + "</option>";
const monthsOptions = monthNames.map((name, index) => option(name, index + 1)).join("");
const managerOptions = drillingData.managers.map(({ name }) => option(name)).join("");
const accountOptions = accounts.map((name) => option(name)).join("");
const cashHead = ["Дата", "Приход", "Расход", "Заявка", "Счёт", "Категория", "Назначение"];
let orders = [...drillingData.orders];
let cash = [...drillingData.cash];
let selected = 106;
let active = "orders";

function renderTable(node, headers, rows, firstCell = null) {
  const headings = headers.map((text) => '<th scope="col">' + escapeHtml(text) + "</th>").join("");
  const rendered = rows.map((row) => "<tr>" + row.map((value, index) =>
    "<td>" + (index === 0 && firstCell ? firstCell(value) : escapeHtml(value)) + "</td>").join("") + "</tr>").join("");
  node.innerHTML = "<thead><tr>" + headings + "</tr></thead><tbody>" + (rendered ||
    '<tr><td colspan="' + headers.length + '">Нет записей по выбранным условиям.</td></tr>') + "</tbody>";
}

function metrics(node, values) {
  node.innerHTML = values.map(([label, value]) => '<div class="metric"><span>' + escapeHtml(label) +
    "</span><strong>" + escapeHtml(value) + "</strong></div>").join("");
}

function keyValue(lines) {
  return '<dl class="breakdown">' + lines.map(([label, value]) => "<div><dt>" + escapeHtml(label) + "</dt><dd>" +
    escapeHtml(money(value)) + "</dd></div>").join("") + "</dl>";
}

function serial(value) {
  return Date.parse(value) / 86400000 + 25569;
}

function orderFilters(order) {
  const [kind, manager, status, month] = ["kind-filter", "manager-filter", "status-filter", "order-month"].map((id) => byId(id).value);
  return (!kind || order.kind === kind) && (!manager || order.input[2] === manager) &&
    (!status || order.ops.at(-1) === status) && (!month || Number(iso(order.input[1]).slice(5, 7)) === Number(month));
}

function renderOrders() {
  const visible = orders.filter(orderFilters);
  if (!visible.some((order) => order.id === selected)) selected = visible[0]?.id;
  const details = visible.map((order) => drilling.orderDetails(order, cash));
  const current = details.filter(({ status }) => status !== "отмена");
  metrics(byId("order-metrics"), [
    ["Заявки", visible.length],
    ["Стоимость действующих заявок", money(sum(current, ({ price }) => price.total))],
    ["Дебиторка действующих заявок", money(sum(current, ({ debt }) => debt))],
  ]);
  renderTable(byId("order-table"), ["Заявка", "Направление", "Менеджер", "Статус", "Стоимость", "Дебиторка"],
    visible.map((order, index) => [
      order.id, kindNames[order.kind], order.input[2], details[index].status, money(details[index].price.total),
      details[index].status === "отмена" ? "—" : money(details[index].debt),
    ]),
    (id) => '<button type="button" class="order-link" data-order="' + id + '" aria-pressed="' + (id === selected) + '">№ ' + id + "</button>");
  renderDetail(visible.find((order) => order.id === selected));
}

function renderDetail(order) {
  const node = byId("detail");
  if (!order) {
    node.innerHTML = "<h2>Карточка заявки</h2><p>Измените фильтры, чтобы выбрать заявку.</p>";
    return;
  }
  const details = drilling.orderDetails(order, cash);
  const paidLine = [["Стоимость", details.price.total], ["Получено", details.paidIn], ["Остаток к оплате", details.debt]];
  const showPayment = details.debt > 0 && details.status !== "отмена";
  const paymentDate = iso(order.input[1]);
  node.innerHTML = '<h2 id="detail-title" tabindex="-1">Заявка № ' + order.id + '</h2><p class="muted">' +
    escapeHtml(kindNames[order.kind] + " · " + order.input[2] + " · " + date(order.input[1])) + "</p>" +
    keyValue(paidLine) +
    "<details><summary>Из чего складывается стоимость</summary>" + keyValue(details.price.lines) + "</details>" +
    "<details><summary>Себестоимость и маржа</summary>" +
    (order.demoNew ? "<p>Учредители ещё не внесли производственные расходы.</p>" :
      keyValue([...details.costs, ["Расчётная маржа", details.margin]])) + "</details>" +
    (details.obligations.length ? '<details><summary>Расчёты с исполнителями</summary><div class="scroll"><table id="obligations"></table></div></details>' : "") +
    (details.transactions.length ? '<details><summary>Операции по заявке</summary><div class="scroll"><table id="detail-cash"></table></div></details>' : "") +
    (showPayment ? '<form id="payment" class="payment"><h3>Внести оплату клиента</h3><div class="form-grid">' +
      '<label>Сумма, ₽<input name="amount" type="number" required min="0.01" step="0.01" max="' +
      details.debt + '" value="' + Math.min(20000, details.debt) + '"></label>' +
      '<label>Счёт<select name="account">' + accountOptions + '</select></label>' +
      '<label>Дата оплаты<input name="date" type="date" min="' + paymentDate + '" max="' + drillingData.year +
      '-12-31" required value="' + paymentDate + '"></label></div><button class="primary" type="submit">Провести оплату</button></form>' : "");
  if (details.obligations.length) renderTable(byId("obligations"), ["Обязательство", "Начислено", "Оплачено", "Остаток"],
    details.obligations.map(([label, ...amounts]) => [label, ...amounts.map(money)]));
  if (details.transactions.length) renderTable(byId("detail-cash"), cashHead, cashRows(details.transactions));
}

function cashRows(rows) {
  return rows.map(([day, income, expense, order, account, category, note]) =>
    [date(day), income ? money(income) : "—", expense ? money(expense) : "—", order || "—", account, category, note]);
}

function formOrder() {
  const values = Object.fromEntries(new FormData(byId("quote-form")));
  const day = serial(values.date);
  const id = Math.max(...orders.map((order) => order.id)) + 1;
  const input = [id, day, values.manager, "Клиент демо " + id, "", ""];
  if (values.kind === "drill") {
    input.push(Number(values.metres), values.soil, values.construction, values.filter,
      values.rate === "" ? "" : Number(values.rate), Number(values.adjustment), Number(values.commission));
  } else {
    input.push(values.installation, Number(values["installation-price"]), Number(values.commission));
  }
  return { id, kind: values.kind, input, ops: values.kind === "drill"
    ? ["", "", "", "", "", "", "", 0, "в работе"]
    : ["", "", "", 0, 0, "в работе"], demoNew: true };
}

function configureQuote() {
  const isDrilling = byId("quote-kind").value === "drill";
  for (const [id, hidden] of [["drill-fields", !isDrilling], ["install-fields", isDrilling]]) {
    const fields = byId(id);
    fields.hidden = hidden;
    for (const input of fields.querySelectorAll("input,select")) input.disabled = hidden;
  }
}

function setConstructions() {
  byId("construction").innerHTML = constructions(byId("soil").value).map((item) => option(item)).join("");
}

function setInstallationPrice() {
  byId("quote-form").elements["installation-price"].value = installations[byId("installation").value];
}

function renderQuote() {
  const preview = byId("quote-preview");
  const form = byId("quote-form");
  const submit = form.querySelector('button[type="submit"]');
  if (!form.checkValidity()) {
    preview.textContent = "Проверьте значения в полях заявки.";
    submit.disabled = true;
    return;
  }
  const quote = drilling.quote(formOrder());
  if (quote.valid === false || quote.total <= 0) {
    preview.textContent = quote.valid === false ? "Для этого метража нет фиксированного тарифа. Укажите цену за метр."
      : "Итоговая стоимость должна быть больше нуля.";
    submit.disabled = true;
    return;
  }
  preview.innerHTML = keyValue([...quote.lines, ["Итоговая стоимость", quote.total]]);
  submit.disabled = false;
}

function renderFinance() {
  const { months, balances, allExpenses } = drilling.finance(cash);
  const totalIncome = sum(months, (month) => month.income);
  const totalExpense = sum(months, (month) => month.expense);
  metrics(byId("finance-metrics"), [
    ["Доходы за год", money(totalIncome)], ["Расходы за год", money(totalExpense)],
    ["Прибыль за год", money(totalIncome - totalExpense)],
  ]);
  metrics(byId("balances"), balances.map(([name, value]) => [name, money(value)]));
  const shown = months.filter((month) => month.income || month.expense);
  const max = Math.max(1, ...shown.flatMap((month) => [month.income, month.expense]));
  byId("finance-chart").innerHTML = '<div class="legend"><span>Доходы</span><span>Расходы</span></div>' + shown.map((month) =>
    '<div class="chart-row"><strong>' + monthNames[month.month - 1] +
    "</strong><div>" + [[month.income, "income", "Доходы"], [month.expense, "expense", "Расходы"]].map(([value, style, label]) =>
      '<div class="bar-line"><div class="track"><div class="bar ' + style + '" style="width:' + (100 * value / max) +
      '%" aria-hidden="true"></div></div><span aria-label="' + label + ': ' + money(value) + '">' + money(value) + "</span></div>"
    ).join("") + "</div></div>").join("");
  const rows = [
    ["Доходы", (item) => item.income], ["Бурение", (item) => item.drill], ["Монтаж", (item) => item.install],
    ["Расходы", (item) => item.expense],
    ...allExpenses.map((category) => [category, (item) => item.byCategory[category]]),
    ["Прибыль", (item) => item.profit],
  ];
  const rent = (profit, expense) => expense ? pct.format(profit / expense) : "—";
  renderTable(byId("pnl-table"), ["Статья", "За год", ...monthNames],
    [...rows.map(([name, getter]) => [name, money(sum(months, getter)), ...months.map((month) => money(getter(month)))]),
      ["Рентабельность", rent(totalIncome - totalExpense, totalExpense), ...months.map((item) => rent(item.profit, item.expense))]]);
  renderCash();
}

function renderCash() {
  const account = byId("account-filter").value;
  const month = Number(byId("cash-month").value);
  const order = Number(byId("cash-order").value);
  const visible = cash.filter((row) => (!account || row[4] === account) && (!month || Number(iso(row[0]).slice(5, 7)) === month)
    && (!order || row[3] === order)).sort((left, right) => right[0] - left[0]);
  renderTable(byId("cash-table"), cashHead, cashRows(visible));
}

function renderManagers() {
  renderTable(byId("manager-table"), ["Менеджер", "Направление", "Заявки", "Закрытые", "% закрытия", "Выручка"],
    drilling.managerStats(orders, Number(byId("manager-month").value)).map(([name, type, total, closed, ratio, revenue]) =>
      [name, type, total, closed, ratio === null ? "—" : pct.format(ratio), money(revenue)]));
}

function show(view) {
  active = view;
  for (const button of document.querySelectorAll("[data-view]")) {
    const current = button.dataset.view === view;
    button.setAttribute("aria-pressed", String(current));
    byId(button.dataset.view).hidden = !current;
  }
  ({ orders: renderOrders, quote: renderQuote, finance: renderFinance, managers: renderManagers })[view]();
}

function notify(text) {
  const notice = byId("notice");
  notice.textContent = text;
  notice.hidden = false;
}

for (const id of ["order-month", "cash-month", "manager-month"]) byId(id).insertAdjacentHTML("beforeend", monthsOptions);
byId("manager-month").value = "3";
for (const id of ["manager-filter", "quote-manager"]) byId(id).insertAdjacentHTML("beforeend", managerOptions);
byId("account-filter").insertAdjacentHTML("beforeend", accountOptions);
byId("quote-filter").innerHTML = [...filters.keys()].map((value) => option(value)).join("");
byId("installation").innerHTML = Object.keys(installations).map((value) => option(value)).join("");
setConstructions();
setInstallationPrice();
configureQuote();

document.querySelector(".nav").addEventListener("click", (event) => {
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (view) show(view);
});
for (const id of ["kind-filter", "manager-filter", "status-filter", "order-month"]) byId(id).addEventListener("change", renderOrders);
for (const id of ["account-filter", "cash-month", "cash-order"]) byId(id).addEventListener("input", renderCash);
byId("manager-month").addEventListener("change", renderManagers);
byId("order-table").addEventListener("click", (event) => {
  const button = event.target.closest("[data-order]");
  if (!button) return;
  selected = Number(button.dataset.order);
  renderOrders();
  byId("detail-title").focus({ preventScroll: true });
  if (matchMedia("(max-width: 850px)").matches) byId("detail").scrollIntoView({ block: "start" });
});
byId("detail").addEventListener("submit", (event) => {
  if (event.target.id !== "payment") return;
  event.preventDefault();
  const order = orders.find(({ id }) => id === selected);
  const { amount, account, date: day } = Object.fromEntries(new FormData(event.target));
  const debt = drilling.orderDetails(order, cash).debt;
  if (!(Number(amount) > 0 && Number(amount) <= debt && accounts.includes(account) && Number.isFinite(serial(day)))) return;
  cash.push([serial(day), round(Number(amount)), "", selected, account, kindNames[order.kind], "Оплата из демо"]);
  renderOrders();
  notify("Оплата " + money(Number(amount)) + " проведена по заявке № " + selected + ". Остаток — " + money(round(debt - amount)) + ".");
  byId("detail-title").focus({ preventScroll: true });
});
byId("quote-form").addEventListener("input", (event) => {
  if (event.target.id === "soil") setConstructions();
  if (event.target.id === "installation") setInstallationPrice();
  if (event.target.id === "quote-kind") configureQuote();
  renderQuote();
});
byId("quote-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const order = formOrder();
  const quote = drilling.quote(order);
  if (quote.valid === false || quote.total <= 0) return;
  orders.push(order);
  selected = order.id;
  for (const id of ["kind-filter", "manager-filter", "status-filter", "order-month"]) byId(id).value = "";
  show("orders");
  notify("Заявка № " + selected + " добавлена в реестр. Стоимость — " + money(quote.total) + ".");
  byId("detail-title").focus();
});
byId("reset").addEventListener("click", () => {
  orders = [...drillingData.orders];
  cash = [...drillingData.cash];
  selected = 106;
  for (const id of ["kind-filter", "manager-filter", "status-filter", "order-month", "account-filter", "cash-month", "cash-order"]) byId(id).value = "";
  byId("manager-month").value = "3";
  byId("quote-form").reset();
  setConstructions();
  setInstallationPrice();
  configureQuote();
  show(active);
  notify("Исходные данные восстановлены.");
});
show("orders");
