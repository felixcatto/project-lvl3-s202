import URL from 'url';
import path from 'path';
import util from 'util';
import fs from 'mz/fs';
import axios from 'axios';
import cheerio from 'cheerio';
import { uniq } from 'lodash';
import beautify from 'js-beautify';
import mkdirpCB from 'mkdirp';
import debug from 'debug';
import fileTypes from './fileTypes';


const mkdirp = util.promisify(mkdirpCB);
const log = debug('page-loader');

const resolvePromise = promise => promise
  .then(response => ({ isSuccess: true, response }))
  .catch(response => ({ isSuccess: false, response }));

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

const getRelativeAssetsDir = (...urlParts) => `${replaceNonWordChars(...urlParts)}_files/`;

const getAssetsDir = (outputDir, ...urlParts) =>
  path.resolve(outputDir, getRelativeAssetsDir(...urlParts));

const getIndexFilename = (url) => {
  const { host, pathname } = URL.parse(url);
  const newUrl = replaceNonWordChars(host, pathname);
  return `${newUrl}.html`;
};

const getRelativeAssetFilepath = (hrefRelativePath) => {
  const { dir, name, ext } = path.parse(hrefRelativePath);
  return `${replaceNonWordChars(dir, name)}${ext}`;
};

const getAssetFilepath = (outputDir, url, hrefRelativePath) => {
  const { host, pathname } = URL.parse(url);
  const newRelativePath = getRelativeAssetFilepath(hrefRelativePath);
  return path.resolve(getAssetsDir(outputDir, host, pathname), newRelativePath);
};

const getAssetsLinksFromHTML = ($, host) => {
  const assetsLinks = Array.from($('link, script, img'))
    .map(el => $(el).prop('src') || $(el).prop('href'))
    .filter((assetUrl) => {
      if (!assetUrl) return false;
      const { host: assetHost } = URL.parse(assetUrl);
      return assetHost === null || assetHost === host;
    })
    .map((assetUrl) => {
      const { path: assetPath } = URL.parse(assetUrl);
      return assetPath;
    });
  return uniq(assetsLinks).sort();
};

const changeAssetLinks = ($, relativeAssetsDir, assetLinks) => {
  const replaceLink = (attrName, link) => {
    const newLink = `${relativeAssetsDir}${getRelativeAssetFilepath(link)}`;
    $(`[${attrName}$="${link}"]`).attr(attrName, newLink);
  };
  assetLinks.forEach((link) => {
    ['src', 'href'].forEach(attrName => replaceLink(attrName, link));
  });
};

const loadPage = (outputDir, url) => {
  log('Loading started');
  const { protocol, host, pathname } = URL.parse(url);
  const baseUrl = `${protocol}//${host}`;
  const filename = getIndexFilename(url);
  const filepath = path.resolve(outputDir, filename);
  const relativeAssetsDir = getRelativeAssetsDir(host, pathname);
  const assetsDir = getAssetsDir(outputDir, host, pathname);
  let indexContent;
  let assets;
  return axios.get(url)
    .then(({ data: indexHtml }) => {
      log('index url loaded');
      const $ = cheerio.load(indexHtml, { decodeEntities: false });
      const assetsLinks = getAssetsLinksFromHTML($, host);
      changeAssetLinks($, relativeAssetsDir, assetsLinks);
      indexContent = beautifyHtml($.html());

      assets = assetsLinks
        .map((link) => {
          const { pathname: assetPathname } = URL.parse(link);
          const file = fileTypes.find(fileType => fileType.check(assetPathname));
          return { link, file };
        });
      const loadAssets = assets
        .map(asset => axios.get(`${baseUrl}${asset.link}`, asset.file.axiosConfig))
        .map(resolvePromise);
      return Promise.all(loadAssets);
    })
    .then((loadedAssets) => {
      loadedAssets
        .filter(el => !el.isSuccess)
        .forEach(({ response: e }) => {
          const { path: assetPath } = URL.parse(e.config.url);
          log(`${e.status}: ${assetPath}`);
          assets = assets.filter(el => el.link !== assetPath);
        });
      loadedAssets
        .filter(el => el.isSuccess)
        .forEach(({ response: loadedAsset }) => {
          const { path: assetPath } = URL.parse(loadedAsset.config.url);
          log(`${loadedAsset.status}: ${assetPath}`);
          const asset = assets.find(el => el.link === assetPath);
          asset.data = loadedAsset.data;
        });
    })
    .then(() => mkdirp(outputDir))
    .then(() => mkdirp(assetsDir))
    .then(() => fs.writeFile(filepath, indexContent))
    .then(() => {
      log('Writing assets started');
      const writeAssetsToFiles = assets.map((asset) => {
        const assetFilepath = getAssetFilepath(outputDir, url, asset.link);
        return asset.file.write(assetFilepath, asset.data);
      });
      return Promise.all(writeAssetsToFiles);
    })
    .then(() => {
      log('Loading finished\n');
      return {
        createdFilename: filename,
        outputDir,
      };
    });
};

export {
  loadPage,
  getIndexFilename,
  getAssetFilepath,
  beautifyHtml,
};
