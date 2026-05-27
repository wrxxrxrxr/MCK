const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, Footer, PageNumber,
  TabStopType, Header, SectionType
} = require('docx');
const fs = require('fs');

// НАСТРОЙКИ СТРАНИЦЫ
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN_TOP = 1134;
const MARGIN_RIGHT = 850;
const MARGIN_BOTTOM = 1134;
const MARGIN_LEFT = 1701;
const CONTENT_WIDTH = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;

// ХЕЛПЕРЫ ДЛЯ РАБОТЫ С ФИО 

function getInitials(firstName, patronymic) {
  let result = '';
  if (firstName && firstName.length > 0 && firstName !== 'null' && firstName !== 'undefined') {
      result += firstName.charAt(0).toUpperCase() + '.';
  }
  if (patronymic && patronymic.length > 0 && patronymic !== 'null' && patronymic !== 'undefined') {
      result += patronymic.charAt(0).toUpperCase() + '.';
  }
  return result;
}

function formatSignatureName(lastName, firstName, patronymic) {
  if (!lastName || lastName === 'null' || lastName === 'undefined' || lastName === '') {
      return '____________________';
  }
  const initials = getInitials(firstName, patronymic);
  if (initials) {
      return `${lastName} ${initials}`;
  }
  return lastName;
}

function getGenitiveLastName(lastName, firstName) {
  if (!lastName || lastName === 'null' || lastName === 'undefined' || lastName === '') {
      return '____________________';
  }
  
  const lowerLastName = lastName.toLowerCase();
  let genitiveLastName = lastName;
  
  let isFemale = false;
  if (firstName && firstName !== 'null' && firstName !== 'undefined') {
      const femaleEndings = ['а', 'я', 'ия', 'ья'];
      const firstNameLower = firstName.toLowerCase();
      isFemale = femaleEndings.some(ending => firstNameLower.endsWith(ending));
  }
  
  if (!isFemale) {
      if (lowerLastName.endsWith('ов') || lowerLastName.endsWith('ев') || 
          lowerLastName.endsWith('ин') || lowerLastName.endsWith('ын')) {
          genitiveLastName = lastName.slice(0, -1) + 'а';
      }
      else if (lowerLastName.endsWith('ий')) {
          genitiveLastName = lastName.slice(0, -2) + 'его';
      }
      else if (lowerLastName.endsWith('ой')) {
          genitiveLastName = lastName.slice(0, -2) + 'ого';
      }
      else if (lowerLastName.endsWith('ь')) {
          genitiveLastName = lastName.slice(0, -1) + 'я';
      }
      else if (lowerLastName.endsWith('ец')) {
          genitiveLastName = lastName.slice(0, -2) + 'ца';
      }
      else if (!lowerLastName.endsWith('а') && !lowerLastName.endsWith('я')) {
          genitiveLastName = lastName + 'а';
      }
  }
  
  return genitiveLastName;
}

function formatGenitiveName(lastName, firstName, patronymic, position) {
  if (!lastName || lastName === 'null' || lastName === 'undefined' || lastName === '') {
      return `${position || 'директора'} ____________________`;
  }
  
  const genitiveLastName = getGenitiveLastName(lastName, firstName);
  const initials = getInitials(firstName, patronymic);
  
  if (initials) {
      return `${position || 'директора'} ${genitiveLastName} ${initials}`;
  }
  return `${position || 'директора'} ${genitiveLastName}`;
}

function getFullName(lastName, firstName, patronymic) {
  const parts = [];
  if (lastName && lastName !== 'null' && lastName !== 'undefined' && lastName !== '') parts.push(lastName);
  if (firstName && firstName !== 'null' && firstName !== 'undefined' && firstName !== '') parts.push(firstName);
  if (patronymic && patronymic !== 'null' && patronymic !== 'undefined' && patronymic !== '') parts.push(patronymic);
  return parts.length > 0 ? parts.join(' ') : '____________________';
}

//ФУНКЦИЯ ДЛЯ ПРЕОБРАЗОВАНИЯ ЧИСЕЛ В СЛОВА 
function numberToWords(num) {
    if (!num || num === 0) return 'ноль';
    
    const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const onesFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
    const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    
    function convertThreeDigits(n, isFemale = false) {
        const wordOnes = isFemale ? onesFemale : ones;
        let result = '';
        const hundred = Math.floor(n / 100);
        if (hundred > 0) result += hundreds[hundred] + ' ';
        const remainder = n % 100;
        if (remainder >= 10 && remainder <= 19) {
            result += teens[remainder - 10] + ' ';
        } else {
            const ten = Math.floor(remainder / 10);
            if (ten > 0) result += tens[ten] + ' ';
            const one = remainder % 10;
            if (one > 0) result += wordOnes[one] + ' ';
        }
        return result.trim();
    }
    
    function getRublesWord(n) {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'рублей';
        switch (lastDigit) {
            case 1: return 'рубль';
            case 2: case 3: case 4: return 'рубля';
            default: return 'рублей';
        }
    }
    
    function getKopeksWord(n) {
        const lastDigit = n % 10;
        const lastTwoDigits = n % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'копеек';
        switch (lastDigit) {
            case 1: return 'копейка';
            case 2: case 3: case 4: return 'копейки';
            default: return 'копеек';
        }
    }
    
    const rubles = Math.floor(num);
    const kopeks = Math.round((num - rubles) * 100);
    
    let result = '';
    const millions = Math.floor(rubles / 1000000);
    const thousands = Math.floor((rubles % 1000000) / 1000);
    const rubPart = rubles % 1000;
    
    if (millions > 0) {
        result += convertThreeDigits(millions, false) + ' ';
        const lastDigit = millions % 10;
        const lastTwoDigits = millions % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) result += 'миллионов ';
        else if (lastDigit === 1) result += 'миллион ';
        else if (lastDigit >= 2 && lastDigit <= 4) result += 'миллиона ';
        else result += 'миллионов ';
    }
    
    if (thousands > 0) {
        result += convertThreeDigits(thousands, true) + ' ';
        const lastDigit = thousands % 10;
        const lastTwoDigits = thousands % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) result += 'тысяч ';
        else if (lastDigit === 1) result += 'тысяча ';
        else if (lastDigit >= 2 && lastDigit <= 4) result += 'тысячи ';
        else result += 'тысяч ';
    }
    
    if (rubPart > 0) {
        result += convertThreeDigits(rubPart, false) + ' ';
        result += getRublesWord(rubPart) + ' ';
    } else {
        result += 'ноль рублей ';
    }
    
    if (kopeks > 0) {
        result += kopeks + ' ';
        result += getKopeksWord(kopeks);
    } else {
        result += '00 копеек';
    }
    
    return result.trim().replace(/\s+/g, ' ');
}

