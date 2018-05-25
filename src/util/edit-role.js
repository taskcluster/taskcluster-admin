const chalk = require('chalk');
const taskcluster = require('taskcluster-client');
const arrayDiff = require('simple-array-diff');

const editRole = async ({roleId, description, scopes, noop}) => {
  var auth = new taskcluster.Auth();

  var role;
  try {
    role = await auth.role(roleId);
  } catch (err) {
    if (err.statusCode !== 404) {
      throw err;
    }
  }

  var got_scopes = role ? role.scopes : [];
  var diff = arrayDiff(got_scopes, scopes);
  if (diff.removed.length || diff.added.length) {
    console.log(chalk.green.bold(`scope changes required for role ${roleId}`) + ':');
    diff.removed.forEach(s => console.log(chalk.red(`- ${s}`)));
    diff.added.forEach(s => console.log(chalk.green(`+ ${s}`)));
  } else {
    console.log(chalk.green.bold(`no changes required for role ${roleId}`));
    return;
  }

  if (!noop) {
    try {
      if (role) {
        console.log(chalk.green.bold('updating role'));
        await auth.updateRole(roleId, {
          description,
          scopes,
        });
      } else {
        console.log(chalk.green.bold('creating role'));
        await auth.createRole(roleId, {
          description,
          scopes,
        });
      }
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
    console.log(chalk.green.bold('done'));
  }
};

module.exports = editRole;
