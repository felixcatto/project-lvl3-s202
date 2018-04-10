import os from 'os';
import fs from 'mz/fs';
import path from 'path';
import nock from 'nock';
import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http';
import {
  loadPage,
  getIndexFilename,
  beautifyHtml,
} from '../src';


axios.defaults.adapter = httpAdapter;

const protocol = 'https://';
const host = 'hexlet.io';
const pathname = '/courses';
const baseUrl = `${protocol}${host}`;
const url = `${protocol}${host}${pathname}`;
const tmpOutputDir = `${os.tmpdir()}/loader-tmp-`;

const paths = {
  html: path.resolve(__dirname, '__fixtures__/index.html'),
};

test('index page have loaded with right content', async () => {
  const outputDir = fs.mkdtempSync(tmpOutputDir);
  const rawHtmlFile = await fs.readFile(paths.html, 'utf8');

  const htmlFile = beautifyHtml(rawHtmlFile);
  nock(baseUrl)
    .get(pathname)
    .reply(200, htmlFile);
  await loadPage(outputDir, url);

  const loadedHtmlFilePath = path.resolve(outputDir, getIndexFilename(url));
  const loadedHtmlFile = await fs.readFile(loadedHtmlFilePath, 'utf8');

  expect(loadedHtmlFile).toBe(htmlFile);
});
