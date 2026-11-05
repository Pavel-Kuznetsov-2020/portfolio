/**
 * Portfolio reconstruction. Install in the synthetic founders workbook only.
 * The data and formulas below are also used to build the Excel previews.
 */
const DEMO = {
  names: {
    drill: 'Бурение заявки', install: 'Монтаж заявки',
    drillCalc: 'Бурение заявки расчетн', installCalc: 'Монтаж заявки расчетн',
    drillView: 'Бурение заявки расчетн фильтр', installView: 'Монтаж заяки расчетн фильтр',
    drillCopy: 'Бурение заявки расчетн (копия)', installCopy: 'Монтаж заявки расчетн (копия)',
    drillFilter: 'Бурение фильтр', installFilter: 'Монтаж фильтр',
    cash: 'ДДС', accounts: 'Счета', pnl: 'ОПиУ', stats: 'Менеджеры',
    ref: 'Справочник', mirror: 'Справочник зеркало', roster: 'Список менеджеров', tech: 'Лист разработчика',
  },
  year: 2026, limit: 100, refLimit: 80, cashLimit: 1000, reportManagers: 30, month: 3,
  statuses: ['в работе', 'готово', 'отмена'],
  managers: [
    ['Менеджер А', 'Штатный менеджер', '', 'Демонстрационная книга А', ''],
    ['Менеджер Б', 'Внешний партнёр', '', 'Демонстрационная книга Б', ''],
  ],
  cashCategories: ['Бурение','Монтаж','Инвестиции','ЗП бурильщика','Закуп труб','Закуп фильтров',
    'ЗП менеджера','Оборудование','ЗП монтажника','ЗП копачи','Иные расходы','Аренда','Транспорт'],
};

const DRILL_HEADERS = ['№ Заявки','Дата','Менеджер','Клиент','Адрес','Телефон','Метраж','Тип скважины',
  'Конструкции','Тип фильтра','Стоимость за метр','Коррекция','Комиссия','Стоимость','Примечание'];
const INSTALL_HEADERS = ['№ Заявки','Дата','Менеджер','Клиент','Адрес','Телефон','Тип обустройства',
  'Стоимость','Комиссия','Итог','Примечание'];
const DRILL_CALC = [...DRILL_HEADERS, '', 'Дебиторка','Бурильщик тип оплаты','Бурильщик ЗП',
  'Статус оплаты бурильщика','Стоимость фильтра','Трубы 1','Закуп метраж трубы 1','Закуп труб 1 кол-во',
  'Закуп труб 1 сумма','Трубы 2','Закуп метраж труб  2','Закуп труб 2 кол-во','Закуп труб 2 сумма',
  'Трубы 3','Закуп метраж труб 3','Закуп труб 3 кол-во','Закуп труб 3 сумма','Закуп труб общая сумма','Аморт',
  'Комиссия менеджера','Статус оплаты менеджера','Иные расходы','Примечание','Итого маржа','Статус'];
const INSTALL_CALC = [...INSTALL_HEADERS, '', 'Дебиторка','Оборудование','Монтажник','Статус оплаты монтажника',
  'Копачи','Статус оплаты копачи','Комиссия менеджера коррекция','Комиссия менеджера','Статус оплаты менеджера',
  'Иные расходы','Примечание','Итого маржа','Статус'];
const REF_HEADERS = ['Счета','','Песок','Известняк','','Тип труб','Цена труб за 1 метр','','Тип фильтра','Цена фильтра',
  '','Тип конструкции','Тип скважины','Метраж до','Фикс цена','','Тип оплаты бурильщика','Ставка бурильщика',
  'Амортизация техники','Амортизация долотьев','','Тип обустройства'];
const MIRROR_HEADERS = ['Менеджеры','','Счета','','Песок','Известняк','','Тип труб','Цена труб за 1 метр','','Тип фильтра',
  'Цена фильтра','','Тип конструкции','Тип скважины','Метраж до','Фикс. цена','','Тип оплаты бурильщика','Ставка',
  'Амортизация','','Тип обустройства','Тариф монтажа','Менеджер'];

function demoDate(month, day) {
  return Date.UTC(DEMO.year, month - 1, day) / 86400000 + 25569;
}

function rangeRows(count, make) {
  return Array.from({length: count}, (_, index) => make(index));
}

function col(index) {
  return index < 26 ? String.fromCharCode(65 + index) : col(Math.floor(index / 26) - 1) + col(index % 26);
}

