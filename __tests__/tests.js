import os from 'os';
import fs from 'fs';
import path from 'path';
import nock from 'nock';
import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http';
import rmrf from 'rimraf';
import {
  loadPage,
  getIndexFilename,
  beautifyHtml,
} from '../src';


const getFileContent = filepath => fs.readFileSync(filepath, 'utf8');

axios.defaults.adapter = httpAdapter;

const protocol = 'https://';
const host = 'hexlet.io';
const pathname = '/courses';
const baseUrl = `${protocol}${host}`;
const url = `${protocol}${host}${pathname}`;
const outputDir = `${os.tmpdir()}/loader-test`;


const getHtmlFile = () => beautifyHtml(getFileContent(path.resolve(__dirname, '__fixtures__/index.html')));

describe('successful requests', () => {
  beforeAll(async () => {
    rmrf.sync(outputDir);
    nock(baseUrl)
      .get(pathname)
      .reply(200, getHtmlFile());
    await loadPage(outputDir, url);
  });

  test('index page have loaded with right content', () => {
    const neededFile = getHtmlFile();
    const loadedHtmlFile = getFileContent(path.resolve(outputDir, getIndexFilename(url)));
    expect(loadedHtmlFile).toBe(neededFile);
  });
});
