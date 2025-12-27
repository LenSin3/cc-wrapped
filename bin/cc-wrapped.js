#!/usr/bin/env node

const { program } = require('commander');
const { generateWrapped } = require('../src/index.js');

program
  .name('cc-wrapped')
  .description('Your year in code, wrapped. Visualize your git history and Claude Code usage.')
  .version('1.0.0')
  .option('-t, --tokens', 'Show Claude Code token usage only')
  .option('-g, --git', 'Show git stats only (no Claude Code tokens)')
  .option('-y, --year <year>', 'Year to analyze (default: current year)', new Date().getFullYear().toString())
  .option('-o, --output <path>', 'Output file path (default: ./wrapped.html)')
  .option('--no-open', 'Do not open the generated HTML in browser')
  .parse(process.argv);

const options = program.opts();

generateWrapped({
  tokensOnly: options.tokens || false,
  gitOnly: options.git || false,
  year: parseInt(options.year),
  outputPath: options.output || './wrapped.html',
  openBrowser: options.open !== false
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
