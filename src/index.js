import URL from 'url';
import path from 'path';
import fs from 'mz/fs';
import axios from 'axios';
import cheerio from 'cheerio';
import { uniq } from 'lodash';
import beautify from 'js-beautify';
import debug from 'debug';
import Listr from 'listr';
import fileTypes from './fileTypes';


const log = debug('page-loader');

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

      const { host: assetHost, path: assetPath } = URL.parse(assetUrl);
      if (assetPath.startsWith('//')) return false;

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
  log(`Start loading ${url}`);
  const { protocol, host, pathname } = URL.parse(url);
  const baseUrl = `${protocol}//${host}`;
  const filename = getIndexFilename(url);
  const filepath = path.resolve(outputDir, filename);
  const relativeAssetsDir = getRelativeAssetsDir(host, pathname);
  const assetsDir = getAssetsDir(outputDir, host, pathname);
  let indexContent;
  let assets;

  const loadInitialUrl = initialUrl => axios.get(initialUrl)
    .then(({ data: indexHtml }) => {
      log(`Loaded ${initialUrl}`);
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
    });

  const loadInitialUrlTask = new Listr([{
    title: `Loading page ${url}`,
    task: () => loadInitialUrl(url),
  }]);

  return loadInitialUrlTask.run()
    .then(() => {
      const loadAsset = asset => axios
        .get(`${baseUrl}${asset.link}`, asset.file.axiosConfig)
        .then((loadedAsset) => {
          const { path: assetPath } = URL.parse(loadedAsset.config.url);
          log(`${loadedAsset.status}: ${assetPath}`);
          const iasset = assets.find(el => el.link === assetPath);
          iasset.data = loadedAsset.data;
        })
        .catch((e) => {
          const { path: assetPath } = URL.parse(e.config.url);
          log(`${e.status}: ${assetPath}`);
          console.error(`${e.status}: ${e.config.url}`);
          assets = assets.filter(el => el.link !== assetPath);
        });

      const loadAssetsTask = new Listr(assets.map(asset => ({
        title: `loading asset ${asset.link}`,
        task: () => loadAsset(asset),
      })), { concurrent: true });

      return loadAssetsTask.run();
    })
    .then(() => fs.writeFile(filepath, indexContent))
    .then(() => fs.mkdir(assetsDir))
    .catch((e) => {
      if (e.code === 'EEXIST') return '';
      console.error(e.message);
      return Promise.reject(e);
    })
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
