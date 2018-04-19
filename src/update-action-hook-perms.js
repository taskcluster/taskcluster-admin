const editRole = require('./util/edit-role');

module.exports.setup = (program) => {
  return program
    .command('update-action-hook-perms')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('update action-related `hooks:trigger-hook:` scopes in mozilla-group:* roles');
};

EXPECTED_PERMS = [
  {group: 'vpn_releasemgt', actions: [
    {trustDomain: 'gecko', level: '3', actionPerm: 'relpromo'},
  ]},
  {group: 'releng', actions: [
    {trustDomain: 'gecko', level: '3', actionPerm: 'relpromo'},
  ]},
];

module.exports.run = async function(options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var _ = require('lodash');

  var auth = new taskcluster.Auth();

  const roles = await auth.listRoles();

  for (let role of roles) {
    const match = role.roleId.match(/^mozilla-group:(.*)$/);
    if (!match) {
      continue;
    }
    const group = match[1];
    if (group.match(/^active_scm_level_[123]/)) {
      // managed by make-scm-group-roles
      continue;
    }

    const expectedPerms = _.find(EXPECTED_PERMS, {group}) || {group, actions: []};
    const scopes = role.scopes
      .filter(scope => !scope.match(/^hooks:trigger-hook:project-(gecko|comm)\/in-tree-action-/))
      .concat(expectedPerms.actions.map(({trustDomain, level, actionPerm}) =>
        `hooks:trigger-hook:project-${trustDomain}/in-tree-action-${level}-${actionPerm}`));

    await editRole({
      roleId: role.roleId,
      description: role.description,
      scopes,
      noop: options.noop,
    });
  }
};
