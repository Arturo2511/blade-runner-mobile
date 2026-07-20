/**
 * GitHub REST API helpers.
 *
 * Uses the access_token stored in AsyncStorage by the OAuth flow.
 * Returns data in the same shape the UI consumes.
 *
 * For metrics (bugs, vulns, smells, coverage) GitHub does not return
 * anything — these come from your backend's `/listPr` & `/metrics`.
 * Until that's wired, those fields default to 0 / null.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';
const API_BASE = 'https://api.github.com';

/** Returns the stored OAuth token, or null. */
export async function getToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function hasGithubToken() {
  const t = await getToken();
  return !!t;
}

async function ghFetch(path, init = {}) {
  const token = await getToken();
  if (!token) throw new Error('not_authenticated');
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Extract "owner/repo" from a html_url like
 * "https://github.com/owner/repo/pull/42".
 */
function repoFromHtmlUrl(htmlUrl) {
  if (!htmlUrl) return '';
  try {
    const u = new URL(htmlUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  } catch {
    // ignore
  }
  return '';
}

/** Map a GitHub search "issue" item (PR) into our internal PR shape. */
function mapIssueToPr(item, currentUserLogin) {
  const repo = repoFromHtmlUrl(item.html_url);
  // GitHub search /issues doesn't include reviewDecision — we mark all as
  // pending and let the user open the PR for the real status.
  // If the current user is the author, we'll surface them in "Mes PRs".
  return {
    id: String(item.number),
    title: item.title,
    author: item.user?.login || '',
    authorAvatar: item.user?.avatar_url || null,
    repository: repo,
    url: item.html_url,
    createdAt: item.created_at,
    status: item.state === 'closed' ? 'rejected' : 'pending',
    branch: '', // not in /search/issues; would need /pulls/{n} for branch info
    baseBranch: '',
    summary: {
      qualityGate: 'NONE',
      bugs: 0,
      vulnerabilities: 0,
      codeSmells: 0,
      securityHotspots: 0,
      coverage: null,
      impactedFilesCount: 0,
      criticalFindings: 0,
      linesAdded: 0,
      linesRemoved: 0,
    },
    isMine: item.user?.login === currentUserLogin,
  };
}

/**
 * List PRs the current user is involved in (authored OR review-requested),
 * limited to open ones. Each PR is then enriched with a `/pulls/{n}` call
 * to fetch additions / deletions / changed_files (not returned by /search).
 */
export async function listMyOpenPullRequests() {
  const me = await ghFetch('/user');
  const login = me.login;

  const q = encodeURIComponent(`is:pr is:open involves:${login}`);
  const data = await ghFetch(`/search/issues?q=${q}&per_page=30&sort=updated`);
  const items = Array.isArray(data.items) ? data.items : [];
  const base = items.map((it) => mapIssueToPr(it, login));

  // Enrich in parallel — capped to 30 (matches per_page).
  const enriched = await Promise.all(
    base.map(async (pr) => {
      const ref = parsePrUrl(pr.url);
      if (!ref) return pr;
      try {
        const full = await getPullRequestDetail(ref.owner, ref.repo, ref.number);
        return {
          ...pr,
          branch: full.head?.ref || pr.branch,
          baseBranch: full.base?.ref || pr.baseBranch,
          summary: {
            ...pr.summary,
            impactedFilesCount: full.changed_files || 0,
            linesAdded: full.additions || 0,
            linesRemoved: full.deletions || 0,
          },
        };
      } catch {
        // Keep the base record on failure (token rate limit, private repo no-access…)
        return pr;
      }
    })
  );

  return enriched;
}

/**
 * Fetch the full PR object: branches, additions, deletions, changed_files…
 */
export async function getPullRequestDetail(owner, repo, number) {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${number}`);
}

export async function postPrComment(owner, repo, number, body) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export async function submitPrReview(owner, repo, number, event, body = '') {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, body }),
  });
}

export async function postReviewComment(owner, repo, number, { body, commitId, path, line, side }) {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, commit_id: commitId, path, line, side }),
  });
}

/**
 * Fetch the list of files changed in a PR, with their unified-diff `patch`.
 * GitHub returns up to 30 files per page (300 max); we paginate up to 3 pages.
 */
export async function getPullRequestFiles(owner, repo, number) {
  const all = [];
  for (let page = 1; page <= 3; page += 1) {
    const data = await ghFetch(
      `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`
    );
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
  }
  return all;
}

/**
 * Parse a unified-diff `patch` string into hunks compatible with MobileDiffView
 * AND a per-line `diffLines` array compatible with MiniMap.
 *
 * Returns:
 *   {
 *     hunks: [{ filePath, oldStart, newStart, lines: [{type, content, lineNumber}] }],
 *     diffLines: [{ line, type }],   // line = new file line number
 *     totalLines,                    // best-effort: highest new line number seen
 *   }
 */
export function parsePatch(patch, filePath) {
  const result = { hunks: [], diffLines: [], totalLines: 0 };
  if (!patch || typeof patch !== 'string') return result;

  const lines = patch.split('\n');
  let currentHunk = null;
  let oldLineNo = 0;
  let newLineNo = 0;

  const closeHunk = () => {
    if (currentHunk && currentHunk.lines.length > 0) {
      result.hunks.push(currentHunk);
    }
    currentHunk = null;
  };

  for (const raw of lines) {
    const m = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      closeHunk();
      const oldStart = parseInt(m[1], 10);
      const newStart = parseInt(m[3], 10);
      currentHunk = {
        filePath,
        oldStart,
        newStart,
        lines: [],
      };
      oldLineNo = oldStart;
      newLineNo = newStart;
      continue;
    }
    if (!currentHunk) continue;

    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      currentHunk.lines.push({
        type: 'add',
        content: raw.slice(1),
        lineNumber: newLineNo,
      });
      result.diffLines.push({ line: newLineNo, type: 'add' });
      result.totalLines = Math.max(result.totalLines, newLineNo);
      newLineNo += 1;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      currentHunk.lines.push({
        type: 'remove',
        content: raw.slice(1),
        lineNumber: oldLineNo,
      });
      // remove n'apparait pas dans le fichier "new", on n'ajoute pas à diffLines
      oldLineNo += 1;
    } else if (raw.startsWith('\\')) {
      // \ No newline at end of file
      continue;
    } else {
      // context line (starts with ' ' or empty)
      const content = raw.startsWith(' ') ? raw.slice(1) : raw;
      currentHunk.lines.push({
        type: 'context',
        content,
        lineNumber: newLineNo,
      });
      result.diffLines.push({ line: newLineNo, type: 'context' });
      result.totalLines = Math.max(result.totalLines, newLineNo);
      oldLineNo += 1;
      newLineNo += 1;
    }
  }
  closeHunk();
  return result;
}

const STATUS_TO_CHANGE = {
  added: 'added',
  removed: 'deleted',
  modified: 'modified',
  renamed: 'renamed',
  copied: 'modified',
  changed: 'modified',
};

const sevFromCounts = (additions, deletions) => {
  const t = additions + deletions;
  if (t > 200) return 'HIGH';
  if (t > 50) return 'MED';
  if (t > 10) return 'LOW';
  return 'CLEAN';
};

/**
 * Build a complete PR detail object
 * (description, summary, impactedFiles, diffHunks, callGraph stub).
 *
 * Findings / Sonar / call graph stay empty — those come from the backend.
 */
export async function buildPrDetailFromGithub(owner, repo, number) {
  const [pr, files] = await Promise.all([
    getPullRequestDetail(owner, repo, number),
    getPullRequestFiles(owner, repo, number),
  ]);

  const impactedFiles = [];
  let diffHunks = [];

  for (const f of files) {
    const parsed = parsePatch(f.patch || '', f.filename);
    impactedFiles.push({
      path: f.filename,
      changeType: STATUS_TO_CHANGE[f.status] || f.status || 'modified',
      linesAdded: f.additions || 0,
      linesRemoved: f.deletions || 0,
      findingsCount: 0,
      severity: sevFromCounts(f.additions || 0, f.deletions || 0),
      complexity: 0,
      totalLines: Math.max(parsed.totalLines, (f.additions || 0) + (f.deletions || 0)),
      diffLines: parsed.diffLines,
      structure: [],
    });
    diffHunks = diffHunks.concat(parsed.hunks);
  }

  return {
    id: String(pr.number),
    title: pr.title,
    author: pr.user?.login || '',
    repository: `${owner}/${repo}`,
    url: pr.html_url,
    createdAt: pr.created_at,
    status:
      pr.merged
        ? 'approved'
        : pr.state === 'closed'
          ? 'rejected'
          : 'pending',
    branch: pr.head?.ref || '',
    baseBranch: pr.base?.ref || '',
    headSha: pr.head?.sha || '',
    description: pr.body || '',
    aiSummary: '',
    summary: {
      qualityGate: 'NONE',
      bugs: 0,
      vulnerabilities: 0,
      codeSmells: 0,
      securityHotspots: 0,
      coverage: null,
      impactedFilesCount: impactedFiles.length,
      criticalFindings: 0,
      linesAdded: pr.additions || 0,
      linesRemoved: pr.deletions || 0,
    },
    impactedFiles,
    findings: [],
    callGraph: { nodes: [], edges: [] },
    diffHunks,
  };
}

/** Extract { owner, repo, number } from a GitHub PR html_url. */
export function parsePrUrl(htmlUrl) {
  if (!htmlUrl) return null;
  try {
    const u = new URL(htmlUrl);
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2], number: parseInt(m[3], 10) };
  } catch {
    return null;
  }
}
