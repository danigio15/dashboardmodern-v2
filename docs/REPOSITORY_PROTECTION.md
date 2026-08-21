# Repository Protection

This document records how branch creation, branch protection, and fork exposure are
governed for `danigio15/dashboardmodern-v2`, and how to apply the configuration.

The rulesets live in `.github/rulesets/` as importable JSON. GitHub does not apply
them automatically from the repository contents: they are versioned here so the
policy is reviewable and reproducible, and imported through the web UI.

## 1. Restrict branch creation

`.github/rulesets/branch-creation-policy.json` allows new branches only when the
name matches one of the prefixes documented in `CONTRIBUTING.md`
(`feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `chore/`), plus `claude/` for
automated agent sessions. Any other branch name is rejected at push time, and
branches matching the policy cannot be deleted by non-admins.

To apply it:

1. Settings → Rules → Rulesets → New ruleset → **Import a ruleset**.
2. Upload `.github/rulesets/branch-creation-policy.json`.
3. Confirm the enforcement status is **Active**.

Notes:

- The ruleset grants a bypass to the repository admin role, so the owner is never
  locked out of the UI branch creation flow. Remove the `bypass_actors` entry for
  an unconditional block, at the cost of blocking the owner as well.
- Only accounts with push access can create branches in the first place; this
  ruleset constrains collaborators and automation, not anonymous users.
- Tags are deliberately left unconstrained: `release.yml` and `cleanup-releases.yml`
  create and delete tags with the workflow token.

## 2. Protect the default branch

`.github/rulesets/main-protection.json` requires a pull request for every change to
`main`, blocks force pushes and deletion, and requires the CI jobs `Ruff`,
`Python tests`, `Frontend tests`, and `validate` (hassfest) to pass. Approvals are
set to zero so a solo maintainer can still merge their own pull requests; raise
`required_approving_review_count` when more maintainers join.

Import it the same way as above.

Notes:

- `regenerate-vendor-artifacts.yml` pushes directly to its `target_branch` input.
  If that workflow is ever run with `main` as the target, add the GitHub Actions
  app to `bypass_actors` first, otherwise the push is rejected.
- Browser E2E jobs are matrix-generated (`playwright / <project>`), so their check
  names change with the matrix and are not listed as required checks.

## 3. Forks

Forking **cannot be disabled on a public repository**. The "Allow forking" setting
exists only for private and internal repositories, and the MIT license under which
this project is published explicitly permits redistribution. The available options
are, in order of practicality:

1. Accept forks and control what they can do (see below).
2. Make the repository private, then disable forking in Settings → General.
   This removes public visibility, stars, and HACS installability.
3. Move the repository into an organization and set an organization-level fork
   policy, which again only binds private and internal repositories.

Option 1 is the current stance. What is actually controlled:

- **Workflow execution from forks.** Settings → Actions → General → Fork pull
  request workflows from outside collaborators → **Require approval for all
  external contributors**. Pull requests from forks then run `tests.yml`,
  `e2e.yml`, and `validate.yml` only after a maintainer approves the run.
- **Workflow token scope.** Settings → Actions → General → Workflow permissions →
  **Read repository contents permission**, with "Allow GitHub Actions to create and
  approve pull requests" left off.
- **Pull request creation.** If the repository settings expose "Limit pull request
  creation to collaborators", enabling it stops fork owners from opening pull
  requests at all. This repository is currently open to all.

## 4. Verifying the configuration

After importing both rulesets:

```bash
git checkout -b not-a-valid-prefix
git commit --allow-empty -m "chore: ruleset probe"
git push -u origin not-a-valid-prefix   # expected: rejected by branch-creation-policy
git push origin HEAD:main               # expected: rejected by main-protection
```

Run the probe from an account without the admin bypass, otherwise both pushes
succeed by design.
