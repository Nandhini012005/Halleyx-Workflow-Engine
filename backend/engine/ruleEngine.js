/**
 * Rule Engine
 * Evaluates rule conditions against execution data
 * Supports: comparison, logical, string operators, branching, looping
 */

/**
 * Safely evaluate a condition string against given data
 * @param {string} condition - e.g. "amount > 100 && country == 'US'"
 * @param {object} data - execution input data
 * @returns {{ matched: boolean, error: string|null }}
 */
function evaluateCondition(condition, data) {
  if (!condition || condition.trim().toUpperCase() === 'DEFAULT') {
    return { matched: true, error: null };
  }

  try {
    // Replace string functions with JS equivalents
    let expr = condition
      .replace(/contains\((\w+),\s*["']([^"']+)["']\)/g, (_, field, val) => {
        return `(String(data.${field} || '').includes('${val}'))`;
      })
      .replace(/startsWith\((\w+),\s*["']([^"']+)["']\)/g, (_, field, val) => {
        return `(String(data.${field} || '').startsWith('${val}'))`;
      })
      .replace(/endsWith\((\w+),\s*["']([^"']+)["']\)/g, (_, field, val) => {
        return `(String(data.${field} || '').endsWith('${val}'))`;
      })
      // Replace bare field names with data.field
      .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()/g, (match) => {
        // Skip JS keywords and operators
        const keywords = ['true', 'false', 'null', 'undefined', 'AND', 'OR', 'data', 'String'];
        if (keywords.includes(match)) return match;
        return `data.${match}`;
      })
      // Replace && and || (already valid JS)
      .replace(/\bAND\b/gi, '&&')
      .replace(/\bOR\b/gi, '||');

    // Safe eval using Function constructor with only data in scope
    const fn = new Function('data', `"use strict"; try { return !!(${expr}); } catch(e) { return false; }`);
    const result = fn(data);
    return { matched: result, error: null };
  } catch (err) {
    return { matched: false, error: `Rule evaluation error: ${err.message}` };
  }
}

/**
 * Evaluate all rules for a step and return the winning rule
 * @param {Array} rules - sorted by priority ascending
 * @param {object} data - execution data
 * @returns {{ rule: object|null, log: object }}
 */
function evaluateRules(rules, data) {
  if (!rules || rules.length === 0) {
    return {
      rule: null,
      log: { matched: false, reason: 'No rules defined for step', evaluated: [] }
    };
  }

  // Sort by priority (lowest = highest priority)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  const evaluated = [];
  let defaultRule = null;

  for (const rule of sorted) {
    if (rule.condition.trim().toUpperCase() === 'DEFAULT') {
      defaultRule = rule;
      evaluated.push({ rule_id: rule._id, condition: rule.condition, matched: false, is_default: true });
      continue;
    }

    const { matched, error } = evaluateCondition(rule.condition, data);
    evaluated.push({
      rule_id: rule._id,
      condition: rule.condition,
      priority: rule.priority,
      matched,
      error: error || undefined
    });

    if (error) {
      // Invalid rule - log and continue
      continue;
    }

    if (matched) {
      return {
        rule,
        log: {
          matched: true,
          winning_rule: { id: rule._id, condition: rule.condition, priority: rule.priority },
          next_step_id: rule.next_step_id,
          evaluated
        }
      };
    }
  }

  // No rule matched - use DEFAULT if available
  if (defaultRule) {
    return {
      rule: defaultRule,
      log: {
        matched: true,
        winning_rule: { id: defaultRule._id, condition: 'DEFAULT', priority: defaultRule.priority },
        next_step_id: defaultRule.next_step_id,
        evaluated,
        used_default: true
      }
    };
  }

  return {
    rule: null,
    log: { matched: false, reason: 'No matching rule and no DEFAULT rule found', evaluated }
  };
}

/**
 * Validate a condition string for syntax errors
 * @param {string} condition
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateCondition(condition) {
  if (!condition || condition.trim().toUpperCase() === 'DEFAULT') {
    return { valid: true, error: null };
  }
  const { error } = evaluateCondition(condition, {});
  // If error is about undefined variables, that's OK at validation time
  if (error && error.includes('Rule evaluation error')) {
    return { valid: false, error };
  }
  return { valid: true, error: null };
}

module.exports = { evaluateCondition, evaluateRules, validateCondition };
