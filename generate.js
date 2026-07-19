const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableLayoutType,
} = require("docx");

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const c = (hex) => hex.replace("#", "");
const cL = (hex) => hex ? hex.replace("#", "") : "000000";

// ── Palette: GO-1 (Graphite Orange) for R4 plan ──
const P = {
  bg: "1A2330", primary: "FFFFFF", accent: "D4875A",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
  body: "000000", secondary: "506070",
};

// ═══════════════════════════════════════
// Cover Helpers (from design-system.md)
// ═══════════════════════════════════════

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([
    ...'\uFF0C\u3002\u3001\uFF1B\uFF1A\uFF01\uFF1F',
    ...'\u7684\u4E0E\u548C\u53CA\u4E4B\u5728\u4E8E\u4E3A',
    ...'-_\u2014\u2013\u00B7/',
    ...' \t',
  ]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) {
      breakAt = charsPerLine;
      const prev = remaining[breakAt - 1];
      const next = remaining[breakAt];
      if (prev && next && !breakAfter.has(prev) && !breakAfter.has(next) &&
          /[\u4e00-\u9fff]/.test(prev) && /[\u4e00-\u9fff]/.test(next)) {
        breakAt -= 1;
      }
    }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838,
    marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

function emptyPara() {
  return new Paragraph({ children: [] });
}

// ── Build Cover R4: Top Color Block ──
function buildCoverR4(config) {
  const Pc = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 26);
  const titleSize = titlePt * 2;
  const titleBlockHeight = titleLines.length * (titlePt * 23 + 200);
  const englishLabelH = config.englishLabel ? (9 * 23 + 500) : 0;
  const subtitleH = config.subtitle ? (12 * 23 + 200) : 0;
  const upperContentH = englishLabelH + titleBlockHeight + subtitleH;
  const UPPER_MIN = 7500;
  const UPPER_H = Math.max(UPPER_MIN, upperContentH + 1500 + 800);
  const DIVIDER_H = 60;
  const contentEstimate = (config.englishLabel ? (9 * 23 + 500) : 0) + titleLines.length * (titlePt * 23 + 200) + (config.subtitle ? (12 * 23 + 200) : 0);
  const spacerIntrinsic = 280;
  const topSpacing = Math.max(UPPER_H - contentEstimate - spacerIntrinsic - 800, 400);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: cL(Pc.bg) },
        borders: noBorders,
        verticalAlign: "top",
        margins: { left: padL, right: padR },
        children: [
          new Paragraph({ spacing: { before: topSpacing } }),
          config.englishLabel ? new Paragraph({
            spacing: { after: 500 },
            children: [new TextRun({ text: config.englishLabel.split("").join(" "), size: 18, color: cL(Pc.accent), font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 60 })],
          }) : null,
          ...titleLines.map((line, i) => new Paragraph({
            spacing: { after: i < titleLines.length - 1 ? 100 : 200, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: line, size: titleSize, bold: true, color: cL(Pc.cover.titleColor), font: { eastAsia: "SimHei", ascii: "Arial" } })],
          })),
          config.subtitle ? new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: config.subtitle, size: 24, color: cL(Pc.cover.subtitleColor), font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
          }) : null,
        ].filter(Boolean),
      })],
    })],
  });

  const divider = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: DIVIDER_H, rule: "exact" },
      children: [new TableCell({ borders: noBorders, shading: { type: ShadingType.CLEAR, fill: cL(Pc.accent) }, children: [emptyPara()] })],
    })],
  });

  const lowerContent = [
    new Paragraph({ spacing: { before: 800 } }),
    ...(config.metaLines || []).map(line => new Paragraph({
      indent: { left: padL }, spacing: { after: 100 },
      children: [new TextRun({ text: line, size: 28, color: cL(Pc.cover.metaColor), font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    })),
    new Paragraph({ spacing: { before: 2000 } }),
    new Paragraph({
      indent: { left: padL },
      children: [
        new TextRun({ text: config.footerLeft || "", size: 22, color: "909090", font: { eastAsia: "Microsoft YaHei" } }),
        new TextRun({ text: "          " }),
        new TextRun({ text: config.footerRight || "", size: 22, color: "909090", font: { eastAsia: "Microsoft YaHei" } }),
      ],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
        borders: noBorders,
        verticalAlign: "top",
        children: [upperBlock, divider, ...lowerContent],
      })],
    })],
  })];
}

