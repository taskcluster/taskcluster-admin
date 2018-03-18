import editRole from './util/edit-role';
import {getProjects, hgmoPath, scmLevel, feature, ALL_FEATURES, ROLE_ROOTS} from './util/projects';

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
      console.log(chalk.red(`Cannot determine project level of ${projectName}.`));
      process.exit(1);
    }

    var domain = project['trust_domain'];
    if (!domain) {
      console.log(chalk.red(`Cannot determine trust domain of ${projectName}.`));
      process.exit(1);
    }

    var roleRoot = ROLE_ROOTS[domain];
    if (!roleRoot) {
      console.log(chalk.red(`Unknown trust domain for ${projectName}.`));
      process.exit(1);
    }

    var path = hgmoPath(project);
    if (!path) {
      console.log(chalk.red(`Unrecognized project repository ${project.repo}`));
      process.exit(1);
    }

    var roleId = `repo:hg.mozilla.org/${path}:*`;
    var scopes = [
      `assume:${roleRoot}:branch:${domain}:level-${level}:${projectName}`,
    ];

    for (let feat of ALL_FEATURES) {
      if (feature(project, feat)) {
        scopes.push(`assume:${roleRoot}:feature:${feat}:${domain}:level-${level}:${projectName}`);
      }
    }

    for (let scope of project.extra_tc_scopes || []) {
      scopes.push(scope);
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
        `assume:${roleRoot}:nightly:level-${level}:${projectName}`,
      ];

      description = [
        '*DO NOT EDIT*',
        '',
        `Scopes for nighlty cron tasks triggered from pushes to https://hg.mozilla.org/${path}`,
        '',
        'This role is configured automatically by ',
        '[taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
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
