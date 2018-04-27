const chalk = require('chalk');
const _ = require('lodash');
const taskcluster = require('taskcluster-client');
const {diffJson} = require('diff');
const {showDiff} = require('./show-diff');

const editProvisionerWorkerType = async ({workerType, original, updated, noop}) => {
  const provisioner = new taskcluster.AwsProvisioner();

  var diffs = diffJson(original, updated);
  if (_.find(diffs, {added: true}) || _.find(diffs, {removed: true})) {
    console.log(chalk.green.bold(`changes required for workerType ${workerType}:`));
    showDiff({diffs, context: 8});
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
