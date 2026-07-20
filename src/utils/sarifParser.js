/**
 * Minimal SARIF v2.1.0 parser.
 * Converts a raw SARIF JSON blob into a flat list of findings usable by the UI.
 */

const sarifLevelToSeverity = {
  error: 'HIGH',
  warning: 'MED',
  note: 'LOW',
  none: 'LOW',
};

const ruleCategory = (ruleId = '') => {
  const id = ruleId.toLowerCase();
  if (id.includes('sql-injection') || id.includes('csrf') || id.includes('hardcoded') || id.includes('credential') || id.includes('xss')) {
    return 'SECURITY';
  }
  if (id.includes('null') || id.includes('npe') || id.includes('exception') || id.includes('bug')) {
    return 'BUG';
  }
  return 'SMELL';
};

export function parseSarif(sarif) {
  if (!sarif || !Array.isArray(sarif.runs)) return [];

  const findings = [];

  sarif.runs.forEach((run, runIdx) => {
    const rulesById = {};
    const rules = run?.tool?.driver?.rules || [];
    rules.forEach((r) => {
      rulesById[r.id] = r;
    });

    const results = run.results || [];
    results.forEach((res, idx) => {
      const ruleId = res.ruleId || res.rule?.id || 'unknown';
      const rule = rulesById[ruleId] || {};
      const loc = res.locations?.[0]?.physicalLocation || {};
      const region = loc.region || {};

      findings.push({
        id: `${runIdx}-${idx}-${ruleId}`,
        ruleId,
        title: rule.shortDescription?.text || ruleId,
        description:
          res.message?.text ||
          rule.fullDescription?.text ||
          rule.help?.text ||
          '',
        severity: sarifLevelToSeverity[res.level] || 'MED',
        category: ruleCategory(ruleId),
        location: {
          filePath: loc.artifactLocation?.uri || '',
          startLine: region.startLine || 0,
          endLine: region.endLine || region.startLine || 0,
          snippet: region.snippet?.text || '',
        },
        source: 'codeql',
      });
    });
  });

  return findings;
}

export function severityRank(severity) {
  switch (severity) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MED':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 0;
  }
}

export function sortBySeverity(findings) {
  return [...findings].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity)
  );
}
