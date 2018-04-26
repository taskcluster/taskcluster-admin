const request = require('superagent');
const yaml = require('js-yaml');

const CENTRAL_RAW = 'https://hg.mozilla.org/mozilla-central/raw-file/default/';

/**
 * Get the .taskcluster.yml for the given repository
 */
exports.getTaskclusterYml = async (repoPath) => {
  let res = await request.get(`${repoPath}/raw-file/default/.taskcluster.yml`).buffer(true);
  if (!res.ok) {
    throw new Error(res.text);
  }
  return yaml.safeLoad(res.text);
};
