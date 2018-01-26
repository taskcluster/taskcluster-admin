import editRole from './util/edit-role';
import {getProjects, hgmoPath, scmLevel, feature, ROLE_ROOTS} from './util/projects';

module.exports.setup = (program) => {
  return program
    .command('make-gecko-parameterized-roles')
    .option('-n, --noop', 'Don\'t change roles, just show difference')
    .description('make the parameterized roles used by other gecko roles');
};

var description = desc => [
  '*DO NOT EDIT*',
  '',
  desc,
  '',
  'This role is configured automatically by [taskcluster-admin](https://github.com/taskcluster/taskcluster-admin).',
].join('\n');

module.exports.run = async function(options) {
  var projects = await getProjects();

  var allLevels = new Set(Object.values(projects).map(proj => scmLevel(proj)));
  var allDomains = new Set(Object.values(projects).map(proj => proj.trust_domain));

  for (let level of allLevels) {
    for (let domain of allDomains) {
      var roleRoot = ROLE_ROOTS[domain];
      if (!roleRoot) {
        console.log(chalk.red(`Unknown trust domain ${domain}.`));
        process.exit(1);
      }

      await editRole({
        roleId: `${roleRoot}:branch:${domain}:level-${level}:*`,
        description: description(
          `Scopes for ${domain} projects at level ${level}; the '*' matches the project name.`
        ),
        scopes: [
          `assume:moz-tree:level:${level}:${domain}`,
          `queue:route:index.${domain}.v2.<..>.*`,
          `index:insert-task:${domain}.v2.<..>.*`,
          `queue:route:index.${domain}.cache.level-${level}.*`,
          `index:insert-task:${domain}.cache.level-${level}.*`,
          `queue:route:tc-treeherder-stage.<..>.*`,
          `queue:route:tc-treeherder.<..>.*`,
          `queue:route:tc-treeherder-stage.v2.<..>.*`,
          `queue:route:tc-treeherder.v2.<..>.*`,
          `queue:route:coalesce.v1.builds.<..>.*`,  // deprecated - https://bugzilla.mozilla.org/show_bug.cgi?id=1382204
          `queue:route:coalesce.v1.<..>.*`,
          `queue:route:index.releases.v1.<..>.*`,
          `secrets:get:project/releng/${domain}/build/level-${level}/*`,
        ],
        noop: options.noop,
      });

      let makeFeature = async (feature, scopes) => {
        await editRole({
          roleId: `${roleRoot}:feature:${feature}:${domain}:level-${level}:*`,
          description: description(
            `Scopes for ${domain} projects at level ${level} with feature '${feature}'; the '*' matches the project name.`
          ),
          scopes,
          noop: options.noop,
        });
      };

      await makeFeature('taskcluster-docker-routes-v1', [
        `queue:route:index.docker.images.v1.<..>.*`,
        `index:insert-task:docker.images.v1.<..>.*`,
      ]);

      await makeFeature('taskcluster-docker-routes-v2', [
        `queue:route:index.docker.images.v2.level-${level}.*`
      ]);

      await makeFeature('buildbot', [
        `queue:route:index.buildbot.branches.<..>.*`,
        `index:insert-task:buildbot.branches.<..>.*`,
        `queue:route:index.buildbot.revisions.*`,
        `index:insert-task:buildbot.revisions.*`,
        `project:releng:buildbot-bridge:builder-name:release-<..>-*`,
        `project:releng:buildbot-bridge:builder-name:release-<..>_*`,
      ]);

      await makeFeature('is-trunk', [
        `queue:route:index.gecko.v2.trunk.revision.*`,
      ]);
    }
  }

};
