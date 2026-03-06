export interface Candidate {
  componentId: string;
  supplierOptionId: string | null;
  supplierName: string | null;
  costMyr: number;
  sstPassThroughMyr: number;
}

export interface CandidateGroup {
  componentId: string;
  candidates: Candidate[];
}

export interface OptimizerResult {
  totalCost: number;
  selected: Candidate[];
}

export function findMinCostCombination(groups: CandidateGroup[]): OptimizerResult | null {
  if (groups.length === 0) {
    return {
      totalCost: 0,
      selected: [],
    };
  }

  let best: OptimizerResult | null = null;

  function walk(index: number, selected: Candidate[], runningTotal: number): void {
    if (index >= groups.length) {
      if (!best || runningTotal < best.totalCost) {
        best = {
          totalCost: runningTotal,
          selected: [...selected],
        };
      }
      return;
    }

    const group = groups[index];
    group.candidates.forEach((candidate) => {
      const nextTotal = runningTotal + candidate.costMyr + candidate.sstPassThroughMyr;
      if (best && nextTotal >= best.totalCost) {
        return;
      }
      selected.push(candidate);
      walk(index + 1, selected, nextTotal);
      selected.pop();
    });
  }

  walk(0, [], 0);
  return best;
}
