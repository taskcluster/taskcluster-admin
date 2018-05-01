const chalk = require('chalk');

/**
 * Given the output from the 'diff' package, format it onscreen as a unified diff
 *
 * If context is set, lines more than this distance from another diff will not be
 * shown.
 */
exports.showDiff = ({diffs, context}) => {
  const lastIndex = diffs.length - 1;
  diffs.forEach((diff, i) => {
    const lines = diff.value.trimRight().split(/\n/);
    const first = i === 0;
    const last = i === lastIndex;
    if (diff.added) {
      lines.forEach(l => console.log(chalk.green('+' + l)));
    } else if (diff.removed) {
      lines.forEach(l => console.log(chalk.red('-' + l)));
    } else if (context && lines.length > context * 2) {
      if (!first) {
        lines.slice(0, context).forEach(l => console.log(' ' + l));
      }
      console.log(chalk.bold('...'));
      if (!last) {
        lines.slice(-context).forEach(l => console.log(' ' + l));
      }
    } else {
      lines.forEach(l => console.log(' ' + l));
    }
  });
};