function refSheet(name) {
  return "'" + name.replace(/'/g, "''") + "'!";
}

function referenceRows() {
  const rows = rangeRows(8, () => Array(22).fill(''));
  const set = (start, data) => data.forEach((values, row) =>
    values.forEach((value, column) => rows[row][start + column] = value));
  set(0, [['Расчётный счёт'],['Касса'],['Резерв']]);
  set(2, [['П-125','И-133'],['П-140','И-159']]);
  set(5, [['ПНД-125',550],['ПНД-140',680],['Сталь-133',820],['Сталь-159',1050],['НПВХ-117',430]]);
  set(8, [['Сетка 125',6400],['Щелевой 140',8100],['Без фильтра',0]]);
  set(11, [
    ['П-125','Песок',30,76500],['П-125','Песок',55,125500],
    ['П-140','Песок',45,124000],['П-140','Песок',75,172000],
    ['И-133','Известняк',45,146000],['И-133','Известняк',80,224000],
    ['И-159','Известняк',65,208000],['И-159','Известняк',110,315000],
  ]);
  set(16, [['Доля выручки',0.22,0.04,0],['Ставка за метр',690]]);
  set(21, [['Адаптер'],['Кессон'],['Летний вариант']]);
  return rows;
}

function mirrorRows(ref, roster, manager) {
  const installation = {'Адаптер': 48000, 'Кессон': 89000, 'Летний вариант': 31500};
  const map = {2:0,4:2,5:3,7:5,8:6,10:8,11:9,13:11,14:12,15:13,16:14,18:16,19:17,20:18,22:21};
  return rangeRows(Math.max(ref.length, roster.length, 1), (index) => {
    const row = Array(25).fill('');
    for (const [destination, source] of Object.entries(map)) row[destination] = ref[index]?.[source] ?? '';
    row[0] = roster[index]?.[0] ?? '';
    row[23] = installation[row[22]] ?? '';
    if (index === 0) row[24] = manager;
    return row;
  });
}

function seedOrders() {
  const rows = [
    [101,1,12,0,'drill',[38,'Песок','П-125','Сетка 125','',-2000,6300],[0.22,'ПНД-125',38,'','','','',3200,'готово']],
    [102,1,15,1,'drill',[61,'Известняк','И-133','Без фильтра',4100,0,20000],[690,'Сталь-133',62,'НПВХ-117',55,'','',9500,'готово']],
    [103,1,20,0,'install',['Адаптер',48000,2500],[18000,9500,4500,0,1000,'готово']],
    [104,2,4,1,'install',['Кессон',89000,4000],[39400,15000,7900,700,0,'готово']],
    [105,2,11,0,'drill',[28,'Песок','П-125','Сетка 125','',0,4000],[0.22,'ПНД-125',29,'','','','',850,'готово']],
    [106,2,15,1,'drill',[46,'Песок','П-140','Щелевой 140','',4500,14500],[690,'ПНД-140',46,'ПНД-125',16,'','',2000,'в работе']],
    [107,2,22,0,'install',['Летний вариант',31500,2500],[10200,5600,0,0,800,'готово']],
    [108,3,2,1,'drill',[73,'Известняк','И-159','Без фильтра',4550,-9000,25500],[0.22,'Сталь-159',74,'Сталь-133',52,'НПВХ-117',17,8800,'готово']],
    [109,3,5,0,'drill',[35,'Песок','П-125','Сетка 125','',1700,6300],[690,'ПНД-125',35,'','','','',500,'в работе']],
    [110,3,8,0,'install',['Кессон',89000,2500],[44000,14500,8400,-500,1800,'в работе']],
    [111,3,11,1,'install',['Адаптер',48000,4000],['','','',0,0,'отмена']],
    [112,3,15,0,'drill',[45,'Песок','П-140','Щелевой 140','',0,6200],['','','','','','','',0,'отмена']],
    [113,3,18,1,'install',['Летний вариант',31500,4000],[11800,6800,3500,0,1200,'готово']],
    [114,3,21,1,'drill',[37,'Песок','П-140','Щелевой 140','',0,10200],[690,'ПНД-140',38,'','','','',1200,'в работе']],
    [115,3,23,0,'install',['Адаптер',48000,2500],[17000,8700,4200,0,850,'готово']],
    [116,3,25,0,'drill',[33,'Известняк','И-133','Без фильтра','',-7000,7300],[0.22,'Сталь-133',33,'','','','',5000,'готово']],
  ];
  return rows.map(([id,month,day,manager,kind,details,ops]) => {
    const head = [id,demoDate(month,day),DEMO.managers[manager][0],'Клиент Демо ' + id,
      'Учебный участок ' + id,''];
    const input = [...head,...details,'',''];
    return {id,kind,manager,month,day,input,ops,key:'synthetic-' + id};
  });
}

function seedPrice(order, ref) {
  if (order.kind === 'install') return order.input[7] + order.input[8];
  const [, , , , , , metres, type, construction, filter, rate, adjustment, commission] = order.input;
  const tier = ref.filter(row => row[11] === construction && row[12] === type && row[13] >= metres)
    .sort((left, right) => left[13] - right[13])[0];
  return (rate !== '' ? metres * rate : tier?.[14] || 0) + adjustment + commission
    + (ref.find(row => row[8] === filter)?.[9] || 0);
}

function seedCash(orders, ref) {
  const result = [];
  const accounts = ['Расчётный счёт','Касса','Резерв'];
  const push = (month,day,income,expense,id,account,category,note) =>
    result.push([demoDate(month,day),income,expense,id,accounts[account],category,note]);
  push(1,2,400000,'','',0,'Инвестиции','Стартовый взнос');
  push(1,2,120000,'','',2,'Инвестиции','Резерв');
  orders.filter(order => order.ops.at(-1) !== 'отмена').forEach((order,index) => {
    const {month,day,id,input,kind,ops} = order;
    const ready = ops.at(-1) === 'готово';
    const price = seedPrice(order,ref);
    const incomeCategory = kind === 'drill' ? 'Бурение' : 'Монтаж';
    const first = Math.round(price * 0.4);
    push(month,day,first,'',id,index % 2,incomeCategory,'Аванс');
    if (ready) {
      const crossMonth = id === 103 || id === 107;
      push(crossMonth ? month+1 : month,crossMonth ? 2 : day+2,price-first,'',id,
        (index+1)%2,incomeCategory,'Окончательный расчёт');
    }
    const expenses = kind === 'drill' ? [
      ['ЗП бурильщика',ops[0] <= 1 ? price*ops[0] : input[6]*ops[0]],
      ['Закуп труб',[1,3,5].reduce((sum, offset) => sum + Math.ceil((ops[offset+1] || 0)/3)*3
        * (ref.find(row=>row[5]===ops[offset])?.[6]||0),0)],
      ['Закуп фильтров',ref.find(row=>row[8]===input[9])?.[9]||0],
      ['ЗП менеджера',input[12]],['Иные расходы',ops[7]],
    ] : [['Оборудование',ops[0]],['ЗП монтажника',ops[1]],['ЗП копачи',ops[2]],
      ['ЗП менеджера',input[8]+ops[3]],['Иные расходы',ops[4]]];
    expenses.forEach(([category,amount], expenseIndex) => {
      const paid = ready ? amount : expenseIndex % 2 === 0 ? Math.round(amount/2) : 0;
      if (paid) push(month,day+1,'',paid,id,(index+expenseIndex)%2,category,'Оплата по заявке');
    });
  });
  for (const month of [1,2,3]) {
    push(month,6,'',28000,'',0,'Аренда','Аренда базы');
    push(month,25,'',12200 + 1900*month,'',1,'Транспорт','Общие транспортные расходы');
  }
  return result.sort((left,right)=>left[0]-right[0]);
}

function rowFormula(kind, row) {
  const n = DEMO.names;
  const cash = refSheet(n.cash);
  const ref = refSheet(n.ref);
  const live = DEMO.cashLimit + 1;
  const paid = (column, category) => 'SUMIFS(' + cash + column + '$2:' + column + '$' + live + ',' +
    cash + 'D$2:D$' + live + ',A' + row + ',' + cash + 'F$2:F$' + live + ',"' + category + '")';
  const left = (due, column, category) => due + row + '-' + paid(column,category);
  const lookup = (column, table) => 'IFERROR(VLOOKUP(' + column + row + ',' + ref + table + ',2,FALSE),0)';
  const gated = (test, expression) => '=IF(' + test + row + '="","",' + expression + ')';
  const tubes = (pipe, pieces) => lookup(pipe,'F$2:G$80') + '*' + pieces + row + '*3';
  const formulas = kind === 'drill' ? {
    Q:left('N','B','Бурение'), S:'IF(R'+row+'="","",IF(AND(R'+row+'>=0,R'+row+'<=1),N'+row+'*R'+row+',G'+row+'*R'+row+'))',
    T:left('S','C','ЗП бурильщика'), U:lookup('J','I$2:J$80'), X:'ROUNDUP(W'+row+'/3,0)',
    Y:tubes('V','X'), AB:'ROUNDUP(AA'+row+'/3,0)', AC:tubes('Z','AB'), AF:'ROUNDUP(AE'+row+'/3,0)', AG:tubes('AD','AF'),
    AH:'SUM(Y'+row+',AC'+row+',AG'+row+')', AI:'N'+row+'*'+ref+'S$2', AJ:'M'+row,
    AK:left('AJ','C','ЗП менеджера'), AN:'N'+row+'-SUM(S'+row+',U'+row+',AH'+row+':AJ'+row+',AL'+row+')',
  } : {
    M:left('J','B','Монтаж'), P:left('O','C','ЗП монтажника'), R:left('Q','C','ЗП копачи'),
    T:'SUM(I'+row+',S'+row+')', U:left('T','C','ЗП менеджера'),
    X:'J'+row+'-SUM(N'+row+':O'+row+',Q'+row+',T'+row+',V'+row+')',
  };
  const onlyIfInput = {X:'W',Y:'W',AB:'AA',AC:'AA',AF:'AE',AG:'AE'};
  return Object.fromEntries(Object.entries(formulas).map(([key,value]) => [
    key,gated(kind === 'drill' ? onlyIfInput[key]||'A' : 'A',value),
  ]));
}

function managerFormulas(kind, row, native) {
  const mirror = refSheet(DEMO.names.mirror);
  const rate = mirror+'Q$2:Q$80', construction = mirror+'N$2:N$80',
    soil = mirror+'O$2:O$80', metres = mirror+'P$2:P$80';
  const tier = native
    ? 'IFERROR(INDEX(SORT(FILTER({' + metres+','+rate+'},'+construction+'=I'+row+','+soil+'=H'+row+','+metres+'>=G'+row+'),1,TRUE),1,2),0)'
    : 'IFERROR(SUMIFS('+rate+','+construction+',I'+row+','+soil+',H'+row+','+metres+
      ',MINIFS('+metres+','+construction+',I'+row+','+soil+',H'+row+','+metres+',">="&G'+row+')),0)';
  const formulas = {C:'=IF(A'+row+'="","",'+mirror+'Y$2)'};
  if (kind === 'drill') {
    formulas.N = '=IF(A'+row+'="","",IF(K'+row+'<>"",G'+row+'*K'+row+','+tier+
      ')+SUM(M'+row+',L'+row+')+IFERROR(VLOOKUP(J'+row+','+mirror+'K$2:L$80,2,FALSE),0))';
  } else {
    formulas.J = '=IF(A'+row+'="","",SUM(H'+row+':I'+row+'))';
  }
  return formulas;
}

function calcInput(order, price) {
  const {kind,input,key,ops} = order;
  const isDrill = kind === 'drill';
  const row = [...input,key,...Array((isDrill?DRILL_CALC:INSTALL_CALC).length-input.length-1).fill('')];
  row[isDrill ? 13 : 9] = price;
  if (isDrill) {
    const [rate,first,firstMetres,second,secondMetres,third,thirdMetres,extra,status] = ops;
    [row[17],row[21],row[22],row[25],row[26],row[29],row[30],row[37],row[40]] =
      [rate,first,firstMetres,second,secondMetres,third,thirdMetres,extra,status];
  } else {
    [row[13],row[14],row[16],row[18],row[21],row[24]] = ops;
  }
  return row;
}

function reportMatrix() {
  const cash = refSheet(DEMO.names.cash);
  const last = DEMO.cashLimit + 1;
  const range = column => cash + '$'+column+'$2:$'+column+'$'+last;
  const expenses = DEMO.cashCategories.slice(3).sort((a,b)=>a.localeCompare(b,'ru'));
  const labels = ['ДОХОДЫ','РАСХОДЫ','ПРИБЫЛЬ','РЕНТАБЕЛЬНОСТЬ','Бурение','Монтаж',...expenses,...Array(100-expenses.length).fill('')];
  const report = [[DEMO.year,'Сводка за год',...rangeRows(12,index=>'=DATE($A$1,'+(index+1)+',1)')]];
  const end = labels.length+1;
  for (const [index,label] of labels.entries()) {
    const row = index+2;
    report.push([label,...rangeRows(13, month=>{
      const letter = col(month+1);
      if (row === 2) return '=SUM('+letter+'6:'+letter+'7)';
      if (row === 3) return '=SUM('+letter+'8:'+letter+end+')';
      if (row === 4) return '='+letter+'2-'+letter+'3';
      if (row === 5) return '=IFERROR('+letter+'4/'+letter+'3,0)';
      if (!month) return '=IF(A'+row+'="","",SUM(C'+row+':N'+row+'))';
      return '=IF($A'+row+'="","",SUMIFS('+range(row<=7?'B':'C')+','+range('F')+',$A'+row+','+
        range('A')+',">="&'+letter+'$1,'+range('A')+',"<"&EDATE('+letter+'$1,1)))';
    })]);
  }
  return report;
}

function managerReport() {
  const n = DEMO.names;
  const result = [['Месяц/год',demoDate(DEMO.month,1),'','','','','','','','',''], Array(11).fill(''),
    ['Бурение','','','','','','Монтаж','','','',''],
    ['Менеджер','Заявки','Закрытые','% Закрытия','Выручка','','Менеджер','Заявки','Закрытые','% Закрытия','Выручка']];
  for (let row = 5; row < 5 + DEMO.reportManagers; row++) {
    function formulas(kind, nameCol, total, closed) {
      const drill = kind === 'drill';
      const ref = refSheet(drill?n.drillCalc:n.installCalc);
      const rng = c=>ref+c+'$2:'+c+'$301';
      const filter = rng('C')+','+nameCol+row+','+rng('B')+',">="&$B$1,'+rng('B')+',"<"&EDATE($B$1,1)';
      const ready = filter+','+rng(drill?'AO':'Y')+',"готово"';
      return [
        '=IF(COUNTIF('+rng('C')+','+refSheet(n.roster)+'A'+(row-3)+')=0,"",'+refSheet(n.roster)+'A'+(row-3)+')',
        '=IF('+nameCol+row+'="","",COUNTIFS('+filter+'))',
        '=IF('+nameCol+row+'="","",COUNTIFS('+ready+'))',
        '=IF('+nameCol+row+'="","",IFERROR('+closed+row+'/'+total+row+',0))',
        '=IF('+nameCol+row+'="","",SUMIFS('+rng(drill?'N':'J')+','+ready+'))',
      ];
    }
    result.push([...formulas('drill','A','B','C'),'',...formulas('install','G','H','I')]);
  }
  return result;
}

function accountsMatrix() {
  const ref = refSheet(DEMO.names.ref);
  const cash = refSheet(DEMO.names.cash);
  const last = DEMO.cashLimit+1;
  const income = (row,category) => 'SUMIFS('+cash+'B$2:B$'+last+','+cash+'E$2:E$'+last+',A'+row+','+
    cash+'F$2:F$'+last+',"'+category+'")';
  return [['Счета','Баланс'],...rangeRows(30,index=>{
    const row = index+2;
    return ['=IF('+ref+'A'+row+'="","",'+ref+'A'+row+')',
      '=IF(A'+row+'="","",'+['Инвестиции','Бурение','Монтаж'].map(category=>income(row,category)).join('+')+
      '-SUMIF('+cash+'E$2:E$'+last+',A'+row+','+cash+'C$2:C$'+last+'))'];
  })];
}

function matrixView(head, labels, body) {
  const row = Array(head.length).fill('');
  for (const [index,value] of Object.entries(labels)) row[index] = value;
  return [row,Array(head.length).fill(''),Array(head.length).fill(''),head,...body];
}

const FILTERS = {
  drill: {1:'Период',7:'Тип скважины',8:'Конструкция',9:'Тип фильтра'},
  install: {1:'Дата',6:'Тип обустройства'},
  drillCalc: {1:'Дата',2:'Менеджер',7:'Тип скважины',8:'Конструкция',9:'Тип фильтра',21:'Тип труб 1',
    25:'Тип труб 2',29:'Тип труб 3',40:'Статус'},
  installCalc: {1:'Дата',2:'Менеджер',6:'Тип обустройства',24:'Статус'},
};

function putRowFormulas(row, formulas) {
  const indexFor = column => [...column].reduce((value, letter)=>value*26+letter.charCodeAt(0)-64,0)-1;
  for (const [column,formula] of Object.entries(formulas)) row[indexFor(column)] = formula;
  return row;
}

function portfolioBooks() {
  const n = DEMO.names;
  const ref = referenceRows();
  const orders = seedOrders();
  const cash = seedCash(orders,ref);
  function select(kind) { return orders.filter(order=>order.kind===kind); }
  function seedCalc(kind) {
    const headers = kind==='drill'?DRILL_CALC:INSTALL_CALC;
    const list = select(kind);
    return [headers,...rangeRows(300,index=>putRowFormulas(
      list[index] ? calcInput(list[index],seedPrice(list[index],ref)) : Array(headers.length).fill(''),
      rowFormula(kind,index+2)
    ))];
  }
  function seedManager(kind, manager) {
    const headers = kind==='drill'?DRILL_HEADERS:INSTALL_HEADERS;
    const list = select(kind).filter(order=>order.manager===manager);
    return [[...headers,'Ключ обмена'],...rangeRows(DEMO.limit,index=>putRowFormulas(
      list[index] ? [...list[index].input,list[index].key] : Array(headers.length+1).fill(''),
      managerFormulas(kind,index+2,false)
    ))];
  }
  function sourceView(kind, isCentral) {
    const ref = refSheet(isCentral ? (kind==='drill'?n.drillCalc:n.installCalc) : n[kind]);
    const headers = isCentral ? (kind==='drill'?DRILL_CALC:INSTALL_CALC) : (kind==='drill'?DRILL_HEADERS:INSTALL_HEADERS);
    const criteria = FILTERS[isCentral?kind+'Calc':kind];
    const sourceCount = isCentral ? 300 : DEMO.limit;
    const helper = col(headers.length);
    const matrix = matrixView([...headers,'Индекс строки'],criteria,[]);
    for (let index=0;index<sourceCount;index++) {
      const sourceRow = index+2;
      const date = ref+'B'+sourceRow;
      const tests = [ref+'A'+sourceRow+'<>""',
        'OR($B$2="",'+date+'>=$B$2)','OR($B$3="",'+date+'<=$B$3)'];
      for (const key of Object.keys(criteria).map(Number).filter(field=>field!==1)) {
        const field = col(key);
        tests.push('OR($'+field+'$2="",'+ref+field+sourceRow+'=$'+field+'$2)');
      }
      const output = headers.map((_,ci)=>{
        if (index>=30 || isCentral && ci===(kind==='drill'?15:11)) return '';
        const letter = col(ci);
        const values = ref+letter+'$2:'+letter+'$'+(sourceCount+1);
        const lookup = 'INDEX('+values+',MATCH(ROW()-4,$'+helper+'$5:$'+helper+'$'+(sourceCount+4)+',0))';
        return '=IFERROR(IF('+lookup+'="","",'+lookup+'),"")';
      });
      output.push('=IF(AND('+tests.join(',')+'),COUNT($'+helper+'$4:'+helper+(index+4)+')+1,"")');
      matrix.push(output);
    }
    return matrix;
  }
  const drill = seedCalc('drill');
  const install = seedCalc('install');
  const cashHeader = ['Дата','Доход','Расход','№ Заявки','Счет','Категория','Назначение'];
  const make = (name,matrix,frozen=1,hidden=false) => ({name,matrix,frozen,hidden});
  const tech = [['Номера заявок по бурению','Номера заявок по монтажу','Системные категории ДДС','Категории ОПиУ','','','',
    'Ключ обмена','№ Заявки']];
  for (let index = 0; index < Math.max(orders.length,DEMO.cashCategories.length); index++) {
    tech.push([select('drill')[index]?.id ?? '',select('install')[index]?.id ?? '',
      DEMO.cashCategories[index] ?? '','','','','',orders[index]?.key ?? '',orders[index]?.id ?? '']);
  }
  const founders = [
    make(n.drillCalc,drill),
    make(n.drillCopy,[DRILL_CALC],1,true),
    make(n.drillView,sourceView('drill',true),4),
    make(n.installCopy,[INSTALL_CALC],1,true),
    make(n.installCalc,install),
    make(n.installView,sourceView('install',true),4),
    make(n.cash,[cashHeader,...cash]),
    make(n.accounts,accountsMatrix(),0),
    make(n.pnl,reportMatrix(),5),
    make(n.stats,managerReport(),0),
    make(n.ref,[REF_HEADERS,...ref]),
    make(n.roster,[['Менеджеры','Должность','Телефон','Примечание','Ссылка'],...DEMO.managers],0),
    make(n.tech,tech,0,true),
  ];
  const managers = DEMO.managers.map(([name],manager)=>[
    make(n.drill,seedManager('drill',manager)),
    make(n.drillFilter,sourceView('drill',false),4),
    make(n.install,seedManager('install',manager)),
    make(n.installFilter,sourceView('install',false),4),
    make(n.mirror,[MIRROR_HEADERS,...mirrorRows(ref,DEMO.managers,name)],1,true),
    make(n.tech,[['Импорт № бурения','Импорт № монтажа','Локальное зеркало № бурения','Локальное зеркало № монтажа'],
      ...rangeRows(Math.max(select('drill').length,select('install').length),index=>
        ['','',select('drill')[index]?.id ?? '',select('install')[index]?.id ?? ''])],1,true),
  ]);
  return {founders,managers};
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Бурение · демо')
    .addItem('Подключить книги менеджеров', 'connectDemo')
    .addItem('Обменяться заявками и прайсом', 'syncDemo')
    .addItem('Обновить справочники', 'refreshDemoReferences')
    .addItem('Обновить триггеры', 'installDemoTriggers')
    .addToUi();
}

function connectDemo() {
  const central = SpreadsheetApp.getActiveSpreadsheet();
  assertDemoCentral(central);
  const ui = SpreadsheetApp.getUi();
  const roster = central.getSheetByName(DEMO.names.roster);
  const links = DEMO.managers.map(([name],index) => {
    const response = ui.prompt('Подключение демо', 'Вставьте ссылку на нативную Google Таблицу «'+name+'».',
      ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return null;
    const id = response.getResponseText().trim().match(/(?:\/spreadsheets\/d\/)?([-\w]{25,})/);
    if (!id) throw new Error('Укажите ссылку на Google Таблицу.');
    const book = SpreadsheetApp.openById(id[1]);
    assertDemoManager(book, name);
    return book.getUrl();
  });
  if (links.some(link => !link)) return;
  if (new Set(links).size !== links.length) throw new Error('Менеджерам нужны отдельные книги.');
  PropertiesService.getScriptProperties().setProperty('DEMO_CENTRAL_ID',central.getId());
  roster.getRange(2,5,links.length,1).setValues(links.map(link=>[link]));
  installDemoTriggers();
  syncDemo();
}

function assertDemoCentral(book) {
  const tech = book.getSheetByName(DEMO.names.tech);
  if (!tech || tech.getRange('H1').getValue() !== 'Ключ обмена' ||
      tech.getRange('H2').getValue() !== 'synthetic-101') {
    throw new Error('Подключайте только демонстрационную книгу учредителей из архива.');
  }
}

function assertDemoManager(book,name) {
  const mirror = book.getSheetByName(DEMO.names.mirror);
  const drill = book.getSheetByName(DEMO.names.drill);
  if (!mirror || !drill || mirror.getRange('Y2').getValue() !== name ||
      drill.getRange('P1').getValue() !== 'Ключ обмена') {
    throw new Error('Для '+name+' нужна соответствующая демонстрационная книга из архива.');
  }
}

function centralDemo() {
  const id = PropertiesService.getScriptProperties().getProperty('DEMO_CENTRAL_ID');
  if (!id) throw new Error('Сначала выберите «Подключить книги менеджеров».');
  const central = SpreadsheetApp.openById(id);
  assertDemoCentral(central);
  return central;
}

function activeRoster(central) {
  const roster = central.getSheetByName(DEMO.names.roster);
  const rows = roster.getRange(2,1,DEMO.reportManagers,5).getValues().filter(row=>row[0]&&row[4]);
  const books = rows.map(row=>({name:row[0],book:SpreadsheetApp.openByUrl(row[4])}));
  if (new Set(books.map(({book})=>book.getId())).size !== books.length) {
    throw new Error('В списке менеджеров есть повторяющиеся книги.');
  }
  books.forEach(({name,book})=>assertDemoManager(book,name));
  return {rows,books};
}

function installDemoTriggers() {
  const central = centralDemo();
  const {books} = activeRoster(central);
  central.setSpreadsheetLocale('en_US');
  for (const name of [DEMO.names.drillCopy, DEMO.names.installCopy, DEMO.names.tech]) {
    central.getSheetByName(name).hideSheet();
  }
  central.getSheetByName(DEMO.names.drillCalc).hideColumns(16);
  central.getSheetByName(DEMO.names.installCalc).hideColumns(12);
  for (const [name, rows] of [
    [DEMO.names.tech, 601], [DEMO.names.cash, DEMO.cashLimit+1],
    [DEMO.names.drillView, 304], [DEMO.names.installView, 304],
    [DEMO.names.drillCalc, 301], [DEMO.names.installCalc, 301],
    [DEMO.names.pnl, 107], [DEMO.names.ref, DEMO.refLimit],
    [DEMO.names.roster, DEMO.reportManagers+1],
  ]) ensureRows(central.getSheetByName(name), rows);
  const handlers = ['handleDemoEdit','syncDemo','refreshDemoReferences'];
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (handlers.includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('handleDemoEdit').forSpreadsheet(central).onEdit().create();
  for (const {book} of books) {
    book.setSpreadsheetLocale('en_US');
    ScriptApp.newTrigger('handleDemoEdit').forSpreadsheet(book).onEdit().create();
    for (const kind of ['drill','install']) {
      const sheet = book.getSheetByName(DEMO.names[kind]);
      ensureRows(sheet, DEMO.limit+1);
      ensureRows(book.getSheetByName(kind==='drill'?DEMO.names.drillFilter:DEMO.names.installFilter), DEMO.limit+4);
      sheet.hideColumns(kind==='drill'?16:12);
      const priceCol = kind==='drill'?'N':'J';
      sheet.getRange(priceCol+'2:'+priceCol+(DEMO.limit+1))
        .setFormulas(rangeRows(DEMO.limit,index=>[managerFormulas(kind,index+2,true)[priceCol]]));
      sheet.getRange('C2:C'+(DEMO.limit+1)).setFormulas(rangeRows(DEMO.limit,index=>[managerFormulas(kind,index+2,true).C]));
    }
    const tech = book.getSheetByName(DEMO.names.tech);
    ensureRows(tech, 301);
    ensureRows(book.getSheetByName(DEMO.names.mirror), DEMO.refLimit);
    tech.hideSheet();
    book.getSheetByName(DEMO.names.mirror).hideSheet();
    tech.getRange('A2:B2').setFormulas([['A','B'].map(column=>
      '=IMPORTRANGE("'+central.getId()+'","Лист разработчика!'+column+'2:'+column+'301")')]);
  }
  ScriptApp.newTrigger('syncDemo').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('refreshDemoReferences').timeBased().everyMinutes(30).create();
}

function ensureRows(sheet, rows) {
  const current = sheet.getMaxRows();
  if (current<rows) sheet.insertRowsAfter(current,rows-current);
}

function updateReferences(central, roster) {
  const n = DEMO.names;
  const values = central.getSheetByName(n.ref).getRange(2,1,DEMO.refLimit-1,22).getValues();
  for (const {name,book} of roster.books) {
    book.getSheetByName(n.mirror).getRange(2,1,values.length,25).setValues(mirrorRows(values,roster.rows,name));
    managerValidation(book,values);
  }
  const drill = central.getSheetByName(n.drillCalc);
  const install = central.getSheetByName(n.installCalc);
  const pipeTypes = values.map(row=>row[5]).filter(Boolean);
  const rates = values.map(row=>row[17]).filter(value=>typeof value==='number').map(String);
  if (rates.length) drill.getRange('R2:R301').setDataValidation(listValidation(rates,true));
  for (const address of ['V2:V301','Z2:Z301','AD2:AD301']) {
    drill.getRange(address).setDataValidation(listValidation(pipeTypes));
  }
  drill.getRange('AO2:AO301').setDataValidation(listValidation(DEMO.statuses));
  install.getRange('Y2:Y301').setDataValidation(listValidation(DEMO.statuses));
  const cash = central.getSheetByName(n.cash);
  cash.getRange('E2:E'+(DEMO.cashLimit+1)).setDataValidation(listValidation(values.map(row=>row[0]).filter(Boolean)));
  const custom = central.getSheetByName(n.tech).getRange(2,3,DEMO.refLimit-1,1).getValues().flat().filter(Boolean);
  cash.getRange('F2:F'+(DEMO.cashLimit+1)).setDataValidation(listValidation([...new Set([...DEMO.cashCategories,...custom])]));
  const pnl = central.getSheetByName(n.pnl);
  if (!pnl.getRange('A8').getFormula()) pnl.getRange('A8:A107').clearContent();
  pnl.getRange('A8').setFormula(
    '=IFERROR(SORT(UNIQUE(FILTER({'+refSheet(n.tech)+'C2:C80;'+refSheet(n.cash)+'F2:F1001},'+
    '{'+refSheet(n.tech)+'C2:C80;'+refSheet(n.cash)+'F2:F1001}<>"",'+
    'REGEXMATCH({'+refSheet(n.tech)+'C2:C80;'+refSheet(n.cash)+'F2:F1001},"^(Инвестиции|Монтаж|Бурение)$")=FALSE))),"")');
}

function refreshDemoReferences() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const central = centralDemo();
    updateReferences(central,activeRoster(central));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function listValidation(values, allowOther=false) {
  if (!values.length) return null;
  return SpreadsheetApp.newDataValidation().requireValueInList([...new Set(values.map(String))],true)
    .setAllowInvalid(allowOther).build();
}

function compatibleConstructions(soil, ref) {
  const column = soil==='Песок'?2:soil==='Известняк'?3:-1;
  return column<0 ? [] : ref.map(row=>row[column]).filter(Boolean);
}

function managerValidation(book,ref) {
  const n = DEMO.names;
  const drill = book.getSheetByName(n.drill);
  const install = book.getSheetByName(n.install);
  drill.getRange('H2:H101').setDataValidation(listValidation(['Песок','Известняк']));
  drill.getRange('J2:J101').setDataValidation(listValidation(ref.map(row=>row[8]).filter(Boolean)));
  install.getRange('G2:G101').setDataValidation(listValidation(ref.map(row=>row[21]).filter(Boolean)));
  const soils = drill.getRange('H2:H101').getValues();
  drill.getRange('I2:I101').setDataValidations(soils.map(([soil])=>[listValidation(compatibleConstructions(soil,ref))]));
}

function numericId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number>0 ? number : 0;
}

function planIds(orders, ledger, reservations=[]) {
  const used = new Set([...ledger.values(),...reservations].map(numericId).filter(Boolean));
  let max = Math.max(100,...used,...orders.map(order=>numericId(order.id)));
  const seen = new Set();
  return orders.map(order=>{
    if (!order.key || seen.has(order.key)) throw new Error('Повтор или отсутствие ключа обмена в строке '+order.row);
    seen.add(order.key);
    let id = ledger.get(order.key);
    if (!id) {
      id = numericId(order.id);
      if (!id || used.has(id)) id = ++max;
      used.add(id);
    }
    return {...order,id};
  });
}

function collectOrders(roster) {
  const result = [];
  for (const {book} of roster.books) {
    for (const kind of ['drill','install']) {
      const sheet = book.getSheetByName(DEMO.names[kind]);
      const width = (kind==='drill'?DRILL_HEADERS:INSTALL_HEADERS).length;
      const rows = sheet.getRange(2,1,DEMO.limit,width+1).getValues();
      for (const [index,input] of rows.entries()) {
        if (!input[1]) continue;
        const row = index+2;
        const key = input[width] || Utilities.getUuid();
        if (!input[width]) sheet.getRange(row,width+1).setValue(key);
        result.push({sheet,kind,row,width,key,id:input[0]});
      }
    }
  }
  return result;
}

function syncDemo() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const central = centralDemo();
    const roster = activeRoster(central);
    const tech = central.getSheetByName(DEMO.names.tech);
    const ledger = new Map(tech.getRange(2,8,Math.max(tech.getLastRow()-1,1),2).getValues()
      .filter(row=>row[0]).map(([key,id])=>[key,numericId(id)]));
    const reserved = central.getSheetByName(DEMO.names.cash).getRange(2,4,DEMO.cashLimit,1).getValues().flat();
    updateReferences(central,roster);
    const planned = planIds(collectOrders(roster),ledger,reserved);
    for (const kind of ['drill','install']) {
      const target = central.getSheetByName(kind==='drill'?DEMO.names.drillCalc:DEMO.names.installCalc);
      const width = (kind==='drill'?DRILL_HEADERS:INSTALL_HEADERS).length;
      const keys = target.getRange(2,width+1,300,1).getValues().flat();
      const newCount = planned.filter(order=>order.kind===kind&&!keys.includes(order.key)).length;
      if (newCount>keys.filter(key=>!key).length) throw new Error('Достигнут предел демореестра: 300 заявок одного типа.');
    }
    // Persist assignments before touching manager IDs. Retrying after an interrupted write preserves them.
    for (const order of planned) ledger.set(order.key,order.id);
    const entries = [...ledger.entries()];
    ensureRows(tech, entries.length+1);
    if (entries.length) tech.getRange(2,8,entries.length,2).setValues(entries);
    for (const order of planned) {
      if (order.sheet.getRange(order.row,order.width+1).getValue()!==order.key) {
        throw new Error('Строка заявки переместилась во время обмена. Повторите обмен.');
      }
      const idCell = order.sheet.getRange(order.row,1);
      if (numericId(idCell.getValue())!==order.id) idCell.setValue(order.id);
    }
    SpreadsheetApp.flush();
    for (const kind of ['drill','install']) {
      const target = central.getSheetByName(kind==='drill'?DEMO.names.drillCalc:DEMO.names.installCalc);
      const width = (kind==='drill'?DRILL_HEADERS:INSTALL_HEADERS).length;
      const rows = target.getRange(2,1,300,width+1).getValues();
      const byKey = new Map(rows.flatMap((row,index)=>row[width]?[[row[width],index]]:[]));
      for (const order of planned.filter(order=>order.kind===kind)) {
        const values = order.sheet.getRange(order.row,1,1,width+1).getValues()[0];
        if (values[width]!==order.key || !values[1]) {
          throw new Error('Строка заявки изменилась во время обмена. Повторите обмен.');
        }
        let index = byKey.get(order.key);
        if (index===undefined) index = rows.findIndex(row=>!row[width]);
        rows[index] = values;
      }
      target.getRange(2,1,300,width+1).setValues(rows);
      const idColumn = kind==='drill'?1:2;
      const ids = rows.filter(row=>row[0]).map(row=>row[0]);
      const padded = rangeRows(300,index=>[ids[index]||'']);
      tech.getRange(2,idColumn,300,1).setValues(padded);
      for (const {book} of roster.books) {
        const mirror = book.getSheetByName(DEMO.names.tech);
        mirror.getRange(2,idColumn+2,300,1).setValues(padded);
      }
    }
    SpreadsheetApp.flush();
    refreshViews(central);
    for (const {book} of roster.books) refreshViews(book);
  } finally {
    lock.releaseLock();
  }
}