//ОБЩИЕ ХЕЛПЕРЫ 

const FONT = "Times New Roman";
const FONT_SIZE = 24;
const FONT_SIZE_SM = 23;

const noBorder = { style: BorderStyle.NIL, size: 0, color: "auto" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function run(text, opts = {}) {
  return new TextRun({
      text,
      font: FONT,
      size: opts.size || FONT_SIZE,
      bold: opts.bold || false,
      color: opts.color || "000000",
      smallCaps: opts.smallCaps || false,
      highlight: opts.highlight || undefined,
  });
}

function para(children, opts = {}) {
  if (typeof children === 'string') {
      children = [run(children, { bold: opts.bold, size: opts.size })];
  }
  return new Paragraph({
      alignment: opts.align || AlignmentType.JUSTIFIED,
      indent: opts.indent ? { firstLine: opts.indent } : (opts.hanging ? { hanging: opts.hanging, left: opts.left } : {}),
      spacing: { after: 0, line: 240, lineRule: "auto" },
      children,
      widowControl: false,
  });
}

function emptyPara() {
  return new Paragraph({
      spacing: { after: 0, line: 240, lineRule: "auto" },
      children: [],
  });
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 851 },
      spacing: { after: 0, line: 240, lineRule: "auto" },
      widowControl: false,
      children: [run(text, { size: opts.size || FONT_SIZE, bold: opts.bold })],
  });
}

function listPara(text, leftIndent = 851) {
  return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: leftIndent },
      spacing: { after: 0, line: 240, lineRule: "auto" },
      widowControl: false,
      children: [run(text)],
  });
}

function sectionHeader(text) {
  return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 0, line: 240, lineRule: "auto" },
      widowControl: false,
      children: [run(text, { bold: true })],
  });
}

function makeFooter() {
  return new Footer({
      children: [
          new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 0, line: 240, lineRule: "auto" },
              children: [new TextRun({ children: [PageNumber.CURRENT], color: "000000" })],
          }),
          new Paragraph({
              spacing: { after: 0, line: 240, lineRule: "auto" },
              tabStops: [
                  { type: TabStopType.CENTER, position: Math.floor(CONTENT_WIDTH / 2) },
                  { type: TabStopType.RIGHT, position: CONTENT_WIDTH },
              ],
              children: [
                  new TextRun({ text: "Заказчик______________", font: FONT, color: "000000" }),
                  new TextRun({ text: "\t\t", font: FONT, color: "000000" }),
                  new TextRun({ text: "Подрядчик______________", font: FONT, color: "000000" }),
              ],
          }),
      ]
  });
}

function makeRequisitesTable(d) {
  const colW = Math.floor(CONTENT_WIDTH / 2);
  
  function createCell(lines, width) {
      return new TableCell({
          width: { size: width, type: WidthType.DXA },
          borders: noBorders,
          children: lines.map(line => new Paragraph({
              spacing: { after: 0, line: 240, lineRule: "auto" },
              children: [run(line.text, { bold: line.bold || false, size: line.size || FONT_SIZE_SM })],
          }))
      });
  }
  
  const directorSignature = formatSignatureName(
      d.clientDirectorLastName,
      d.clientDirectorFirstName,
      d.clientDirectorPatronymic
  );
  
  const contractorLines = [
      { text: "ПОДРЯДЧИК:", bold: true },
      { text: "" },
      { text: d.contractorName, bold: true },
      { text: "Адрес: " + (d.contractorAddress || '220113, г. Минск, ул. Мележа, д. 4') },
      { text: "УНП: " + (d.contractorUNP || '193607959') },
      { text: "Текущий (расчетный): " + (d.contractorBank || 'BY91ALFA30122B38250010270000 в BYN') },
      { text: "в " + (d.contractorBankName || 'ЗАО «Альфа-Банк»') + ", БИК: " + (d.contractorBankBIC || 'ALFABY2X') },
      { text: d.contractorBankAddress || '220013, г. Минск, ул. Сурганова, 43-47' },
      { text: "E-mail: " + (d.contractorEmail || 'MCK-Reliable@yandex.ru') },
      { text: "тел.: " + (d.contractorPhone || '+375444543857') },
      { text: "" },
      { text: "Директор ___________ " + (d.contractorDirectorShort || 'В.И. Хурс') },
  ];
  
  const clientLines = [
      { text: "ЗАКАЗЧИК:", bold: true },
      { text: "" },
      { text: d.clientName || d.clientCompanyFull || '____________________', bold: true },
      { text: "УНП: " + (d.clientUNP || '____') + (d.clientOKPO ? "; ОКПО: " + d.clientOKPO : "") },
      { text: d.clientAddress || d.legalAddress || '____________________' },
      { text: d.clientBank || '____________________' },
      { text: "в " + (d.clientBankName || '____________________') + ", БИК: " + (d.clientBankBIC || '____') },
      { text: "E-mail: " + (d.clientEmail || '') },
      { text: "тел.: " + (d.clientPhone || '') + (d.clientFax ? ", факс: " + d.clientFax : "") },
      { text: "" },
      { text: `${d.clientDirectorPosition || 'Директор'} ___________ ${directorSignature}` },
  ];
  
  return new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [colW, CONTENT_WIDTH - colW],
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [
          new TableRow({
              children: [
                  createCell(contractorLines, colW),
                  createCell(clientLines, CONTENT_WIDTH - colW),
              ]
          })
      ]
  });
}

