module.exports.setup = (program) => {
  return program
    .command('make-gecko-branch-role <path> <project> <level>')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('create or update a gecko branch role (repo:hg.mozilla.org/<path>:*)');
};

var description = path => [
  '*DO NOT EDIT*',
  '',
  `Scopes for tasks triggered from pushes to https://hg.mozilla.org/${path}`,
  '',
  'This role is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
].join('\n');

module.exports.run = async function(path, project, level, options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var arrayDiff = require('simple-array-diff');
  var auth = new taskcluster.Auth();

  var roleId = 'repo:hg.mozilla.org/' + path + ':*';
  var scopes = [
    'assume:moz-tree:level:<level>',
    'queue:route:index.buildbot.branches.<project>.*',
    'queue:route:index.buildbot.revisions.*',
    'queue:route:index.docker.images.v1.<project>.*',
    'queue:route:index.gecko.v1.<project>.*',
    'queue:route:index.gecko.v2.<project>.*',
    'queue:route:tc-treeherder-stage.<project>.*',
    'queue:route:tc-treeherder.<project>.*',
    'queue:route:tc-treeherder-stage.v2.<project>.*',
    'queue:route:tc-treeherder.v2.<project>.*',
    'queue:route:coalesce.v1.builds.<project>.*',
  ].map((scope) =>
    scope
    .replace('<project>', project)
    .replace('<level>', level)

  );

  var role;
  try {
    role = await auth.role(roleId);
  } catch (err) {
    if (err.statusCode != 404) {
      throw err;
    }
  }

  var got_scopes = role ? role.scopes : [];
  var diff = arrayDiff(got_scopes, scopes);
  if (diff.removed.length || diff.added.length) {
    console.log(chalk.green.bold(`scope changes required for role ${roleId}:`));
    diff.removed.forEach(s => console.log(chalk.red(`- ${s}`)));
    diff.added.forEach(s => console.log(chalk.green(`+ ${s}`)));
  } else {
    console.log(chalk.green.bold(`no changes required for role ${roleId}:`));
    return;
  }

  if (!options.noop) {
    try {
      if (role) {
        console.log(chalk.green.bold('updating role'));
        await auth.updateRole(roleId, {
          description: description(path),
          scopes,
        });
      } else {
        console.log(chalk.green.bold('creating role'));
        await auth.createRole(roleId, {
          description: description(path),
          scopes,
        });
      }
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
    console.log(chalk.green.bold('done'));
  }
};

