const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';

const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(100000);
const bytesRead = fs.readSync(fd, buf, 0, 100000, 147);
fs.closeSync(fd);

const content = buf.toString('binary', 0, bytesRead);

// Find stream start
const streamStart = content.indexOf('stream\n');
const streamEnd = content.indexOf('\nendstream');
if (streamStart >= 0 && streamEnd > streamStart) {
    const xmpData = content.substring(streamStart + 7, streamEnd);
    console.log('=== XMP Metadata ===');
    console.log(xmpData.substring(0, 10000));
} else {
    console.log('streamStart:', streamStart, 'streamEnd:', streamEnd);
    console.log(content.substring(0, 1000));
}