function makeWorksTable(works) {
  const cols = [500, 4000, 1200, 1700, 1855];
  const headers = ['№', 'Наименование работ', 'Кол-во', 'Цена (BYN)', 'Сумма (BYN)'];
  const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const borders = { top: border, bottom: border, left: border, right: border };

  function hCell(text, w) {
      return new TableCell({
          width: { size: w, type: WidthType.DXA },
          borders,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
              spacing: { after: 0, line: 240, lineRule: "auto" },
              alignment: AlignmentType.CENTER,
              children: [run(text, { bold: true, size: FONT_SIZE_SM })],
          })]
      });
  }

  function dCell(text, w, align) {
      return new TableCell({
          width: { size: w, type: WidthType.DXA },
          borders,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
              spacing: { after: 0, line: 240, lineRule: "auto" },
              alignment: align || AlignmentType.LEFT,
              children: [run(text, { size: FONT_SIZE_SM })],
          })]
      });
  }

  const rows = [
      new TableRow({ children: headers.map((h, i) => hCell(h, cols[i])) }),
      ...(works || []).map((w, idx) =>
          new TableRow({
              children: [
                  dCell(String(idx + 1), cols[0], AlignmentType.CENTER),
                  dCell(w.name || '', cols[1]),
                  dCell(w.quantity || '0', cols[2], AlignmentType.CENTER),
                  dCell(w.unitCost || '0,00', cols[3], AlignmentType.RIGHT),
                  dCell(w.total || '0,00', cols[4], AlignmentType.RIGHT),
              ]
          })
      )
  ];

  if (works && works.length > 0) {
      const totalSum = works.reduce((sum, w) => sum + (parseFloat((w.total || '0').replace(/,/g, '')) || 0), 0);
      rows.push(new TableRow({
          children: [
              dCell('', cols[0]),
              dCell('ИТОГО:', cols[1], AlignmentType.RIGHT),
              dCell('', cols[2]),
              dCell('', cols[3]),
              dCell(totalSum.toLocaleString('ru', { minimumFractionDigits: 2 }), cols[4], AlignmentType.RIGHT),
          ]
      }));
  }

  return new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: cols,
      rows,
  });
}

