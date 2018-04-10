import fs from 'mz/fs';


const binaryFiles = ['.jpg', '.jpeg', '.png', '.gif'];

export default [
  {
    type: 'binary',
    axiosConfig: { responseType: 'stream' },
    write: (filepath, readableStream) => readableStream.pipe(fs.createWriteStream(filepath)),
    check: url => binaryFiles.find(ext => url.endsWith(ext)),
  },
  {
    type: 'text',
    axiosConfig: {},
    write: (filepath, content) => fs.writeFile(filepath, content),
    check: url => !binaryFiles.find(ext => url.endsWith(ext)),
  },
];
