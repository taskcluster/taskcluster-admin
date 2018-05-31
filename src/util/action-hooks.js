exports.ACTION_HOOKS = [
  {
    trustDomain: 'gecko',
    level: '1',
    actionPerm: 'generic',
    groups: ['active_scm_level_1', 'active_scm_level_2', 'active_scm_level_3'],
    // inputSchema,
  },
  {
    trustDomain: 'comm',
    level: '1',
    actionPerm: 'generic',
    groups: ['active_scm_level_1', 'active_scm_level_2', 'active_scm_level_3'],
    // inputSchema,
  },
  {
    trustDomain: 'gecko',
    level: '2',
    actionPerm: 'generic',
    groups: ['active_scm_level_2', 'active_scm_level_3'],
    // inputSchema,
  },
  {
    trustDomain: 'comm',
    level: '2',
    actionPerm: 'generic',
    groups: ['active_scm_level_2', 'active_scm_level_3'],
    // inputSchema,
  },
  {
    trustDomain: 'gecko',
    level: '3',
    actionPerm: 'generic',
    groups: ['active_scm_level_3'],
    // inputSchema,
  },
  {
    trustDomain: 'comm',
    level: '3',
    actionPerm: 'generic',
    groups: ['active_scm_level_3'],
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