// ═══════════════════════════════════════
// Body Helpers
// ═══════════════════════════════════════

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: "0B1220", font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: "0B1220", font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: "0B1220", font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420 },
    spacing: { line: 312, ...opts.spacing },
    children: [new TextRun({ text, size: 24, color: cL(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, ...opts.run })],
  });
}

function boldPara(text, opts = {}) {
  return para(text, { run: { bold: true }, ...opts });
}

function itemPara(text) {
  return new Paragraph({
    spacing: { line: 312 },
    indent: { left: 420, hanging: 420 },
    children: [new TextRun({ text: `\u2022 ${text}`, size: 24, color: cL(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
  });
}

function sectionBreak() {
  return new Paragraph({ children: [new TextRun({ text: "" }), new PageBreak()] });
}

// ── Tables ──
function headerCell(text, widthPct) {
  return new TableCell({
    children: [new Paragraph({ spacing: { line: 312 }, children: [new TextRun({ text, bold: true, size: 21, color: cL(P.table.headerText), font: { eastAsia: "Microsoft YaHei" } })] })],
    shading: { type: ShadingType.CLEAR, fill: cL(P.table.headerBg) },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });
}

function dataCell(text, widthPct, opts = {}) {
  return new TableCell({
    children: [new Paragraph({
      spacing: { line: 312 },
      children: [new TextRun({ text, size: 20, color: "000000", font: { eastAsia: "Microsoft YaHei" }, ...opts.run })],
    })],
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    ...opts.cell,
  });
}

function makeTable(headers, rows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => headerCell(h, colWidths[i])),
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((cell, ci) => dataCell(cell, colWidths[ci], {
      cell: ri % 2 === 0 ? { shading: { type: ShadingType.CLEAR, fill: cL(P.table.surface) } } : {},
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: cL(P.table.accentLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: cL(P.table.accentLine) },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: cL(P.table.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

function daySectionHeader(dayNum, dateStr, title, highlight) {
  return [
    new Paragraph({
      keepNext: true,
      spacing: { before: 400, after: 200, line: 312 },
      children: [
        new TextRun({ text: `${highlight || ""} `, bold: true, size: 32, color: cL(P.table.headerBg), font: { eastAsia: "SimHei" } }),
        new TextRun({ text: `Day ${dayNum}`, bold: true, size: 32, color: cL(P.table.headerBg), font: { eastAsia: "SimHei" } }),
        new TextRun({ text: `   ${dateStr}`, size: 24, color: cL(P.secondary), font: { eastAsia: "Microsoft YaHei" } }),
      ],
    }),
    new Paragraph({
      keepNext: true,
      spacing: { before: 0, after: 120, line: 312 },
      indent: { left: 420 },
      children: [new TextRun({ text: title, size: 24, bold: true, color: cL(P.body), font: { eastAsia: "Microsoft YaHei" } })],
    }),
  ];
}

function timeRow(time, activity, note) {
  return [new Paragraph({
    spacing: { line: 312 },
    indent: { left: 840, hanging: 420 },
    children: [
      new TextRun({ text: `${time}  `, bold: true, size: 22, color: cL(P.table.accentLine), font: { eastAsia: "Microsoft YaHei" } }),
      new TextRun({ text: activity, size: 22, color: "000000", font: { eastAsia: "Microsoft YaHei" } }),
    ],
  })];
}

function dayPara(text) {
  return new Paragraph({
    spacing: { line: 312 },
    indent: { left: 420, firstLine: 0 },
    children: [new TextRun({ text, size: 22, color: "000000", font: { eastAsia: "Microsoft YaHei" } })],
  });
}

// ═══════════════════════════════════════
// Content Data
// ═══════════════════════════════════════

const overviewData = [
  ["7/10 (周五)", "大阪", "到达关西，入住USJ附近", "飞机、南海电铁"],
  ["7/11 (周六)", "大阪", "环球影城 (USJ) 全天", "步行"],
  ["7/12 (周日)", "大阪→名古屋", "名古屋城、SCMaglev高铁博物馆", "新干线 30分"],
  ["7/13 (周一)", "名古屋→南木曾", "中山道馬籠→妻籠古道徒步", "JR中央本线，转小泉线"],
  ["7/14 (周二)", "松本→上高地", "松本城、上高地自然风景", "JR松本线，上高地ライナー"],
  ["7/15 (周三)", "上高地→东京", "上高地早晨散步→新宿", "Azusa特急直达新宿"],
  ["7/16 (周四)", "东京", "东京自由探索（秋叶原、新宿、台场）", "JR山手线"],
  ["7/17 (周五)", "东京", "东京迪士尼海洋 (TDS)", "迪士尼专线"],
  ["7/18 (周六)", "东京→大阪", "新干线回大阪，最后采购", "新干线 Nozomi 2.5h"],
  ["7/19 (周日)", "大阪", "关西机场返程", "南海电铁 / 机场巴士"],
];

const dayDetails = [
  {
    day: 1, date: "7/10 (周五)", title: "到达大阪 — 环球影城区域",
    highlight: "\uD83D\uDEEB\uFE0F",
    schedule: [
      ["10:00", "抵达关西国际机场 (KIX)", ""],
      ["11:00-11:30", "出关、领取行李、购买ICOCA交通卡", "可在JR窗口购买ICOCA & HARUKA套票"],
      ["11:30-12:30", "南海电铁 / 机场巴士 前往市区", "推荐南海电铁Rapi:t特急（约40分钟）"],
      ["12:30-14:00", "酒店入住、放行李", "推荐入住USJ周边酒店（环球影城港湾/近铁）"],
      ["14:00-15:00", "午餐（环球影城周边美食广场）", "自由轩蛋包饭、章鱼烧、大阪烧"],
      ["15:00-17:30", "环球影城City Walk逛街 + 提前踩点", "明日USJ开园时间确认"],
      ["17:30-19:00", "休息（孩子可泳池/游戏）", ""],
      ["19:00-21:00", "心斋桥·道顿堀夜景", "格力高广告牌、法善寺横丁、食倒太郎"],
      ["21:00", "回酒店休息", "为明日USJ蓄力"],
    ],
    tips: "心斋桥道顿堀游客众多，带好孩子的手腕。可提前在便利店买好第二天USJ的早餐和零食。"
  },
  {
    day: 2, date: "7/11 (周六)", title: "环球影城 (USJ) 全日狂欢",
    highlight: "\uD83C\uDFAE",
    schedule: [
      ["06:30", "起床、酒店早餐", ""],
      ["07:15", "前往USJ大门排队", "提前30分钟到门口"],
      ["08:00", "USJ开园（推荐抢马里奥园区整理券）", "直奔超级任天堂世界"],
      ["08:30-12:00", "超级任天堂世界", "马里奥卡丁车、耀西冒险、酷霸王挑战书"],
      ["12:00-13:00", "午餐（园内餐厅 或 蘑菇咖啡厅）", "推荐奇诺比奥咖啡厅"],
      ["13:00-15:00", "哈利波特魔法世界", "禁忌之旅、鹰马飞行、魔杖体验"],
      ["15:00-17:00", "小黄人乐园 + 侏罗纪公园", "小黄人调皮乘车游、飞天翼龙（胆量挑战）"],
      ["17:00-18:00", "水世界表演（如有排期） + 花车巡游", ""],
      ["18:00-19:00", "晚餐（园内或City Walk）", "可选大阪王将饺子/串炸"],
      ["19:00-21:00", "夜间游行（视季节）/ 继续游乐设施", ""],
      ["21:00", "回酒店休息", ""],
    ],
    tips: "务必下载USJ官方App实时查看排队时间！推荐购买Express Pass节省排队时间。两个孩子都8岁和12岁，绝大部分项目都能玩。"
  },
  {
    day: 3, date: "7/12 (周日)", title: "大阪 → 名古屋：历史与科技",
    highlight: "\uD83D\uDEF4",
    schedule: [
      ["08:00", "起床、退房、行李宅急便寄送至东京酒店", "利用酒店前台宅急便服务"],
      ["09:00-09:30", "新干线前往名古屋", "Nozomi约30分钟，无需指定席"],
      ["09:30-10:00", "名古屋站寄放行李（coin locker）", ""],
      ["10:00-12:00", "名古屋城", "天守阁、金鯱、本丸御殿"],
      ["12:00-13:00", "午餐：名古屋名物", "鳗鱼饭三吃（蓬莱轩）、炸鸡翅、味噌煮乌冬"],
      ["13:00-13:30", "前往名古屋港区", "地铁东山线转青波线"],
      ["13:30-16:00", "SCMaglev高铁公园", "磁悬浮体验、新干线驾驶模拟、铁道博物馆"],
      ["16:00-17:00", "回名古屋站、取行李、酒店入住", "推荐名古屋站附近酒店"],
      ["17:00-18:30", "名古屋站地下街（ESCA）逛街", ""],
      ["18:30-20:00", "晚餐：矢场猪排（味噌炸猪排）", "名古屋站周边"],
    ],
    tips: "SCMaglev & Railway Park是孩子们的铁路博物馆天堂，有真实的超导磁悬浮列车和新干线模拟器。"
  },
  {
    day: 4, date: "7/13 (周一)", title: "穿越时光：中山道马笼·妻笼徒步",
    highlight: "\uD83C\uDFF4",
    schedule: [
      ["07:00", "起床、退房", ""],
      ["07:30-08:10", "名古屋→中津川（JR中央本线快速）", ""],
      ["08:10-08:40", "中津川→马笼（巴士）", ""],
      ["08:40-09:00", "马笼宿观景台拍照", ""],
      ["09:00-12:00", "马笼→妻笼 中山道徒步（约7.7km）", "途径石叠路、茶屋展望台、一石栃立场"],
      ["12:00-13:00", "妻笼宿午餐", "荞麦面、五平饼等乡土料理"],
      ["13:00-14:00", "妻笼宿老街散步", "木造建筑、水车、邮局"],
      ["14:00-14:30", "妻笼→南木曾（巴士）", ""],
      ["14:30-15:30", "南木曾→松本（JR中央线）", "沿途景色优美"],
      ["15:30-16:00", "松本站前酒店入住", ""],
      ["16:00-17:30", "松本城外观（若未关门可入内）", "日本国宝五城之一"],
      ["18:00-19:30", "晚餐：信州荞麦面/马肉刺身", "松本城周边"],
    ],
    tips: "中山道徒步约2-3小时，途中有便利店可买水。8岁孩子可以完成，12岁更轻松。建议穿运动鞋，前半段略有上坡。"
  },
  {
    day: 5, date: "7/14 (周二)", title: "松本城 + 上高地绝景",
    highlight: "\u26F0\uFE0F",
    schedule: [
      ["07:00", "起床", ""],
      ["07:30-09:00", "松本城深度游览", "天守阁内部参观（40分钟）、盔甲试穿体验"],
      ["09:00-09:30", "早餐（松本站前面包店）", ""],
      ["09:30-10:30", "松本→新岛岛（JR松本线）", ""],
      ["10:30-11:30", "新岛岛→上高地（巴士）", "巴士途经红叶谷"],
      ["11:30-12:00", "上高地信息中心、租借登山杖", ""],
      ["12:00-13:00", "午餐（上高地帝国酒店或河童桥餐厅）", "推荐河童桥周边"],
      ["13:00-16:00", "上高地徒步：河童桥→大正池→梓川散步", "平缓步道，适合全家"],
      ["16:00-17:00", "巴士返回松本", "注意末班巴士时间"],
      ["17:00-18:30", "松本绳手通·中町通散步", "感受文艺小城氛围"],
      ["18:30-20:00", "晚餐", "居酒屋体验"],
    ],
    tips: "上高地被誉为「日本阿尔卑斯」，风景绝美。7月正是绿意盎然的时节。步道平缓，推婴儿车都可以。河童桥是标志性拍照点。"
  },
  {
    day: 6, date: "7/15 (周三)", title: "上高地晨景 → 东京",
    highlight: "\uD83D\uDE86",
    schedule: [
      ["06:00", "早起！以上高地晨雾为背景拍照", "清晨的上高地如仙境"],
      ["07:00-08:00", "河童桥周边散步，呼吸新鲜空气", ""],
      ["08:00-08:30", "退房、巴士前往松本", ""],
      ["08:30-09:30", "松本→新岛岛→松本站", ""],
      ["09:30-11:50", "松本站→新宿站（特急Azusa）", "直达新宿，约2小时20分"],
      ["11:50-12:30", "新宿站→东京酒店入住", "推荐新宿或品川区域"],
      ["12:30-13:30", "午餐（新宿站周边）", "立食寿司、拉面、咖喱饭"],
      ["13:30-15:00", "秋叶原电器街", "手办、模型、扭蛋、电玩中心"],
      ["15:00-17:00", "东京站·皇居周边 或 日本桥", ""],
      ["17:00-18:30", "涩谷十字路口 + 涩谷SKY展望台", "俯瞰东京全景"],
      ["18:30-20:00", "晚餐：涩谷烤肉/寿司", "推荐涩谷PARCO周边"],
    ],
    tips: "特急Azusa号从松本直达新宿，车上可购买便当。秋叶原是两个孩子的最爱，扭蛋和游戏厅非常吸引人。"
  },
  {
    day: 7, date: "7/16 (周四)", title: "东京自由探索日",
    highlight: "\uD83D\uDDFF\uFE0F",
    schedule: [
      ["08:00", "起床、酒店早餐", ""],
      ["09:00-10:00", "浅草寺·雷门", "仲见世通买纪念品"],
      ["10:00-12:00", "上野动物园（熊猫） + 上野公园", "孩子喜欢的动物园"],
      ["12:00-13:00", "午餐：上野阿美横町", "回转寿司、烤牛肉丼"],
      ["13:00-15:00", "东京国立科学博物馆（上野）", "恐龙化石、科学实验秀"],
      ["15:00-16:30", "台场：高达基地 + 乐高乐园", "1:1高达立像超震撼"],
      ["16:30-18:00", "台场海滨公园·自由女神像", "适合家庭散步"],
      ["18:30-20:00", "晚餐：台场购物中心", "拉面、寿司等"],
    ],
    tips: "今天可根据体力选择部分景点。建议上野动物园+科学博物馆组合，孩子们会非常喜欢。台场高达是男生必去！"
  },
  {
    day: 8, date: "7/17 (周五)", title: "东京迪士尼海洋 (TDS)",
    highlight: "\uD83C\uDF89",
    schedule: [
      ["06:30", "起床、早餐", ""],
      ["07:00-07:30", "前往舞滨站", "乘坐JR京叶线/地铁有乐町线"],
      ["07:30-08:00", "换乘迪士尼Resort Line", "单轨电车直达园区入口"],
      ["08:00-08:30", "排队入园", ""],
      ["08:30-12:00", "热门项目：玩具总动员、地心探险、惊魂古塔", "建议抢DPA或快速通"],
      ["12:00-13:00", "午餐：园区内餐厅", "推荐地中海风味餐厅"],
      ["13:00-16:00", "探索：阿拉伯海岸、美人鱼礁湖、神秘岛", "孩子可玩项目众多"],
      ["16:00-17:00", "水上表演（视当日安排）", ""],
      ["17:00-18:30", "晚餐 + 购物", "园区纪念品店"],
      ["19:30-20:30", "夜间水上秀（Believe! Sea of Dreams）", "必看！"],
      ["20:30-21:00", "出园返回酒店", ""],
    ],
    tips: "推荐12岁的哥哥玩地心探险和惊魂古塔，8岁的弟弟可以玩阿拉伯海岸和美人鱼礁湖。下载东京迪士尼官方App管理预约。迪士尼更适合男孩（相对Disneyland更偏刺激项目）。"
  },
  {
    day: 9, date: "7/18 (周六)", title: "东京 → 大阪 + 购物日",
    highlight: "\uD83D\uDECD\uFE0F",
    schedule: [
      ["07:00", "起床、退房", "行李宅急便送至关西机场（可选）"],
      ["07:30-08:30", "前往东京站", ""],
      ["08:30-11:00", "新干线Nozomi → 新大阪", "约2.5小时，车上补觉"],
      ["11:00-12:00", "新大阪→难波酒店入住", "推荐心斋桥/难波区域"],
      ["12:00-13:00", "午餐：黑门市场", "海鲜、和牛、烤串"],
      ["13:00-17:00", "心斋桥松绑购物", "药妆、电器、动漫周边、衣服"],
      ["17:00-18:00", "休息/酒店放东西", ""],
      ["18:00-20:00", "道顿堀：最后一顿丰盛晚餐", "河豚料理、章鱼烧、大阪烧"],
      ["20:00-21:00", "道顿堀夜景告别散步", ""],
    ],
    tips: "宅急便可将行李箱直接送到关西机场，省去携带烦恼。黑门市场适合午餐（大部分店铺下午打烊）。"
  },
  {
    day: 10, date: "7/19 (周日)", title: "大阪 → 回国",
    highlight: "\u2708\uFE0F",
    schedule: [
      ["07:00", "起床、早餐", ""],
      ["08:00-08:30", "退房", ""],
      ["08:30-09:30", "前往关西机场", "南海电铁 Rapi:t / 机场巴士 / 出租车"],
      ["09:30-10:30", "机场值机、免税店购物", "白色恋人、ROYCE生巧、薯条三兄弟"],
      ["10:30-11:00", "过安检、登机", ""],
      ["11:00-11:30", "登机，结束美妙日本之旅！", ""],
    ],
    tips: "建议提前2.5小时到达机场。关西机场免税店有丰富的伴手礼选择。如果时间充裕可以去关空展望台看飞机起降。"
  },
];

const transportTips = [
  { mode: "ICOCA交通卡", advice: "全行程通用（关西+东京+名古屋），便利店也可刷。抵达关西机场后立即购买。儿童需购买儿童ICOCA（半价）。" },
  { mode: "新干线Nozomi", advice: "大阪↔名古屋约30分钟、名古屋↔东京约1.5小时、东京↔新大阪约2.5小时。无需额外买JR Pass，单买更划算。" },
  { mode: "特急Azusa（梓）", advice: "松本→新宿直达（约2h20min），车内舒适可选指定席。7/15行程的关键交通。" },
  { mode: "中山道交通", advice: "名古屋→中津川（JR快速）、中津川→马笼（巴士）、妻笼→南木曾（巴士）、南木曾→松本（JR）。班次较少，请提前确认时刻表。" },
  { mode: "上高地交通", advice: "松本→新岛岛（JR松本线）转巴士至上高地。注意上高地末班巴士时间（通常17:00-18:00）。" },
  { mode: "宅急便（Takkyubin）", advice: "推荐在7/12从大阪酒店将行李箱寄送至东京酒店（次日上午到达）。7/18从东京寄至关西机场。" },
];

const packingItems = [
  "\uD83D\uDC55 衣物：夏季轻便服装（7月日本30℃+）、薄外套（上高地山区16℃左右）、泳衣（酒店可能有泳池）",
  "\uD83D\uDC62 鞋子：运动鞋（中山道徒步必备）、凉鞋/拖鞋",
  "\uD83D\uDE0E 防晒：防晒霜、太阳镜、遮阳帽（尤其USJ和迪士尼户外排队）",
  "\uD83D\uDC9A 防蚊：驱蚊液（上高地蚊虫较多）",
  "\uD83D\uDCED 雨具：折叠伞（7月梅雨季刚过，仍有阵雨可能）",
  "\u26A1 充电：手机充电宝（排队时刷手机必带）、日本用插头转换器",
  "\uD83D\uDCB5 钱包：ICOCA卡（人手一张）、现金（日本很多小店只收现金）、信用卡",
  "\uD83D\uDC69\u200D\uD83D\uDC66 亲子：儿童水壶、零食、湿巾、便携玩具/画本（排队时消遣）",
  "\uD83D\uDCF1 App：Google Maps、USJ官方App、东京迪士尼App、乘换案内（交通）、DeepL翻译",
  "\uD83C\uDFC3 行李策略：大阪→东京→大阪的往返路线，推荐宅急便寄送大行李，随身只带2日替换衣物。",
];

// ═══════════════════════════════════════
// Build Sections
// ═══════════════════════════════════════

// ── Overview Table ──
function buildOverview() {
  const headers = ["日期", "所在地", "主要活动", "交通方式"];
  const colWidths = [15, 15, 45, 25];
  return [
    h1("行程概览"),
    para("以下为 10 天 9 晚完整行程一览表，涵盖大阪、名古屋、中山道、松本、上高地、东京和大阪。" + "\u2002" + "本路线兼顾环球影城、迪士尼、小众秘境和自然风光，适合全家出行。"),
    makeTable(headers, overviewData, colWidths),
  ];
}

// ── Daily Details ──
function buildDailyDetails() {
  const sections = [];
  for (const d of dayDetails) {
    sections.push(...daySectionHeader(d.day, d.date, d.title, d.highlight));
    for (const s of d.schedule) {
      sections.push(...timeRow(s[0], s[1], s[2]));
    }
    sections.push(boldPara(`💡 小贴士：${d.tips}`, { spacing: { before: 120, after: 40 } }));
  }
  return sections;
}

// ── Transportation Guide ──
function buildTransport() {
  const headers = ["交通方式", "详细建议"];
  const colWidths = [25, 75];
  const rows = transportTips.map(t => [t.mode, t.advice]);
  return [
    new Paragraph({ children: [new TextRun({ text: "" }), new PageBreak()] }),
    h1("交通指南"),
    para("本行程采用「单程购票」策略，无需购买JR Pass。以下为各段交通详解："),
    makeTable(headers, rows, colWidths),
    h2("交通费用估算（一家四口）"),
    itemPara("南海电铁 Rapi:t 关西机场→大阪：约 1,450円×4"),
    itemPara("新干线 大阪→名古屋：约 6,000円×4"),
    itemPara("新干线 东京→新大阪（Nozomi）：约 14,000円×4"),
    itemPara("特急 Azusa 松本→新宿：约 7,000円×4"),
    itemPara("其他 JR/地铁/巴士：约 1,000-2,000円/天×4"),
    itemPara("总计约 40,000-45,000円/人，全家约 16-18万日元"),
  ];
}

// ── Packing Checklist ──
function buildPacking() {
  return [
    new Paragraph({ children: [new TextRun({ text: "" }), new PageBreak()] }),
    h1("出行准备清单"),
    para("以下为本次日本小众之旅的必备物品检查清单："),
    ...packingItems.map(item => itemPara(item)),
  ];
}

// ── Final Notes ──
function buildNotes() {
  return [
    h1("注意事项"),
    h2("\uD83C\uDF0F 汇率与支付"),
    itemPara("当前 1日元≈0.05人民币，建议携带5-10万日元现金（约2500-5000元）"),
    itemPara("大部分便利店、商场、餐厅支持支付宝/微信/ICOCA"),
    itemPara("小店、街边摊、部分寺庙只收现金"),
    h2("\uD83C\uDF1F 网络通讯"),
    itemPara("推荐购买日本SIM卡（淘宝预付）或租赁移动WiFi"),
    itemPara("建议下载离线地图作为备用"),
    h2("\uD83C\uDFE0 住宿建议"),
    itemPara("大阪：USJ区域（7/10-11）+ 难波/心斋桥（7/18）"),
    itemPara("名古屋：名古屋站周边（7/12）"),
    itemPara("松本：松本站前（7/13-14）"),
    itemPara("东京：新宿区域（7/15-17）——交通枢纽，去哪都方便"),
    h2("\uD83C\uDFC3 节奏建议"),
    itemPara("有两个孩子同行，每天安排不宜过满"),
    itemPara("7/16 东京自由日可根据体力调整——可砍掉部分景点"),
    itemPara("上高地徒步距离适中，适合全家"),
    itemPara("宅急便充分利用，减少拖行李的体力消耗"),
    para("祝您全家在日本度过一段美好的小众探索之旅！🇯🇵✨"),
  ];
}

// ═══════════════════════════════════════
// Assembly
// ═══════════════════════════════════════

async function main() {
  const coverConfig = {
    palette: {
      bg: "1A2330", primary: "FFFFFF", accent: "D4875A",
      cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
    },
    title: "日本小众旅游行程规划",
    englishLabel: "JAPAN NICHE TRAVEL ITINERARY",
    subtitle: "大阪 \u00B7 名古屋 \u00B7 中山道 \u00B7 松本 \u00B7 上高地 \u00B7 东京 \u00B7 迪士尼",
    metaLines: [
      "出行日期：2026年7月10日 — 7月19日（10天9晚）",
      "出行成员：爸爸 + 妈妈 + 哥哥（12岁）+ 弟弟（8岁）",
    ],
    footerLeft: "ZCode Travel Plan",
    footerRight: "2026",
  };

  const bodySections = [
    ...buildOverview(),
    new Paragraph({ children: [new TextRun({ text: "" }), new PageBreak()] }),
    h1("每日行程详解"),
    ...buildDailyDetails(),
    ...buildTransport(),
    ...buildPacking(),
    ...buildNotes(),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
            size: 24,
            color: "000000",
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            size: 32,
            bold: true,
            color: "0B1220",
          },
          paragraph: {
            spacing: { before: 360, after: 160, line: 312 },
          },
        },
        heading2: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            size: 28,
            bold: true,
            color: "0B1220",
          },
          paragraph: {
            spacing: { before: 240, after: 120, line: 312 },
          },
        },
        heading3: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            size: 24,
            bold: true,
            color: "0B1220",
          },
          paragraph: {
            spacing: { before: 200, after: 100, line: 312 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
          },
        },
        children: buildCoverR4(coverConfig),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { line: 276 },
                children: [
                  new TextRun({ text: "— ", size: 16, color: "999999", font: { ascii: "Calibri" } }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" }),
                  new TextRun({ text: " —", size: 16, color: "999999", font: { ascii: "Calibri" } }),
                ],
              }),
            ],
          }),
        },
        children: bodySections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = "C:\\Users\\Lenovo\\ZCodeProject\\日本小众旅游行程规划.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("✅ Document created: " + outPath);
}

main().catch(err => { console.error("❌ Error:", err); process.exit(1); });
