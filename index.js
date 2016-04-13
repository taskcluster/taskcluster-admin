#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var program = require('commander');

// global options
program
  .version(require('./package.json').version)

// allow each subcommand to set up
fs.readdirSync(path.join(__dirname, 'scripts')).forEach((f) => {
  require('./scripts/' + f)(program);
});

// default to showing help
program.command('*')
  .description("..your command here?")
  .action(() => program.help(txt => txt));

// run
program.parse(process.argv);
if (!process.argv.slice(2).length) {
  program.help((txt) => txt);
}
