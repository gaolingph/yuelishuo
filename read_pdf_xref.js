const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';
const stat = fs.statSync(pdfPath);
const fileSize = stat.size;

// The xref is at offset 443169459
const xrefOffset = 443169459;

// Read 5000 bytes starting from xref offset
const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(50000);
const bytesRead = fs.readSync(fd, buf, 0, 50000, xrefOffset);
fs.closeSync(fd);

const content = buf.toString('binary', 0, bytesRead);
console.log('=== Content at xref offset ===');
console.log(content.substring(0, 5000));
