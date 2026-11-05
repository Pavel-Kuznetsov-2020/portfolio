const { $, options, table, metrics, bars, num, money, sum, labelDate } = demo;
const { stores, products, weeks, cash } = retailData;
const storeName = new Map(stores.map(([id, name]) => [id, name]));
storeName.set("ЦЕХ", "Цех");
const productName = new Map(products.map(([id, name]) => [id, name]));
let events = [...retailData.events];

$("week").innerHTML = options(weeks.map((week) => [week, labelDate(week) + ".2026"]));
$("week").value = weeks.at(-1);
for (const id of ["store", "from", "to"]) {
  $(id).innerHTML = options([...(id === "store" ? [["", "Вся сеть"]] : []), ...stores]);
}
$("to").value = stores[1][0];
$("product").innerHTML = options([["", "Все товары"], ...products]);
$("product").value = products[0][0];
$("move-product").innerHTML = options(products);

function render() {
  const end = $("week").value;
  const start = retail.weekStart(end);
  const rows = retail.stock(events, end).filter(({ store, product }) =>
    (!$("store").value || $("store").value === store) && (!$("product").value || $("product").value === product));
  metrics("metrics", [
    ["Остаток", num(sum(rows, (row) => row.qty)) + " кг"], ["Вложено в остаток", money(sum(rows, (row) => row.cost))],
    ["Потенциальная выручка от запаса", money(sum(rows, (row) => row.potential))],
    ["Списания за неделю", num(sum(rows, (row) => row.waste)) + " кг · " + money(sum(rows, (row) => row.wasteCost))],
  ]);
  bars("stock-chart", stores.filter(([store]) => rows.some((row) => row.store === store)).map(([store, label]) => {
    const items = rows.filter((row) => row.store === store);
    return { label, values: [sum(items, (row) => row.qty), sum(items, (row) => row.sale)] };
  }), ["Остаток", "Продано за неделю"], (value) => num(value) + " кг");
  table("stock", ["Точка", "Товар", "Приход, кг", "Продано, кг", "Перевод, кг", "Списано, кг", "Остаток, кг", "По закупке", "По цене продажи"],
    rows.map((row) => [storeName.get(row.store), productName.get(row.product), ...[row.received, row.sale, row.transfer, row.waste, row.qty].map(num),
      money(row.cost), money(row.potential)]));
  const payments = cash.filter(([day, store]) => day >= start && day <= end && (!$("store").value || $("store").value === store));
  const income = sum(payments, (row) => row[4]);
  const expense = sum(payments, (row) => row[5]);
  metrics("cash", [["Поступления", money(income)], ["Выплаты", money(expense)], ["Чистый денежный поток", money(income - expense)]]);
  table("cash-table", ["Дата", "Точка", "Способ оплаты", "Статья", "Поступление", "Выплата"],
    payments.map(([day, store, method, type, plus, minus]) => [labelDate(day), storeName.get(store), method, type, money(plus), money(minus)]));
  const choice = retail.stock(events, weeks.at(-1)).find((row) => row.store === $("from").value && row.product === $("move-product").value);
  $("available").textContent = "Доступно на " + labelDate(weeks.at(-1)) + " — " + num(choice.qty) + " кг.";
  $("weight").max = choice.qty;
  $("transfer").querySelector("button[type=submit]").disabled = choice.qty < 1 || $("from").value === $("to").value;
}

for (const id of ["week", "store", "product", "from", "to", "move-product"]) $(id).addEventListener("change", render);
$("transfer").addEventListener("submit", (event) => {
  event.preventDefault();
  const updated = retail.transfer(events, { from: $("from").value, to: $("to").value, product: $("move-product").value, qty: Number($("weight").value) });
  if (!updated) return;
  events = updated;
  $("week").value = weeks.at(-1);
  $("store").value = "";
  $("product").value = $("move-product").value;
  $("notice").hidden = false;
  $("notice").textContent = "Товар перемещён. Количество и оценка запаса всей сети сохранились. Денежных операций по переводу нет.";
  render();
});
$("reset").addEventListener("click", () => {
  events = [...retailData.events];
  $("notice").hidden = true;
  render();
});
render();
