/**
 * Input Validation & Sanitization Service
 * 
 * Protects against:
 * - Prompt injection attacks
 * - XSS attempts
 * - Control character injection
 * - Excessive input length
 * - Malicious Unicode
 */

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  original: string;
  error?: string;
  warnings: string[];
  metadata: {
    originalLength: number;
    sanitizedLength: number;
    changesMade: string[];
  };
}

export interface ValidationOptions {
  maxLength?: number;
  allowHTML?: boolean;
  allowMarkdown?: boolean;
  strictMode?: boolean;
  preserveNewlines?: boolean;
  context?: 'user_input' | 'system_prompt' | 'memory_content' | 'api_response';
}

// Prompt injection patterns to detect and block
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction override attempts
  { pattern: /ignore\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|commands?|directives?)/i, severity: 'critical' },
  { pattern: /disregard\s+(all\s+)?(previous|prior)\s+instructions?/i, severity: 'critical' },
  { pattern: /forget\s+(everything|all)\s+(you|your)\s+(know|learned)/i, severity: 'critical' },
  { pattern: /you\s+are\s+now\s+(a|an)\s+/i, severity: 'critical' },
  { pattern: /system\s*[:\-]\s*/i, severity: 'critical' },
  { pattern: /assistant\s*[:\-]\s*/i, severity: 'high' },
  { pattern: /user\s*[:\-]\s*/i, severity: 'high' },
  { pattern: /human\s*[:\-]\s*/i, severity: 'high' },
  
  // Role-playing attacks
  { pattern: /pretend\s+(to\s+be|you\s+are|you're)/i, severity: 'high' },
  { pattern: /act\s+(as|like)\s+(a|an)\s+/i, severity: 'high' },
  { pattern: /role\s*[:\-]?\s*play/i, severity: 'medium' },
  { pattern: /imagine\s+you\s+are/i, severity: 'medium' },
  
  // Delimiter attacks
  { pattern: /\[\s*(INST|SYSTEM|IM_END|IM_START)\s*\]/i, severity: 'critical' },
  { pattern: /<<\s*(SYS|INST)\s*>>/i, severity: 'critical' },
  { pattern: /<\|(?:im_start|im_end|system|user|assistant)\|>/i, severity: 'critical' },
  { pattern: /###\s*(System|Instruction|Assistant)/i, severity: 'high' },
  
  // Jailbreak patterns
  { pattern: /DAN\s*[:\-]?\s*(do\s+anything\s+now)/i, severity: 'high' },
  { pattern: /jailbreak/i, severity: 'high' },
  { pattern: /bypass\s+(restrictions?|filters?|safety)/i, severity: 'high' },
  { pattern: /developer\s+mode/i, severity: 'high' },
  { pattern: /sudo\s+/i, severity: 'medium' },
  
  // Encoding obfuscation
  { pattern: /base64\s*[:\-]?\s*[A-Za-z0-9+/]{20,}={0,2}/i, severity: 'medium' },
  { pattern: /\$\{.*\}/i, severity: 'medium' }, // Template injection
  { pattern: /\{\{.*\}\}/i, severity: 'medium' }, // Mustache/template injection
];

// XSS patterns
const XSS_PATTERNS = [
  { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, severity: 'critical' },
  { pattern: /javascript\s*:/i, severity: 'critical' },
  { pattern: /on\w+\s*=\s*["']?[^"'>]+/i, severity: 'critical' }, // onclick, onerror, etc.
  { pattern: /<iframe\b/i, severity: 'critical' },
  { pattern: /<object\b/i, severity: 'critical' },
  { pattern: /<embed\b/i, severity: 'critical' },
  { pattern: /data\s*:\s*text\/html/i, severity: 'critical' },
];

// Control characters that could cause issues
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

// Zero-width and invisible characters (potential obfuscation)
const INVISIBLE_CHARS = /[\u200B-\u200F\uFEFF\u2060-\u206F]/g;

// Excessive repetition (potential DoS)
const REPETITION_PATTERN = /(.)\1{50,}/;

class InputValidator {
  private readonly DEFAULT_MAX_LENGTH = 5000;
  private readonly MAX_NEWLINES = 50;

  /**
   * Validate and sanitize user input
   */
  validate(input: string, options: ValidationOptions = {}): ValidationResult {
    const {
      maxLength = this.DEFAULT_MAX_LENGTH,
      allowHTML = false,
      allowMarkdown = true,
      strictMode = false,
      preserveNewlines = true,
      context = 'user_input'
    } = options;

    const warnings: string[] = [];
    const changesMade: string[] = [];
    const originalLength = input.length;

    // Check for empty input
    if (!input || input.trim().length === 0) {
      return {
        valid: false,
        sanitized: '',
        original: input,
        error: 'Input is empty or contains only whitespace',
        warnings: [],
        metadata: {
          originalLength: 0,
          sanitizedLength: 0,
          changesMade: []
        }
      };
    }

    // Check length
    if (input.length > maxLength) {
      if (strictMode) {
        return {
          valid: false,
          sanitized: input.substring(0, maxLength),
          original: input,
          error: `Input exceeds maximum length of ${maxLength} characters`,
          warnings: [`Input truncated from ${input.length} to ${maxLength} characters`],
          metadata: {
            originalLength,
            sanitizedLength: maxLength,
            changesMade: ['truncated']
          }
        };
      }
      warnings.push(`Input truncated from ${input.length} to ${maxLength} characters`);
      changesMade.push('truncated');
      input = input.substring(0, maxLength);
    }

    let sanitized = input;

    // Remove control characters
    if (CONTROL_CHARS.test(sanitized)) {
      sanitized = sanitized.replace(CONTROL_CHARS, '');
      changesMade.push('removed_control_chars');
      warnings.push('Control characters removed');
    }

    // Remove invisible characters (unless in strict mode where we reject)
    if (INVISIBLE_CHARS.test(sanitized)) {
      if (strictMode) {
        return {
          valid: false,
          sanitized: sanitized.replace(INVISIBLE_CHARS, ''),
          original: input,
          error: 'Input contains invisible/obfuscation characters',
          warnings: ['Invisible characters detected - possible obfuscation attempt'],
          metadata: {
            originalLength,
            sanitizedLength: sanitized.length,
            changesMade: []
          }
        };
      }
      sanitized = sanitized.replace(INVISIBLE_CHARS, '');
      changesMade.push('removed_invisible_chars');
      warnings.push('Invisible characters removed');
    }

    // Check for excessive repetition
    if (REPETITION_PATTERN.test(sanitized)) {
      if (strictMode) {
        return {
          valid: false,
          sanitized,
          original: input,
          error: 'Input contains excessive character repetition',
          warnings: ['Possible DoS attempt detected'],
          metadata: {
            originalLength,
            sanitizedLength: sanitized.length,
            changesMade: []
          }
        };
      }
      // Collapse repetition
      sanitized = sanitized.replace(REPETITION_PATTERN, '$1$1$1');
      changesMade.push('collapsed_repetition');
      warnings.push('Excessive repetition normalized');
    }

    // Check for XSS attempts
    const xssMatches = this.findMatches(sanitized, XSS_PATTERNS);
    if (xssMatches.length > 0) {
      const criticalXSS = xssMatches.some(m => m.severity === 'critical');
      if (criticalXSS || !allowHTML) {
        return {
          valid: false,
          sanitized: this.escapeHTML(sanitized),
          original: input,
          error: 'Potential XSS attack detected',
          warnings: xssMatches.map(m => `XSS pattern: ${m.pattern}`),
          metadata: {
            originalLength,
            sanitizedLength: sanitized.length,
            changesMade: []
          }
        };
      }
      warnings.push('HTML content detected');
    }

    // Check for prompt injection
    const injectionMatches = this.findMatches(sanitized, PROMPT_INJECTION_PATTERNS);
    if (injectionMatches.length > 0) {
      const criticalInjections = injectionMatches.filter(m => m.severity === 'critical');
      
      if (criticalInjections.length > 0 || strictMode) {
        return {
          valid: false,
          sanitized,
          original: input,
          error: 'Potential prompt injection attack detected',
          warnings: injectionMatches.map(m => `Injection pattern: ${m.pattern}`),
          metadata: {
            originalLength,
            sanitizedLength: sanitized.length,
            changesMade: []
          }
        };
      }
      
      warnings.push(`Suspicious patterns detected: ${injectionMatches.length} matches`);
    }

    // Normalize newlines if not preserving
    if (!preserveNewlines) {
      sanitized = sanitized.replace(/\n+/g, ' ');
      changesMade.push('normalized_newlines');
    } else {
      // Limit consecutive newlines
      const newlineCount = (sanitized.match(/\n/g) || []).length;
      if (newlineCount > this.MAX_NEWLINES) {
        sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
        changesMade.push('limited_newlines');
        warnings.push('Excessive newlines normalized');
      }
    }

    // Context-specific sanitization
    switch (context) {
      case 'system_prompt':
        // Extra strict for system prompts
        sanitized = this.sanitizeForSystemPrompt(sanitized);
        break;
      case 'memory_content':
        // Ensure memory content is clean
        sanitized = this.sanitizeForMemory(sanitized);
        break;
    }

    // Final trim
    const trimmed = sanitized.trim();
    if (trimmed !== sanitized) {
      changesMade.push('trimmed');
    }

    return {
      valid: warnings.length === 0 || !strictMode,
      sanitized: trimmed,
      original: input,
      warnings,
      metadata: {
        originalLength,
        sanitizedLength: trimmed.length,
        changesMade
      }
    };
  }

  /**
   * Quick validation - returns boolean
   */
  isValid(input: string, options?: ValidationOptions): boolean {
    return this.validate(input, options).valid;
  }

  /**
   * Sanitize without validation - just clean the input
   */
  sanitize(input: string, options: ValidationOptions = {}): string {
    const result = this.validate(input, { ...options, strictMode: false });
    return result.sanitized;
  }

  /**
   * Check if input contains any injection attempts
   */
  containsInjection(input: string): { detected: boolean; patterns: string[] } {
    const matches = this.findMatches(input, PROMPT_INJECTION_PATTERNS);
    return {
      detected: matches.length > 0,
      patterns: matches.map(m => m.pattern)
    };
  }

  /**
   * Escape HTML entities
   */
  escapeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate API response for safety
   */
  validateAPIResponse(response: string): ValidationResult {
    // API responses get more lenient treatment but still check for XSS
    return this.validate(response, {
      maxLength: 10000,
      allowHTML: false,
      allowMarkdown: true,
      strictMode: false,
      context: 'api_response'
    });
  }

  // ==================== PRIVATE METHODS ====================

  private findMatches(
    input: string, 
    patterns: Array<{ pattern: RegExp; severity: string }>
  ): Array<{ pattern: string; severity: string; match: string }> {
    const matches: Array<{ pattern: string; severity: string; match: string }> = [];
    
    for (const { pattern, severity } of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const match = regex.exec(input);
      if (match) {
        matches.push({
          pattern: pattern.source,
          severity,
          match: match[0]
        });
      }
    }
    
    return matches;
  }

  private sanitizeForSystemPrompt(input: string): string {
    // Remove any potential role delimiters
    return input
      .replace(/\[\s*(INST|SYSTEM)\s*\]/gi, '')
      .replace(/<<\s*(SYS|INST)\s*>>/gi, '')
      .replace(/<\|(?:im_start|im_end|system|user|assistant)\|>/gi, '');
  }

  private sanitizeForMemory(input: string): string {
    // Ensure memory content doesn't contain special markers
    return input
      .replace(/\[MEMORY\]/gi, '')
      .replace(/\[CONTEXT\]/gi, '');
  }
}

// Export singleton
export const inputValidator = new InputValidator();

// Convenience function for quick validation
export function validateInput(
  input: string, 
  options?: ValidationOptions
): ValidationResult {
  return inputValidator.validate(input, options);
}

// Hook for React components
export function useInputValidation(options?: ValidationOptions) {
  return {
    validate: (input: string) => inputValidator.validate(input, options),
    isValid: (input: string) => inputValidator.isValid(input, options),
    sanitize: (input: string) => inputValidator.sanitize(input, options)
  };
}
