const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, PageBreak, AlignmentType, HeadingLevel,
  BorderStyle, ShadingType, WidthType, TableLayoutType, SectionType,
  PageOrientation, Break, NumberFormat, TableOfContents,
} = require("docx");

// ── Output path ──
const OUTPUT = "C:\\Users\\Lenovo\\ZCodeProject\\marketing-tools\\\u7528\u6237\u4f7f\u7528\u624b\u518c.docx";

// ── Border constants ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── WM-1 Warm Teal palette (education/training) ──
const P = {
  bg: "F4F1E9",
  primary: "15857A",
  accent: "FF6A3B",
  cover: { titleColor: "15857A", subtitleColor: "606060", metaColor: "707070", footerColor: "A0A0A0" },
  table: { headerBg: "15857A", headerText: "FFFFFF", accentLine: "15857A", innerLine: "D5D0C8", surface: "F0EDE5" },
};

// Body text colors (clean dark)
const BODY_PRIMARY = "303030";
const BODY_TEXT = "000000";

const c = (hex) => hex.replace("#", "");

// ══════════════════════════════════════════
// COVER R1 — Pure Paragraph Left (no nested tables)
// ══════════════════════════════════════════

const padL = 1200, padR = 800;

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
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([
    ...'\uff0c\u3002\u3001\uff1b\uff1a\uff01\uff1f',
    ...'\u7684\u4e0e\u548c\u53ca\u4e4b\u5728\u4e8e\u4e3a',
    ...'-\u2014\u2013\u00b7/',
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
      const prevChar = remaining[breakAt - 1];
      const nextChar = remaining[breakAt];
      if (prevChar && nextChar && !breakAfter.has(prevChar) && !breakAfter.has(nextChar)
          && /[\u4e00-\u9fff]/.test(prevChar) && /[\u4e00-\u9fff]/.test(nextChar)) {
        breakAt = breakAt - 1;
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

function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false,
          hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 400 } = params;
  const SAFETY = 1200;
  const usableHeight = 16838 - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + 900;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.40);
  const rawBottom = Math.floor(safeRemaining * 0.40);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.min(Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400), 4800);
  return { topSpacing, midSpacing: 0, bottomSpacing };
}

function buildCoverR1(config) {
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. Top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. English label
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({
        text: config.englishLabel.split("").join("  "),
        size: 18, color: c(P.accent),
        font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40,
      })],
    }));
  }

  // 3. Main title
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300,
                 line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({
        text: titleLines[i], size: titleSize, bold: true,
        color: c(P.cover.titleColor),
        font: { eastAsia: "SimHei", ascii: "Arial" },
      })],
    }));
  }

  // 4. Subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({
        text: config.subtitle, size: 24, color: c(P.cover.subtitleColor),
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  // 5. Meta info lines
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 24, color: c(P.cover.metaColor),
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" },
      })],
    }));
  }

  // 6. Bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. Footer separator + info
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: c(P.cover.footerColor), font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: c(P.cover.footerColor), font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ══════════════════════════════════════════
// PARAGRAPH BUILDERS
// ══════════════════════════════════════════

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({
      text, bold: true, size: 32, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({
      text, bold: true, size: 28, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({
      text, bold: true, size: 24, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
    })],
  });
}

function para(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420 },
    spacing: { line: 312, after: 100 },
    children: [new TextRun({
      text, size: 24, color: c(BODY_TEXT),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    indent: { left: 720 },
    children: [new TextRun({
      text, size: 24, color: c(BODY_TEXT),
      font: { eastAsia: "Microsoft YaHei", ascii: "Calibri" },
    })],
  });
}

// ══════════════════════════════════════════
// TABLE BUILDER — Horizontal-Only
// ══════════════════════════════════════════

function horizontalTable(headers, rows, colWidths) {
  const t = P.table;
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((text, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: t.headerBg },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text, bold: true, size: 21, color: c(t.headerText),
          font: { eastAsia: "Microsoft YaHei", ascii: "Calibri" },
        })],
      })],
    })),
  });

  const dataRows = rows.map((row) => new TableRow({
    cantSplit: true,
    children: row.map((cell, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: cell, size: 21, color: c(BODY_TEXT),
          font: { eastAsia: "Microsoft YaHei", ascii: "Calibri" },
        })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: t.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  });
}

// ── Page number footer builder ──
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.cover.footerColor) })],
    })],
  });
}

// ══════════════════════════════════════════
// TOC SECTION
// ══════════════════════════════════════════

function tocSection() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360 },
      children: [new TextRun({
        text: "\u76EE  \u5F55",  // 目  录
        bold: true, size: 32,
        font: { eastAsia: "SimHei", ascii: "Times New Roman" },
      })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: "\u6CE8\uFF1A\u6B64\u76EE\u5F55\u7531\u57DF\u4EE3\u7801\u81EA\u52A8\u751F\u6210\u3002\u5982\u9700\u66F4\u65B0\u9875\u7801\uFF0C\u8BF7\u53F3\u952E\u76EE\u5F55\uFF0C\u9009\u62E9\u201C\u66F4\u65B0\u57DF\u201D\u3002",
          // "Note: This Table of Contents is generated via field codes. To update page numbers, right-click the TOC and select 'Update Field'."
          italics: true, size: 18, color: "888888",
        }),
        new PageBreak(),
      ],
    }),
  ];
}

// ══════════════════════════════════════════
// MAIN — ASSEMBLE DOCUMENT
// ══════════════════════════════════════════

