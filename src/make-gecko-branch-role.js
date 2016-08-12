module.exports.setup = (program) => {
  return program
    .command('make-gecko-branch-role <path> <project> <level>')
    .description('create or update a gecko branch role (repo:hg.mozilla.org/<path>:*)');
};

module.exports.run = function(path, project, level) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var auth = new taskcluster.Auth();

  var roleId = 'repo:hg.mozilla.org/' + path + ':*';
  var scopes = [
    'assume:moz-tree:level:<level>',
    'queue:rerun-task',
    'queue:route:index.buildbot.branches.<project>.*',
    'queue:route:index.buildbot.revisions.*',
    'queue:route:index.docker.images.v1.<project>.*',
    'queue:route:index.gecko.v1.<project>.*',
    'queue:route:index.gecko.v2.<project>.*',
    'queue:route:tc-treeherder-stage.<project>.*',
    'queue:route:tc-treeherder.<project>.*',
    'queue:route:coalesce.v1.builds.<project>.*',
  ].map((scope) =>
    scope
    .replace('<project>', project)
    .replace('<level>', level)

  );

  auth.role(roleId).catch((err) => {
    if (err.statusCode == 404) {
      return;
    }
    throw err;
  }).then((role) => {
    if (role) {
      console.log(chalk.green.bold('updating role'));
      return auth.updateRole(roleId, {
        description: role.description,
        scopes,
      });
    } else {
      console.log(chalk.green.bold('creating role'));
      return auth.createRole(roleId, {
        description: 'Scopes for tasks triggered from https://hg.mozilla.org/' + path,
        scopes,
      });
    }
  }).then(() => {
    console.log(chalk.green.bold('done'));
  }).catch((err) => {
    console.log(err);
    process.exit(1);
  });
};

