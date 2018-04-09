import URL from 'url';
import os from 'os';
import path from 'path';
import util from 'util';
import fs from 'mz/fs';
import axios from 'axios';
import beautify from 'js-beautify';
import mkdirpCB from 'mkdirp';


const defaultOutputDir = `${os.tmpdir()}/loader`;

const mkdirp = util.promisify(mkdirpCB);

const beautifyHtml = html => beautify.html(html, {
  preserve_newlines: false,
  unformatted: [],
  indent_size: 2,
  extra_liners: [],
});

const replaceNonWordChars = (...urlParts) => urlParts
  .map((url) => {
    const newUrl = url.replace(/[^A-Za-z0-9]/g, '-');
    return newUrl.startsWith('-') ? newUrl.slice(1) : newUrl;
  })
  .filter(Boolean)
  .join('-');

const getIndexFilename = (url) => {
  const { host, pathname } = URL.parse(url);
  const newUrl = replaceNonWordChars(host, pathname);
  return `${newUrl}.html`;
};

const loadPage = (outputDir = defaultOutputDir, url) => {
  const filename = getIndexFilename(url);
  const filepath = path.resolve(outputDir, filename);
  let indexContent;
  return axios.get(url)
    .then(({ data: indexHtml }) => {
      indexContent = beautifyHtml(indexHtml);
    })
    .then(() => mkdirp(outputDir))
    .then(() => fs.writeFile(filepath, indexContent))
    .then(() => {
      console.log(`${filename} have created in ${outputDir}`);
    });
};

export {
  loadPage,
  defaultOutputDir,
  getIndexFilename,
  beautifyHtml,
};
