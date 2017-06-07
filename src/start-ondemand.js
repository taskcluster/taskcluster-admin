import _ from 'lodash';
import slugid from 'slugid';
import AWS from 'aws-sdk';

module.exports.setup = (program) => {
  return program
    .command('start-ondemand workerType instanceType region availabilityZone')
    .description('start an ondemand instance of the given workerType in the given region');
};

module.exports.run = async function(workerType, instanceType, region, availabilityZone) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var prov = new taskcluster.AwsProvisioner();

  const wt = await prov.workerType(workerType);
  const inst = _.find(wt.instanceTypes, {instanceType});
  if (!inst) {
    console.log(chalk.red("no such instance type"));
    return;
  }
  const rgn = _.find(wt.regions, {region});
  if (!rgn) {
    console.log(chalk.red("no such region type"));
    return;
  }

  const ec2 = new AWS.EC2();

  const token = slugid.nice();
  const secrets = _.assign({}, wt.secrets, rgn.secrets, inst.secrets);
  await await prov.createSecret(token, {
    workerType, 
    secrets: secrets,
    scopes: wt.scopes,
    token,
    expiration: taskcluster.fromNow('100 hours'),
  });

  let userData = _.assign({}, wt.userData, rgn.userData, inst.userData);
  userData = {
    data: userData,
    capacity: inst.capacity,
    workerType,
    provisionerId: 'aws-provisioner-v1',
    region,
    availabilityZone,
    instanceType,
    spotBid: 10.0, // well...
    launchSpecGenerated: new Date().toISOString(),
    lastModified: wt.lastModified.toISOString(),
    provisionerBaseUrl: 'https://aws-provisioner.taskcluster.net/v1',
    securityToken: token,
  };

  const launchSpec = _.assign({}, wt.launchSpec, rgn.launchSpec, inst.launchSpec);
  launchspec.KeyName
  launchspec.Placement.AvailabilityZone = availabilityZone;
  launchSpec.InstanceType = instanceType;
  launchSpec.UserData = new Buffer(JSON.stringify(userData)).toString('base64');

  console.log(userData);
  console.log(launchSpec);
  //var res = await ec2.runInstances({
  //});

  console.log(token);
};

