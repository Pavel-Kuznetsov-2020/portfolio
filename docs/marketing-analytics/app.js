const { $, options, table, metrics, bars, money, pct, labelDate } = demo;
const { weeks } = marketingData;
let managers, projects, assignments, facts, plans;

function init() {
  ({ managers, projects, assignments, facts, plans } = Object.fromEntries(
    ["managers", "projects", "assignments", "facts", "plans"].map((key) => [key, [...marketingData[key]]])
  ));
}

function choices() {
  const currentProject = $("project").value;
  const currentManager = $("manager").value;
  $("project").innerHTML = options([["", "Все проекты"], ...projects]);
  $("project").value = projects.some(([id]) => id === currentProject) ? currentProject : "";
  const selectable = managers.filter(([id]) => assignments.some(([assigned, project]) =>
    assigned === id && (!$("project").value || $("project").value === project)));
  $("manager").innerHTML = options([["", "Все менеджеры"], ...selectable]);
  $("manager").value = selectable.some(([id]) => id === currentManager) ? currentManager : "";
  const assignment = $("assign").value;
  $("assign").innerHTML = options([...projects, ["new", "Создать новый проект"]]);
  if (assignment) $("assign").value = assignment;
}

function render() {
  const manager = $("manager").value;
  const project = $("project").value;
  const week = $("week").value;
  const matches = ([day, person, campaign]) => (!week || day === week) && (!manager || person === manager) &&
    (!project || campaign === project);
  const selectedFacts = facts.filter(matches).map((row) => marketing.detail(row, projects));
  const selectedPlans = plans.filter(matches);
  const total = marketing.totals(selectedFacts, selectedPlans);
  metrics("metrics", [
    ["Контакты · факт / план", total.contacts + " / " + total.planContacts],
    ["Встречи · факт / план", total.held + " / " + total.planMeetings],
    ["Стоимость встречи", money(total.costPerMeeting)],
    ["Прибыль", money(total.profit)],
  ]);
  const projectRows = projects.filter(([id]) =>
    selectedFacts.some(({ project }) => project === id) || selectedPlans.some((row) => row[2] === id)).map(([id, name]) => {
    const result = marketing.totals(selectedFacts.filter(({ project }) => project === id), selectedPlans.filter((row) => row[2] === id));
    return { name, ...result };
  });
  bars("meetings", projectRows.map((row) => ({ label: row.name, values: [row.held, row.planMeetings] })),
    ["Факт", "План"], (value) => value);
  bars("economy-chart", projectRows.map((row) => ({ label: row.name, values: [row.revenue, row.cost] })),
    ["Выручка", "Затраты"], money);
  table("economy", ["Проект", "Выручка", "Стоимость баз", "Выплаты", "Прочие затраты", "Всего затрат", "За встречу", "Прибыль", "Маржа"],
    projectRows.map((row) => [row.name, ...[row.revenue, row.bases, row.payout, row.extra, row.cost, row.costPerMeeting, row.profit].map(money), pct(row.margin)]));
  const managerName = new Map(managers.map(([id, name]) => [id, name]));
  const projectName = new Map(projects.map(([id, name]) => [id, name]));
  table("team", ["Менеджер", "Проект", "Контакты / план", "Назначено", "Состоялось / план", "Конверсия", "Выплата"],
    assignments.filter(([person, campaign]) => (!manager || person === manager) && (!project || campaign === project))
      .map(([person, campaign]) => {
        const result = marketing.totals(selectedFacts.filter(({ manager, project }) => manager === person && project === campaign),
          selectedPlans.filter((row) => row[1] === person && row[2] === campaign));
        return [managerName.get(person), projectName.get(campaign), result.contacts + " / " + result.planContacts, result.booked,
          result.held + " / " + result.planMeetings, pct(result.conversion), money(result.payout)];
      }));
}

$("week").innerHTML = options([["", "Все недели"], ...weeks.map((week) => [week, labelDate(week) + ".2026"])]);
$("week").value = weeks.at(-1);
init();
choices();
$("project").addEventListener("change", () => { choices(); render(); });
for (const id of ["week", "manager"]) $(id).addEventListener("change", render);

$("onboard").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = "M" + (managers.length + 1);
  const name = "Демо-менеджер " + (managers.length - marketingData.managers.length + 1);
  let project = $("assign").value;
  if (project === "new") {
    project = "P" + (projects.length + 1);
    projects.push([project, "Демо-проект " + (projects.length - marketingData.projects.length + 1), 15000]);
  }
  const week = weeks.at(-1);
  const held = Number($("held").value);
  managers.push([id, name]);
  assignments.push([id, project]);
  facts.push([week, id, project, 125, 35, Math.max(8, held), held, 2000]);
  plans.push([week, id, project, 160, Number($("target").value)]);
  choices();
  $("project").value = project;
  choices();
  $("manager").value = id;
  $("week").value = week;
  $("notice").hidden = false;
  $("notice").textContent = "Добавлен " + name + ". В фильтрах и таблицах появилась новая связка с проектом.";
  render();
});
$("reset").addEventListener("click", () => {
  init();
  $("project").value = $("manager").value = $("assign").value = "";
  $("week").value = weeks.at(-1);
  $("notice").hidden = true;
  choices();
  render();
});
render();