function buildContractContent(d) {
  const children = [];
  
  const directorGenitive = formatGenitiveName(
      d.clientDirectorLastName,
      d.clientDirectorFirstName,
      d.clientDirectorPatronymic,
      d.clientDirectorPosition || 'директора'
  );
  
  // Заголовок
  children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0, line: 240, lineRule: "auto" },
      children: [
          run("ДОГОВОР СТРОИТЕЛЬНОГО ПОДРЯДА ", { smallCaps: true, size: FONT_SIZE }),
          run("№" + (d.contractNumber || '______'), { size: FONT_SIZE }),
      ]
  }));
  children.push(emptyPara());
  
  // Город + Дата
  children.push(new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [4670, CONTENT_WIDTH - 4670],
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [
          new TableRow({
              children: [
                  new TableCell({
                      width: { size: 4670, type: WidthType.DXA },
                      borders: noBorders,
                      children: [new Paragraph({
                          spacing: { after: 0, line: 240, lineRule: "auto" },
                          children: [run("г. " + (d.city || 'Минск'), { bold: false })],
                      })]
                  }),
                  new TableCell({
                      width: { size: CONTENT_WIDTH - 4670, type: WidthType.DXA },
                      borders: noBorders,
                      children: [new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          spacing: { after: 0, line: 240, lineRule: "auto" },
                          children: [run(`«${d.day || '__'}» ${d.month || '________'} ${d.year || '____'}\u00a0г.`)],
                      })]
                  }),
              ]
          })
      ]
  }));
  children.push(emptyPara());
  children.push(emptyPara());
  
  // Преамбула
  children.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 851 },
      spacing: { after: 0, line: 240, lineRule: "auto" },
      widowControl: false,
      children: [
          run((d.clientCompanyFull || d.clientName || '____________________') + 
              ", именуемое в дальнейшем «Заказчик», в лице " + directorGenitive +
              ", действующего на основании " + (d.clientAuthorityDoc || 'Устава') +
              ", с одной стороны, и Общество с ограниченной ответственностью «МСК Релайбл», именуемое в дальнейшем «Подрядчик», в лице директора Хурс В.И., действующего на основании Устава, с другой стороны, совместно именуемые в дальнейшем «Стороны», в соответствии с Гражданским кодексом Республики Беларусь, Законом Республики Беларусь от 05.07.2004\u00a0г.\u00a0№\u00a0300-З «Об архитектурной, градостроительной и строительной деятельности в Республике Беларусь», Правилами заключения и исполнения договоров строительного подряда (в дальнейшем – «Правила»), утвержденными Постановлением Совета Министров Республики Беларусь от 15.09.1998\u00a0г.\u00a0№\u00a01450 (с изменениями и дополнениями), заключили настоящий договор (далее – Договор) о нижеследующем:",
            { bold: true })
      ],
  }));
  children.push(emptyPara());
  
  // 1
  children.push(sectionHeader("1. ПРЕДМЕТ ДОГОВОРА"));
  children.push(bodyPara(`1.1. Подрядчик обязуется своими силами выполнить комплекс строительно-монтажных работ (далее - Работ) на объекте: «${d.objectName || '____________________'}» (далее – Объект) в соответствии с проектной документацией и Ведомостью объемов и стоимости работ (Приложение №1), являющимися неотъемлемой частью настоящего Договора, и сдать их Заказчику, а Заказчик обязуется создать Подрядчику необходимые условия для выполнения работ, принять результаты работ и уплатить обусловленную Договором цену.`));
  children.push(bodyPara("1.2. Наименования работ, подлежащих выполнению по настоящему Договору, их объемы, стоимость и график производства работ содержатся в приложениях: "));
  children.push(listPara("Приложение №1 Ведомость объемов и стоимости работ; "));
  children.push(listPara("Приложение №2 Протокол согласования договорной цены; "));
  children.push(listPara("Приложение №3 График строительства (производства работ); "));
  children.push(listPara("Приложение №4 График платежей при строительстве (выполнении работ)."));
  children.push(bodyPara("Указанные приложения являются неотъемлемыми частями настоящего Договора."));
  children.push(bodyPara(`1.3. Объект – объект строительства «${d.objectName || '____________________'}».`));
  children.push(bodyPara("1.4. Работы должны быть выполнены в соответствии с разрешительной документацией, проектной документацией, Договором и его приложениями, действующим законодательством Республики Беларусь, в том числе ТНПА, действующими в Республике Беларусь на момент выполнения работ."));
  children.push(emptyPara());
  
  //2
  children.push(sectionHeader("2. СРОКИ И ПОРЯДОК ВЫПОЛНЕНИЯ РАБОТ"));
  children.push(bodyPara("2.1. Сроки выполнения Работ, предусмотренных в п. 1.1. Договора:"));
  children.push(listPara(`начало выполнения Работ – ${d.startDate || '________'} года`));
  children.push(listPara(`окончание выполнения Работ – ${d.endDate || '________'} года`));
  children.push(bodyPara("2.2. Сроки выполнения строительно-монтажных Работ (как начальный, так и конечный) могут изменяться Сторонами в случаях:"));
  children.push(listPara("нарушения Заказчиком установленных договором сроков передачи проектной документации;"));
  children.push(listPara("существенного нарушения установленного договором порядка расчетов (Графика финансирования, приложение № 4);"));
  children.push(listPara("несвоевременной передачи Подрядчику фронта работ;"));
  children.push(listPara("по письменному соглашению Сторон;"));
  children.push(listPara("выявления в ходе выполнения строительно-монтажных Работ, дополнительных объемов строительных работ, не предусмотренных проектной документацией и влияющих на своевременное исполнение подрядчиком своих договорных обязательств;"));
  children.push(listPara("вследствие обстоятельств непреодолимой силы."));
  children.push(bodyPara("2.3. Срок строительства продлевается по соглашению сторон в установленном настоящем порядке и Правилами с учетом продолжительности действия обстоятельств, препятствующих исполнению обязательств по договору, путем подписания дополнительного соглашения к Договору."));
  children.push(bodyPara("2.4. Сроки выполнения Работ по договору не продлеваются в случае вины Подрядчика в приостановлении Работ, а также в иных случаях, предусмотренных настоящим Договором. Все затраты, связанные с приостановкой строительства по указанному основанию, относятся на результаты хозяйственной и финансовой деятельности Подрядчика и Заказчиком не компенсируются."));
  children.push(bodyPara("К приостановлению Работ по вине Подрядчика относятся в том числе: запрещение (приостановление) работ на Объекте по решению органов (организаций) или лиц, осуществляющих технический, авторский, санитарно-эпидемиологический, экологический надзор, другие виды контроля за строительством с оформлением соответствующих предписаний, актов и иных документов в которых будет указана вина Подрядчика, а также неисполнение (несвоевременное исполнение) Подрядчиком своих обязательств по Договору и (или) договорами с третьими лицами, которые привели к приостановке работ на Объекте."));
  children.push(bodyPara("2.5. Подрядчик выполняет Работы собственными силами без привлечения субподрядчиков."));
  children.push(bodyPara("2.6. Основанием для заключения Договора является наличие следующих документов у Подрядчика:"));
  children.push(listPara("– документов, подтверждающих право Подрядчика на осуществление строительной деятельности в соответствии с требованиями законодательства;"));
  children.push(listPara("– документов, подтверждающих наличие в штате аттестованных специалистов для выполнения работ собственными силами Подрядчика."));
  children.push(bodyPara("2.7. Для решения текущих вопросов, возникающих в ходе выполнения Работ, предусмотренных настоящим Договором, и строительства Объекта, Стороны вправе проводить производственные совещания с участием участвующих в строительстве лиц, результаты совещаний оформляются протоколом и являются обязательными для исполнения Сторонами настоящего Договора и всеми участниками строительства Объекта."));
  children.push(bodyPara("2.8. Представителями Сторон при исполнении настоящего Договора признаются должностные лица органов управления, лица, уполномоченные доверенностью."));
  children.push(emptyPara());
  
  // 3
  children.push(sectionHeader("3. ЦЕНА ДОГОВОРА"));
  
  let vatAmountWords = d.vatAmountWords;
  if (!vatAmountWords && d.vatAmount) {
      const vatNum = parseFloat(String(d.vatAmount).replace(/,/g, '.'));
      if (!isNaN(vatNum)) {
          vatAmountWords = numberToWords(vatNum);
      }
  }
  if (!vatAmountWords) vatAmountWords = '________________________________________________';
  
  children.push(bodyPara(`3.1. Цена Договора определена по соглашению Сторон в соответствии с Протоколом согласования договорной цены (Приложение №2) и Графиком строительства (производства работ) (Приложение 3). Цена договора включает в себя стоимость всего комплекса строительных работ согласно ведомости объемов и стоимости работ, включая все необходимые сопутствующие работы для получения результата, соответствующего требованиям технических нормативных актов и проектной документации; материалов; транспорта; эксплуатации машин и механизмов и иных затрат Подрядчика и составляет ${d.totalCost || '0,00'} (${d.totalCostWords || '________________________________________________'}) с учетом НДС ${d.vatRate || '20'}% - ${d.vatAmount || '0,00'} (${vatAmountWords}).`));
  children.push(bodyPara("   Цена Договора покрывает все расходы Подрядчика, необходимые для нормального функционирования и полного завершения строительных работ на Объекте, получения конечного продукта (результата работ), в том числе стоимость материальных ресурсов, затраты на транспортировку, а также пошлины, сборы, налоги."));
  children.push(bodyPara("3.2. Цена договора, отраженная в протоколе согласования договорной цены, является неизменной до завершения выполнения работ и может быть изменена только в случаях:"));
  children.push(listPara("3.2.1. изменения по инициативе Заказчика проектной документации, за исключением ее изменения по причине возникновения дополнительных работ; "));
  children.push(listPara("3.2.2. налогового законодательства в части установления и (или) отмены налогов и отчислений в доходы соответствующих бюджетов, которые влияют на формирование неизменной цены Договора, изменения налоговых ставок и объектов налогообложения, установления и (или) отмены налоговых льгот;"));
  children.push(listPara("3.2.3. нормативных правовых актов, регулирующих отношения в сфере ценообразования в строительстве;"));
  children.push(listPara("3.2.4. полного или частичного отказа Заказчика от выполнения Работ с письменным уведомлением Подрядчика за 5 (пять) календарных дней до момента начала выполнения конкретных видов работ;"));
  children.push(listPara("3.2.5. выявления в ходе строительства дополнительных объемов работ, не предусмотренных проектной документацией."));
  children.push(bodyPara("3.3. Стоимость работ, не предусмотренных настоящим Договором, выявленных Подрядчиком и необходимых для выполнения (дополнительные работы), не входит в цену настоящего Договора и подлежит оплате при условии предварительного согласования Сторонами необходимости их выполнения и их стоимости. Согласование необходимости выполнения дополнительных работ и их стоимости производится путем подписания уполномоченными представителями Подрядчика и Заказчика Акта на дополнительные работы и прилагаемой к нему сметы."));
  children.push(bodyPara("   Расчет стоимости дополнительных работ производится по Базе нормативов расхода ресурсов в натуральном выражении 2022 года (далее – НРР 2022г.) на основании Методических указаний по применению нормативов расхода ресурсов в натуральном выражении (НРР 8.01.104-2022)."));
  children.push(bodyPara("3.4. Изменение цены Договора оформляется путем подписания дополнительного соглашения к Договору."));
  children.push(bodyPara("3.5. Источник финансирования – собственные средства Заказчика."));
  children.push(bodyPara("3.6. Все расчеты по Договору осуществляются в белорусских рублях."));
  children.push(bodyPara("3.7. При срыве по вине Подрядчика срока строительства Объекта (выполнения строительных работ), установленного Договором, строительные работы, выполненные после указанного срока, оплачиваются по ценам, действовавшим на установленную Договором дату их завершения."));
  children.push(emptyPara());
  
  // 4
  children.push(sectionHeader("4. ПОРЯДОК РАСЧЕТОВ"));
  children.push(bodyPara("4.1. Заказчик производит платежи Подрядчику в соответствии с Графиком платежей (Приложение №4)."));
  children.push(bodyPara("4.2. Оплату за выполненные работы по настоящему Договору Заказчик производит в течение 10 (десяти) календарных дней с даты приемки выполненных этапов работ на основании справки о стоимости выполненных работ (форма С-3а) и акта сдачи-приемки выполненных работ (форма С-2б)."));
  children.push(bodyPara("   Справки по форме С-3а, акты по форме С-2б и иные документы должны соответствовать формам, утвержденным Министерством архитектуры и строительства Республики Беларусь."));
  children.push(bodyPara("4.3. Оплата за материалы производится Заказчиком путём перечисления денежных средств в течении 5 (пяти) календарных дней после предоставления акта на основании товарно-транспортных накладных за недельный период с обязательным нахождением материалов на объекте."));
  children.push(bodyPara("4.4. Подрядчик обязан предоставить надлежащим образом оформленные акт сдачи-приемки выполненных работ и справку о стоимости выполненных работ не позднее 3 (трех) рабочих дней по окончании отчетного периода. Заказчик обязан в течение 3 (трёх) рабочих дней рассмотреть предоставленные Подрядчиком акт сдачи-приемки выполненных работ и справку о стоимости выполненных работ, подписать их и заверить печатью."));
  children.push(bodyPara("4.5. Одновременно с актом сдачи-приемки работ Подрядчик обязан передать Заказчику следующую документацию:"));
  children.push(listPara("– надлежащим образом оформленную ведомость израсходованных материалов на производство работ в отчетном периоде;"));
  children.push(listPara("– надлежащим образом оформленную ведомость смонтированного оборудования за расчетный период;"));
  children.push(listPara("– исполнительную документацию, предусмотренную ТНПА;"));
  children.push(listPara("– копии сертификатов соответствия, паспорта, акты испытаний и иные документы на материалы, оборудование, конструкции и комплектующие изделия;"));
  children.push(listPara("– иные документы и документацию, имеющие отношение к выполнению работ."));
  children.push(bodyPara("4.6. За расчетный период принимается календарный месяц."));
  children.push(bodyPara("4.7. При отказе одной из Сторон от подписания акта сдачи-приемки работ в нем делается отметка об этом с указанием мотивов отказа, и акт подписывается другой Стороной."));
  children.push(emptyPara());
  
  // 5
  children.push(sectionHeader("5. ОБЕСПЕЧЕНИЕ СТРОИТЕЛЬСТВА ПРОЕКТНОЙ ДОКУМЕНТАЦИЕЙ"));
  children.push(bodyPara("5.1. Заказчик обязан до начала выполнения строительно-монтажных работ, но не позднее трёх рабочих дней до начала работ передать полный комплект проектной документации в трёх экземплярах Подрядчику со штампом «к производству работ»."));
  children.push(bodyPara("5.2. Заказчик, при внесении в проектную документацию изменений, обязан в течении трёх рабочих дней передать Подрядчику не менее 3 (трёх) экземпляров измененной документации."));
  children.push(emptyPara());
  
  // 6
  children.push(sectionHeader("6. ПРАВА И ОБЯЗАННОСТИ СТОРОН"));
  children.push(bodyPara("6.1. Заказчик обязуется:"));
  ["6.1.1. надлежащим образом исполнять условия Договора;",
   "6.1.2. предоставить Подрядчику по двухстороннему акту строительную площадку (фронт работ) до начала производства работ;",
   "6.1.3. обеспечивать финансирование работ, принимать и своевременно оплачивать в установленном порядке надлежащим образом и качественно выполненные работы;",
   "6.1.4. незамедлительно письменно уведомлять Подрядчика о работах ненадлежащего качества и отступлениях от условий заключенного Договора;",
   "6.1.5. в пределах своей компетенции содействовать Подрядчику в выполнении работ, принимать меры по устранению препятствий в исполнении Договора;",
   "6.1.6. выплачивать неустойку Подрядчику, предусмотренную настоящим Договором, в случае неисполнения или ненадлежащего исполнения своих обязательств;",
   "6.1.7. обеспечить производство строительно-монтажных работ электрической энергией, водоснабжением и иными коммунальными услугами;",
   "6.1.8. принимать в установленном порядке надлежащим образом и качественно выполненные строительные работы;",
   "6.1.9. при выявлении работ ненадлежащего качества в период гарантийного срока оформить дефектный акт на гарантийный ремонт по форме С-23;",
   "6.1.10. назначить приказом из числа своих сотрудников ответственного исполнителя для подписания актов выполненных работ и исполнительной документации."
  ].forEach(t => children.push(listPara(t)));

  children.push(bodyPara("6.2. Заказчик имеет право:"));
  ["6.2.1. инициировать внесение изменений в Договор, требовать его расторжения в случаях, предусмотренных законодательством;",
   "6.2.2. осуществлять контроль и технический надзор за ходом и качеством выполняемых работ, соблюдением сроков их выполнения;",
   "6.2.3. посещать Объект в течение всего периода выполнения работ и знакомиться с ходом выполнения работ;",
   "6.2.4. требовать от Подрядчика информацию о ходе производства работ, о намечаемых конкретных датах завершения работ;",
   "6.2.5. требовать за счет Подрядчика устранения результата работ ненадлежащего качества;",
   "6.2.6. отказаться от принятия результата Работ в случае выявления Работ ненадлежащего качества;",
   "6.2.7. взыскать с Подрядчика неустойку в случае нарушения настоящего Договора Подрядчиком."
  ].forEach(t => children.push(listPara(t)));

  children.push(bodyPara("6.3. Подрядчик обязуется:"));
  ["6.3.1. исполнять условия Договора;",
   "6.3.2. выполнять Работы в соответствии с требованиями нормативных правовых актов, в том числе технических нормативных правовых актов;",
   "6.3.3. выполнять Работы в определенные Договором сроки;",
   "6.3.4. обеспечить поставку на Объект материалов, изделий, необходимых для выполнения работ;",
   "6.3.5. экономно использовать строительные материалы;",
   "6.3.6. обеспечивать надлежащее и безопасное складирование материалов, регулярную уборку помещения от строительных отходов и мусора;",
   "6.3.7. информировать Заказчика о ходе исполнения обязательств по Договору;",
   "6.3.8. своевременно устранять за свой счет результат Работ ненадлежащего качества;",
   "6.3.9. своевременно сообщать Заказчику о необходимости выполнения дополнительных Работ, непредусмотренных проектной документацией;",
   "6.3.10. передать Заказчику результат Работ в срок, предусмотренный п. 2.1 настоящего Договора;",
   "6.3.11. принимать необходимые меры по устранению обстоятельств, препятствующих надлежащему исполнению Договора;",
   "6.3.12. возмещать Заказчику расходы за потребленную электроэнергию и воду на основании показаний счетчиков;",
   "6.3.13. соблюдать действующее законодательство, регулирующее вопросы охраны труда, техники безопасности, производственной санитарии, пожарной безопасности;",
   "6.3.14. передать Заказчику исполнительную документацию не позднее 10 (десяти) календарных дней до приемки Объекта в эксплуатацию;",
   "6.3.15. по завершении работ освободить строительную площадку от строительных отходов, мусора, строительных машин и оборудования."
  ].forEach(t => children.push(listPara(t)));

  children.push(bodyPara("6.4. Подрядчик вправе:"));
  ["6.4.1. получать плату за выполненные Работы в соответствии с Договором;",
   "6.4.2. приостанавливать выполнение Работ в случае неисполнения Заказчиком своих обязательств по Договору;",
   "6.4.3. инициировать внесение изменений в Договор, требовать его расторжения в случаях, предусмотренных Договором и законодательством;",
   "6.4.4. выполнять дополнительные работы при условии согласования их с Заказчиком;",
   "6.4.5. взыскать с Заказчика неустойку в случае нарушения настоящего Договора Заказчиком."
  ].forEach(t => children.push(listPara(t)));
  children.push(emptyPara());
  
  // 7
  children.push(sectionHeader("7. ПОРЯДОК СДАЧИ-ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ"));
  children.push(bodyPara("7.1. Приемка в эксплуатацию Объекта осуществляется в соответствии с Положением о порядке приемки в эксплуатацию объектов строительства, утвержденным Постановлением Совета Министров Республики Беларусь от 06.06.2011 № 716."));
  children.push(bodyPara("7.2. Заказчик, получивший сообщение Подрядчика о готовности к сдаче выполненных строительных работ, обязан в течение 5 (пяти) рабочих дней принять выполненные Работы либо отказаться от их приемки."));
  children.push(bodyPara("   При отказе одной из Сторон от подписания акта сдачи-приемки работ в нем делается отметка об этом с указанием мотивов отказа и акт подписывается другой Стороной."));
  children.push(bodyPara("7.3. Риск случайной гибели или случайного повреждения результата выполненных работ до его приемки в установленном порядке Заказчиком несет Подрядчик."));
  children.push(emptyPara());
  
  // 8
  children.push(sectionHeader("8. ГАРАНТИЙНЫЕ ОБЯЗАТЕЛЬСТВА"));
  children.push(bodyPara("8.1. Гарантийный срок на выполненные работы составляет 5 (пять) лет, за исключением технологического, инженерного, сантехнического, электротехнического и другого оборудования, материалов и изделий, гарантийный срок на которые устанавливается законодательством или изготовителем."));
  children.push(bodyPara("8.2. Исчисление гарантийного срока начинается со дня приёмки Заказчиком всего объема выполненных Работ по настоящему Договору."));
  children.push(bodyPara("8.3. Дефекты, выявленные в период гарантийного срока на выполненные Работы, устраняются за счет Подрядчика."));
  children.push(bodyPara("8.4. Выявленные дефекты должны быть устранены Подрядчиком в срок, согласованный с Заказчиком. В случаях не устранения Подрядчиком ненадлежащего качества работ в указанный срок, Заказчик вправе привлекать для устранения выявленных недостатков третьих лиц с отнесением стоимости выполненных ими работ на счет Подрядчика."));
  children.push(bodyPara("8.5. Исчисление гарантийного срока на выполненные работы прерывается на все время, на протяжении которого Объект не мог эксплуатироваться вследствие недостатков, за которые несет ответственность Подрядчик."));
  children.push(bodyPara("8.6. Подрядчик не несет ответственности за обнаруженные в пределах гарантийного срока дефекты, если он докажет, что они произошли вследствие нормативного износа объекта, неправильной его эксплуатации, повреждения третьими лицами."));
  children.push(emptyPara());
  
  // 9
  children.push(sectionHeader("9. ОТВЕТСТВЕННОСТЬ СТОРОН"));
  children.push(bodyPara("9.1. Заказчик несет ответственность:"));
  children.push(listPara("9.1.1. за необоснованное уклонение от приемки выполненных работ – 0,2% от стоимости непринятых работ за каждый день просрочки, но не более стоимости этих работ;"));
  children.push(listPara("9.1.2. за несвоевременное проведение расчетов за выполненные и принятые в установленном порядке работы – 0,2% не перечисленной суммы за каждый день просрочки платежа, но не более этой суммы."));
  children.push(bodyPara("9.2. Подрядчик несет ответственность за неисполнение или ненадлежащее исполнение обязательств, предусмотренных настоящим Договором, и уплачивает неустойку (пеню) Заказчику:"));
  children.push(listPara("9.2.1. за нарушение установленных в договоре сроков выполнения работ – 1% стоимости невыполненных работ за каждый день просрочки;"));
  children.push(listPara("9.2.2. за превышение по своей вине сроков передачи результата работ – 1% стоимости результата работ за каждый день просрочки;"));
  children.push(listPara("9.2.3. за несвоевременное устранение дефектов – 2% стоимости работ по устранению дефектов за каждый день просрочки, начиная со дня окончания указанного в дефектном акте срока."));
  children.push(bodyPara("9.3. Подрядчик несет ответственность за несоблюдение норм техники безопасности, пожарной безопасности, производственной санитарии, охраны труда."));
  children.push(bodyPara("9.4. Подрядчик, нарушивший настоящий Договор, возмещает Заказчику все убытки, причиненные вследствие нарушения Договора, не покрытые неустойкой."));
  children.push(bodyPara("9.5. Окончание срока действия настоящего Договора не освобождает Стороны от ответственности за его нарушение."));
  children.push(emptyPara());
  
  // 10
  children.push(sectionHeader("10. ОБЕСПЕЧЕНИЕ ИСПОЛНЕНИЯ ОБЯЗАТЕЛЬСТВ ПОДРЯДЧИКОМ"));
  children.push(bodyPara("10.1. В целях обеспечения исполнения своих обязательств по устранению результата строительных работ ненадлежащего качества Заказчик удерживает у Подрядчика обеспечение в виде удержания 1 (одного) процента от выполненных работ в каждом отчётном периоде."));
  children.push(bodyPara("10.2. Возврат Подрядчику обеспечения производится в следующем порядке: 50 (пятьдесят) процентов зарезервированных средств выплачиваются спустя год после завершения работ, оставшиеся 50 (пятьдесят) процентов ежегодно равными долями до истечения гарантийного срока."));
  children.push(bodyPara("10.3. Исчисление срока резервирования средств начинается с первого дня гарантийного срока эксплуатации Объекта."));
  children.push(emptyPara());
  
  // 11
  children.push(sectionHeader("11. ФОРС-МАЖОРНЫЕ ОБСТОЯТЕЛЬСТВА"));
  children.push(bodyPara("11.1. Ни одна из Сторон не несет ответственности за полное и частичное неисполнение любой из своих обязанностей, если неисполнение является следствием обстоятельств непреодолимой силы (чрезвычайных и непредотвратимых при данных условиях обстоятельств: война, гражданская война, стихийные бедствия, забастовки и другие обстоятельства непреодолимой силы), возникших после заключения Договора."));
  children.push(bodyPara("11.2. Если любое из таких обстоятельств непосредственно повлияло на исполнение обязательств в срок, установленный в Договоре, то этот срок соразмерно отодвигается на время действия соответствующих обстоятельств."));
  children.push(bodyPara("11.3. Сторона, для которой создалась невозможность исполнения обязательства, обязана уведомить в письменной форме другую Сторону о наступлении форс-мажорных обстоятельств не позднее 5 (пяти) дней с момента их наступления."));
  children.push(bodyPara("11.4. Факты, изложенные в уведомлении, должны быть подтверждены Белорусской торгово-промышленной палатой."));
  children.push(emptyPara());
  
  // 12
  children.push(sectionHeader("12. ИЗМЕНЕНИЕ И РАСТОРЖЕНИЕ ДОГОВОРА, РАЗРЕШЕНИЕ СПОРОВ"));
  children.push(bodyPara("12.1. Изменения и дополнения в настоящий договор вносятся путём заключения Сторонами дополнительного соглашения в порядке, установленном пунктом 74 Правил."));
  children.push(bodyPara("12.2. Настоящий договор может быть расторгнут в случаях, предусмотренных пунктом 76 Правил."));
  children.push(bodyPara("12.3. Оформление расторжения договора осуществляется в порядке, предусмотренном пунктами 77-78 Правил."));
  children.push(bodyPara("12.4. Сторона вправе отказаться от исполнения договора в случаях, предусмотренных пунктом 79 Правил."));
  children.push(emptyPara());
  
  // 13
  children.push(sectionHeader("13. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ"));
  children.push(bodyPara("13.1. Настоящий Договор, Приложения к нему составлены в 2 (двух) экземплярах, имеющих одинаковую юридическую силу, по одному экземпляру для каждой Стороны."));
  children.push(bodyPara("13.2. Все Приложения к Договору являются его неотъемлемыми частями. При расхождении условий настоящего Договора с условиями, содержащимися в Приложениях к нему, приоритет имеют условия Договора."));
  children.push(bodyPara("13.3. Договор вступает в силу с даты его подписания Сторонами и действует до полного исполнения Сторонами всех своих обязательств."));
  children.push(bodyPara("13.4. Каждая из Сторон обязана в течение 3 (трех) рабочих дней известить другую Сторону об изменении банковских реквизитов, почтового, юридического адресов, иных событиях, влияющих на исполнение своих обязательств по Договору."));
  children.push(bodyPara("13.5. Приложения к Договору:"));
  children.push(listPara("Приложение 1. Ведомость объемов и стоимости работ;"));
  children.push(listPara("Приложение 2. Протокол согласования договорной цены;"));
  children.push(listPara("Приложение 3. График строительства (производства работ);"));
  children.push(listPara("Приложение 4. График платежей при строительстве (выполнении работ);"));
  children.push(listPara("Приложение 5. Аттестат соответствия на выполняемые работы."));
  children.push(emptyPara());
  
  // 14
  children.push(sectionHeader("14. АДРЕСА, РЕКВИЗИТЫ И ПОДПИСИ СТОРОН"));
  children.push(emptyPara());
  children.push(makeRequisitesTable(d));
  children.push(emptyPara());
  

  
  return children;
}

