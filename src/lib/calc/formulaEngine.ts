import { parse } from "mathjs";

import type { FormulaContext, FormulaEvalResult, FormulaParameter } from "./types";

type Metric = "cost" | "sell" | "profit";
type NodeLike = {
  type: string;
  [key: string]: unknown;
};

const allowedFunctions = new Set(["min", "max", "ceil", "floor", "round", "__comp_cost", "__comp_sell", "__comp_profit"]);
const allowedOperators = new Set(["+", "-", "*", "/"]);
const baseAllowedSymbols = ["qty", "code_qty", "area_m2", "total_weight", "fx"] as const;

const COMP_REF_REGEX = /comp\(\s*["']([^"']+)["']\s*\)\.(cost|sell|profit)/g;

export function extractComponentReferences(expression: string): string[] {
  const refs = new Set<string>();

  expression.replaceAll(COMP_REF_REGEX, (full, idOrKey: string) => {
    refs.add(idOrKey);
    return full;
  });

  return [...refs];
}

function normalizeExpression(expression: string): string {
  return expression.replaceAll(COMP_REF_REGEX, (_full, idOrKey: string, metric: Metric) => `__comp_${metric}("${idOrKey}")`);
}

function isNumericConstantNode(node: NodeLike | null | undefined): boolean {
  return node?.type === "ConstantNode" && typeof node.value === "number";
}

function isStringConstantNode(node: NodeLike | null | undefined): boolean {
  return node?.type === "ConstantNode" && typeof node.value === "string";
}

function asNodeArray(value: unknown): NodeLike[] {
  return Array.isArray(value) ? (value as NodeLike[]) : [];
}

function validateAst(node: NodeLike | null | undefined, allowedSymbols: Set<string>): string | null {
  if (!node) {
    return "Empty expression";
  }

  switch (node.type) {
    case "ParenthesisNode":
      return validateAst(node.content as NodeLike, allowedSymbols);
    case "ConstantNode":
      if (isNumericConstantNode(node) || isStringConstantNode(node)) {
        return null;
      }
      return "Only numeric and string constants are allowed";
    case "SymbolNode": {
      const symbol = typeof node.name === "string" ? node.name : "";
      if (!allowedSymbols.has(symbol)) {
        return `Symbol '${symbol}' is not allowed`;
      }
      return null;
    }
    case "OperatorNode": {
      const op = typeof node.op === "string" ? node.op : "";
      if (!allowedOperators.has(op)) {
        return `Operator '${op}' is not allowed`;
      }
      const args = asNodeArray(node.args);
      for (const arg of args) {
        const err = validateAst(arg, allowedSymbols);
        if (err) {
          return err;
        }
      }
      return null;
    }
    case "FunctionNode": {
      const fnNode = node.fn as NodeLike | undefined;
      const fnName = fnNode && typeof fnNode.name === "string" ? fnNode.name : "";

      if (!allowedFunctions.has(fnName)) {
        return `Function '${fnName || "unknown"}' is not allowed`;
      }

      const args = asNodeArray(node.args);
      if (fnName.startsWith("__comp_")) {
        if (args.length !== 1 || !isStringConstantNode(args[0])) {
          return `${fnName} must take exactly one string argument`;
        }
        return null;
      }

      for (const arg of args) {
        const err = validateAst(arg, allowedSymbols);
        if (err) {
          return err;
        }
      }
      return null;
    }
    default:
      return `Node type '${node.type}' is not allowed`;
  }
}

function collectSymbolNames(node: NodeLike | null | undefined, symbols: Set<string>): void {
  if (!node) {
    return;
  }

  switch (node.type) {
    case "ParenthesisNode":
      collectSymbolNames(node.content as NodeLike, symbols);
      return;
    case "ConstantNode":
      return;
    case "SymbolNode": {
      const symbol = typeof node.name === "string" ? node.name : "";
      if (symbol) {
        symbols.add(symbol);
      }
      return;
    }
    case "OperatorNode":
      asNodeArray(node.args).forEach((arg) => collectSymbolNames(arg, symbols));
      return;
    case "FunctionNode": {
      const fnNode = node.fn as NodeLike | undefined;
      const fnName = fnNode && typeof fnNode.name === "string" ? fnNode.name : "";
      if (!fnName.startsWith("__comp_")) {
        asNodeArray(node.args).forEach((arg) => collectSymbolNames(arg, symbols));
      }
      return;
    }
    default:
      return;
  }
}

export function detectMissingParameterNames(expression: string, parameters: FormulaParameter[]): FormulaEvalResult & { names?: string[] } {
  if (!expression.trim()) {
    return {
      ok: false,
      error: "Expression cannot be empty",
      references: [],
    };
  }

  const references = extractComponentReferences(expression);
  const normalized = normalizeExpression(expression);
  try {
    const node = parse(normalized) as unknown as NodeLike;
    const symbolNames = new Set<string>();
    collectSymbolNames(node, symbolNames);

    const taken = new Set<string>([...baseAllowedSymbols, ...parameters.map((parameter) => parameter.name)]);
    const names = [...symbolNames].filter((name) => !taken.has(name)).sort((a, b) => a.localeCompare(b));

    return {
      ok: true,
      references,
      names,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid expression",
      references,
    };
  }
}

export function validateFormulaExpression(expression: string, parameters: FormulaParameter[]): FormulaEvalResult {
  if (!expression.trim()) {
    return {
      ok: false,
      error: "Expression cannot be empty",
      references: [],
    };
  }

  const references = extractComponentReferences(expression);
  const normalized = normalizeExpression(expression);

  try {
    const node = parse(normalized) as unknown as NodeLike;
    const allowedSymbols = new Set([...baseAllowedSymbols, ...parameters.map((parameter) => parameter.name)]);

    const error = validateAst(node, allowedSymbols);
    if (error) {
      return {
        ok: false,
        error,
        references,
      };
    }

    return {
      ok: true,
      references,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid expression",
      references,
    };
  }
}

interface FormulaEvalArgs {
  expression: string;
  parameters: FormulaParameter[];
  context: FormulaContext;
  fx: number;
  getComponentMetric: (idOrKey: string, metric: Metric) => number;
}

export function evaluateFormulaExpression(args: FormulaEvalArgs): FormulaEvalResult {
  const validation = validateFormulaExpression(args.expression, args.parameters);
  if (!validation.ok) {
    return validation;
  }

  const normalized = normalizeExpression(args.expression);

  try {
    const node = parse(normalized);
    const compiled = node.compile();

    const parameterScope = args.parameters.reduce<Record<string, number>>((acc, parameter) => {
      acc[parameter.name] = parameter.currency === "RMB" ? parameter.value / args.fx : parameter.value;
      return acc;
    }, {});

    const scope = {
      qty: args.context.qty,
      code_qty: args.context.code_qty,
      area_m2: args.context.area_m2,
      total_weight: args.context.total_weight,
      fx: args.context.fx,
      ...parameterScope,
      min: Math.min,
      max: Math.max,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      __comp_cost: (idOrKey: string) => args.getComponentMetric(idOrKey, "cost"),
      __comp_sell: (idOrKey: string) => args.getComponentMetric(idOrKey, "sell"),
      __comp_profit: (idOrKey: string) => args.getComponentMetric(idOrKey, "profit"),
    };

    const value = compiled.evaluate(scope);

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return {
        ok: false,
        error: "Formula result must be a finite number",
        references: validation.references,
      };
    }

    return {
      ok: true,
      value,
      references: validation.references,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to evaluate formula",
      references: validation.references,
    };
  }
}
