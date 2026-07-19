const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';
const stat = fs.statSync(pdfPath);
const fileSize = stat.fileSize || stat.size;

// Read last 10KB to find the trailer
const readSize = Math.min(10 * 1024, fileSize);
const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(readSize);
fs.readSync(fd, buf, 0, readSize, fileSize - readSize);
fs.closeSync(fd);

const tail = buf.toString('binary');
// Find PDF trailer
const xrefIdx = tail.lastIndexOf('xref');
const trailerIdx = tail.lastIndexOf('trailer');
const startxrefIdx = tail.lastIndexOf('startxref');

console.log('File size:', fileSize);
console.log('Last xref at offset from end:', fileSize - readSize + xrefIdx);
console.log('Last trailer at offset from end:', fileSize - readSize + trailerIdx);

if (xrefIdx >= 0) {
  console.log('\n=== xref section ===');
  console.log(tail.substring(xrefIdx, xrefIdx + 500));
}

if (trailerIdx >= 0) {
  console.log('\n=== trailer section ===');
  console.log(tail.substring(trailerIdx, trailerIdx + 1000));
}

if (startxrefIdx >= 0) {
  console.log('\n=== startxref ===');
  console.log(tail.substring(startxrefIdx, startxrefIdx + 100));
}
