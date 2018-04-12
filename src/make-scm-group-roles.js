const editRole = require('./util/edit-role');
const {getProjects, hgmoPath} = require('./util/projects');

module.exports.setup = (program) => {
  return program
    .command('make-scm-group-roles')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('create or update a mozilla-group:active_scm_level_[123] roles, based on ci configuration');
};

module.exports.run = async (options) => {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var auth = new taskcluster.Auth();
  var projects = await getProjects();

  for (let level of ['1', '2', '3']) {
    // find the list of projects with this group
    var projectsWithGroup = Object.keys(projects)
      .filter(p => projects[p].access === `scm_level_${level}`)
      .map(p => projects[p]);

    var roleId = `mozilla-group:active_scm_level_${level}`;
    var scopes = projectsWithGroup.map(project => {
      let path = hgmoPath(project);
      return `assume:repo:hg.mozilla.org/${path}:*`;
    });

    var description = [
      '*DO NOT EDIT*',
      '',
      'Scopes for members of this group, allowing actions related to repos at this level.',
      '',
      'This role is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
    ].join('\n');

    await editRole({
      roleId,
      description,
      scopes,
      noop: options.noop,
    });
  }
};

