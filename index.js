#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var program = require('commander');

// global options
program
  .version(require('./package.json').version);

// allow each subcommand to set up
fs.readdirSync(path.join(__dirname, 'scripts')).forEach((f) => {
  require('./scripts/' + f)(program);
});

// run
program.parse(process.argv);
