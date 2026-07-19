const fs = require('fs');

const pdfPath = 'C:\\Users\\Lenovo\\xwechat_files\\wxid_mk1z4birnl0x22_aa32\\msg\\file\\2026-07\\乐说英语品牌手册.pdf';

const fd = fs.openSync(pdfPath, 'r');
const buf = Buffer.alloc(100000);
const bytesRead = fs.readSync(fd, buf, 0, 100000, 147);
fs.closeSync(fd);

// Use the buffer directly as latin1
const content = buf.toString('latin1', 0, bytesRead);

// Find stream content
const streamMarker = 'stream';
const endStreamMarker = 'endstream';

const streamPos = content.indexOf(streamMarker);
const endPos = content.indexOf(endStreamMarker, streamPos + 1);

if (streamPos >= 0 && endPos > streamPos) {
    // Skip past "stream" and any whitespace following it
    let startData = streamPos + streamMarker.length;
    // Skip \r\n, \n, \r
    while (startData < endPos && (content[startData] === '\r' || content[startData] === '\n')) {
        startData++;
    }
    const xmpData = content.substring(startData, endPos);
    // Remove trailing whitespace
    console.log('=== XMP Metadata (length: ' + xmpData.length + ') ===');
    console.log(xmpData.substring(0, 20000));
} else {
    console.log('Not found. streamPos:', streamPos, 'endPos:', endPos);
    console.log('First 2000 bytes:');
    console.log(content.substring(0, 2000));
}
