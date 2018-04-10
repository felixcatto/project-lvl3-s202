import os from 'os';
import fs from 'mz/fs';
import path from 'path';
import nock from 'nock';
import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http';
import {
  loadPage,
  getIndexFilename,
  getAssetFilepath,
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
  htmlWithReplacedLinks: path.resolve(__dirname, '__fixtures__/index2.html'),
  cssFile: path.resolve(__dirname, '__fixtures__/index.css'),
  jsFile: path.resolve(__dirname, '__fixtures__/index.jsi'),
  imgFile: path.resolve(__dirname, '__fixtures__/scared.png'),
};

const errorObj = {
  config: {
    url,
  },
  response: {
    status: 404,
  },
};


test('index page have loaded with right content', async () => {
  const outputDir = fs.mkdtempSync(tmpOutputDir);
  const rawHtmlFile = await fs.readFile(paths.html, 'utf8');
  const rawReplacedHtmlFile = await fs.readFile(paths.htmlWithReplacedLinks, 'utf8');

  nock(baseUrl)
    .get(pathname)
    .reply(200, rawHtmlFile);
  await loadPage(outputDir, url);

  const replacedHtmlFile = beautifyHtml(rawReplacedHtmlFile);
  const loadedHtmlFilePath = path.resolve(outputDir, getIndexFilename(url));
  const loadedHtmlFile = await fs.readFile(loadedHtmlFilePath, 'utf8');

  expect(loadedHtmlFile).toBe(replacedHtmlFile);
});


test('all resources are loaded with right content', async () => {
  const outputDir = fs.mkdtempSync(tmpOutputDir);
  const rawHtmlFile = await fs.readFile(paths.html, 'utf8');
  const cssFile = await fs.readFile(paths.cssFile, 'utf8');
  const jsFile = await fs.readFile(paths.jsFile, 'utf8');
  const imgFile = await fs.readFile(paths.imgFile);
  nock(baseUrl)
    .get(pathname)
    .reply(200, rawHtmlFile)
    .get('/assets/index.css')
    .reply(200, cssFile)
    .get('/js/index.jsi')
    .reply(200, jsFile)
    .get('/assets/img/scared.png')
    .reply(200, imgFile)
    .get('/assets/img/not-exists.jpg')
    .reply(404, errorObj);
  await loadPage(outputDir, url);

  const links = ['/assets/index.css', 'assets/img/scared.png', '/js/index.jsi'];
  const loadedAssetPaths = links.map(link => getAssetFilepath(outputDir, url, link));
  const loadedAssetFiles = loadedAssetPaths.map(assetPath => (assetPath.endsWith('.png')
    ? fs.readFileSync(assetPath)
    : fs.readFileSync(assetPath, 'utf8')
  ));
  expect(loadedAssetFiles).toEqual([cssFile, imgFile, jsFile]);
});


test('asset url is correct', () => {
  const result = `${tmpOutputDir}/ru-hexlet-io-courses_files/assets-application.css`;
  const processed = getAssetFilepath(tmpOutputDir, 'https://ru.hexlet.io/courses', '/assets/application.css');
  expect(processed).toBe(result);
});
