const {getProjects, hgmoPath, scmLevel} = require('./util/projects');
const child_process = require('child_process');

module.exports.setup = (program) => {
  return program
    .command('check-repo-levels')
    .description('check that the hg server and production-branches.json agree ' +
                 'about repo levels. Must have an active Mozilla SSH key.');
};

// some repos have more-specific groups, so we map those to the more general
// level names
const SERVER_LEVEL_ALIASES = {
  scm_autoland: 'scm_level_3',
};

module.exports.run = async () => {
  let chalk = require('chalk');
  let projects = await getProjects();
  Object.keys(projects).forEach(p => {
    let project = projects[p];
    let path = hgmoPath(project);
    if (!path) {
      console.log(chalk.bold.red(`cannot determine repo path for ${p}`));
      return;
    }
    let serverLevel = child_process.execSync(`ssh hg.mozilla.org repo-group ${path}`, {encoding: 'utf-8'}).trim();
    if (serverLevel in SERVER_LEVEL_ALIASES) {
      serverLevel = SERVER_LEVEL_ALIASES[serverLevel];
    }
    console.log(`${chalk.bold(p)}: ${serverLevel}`);
    if (serverLevel !== project.access) {
      console.log(chalk.bold.red(` production-branches level ${project.access} != hg server level ${serverLevel}`));
    }
  });
};