const contractData = JSON.parse(process.argv[2] || JSON.stringify({
  contractNumber: '______',
  city: 'Минск',
  day: '__',
  month: '________',
  year: '____',
  clientCompanyFull: '____________________',
  clientDirectorLastName: '',
  clientDirectorFirstName: '',
  clientDirectorPatronymic: '',
  clientDirectorPosition: 'директора',
  clientAuthorityDoc: 'Устава',
  objectName: '____________________',
  startDate: '________',
  endDate: '________',
  costWithoutVAT: '0,00',
  vatRate: '20',
  vatAmount: '0,00',
  vatAmountWords: '',
  totalCost: '0,00',
  totalCostWords: '________________________________________________',
  paymentSchedule: '',
  clientName: '____________________',
  clientUNP: '____',
  clientOKPO: '',
  clientAddress: '____________________',
  clientBank: '____________________',
  clientBankName: '____________________',
  clientBankBIC: '____',
  clientEmail: '',
  clientPhone: '',
  clientFax: '',
  contractorName: 'ООО «МСК Релайбл»',
  contractorAddress: '220113, г. Минск, ул. Мележа, д. 4',
  contractorUNP: '193607959',
  contractorBank: 'BY91ALFA30122B38250010270000 в BYN',
  contractorBankName: 'ЗАО «Альфа-Банк»',
  contractorBankBIC: 'ALFABY2X',
  contractorBankAddress: '220013, г. Минск, ул. Сурганова, 43-47',
  contractorEmail: 'MCK-Reliable@yandex.ru',
  contractorPhone: '+375444543857',
  contractorDirectorShort: 'В.И. Хурс',
  works: []
}));

const pageProps = {
  page: {
      size: { width: PAGE_W, height: PAGE_H },
      margin: { top: MARGIN_TOP, right: MARGIN_RIGHT, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, header: 708, footer: 708 },
      pageNumbers: { start: 1 },
  }
};

const doc = new Document({
  sections: [{
      properties: { ...pageProps, type: SectionType.NEXT_PAGE },
      footers: { default: makeFooter() },
      children: buildContractContent(contractData),
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = process.argv[3] || './contract_output.docx';
  fs.writeFileSync(outPath, buffer);
  console.log('Contract generated:', outPath);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});