import request from 'superagent';

const PRODUCTION_BRANCHES_URL = 'https://hg.mozilla.org/build/tools/raw-file/default/buildfarm/maintenance/production-branches.json';

const LEVEL_GROUPS = {
  scm_level_1: 1,
  scm_level_2: 2,
  scm_level_3: 3,
  scm_autoland: 3,
};

// Get the latest production-branches.json, returning the decoded data.
exports.getProjects = async () => {
  let res = await request.get(PRODUCTION_BRANCHES_URL).buffer(true);
  if (!res.ok) {
    throw new Error(res.text);
  }
  return JSON.parse(res.text);
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
