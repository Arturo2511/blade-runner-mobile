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
  const impactedSet = new Set(impactedFilePaths.map((p) => p.toLowerCase()));
  const nodes = graph.nodes.map((n) => {
    const matchesImpact = [...impactedSet].some((p) =>
      n.label.toLowerCase().includes(p.toLowerCase())
    );
    return { ...n, isImpacted: matchesImpact };
  });
  return { nodes, edges: graph.edges };
}
