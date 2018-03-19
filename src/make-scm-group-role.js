const editRole = require('./util/edit-role');
const {getProjects, hgmoPath} = require('./util/projects');

module.exports.setup = (program) => {
  return program
    .command('make-scm-group-role <group>')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('create or update a mozilla-group:scm_foo role, based on production-branches.json');
};

module.exports.run = async (group, options) => {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var auth = new taskcluster.Auth();

  // find the list of projects with this group
  var projects = await getProjects();
  var projectsWithGroup = Object.keys(projects)
    .filter(p => projects[p].access === group)
    .map(p => projects[p]);

  var roleId = 'mozilla-group:active_' + group;
  var scopes = projectsWithGroup.map(project => {
    let path = hgmoPath(project);
    return `assume:repo:hg.mozilla.org/${path}:*`;
  });

  var description = [
    '*DO NOT EDIT*',
    '',
    'Scopes for members of this group, based on repos with this access level',
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

