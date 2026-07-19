const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';

const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(100000);
const bytesRead = fs.readSync(fd, buf, 0, 100000, 147);
fs.closeSync(fd);

const content = buf.toString('binary', 0, bytesRead);

// Find stream content - between "stream\r\n" and "\r\nendstream" or "stream\n" and "\nendstream"
let xmpData = '';
const idx1 = content.indexOf('stream\r\n');
const idx2 = content.indexOf('stream\n');
const streamIdx = idx1 >= 0 ? idx1 : idx2;
const eidx1 = content.indexOf('\r\nendstream');
const eidx2 = content.indexOf('\nendstream');
const endIdx = eidx1 >= 0 ? eidx1 : eidx2;

if (streamIdx >= 0 && endIdx > streamIdx) {
    const afterStream = streamIdx + (idx1 >= 0 ? 8 : 7); // "stream\r\n" = 8 chars, "stream\n" = 7 chars
    xmpData = content.substring(afterStream, endIdx);
    console.log('=== XMP Metadata ===');
    console.log(xmpData.substring(0, 15000));
} else {
    console.log('streamIdx:', streamIdx, 'endIdx:', endIdx);
    console.log(content.substring(0, 2000));
}
