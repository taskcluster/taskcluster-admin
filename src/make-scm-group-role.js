import editRole from './util/edit-role';
import {getProjects, hgmoPath} from './util/projects';

// Additional static scopes to be added to generated lists
var STATIC_SCOPES = {
  // Grant any users with scm level 1 (try) access, the capability to run
  // generic-worker unit tests. This really isn't a lot of scopes, but
  // possibly more than we'd want to give to *anyone* so granting with scm
  // level 1 seems like a reasonable control.
  'scm_level_1': ['assume:project:taskcluster:generic-worker-tester']
}

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

  var roleId = 'mozilla-group:' + group;
  var scopes = projectsWithGroup.map(project => {
    let path = hgmoPath(project);
    return `assume:repo:hg.mozilla.org/${path}:*`;
  });

  if (group in STATIC_SCOPES) {
    scopes = scopes.concat(STATIC_SCOPES[group])
  }

  var description = [
    '*DO NOT EDIT*',
    '',
    'Scopes for members of this group, based on repos with this access levels',
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
