const editRole = require('./util/edit-role');
const {ACTION_HOOKS} = require('./util/action-hooks');
const taskcluster = require('taskcluster-client');
const chalk = require('chalk');
const _ = require('lodash');

module.exports.setup = (program) => {
  return program
    .command('update-action-hook-perms')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description([
      'Update action-related `hooks:trigger-hook:` scopes in `project-{gecko,comm}:in-tree-action-trigger:`',
      'roles',
    ].join('\n'));
};

module.exports.run = async function(options) {
  const auth = new taskcluster.Auth();
  let toEdit = [];

  // enumerate all maching roles (so we delete things as necessary)
  const roles = await auth.listRoles();
  for (let role of roles) {
    const match = role.roleId.match(/^project-(gecko|comm):in-tree-action-trigger:(.*)$/);
    if (!match) {
      continue;
    }
    const trustDomain = match[2];
    const group = match[2];
    toEdit.push([trustDomain, group]);
  }

  // and enumerate the expected roles
  for (let {trustDomain, groups} of ACTION_HOOKS) {
    for (let group of groups) {
      toEdit.push([trustDomain, group]);
    }
  }
 
  toEdit = _.uniqBy(toEdit, ([trustDomain, group]) => `${trustDomain}:${group}`);
  for (let [trustDomain, group] of toEdit) {
    // find the expected actions
    const expectedActions = ACTION_HOOKS.filter(
      ah => ah.groups.includes(group) && ah.trustDomain === trustDomain);
    const scopes = expectedActions.map(({trustDomain, level, actionPerm}) =>
      `hooks:trigger-hook:project-${trustDomain}/in-tree-action-${level}-${actionPerm}_*`);

    await editRole({
      roleId: `project-${trustDomain}:in-tree-action-trigger:${group}`,
      description: [
        '*DO NOT EDIT*',
        '',
        `Permissions to trigger ${trustDomain}-related hooks for ${group}. This role should`,
        `be assumed by \`mozilla-group:${group}\`.`,
        '',
      ].join('\n'),
      scopes,
      noop: options.noop,
    });
  }
};
