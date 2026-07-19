const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';

// Object 2 is the XMP metadata stream at offset 147, length 91842
const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(100000);
const bytesRead = fs.readSync(fd, buf, 0, 100000, 147);
fs.closeSync(fd);

const content = buf.toString('binary', 0, bytesRead);
// The stream is between "stream\n" and "\nendstream"
const streamMatch = content.match(/stream\n(.+?)\nendstream/s);
if (streamMatch) {
    console.log('=== XMP Metadata ===');
    console.log(streamMatch[1].substring(0, 10000));
} else {
    console.log('No stream found. First 500 bytes:');
    console.log(content.substring(0, 500));
}