function filterSpec(book) {
  const n = DEMO.names;
  return book.getSheetByName(n.drillCalc)
    ? [[n.drillView,n.drillCalc,'drillCalc',DRILL_CALC,300],[n.installView,n.installCalc,'installCalc',INSTALL_CALC,300]]
    : [[n.drillFilter,n.drill,'drill',DRILL_HEADERS,DEMO.limit],[n.installFilter,n.install,'install',INSTALL_HEADERS,DEMO.limit]];
}

function matchesFilters(row, controls, criteria) {
  for (const key of Object.keys(criteria)) {
    const index = Number(key);
    if (index===1) {
      const number = value => value instanceof Date ? value.getTime() : (Number(value)-25569)*86400000;
      if (controls[0][index] && number(row[index]) < number(controls[0][index])) return false;
      if (controls[1][index] && number(row[index]) > number(controls[1][index])) return false;
    } else if (controls[0][index]!=='' && String(controls[0][index])!==String(row[index])) {
      return false;
    }
  }
  return true;
}

function refreshViews(book) {
  for (const [viewName,sourceName,key,head,count] of filterSpec(book)) {
    const view = book.getSheetByName(viewName);
    const source = book.getSheetByName(sourceName);
    const controls = view.getRange(2,1,2,head.length).getValues();
    const rows = source.getRange(2,1,count,head.length).getValues().filter(row=>row[0]&&row[1]);
    const selected = rows.filter(row=>matchesFilters(row,controls,FILTERS[key]));
    const central = key.endsWith('Calc');
    const blank = key==='drillCalc'?15:11;
    if (central) selected.forEach(row=>row[blank]='');
    if (view.getLastRow()>4) view.getRange(5,1,view.getLastRow()-4,head.length).clearContent();
    if (selected.length) view.getRange(5,1,selected.length,head.length).setValues(selected);
    view.getRange('A2:A3').setValues([['С даты'],['По дату']]);
    view.getRange('B2:B3').setNumberFormat('yyyy-mm-dd');
    view.getRange('B5:B'+(count+4)).setNumberFormat('yyyy-mm-dd');
    for (const field of Object.keys(FILTERS[key]).map(Number).filter(index=>index!==1)) {
      const options = rows.map(row=>row[field]).filter(Boolean);
      view.getRange(2,field+1).setDataValidation(listValidation(options));
    }
  }
}

