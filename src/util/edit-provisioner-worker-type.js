const chalk = require('chalk');
const _ = require('lodash');
const taskcluster = require('taskcluster-client');
const {diffJson} = require('diff');

const editProvisionerWorkerType = async ({workerType, original, updated, noop}) => {
  const provisioner = new taskcluster.AwsProvisioner();

  var diff = diffJson(original, updated);
  if (_.find(diff, {added: true}) || _.find(diff, {removed: true})) {
    console.log(chalk.green.bold(`changes required for workerType ${workerType}:`));
    diff.forEach(c =>  {
      if (c.added) {
        process.stdout.write(chalk.green(c.value));
      } else if (c.removed) {
        process.stdout.write(chalk.red(c.value));
      } else {
        process.stdout.write(c.value);
      }
    });
    process.stdout.write('\n');
  } else {
    console.log(chalk.green.bold(`no changes required for workerType ${workerType}`));
    return;
  }

  if (!noop) {
    // remove items returned from workerType() but not valid for updateWorkerType()
    delete updated['workerType'];
    delete updated['lastModified'];
    console.log(chalk.green.bold(`updating workerType ${workerType}`));
    await provisioner.updateWorkerType(workerType, updated);
    console.log(chalk.green.bold('done'));
  }
};

module.exports = editProvisionerWorkerType;
