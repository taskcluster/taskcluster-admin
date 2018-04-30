const _ = require('lodash');
const {getProjects, hgmoPath, scmLevel} = require('./util/projects');
const {getTaskclusterYml} = require('./util/tcyml');
const editRole = require('./util/edit-role');
const editHook = require('./util/edit-hook');
const {ACTION_HOOKS} = require('./util/action-hooks');
const chalk = require('chalk');

module.exports.setup = (program) => {
  return program
    .command('make-gecko-action-hooks')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('create or update gecko in-tree action hooks');
};

module.exports.run = async function(options) {
  let taskcluster = require('taskcluster-client');
  let chalk = require('chalk');
  let projects = await getProjects();

  // We build action hooks' task definitions from the latest in-tree `.taskcluster.yml`.
  let taskclusterYml = await getTaskclusterYml(projects['mozilla-central'].repo);

  for (let action of ACTION_HOOKS) {
    const hookGroupId = `project-${action.trustDomain}`;
    const hookId = `in-tree-action-${action.level}-${action.actionPerm}`;
    const {task, triggerSchema} = makeHookDetails(taskclusterYml, action);
    await editHook({
      noop: options.noop,
      hookGroupId,
      hookId,
      metadata: {
        name: `Action task ${action.level}-${action.actionPerm}`,
        description: [
          '*DO NOT EDIT*',
          '',
          'This hook is configured automatically by',
          '[taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
        ].join('\n'),
        owner: 'taskcluster-notifications@mozilla.com',
        emailOnError: false, // true, TODO
      },
      schedule: [],
      task,
      triggerSchema,
    });

    // make the role with scopes assume:repo:<repo>:action:<actionPerm> for each repo at this level
    const projectsAtLevel = Object.keys(projects)
      .filter(p => projects[p].access === `scm_level_${action.level}`)
      .map(p => projects[p]);
    const scopes = projectsAtLevel.map(
      project => `assume:repo:hg.mozilla.org/${hgmoPath(project)}:action:${action.actionPerm}`);
    await editRole({
      roleId: `hook-id:${hookGroupId}/${hookId}`,
      description: [
        '*DO NOT EDIT*',
        '',
        'This role is configured automatically by',
        '[taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
      ].join('\n'),
      scopes,
      noop: options.noop,
    });
  }
};

const makeHookDetails = (taskclusterYml, action) => {
  const task = {
    $let: {
      tasks_for: 'action',
      action: {
        name: '${payload.decision.action.name}',
        title: '${payload.decision.action.title}',
        description: '${payload.decision.action.description}',
        taskGroupId: '${payload.decision.action.taskGroupId}',
        // Calculate the repo_scope.  This is based on user input (the
        // repository), but the hooks service checks that this is satisfied by
        // the `hook-id:<hookGroupId>/<hookId>` role, which is set up above to
        // only contain scopes for repositories at this level. Note that the
        // actionPerm is *not* based on user input, but is fixed in the
        // hookPayload template
        repo_scope: 'assume:repo:${payload.decision.repository.url[8:]}:action:' + action.actionPerm,
        // cb_name is user-specified for generic actions, but not for those with their own actionPerm
        cb_name: action.actionPerm === 'generic' ?
          '${payload.decision.action.cb_name}' :
          action.actionPerm,
        symbol: '${payload.decision.action.symbol}',
      },
      push: {$eval: 'payload.decision.push'},
      repository: {$eval: 'payload.decision.repository'},
      input: {$eval: 'payload.user.input'},
      parameters: {$eval: 'payload.decision.parameters'},
      task: {$eval: 'payload.user.task'},
      taskId: {$eval: 'payload.user.taskId'},
      taskGroupId: {$eval: 'payload.user.taskGroupId'},
      // the hooks service provides the value of the new taskId
      ownTaskId: {$eval: 'taskId'},
    },
    in: taskclusterYml.tasks[0],
  };

  const objSchema = (attrs, properties) => Object.assign({
    type: 'object',
    properties,
    additionalProperties: false,
    required: Object.keys(properties),
  }, attrs);

  const triggerSchema = objSchema({
    description: [
      'Information required to trigger this hook.  This is provided by the `hookPayload`',
      'template in the `actions.json` file generated in-tree.',
    ].join(' '),
  }, {
    decision: objSchema({
      description: [
        'Information provided by the decision task; this is usually baked into',
        '`actions.json`, although any value could be supplied in a direct call to',
        '`hooks.triggerHook`.',
      ].join(' '),
    }, {
      action: objSchema({description: 'Information about the action to perform'}, {
        name: {type: 'string', description: 'hook name'},
        title: {type: 'string', description: 'hook title'},
        description: {type: 'string', description: 'hook description'},
        taskGroupId: {type: 'string', description: 'taskGroupId of the decision task'},
        cb_name: {type: 'string', description: 'name of the in-tree callback function'},
        symbol: {type: 'string', description: 'treeherder symbol'},
      }),
      push: objSchema({description: 'Information about the push that created the decision task'}, {
        owner: {type: 'string', description: 'user who made the original push'},
        revision: {type: 'string', description: 'revision of the original push'},
        pushlog_id: {type: 'string', description: 'Mercurial pushlog ID of the original push'},
      }),
      repository: objSchema({description: 'Information about the repository where the push occurred'}, {
        url: {type: 'string', description: 'repository URL (without trailing slash)', pattern: '[^/]$'},
        project: {type: 'string', description: 'repository project name (also known as "alias")'},
        level: {type: 'string', description: 'repository SCM level'},
      }),
      parameters: {
        type: 'object',
        description: 'decision task parameters',
        additionalProperties: true,
      },
    }),
    user: objSchema({
      description: 'Information provided by the user or user interface',
    }, {
      input: action.inputSchema ?
        action.inputSchema :
        {
          anyOf: [
            {type: 'object', description: 'user input for the task'},
            {const: null, description: 'null when the action takes no input'},
          ],
        },
      taskId: {
        anyOf: [
          {type: 'string', description: 'taskId of the task on which this action was activated'},
          {const: null, description: 'null when the action is activated for a taskGroup'},
        ],
      },
      taskGroupId: {type: 'string', description: 'taskGroupId on which this action was activated'},
    }),
  });

  return {task, triggerSchema};
};
