const request = require('superagent');
const yaml = require('js-yaml');

const CENTRAL_RAW = 'https://hg.mozilla.org/mozilla-central/raw-file/default/';

exports.getCentralTaskclusterYml = async () => {
  let res = await request.get(CENTRAL_RAW + '.taskcluster.yml').buffer(true);
  if (!res.ok) {
    throw new Error(res.text);
  }
  return yaml.safeLoad(res.text);
};
