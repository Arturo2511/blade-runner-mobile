/**
 * Blade Runner backend client.
 *
 * Le backend Spring expose :
 *   - GET  /metrics?projectUrl=...&prId=...  → { sonarMetrics, sarif, dotFile }
 *   - GET  /listPr?projectUrl=...
 *   - POST /metrics                          (runner only, Bearer token requis)
 *   - WS   /ws-metrics, topic /topic/metrics/{prId} → "READY" quand un scan finit
 *
 * Côté mobile, on n'utilise que les GET. Les POSTs sont du domaine du runner.
 */

import { BACKEND_CONFIG } from '../config/backend';
import { parseSarif } from '../utils/sarifParser';
import { parseDot } from '../utils/dotParser';
import { getPullRequestFiles } from './githubApi';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wrap fetch with a timeout so a dead backend doesn't hang the UI.
 */
async function fetchWithTimeout(url, init = {}, timeoutMs = BACKEND_CONFIG.timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function headers() {
  const h = { Accept: 'application/json' };
  if (BACKEND_CONFIG.token) h.Authorization = `Bearer ${BACKEND_CONFIG.token}`;
  return h;
}

/**
 * Ping rapide pour savoir si le backend est joignable.
 * Renvoie true si /actuator/health répond, false sinon.
 */
export async function pingBackend() {
  try {
    const res = await fetchWithTimeout(
      `${BACKEND_CONFIG.url}/actuator/health`,
      { headers: headers() },
      3000
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /metrics?projectUrl=...&prId=...
 * Retourne null si la PR n'a pas encore été scannée (404), ou si backend down.
 */
export async function getMetrics(projectUrl, prId) {
  if (!projectUrl || !prId) return null;
  try {
    const qs = new URLSearchParams({
      projectUrl: String(projectUrl),
      prId: String(prId),
    });
    const res = await fetchWithTimeout(
      `${BACKEND_CONFIG.url}/metrics?${qs.toString()}`,
      { headers: headers() }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log(`[Backend] GET /metrics → ${res.status} ${text.slice(0, 200)}`);
      return null;
    }
    return res.json();
  } catch (e) {
    console.log('[Backend] getMetrics failed:', e?.message || e);
    return null;
  }
}

export async function triggerScan(projectUrl, prId) {
  const form = new FormData();
  form.append('projectUrl', String(projectUrl));
  form.append('prId', String(prId));
  const res = await fetchWithTimeout(
    `${BACKEND_CONFIG.url}/addProjectPullRequest`,
    { method: 'POST', body: form, headers: headers() },
    12000
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Scan trigger ${res.status}: ${text.slice(0, 120)}`);
  }
  return true;
}

/**
 * Map sonarMetrics du backend vers notre `summary` du modèle mobile.
 */
function mapSonarMetrics(sonar = {}) {
  return {
    qualityGate: sonar.qualityGateStatus || 'NONE',
    bugs: numOr(sonar.bugs, 0),
    vulnerabilities: numOr(sonar.vulnerabilities, 0),
    codeSmells: numOr(sonar.codeSmells, 0),
    securityHotspots: numOr(sonar.securityHotspots, 0),
    coverage: sonar.coverage != null ? Number(sonar.coverage) : null,
  };
}

const numOr = (v, def) => (typeof v === 'number' ? v : def);

function mapSonarSeverity(sev) {
  switch (sev) {
    case 'BLOCKER':
      return 'CRITICAL';
    case 'CRITICAL':
      return 'HIGH';
    case 'MAJOR':
      return 'MED';
    case 'MINOR':
    case 'INFO':
      return 'LOW';
    default:
      return 'MED';
  }
}

function mapSonarType(type) {
  switch (type) {
    case 'BUG':
      return 'BUG';
    case 'VULNERABILITY':
    case 'SECURITY_HOTSPOT':
      return 'SECURITY';
    case 'CODE_SMELL':
    default:
      return 'SMELL';
  }
}

function mapSonarIssuesToFindings(issues) {
  return (issues || []).map((it, idx) => ({
    id: `sonar-${idx}-${it.rule || 'issue'}`,
    ruleId: it.rule || '',
    title: it.message || it.rule || 'Issue Sonar',
    description: it.rule ? `Règle Sonar : ${it.rule}` : '',
    severity: mapSonarSeverity(it.severity),
    category: mapSonarType(it.type),
    location: {
      filePath: it.file || '',
      startLine: it.line || 0,
      endLine: it.line || 0,
      snippet: '',
    },
    source: 'sonar',
  }));
}

function normPath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .toLowerCase();
}

function buildChangedFileIndex(impactedFiles) {
  const full = new Set();
  const base = new Set();
  (impactedFiles || []).forEach((f) => {
    const p = normPath(f && f.path);
    if (!p) return;
    full.add(p);
    base.add(p.split('/').pop());
  });
  return { full, base };
}

function fileInPr(file, changed) {
  const nf = normPath(file);
  if (!nf) return false;
  if (changed.full.has(nf)) return true;
  for (const cf of changed.full) {
    if (cf.endsWith('/' + nf) || nf.endsWith('/' + cf)) return true;
  }
  return changed.base.has(nf.split('/').pop());
}

/**
 * Fusionne un `prDetail` construit à partir de GitHub avec les métriques scan
 * fournies par le backend. Si le backend ne renvoie rien, le détail reste tel
 * quel (findings vides, summary à 0).
 */
export async function enrichPrDetailWithBackend(prDetail, projectUrl, prId) {
  const data = await getMetrics(projectUrl, prId);
  if (!data) return { ...prDetail, scanned: false }; // pas de scan dispo, on garde GitHub seul

  // 1. Summary (Sonar)
  const sonar = mapSonarMetrics(data.sonarMetrics);

  const changed = buildChangedFileIndex(prDetail.impactedFiles);

  const codeqlFindings = (data.sarif ? parseSarif(data.sarif) : []).filter((f) =>
    fileInPr(f.location && f.location.filePath, changed)
  );
  const prSonarIssues = (data.sonarIssues || []).filter((it) =>
    fileInPr(it.file, changed)
  );
  const sonarFindings = mapSonarIssuesToFindings(prSonarIssues);
  const findings = [...codeqlFindings, ...sonarFindings];

  const countType = (t) => prSonarIssues.filter((i) => i.type === t).length;
  const prCounts = {
    bugs: countType('BUG'),
    vulnerabilities: countType('VULNERABILITY'),
    codeSmells: countType('CODE_SMELL'),
    securityHotspots: countType('SECURITY_HOTSPOT'),
  };

  const impactedFiles = (prDetail.impactedFiles || []).map((f) => {
    const idx = buildChangedFileIndex([f]);
    const findingsCount = findings.filter((fn) =>
      fileInPr(fn.location && fn.location.filePath, idx)
    ).length;
    return { ...f, findingsCount };
  });

  const callGraph = data.dotFile
    ? parseDot(data.dotFile)
    : { nodes: [], edges: [] };

  const criticalFindings = findings.filter(
    (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
  ).length;

  return {
    ...prDetail,
    aiSummary: data.summary || prDetail.aiSummary,
    summary: {
      ...prDetail.summary,
      qualityGate: sonar.qualityGate,
      coverage: sonar.coverage,
      ...prCounts,
      criticalFindings,
    },
    findings,
    callGraph,
    impactedFiles,
    scanned: true,
  };
}

export async function enrichPrCardWithMetrics(pr) {
  try {
    const [owner, repo] = String(pr.repository || '').split('/');
    if (!owner || !repo || !pr.id) return pr;
    const projectUrl = `https://github.com/${pr.repository}`;
    const data = await getMetrics(projectUrl, String(pr.id));
    if (!data) return { ...pr, scanned: false };

    const sonar = mapSonarMetrics(data.sonarMetrics);
    let changed = { full: new Set(), base: new Set() };
    try {
      const files = await getPullRequestFiles(owner, repo, Number(pr.id));
      changed = buildChangedFileIndex(files.map((f) => ({ path: f.filename })));
    } catch (e) {
      changed = { full: new Set(), base: new Set() };
    }

    const prSonarIssues = (data.sonarIssues || []).filter((it) =>
      fileInPr(it.file, changed)
    );
    const codeqlFindings = (data.sarif ? parseSarif(data.sarif) : []).filter((f) =>
      fileInPr(f.location && f.location.filePath, changed)
    );
    const findings = [...codeqlFindings, ...mapSonarIssuesToFindings(prSonarIssues)];
    const countType = (t) => prSonarIssues.filter((i) => i.type === t).length;
    const criticalFindings = findings.filter(
      (f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    ).length;

    return {
      ...pr,
      scanned: true,
      summary: {
        ...pr.summary,
        qualityGate: sonar.qualityGate || 'NONE',
        bugs: countType('BUG'),
        vulnerabilities: countType('VULNERABILITY'),
        codeSmells: countType('CODE_SMELL'),
        securityHotspots: countType('SECURITY_HOTSPOT'),
        coverage: sonar.coverage,
        criticalFindings,
      },
    };
  } catch (e) {
    return pr;
  }
}
