import type { QuoteComponent } from "./types";
import { extractComponentReferences } from "./formulaEngine";

export interface DependencyGraph {
  graph: Map<string, string[]>;
  idLookup: Map<string, string>;
}

export function buildFormulaDependencyGraph(components: QuoteComponent[]): DependencyGraph {
  const enabled = components.filter((component) => component.enabled);
  const idLookup = new Map<string, string>();

  enabled.forEach((component) => {
    idLookup.set(component.component_id, component.component_id);
    idLookup.set(component.template_key, component.component_id);
  });

  const formulaComponents = enabled.filter(
    (component) =>
      component.type === "FORMULA_BUILDER" ||
      (component.type === "TIER_TOTAL_MUST_MATCH_OR_FORMULA" && component.formula_builder),
  );

  const graph = new Map<string, string[]>();

  formulaComponents.forEach((component) => {
    const refs = extractComponentReferences(component.formula_builder?.expression ?? "");
    const deps = refs
      .map((ref) => idLookup.get(ref))
      .filter((item): item is string => Boolean(item))
      .filter((depId) => depId !== component.component_id);

    graph.set(component.component_id, Array.from(new Set(deps)));
  });

  return { graph, idLookup };
}

export function detectCycle(graph: Map<string, string[]>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): string[] | null {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      return [...stack.slice(idx), node];
    }

    if (visited.has(node)) {
      return null;
    }

    visiting.add(node);
    stack.push(node);

    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (!graph.has(dep)) {
        continue;
      }
      const cycle = dfs(dep);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = dfs(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

export function topoSort(graph: Map<string, string[]>): string[] {
  const visited = new Set<string>();
  const temp = new Set<string>();
  const result: string[] = [];

  function visit(node: string): void {
    if (visited.has(node)) {
      return;
    }
    if (temp.has(node)) {
      throw new Error(`Cycle detected at ${node}`);
    }

    temp.add(node);
    const deps = graph.get(node) ?? [];
    deps.forEach((dep) => {
      if (graph.has(dep)) {
        visit(dep);
      }
    });
    temp.delete(node);
    visited.add(node);
    result.push(node);
  }

  graph.forEach((_deps, node) => visit(node));
  return result;
}
