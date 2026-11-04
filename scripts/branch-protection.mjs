// Switches the GitHub rulesets of main and dev between two modes (needs the `gh` CLI, signed in as repo admin).
//
//   node scripts/branch-protection.mjs status   show the current mode (read only)
//   node scripts/branch-protection.mjs mvp      pull request + green CI, no approving review
//   node scripts/branch-protection.mjs strict   additionally 1 approval + code owner review
//
// Both modes block deletion, force pushes, direct pushes and merge commits. Only the repository
// admin may bypass, and only through a pull request. See docs/RELEASE.md.

import { execFileSync } from 'node:child_process';

const REPO = 'QuickLinkNet/mergeforge';
const RULESETS = [
  { name: 'Protect main', include: ['~DEFAULT_BRANCH'] },
  { name: 'Protect dev', include: ['refs/heads/dev'] },
];
const ADMIN_ROLE_ID = 5;

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] });
}

function rules(strict) {
  return [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'required_linear_history' },
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: strict ? 1 : 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: strict,
        require_last_push_approval: false,
        required_review_thread_resolution: true,
        allowed_merge_methods: ['squash'],
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: false,
        required_status_checks: [{ context: 'verify' }, { context: 'release-route' }],
      },
    },
  ];
}

function listRulesets() {
  return JSON.parse(gh(['api', `repos/${REPO}/rulesets`]));
}

function modeOf(ruleset) {
  const pr = ruleset.rules?.find((rule) => rule.type === 'pull_request')?.parameters;
  if (!pr) return 'no pull request rule';
  return pr.required_approving_review_count >= 1 && pr.require_code_owner_review ? 'strict' : 'mvp';
}

const mode = process.argv[2];
if (!['status', 'mvp', 'strict'].includes(mode ?? '')) {
  console.error('Usage: node scripts/branch-protection.mjs status|mvp|strict');
  process.exit(1);
}

const existing = listRulesets();
for (const wanted of RULESETS) {
  const found = existing.find((ruleset) => ruleset.name === wanted.name);
  if (!found) {
    console.error(`Ruleset "${wanted.name}" not found in ${REPO}.`);
    process.exit(1);
  }
  const current = JSON.parse(gh(['api', `repos/${REPO}/rulesets/${found.id}`]));
  if (mode === 'status') {
    console.log(`${wanted.name} (#${found.id}): ${current.enforcement}, mode ${modeOf(current)}`);
    continue;
  }
  const body = {
    name: wanted.name,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: wanted.include, exclude: [] } },
    bypass_actors: [{ actor_id: ADMIN_ROLE_ID, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' }],
    rules: rules(mode === 'strict'),
  };
  gh(['api', '-X', 'PUT', `repos/${REPO}/rulesets/${found.id}`, '--input', '-'], JSON.stringify(body));
  console.log(`${wanted.name} (#${found.id}): now ${mode}`);
}
