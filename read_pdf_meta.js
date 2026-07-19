const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';

console.log('File exists:', fs.existsSync(pdfPath));
const stat = fs.statSync(pdfPath);
console.log('File size:', (stat.size / 1024 / 1024).toFixed(1), 'MB');

// Read PDF header and metadata area (first 50KB)
const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(50 * 1024);
const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
fs.closeSync(fd);

console.log('Read', bytesRead, 'bytes');

// Show PDF header
const header = buf.toString('ascii', 0, 100);
console.log('PDF header:', header);

// Look for text content in the PDF (text objects)
const raw = buf.toString('utf-8');

// Find all text between parentheses (PDF string objects)
const textItems = [];
let idx = 0;
while (idx < raw.length) {
    const startParen = raw.indexOf('(', idx);
    if (startParen === -1) break;
    const endParen = raw.indexOf(')', startParen);
    if (endParen === -1) break;
    const content = raw.substring(startParen + 1, endParen);
    // Filter: Chinese chars or readable text
    if (/[\u4e00-\u9fff]/.test(content) || (content.length > 3 && /^[\x20-\x7e]+$/.test(content) && !/^%/.test(content))) {
        textItems.push(content);
    }
    idx = endParen + 1;
}

console.log('\n=== Found', textItems.length, 'text items ===');
for (const t of textItems.slice(0, 100)) {
    console.log(t);
}

// Also look for info dictionary
const infoMatch = raw.match(/<<\s*\/Title\s*\(([^)]*)\)/);
if (infoMatch) console.log('\nTitle:', infoMatch[1]);
const authorMatch = raw.match(/\/Author\s*\(([^)]*)\)/);
if (authorMatch) console.log('Author:', authorMatch[1]);
