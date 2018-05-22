const editRole = require('./util/edit-role');
const {ACTION_HOOKS} = require('./util/action-hooks');

module.exports.setup = (program) => {
  return program
    .command('update-action-hook-perms')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('update action-related `hooks:trigger-hook:` scopes in mozilla-group:* roles');
};

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

    // find the expected actions
    const expectedActions = ACTION_HOOKS.filter(ah => ah.groups.includes(group));
    const scopes = role.scopes
      .filter(scope => !scope.match(/^hooks:trigger-hook:project-(gecko|comm)\/in-tree-action-/))
      .concat(expectedActions.map(({trustDomain, level, actionPerm}) =>
        `hooks:trigger-hook:project-${trustDomain}/in-tree-action-${level}-${actionPerm}_*`));

    await editRole({
      roleId: role.roleId,
      description: role.description,
      scopes,
      noop: options.noop,
    });
  }
};
