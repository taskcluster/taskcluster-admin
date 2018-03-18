module.exports.setup = (program) => {
  return program
    .command('aws-s3-credentials <level> <bucket> <prefix>')
    .description('Get AWS S3 credentials');
};

module.exports.run = async (level, bucket, prefix) => {
  var taskcluster = require('taskcluster-client');
  var auth = new taskcluster.Auth();
  var chalk = require('chalk');

  var res = await auth.awsS3Credentials(level, bucket, prefix);
  console.log(chalk.yellow('expires:'), res.expires);
  ['accessKeyId', 'secretAccessKey', 'sessionToken'].forEach(function(k) {
    console.log(chalk.yellow(k + ':'), res.credentials[k]);
  });
};
