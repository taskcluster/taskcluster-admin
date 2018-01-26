import request from 'superagent';
import yaml from 'js-yaml';

const CI_CONFIGURATION = 'https://hg.mozilla.org/build/ci-configuration/raw-file/default/';

const LEVEL_GROUPS = {
  scm_level_1: 1,
  scm_level_2: 2,
  scm_level_3: 3,
  scm_autoland: 3,
};

// each project has a set of enabled features, and we use roles for each of them.
exports.ALL_FEATURES = [
  'taskcluster-docker-routes-v1',
  'taskcluster-docker-routes-v2',
  'buildbot',
  'is-trunk',
];

// for each trust domain, we use a different root for the parameterized roles
exports.ROLE_ROOTS = {
  gecko: 'project:releng',
  comm: 'project:comm:thunderbird:comm:releng',
};

// Get the latest production-branches.json, returning the decoded data.
exports.getProjects = async () => {
  let res = await request.get(CI_CONFIGURATION + 'projects.yml').buffer(true);
  if (!res.ok) {
    throw new Error(res.text);
  }
  return yaml.safeLoad(res.text);
};

// Calculate the numeric SCM level for a repo, or undefined if unknown.  This
// applies some shortcuts.
exports.scmLevel = (project) => {
  if (project.repo_type === 'hg' && project.repo.startsWith('https://hg.mozilla.org/')) {
    return LEVEL_GROUPS[project.access];
  }
};

// Calculate the hg.mozilla.org path for a given project, or undefined if unknown.
exports.hgmoPath = (project) => {
  if (project.repo_type === 'hg' && project.repo.startsWith('https://hg.mozilla.org/')) {
    return project.repo.replace('https://hg.mozilla.org/', '');
  }
};

// Calculate the hg.mozilla.org path for a given project, or undefined if unknown.
exports.feature = (project, feature) => {
  return project.features && project.features[feature];
};
