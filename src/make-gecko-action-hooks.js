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
  const repoUrlExpression = '${payload.decision.repository.url[8:]}';
  const actionOverrides = {
    repo_scope: {
      $let: {
        repoUrl: {
          $if: 'payload.decision.repository.url[-1] == "/"',
          then: {$eval: 'payload.decision.repository.url[:-1]'},
          else: {$eval: 'payload.decision.repository.url'},
        },
      },
      in: 'assume:repo:${repoUrl[8:]}:action:' + action.actionPerm,
    },
  };

  if (action.actionPerm !== 'generic') {
    // enforce that action.cb_name == actionPerm
    actionOverrides.cb_name = action.actionPerm;
  }

  const task = {
    $let: {
      tasks_for: 'action',
      action: {
        $merge: [
          {$eval: 'payload.decision.action'},
          actionOverrides,
        ],
      },
      push: {$eval: 'payload.decision.push'},
      repository: {$eval: 'payload.decision.repository'},
      input: {$eval: 'payload.user.input'},
      parameters: {$eval: 'payload.decision.parameters'},
      task: {$eval: 'payload.user.task'},
      taskId: {$eval: 'payload.user.taskId'},
      taskGroupId: {$eval: 'payload.user.taskGroupId'},
      ownTaskId: 'abc123',  // TODO (bug 1455697)
    },
    in: taskclusterYml.tasks[0],
  };

  const triggerSchema = {
    type: 'object',
    properties: {
      decision: {
        description: 'information provided by the decision task',
        type: 'object',
        properties: {
          action: {type: 'object'},
          push: {type: 'object'},
          parameters: {type: 'object'},
          repository: {type: 'object'},
        },
        additionalProperties: false,
        required: [
          'action',
          'push',
          'parameters',
          'repository',
        ],
      },
      user: {
        description: 'information provided by the user, or UI',
        type: 'object',
        properties: {
          input: action.inputSchema ? action.inputSchema : {type: 'object'},
          task: {type: 'object'},
          taskId: {type: 'string'},
          taskGroupId: {type: 'string'},
          ownTaskId: {type: 'string'},
        },
        additionalProperties: false,
        required: [
          'input',
          'task',
          'taskId',
          'taskGroupId',
        ],
      },
    },
    additionalProperties: false,
    required: [
      'decision',
      'user',
    ],
  };

  return {task, triggerSchema};
};
