const demo = (() => {
  const $ = (id) => document.getElementById(id);
  const rubles = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
  const units = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
  const money = (number) => number === null ? "—" : rubles.format(number) + " ₽";
  const num = (number) => units.format(number);
  const pct = (number) => number === null ? "—" : units.format(number * 100) + "%";
  const labelDate = (date) => date.slice(8, 10) + "." + date.slice(5, 7);
  const sum = (rows, read) => rows.reduce((total, row) => total + read(row), 0);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const options = (items) => items.map(([id, title]) =>
    '<option value="' + esc(id) + '">' + esc(title) + "</option>").join("");
  function table(id, headers, rows) {
    $(id).innerHTML = "<thead><tr>" + headers.map((header) => '<th scope="col">' + esc(header) + "</th>").join("") +
      "</tr></thead><tbody>" + (rows.length ? rows.map((row) => "<tr>" + row.map((cell) =>
        "<td>" + esc(cell) + "</td>").join("") + "</tr>").join("") :
        '<tr><td colspan="' + headers.length + '">Нет данных для выбранных условий.</td></tr>') + "</tbody>";
  }
  function metrics(id, pairs) {
    $(id).innerHTML = pairs.map(([label, value]) => '<div class="metric"><span>' + esc(label) + "</span><strong>" +
      esc(value) + "</strong></div>").join("");
  }
  function bars(id, rows, series, format) {
    const max = Math.max(1, ...rows.flatMap(({ values }) => values));
    $(id).innerHTML = '<div class="legend">' + series.map((name, index) => '<span class="series-' + index + '">' +
      esc(name) + "</span>").join("") + "</div>" + rows.map(({ label, values }) => '<div class="bar-row"><strong>' +
      esc(label) + "</strong><div>" + values.map((value, index) => '<div class="bar-line"><div class="track">' +
      '<div class="bar series-' + index + '" style="width:' + (value / max * 100) + '%" aria-hidden="true"></div>' +
      '</div><span aria-label="' + esc(series[index] + " " + format(value)) + '">' + esc(format(value)) +
      "</span></div>").join("") + "</div></div>").join("");
  }
  return { $, money, num, pct, labelDate, sum, options, table, metrics, bars };
})();
