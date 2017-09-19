import editProvisionerWorkerType from './util/edit-provisioner-worker-type';
import _ from 'lodash';
import {getProjects, hgmoPath, scmLevel, feature} from './util/projects';

const collect = (val, memo) => { memo.push(val); return memo; }
module.exports.setup = (program) => {
  return program
    .command('modify-gecko-provisioner-worker-type [workerTypes...]')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .option('--sg <sg-name>', 'Security group name', collect, [])
    .description('create or update a gecko workerType in the aws-provisionre-v1 provisioner');
};

// Data about get Gecko VPCs.  It'd be nice to fetch this from AWS!
const SECURITY_GROUP_IDS = {
  'us-east-1': {
    'docker-worker': 'sg-12cd3762',
    'rdp-only': 'sg-27d72d57',
    'ssh-only': 'sg-48d52f38',
    'no-inbound': 'sg-7aca300a',
  },
  'us-east-2': {
    'docker-worker': 'sg-28817140=',
    'rdp-only': 'sg-f581719d',
    'ssh-only': 'sg-11807079',
    'no-inbound': 'sg-948171fc',
  },
  'us-west-1': {
    'docker-worker': 'sg-caed26ac',
    'rdp-only': 'sg-fee02b98',
    'ssh-only': 'sg-b7ef24d1',
    'no-inbound': 'sg-5ce02b3a',
  },
  'us-west-2': {
    'docker-worker': 'sg-2728435d',
    'rdp-only': 'sg-3bd7bf41',
    'ssh-only': 'sg-5bd6be21',
    'no-inbound': 'sg-a0d6beda',
  },
  'eu-central-1': {
    'docker-worker': '',
    'rdp-only': '',
    'ssh-only': '',
    'no-inbound': '',
  },
};

const SUBNET_IDS = {
  'us-east-1': {
    'us-east-1a': 'subnet-566e060c',
    'us-east-1b': 'subnet-f2c93496',
    'us-east-1c': 'subnet-c52454e9',
    'us-east-1d': 'subnet-e7e6ccaf',
    'us-east-1e': 'subnet-deb5a8e2',
    'us-east-1f': 'subnet-7f720d73',
  },
  'us-east-2': {
    'us-east-2a': 'subnet-6d481604',
    'us-east-2b': 'subnet-b5db40ce',
    'us-east-2c': 'subnet-ab62c0e6',
  },
  'us-west-1': {
    // no 'a' AZ
    'us-west-1b': 'subnet-7641632e',
    'us-west-1c': 'subnet-48a9b82c',
  },
  'us-west-2': {
    'us-west-2a': 'subnet-d948b6bf',
    'us-west-2b': 'subnet-2eaaba67',
    'us-west-2c': 'subnet-540a9f0f',
  },
  'eu-central-1': {
    'eu-central-1a': 'subnet-935645fb',
    'eu-central-1b': 'subnet-6988da13',
    'eu-central-1c': 'subnet-114d525b',
  },
}

module.exports.run = async function(workerTypes, options) {
  const taskcluster = require('taskcluster-client');
  const chalk = require('chalk');

  const prov = new taskcluster.AwsProvisioner();

  for (let workerType of workerTypes) {
    const original = await prov.workerType(workerType);
    var updated = _.cloneDeep(original);

    // default --sg to the list of securityGroups given by name at the top level launchSpec
    if (updated.launchSpec.SecurityGroups) {
      // steal the security group names from here if not given on the command line
      if (!options.sg.length) {
        options.sg = updated.launchSpec.SecurityGroups;
      }
      delete updated.launchSpec.SecurityGroups;
    }

    updated.regions.forEach(rgn => {
      const rgnSGIDs = SECURITY_GROUP_IDS[rgn.region];
      if (options.sg.length) {
        rgn.launchSpec.SecurityGroupIds = options.sg.map(sgname => {
          const sgid = rgnSGIDs[sgname];
          if (!sgid) {
            throw new Error(`Security group ${sgname} not known for region ${rgn.region}`);
          }
          return sgid;
        });
      }

      // update the AZ configuration, based on the regions
      const rgnSubnets = SUBNET_IDS[rgn.region];
      Object.keys(rgnSubnets).forEach(az => {
        let azconfig = _.find(updated.availabilityZones, {region: rgn.region, availabilityZone: az});
        if (!azconfig) {
          azconfig = {region: rgn.region, availabilityZone: az};
          updated.availabilityZones.push(azconfig);
        }
        if (!azconfig.launchSpec) {
          azconfig.launchSpec = {};
        }
        azconfig.launchSpec.SubnetId = rgnSubnets[az];
      });
    });

    // misc updates
    updated.owner = 'Firefox CI';
    if (updated.description.startsWith('**')) {
      updated.description = 'Worker for Firefox automation';
    }

    await editProvisionerWorkerType({
      workerType,
      original,
      updated,
      noop: options.noop,
    });
  }
};

