/**
 * Minimal Graphviz DOT parser.
 * Extracts nodes and directed edges from a DOT string.
 * Supports: `a -> b;`, `"a" -> "b"`, optional `[label="..."]`.
 */

export function parseDot(dotString) {
  if (!dotString || typeof dotString !== 'string') {
    return { nodes: [], edges: [] };
  }

  const nodesMap = new Map();
  const edges = [];

  const edgeRegex = /"?([\w.$<>:()\s-]+?)"?\s*->\s*"?([\w.$<>:()\s-]+?)"?\s*(?:\[[^\]]*\])?\s*;/g;
  let match;
  while ((match = edgeRegex.exec(dotString)) !== null) {
    const from = match[1].trim();
    const to = match[2].trim();
    if (!nodesMap.has(from)) {
      nodesMap.set(from, { id: from, label: from, type: 'method', isImpacted: false });
    }
    if (!nodesMap.has(to)) {
      nodesMap.set(to, { id: to, label: to, type: 'method', isImpacted: false });
    }
    edges.push({ from, to });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}

export function markImpacted(graph, impactedFilePaths = []) {
  const paths = impactedFilePaths.map((p) => String(p || '').toLowerCase());
  const nodes = graph.nodes.map((n) => {
    const label = String(n.label || '').toLowerCase();
    const lastDot = label.lastIndexOf('.');
    const qualifiedClass = lastDot > 0 ? label.slice(0, lastDot) : label;
    const classPath = qualifiedClass.replace(/\./g, '/');
    const simpleClass = qualifiedClass.split('.').pop();
    const isImpacted = paths.some(
      (p) =>
        (classPath.length > 2 && p.includes(classPath)) ||
        (simpleClass.length > 2 && p.includes('/' + simpleClass + '.'))
    );
    return { ...n, isImpacted };
  });
  return { nodes, edges: graph.edges };
}
