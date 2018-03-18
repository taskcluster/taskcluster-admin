function replace(repl, replaces) {
  var match = /(ami-[0-9a-f]*):(ami-[0-9a-f]*)/.exec(repl);
  if (!match) {
    throw new Error('--replace option must be in the format ami-OLD:ami-NEW');
  }
  replaces.push({oldAmi: match[1], newAmi: match[2]});
  return replaces;
}

module.exports.setup = (program) => {
  return program
    .command('update-worker-amis [workerTypes...]')
    .description('update one or more workerTypes, replacing AMI IDs as given in the options')
    .option('-r, --replace [ami-OLD:ami-NEW]', 'Replace AMI ID ami-OLD with ami_NEW', replace, [])
    .option('--all', 'Operate on all workerTypes')
    .option('--noop', 'Do not write back changes');
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
    console.log(chalk.green.bold(`updating ${workerType}`));

    const wtDef = await awsProvisioner.workerType(workerType);
    let changed = false;
    wtDef.regions.forEach(region => {
      const imageId = region.launchSpec.ImageId;
      options.replace.forEach(({oldAmi, newAmi}) => {
        if (region.launchSpec.ImageId === oldAmi) {
          region.launchSpec.ImageId = newAmi;
          console.log(chalk.yellow(`replaced ${oldAmi} with ${newAmi} in region ${region.region}`));
          changed = true;
        }
      });
    });

    if (changed && !options.noop) {
      console.log(chalk.red('writing back'));
      delete wtDef['workerType'];
      delete wtDef['lastModified'];
      await awsProvisioner.updateWorkerType(workerType, wtDef);
    }
  }
};

