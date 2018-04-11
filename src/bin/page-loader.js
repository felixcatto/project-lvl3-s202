#!/usr/bin/env node
import program from 'commander';
import { loadPage } from '../';
import { version } from '../../package.json';


const defaultOutputDir = process.cwd();

program
  .version(version)
  .description('Load page by given url and saves it to given folder')
  .arguments('<url>')
  .option('-o, --output <directory>', 'Output directory', defaultOutputDir)
  .action(async (url) => {
    try {
      const { createdFilename, outputDir } = await loadPage(program.output, url);
      console.log(`${createdFilename} have created in ${outputDir}`);
    } catch (e) {
      process.exit(1);
    }
  })
  .parse(process.argv);
