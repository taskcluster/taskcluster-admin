import editRole from './util/edit-role';

module.exports.setup = (program) => {
  return program
    .command('make-gecko-branch-role <path> <project> <level>')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('create or update a gecko branch role (repo:hg.mozilla.org/<path>:*)');
};

module.exports.run = async function(path, project, level, options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var arrayDiff = require('simple-array-diff');

  var roleId = 'repo:hg.mozilla.org/' + path + ':*';
  var scopes = [
    'assume:moz-tree:level:<level>',
    'queue:route:index.buildbot.branches.<project>.*',
    'queue:route:index.buildbot.revisions.*',
    'queue:route:index.docker.images.v1.<project>.*',
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

  var description = [
    '*DO NOT EDIT*',
    '',
    `Scopes for tasks triggered from pushes to https://hg.mozilla.org/${path}`,
    '',
    'This role is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
  ].join('\n');

  await editRole({
    roleId,
    description,
    scopes,
    noop: options.noop,
  });
};
