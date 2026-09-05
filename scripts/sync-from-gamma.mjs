// Pull engine fixes from gamma into a fork. Zero deps.
//
//   node scripts/sync-from-gamma.mjs [<gamma-url>]   # first run: pass the URL, it adds the remote
//   node scripts/sync-from-gamma.mjs                 # fetch + show what's new + merge gamma/main
//   node scripts/sync-from-gamma.mjs --pick <sha>    # cherry-pick one commit instead of merging
//
// On a conflict it stops and prints exactly which files and what to do. Run
// from the fork, not from gamma itself. See FORKING.md.
import { execSync } from 'node:child_process';

const sh = (cmd, quiet) => execSync(cmd, { stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const die = (msg) => { console.error(`\nsync: ${msg}\n`); process.exit(1); };

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const pickIdx = args.indexOf('--pick');
const pickSha = pickIdx !== -1 ? args[pickIdx + 1] : null;

// clean tree only — a merge/cherry-pick onto uncommitted work is a mess to unpick
if (out('git status --porcelain')) die('working tree is dirty — commit or stash first');

const remotes = out('git remote').split('\n');
if (!remotes.includes('gamma')) {
  if (!url) die('no `gamma` remote yet — run once with the gamma repo URL:\n  node scripts/sync-from-gamma.mjs <url>');
  sh(`git remote add gamma ${url}`);
  console.log('sync: added remote `gamma`');
}

sh('git fetch gamma --tags');

const behind = out('git log --oneline HEAD..gamma/main');
if (!behind && !pickSha) { console.log('\nsync: already up to date with gamma/main\n'); process.exit(0); }
if (behind) console.log(`\nnew on gamma/main:\n${behind}\n`);

try {
  if (pickSha) { console.log(`sync: cherry-picking ${pickSha}`); sh(`git cherry-pick ${pickSha}`); }
  else { console.log('sync: merging gamma/main'); sh('git merge --no-edit gamma/main'); }
  console.log('\nsync: done — build + test before you push.\n');
} catch {
  const conflicts = out('git diff --name-only --diff-filter=U');
  console.error('\nsync: CONFLICTS — resolve these, then finish:\n');
  console.error(conflicts.split('\n').map((f) => `  ${f}`).join('\n'));
  console.error(`
  1. open each file, pick the right side of the  <<<<<<<  =======  >>>>>>>  markers
  2. git add <file>   for each
  3. ${pickSha ? 'git cherry-pick --continue' : 'git commit --no-edit'}
  (to bail out entirely:  ${pickSha ? 'git cherry-pick --abort' : 'git merge --abort'})
`);
  process.exit(1);
}
