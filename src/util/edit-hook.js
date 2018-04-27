const chalk = require('chalk');
const taskcluster = require('taskcluster-client');
const {diffLines} = require('diff');
const {showDiff} = require('./show-diff');
const yaml = require('js-yaml');

const editHook = async ({hookGroupId, hookId, metadata, schedule, task, triggerSchema, noop}) => {
  const newHook = {
    metadata,
    schedule,
    task,
    triggerSchema,
  };

  const hooks = new taskcluster.Hooks();
  let hook = {};
  try {
    hook = await hooks.hook(hookGroupId, hookId);
    delete hook['hookId'];
    delete hook['hookGroupId'];
    delete hook['expires'];
    delete hook['deadline'];
  } catch (err) {
    if (err.statusCode !== 404) {
      throw err;
    }
  }

  const diffs = diffLines(
    yaml.safeDump(hook, {sortKeys: true, flowLevel: -1}),
    yaml.safeDump(newHook, {sortKeys: true, flowLevel: -1}));
  let diffsFound = false;
  diffs.forEach(diff => {
    if (diff.added || diff.removed) {
      diffsFound = true;
    }
  });

  if (diffsFound) {
    console.log(chalk.green.bold(`changes required for hook ${hookGroupId}/${hookId}:`));
    showDiff({diffs, context: 8});
  } else {
    console.log(chalk.green.bold(`no changes required for hook ${hookGroupId}/${hookId}`));
  }

  if (!noop && diffsFound) {
    try {
      if (hook.task) {
        console.log(chalk.green.bold('updating hook'));
        await hooks.updateHook(hookGroupId, hookId, newHook);
      } else {
        console.log(chalk.green.bold('creating hook'));
        await hooks.createHook(hookGroupId, hookId, newHook);
      }
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
    console.log(chalk.green.bold('done'));
  }
};

module.exports = editHook;

