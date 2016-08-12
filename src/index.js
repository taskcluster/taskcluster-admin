#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var program = require('commander');

// global options
program
  .version(require('../package.json').version)

// allow each subcommand to set up
fs.readdirSync(__dirname).forEach((f) => {
  if (f.endsWith('.js') && f !== "index.js") {
    var script = require('./' + f)
    script.setup(program).action(function() {
      var p = script.run.apply(script, arguments);
      if (p) {
        p.catch((err) => {
          console.error(err);
          process.exit(1);
        });
      }
    });
  }
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
