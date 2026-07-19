const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';
const stat = fs.statSync(pdfPath);
const fileSize = stat.size;

// Read last 200KB to get the xref table and trailer
const readSize = Math.min(200 * 1024, fileSize);
const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(readSize);
fs.readSync(fd, buf, 0, readSize, fileSize - readSize);
fs.closeSync(fd);

const tail = buf.toString('utf-8');
console.log('=== PDF Trailer (last 200KB) ===');
console.log(tail.substring(0, 5000));
