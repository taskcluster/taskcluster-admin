const {getProjects, hgmoPath, scmLevel} = require('./util/projects');
const editRole = require('./util/edit-role');
const chalk = require('chalk');
const taskcluster = require('taskcluster-client');
const {diffLines} = require('diff');

module.exports.setup = (program) => {
  return program
    .command('make-gecko-cron-hook [projects...]')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .option('--all', 'Operate on all projects')
    .description('create or update a hook and its role for running gecko cron jobs');
};

module.exports.run = async function(projectsOption, options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
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

    if (!project.features['taskcluster-cron']) {
      if (options.all) {
        console.log(chalk.yellow(
          `Skipping project ${projectName}: does not have feature taskcluster-cron in production-branches.json`));
        continue;
      }

      console.log(chalk.red(
        `Project ${projectName} does not have feature taskcluster-cron in production-branches.json`));
      process.exit(1);
    }

    await makeHook(projectName, project, options);
  }
};

var makeHook = async function(projectName, project, options) {
  var level = scmLevel(project);
  if (!level) {
    console.log(chalk.red('Cannot determine project level'));
    process.exit(1);
  }

  var path = hgmoPath(project);
  if (!path) {
    console.log(chalk.red(`Unrecognized project repository ${project.repo}`));
    process.exit(1);
  }

  var hookGroupId = 'project-releng';
  var hookId = `cron-task-${path.replace(/\//g, '-')}`;

  // set up role

  await editRole({
    roleId: `hook-id:${hookGroupId}/${hookId}`,
    description: [
      '*DO NOT EDIT*',
      '',
      `Scopes for the cron task for https://hg.mozilla.org/${path}`,
      '',
      'This role is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
    ].join('\n'),
    scopes: [`assume:repo:hg.mozilla.org/${path}:cron:*`],
    noop: options.noop,
  });

  // set up hook


  var repo_env, checkout;
  if (!project.gecko_repo) {
    // If there isn't a gecko_repo associated with this project, then it is itself a gecko repo
    repo_env = {
      GECKO_BASE_REPOSITORY: 'https://hg.mozilla.org/mozilla-unified',
      GECKO_HEAD_REPOSITORY: `https://hg.mozilla.org/${path}`,
      GECKO_HEAD_REF: 'default',
    };
    checkout = [
      '--vcs-checkout=/builds/worker/checkouts/gecko',
    ];
    cron_root = '';
  } else {
    // Otherwise it is a comm-central derived repository
    repo_env = {
      GECKO_BASE_REPOSITORY: 'https://hg.mozilla.org/mozilla-unified',
      GECKO_HEAD_REPOSITORY: project.gecko_repo,
      GECKO_HEAD_REF: 'default',
      COMM_BASE_REPOSITORY: 'https://hg.mozilla.org/comm-central',
      COMM_HEAD_REPOSITORY: `https://hg.mozilla.org/${path}`,
      COMM_HEAD_REF: 'default',
    };
    checkout = [
      '--vcs-checkout=/builds/worker/checkouts/gecko',
      '--comm-checkout=/builds/worker/checkouts/gecko/comm',
    ];
    cron_root = '--root=comm/';
  }
  const newHook = {
    metadata: {
      name: `Cron task for https://hg.mozilla.org/${path}`,
      description: [
        '*DO NOT EDIT*',
        '',
        `The cron hook for https://hg.mozilla.org/${path}`,
        '',
        'This hook is configured automatically by',
        '[taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
      ].join('\n'),
      owner: 'taskcluster-notifications@mozilla.com',
      emailOnError: true,
    },
    task: {
      provisionerId: 'aws-provisioner-v1',
      workerType: `gecko-${level}-decision`,
      schedulerId: `gecko-level-${level}`,
      routes: [
        'notify.email.taskcluster-notifications@mozilla.com.on-exception',
        'notify.email.taskcluster-notifications@mozilla.com.on-failed',
      ],
      scopes: [`assume:hook-id:${hookGroupId}/${hookId}`],
      deadline: {$fromNow: '1 hour'},
      expires: {$fromNow: '7 days'},
      payload: {
        env: {
          ...repo_env,
          HG_STORE_PATH: '/builds/worker/checkouts/hg-store',
          TASKCLUSTER_CACHES: '/builds/worker/checkouts',
        },
        cache: {}, // see below
        features: {
          taskclusterProxy: true,
          chainOfTrust: true,
        },
        image: 'taskcluster/decision:2.0.0@sha256:4039fd878e5700b326d4a636e28c595c053fbcb53909c1db84ad1f513cf644ef',
        maxRunTime: 1800,
        command: [
          '/builds/worker/bin/run-task',
          ...checkout,
          '--',
          'bash',
          '-cx',
          [
            'cd /builds/worker/checkouts/gecko',
            'ln -s /builds/worker/artifacts artifacts',
            './mach --log-no-times taskgraph cron --base-repository=$GECKO_BASE_REPOSITORY ' +
            '--head-repository=$GECKO_HEAD_REPOSITORY ' +
              `--head-ref=$GECKO_HEAD_REF --project=${projectName} --level=${level} ${cron_root}`,
          ].join(' && '),
        ],
        artifacts: {
          public: {
            type: 'directory',
            path: '/builds/worker/artifacts',
          },
        },
      },
      metadata: {
        owner: 'mozilla-taskcluster-maintenance@mozilla.com',
        source: `https://tools.taskcluster.net/hooks/#${hookGroupId}/${hookId}`,
        description: `See https://tools.taskcluster.net/hooks/#${hookGroupId}/${hookId}`,
        name: `Cron task for https://hg.mozilla.org/${path}`,
      },
      priority: 'normal',
      retries: 5,
      tags: {},
      extra: {},
    },
    schedule: [
      '0 0,15,30,45 * * * *', // every 15 minutes
    ],
    triggerSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  };
  // set a property that is not a valid identifier
  newHook.task.payload.cache[`level-${level}-checkouts`] = '/builds/worker/checkouts';

  const hooks = new taskcluster.Hooks();

  let hook;
  try {
    hook = await hooks.hook(hookGroupId, hookId);
    delete hook['hookId'];
    delete hook['hookGroupId'];
  } catch (err) {
    if (err.statusCode !== 404) {
      throw err;
    }
    hook = {};
  }

  // compare and display the differences
  const diffs = diffLines(
    JSON.stringify(hook, null, 2),
    JSON.stringify(newHook, null, 2),
    {newlineIsToken: true});
  let diffsFound = false;
  diffs.forEach(diff => {
    if (diff.added || diff.removed) {
      diffsFound = true;
    }
  });

  if (diffsFound) {
    console.log(chalk.green.bold(`changes required for hook ${hookGroupId}/${hookId}:`));
    diffs.forEach(diff => {
      if (diff.added) {
        diff.value.split(/\n/).forEach(l => console.log(chalk.green('+' + l)));
      } else if (diff.removed) {
        diff.value.split(/\n/).forEach(l => console.log(chalk.red('-' + l)));
      } else {
        diff.value.split(/\n/).forEach(l => console.log(' ' + l));
      }
    });
  } else {
    console.log(chalk.green.bold(`no changes required for hook ${hookGroupId}/${hookId}`));
  }

  if (!options.noop && diffsFound) {
    if (hook.task) {
      console.log(chalk.green.bold('updating hook'));
      await hooks.updateHook(hookGroupId, hookId, newHook);
    } else {
      console.log(chalk.green.bold('creating hook'));
      await hooks.createHook(hookGroupId, hookId, newHook);
    }
  }
};
