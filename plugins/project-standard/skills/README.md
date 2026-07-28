# project-standard — skills

What each skill in this folder does and how to use it, with a real prompt → result for each. The full guide (use it when / don't use it for, requirements) is in the plugin's [README](../README.md).

## [`setup`](setup/SKILL.md)

Install or audit the 7-module Big Emotion standard on a repo: CI gates, hooks, skills, Atlassian, Ferry, release, infra.

```
/project-standard:setup is this repo up to standard?
```

Interview (read-only): proposes defaults — `package.json` name → `project_slug`, `git remote` → org/repo — and asks which of the seven modules to check.

Gap analysis, one table:

| Module | Status | Evidence | What install would do |
|---|---|---|---|
| M1 CI | drifted | `ci.yml` has lint/test but no secret scan | add gitleaks gate |
| M2 hooks | missing | no `.husky/` | pre-commit → lint-staged, commit-msg → commitlint |
| M6 release | present | `deploy-production.yml` on tag `v*` | nothing |
| … | | | |

→ Per-module plan (files to write, manual Jira/Confluence steps, what will NOT be touched) behind one explicit confirmation; installs in order M6 → M1 → M2 → M4 → M3 → M5 → M7.
→ Verify pass (scratch commit fires both hooks, `ferry-doctor`, MCP reads) then a final checklist: done / remaining-manual / deferred.
On a compliant repo it reports "compliant" and changes nothing; secret names are documented, values never written.
