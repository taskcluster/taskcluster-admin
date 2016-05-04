module.exports = (program) => {
  program
    .command('aws-s3-credentials <level> <bucket> <prefix>')
    .description('Get AWS S3 credentials')
    .action(run);
};

function run(level, bucket, prefix) {
  var taskcluster = require('taskcluster-client');
  var auth = new taskcluster.Auth();
  var chalk = require('chalk');

  auth.awsS3Credentials(level, bucket, prefix).then(function(res) {
    console.log(chalk.yellow('expires:'), res.expires);
    ['accessKeyId', 'secretAccessKey', 'sessionToken'].forEach(function(k) {
      console.log(chalk.yellow(k + ':'), res.credentials[k]);
    })
  }).catch((err) => {
    console.log(err);
    process.exit(1);
  });
};


