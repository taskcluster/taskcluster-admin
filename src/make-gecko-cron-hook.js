import {getProjects, hgmoPath, scmLevel} from './util/projects';
import editRole from './util/edit-role';
import chalk from 'chalk';
import taskcluster from 'taskcluster-client';
import {diffLines} from 'diff';

module.exports.setup = (program) => {
  return program
    .command('make-gecko-cron-hook <project>')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('create or update a hook and its role for running gecko cron jobs')
};

module.exports.run = async function(projectName, options) {
  var taskcluster = require('taskcluster-client');
  var chalk = require('chalk');
  var projects = await getProjects();

  var project = projects[projectName];
  if (!project) {
    console.log(chalk.red(`Project ${projectName} is not defined in production-branches.json`));
    process.exit(1);
  }

  if (!project.features['taskcluster-cron']) {
    console.log(chalk.red(`Project ${projectName} does not have feature taskcluster-cron in production-branches.json`));
    process.exit(1);
  }

  var level = scmLevel(project);
  if (!level) {
    console.log(chalk.red(`Cannot determine project level`));
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

  const newHook = {
    metadata: {
      name: `Cron task for https://hg.mozilla.org/${path}`,
      description: [
        '*DO NOT EDIT*',
        '',
        `The cron hook for https://hg.mozilla.org/${path}`,
        '',
        'This hook is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
      ].join('\n'),
      owner: 'dustin@mozilla.com',
      emailOnError: false
    },
    task: {
      provisionerId: 'aws-provisioner-v1',
      workerType: `gecko-${level}-decision`,
      schedulerId: `gecko-level-${level}`,
      routes: [],
      scopes: [`assume:hook-id:${hookGroupId}/${hookId}`],
      payload: {
        env: {
          GECKO_BASE_REPOSITORY: 'https://hg.mozilla.org/mozilla-unified',
          GECKO_HEAD_REPOSITORY: `https://hg.mozilla.org/${path}`,
          GECKO_HEAD_REF: 'default',
          HG_STORE_PATH: '/home/worker/checkouts/hg-store'
        },
        cache: {}, // see below
        features: {
          taskclusterProxy: true,
          chainOfTrust: true
        },
        image: 'taskcluster/decision:0.1.7',
        maxRunTime: 1800,
        command: [
          '/home/worker/bin/run-task',
          '--vcs-checkout=/home/worker/checkouts/gecko',
          '--',
          'bash',
          '-cx',
          [
            'cd /home/worker/checkouts/gecko',
            'ln -s /home/worker/artifacts artifacts',
            './mach --log-no-times taskgraph cron --base-repository=$GECKO_BASE_REPOSITORY --head-repository=$GECKO_HEAD_REPOSITORY ' +
              `--head-ref=$GECKO_HEAD_REF --project=${projectName} --level=${level}`
          ].join(' && '),
        ],
        artifacts: {
          public: {
            type: 'directory',
            path: '/home/worker/artifacts'
          }
        }
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
      extra: {}
    },
    schedule: [
      "0 0,15,30,45 * * * *", // every 15 minutes
    ],
    deadline: '1 hour',
    expires: '7 days'
  };
  // set a property that is not a valid identifier
  newHook.task.payload.cache[`level-${level}-checkouts`] = '/home/worker/checkouts';

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
