const _ = require('lodash');

module.exports.setup = (program) => {
  return program
    .command('kill-all-workers [workerTypes...]')
    .description('Terminate all instances of the given workerType')
    .option('--all', 'Operate on all workerTypes');
};

module.exports.run = async function(workerTypesOption, options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var awsProvisioner = new taskcluster.AwsProvisioner();
  var workerTypes = workerTypesOption;

  if (options.all) {
    workerTypes = await awsProvisioner.listWorkerTypes();
  }

  while (workerTypes.length) {
    const workerType = workerTypes.pop();
    console.log(chalk.yellow.bold(`terminating instances of ${workerType}`));
    await awsProvisioner.terminateAllInstancesOfWorkerType(workerType);
    console.log(chalk.yellow('done'));
  }
};
