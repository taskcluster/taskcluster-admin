import editRole from './util/edit-role';
import {getProjects, hgmoPath, scmLevel, feature} from './util/projects';

module.exports.setup = (program) => {
  return program
    .command('make-gecko-branch-role [projects...]')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .option('--all', 'Operate on all projects')
    .description('create or update a gecko branch role');
};

module.exports.run = async function(projectsOption, options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var arrayDiff = require('simple-array-diff');
  var projects = await getProjects();

  if (options.all) {
    projectsOption = Object.keys(projects);
  }

  while (projectsOption.length) {
    var projectName = projectsOption.pop();
    var project = projects[projectName];
    if (!project) {
      console.log(chalk.red(`Project ${projectName} is not defined in production-branches.json`));
      process.exit(1);
    }

    var level = scmLevel(project);
    if (!level) {
      console.log(chalk.red(`Cannot determine project level`));
      process.exit(1);
    }

    var path = hgmoPath(project);
    if (!path) {
      console.log(chalk.red(`Unrecognized project repository ${project.repo}`));
      process.exit(1);
    }

    var roleId = `repo:hg.mozilla.org/${path}:*`;
    var scopes = [
      'assume:moz-tree:level:<level>',
      'queue:route:index.buildbot.branches.<project>.*',
      'index:insert-task:buildbot.branches.<project>.*',
      'queue:route:index.buildbot.revisions.*',
      'index:insert-task:buildbot.revisions.*',
      'queue:route:index.docker.images.v1.<project>.*',
      'index:insert-task:docker.images.v1.<project>.*',
      'queue:route:index.gecko.v2.<project>.*',
      'index:insert-task:gecko.v2.<project>.*',
      'queue:route:tc-treeherder-stage.<project>.*',
      'queue:route:tc-treeherder.<project>.*',
      'queue:route:tc-treeherder-stage.v2.<project>.*',
      'queue:route:tc-treeherder.v2.<project>.*',
      'queue:route:coalesce.v1.builds.<project>.*',  // deprecated - https://bugzilla.mozilla.org/show_bug.cgi?id=1382204
      'queue:route:coalesce.v1.<project>.*',
      'queue:route:index.releases.v1.<project>.*',
      'project:releng:buildbot-bridge:builder-name:release-<project>-*',
      'project:releng:buildbot-bridge:builder-name:release-<project>_*',
    ].map((scope) =>
      scope
      .replace('<project>', projectName)
      .replace('<level>', level)

    );

    if (feature(project, 'is-trunk')) {
      scopes.push('queue:route:index.gecko.v2.trunk.revision.*');
    }

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

    // cron scopes

    if (feature(project, 'taskcluster-cron')) {
      roleId = `repo:hg.mozilla.org/${path}:cron:nightly-*`;
      scopes = [
        'assume:project:releng:nightly:level-<level>:<project>',
      ].map((scope) =>
        scope
        .replace('<project>', projectName)
        .replace('<level>', level)

      );

      description = [
        '*DO NOT EDIT*',
        '',
        `Scopes for nighlty cron tasks triggered from pushes to https://hg.mozilla.org/${path}`,
        '',
        'This role is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
      ].join('\n');

      // edit the nightly-specific role
      await editRole({
        roleId,
        description,
        scopes,
        noop: options.noop,
      });
    }
  }
};
