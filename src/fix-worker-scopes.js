import _ from 'lodash';

module.exports.setup = (program) => {
  return program
    .command('fix-worker-scopes [workerTypes...]')
    .description('Fix the scopes for the workerTypes, based on the workerType name')
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
    console.log(chalk.green.bold(`examining ${workerType}`));

    const wtDef = await awsProvisioner.workerType(workerType);
    if (wtDef.scopes.length != 2) {
      console.log(chalk.red.bold('Found unexpected scopes:'));
      console.log(wtDef.scopes);
      process.exit(1);
    }

    const scopes = [
      `assume:worker-type:aws-provisioner-v1/${workerType}`,
      'assume:worker-id:*',
    ];

    if (!_.isEqual(wtDef.scopes, scopes)) {
      console.log(chalk.red("writing back fixed scopes"));
      delete wtDef['workerType'];
      delete wtDef['lastModified'];
      await awsProvisioner.updateWorkerType(workerType, wtDef);
    }
  }
};
