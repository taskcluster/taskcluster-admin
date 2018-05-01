exports.ACTION_HOOKS = [
  {
    trustDomain: 'gecko',
    level: '1',
    actionPerm: 'generic',
    groups: ['active_scm_level_1'],
    // inputSchema,
  },
  {
    trustDomain: 'comm',
    level: '1',
    actionPerm: 'generic',
    groups: ['active_scm_level_1'],
    // inputSchema,
  },
  {
    trustDomain: 'gecko',
    level: '1',
    actionPerm: 'purge-caches',
    groups: ['taskcluster', 'vpn_sheriff'],
    // inputSchema,
  },
];

