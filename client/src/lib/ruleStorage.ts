import { KEYS, readJSON, writeJSON } from "@/lib/cloudStore";
import type { Rule, RuleSignature } from "@/types/rule";

export function loadRules(): Rule[] {
  try {
    return readJSON<Rule[]>(KEYS.rules) ?? [];
  } catch {
    return [];
  }
}

export function saveRules(rules: Rule[]): void {
  writeJSON(KEYS.rules, rules);
}

export function loadRuleSignatures(): RuleSignature[] {
  try {
    return readJSON<RuleSignature[]>(KEYS.ruleSignatures) ?? [];
  } catch {
    return [];
  }
}

export function saveRuleSignatures(signatures: RuleSignature[]): void {
  writeJSON(KEYS.ruleSignatures, signatures);
}
