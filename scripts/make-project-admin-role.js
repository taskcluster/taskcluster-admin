module.exports = (program) => {
  program
    .command('make-project-admin-role <project>')
    .description('create or update a project-admin role')
    .action(run);
};

function run(project) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var auth = new taskcluster.Auth();

  var roleId = 'project-admin:' + project;
  var scopes = [
    'auth:create-client:project/<project>/*',
    'auth:create-role:hook-id:project-<project>/*',
    'auth:create-role:project:<project>:*',
    'auth:delete-client:project/<project>/*',
    'auth:delete-role:hook-id:project-<project>/*',
    'auth:delete-role:project:<project>:*',
    'auth:disable-client:project/<project>/*',
    'auth:enable-client:project/<project>/*',
    'auth:reset-access-token:project/<project>/*',
    'auth:update-client:project/<project>/*',
    'auth:update-role:hook-id:project-<project>/*',
    'auth:update-role:project:<project>:*',
    'hooks:modify-hook:project-<project>/*',
    'project:<project>:*',
    'queue:get-artifact:project/<project>/*',
    'queue:route:index.project.<project>.*',
    'index:insert-task:project.<project>.*',
    'secrets:get:project/<project>/*',
    'secrets:set:project/<project>/*',
  ].map((scope) => scope.replace('<project>', project));

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
        description: 'Project administrative scopes for ' + project,
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

