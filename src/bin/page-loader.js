#!/usr/bin/env node
import program from 'commander';
import { loadPage, defaultOutputDir } from '../';
import { version } from '../../package.json';


program
  .version(version)
  .description('Load page by given url and saves it to given folder')
  .arguments('<url>')
  .option('-o, --output <directory>', 'Output directory', defaultOutputDir)
  .action((url) => {
    loadPage(program.output, url);
  })
  .parse(process.argv);