function handleDemoEdit(event) {
  const sheet = event.range.getSheet();
  const book = sheet.getParent();
  const name = sheet.getName();
  const n = DEMO.names;
  if (filterSpec(book).some(([view])=>view===name)) {
    if (event.range.getRow()<=3) refreshViews(book);
    return;
  }
  if (![n.drill,n.install].includes(name) || event.range.getLastRow()<2) return;
  const limit = Math.min(event.range.getLastRow(),DEMO.limit+1);
  const first = Math.max(event.range.getRow(),2);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const tech = book.getSheetByName(n.tech);
    const sourceIds = tech.getRange('A2:D301').getValues().flat();
    for (const kind of ['drill','install']) {
      sourceIds.push(...book.getSheetByName(n[kind]).getRange('A2:A101').getValues().flat());
    }
    let next = Math.max(100,...sourceIds.map(numericId));
    for (let row=first;row<=limit;row++) {
      const id = sheet.getRange(row,1);
      const width = name===n.drill?DRILL_HEADERS.length:INSTALL_HEADERS.length;
      if (sheet.getRange(row,2).getValue() && !id.getValue()) {
        const key = sheet.getRange(row,width+1);
        if (!key.getValue()) key.setValue(Utilities.getUuid());
        id.setValue(++next);
      }
      if (name===n.drill && event.range.getColumn()<=8 && event.range.getLastColumn()>=8) {
        const mirror = book.getSheetByName(n.mirror);
        const soil = sheet.getRange(row,8).getValue();
        const column = soil==='Песок'?5:soil==='Известняк'?6:0;
        const options = column ? mirror.getRange(2,column,DEMO.refLimit-1,1).getValues().flat().filter(Boolean) : [];
        const construction = sheet.getRange(row,9);
        if (construction.getValue() && !options.includes(construction.getValue())) construction.clearContent();
        construction.setDataValidation(listValidation(options));
      }
    }
    SpreadsheetApp.flush();
    refreshViews(book);
  } finally {
    lock.releaseLock();
  }
}