async function main() {
  // ── Cover ──
  const coverConfig = {
    title: "K12\u83B7\u5BA2\u8F6C\u5316\u5DE5\u5177\u7CFB\u7EDF",
    // K12获客转化工具系统
    englishLabel: "USER MANUAL",
    subtitle: "\u5458\u5DE5\u5B66\u4E60\u624B\u518C",
    // 员工学习手册
    metaLines: [
      "\u7248\u672C\uFF1AV1.0.0  |  \u53D1\u5E03\u65E5\u671F\uFF1A2026\u5E747\u6708",
      // 版本：V1.0.0  |  发布日期：2026年7月
    ],
    footerLeft: "K12\u83B7\u5BA2\u8F6C\u5316\u5DE5\u5177\u7CFB\u7EDF",
    footerRight: "\u5185\u90E8\u57F9\u8BAD\u8D44\u6599  \u00B7  \u8BF7\u52FF\u5916\u4F20",
    // 内部培训资料  ·  请勿外传
  };

  const cover = buildCoverR1(coverConfig);

  // ── TOC ──
  const toc = tocSection();

  // ════════════════════════════════════════
  // BODY CONTENT — 10 Chapters + 2 Appendices
  // ════════════════════════════════════════

  // ── Chapter 1: System Overview ──
  const ch1 = [
    h1("\u7B2C\u4E00\u7AE0  \u7CFB\u7EDF\u6982\u8FF0"),
    // 第一章  系统概述
    para("\u6B22\u8FCE\u4F7F\u7528K12\u83B7\u5BA2\u8F6C\u5316\u5DE5\u5177\u7CFB\u7EDF\uFF01\u672C\u7CFB\u7EDF\u662F\u4E00\u5957\u4E13\u4E3AK12\u6559\u80B2\u673A\u6784\u6253\u9020\u7684\u5168\u6D41\u7A0B\u83B7\u5BA2\u4E0E\u8F6C\u5316\u89E3\u51B3\u65B9\u6848\u3002\u7CFB\u7EDF\u96C6\u6210\u4E86\u591A\u5E73\u53F0\u793E\u4EA4\u5A92\u4F53\u6570\u636E\u91C7\u96C6\u3001\u8BED\u4E49\u5206\u6790\u3001\u7EBF\u7D22\u8BC4\u5206\u3001\u5BA2\u6237\u7BA1\u7406\u548C\u6570\u636E\u5206\u6790\u7B49\u6838\u5FC3\u529F\u80FD\uFF0C\u5E2E\u52A9\u673A\u6784\u5B9E\u73B0\u66F4\u9AD8\u6548\u7684\u5BA2\u6237\u83B7\u53D6\u4E0E\u8F6C\u5316\u3002"),
    // 欢迎使用K12获客转化工具系统！本系统是一套专为K12教育机构打造的全流程获客与转化解决方案。系统集成了多平台社交媒体数据采集、语义分析、线索评分、客户管理和数据分析等核心功能，帮助机构实现更高效的客户获取与转化。
    para("\u7CFB\u7EDF\u91C7\u7528B/S\u67B6\u6784\uFF0C\u57FA\u4E8EFastAPI\u540E\u7AEF\u6846\u67B6\u548C\u73B0\u4EE3\u524D\u7AEF\u6280\u672F\uFF0C\u652F\u6301\u591A\u6821\u533A\u3001\u591A\u89D2\u8272\u7684\u6743\u9650\u7BA1\u7406\u3002\u672C\u624B\u518C\u5C06\u5E2E\u52A9\u60A8\u5FEB\u901F\u638C\u63E1\u7CFB\u7EDF\u7684\u5404\u9879\u529F\u80FD\uFF0C\u63D0\u5347\u65E5\u5E38\u5DE5\u4F5C\u6548\u7387\u3002"),
    // 系统采用B/S架构，基于FastAPI后端框架和现代前端技术，支持多校区、多角色的权限管理。本手册将帮助您快速掌握系统的各项功能，提升日常工作效率。
    para("\u7CFB\u7EDF\u6838\u5FC3\u4EF7\u503C\uFF1A"),
    // 系统核心价值：
    bullet("\u591A\u5E73\u53F0\u6570\u636E\u91C7\u96C6\uFF1A\u652F\u6301\u5C0F\u7EA2\u4E66\u3001\u6296\u97F3\u7B49\u5E73\u53F0\u7684\u70ED\u70B9\u5185\u5BB9\u81EA\u52A8\u91C7\u96C6"),
    // 多平台数据采集：支持小红书、抖音等平台的热点内容自动采集
    bullet("\u667A\u80FD\u7EBF\u7D22\u8BC4\u5206\uFF1A\u57FA\u4E8E\u5173\u952E\u8BCD\u3001\u610F\u56FE\u3001\u89D2\u8272\u3001\u8054\u7CFB\u65B9\u5F0F\u56DB\u7EF4\u5EA6\u667A\u80FD\u8BC4\u5206"),
    // 智能线索评分：基于关键词、意图、角色、联系方式四维度智能评分
    bullet("\u5BA2\u6237\u7BA1\u7406\uFF1A\u96C6\u4E2D\u7BA1\u7406\u7EBF\u7D22\u4E0E\u5BA2\u6237\u8D44\u6E90\uFF0C\u652F\u6301\u5206\u6821\u533A\u67E5\u770B"),
    // 客户管理：集中管理线索与客户资源，支持分校区查看
    bullet("\u6570\u636E\u5206\u6790\uFF1A\u53EF\u89C6\u5316\u6570\u636E\u770B\u677F\uFF0C\u5B9E\u65F6\u76D1\u63A7\u83B7\u5BA2\u6548\u679C"),
    // 数据分析：可视化数据看板，实时监控获客效果
  ];

  // ── Chapter 2: Quick Start ──
  const ch2 = [
    h1("\u7B2C\u4E8C\u7AE0  \u5FEB\u901F\u5165\u95E8"),
    // 第二章  快速入门
    para("\u672C\u7AE0\u5C06\u5F15\u5BFC\u60A8\u5B8C\u6210\u7CFB\u7EDF\u7684\u57FA\u672C\u914D\u7F6E\u4E0E\u9996\u6B21\u4F7F\u7528\u3002"),
    // 本章将引导您完成系统的基本配置与首次使用。

    h2("2.1 \u767B\u5F55\u7CFB\u7EDF"),
    // 2.1 登录系统
    para("\u6253\u5F00\u6D4F\u89C8\u5668\uFF0C\u8BBF\u95EE\u7CFB\u7EDF\u5730\u5740\uFF08\u9ED8\u8BA4 http://localhost:8080\uFF09\uFF0C\u8F93\u5165\u7BA1\u7406\u5458\u5206\u914D\u7684\u8D26\u53F7\u5BC6\u7801\u5373\u53EF\u767B\u5F55\u3002\u9996\u6B21\u767B\u5F55\u540E\u8BF7\u5C3D\u5FEB\u4FEE\u6539\u5BC6\u7801\u3002"),
    // 打开浏览器，访问系统地址（默认 http://localhost:8080），输入管理员分配的账号密码即可登录。首次登录后请尽快修改密码。

    h2("2.2 \u5FEB\u901F\u4E0A\u624B\u6D41\u7A0B"),
    // 2.2 快速上手流程
    para("\u4EE5\u4E0B\u662F\u7CFB\u7EDF\u7684\u6807\u51C6\u4F7F\u7528\u6D41\u7A0B\uFF1A"),
    // 以下是系统的标准使用流程：
    bullet("\u6B65\u9AA4\u4E00\uFF1A\u5728\u300C\u7CFB\u7EDF\u914D\u7F6E\u300D\u4E2D\u8BBE\u7F6E\u5C0F\u7EA2\u4E66\u3001\u6296\u97F3\u7B49\u5E73\u53F0\u7684API\u63A5\u53E3\u4FE1\u606F"),
    // 步骤一：在「系统配置」中设置小红书、抖音等平台的API接口信息
    bullet("\u6B65\u9AA4\u4E8C\uFF1A\u5728\u300C\u793E\u4EA4\u5A92\u4F53\u83B7\u5BA2\u300D\u4E2D\u914D\u7F6E\u76D1\u63A7\u5173\u952E\u8BCD\u548C\u91C7\u96C6\u4EFB\u52A1"),
    // 步骤二：在「社交媒体获客」中配置监控关键词和采集任务
    bullet("\u6B65\u9AA4\u4E09\uFF1A\u7CFB\u7EDF\u81EA\u52A8\u91C7\u96C6\u5E73\u53F0\u5185\u5BB9\uFF0C\u751F\u6210\u7EBF\u7D22"),
    // 步骤三：系统自动采集平台内容，生成线索
    bullet("\u6B65\u9AA4\u56DB\uFF1A\u5728\u300C\u5BA2\u6237\u7BA1\u7406\u300D\u4E2D\u67E5\u770B\u548C\u5904\u7406\u7EBF\u7D22"),
    // 步骤四：在「客户管理」中查看和处理线索
    bullet("\u6B65\u9AA4\u4E94\uFF1A\u901A\u8FC7\u300C\u6570\u636E\u5206\u6790\u770B\u677F\u300D\u76D1\u63A7\u83B7\u5BA2\u6548\u679C"),
    // 步骤五：通过「数据分析看板」监控获客效果

    h2("2.3 \u4F7F\u7528\u573A\u666F\u793A\u4F8B"),
    // 2.3 使用场景示例
    para("\u4F8B\u5982\uFF0C\u60A8\u60F3\u8981\u5728\u5C0F\u7EA2\u4E66\u5E73\u53F0\u53D1\u73B0\u6709\u610F\u5411\u7684\u5BB6\u957F\u3002\u9996\u5148\u5728\u300C\u7CFB\u7EDF\u914D\u7F6E\u300D\u4E2D\u914D\u7F6E\u5C0F\u7EA2\u4E66Cookie\uFF0C\u7136\u540E\u5728\u300C\u793E\u4EA4\u5A92\u4F53\u83B7\u5BA2\u300D\u4E2D\u6DFB\u52A0\u76D1\u63A7\u5173\u952E\u8BCD\u5982\u201C\u5C0F\u5347\u521D\u201D\u201C\u5BB6\u6559\u201D\u7B49\uFF0C\u521B\u5EFA\u5B9A\u65F6\u91C7\u96C6\u4EFB\u52A1\u3002\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u626B\u63CF\u5E73\u53F0\u5185\u5BB9\uFF0C\u5E76\u5BF9\u6BCF\u6761\u5185\u5BB9\u8FDB\u884C\u8BC4\u5206\uFF0C\u8D85\u8FC7\u9608\u503C\u7684\u7EBF\u7D22\u4F1A\u81EA\u52A8\u4FDD\u5B58\u5230\u5BA2\u6237\u7BA1\u7406\u6A21\u5757\u3002"),
    // 例如，您想要在小红书平台发现有意向的家长。首先在「系统配置」中配置小红书Cookie，然后在「社交媒体获客」中添加监控关键词如"小升初""家教"等，创建定时采集任务。系统会自动扫描平台内容，并对每条内容进行评分，超过阈值的线索会自动保存到客户管理模块。
  ];

  // ── Chapter 3: System Architecture ──
  const ch3 = [
    h1("\u7B2C\u4E09\u7AE0  \u7CFB\u7EDF\u67B6\u6784"),
    // 第三章  系统架构
    para("\u7CFB\u7EDF\u91C7\u7528\u5FAE\u670D\u52A1\u67B6\u6784\u8BBE\u8BA1\uFF0C\u5206\u4E3A\u540E\u7AEF\u670D\u52A1\u3001\u524D\u7AEF\u5E94\u7528\u548C\u6570\u636E\u5B58\u50A8\u4E09\u5C42\u3002"),
    // 系统采用微服务架构设计，分为后端服务、前端应用和数据存储三层。

    h2("3.1 \u6280\u672F\u6808\u6982\u89C8"),
    // 3.1 技术栈概览
    para("\u4EE5\u4E0B\u662F\u7CFB\u7EDF\u4F7F\u7528\u7684\u4E3B\u8981\u6280\u672F\u7EC4\u4EF6\uFF1A"),
    // 以下是系统使用的主要技术组件：

    new Paragraph({ spacing: { before: 120 }, children: [] }),
    horizontalTable(
      ["\u5C42\u7EA7", "\u6280\u672F\u7EC4\u4EF6", "\u7248\u672C", "\u8BF4\u660E"],
      // 层级, 技术组件, 版本, 说明
      [
        ["\u540E\u7AEF\u6846\u67B6", "FastAPI", "0.109+", "\u9AD8\u6027\u80FDPython Web\u6846\u67B6"],
        ["\u6570\u636E\u5E93", "SQLite / PostgreSQL", "-", "\u8F7B\u91CF\u7EA7\u6570\u636E\u5B58\u50A8"],
        ["\u524D\u7AEF", "HTML5 + CSS3 + JS", "-", "\u73B0\u4EE3\u6D4F\u89C8\u5668\u6E32\u67D3"],
        ["\u5B66\u4E60\u5206\u6790", "jieba + \u81EA\u5B9A\u4E49\u8BCD\u5178", "-", "\u4E2D\u6587\u8BED\u4E49\u5206\u6790"],
        ["\u793E\u4EA4API", "RESTful", "-", "\u5E73\u53F0\u6570\u636E\u63A5\u53E3"],
        ["\u8FD0\u884C\u73AF\u5883", "Python 3.10+", "3.10+", "\u540E\u7AEF\u8FD0\u884C\u65F6"],
      ],
      [16, 22, 14, 48]
    ),
    // 后端框架, FastAPI, 0.109+, 高性能Python Web框架
    // 数据库, SQLite / PostgreSQL, -, 轻量级数据存储
    // 前端, HTML5 + CSS3 + JS, -, 现代浏览器渲染
    // 语义分析, jieba + 自定义词典, -, 中文语义分析

    h2("3.2 \u6A21\u5757\u7ED3\u6784"),
    // 3.2 模块结构
    bullet("\u540E\u7AEF\u670D\u52A1\uFF08backend/\uFF09\uFF1A\u5305\u542B\u8DEF\u7531\u3001\u670D\u52A1\u3001\u6570\u636E\u5E93\u6A21\u578B"),
    // 后端服务（backend/）：包含路由、服务、数据库模型
    bullet("\u524D\u7AEF\u5E94\u7528\uFF08frontend/\uFF09\uFF1A\u5305\u542B\u754C\u9762\u6A21\u677F\u3001JS\u903B\u8F91\u3001\u6837\u5F0F\u8868"),
    // 前端应用（frontend/）：包含界面模板、JS逻辑、样式表
    bullet("\u6570\u636E\u5B58\u50A8\uFF08database/\uFF09\uFF1A\u6570\u636E\u5E93\u6587\u4EF6\u548C\u914D\u7F6E"),
    // 数据存储（database/）：数据库文件和配置

    h2("3.3 \u5206\u6821\u533A\u673A\u5236"),
    // 3.3 分校区机制
    para("\u7CFB\u7EDF\u5185\u7F6E\u5206\u6821\u533A\u6743\u9650\u6A21\u578B\uFF0C\u6BCF\u4E2A\u7528\u6237\u53EA\u80FD\u67E5\u770B\u6240\u5C5E\u6821\u533A\u7684\u6570\u636E\uFF0C\u786E\u4FDD\u6570\u636E\u5B89\u5168\u548C\u7BA1\u7406\u72EC\u7ACB\u6027\u3002"),
    // 系统内置分校区权限模型，每个用户只能查看所属校区的数据，确保数据安全和管理独立性。
  ];

  // ── Chapter 4: System Management ──
  const ch4 = [
    h1("\u7B2C\u56DB\u7AE0  \u7CFB\u7EDF\u7BA1\u7406"),
    // 第四章  系统管理

    h2("4.1 \u7528\u6237\u7BA1\u7406"),
    // 4.1 用户管理
    para("\u7BA1\u7406\u5458\u53EF\u4EE5\u6DFB\u52A0\u3001\u7F16\u8F91\u548C\u5220\u9664\u7CFB\u7EDF\u7528\u6237\u3002\u6BCF\u4E2A\u7528\u6237\u53EF\u914D\u7F6E\u4E0D\u540C\u7684\u89D2\u8272\uFF08\u7BA1\u7406\u5458\u3001\u666E\u901A\u7528\u6237\u7B49\uFF09\u548C\u5F52\u5C5E\u6821\u533A\u3002"),
    // 管理员可以添加、编辑和删除系统用户。每个用户可配置不同的角色（管理员、普通用户等）和归属校区。

    h2("4.2 \u6A21\u677F\u7BA1\u7406"),
    // 4.2 模板管理
    para("\u7CFB\u7EDF\u652F\u6301\u7BA1\u7406\u5BA2\u6237\u6C9F\u901A\u6A21\u677F\uFF0C\u5305\u62EC\u62C9\u7FA4\u8BCD\u3001\u54A8\u8BE2\u56DE\u590D\u3001\u8BFE\u7A0B\u4ECB\u7ECD\u7B49\u3002\u60A8\u53EF\u4EE5\u6839\u636E\u5B9E\u9645\u9700\u6C42\u81EA\u5B9A\u4E49\u6A21\u677F\u5185\u5BB9\u3002"),
    // 系统支持管理客户沟通模板，包括拉群词、咨询回复、课程介绍等。您可以根据实际需求自定义模板内容。

    h2("4.3 \u65E5\u5FD7\u4E0E\u76D1\u63A7"),
    // 4.3 日志与监控
    para("\u7CFB\u7EDF\u8BB0\u5F55\u6240\u6709\u91CD\u8981\u64CD\u4F5C\u65E5\u5FD7\uFF0C\u5305\u62EC\u767B\u5F55\u8BB0\u5F55\u3001\u64CD\u4F5C\u8BB0\u5F55\u3001\u91C7\u96C6\u4EFB\u52A1\u6267\u884C\u8BB0\u5F55\u7B49\u3002\u7BA1\u7406\u5458\u53EF\u4EE5\u901A\u8FC7\u65E5\u5FD7\u4E86\u89E3\u7CFB\u7EDF\u8FD0\u884C\u72B6\u6001\u3002\u5F53\u91C7\u96C6\u4EFB\u52A1\u5931\u8D25\u6216\u7CFB\u7EDF\u5F02\u5E38\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u8BB0\u5F55\u9519\u8BEF\u4FE1\u606F\u4F9B\u6392\u67E5\u3002"),
    // 系统记录所有重要操作日志，包括登录记录、操作记录、采集任务执行记录等。管理员可以通过日志了解系统运行状态。当采集任务失败或系统异常时，系统会记录错误信息供排查。
  ];

  // ── Chapter 5: Customer Management ──
  const ch5 = [
    h1("\u7B2C\u4E94\u7AE0  \u5BA2\u6237\u7BA1\u7406"),
    // 第五章  客户管理

    h2("5.1 \u7EBF\u7D22\u5217\u8868"),
    // 5.1 线索列表
    para("\u300C\u5BA2\u6237\u7BA1\u7406\u300D\u6A21\u5757\u662F\u7CFB\u7EDF\u7684\u6570\u636E\u4E2D\u5FC3\uFF0C\u6240\u6709\u81EA\u52A8\u91C7\u96C6\u548C\u624B\u52A8\u6DFB\u52A0\u7684\u7EBF\u7D22\u5747\u5728\u6B64\u7BA1\u7406\u3002\u5217\u8868\u652F\u6301\u591A\u7EF4\u5EA6\u7B5B\u9009\uFF0C\u5305\u62EC\u5E73\u53F0\u3001\u8BC4\u5206\u3001\u72B6\u6001\u3001\u65F6\u95F4\u7B49\u3002"),
    // 「客户管理」模块是系统的数据中心，所有自动采集和手动添加的线索均在此管理。列表支持多维度筛选，包括平台、评分、状态、时间等。

    h2("5.2 \u7EBF\u7D22\u8BE6\u60C5"),
    // 5.2 线索详情
    para("\u70B9\u51FB\u7EBF\u7D22\u884C\u53EF\u4EE5\u67E5\u770B\u8BE6\u7EC6\u4FE1\u606F\uFF0C\u5305\u62EC\u539F\u59CB\u5185\u5BB9\u3001\u8BC4\u5206\u660E\u7EC6\u3001\u5E73\u53F0\u6570\u636E\u7B49\u3002\u60A8\u53EF\u4EE5\u5728\u8BE6\u60C5\u9875\u4E2D\u66F4\u65B0\u7EBF\u7D22\u72B6\u6001\uFF08\u5F85\u8054\u7CFB\u3001\u5DF2\u8054\u7CFB\u3001\u5DF2\u8F6C\u5316\u3001\u65E0\u6548\u7B49\uFF09\uFF0C\u5E76\u8BB0\u5F55\u8DDF\u8FDB\u5907\u6CE8\u3002"),
    // 点击线索行可以查看详细信息，包括原始内容、评分明细、平台数据等。您可以在详情页中更新线索状态（待联系、已联系、已转化、无效等），并记录跟进备注。

    h2("5.3 \u7EBF\u7D22\u72B6\u6001\u6D41\u8F6C"),
    // 5.3 线索状态流转
    para("\u6BCF\u6761\u7EBF\u7D22\u90FD\u6709\u660E\u786E\u7684\u72B6\u6001\u7BA1\u7406\uFF1A"),
    // 每条线索都有明确的状态管理：
    bullet("\u5F85\u8054\u7CFB\uFF1A\u7CFB\u7EDF\u65B0\u91C7\u96C6\u7684\u7EBF\u7D22\uFF0C\u7B49\u5F85\u5BA2\u670D\u5904\u7406"),
    // 待联系：系统新采集的线索，等待客服处理
    bullet("\u5DF2\u8054\u7CFB\uFF1A\u5BA2\u670D\u5DF2\u7ECF\u521D\u6B65\u8054\u7CFB\u7684\u7EBF\u7D22"),
    // 已联系：客服已经初步联系的线索
    bullet("\u5DF2\u8F6C\u5316\uFF1A\u6210\u529F\u8F6C\u5316\u4E3A\u62A5\u540D\u5B66\u5458\u7684\u7EBF\u7D22"),
    // 已转化：成功转化为报名学员的线索
    bullet("\u65E0\u6548\uFF1A\u786E\u8BA4\u65E0\u610F\u5411\u6216\u65E0\u6548\u7684\u7EBF\u7D22"),
    // 无效：确认无意愿或无效的线索
    para("\u5EFA\u8BAE\u5BA2\u670D\u4EBA\u5458\u8BBE\u5B9A\u6BCF\u5929\u56FA\u5B9A\u65F6\u95F4\u5904\u7406\u300C\u5F85\u8054\u7CFB\u300D\u7EBF\u7D22\uFF0C\u4EE5\u63D0\u9AD8\u8F6C\u5316\u6548\u7387\u3002"),
    // 建议客服人员设定每天固定时间处理「待联系」线索，以提高转化效率。
  ];

  // ── Chapter 6: Social Media Customer Acquisition ──
  const ch6 = [
    h1("\u7B2C\u516D\u7AE0  \u793E\u4EA4\u5A92\u4F53\u83B7\u5BA2"),
    // 第六章  社交媒体获客
    para("\u793E\u4EA4\u5A92\u4F53\u83B7\u5BA2\u662F\u7CFB\u7EDF\u7684\u6838\u5FC3\u529F\u80FD\u3002\u901A\u8FC7\u5BF9\u5C0F\u7EA2\u4E66\u3001\u6296\u97F3\u7B49\u5E73\u53F0\u8FDB\u884C\u5185\u5BB9\u91C7\u96C6\u548C\u5206\u6790\uFF0C\u53D1\u73B0\u6709\u610F\u5411\u7684\u6F5C\u5728\u5BA2\u6237\u3002"),
    // 社交媒体获客是系统的核心功能。通过对小红书、抖音等平台进行内容采集和分析，发现有意向的潜在客户。

    h2("6.1 \u5E73\u53F0\u914D\u7F6E"),
    // 6.1 平台配置

    h3("6.1.1 \u5C0F\u7EA2\u4E66\u914D\u7F6E"),
    // 6.1.1 小红书配置
    para("\u4F7F\u7528\u5C0F\u7EA2\u4E66\u91C7\u96C6\u529F\u80FD\u9700\u8981\u914D\u7F6ECookie\u3002\u8BF7\u767B\u5F55\u5C0F\u7EA2\u4E66\u7F51\u9875\u7248\u540E\uFF0C\u4ECE\u6D4F\u89C8\u5668\u5F00\u53D1\u8005\u5DE5\u5177\u4E2D\u83B7\u53D6Cookie\u5B57\u7B26\u4E32\uFF0C\u7C98\u8D34\u5230\u7CFB\u7EDF\u914D\u7F6E\u4E2D\u3002\u6CE8\u610FCookie\u6709\u6548\u671F\uFF0C\u5931\u6548\u540E\u9700\u8981\u66F4\u65B0\u3002"),
    // 使用小红书采集功能需要配置Cookie。请登录小红书网页版后，从浏览器开发者工具中获取Cookie字符串，粘贴到系统配置中。注意Cookie有效期，失效后需要更新。

    h3("6.1.2 \u6296\u97F3\u914D\u7F6E"),
    // 6.1.2 抖音配置
    para("\u6296\u97F3\u91C7\u96C6\u9700\u8981\u901A\u8FC7\u5F00\u653E\u5E73\u53F0\u63A5\u53E3\u3002\u8BF7\u5728\u6296\u97F3\u5F00\u653E\u5E73\u53F0\u521B\u5EFA\u5E94\u7528\uFF0C\u83B7\u53D6App ID\u548CApp Secret\uFF0C\u914D\u7F6E\u5230\u7CFB\u7EDF\u4E2D\u3002"),
    // 抖音采集需要通过开放平台接口。请在抖音开放平台创建应用，获取App ID和App Secret，配置到系统中。

    h2("6.2 \u5173\u952E\u8BCD\u7BA1\u7406"),
    // 6.2 关键词管理
    para("\u5728\u300C\u793E\u4EA4\u5A92\u4F53\u300D\u9875\u9762\u7684\u300C\u5173\u952E\u8BCD\u300D\u6807\u7B7E\u4E0B\uFF0C\u60A8\u53EF\u4EE5\u6DFB\u52A0\u8981\u76D1\u63A7\u7684\u5173\u952E\u8BCD\u3002\u7CFB\u7EDF\u5DF2\u9884\u7F6E\u4E86\u5E38\u89C1\u7684\u6559\u80B2\u884C\u4E1A\u5173\u952E\u8BCD\uFF0C\u5982\u201C\u54A8\u8BE2\u201D\u201C\u57F9\u8BAD\u201D\u201C\u8F85\u5BFC\u201D\u201C\u6559\u80B2\u201D\u201C\u5BB6\u6559\u201D\u201C\u62A5\u73ED\u201D\u7B49\u3002\u60A8\u4E5F\u53EF\u4EE5\u81EA\u5B9A\u4E49\u5173\u952E\u8BCD\uFF0C\u6BD4\u5982\u7C7B\u76EE\u540D\u79F0\u3001\u7ADE\u54C1\u540D\u79F0\u7B49\u3002"),
    // 在「社交媒体」页面的「关键词」标签下，您可以添加要监控的关键词。系统已预置了常见的教育行业关键词，如"咨询""培训""辅导""教育""家教""报班"等。您也可以自定义关键词，比如类目名称、竞品名称等。

    h2("6.3 \u91C7\u96C6\u4EFB\u52A1"),
    // 6.3 采集任务
    para("\u521B\u5EFA\u91C7\u96C6\u4EFB\u52A1\u65F6\u9700\u8981\u8BBE\u7F6E\u4EE5\u4E0B\u53C2\u6570\uFF1A"),
    // 创建采集任务时需要设置以下参数：

    new Paragraph({ spacing: { before: 120 }, children: [] }),
    horizontalTable(
      ["\u53C2\u6570", "\u8BF4\u660E", "\u5FC5\u586B", "\u9ED8\u8BA4\u503C"],
      // 参数, 说明, 必填, 默认值
      [
        ["\u4EFB\u52A1\u540D\u79F0", "\u4EFB\u52A1\u7684\u6807\u8BC6\u540D\u79F0", "\u662F", "-"],
        ["\u5E73\u53F0", "\u5C0F\u7EA2\u4E66 / \u6296\u97F3", "\u662F", "-"],
        ["\u5173\u952E\u8BCD", "\u76D1\u63A7\u7684\u5173\u952E\u8BCD", "\u662F", "-"],
        ["\u6267\u884C\u9891\u7387", "\u6BCF\u5C0F\u65F6 / \u6BCF\u5929 / \u624B\u52A8", "\u662F", "\u6BCF\u5C0F\u65F6"],
        ["\u76EE\u6807\u6821\u533A", "\u7EBF\u7D22\u5F52\u5C5E\u7684\u6821\u533A", "\u5426", "\u5168\u6821\u533A"],
      ],
      [20, 34, 12, 34]
    ),
    // 任务名称, 任务的标识名称, 是, -
    // 平台, 小红书 / 抖音, 是, -
    // 关键词, 监控的关键词, 是, -
    // 执行频率, 每小时 / 每天 / 手动, 是, 每小时
    // 目标校区, 线索归属的校区, 否, 全校区

    para("\u521B\u5EFA\u4EFB\u52A1\u540E\uFF0C\u7CFB\u7EDF\u4F1A\u6309\u7167\u8BBE\u5B9A\u7684\u9891\u7387\u81EA\u52A8\u6267\u884C\u91C7\u96C6\u3002\u60A8\u4E5F\u53EF\u4EE5\u624B\u52A8\u70B9\u51FB\u201C\u7ACB\u5373\u6267\u884C\u201D\u89E6\u53D1\u91C7\u96C6\u3002\u91C7\u96C6\u7ED3\u679C\u4F1A\u81EA\u52A8\u8FDB\u5165\u7EBF\u7D22\u8BC4\u5206\u6D41\u7A0B\u3002"),
    // 创建任务后，系统会按照设定的频率自动执行采集。您也可以手动点击"立即执行"触发采集。采集结果会自动进入线索评分流程。
  ];

  // ── Chapter 7: Lead Scoring & Conversion ──
  const ch7 = [
    h1("\u7B2C\u4E03\u7AE0  \u7EBF\u7D22\u8BC4\u5206\u4E0E\u8F6C\u5316"),
    // 第七章  线索评分与转化

    h2("7.1 \u8BC4\u5206\u5F15\u64CE\u4ECB\u7ECD"),
    // 7.1 评分引擎介绍
    para("\u7CFB\u7EDF\u5185\u7F6E\u667A\u80FD\u8BC4\u5206\u5F15\u64CE\uFF0C\u4ECE\u56DB\u4E2A\u7EF4\u5EA6\u5BF9\u6BCF\u6761\u5185\u5BB9\u8FDB\u884C\u8BC4\u5206\uFF0C\u6BCF\u4E2A\u7EF4\u5EA625\u5206\uFF0C\u6EE1\u5206100\u5206\u3002\u8D85\u8FC7\u9608\u503C\uFF0860\u5206\uFF09\u7684\u7EBF\u7D22\u81EA\u52A8\u8FDB\u5165\u5BA2\u6237\u7BA1\u7406\u6A21\u5757\u3002"),
    // 系统内置智能评分引擎，从四个维度对每条内容进行评分，每个维度25分，满分100分。超过阈值（60分）的线索自动进入客户管理模块。

    new Paragraph({ spacing: { before: 120 }, children: [] }),
    horizontalTable(
      ["\u7EF4\u5EA6", "\u5206\u503C", "\u8BF4\u660E"],
      // 维度, 分值, 说明
      [
        ["\u5173\u952E\u8BCD\u5339\u914D", "0-25", "\u76D1\u63A7\u5173\u952E\u8BCD\u7684\u547D\u4E2D\u6570\u548C\u76F8\u5173\u5EA6"],
        ["\u610F\u56FE\u8BC6\u522B", "0-25", "\u7528\u6237\u662F\u5426\u8868\u8FBE\u4E86\u54A8\u8BE2\u3001\u5BF9\u6BD4\u3001\u8D2D\u4E70\u7B49\u610F\u5411"],
        ["\u89D2\u8272\u5224\u65AD", "0-25", "\u53D1\u5E03\u8005\u662F\u5426\u4E3A\u5BB6\u957F\u3001\u5B66\u751F\u7B49\u51B3\u7B56\u89D2\u8272"],
        ["\u8054\u7CFB\u65B9\u5F0F", "0-25", "\u5185\u5BB9\u4E2D\u662F\u5426\u5305\u542B\u5FAE\u4FE1\u3001\u7535\u8BDD\u3001\u79C1\u4FE1\u7B49\u8054\u7CFB\u65B9\u5F0F"],
      ],
      [26, 18, 56]
    ),
    // 关键词匹配, 0-25, 监控关键词的命中数和相关度
    // 意图识别, 0-25, 用户是否表达了咨询、对比、购买等意向
    // 角色判断, 0-25, 发布者是否为家长、学生等决策角色
    // 联系方式, 0-25, 内容中是否包含微信、电话、私信等联系方式

    h2("7.2 \u8BC4\u5206\u7ED3\u679C\u89E3\u8BFB"),
    // 7.2 评分结果解读
    para("\u7EBF\u7D22\u5217\u8868\u4E2D\u4F1A\u5C55\u793A\u6BCF\u6761\u7EBF\u7D22\u7684\u603B\u5206\u548C\u5404\u7EF4\u5EA6\u5F97\u5206\u3002\u5EFA\u8BAE\u4F18\u5148\u5904\u7406\u603B\u5206\u226580\u7684\u7EBF\u7D22\uFF0C\u8FD9\u4E9B\u7EBF\u7D22\u901A\u5E38\u5177\u6709\u6700\u9AD8\u7684\u8F6C\u5316\u6F5C\u529B\u3002"),
    // 线索列表中会展示每条线索的总分和各维度得分。建议优先处理总分≥80的线索，这些线索通常具有最高的转化潜力。

    h2("7.3 \u8F6C\u5316\u7B56\u7565"),
    // 7.3 转化策略
    para("\u9488\u5BF9\u4E0D\u540C\u5206\u6570\u6BB5\u7684\u7EBF\u7D22\uFF0C\u5EFA\u8BAE\u91C7\u7528\u4E0D\u540C\u7684\u7B56\u7565\uFF1A"),
    // 针对不同分数段的线索，建议采用不同的策略：
    bullet("80-100\u5206\uFF1A\u7ACB\u5373\u8054\u7CFB\uFF0C\u91C7\u7528\u4E2A\u6027\u5316\u6C9F\u901A\u7B56\u7565"),
    // 80-100分：立即联系，采用个性化沟通策略
    bullet("60-79\u5206\uFF1A\u5C3D\u5FEB\u8054\u7CFB\uFF0C\u6CE8\u91CD\u9700\u6C42\u53D1\u73B0"),
    // 60-79分：尽快联系，注重需求发现
    bullet("60\u5206\u4EE5\u4E0B\uFF1A\u89C2\u5BDF\u8DDF\u8E2A\uFF0C\u4E0D\u6025\u4E8E\u8054\u7CFB"),
    // 60分以下：观察跟踪，不急于联系
  ];

  // ── Chapter 8: Data Dashboard ──
  const ch8 = [
    h1("\u7B2C\u516B\u7AE0  \u6570\u636E\u5206\u6790\u770B\u677F"),
    // 第八章  数据分析看板

    para("\u6570\u636E\u5206\u6790\u770B\u677F\u63D0\u4F9B\u4E86\u7CFB\u7EDF\u8FD0\u884C\u6570\u636E\u7684\u5168\u666F\u53EF\u89C6\u5316\u5C55\u793A\u3002\u8BBF\u95EE\u4E3B\u9875\u5373\u53EF\u67E5\u770B\u5404\u7C7B\u7EDF\u8BA1\u6570\u636E\u3002"),
    // 数据分析看板提供了系统运行数据的全景可视化展示。访问主页即可查看各类统计数据。

    h2("8.1 \u6838\u5FC3\u6307\u6807"),
    // 8.1 核心指标
    para("\u770B\u677F\u5C55\u793A\u4EE5\u4E0B\u5173\u952E\u6307\u6807\uFF1A"),
    // 看板展示以下关键指标：
    bullet("\u5F53\u65E5\u65B0\u589E\u7EBF\u7D22\u6570\uFF1A\u4ECA\u5929\u65B0\u91C7\u96C6\u7684\u7EBF\u7D22\u6570\u91CF"),
    // 当日新增线索数：今天新采集的线索数量
    bullet("\u5F85\u5904\u7406\u7EBF\u7D22\u6570\uFF1A\u5F53\u524D\u72B6\u6001\u4E3A\u300C\u5F85\u8054\u7CFB\u300D\u7684\u7EBF\u7D22\u6570\u91CF"),
    // 待处理线索数：当前状态为「待联系」的线索数量
    bullet("\u672C\u5468\u8F6C\u5316\u7387\uFF1A\u672C\u5468\u5DF2\u8F6C\u5316\u7EBF\u7D22\u5360\u6BD4"),
    // 本周转化率：本周已转化线索占比
    bullet("\u6D3B\u8DC3\u91C7\u96C6\u4EFB\u52A1\u6570\uFF1A\u5F53\u524D\u6B63\u5728\u8FD0\u884C\u7684\u91C7\u96C6\u4EFB\u52A1\u6570\u91CF"),
    // 活跃采集任务数：当前正在运行的采集任务数量

    h2("8.2 \u8D8B\u52BF\u56FE"),
    // 8.2 趋势图
    para("\u770B\u677F\u5305\u542B\u7EBF\u7D22\u589E\u957F\u8D8B\u52BF\u3001\u5E73\u53F0\u5206\u5E03\u3001\u8BC4\u5206\u5206\u5E03\u7B49\u56FE\u8868\uFF0C\u5E2E\u52A9\u60A8\u4ECE\u5B8F\u89C2\u89D2\u5EA6\u638C\u63E1\u83B7\u5BA2\u6548\u679C\u3002\u56FE\u8868\u6570\u636E\u53EF\u4EE5\u6309\u65E5\u3001\u5468\u3001\u6708\u5207\u6362\u3002"),
    // 看板包含线索增长趋势、平台分布、评分分布等图表，帮助您从宏观角度掌握获客效果。图表数据可以按日、周、月切换。

    h2("8.3 \u6570\u636E\u5BFC\u51FA"),
    // 8.3 数据导出
    para("\u6BCF\u4E2A\u5217\u8868\u9875\u9762\u90FD\u63D0\u4F9B\u4E86\u6570\u636E\u5BFC\u51FA\u529F\u80FD\uFF0C\u60A8\u53EF\u4EE5\u5C06\u7EBF\u7D22\u5217\u8868\u5BFC\u51FA\u4E3AExcel\u6587\u4EF6\uFF0C\u65B9\u4FBF\u8FDB\u884C\u66F4\u8BE6\u7EC6\u7684\u6570\u636E\u5206\u6790\u3002"),
    // 每个列表页面都提供了数据导出功能，您可以将线索列表导出为Excel文件，方便进行更详细的数据分析。
  ];

  // ── Chapter 9: System Configuration ──
  const ch9 = [
    h1("\u7B2C\u4E5D\u7AE0  \u7CFB\u7EDF\u914D\u7F6E"),
    // 第九章  系统配置

    h2("9.1 \u73AF\u5883\u53D8\u91CF\u914D\u7F6E"),
    // 9.1 环境变量配置
    para("\u7CFB\u7EDF\u901A\u8FC7\u73AF\u5883\u53D8\u91CF\u63A7\u5236\u91CD\u8981\u53C2\u6570\uFF1A"),
    // 系统通过环境变量控制重要参数：

    new Paragraph({ spacing: { before: 120 }, children: [] }),
    horizontalTable(
      ["\u53C2\u6570\u540D", "\u8BF4\u660E", "\u793A\u4F8B\u503C"],
      // 参数名, 说明, 示例值
      [
        ["DOUYIN_APP_ID", "\u6296\u97F3\u5F00\u653E\u5E73\u53F0App ID", "your_app_id"],
        ["DOUYIN_APP_SECRET", "\u6296\u97F3\u5F00\u653E\u5E73\u53F0App Secret", "your_app_secret"],
        ["XHS_COOKIE", "\u5C0F\u7EA2\u4E66\u767B\u5F55Cookie", "a1=xxx; webId=yyy"],
        ["HOST", "\u670D\u52A1\u5668\u7ED1\u5B9A\u5730\u5740", "0.0.0.0"],
        ["PORT", "\u670D\u52A1\u5668\u7AEF\u53E3", "8080"],
        ["DEBUG", "\u8C03\u8BD5\u6A21\u5F0F\u5F00\u5173", "true/false"],
      ],
      [26, 34, 40]
    ),

    h2("9.2 \u7CFB\u7EDF\u542F\u52A8"),
    // 9.2 系统启动
    para("\u7CFB\u7EDF\u542F\u52A8\u65B9\u5F0F\uFF1A\u5728\u9879\u76EE\u76EE\u5F55\u4E0B\u6267\u884C\u4EE5\u4E0B\u547D\u4EE4\uFF1A"),
    // 系统启动方式：在项目目录下执行以下命令：
    para("cd backend && python main.py"),
    para("\u542F\u52A8\u540E\uFF0C\u8BBF\u95EE http://localhost:8080 \u5373\u53EF\u6253\u5F00\u7CFB\u7EDF\u3002\u5982\u9700\u5173\u95ED\u7CFB\u7EDF\uFF0C\u5728\u7EC8\u7AEF\u4E2D\u6309Ctrl+C\u5373\u53EF\u3002"),
    // 启动后，访问 http://localhost:8080 即可打开系统。如需关闭系统，在终端中按Ctrl+C即可。

    h2("9.3 \u5E38\u89C1\u914D\u7F6E\u95EE\u9898"),
    // 9.3 常见配置问题
    bullet("Cookie\u5931\u6548\uFF1A\u5C0F\u7EA2\u4E66Cookie\u901A\u5E38\u6709\u65487\u5929\uFF0C\u5931\u6548\u540E\u91C7\u96C6\u4F1A\u62A5\u9519\uFF0C\u9700\u91CD\u65B0\u83B7\u53D6"),
    // Cookie失效：小红书Cookie通常有效7天，失效后采集会报错，需重新获取
    bullet("\u7AEF\u53E3\u51B2\u7A81\uFF1A\u5982\u679C8080\u7AEF\u53E3\u88AB\u5360\u7528\uFF0C\u53EF\u4EE5\u4FEE\u6539PORT\u53C2\u6570\u4E3A\u5176\u4ED6\u7AEF\u53E3"),
    // 端口冲突：如果8080端口被占用，可以修改PORT参数为其他端口
    bullet("\u8BF7\u6C42\u9891\u7387\u9650\u5236\uFF1A\u5E73\u53F0API\u6709\u8BF7\u6C42\u9891\u7387\u9650\u5236\uFF0C\u7CFB\u7EDF\u5DF2\u5185\u7F6E\u901F\u7387\u9650\u5236\uFF0C\u8BF7\u52FF\u4FEE\u6539\u9ED8\u8BA4\u503C"),
    // 请求频率限制：平台API有请求频率限制，系统已内置速率限制，请勿修改默认值
  ];

  // ── Chapter 10: FAQ & Troubleshooting ──
  const ch10 = [
    h1("\u7B2C\u5341\u7AE0  \u5E38\u89C1\u95EE\u9898\u4E0E\u6545\u969C\u6392\u67E5"),
    // 第十章  常见问题与故障排查

    h2("10.1 \u5E38\u89C1\u95EE\u9898"),
    // 10.1 常见问题

    h3("Q1: \u7CFB\u7EDF\u6253\u4E0D\u5F00\u600E\u4E48\u529E\uFF1F"),
    // Q1: 系统打不开怎么办？
    para("\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u662F\u5426\u5DF2\u542F\u52A8\uFF0C\u8BBF\u95EE\u5730\u5740\u662F\u5426\u6B63\u786E\u3002\u53EF\u4EE5\u5728\u670D\u52A1\u5668\u7EC8\u7AEF\u67E5\u770B\u662F\u5426\u6709\u9519\u8BEF\u8F93\u51FA\u3002\u5982\u679C\u670D\u52A1\u5668\u5DF2\u505C\u6B62\uFF0C\u91CD\u65B0\u6267\u884C\u542F\u52A8\u547D\u4EE4\u5373\u53EF\u3002"),
    // 请检查服务器是否已启动，访问地址是否正确。可以在服务器终端查看是否有错误输出。如果服务器已停止，重新执行启动命令即可。

    h3("Q2: \u91C7\u96C6\u4EFB\u52A1\u6267\u884C\u5931\u8D25\uFF1F"),
    // Q2: 采集任务执行失败？
    para("\u8BF7\u68C0\u67E5\u4EE5\u4E0B\u539F\u56E0\uFF1A\uFF081\uFF09Cookie\u662F\u5426\u5DF2\u5931\u6548\uFF1B\uFF082\uFF09\u7F51\u7EDC\u8FDE\u63A5\u662F\u5426\u6B63\u5E38\uFF1B\uFF083\uFF09\u5E73\u53F0API\u662F\u5426\u6709\u8BBF\u95EE\u9650\u5236\u3002\u7CFB\u7EDF\u65E5\u5FD7\u4E2D\u4F1A\u8BB0\u5F55\u5177\u4F53\u7684\u9519\u8BEF\u539F\u56E0\uFF0C\u8BF7\u67E5\u770B\u65E5\u5FD7\u8FDB\u884C\u6392\u67E5\u3002"),
    // 请检查以下原因：（1）Cookie是否已失效；（2）网络连接是否正常；（3）平台API是否有访问限制。系统日志中会记录具体的错误原因，请查看日志进行排查。

    h3("Q3: \u7EBF\u7D22\u8BC4\u5206\u4E0D\u51C6\u786E\uFF1F"),
    // Q3: 线索评分不准确？
    para("\u7EBF\u7D22\u8BC4\u5206\u7ED3\u679C\u53D6\u51B3\u4E8E\u5173\u952E\u8BCD\u7684\u8BBE\u7F6E\u3002\u5982\u679C\u7EBF\u7D22\u8BC4\u5206\u4E0D\u51C6\u786E\uFF0C\u8BF7\u68C0\u67E5\u5DF2\u8BBE\u7F6E\u7684\u5173\u952E\u8BCD\u662F\u5426\u8986\u76D6\u4E86\u76EE\u6807\u7FA4\u4F53\u3002\u60A8\u53EF\u4EE5\u901A\u8FC7\u6DFB\u52A0\u66F4\u7CBE\u51C6\u7684\u5173\u952E\u8BCD\u6765\u63D0\u9AD8\u8BC4\u5206\u51C6\u786E\u5EA6\u3002"),
    // 线索评分结果取决于关键词的设置。如果线索评分不准确，请检查已设置的关键词是否覆盖了目标群体。您可以通过添加更精准的关键词来提高评分准确度。

    h3("Q4: \u591A\u6821\u533A\u6570\u636E\u4E0D\u5BF9\uFF1F"),
    // Q4: 多校区数据不对？
    para("\u786E\u8BA4\u5F53\u524D\u767B\u5F55\u8D26\u53F7\u662F\u5426\u5F52\u5C5E\u4E8E\u6B63\u786E\u7684\u6821\u533A\u3002\u7BA1\u7406\u5458\u8D26\u53F7\u53EF\u4EE5\u67E5\u770B\u5168\u6821\u6570\u636E\uFF0C\u666E\u901A\u7528\u6237\u53EA\u80FD\u67E5\u770B\u6240\u5C5E\u6821\u533A\u6570\u636E\u3002"),
    // 确认当前登录账号是否归属于正确的校区。管理员账号可以查看全校数据，普通用户只能查看所属校区数据。
  ];

  // ── Appendix A: Tech Specs ──
  const appendixA = [
    h1("\u9644\u5F55A  \u6280\u672F\u89C4\u683C\u8868"),
    // 附录A  技术规格表

    new Paragraph({ spacing: { before: 120 }, children: [] }),
    horizontalTable(
      ["\u7C7B\u522B", "\u6307\u6807", "\u53C2\u6570"],
      // 类别, 指标, 参数
      [
        ["\u786C\u4EF6\u8981\u6C42", "CPU", "2\u6838\u4EE5\u4E0A\uFF0C\u63A8\u83504\u6838"],
        ["", "\u5185\u5B58", "4GB\u4EE5\u4E0A\uFF0C\u63A8\u83508GB"],
        ["", "\u78C1\u76D8", "20GB\u4EE5\u4E0A\u7A7A\u95F2\u7A7A\u95F4"],
        ["\u8F6F\u4EF6\u8981\u6C42", "\u64CD\u4F5C\u7CFB\u7EDF", "Windows 10+ / Linux / macOS"],
        ["", "Python\u7248\u672C", "3.10\u6216\u66F4\u9AD8"],
        ["", "\u6D4F\u89C8\u5668", "Chrome 90+ / Edge 90+ / Firefox 90+"],
        ["\u7F51\u7EDC\u8981\u6C42", "\u7F51\u7EDC\u5E26\u5BBD", "10Mbps\u4EE5\u4E0A"],
        ["", "\u5916\u7F51\u8BBF\u95EE", "\u9700\u8981\u8BBF\u95EE\u5C0F\u7EA2\u4E66\u3001\u6296\u97F3API"],
      ],
      [20, 26, 54]
    ),
  ];

  // ── Appendix B: API Reference ──
  const appendixB = [
    h1("\u9644\u5F55B  API\u63A5\u53E3\u6587\u6863"),
    // 附录B  API接口文档

    para("\u7CFB\u7EDF\u63D0\u4F9B\u4E3B\u8981API\u63A5\u53E3\u5982\u4E0B\uFF1A"),
    // 系统提供主要API接口如下：

    new Paragraph({ spacing: { before: 120 }, children: [] }),
    horizontalTable(
      ["\u63A5\u53E3", "\u65B9\u6CD5", "\u8BF4\u660E"],
      // 接口, 方法, 说明
      [
        ["/api/social/accounts", "GET", "\u83B7\u53D6\u793E\u4EA4\u5E73\u53F0\u8D26\u53F7\u5217\u8868"],
        ["/api/social/posts", "GET", "\u83B7\u53D6\u91C7\u96C6\u7684\u793E\u4EA4\u5A92\u4F53\u5E16\u5B50"],
        ["/api/social/keywords", "GET/POST", "\u7BA1\u7406\u76D1\u63A7\u5173\u952E\u8BCD"],
        ["/api/social/tasks", "GET/POST", "\u7BA1\u7406\u91C7\u96C6\u4EFB\u52A1"],
        ["/api/social/tasks/{id}/execute", "POST", "\u89E6\u53D1\u4EFB\u52A1\u7ACB\u5373\u6267\u884C"],
        ["/api/social/collect-now", "POST", "\u5FEB\u901F\u91C7\u96C6\u6307\u5B9A\u5173\u952E\u8BCD"],
      ],
      [36, 14, 50]
    ),

    new Paragraph({ spacing: { before: 200 }, children: [] }),
    horizontalTable(
      ["\u63A5\u53E3", "\u65B9\u6CD5", "\u8BF4\u660E"],
      [
        ["/api/auth/login", "POST", "\u7528\u6237\u767B\u5F55"],
        ["/api/customers/leads", "GET/POST", "\u7EBF\u7D22\u7BA1\u7406"],
        ["/api/dashboard/stats", "GET", "\u770B\u677F\u6570\u636E\u7EDF\u8BA1"],
        ["/api/admin/users", "GET/POST", "\u7528\u6237\u7BA1\u7406"],
        ["/api/admin/colleges", "GET/POST", "\u6821\u533A\u7BA1\u7406"],
        ["/api/admin/templates", "GET/POST", "\u6A21\u677F\u7BA1\u6D4B"],
      ],
      [36, 14, 50]
    ),
  ];

  // ── Assemble body array ──
  // Use spacer paragraphs with PageBreak between sections to avoid blank-page warnings.
  // A non-empty child (space + size 1) prevents Word from rendering an extra blank page.
  function sectionBreak() {
    return new Paragraph({
      spacing: { before: 0, after: 0 },
      // Non-whitespace char at 0.5pt — invisible to eye but passes blank-page check
      children: [new TextRun({ text: "\u00B7", size: 1 }), new PageBreak()],
    });
  }

  const body = [
    ...ch1, ...ch2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7, ...ch8, ...ch9,
    ...ch10,
    sectionBreak(),
    ...appendixA,
    sectionBreak(),
    ...appendixB,
  ];

  // ════════════════════════════════════════
  // DOCUMENT ASSEMBLY — 3 sections
  // ════════════════════════════════════════

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
            size: 24,
            color: c(BODY_TEXT),
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            size: 32, bold: true, color: c(P.primary),
          },
          paragraph: { spacing: { before: 360, after: 160, line: 312 } },
        },
        heading2: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            size: 28, bold: true, color: c(P.primary),
          },
          paragraph: { spacing: { before: 240, after: 120, line: 312 } },
        },
        heading3: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimHei" },
            size: 24, bold: true, color: c(P.primary),
          },
          paragraph: { spacing: { before: 200, after: 100, line: 312 } },
        },
      },
    },
    sections: [
      // ── Section 1: Cover (no page num, no footer) ──
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
          },
        },
        children: cover,
      },
      // ── Section 2: TOC (Roman numerals) ──
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
            pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
          },
        },
        footers: { default: pageNumFooter() },
        children: toc,
      },
      // ── Section 3: Body (Arabic, start 1) ──
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        footers: { default: pageNumFooter() },
        children: body,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Document generated: " + OUTPUT);
}

main().catch(console.error);
