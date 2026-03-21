import { getItemEmoji, normalizeCategory, detectCategoryFromName, determineStorageLocation } from './PantryItemFormatter'
import { ScannedItem } from './ScanningService'
import { logger } from './Logger'

export interface ParsedOcrReceipt {
  items: Array<{
    name: string
    price: number
    quantity: number
    unit: string
    unitPrice?: number
    lineTotal?: number
  }>
  receiptSubtotal?: number
  receiptTax?: number
  receiptTaxRate?: number
  receiptTotal?: number
  store?: string
  date?: string
  selectedTotalsBlockIndex?: number
  allParsedTotalsBlocks?: Array<{ subtotal?: number; tax?: number; total?: number }>
}

const MONEY_REGEX = /\d+\.\d{2}/g
const WEIGHT_REGEX = /(\d+(?:\.\d+)?)\s*(lb|lbs|kg|oz)\b/i

/** Normalize decimal separator: 9,99 -> 9.99 for parsing */
function normalizeDecimalInLine(line: string): string {
  return line.replace(/(\d+),(\d{2})\b/g, '$1.$2')
}

/**
 * Normalize OCR text to fix common recognition errors
 * - Uppercases text
 * - Collapses whitespace
 * - Fixes OCR digit confusions (O→0, I/L→1) only in numeric contexts
 * - Strips non-ASCII control chars
 */
function normalizeOCRText(text: string): string {
  // Uppercase
  let normalized = text.toUpperCase()
  
  // Strip non-ASCII control chars (keep printable ASCII + newlines)
  normalized = normalized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  
  // Fix OCR digit confusions in "numeric-like tokens"
  // Examples:
  // - 9O.91 -> 90.91
  // - 1O.OOO% -> 10.000%
  // - 9.O9 -> 9.09
  // - 1OO.OO -> 100.00
  normalized = normalized.replace(/[0-9OIL]+(?:\.[0-9OIL]{1,4})?%?/g, (token) => {
    const hasDigit = /\d/.test(token)
    const hasConfusable = /[OIL]/.test(token)
    if (!hasDigit || !hasConfusable) return token
    return token.replace(/O/g, '0').replace(/[IL]/g, '1')
  })
  
  // Fix common OCR errors in keywords: S→5, A→4, T→7 in specific contexts
  // But be careful - only fix when it makes sense (near known keywords)
  // This is handled by fuzzy patterns instead
  
  // Collapse multiple spaces/tabs to single space
  normalized = normalized.replace(/[\s\t]+/g, ' ')
  
  // Collapse multiple newlines to single newline
  normalized = normalized.replace(/\r\n/g, '\n')
  normalized = normalized.replace(/\r/g, '\n')
  normalized = normalized.replace(/\n{3,}/g, '\n\n')
  
  return normalized.trim()
}

/**
 * Parse totals from receipt text using tolerant, fuzzy matching
 * Handles noisy OCR output with fuzzy keyword matching
 * Focuses on bottom section of receipt (last 25% of lines or last 25 lines)
 * Handles Walmart-style receipts: SUBTOTAL 90.91, TAX 10.000% 9.09, TOTAL 100.00
 * Handles Costco-style receipts with multiple total blocks (original + rebate-adjusted)
 */
export function parseTotalsFromText(text: string): {
  subtotal?: number
  taxAmount?: number
  taxRate?: number
  total?: number
  selectedTotalsBlockIndex?: number
  allParsedTotalsBlocks?: Array<{ subtotal?: number; tax?: number; total?: number }>
} {
  // Split OCR text into lines FIRST (before normalization to preserve order)
  const rawLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0)
  
  // Normalize each line individually
  const allLines = rawLines.map(line => normalizeOCRText(line))
  
  // Focus on ACTUAL bottom section: last 30 lines OR last 25% of lines, whichever is larger
  const bottomSectionSize = Math.max(Math.ceil(allLines.length * 0.25), Math.min(30, allLines.length))
  const bottomLines = allLines.slice(-bottomSectionSize)
  const bottomSection = bottomLines.join('\n')
  
  // Log bottom section for debugging
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    logger.debug('OCR bottom section', {
      lines: bottomLines.length,
      first3: bottomLines.slice(0, 3),
      last3: bottomLines.slice(-3),
      preview: bottomSection.substring(0, 500) + (bottomSection.length > 500 ? '...' : ''),
    })
  }
  
  // Keyword patterns for Google Vision OCR (multi-line support)
  const SUBTOTAL_PATTERN = /SUB\s*TOTAL|SUBTOTAL|5UBT0TAL/i
  const TOTAL_PATTERN = /(^|\s)TOTAL(\s|$)/i  // Must not match SUBTOTAL
  const TAX_PATTERN = /^(TAX|GST|HST|QST)\b/i
  const REBATE_PATTERN = /(REBATE|EXECUTIVE REBATE|COUPON|DISCOUNT)\b/i
  
  // Money regex: currency values
  const MONEY_REGEX = /\b\d{1,4}\.\d{2}\b/g
  
  // Tax rate regex: percentage values
  const TAX_RATE_REGEX = /\b\d{1,2}\.\d{1,3}\s*%/g
  
  // Tax rate fallback: 3-decimal number between 0-20 (e.g., 10.000)
  const TAX_RATE_FALLBACK_REGEX = /^\d{1,2}\.\d{3}$/
  
  // Helper: Find first money value in a line (supports comma decimal: 160,79)
  function findMoneyValue(line: string): number | null {
    const normalized = normalizeDecimalInLine(line)
    const matches = normalized.match(MONEY_REGEX)
    if (!matches || matches.length === 0) return null
    const value = parseFloat(matches[0]) // Use first match
    return (!isNaN(value) && value > 0 && value < 100000) ? value : null
  }
  
  // Helper: Find tax rate (percentage or 3-decimal fallback)
  function findTaxRate(line: string): number | null {
    // Try percentage first
    const percentMatch = line.match(TAX_RATE_REGEX)
    if (percentMatch) {
      const rate = parseFloat(percentMatch[0].replace('%', ''))
      if (!isNaN(rate) && rate > 0 && rate < 100) {
        return rate
      }
    }
    
    // Fallback: 3-decimal number between 0-20
    const fallbackMatch = line.match(TAX_RATE_FALLBACK_REGEX)
    if (fallbackMatch) {
      const rate = parseFloat(fallbackMatch[0])
      if (!isNaN(rate) && rate >= 0 && rate <= 20) {
        return rate
      }
    }
    
    return null
  }
  
  // Split bottom section into "totals blocks" (Costco-style: multiple blocks separated by rebate lines).
  // We still parse all blocks, but we select the FIRST complete block (index 0) for output.
  const blocks: Array<{ start: number; end: number }> = []
  let currentStart = 0
  for (let i = 0; i < bottomLines.length; i++) {
    if (REBATE_PATTERN.test(bottomLines[i])) {
      blocks.push({ start: currentStart, end: i - 1 })
      currentStart = i + 1
    }
  }
  blocks.push({ start: currentStart, end: bottomLines.length - 1 })
  const nonEmptyBlocks = blocks.filter(b => b.start <= b.end)

  const parsedBlocks: Array<{ subtotal?: number; tax?: number; taxRate?: number; total?: number }> = []

  const parseBlock = (start: number, end: number) => {
    const subtotalCandidates: Array<{ value: number; keywordLine: number; valueLine: number }> = []
    const totalCandidates: Array<{ value: number; keywordLine: number; valueLine: number }> = []
    const taxCandidates: Array<{ amount?: number; rate?: number; keywordLine: number; amountLine?: number; rateLine?: number }> = []

    for (let i = start; i <= end; i++) {
      const line = bottomLines[i]
    
      // Check for SUBTOTAL keyword
      if (SUBTOTAL_PATTERN.test(line) && !TOTAL_PATTERN.test(line)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        logger.debug('SUBTOTAL keyword found', { lineIndex: i, line })
      }
      
      // Look for money value in current line, next line, or line after next
      let value: number | null = null
      let valueLineIndex = i
      
      for (let j = i; j <= Math.min(i + 2, bottomLines.length - 1); j++) {
        const candidateValue = findMoneyValue(bottomLines[j])
        if (candidateValue !== null) {
          value = candidateValue
          valueLineIndex = j
          break
        }
      }
      
        if (value !== null) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          logger.debug('Found subtotal value', { value, lineIndex: valueLineIndex, line: bottomLines[valueLineIndex] })
        }
          subtotalCandidates.push({ value, keywordLine: i, valueLine: valueLineIndex })
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          logger.debug('No money value found for SUBTOTAL', { start: i, end: Math.min(i + 2, bottomLines.length - 1) })
        }
      }
    }
    
      // Check for TOTAL keyword (but not SUBTOTAL)
      if (TOTAL_PATTERN.test(line) && !SUBTOTAL_PATTERN.test(line)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        logger.debug('TOTAL keyword found', { lineIndex: i, line })
      }
      
      // Look for money value in current line, next line, or line after next
      let value: number | null = null
      let valueLineIndex = i
      
      for (let j = i; j <= Math.min(i + 2, bottomLines.length - 1); j++) {
        const candidateValue = findMoneyValue(bottomLines[j])
        if (candidateValue !== null) {
          value = candidateValue
          valueLineIndex = j
          break
        }
      }
      
        if (value !== null) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          logger.debug('Found total value', { value, lineIndex: valueLineIndex, line: bottomLines[valueLineIndex] })
        }
          totalCandidates.push({ value, keywordLine: i, valueLine: valueLineIndex })
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          logger.debug('No money value found for TOTAL', { start: i, end: Math.min(i + 2, bottomLines.length - 1) })
        }
      }
    }
    
      // Check for TAX-like keyword (TAX/GST/HST/QST)
      if (TAX_PATTERN.test(line)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        logger.debug('TAX keyword found', { lineIndex: i, line })
      }
      
      const taxData: { amount?: number; rate?: number; keywordLine: number; amountLine?: number; rateLine?: number } = {
        keywordLine: i
      }
      
      // Look for tax rate: check lines i, i+1, i+2
      for (let j = i; j <= Math.min(i + 2, bottomLines.length - 1); j++) {
        const candidateRate = findTaxRate(bottomLines[j])
        if (candidateRate !== null) {
          taxData.rate = candidateRate
          taxData.rateLine = j
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            logger.debug('Found tax rate', { rate: candidateRate, lineIndex: j, line: bottomLines[j] })
          }
          break
        }
      }
      
      // Look for tax amount: check lines i, i+1, i+2, i+3
      for (let j = i; j <= Math.min(i + 3, bottomLines.length - 1); j++) {
        const candidateAmount = findMoneyValue(bottomLines[j])
        if (candidateAmount !== null && candidateAmount < 10000) { // Tax amount should be reasonable
          taxData.amount = candidateAmount
          taxData.amountLine = j
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            logger.debug('Found tax amount', { amount: candidateAmount, lineIndex: j, line: bottomLines[j] })
          }
          break
        }
      }
      
        if (taxData.amount || taxData.rate) {
          taxCandidates.push(taxData)
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          logger.debug('No tax rate/amount found', { start: i, end: Math.min(i + 3, bottomLines.length - 1) })
        }
      }
      }
    }

    let receiptSubtotal: number | undefined
    let receiptTotal: number | undefined
    let receiptTax: number | undefined
    let receiptTaxRate: number | undefined

    if (subtotalCandidates.length > 0) receiptSubtotal = subtotalCandidates[subtotalCandidates.length - 1].value
    if (totalCandidates.length > 0) receiptTotal = totalCandidates[totalCandidates.length - 1].value
    if (taxCandidates.length > 0) {
      const lastTax = taxCandidates[taxCandidates.length - 1]
      receiptTax = lastTax.amount
      receiptTaxRate = lastTax.rate
    }
    if (!receiptTaxRate) {
      for (const taxCandidate of taxCandidates) {
        if (taxCandidate.rate) {
          receiptTaxRate = taxCandidate.rate
          break
        }
      }
    }
    if (!receiptTax && receiptTotal && receiptSubtotal) {
      const inferredTax = receiptTotal - receiptSubtotal
      if (inferredTax > 0 && inferredTax < receiptTotal * 0.3) {
        receiptTax = Math.round(inferredTax * 100) / 100
      }
    }

    if (!receiptSubtotal || !receiptTotal) {
      receiptSubtotal = undefined
      receiptTotal = undefined
      receiptTax = undefined
    }

    if (receiptSubtotal) receiptSubtotal = Math.round(receiptSubtotal * 100) / 100
    if (receiptTax) receiptTax = Math.round(receiptTax * 100) / 100
    if (receiptTotal) receiptTotal = Math.round(receiptTotal * 100) / 100
    if (receiptTaxRate) receiptTaxRate = Math.round(receiptTaxRate * 1000) / 1000

    return { subtotal: receiptSubtotal, tax: receiptTax, taxRate: receiptTaxRate, total: receiptTotal }
  }

  for (const b of nonEmptyBlocks) {
    parsedBlocks.push(parseBlock(b.start, b.end))
  }

  const selectedIndex = 0
  const selected = parsedBlocks[selectedIndex] || {}

  return {
    subtotal: selected.subtotal,
    taxAmount: selected.tax,
    taxRate: selected.taxRate,
    total: selected.total,
    selectedTotalsBlockIndex: selectedIndex,
    allParsedTotalsBlocks: parsedBlocks.length > 0 ? parsedBlocks.map(b => ({ subtotal: b.subtotal, tax: b.tax, total: b.total })) : undefined
  }
}

/**
 * Parse weight item line pair (Walmart-style)
 * Example: "ONIONS" followed by "1.24 LB @ 0.78/LB" with right column "0.97"
 */
export function parseWeightLinePair(
  itemNameLine: string,
  weightLine: string,
  rightColumnTotal?: string
): {
  name: string
  quantity: number
  unit: string
  unitPrice?: number
  lineTotal: number
} | null {
  // Extract weight and unit - CRITICAL: quantity is the WEIGHT, not unitPrice or lineTotal
  const weightMatch = weightLine.match(/(\d+(?:\.\d+)?)\s*(LB|LBS|KG|OZ)\b/i)
  if (!weightMatch) return null
  
  // CRITICAL: quantity is the WEIGHT (e.g., 1.24), never unitPrice or lineTotal
  const quantity = parseFloat(weightMatch[1])
  if (isNaN(quantity) || quantity <= 0 || quantity > 1000) {
    return null // Invalid weight
  }
  
  let unit = (weightMatch[2] || 'lb').toLowerCase()
  if (unit === 'lbs') unit = 'lb'
  
  // Extract unit price: look for @ X.XX or X.XX/LB pattern
  // Examples: "1.24 LB @ 0.78/LB" or "1.24 lb @ 1 lb/0.78"
  let unitPrice: number | undefined
  const unitPriceMatch = weightLine.match(/@\s*(\d+\.\d{2})(?:\s*\/\s*(?:LB|LBS|KG|OZ))?/i)
  if (unitPriceMatch) {
    unitPrice = parseFloat(unitPriceMatch[1])
  } else {
    // Try pattern like "1 LB/0.78" or "0.78/LB" or "1 lb/0.78"
    const altMatch = weightLine.match(/(\d+\.\d{2})\s*(?:\/\s*(?:LB|LBS|KG|OZ)|(?:LB|LBS|KG|OZ)\s*\/)/i)
    if (altMatch) {
      const candidate = parseFloat(altMatch[1])
      // Sanity check: unit price should be reasonable (0.01 to 100 per lb/kg)
      if (candidate > 0.01 && candidate < 100) {
        unitPrice = candidate
      }
    }
    if (unitPrice === undefined) {
      const afterSlashMatch = weightLine.match(/(?:LB|LBS|KG|OZ)\s*\/\s*(\d+\.\d{2})/i)
      if (afterSlashMatch) {
        const candidate = parseFloat(afterSlashMatch[1])
        if (candidate > 0.01 && candidate < 100) {
          unitPrice = candidate
        }
      }
    }
  }
  
  // Extract line total: prefer rightColumnTotal, otherwise calculate from unitPrice * quantity
  // CRITICAL: lineTotal is the printed total for that line (e.g., 0.97), NOT quantity
  let lineTotal: number
  if (rightColumnTotal) {
    const totalMatch = rightColumnTotal.match(/\d+\.\d{2}/)
    if (totalMatch) {
      lineTotal = parseFloat(totalMatch[0])
      // Sanity check: line total should be reasonable
      if (isNaN(lineTotal) || lineTotal <= 0 || lineTotal > 1000) {
        // Fallback to calculation
        lineTotal = unitPrice ? Math.round(unitPrice * quantity * 100) / 100 : 0
      }
    } else {
      // Fallback: calculate from unit price
      lineTotal = unitPrice ? Math.round(unitPrice * quantity * 100) / 100 : 0
    }
  } else if (unitPrice) {
    lineTotal = Math.round(unitPrice * quantity * 100) / 100
  } else {
    return null // Can't determine line total
  }
  
  // Final validation: ensure quantity is NOT equal to unitPrice or lineTotal (common bug)
  if (Math.abs(quantity - (unitPrice || 0)) < 0.01) {
    logger.warn('Weight item parsing: quantity equals unitPrice (likely OCR issue)', { quantity, unitPrice })
  }
  if (Math.abs(quantity - lineTotal) < 0.01) {
    logger.warn('Weight item parsing: quantity equals lineTotal (likely OCR issue)', { quantity, lineTotal })
  }
  
      // Clean item name and expand abbreviations
      const cleanedName = itemNameLine.trim().replace(/\s+/g, ' ')
      const name = normalizeItemName(cleanedName)
      
      return {
        name,
        quantity, // WEIGHT (e.g., 1.24), never unitPrice or lineTotal
        unit,
        unitPrice, // Price per unit (e.g., 0.78)
        lineTotal  // Total for that line (e.g., 0.97)
      }
}

const TITLE_CASE_WORDS = new Set(['and', 'or', 'the', 'of', 'for', 'with', 'a', 'an'])

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (word.length === 0) return word
      if (index > 0 && TITLE_CASE_WORDS.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Expand common Walmart-style abbreviations in item names
 * Also removes SKU blobs and trailing "kf"/"KF"
 */
function normalizeItemName(rawName: string): string {
  // First, remove SKU blobs and trailing "kf"/"KF"
  let cleaned = rawName
  
  // Remove trailing "kf" or "KF"
  cleaned = cleaned.replace(/\s+(kf|KF)\s*$/i, '')
  
  // Split into tokens and filter out SKU blobs, UPC codes, and price-in-name
  const tokens = cleaned.split(/\s+/).filter(token => {
    // Remove tokens matching: 8+ digits followed by 0-4 letters (e.g., "000000004068kf", "000000003082KF")
    if (/^\d{8,}[a-zA-Z]{0,4}$/i.test(token)) return false
    // Remove tokens matching: 4+ zeros followed by digits and 0-4 letters (e.g., "000000004068kf")
    if (/^0{4,}\d+[a-zA-Z]{0,4}$/i.test(token)) return false
    // Remove trailing KF, F, T, X suffixes (case-insensitive)
    if (/^[A-Za-z]+[KFXT]$/i.test(token) && token.length <= 5) return false
    // Remove dollar amounts that ended up in name (e.g. "$4", "4.99")
    if (/^\$?\d+(\.\d{2})?$/.test(token)) return false
    // Remove standalone 4–7 digit item numbers (Costco/Walmart)
    if (/^\d{4,7}$/.test(token)) return false
    return true
  })
  
  cleaned = tokens.join(' ')
  
  // Remove trailing KF, F, T, X codes (case-insensitive)
  cleaned = cleaned.replace(/\s+[KFXT]\s*$/i, '')
  cleaned = cleaned.replace(/\s+[KFXT]$/i, '')
  
  // Abbreviation mapping (Walmart/Costco and common receipt abbreviations + OCR fixes)
  const abbreviations: Record<string, string> = {
    'BNLS': 'Boneless',
    'BRST': 'Breast',
    'THN': 'Thin',
    'THIN': 'Thin',
    'NY': 'New York',
    'JASM': 'Jasmine',
    'JASMINE': 'Jasmine',
    'MAHATMA': 'Mahatma',
    'SCE': 'Sauce',
    'GR': 'Ground',
    'PEPERCRN': 'Peppercorn',
    'PEPPERCRN': 'Peppercorn',
    'WM': 'Walmart',
    'ORG': 'Organic',
    'ORGN': 'Organic',
    'MD': 'Meat',
    'STRIP': 'Strip',
    'AVO': 'Avocado',
    'OIL': 'Oil',
    'SEED': 'Seed',
    'SAUCE': 'Sauce',
    'SALT': 'Salt',
    'RICE': 'Rice',
    'BROC': 'Broccoli',
    'BROCCOLI': 'Broccoli',
    'KS': 'Kirkland Signature',
    'KSS': 'Kirkland Signature',
    'EQ': 'Equal',
    'CREAM': 'Cream',
    'VIN': 'Vinegar',
    'VINEGAR': 'Vinegar',
    'FLOUR': 'Flour',
    'GRANOLA': 'Granola',
    'CRACKER': 'Cracker',
    'CRACKERS': 'Crackers',
    'CREATINE': 'Creatine',
    'MONOHYDRATE': 'Monohydrate',
    // Costco/receipt OCR fixes
    'CONDTNR': 'Conditioner',
    'ULTIMT': 'Ultimate',
    'INVS': 'Invigorating',
    'RASPBERY': 'Raspberry',
    'STRAWBRY': 'Strawberry',
    'DASNBERY': 'Raspberry',
    'F+V': 'Fruit & Vegetable',
    'MANDARINS': 'Mandarins',
    'BLUEBERRIES': 'Blueberries',
    'CHS': 'Cheese',
    'AMCHS': 'American Cheese',
    'MWASH': 'Mouthwash',
    'ULTRA': 'Ultra',
    'TOTE': 'Tote',
    'LC': 'Low Carb',
    'CH': 'Chews',
    'PK': 'Pack',
    'POUCH': 'Pouch',
    'POUCHES': 'Pouches',
    'SIG': 'Signature',
    'DENTAL': 'Dental',
    'SOFT': 'Soft'
  }
  
  // Split into tokens and expand abbreviations
  const finalTokens = cleaned.split(/\s+/).map(token => {
    const upperToken = token.toUpperCase()
    const cleanToken = upperToken.replace(/[.,;:!?]$/, '')
    // Handle dotted tokens (e.g. Am.chs -> American Cheese)
    const dotNormalized = cleanToken.replace(/\./g, '')
    if (abbreviations[cleanToken]) {
      return abbreviations[cleanToken] + (upperToken !== cleanToken ? token.slice(cleanToken.length) : '')
    }
    if (dotNormalized !== cleanToken && abbreviations[dotNormalized]) {
      return abbreviations[dotNormalized]
    }
    return token
  })
  
  const result = finalTokens.join(' ').trim()
  return result || rawName.trim()
}

/**
 * Turn receipt-style item names into complete, readable product names.
 * - Fixes common OCR typos (e.g. Acocado → Avocado)
 * - Completes truncated phrases (e.g. Walmart Sea → Walmart Sea Salt, Mahatma Jasmine → Mahatma Jasmine Rice)
 * - Expands brand + fragment into full product name where obvious
 */
export function completeItemName(name: string): string {
  if (!name || typeof name !== 'string') return name
  let s = name.trim().replace(/\s+/g, ' ')
  if (!s) return name

  // Strip trailing "$4" / "$ 4" that sometimes get into names
  s = s.replace(/\s*\$\s*\d+(\.\d{2})?\s*$/g, '').trim()

  // 1) Common OCR typos (case-insensitive)
  const ocrTypos: [string | RegExp, string][] = [
    ['Acocado', 'Avocado'],
    ['acocado', 'avocado'],
    ['ACOCODO', 'Avocado'],
    [/^Eq\s+/i, 'Equal '],
    ['Eq Duo', 'Equal Duo'],
    ['Eq duo', 'Equal Duo'],
    ['Condtnr', 'Conditioner'],
    ['condtnr', 'conditioner'],
    ['Ultimt', 'Ultimate'],
    ['ultimt', 'ultimate'],
    ['Dasnbery', 'Raspberry'],
    ['dasnbery', 'raspberry'],
    ['Raspbery', 'Raspberry'],
    ['Strawbry', 'Strawberry'],
    ['Livsugarfree', 'Live Sugar Free'],
    ['Am.chs', 'American Cheese'],
    ['Am. chs', 'American Cheese'],
  ]
  for (const [from, to] of ocrTypos) {
    if (typeof from === 'string') {
      if (s.includes(from)) s = s.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), to)
    } else {
      s = s.replace(from, to)
    }
  }

  // 2) Brand abbreviations that may not have been normalized (e.g. from LLM)
  const brandPhrases: [RegExp, string][] = [
    [/^Ks\s+Pure\s+Salt$/i, 'Kirkland Signature Pure Salt'],
    [/^Ks\s+Sea\s+Salt$/i, 'Kirkland Signature Sea Salt'],
    [/^Ks\s+Sea$/i, 'Kirkland Signature Sea Salt'],
    [/^Ks\s+Granola$/i, 'Kirkland Signature Granola'],
    [/^KS\s+Pure\s+Salt$/i, 'Kirkland Signature Pure Salt'],
    [/^WM\s+Sea$/i, 'Walmart Sea Salt'],
    [/^Walmart\s+Sea$/i, 'Walmart Sea Salt'],
    [/^Mahatma\s+Jasmine$/i, 'Mahatma Jasmine Rice'],
    [/^Swiss\s+Dark$/i, 'Swiss Dark Chocolate'],
    [/^Sushi\s+Chef$/i, 'Sushi Chef Rice Vinegar'],
    [/^Broc\s+Crowns?$/i, 'Broccoli Crowns'],
    [/^Eq\s+Duo$/i, 'Equal Duo'],
  ]
  for (const [pattern, replacement] of brandPhrases) {
    if (pattern.test(s)) {
      s = replacement
      break
    }
  }

  // 3) Full-name completions: expand truncated receipt names to full product names
  const fullNamePhrases: [RegExp, string][] = [
    [/^LC\s+Taco$/i, 'LC Soft Taco'],
    [/^Low Carb\s+Taco$/i, 'Low Carb Soft Taco'],
    [/^Lc\s+Taco$/i, 'LC Soft Taco'],
    [/^Kirkland Signature\s+Dental\s+Ch$/i, 'Kirkland Signature Dental Chews'],
    [/^Kirkland Signature\s+Dental\s+Chews?$/i, 'Kirkland Signature Dental Chews'],
    [/^KS\s+Dental\s+Ch$/i, 'Kirkland Signature Dental Chews'],
  ]
  for (const [pattern, replacement] of fullNamePhrases) {
    if (pattern.test(s)) {
      s = replacement
      break
    }
  }

  // 4) Complete truncated product phrases (single-word or short)
  const completions: [RegExp | string, string][] = [
    [/^Kirkland Signature\s+Sea$/i, 'Kirkland Signature Sea Salt'],
    [/^Sea$/i, 'Sea Salt'],
    [/^Jasmine$/i, 'Jasmine Rice'],
    [/^Ground\s+Peppercorn$/i, 'Ground Black Peppercorn'],
    [/^Pure\s+Salt$/i, 'Pure Sea Salt'],
    [/^Sesame\s+Seed$/i, 'Sesame Seeds'],
  ]
  for (const [pattern, replacement] of completions) {
    if (typeof pattern === 'string') {
      if (s === pattern) s = replacement
    } else {
      s = s.replace(pattern, replacement)
    }
  }

  s = s.trim() || name
  // Title-case first letter of each word so "Equal duo" → "Equal Duo"
  if (s && s.length > 0) {
    s = s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }
  return s || name
}

function lastMoneyValue(line: string): number | null {
  const matches = line.match(MONEY_REGEX)
  if (!matches || matches.length === 0) return null
  const raw = matches[matches.length - 1]
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function isNonItemLine(line: string): boolean {
  const trimmed = line.trim()
  const normalized = trimmed.toLowerCase()
  return (
    normalized.includes('subtotal') ||
    normalized.startsWith('tax') ||
    normalized.startsWith('total') ||
    normalized.includes('tend') ||
    normalized.includes('cash') ||
    normalized.includes('visa') ||
    normalized.includes('mastercard') ||
    normalized.includes('amex') ||
    normalized.includes('change') ||
    // Masked card / header line (Costco etc.)
    /^\*{5,}/.test(trimmed) ||
    // Discount/promo lines - not products (e.g. "Saved $", "Cartwheel 15% $")
    normalized.includes('cartwheel') ||
    /^saved\s*\$?\s*(\d|$)/i.test(normalized) ||
    normalized.includes('rebate') ||
    /^(coupon|discount|reward)\b/i.test(normalized) ||
    // Fees – Quebec/Canada: ECOFRAIS (eco-fee), CONSIGNE QC (deposit), ECOTAX, DEPOSIT
    normalized.includes('ecofrais') ||
    normalized.includes('consigne') ||
    normalized.includes('ecotax') ||
    normalized.includes('deposit') ||
    normalized.includes('depot') ||
    /^.*\*?\s*ecofrais\b/i.test(trimmed) ||
    /\bconsigne\s*qc\b/i.test(trimmed)
  )
}

function looksLikeWeightDetail(line: string): boolean {
  const normalized = line.toLowerCase()
  return (
    WEIGHT_REGEX.test(normalized) &&
    (normalized.includes('@') || normalized.includes('/lb') || normalized.includes('/kg'))
  )
}

/**
 * Clean item name from OCR text
 * Strips leading SKU codes, trailing tax flags (F, T, X), and preserves readable names
 */
function cleanItemName(rawLine: string, price: number): string {
  // Find price position (last money value on line)
  const priceStr = price.toFixed(2)
  const priceIndex = rawLine.lastIndexOf(priceStr)
  const namePart = priceIndex > 0 ? rawLine.slice(0, priceIndex) : rawLine
  
  // Strip leading SKU codes (long numeric sequences)
  let cleaned = namePart.replace(/^\d{5,}\s*/, '') // Remove leading 5+ digit codes
  
  // Strip trailing tax flags (F, T, X) and other single-letter codes
  cleaned = cleaned.replace(/\s+[FTX]\s*$/, '')
  
  // Strip trailing single letters that are likely tax codes
  cleaned = cleaned.replace(/\s+[A-Z]\s*$/, '')
  
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  // Remove any remaining long numeric codes in the middle
  const tokens = cleaned.split(' ').filter(token => {
    // Keep tokens that are:
    // - Not long numeric codes (5+ digits)
    // - Not single letters (likely tax codes)
    // - Have meaningful content
    if (/^\d{5,}$/.test(token)) return false // Skip long UPC codes
    if (/^[A-Z]$/.test(token) && token.length === 1) return false // Skip single letter codes
    return token.length > 0
  })
  
  cleaned = tokens.join(' ').trim()
  
  // If cleaned name is too short, try to preserve more (but still remove obvious codes)
  if (cleaned.length < 3 && namePart.length >= 3) {
    // Keep everything except long numeric codes
    const allTokens = namePart.split(' ').filter(t => t.length > 0 && !/^\d{5,}$/.test(t))
    if (allTokens.length > 0) {
      cleaned = allTokens.join(' ')
    }
  }
  
  return toTitleCase(cleaned)
}

/**
 * Extract items from Google Vision OCR text
 * Uses middle section of receipt (skips header, stops before SUBTOTAL)
 * Each item line must contain letters AND end with a money value
 * Strips leading SKU codes and trailing tax flags
 */
export function parseReceiptOcrText(text: string): ParsedOcrReceipt {
  const allLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const parsed: ParsedOcrReceipt = { items: [] }

  // Extract store and date
  for (const line of allLines) {
    const lower = line.toLowerCase()
    if (!parsed.store && lower.includes('walmart')) {
      parsed.store = 'Walmart'
    }
    if (!parsed.store && lower.includes('costco')) {
      parsed.store = 'Costco'
    }
    if (!parsed.date) {
      const dateMatch = line.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/)
      if (dateMatch) {
        parsed.date = dateMatch[1]
      }
    }
  }
  
  // Use deterministic totals parsing (Google Vision OCR text only)
  const totals = parseTotalsFromText(text)
  parsed.receiptSubtotal = totals.subtotal
  parsed.receiptTax = totals.taxAmount
  parsed.receiptTaxRate = totals.taxRate
  parsed.receiptTotal = totals.total
  parsed.selectedTotalsBlockIndex = totals.selectedTotalsBlockIndex
  parsed.allParsedTotalsBlocks = totals.allParsedTotalsBlocks

  // Find item section: start after last transaction header marker, stop before SUBTOTAL
  let itemStartIndex = 0
  let itemEndIndex = allLines.length
  
  // Find the last transaction header marker (TR#, TE#, OP#) to determine where items start
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].toUpperCase()
    if (line.includes('TR#') || line.includes('TE#') || line.includes('OP#')) {
      itemStartIndex = i + 1 // Start from next line after header marker
    }
    if (line.includes('SUBTOTAL') || line.includes('SUB TOTAL')) {
      itemEndIndex = i
      break
    }
  }
  
  // Fallback: if no header marker found, use first 8 lines as header
  if (itemStartIndex === 0) {
    itemStartIndex = Math.min(8, allLines.length)
  }
  
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('📦 Item section boundaries:', {
      itemStartIndex,
      itemEndIndex,
      firstItemLine: allLines[itemStartIndex]?.substring(0, 50),
      lastItemLine: allLines[itemEndIndex - 1]?.substring(0, 50)
    })
  }
  
  const itemLines = allLines.slice(itemStartIndex, itemEndIndex)
  
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('📦 Item extraction:', {
      totalLines: allLines.length,
      itemStartIndex,
      itemEndIndex,
      itemLinesCount: itemLines.length,
      firstItemLine: itemLines[0]?.substring(0, 50),
      lastItemLine: itemLines[itemLines.length - 1]?.substring(0, 50)
    })
  }

  // Helper: Check if line is mostly digits (SKU line)
  function isSkuLine(line: string): boolean {
    const trimmed = line.trim()
    // Mostly digits or ends with single letter flag (F/T/X)
    return /^\d{6,}/.test(trimmed) || /^\d+\s*[FTX]$/.test(trimmed)
  }
  
  // Helper: Check if line is a price line (supports comma decimal: 9,99)
  function isPriceLine(line: string): boolean {
    const normalized = normalizeDecimalInLine(line.trim())
    // Contains money value and optionally ends with T/F/X; no 3+ letter words (product names)
    return MONEY_REGEX.test(normalized) && !/[A-Za-z]{3,}/.test(line)
  }
  
  // Helper: Extract money value from line (supports comma decimal: 9,99)
  function extractMoney(line: string): number | null {
    const normalized = normalizeDecimalInLine(line)
    const matches = normalized.match(MONEY_REGEX)
    if (!matches || matches.length === 0) return null
    const value = parseFloat(matches[0])
    return (!isNaN(value) && value > 0 && value <= 10000) ? value : null
  }

  // Helper: Extract price from line, excluding values that are clearly WEIGHTS (e.g. "2.52 lbs").
  // Supports comma decimal (9,99). Use for item lines so we never use weight as price.
  function extractPriceExcludingWeight(line: string): number | null {
    const normalized = normalizeDecimalInLine(line)
    const weightUnitSuffix = /\s*(?:lb|lbs|kg|oz)\b/i
    const moneyRe = /\d+\.\d{2}/g
    const candidates: number[] = []
    let m: RegExpExecArray | null
    while ((m = moneyRe.exec(normalized)) !== null) {
      const value = parseFloat(m[0])
      if (isNaN(value) || value <= 0 || value > 10000) continue
      const after = normalized.slice(m.index + m[0].length)
      if (weightUnitSuffix.test(after)) continue // This is a weight, not a price
      candidates.push(value)
    }
    if (candidates.length === 0) return null
    return candidates[candidates.length - 1]
  }

  // Helper: Parse Costco-style "N @ X.XX" or "N @ X,XX" line – returns { quantity, unitPrice, lineTotal } or null
  // Supports: "12 @ 9,99", "12 @ 9,99  119,88", "  2 @ 3.99" (leading spaces)
  function parseCostcoQtyAtLine(line: string): { quantity: number; unitPrice: number; lineTotal?: number } | null {
    const normalized = normalizeDecimalInLine(line.trim())
    const match = normalized.match(/(?:^|\s)(\d+)\s*@\s*([\d.]+)(?:\s+([\d.]+))?/)
    if (!match) return null
    const quantity = parseInt(match[1], 10)
    const unitPrice = parseFloat(match[2])
    const lineTotal = match[3] ? parseFloat(match[3]) : undefined
    if (isNaN(quantity) || quantity < 1 || quantity > 1000 || isNaN(unitPrice) || unitPrice <= 0) return null
    return { quantity, unitPrice, lineTotal }
  }

  // Helper: Extract quantity from any line using multiple patterns (used when Costco parse doesn't apply)
  function extractQuantityFromLines(...lines: (string | undefined)[]): number {
    const combined = lines.filter(Boolean).join(' ')
    const normalized = normalizeDecimalInLine(combined)
    // Pattern 1: "12 @ 9.99" or "12 @ 9,99" – quantity before @
    const atMatch = normalized.match(/(?:^|\s)(\d+)\s*@\s*[\d.]+/)
    if (atMatch) {
      const q = parseInt(atMatch[1], 10)
      if (q >= 1 && q <= 1000) return q
    }
    // Pattern 2: "2 x 3.99" or "2x 3.99" – quantity before x
    const xMatch = normalized.match(/(?:^|\s)(\d+)\s*x\s*[\d.]/i)
    if (xMatch) {
      const q = parseInt(xMatch[1], 10)
      if (q >= 1 && q <= 1000) return q
    }
    // Pattern 3: "QTY 2" or "Qty: 2"
    const qtyMatch = normalized.match(/\bqty\s*[:\s]*(\d+)/i)
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1], 10)
      if (q >= 1 && q <= 1000) return q
    }
    // Pattern 4: "(2)" or "x2" or "2x" at word boundary
    const parenMatch = normalized.match(/\b\((\d+)\)\b/)
    if (parenMatch) {
      const q = parseInt(parenMatch[1], 10)
      if (q >= 1 && q <= 1000) return q
    }
    // Pattern 5: "2 for 5.00" or "2 FOR"
    const forMatch = normalized.match(/\b(\d+)\s+for\b/i)
    if (forMatch) {
      const q = parseInt(forMatch[1], 10)
      if (q >= 1 && q <= 1000) return q
    }
    // Pattern 6: "12 @" or "12 @ " at start of line (already in qtyAtStart but ensure we catch it)
    const startMatch = normalized.match(/^(\d+)\s*[xX@]/)
    if (startMatch) {
      const q = parseInt(startMatch[1], 10)
      if (q >= 1 && q <= 1000) return q
    }
    return 1
  }
  
  // Helper: Clean item name (strip item numbers, prices in name, Costco "E" prefix)
  function cleanItemNameFromLine(nameLine: string): string {
    let cleaned = nameLine
    // Strip leading item numbers (Costco: 5–7 digits; Walmart: 6+)
    cleaned = cleaned.replace(/^\d{4,8}\s*/, '')
    // Strip leading "E " (Costco organic/eco marker)
    cleaned = cleaned.replace(/^\s*E\s+/i, ' ')
    // Strip trailing price-like fragments (e.g. "Diaper $4" -> "Diaper")
    cleaned = cleaned.replace(/\s*\$\s*\d+(\.\d{2})?\s*$/, '')
    // Strip trailing tax flags (F, T, X) and single-letter codes
    cleaned = cleaned.replace(/\s+[FTX]\s*$/, '')
    cleaned = cleaned.replace(/\s+[A-Z]\s*$/, '')
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    // Remove SKU/item number tokens (standalone 4+ digits) and code-like suffixes (e.g. 40gt, 200lds)
    const tokens = cleaned.split(' ').filter(token => {
      if (/^\d{4,}$/.test(token)) return false
      if (/^\d+[a-z]{1,3}$/i.test(token) && token.length <= 6) return false // e.g. 40gt, 200lds
      return true
    })
    cleaned = tokens.join(' ').trim()
    if (!cleaned) return nameLine.trim() || 'Unnamed Item'
    return toTitleCase(cleaned)
  }

  let weightItemsCount = 0
  let multiLineItemsCount = 0
  
  // Parse items as multi-line groups (Walmart format: NAME, SKU+flags, PRICE+tax flag)
  for (let i = 0; i < itemLines.length; i += 1) {
    const line = itemLines[i]
    
    // Skip non-item lines
    if (isNonItemLine(line)) {
      continue
    }
    
    // Check if this is a produce/weight item (next line has weight details with "@")
    const nextLine = itemLines[i + 1]
    // STRICT: Only treat as weight item if next line contains "lb" (case-insensitive) AND "@" symbol
    const isWeightLine = nextLine && /lb/i.test(nextLine) && nextLine.includes('@')
    
    if (isWeightLine) {
      // Parse weight line FIRST to extract weight (so we can exclude it from extendedTotal search)
      const weightMatch = nextLine.match(/(\d+(?:\.\d+)?)\s*(LB|LBS|KG|OZ)\b/i)
      if (!weightMatch) {
        continue // Not a valid weight line
      }
      
      // weight = first decimal number before "lb" on the weight line
      const weight = parseFloat(weightMatch[1])
      if (isNaN(weight) || weight <= 0 || weight > 1000) {
        continue
      }
      
      let unit = (weightMatch[2] || 'lb').toLowerCase()
      if (unit === 'lbs') unit = 'lb'
      
      // Extract unitPrice: last money/decimal on the weight line after "@", usually with 2 decimals
      let unitPrice: number | undefined
      // Try pattern: "@ 0.56" or "@ 1 lb/0.56" or "0.56/lb"
      const unitPriceMatch = nextLine.match(/@\s*(\d+\.\d{2})(?:\s*\/\s*(?:LB|LBS|KG|OZ))?/i)
      if (unitPriceMatch) {
        unitPrice = parseFloat(unitPriceMatch[1])
      } else {
        // Try pattern like "1 LB/0.78" or "0.78/LB" (after @)
        const afterAt = nextLine.split('@')[1] || ''
        const altMatch = afterAt.match(/(\d+\.\d{2})\s*(?:\/\s*(?:LB|LBS|KG|OZ)|(?:LB|LBS|KG|OZ)\s*\/)/i)
        if (altMatch) {
          const candidate = parseFloat(altMatch[1])
          if (candidate > 0.01 && candidate < 100) {
            unitPrice = candidate
          }
        }
      }
      
      // Find extendedTotal: MUST be on a separate line after weight line (i+2 or i+3)
      // This is the extended line total, NOT the weight or unitPrice
      // Walmart format: NAME (i), WEIGHT LINE (i+1), EXTENDED TOTAL (i+2 or i+3, often with "X" marker)
      let extendedTotal: number | null = null
      let extendedTotalLineIndex: number | null = null
      
      // Helper: Extract LAST money value from line (supports comma decimal)
      function extractLastMoney(line: string): number | null {
        const normalized = normalizeDecimalInLine(line)
        const matches = normalized.match(MONEY_REGEX)
        if (!matches || matches.length === 0) return null
        const value = parseFloat(matches[matches.length - 1])
        return (!isNaN(value) && value > 0 && value <= 10000) ? value : null
      }
      
      // Check lines i+2, i+3, and i+4 for extendedTotal (expanded range for reliability)
      // Look for lines with money values, preferably with "X" marker (Walmart marks extended totals with X)
      for (let j = i + 2; j < Math.min(i + 5, itemLines.length); j++) {
        const candidate = itemLines[j]
        
        // Skip if this line looks like another item name (has 4+ letter words)
        const hasLongWords = /[A-Za-z]{4,}/.test(candidate)
        const hasMoney = MONEY_REGEX.test(normalizeDecimalInLine(candidate))
        
        if (hasMoney && !hasLongWords) {
          // Try to extract money value - use LAST match (rightmost)
          const moneyValue = extractLastMoney(candidate)
          if (moneyValue !== null && moneyValue > 0 && moneyValue < 100) {
            // CRITICAL: Ensure this is NOT the weight value
            // Extended total should be different from weight (unless weight is very small, but still check)
            const weightDiff = Math.abs(moneyValue - weight)
            const isLikelyWeight = weightDiff < 0.01 // If within 0.01, it's probably the weight, not extendedTotal
            
            // Also check: if the line contains "X" (Walmart marker for extended total), it's definitely the extendedTotal
            const hasXMarker = /\bX\b/.test(candidate)
            
            if (!isLikelyWeight || hasXMarker) {
              extendedTotal = moneyValue
              extendedTotalLineIndex = j
              if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.log(`  ✅ Found extendedTotal ${extendedTotal} at line ${j}: "${candidate}" (weight=${weight}, diff=${weightDiff.toFixed(2)})`)
              }
              break
            } else {
              if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.log(`  ⚠️ Rejected candidate ${moneyValue} at line ${j} (too close to weight ${weight}): "${candidate}"`)
              }
            }
          }
        }
      }
      
      // CRITICAL: If extendedTotal not found, do NOT treat as weight item - fall back to regular parsing
      if (extendedTotal === null) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log(`  ⚠️ Produce item detected but extendedTotal not found for line ${i}: "${line}"`)
          console.log(`    Weight line (i+1): "${itemLines[i + 1]}"`)
          console.log(`    Weight extracted: ${weight} ${unit}`)
          console.log(`    Checking lines ${i + 2}-${Math.min(i + 4, itemLines.length - 1)}:`)
          for (let j = i + 2; j < Math.min(i + 5, itemLines.length); j++) {
            console.log(`      Line ${j}: "${itemLines[j]}"`)
          }
        }
        // Not a valid produce block - continue to regular item parsing
        // This prevents incorrect totals from using weight as price
        continue
      }
      
      // CRITICAL GUARD: Ensure extendedTotal is NOT the weight
      // If they're the same (within 0.01), this is an error - we're using weight as lineTotal
      const weightDiff = Math.abs(extendedTotal - weight)
      if (weightDiff < 0.01) {
        console.error(`❌ ERROR: weight-used-as-total detected for "${line}"`)
        console.error(`  Weight: ${weight}, extendedTotal: ${extendedTotal}, diff: ${weightDiff}`)
        console.error(`  This means we're using weight as lineTotal - marking needsReview`)
        // Still create the item but mark it for review
        // Don't use weight as lineTotal - leave it undefined so it gets flagged
        const cleanedName = cleanItemNameFromLine(line)
        const name = normalizeItemName(cleanedName)
        const letterCount = name.replace(/[^A-Za-z]/g, '').length
        if (letterCount >= 3) {
          parsed.items.push({
            name,
            price: unitPrice || 0, // Use unitPrice as fallback
            quantity: weight,
            unit,
            unitPrice,
            lineTotal: undefined // Leave undefined to trigger needsReview
          })
        }
        continue
      }
      
      // Clean item name and expand abbreviations
      const cleanedName = cleanItemNameFromLine(line)
      const name = normalizeItemName(cleanedName)
      const letterCount = name.replace(/[^A-Za-z]/g, '').length
      if (letterCount < 3) {
        continue
      }
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(`🥬 Produce item parsed: "${name}"`, {
          weight,
          unit,
          unitPrice,
          extendedTotal,
          extendedTotalSource: extendedTotalLineIndex !== null ? `line ${extendedTotalLineIndex}` : 'not found',
          weightDiff: weightDiff.toFixed(2)
        })
      }
      
      // CRITICAL: Use extendedTotal as lineTotal; never use weight as price.
      // For display price use unitPrice if available, else extendedTotal — but never the weight.
      let displayPrice = unitPrice ?? extendedTotal
      if (displayPrice != null && Math.abs(displayPrice - weight) < 0.01) {
        displayPrice = unitPrice ?? undefined // Weight was mistaken for price; use unitPrice only
      }
      parsed.items.push({
        name,
        price: displayPrice ?? 0, // Never weight: unitPrice or extendedTotal only
        quantity: weight, // CRITICAL: quantity is the WEIGHT, not price
        unit,
        unitPrice,
        lineTotal: extendedTotal // CRITICAL: extended total only (NEVER weight)
      })
      weightItemsCount++
      
      // Skip weight line and extendedTotal line
      // extendedTotalLineIndex is the absolute index in itemLines array
      // We need to skip from current i to after extendedTotalLineIndex
      if (extendedTotalLineIndex !== null && extendedTotalLineIndex > i + 1) {
        // extendedTotal is on a separate line after weight line
        // Skip weight line (i+1) and extendedTotal line (extendedTotalLineIndex)
        i = extendedTotalLineIndex // Skip to after extendedTotal line
      } else {
        // extendedTotal was on the same line as weight (shouldn't happen, but safe)
        i += 1 // Just skip weight line
      }
      continue
    }
    
    // Pattern A: Name line - contains letters, not mostly digits, not totals keywords
    if (!/[A-Za-z]/.test(line) || /^(SUBTOTAL|TAX|TOTAL)/i.test(line)) {
      continue
    }
    
    // Skip only pure SKU lines (digits + flag, no real name). Costco uses "ITEM# NAME" on one line — keep those.
    const lineLetterCount = (line.match(/[A-Za-z]/g) || []).length
    if (isSkuLine(line) && lineLetterCount < 3) {
      continue
    }
    
    // Try to detect multi-line item pattern:
    // Line i: NAME (contains letters)
    // Line i+1: SKU+flags (optional, mostly digits or ends with F/T/X)
    // Line i+2: PRICE+tax flag (contains money value)
    
    let nameLine = line
    let skuLine: string | undefined
    let priceLine: string | undefined
    let price: number | null = null
    let linesConsumed = 1
    let costcoQtyResult: { quantity: number; unitPrice: number; lineTotal?: number } | null = null
    
    // Check if current line has price (single-line item).
    const lineHasWeightUnit = /(?:lb|lbs|kg|oz)\b/i.test(line)
    const currentPrice = lineHasWeightUnit ? extractPriceExcludingWeight(line) : extractMoney(line)
    if (currentPrice !== null) {
      // Single-line item: NAME + PRICE on same line. Also check for "2 @ 3.99" or "2x 3.99" on same line.
      const singleLineCostco = parseCostcoQtyAtLine(line)
      if (singleLineCostco) {
        costcoQtyResult = singleLineCostco
        price = singleLineCostco.unitPrice
      }
      const priceStr = (price ?? currentPrice).toFixed(2)
      const priceIndex = line.lastIndexOf(priceStr)
      nameLine = priceIndex > 0 ? line.slice(0, priceIndex) : line
      if (price === null) price = currentPrice
    } else {
      // Multi-line item: NAME then PRICE (Walmart/Costco). Costco often has "ITEM# NAME" then "N @ X.XX" or "PRICE".
      if (i + 1 < itemLines.length) {
        const candidateSkuLine = itemLines[i + 1]
        // Costco format: "12 @ 9,99" or "12 @ 9,99  119,88" – skip if next line is a fee (ECOFRAIS, CONSIGNE)
        const costcoQty = parseCostcoQtyAtLine(candidateSkuLine)
        if (costcoQty) {
          const nextNext = itemLines[i + 2] || ''
          if (!isNonItemLine(candidateSkuLine) && !isNonItemLine(nextNext)) {
            nameLine = line
            priceLine = candidateSkuLine
            price = costcoQty.unitPrice
            costcoQtyResult = costcoQty
            linesConsumed = 2
          }
        }
        if (price === null && isSkuLine(candidateSkuLine)) {
          const skuLetterCount = (candidateSkuLine.match(/[A-Za-z]/g) || []).length
          if (skuLetterCount >= 3) {
            // Costco: "ITEM# NAME" on this line, "PRICE" or "PRICE FLAG" on next (e.g. "18.99 A")
            const priceOnNext = extractMoney(candidateSkuLine)
            if (priceOnNext !== null) {
              nameLine = line
              priceLine = candidateSkuLine
              price = priceOnNext
              linesConsumed = 2
            } else if (i + 2 < itemLines.length && isPriceLine(itemLines[i + 2])) {
              skuLine = candidateSkuLine
              priceLine = itemLines[i + 2]
              const pl = priceLine
              price = extractMoney(pl)
              linesConsumed = 3
            }
          } else if (i + 2 < itemLines.length && isPriceLine(itemLines[i + 2])) {
            skuLine = candidateSkuLine
            priceLine = itemLines[i + 2]
            price = extractMoney(priceLine)
            linesConsumed = 3
          }
        } else if (isPriceLine(candidateSkuLine)) {
          // Two-line item: NAME, PRICE (no SKU line)
          priceLine = candidateSkuLine
          const priceLineHasWeight = /(?:lb|lbs|kg|oz)\b/i.test(candidateSkuLine)
          price = priceLineHasWeight ? (extractPriceExcludingWeight(candidateSkuLine) ?? extractMoney(candidateSkuLine)) : extractMoney(candidateSkuLine)
          linesConsumed = 2
        }
      }
    }
    
    if (price === null) {
      continue // Skip if no price found
    }
    
    // Clean item name from name line and expand abbreviations
    const cleanedName = cleanItemNameFromLine(nameLine)
    const name = normalizeItemName(cleanedName)
    
    // CRITICAL: Name must be at least 3 letters after cleanup
    const letterCount = name.replace(/[^A-Za-z]/g, '').length
    if (letterCount < 3) {
      continue // Skip items with unreadable names
    }
    
    // CRITICAL: Name must not be just a price string
    const priceStr = price.toFixed(2)
    if (/^\d+\.\d{2}$/.test(name) || name === priceStr) {
      continue // Skip if name is just the price
    }
    
    // Extract quantity: use Costco parse if available, else try all patterns across name/price lines
    let quantity = 1
    let lineTotal = price
    if (costcoQtyResult) {
      quantity = costcoQtyResult.quantity
      lineTotal = costcoQtyResult.lineTotal ?? price! * quantity
    } else {
      quantity = extractQuantityFromLines(nameLine, priceLine, line, skuLine)
      // Infer quantity from lineTotal/unitPrice when we have two money values and ratio is whole
      const allLinesForMoney = [nameLine, priceLine, line, skuLine].filter(Boolean).join(' ')
      const moneyMatches = normalizeDecimalInLine(allLinesForMoney).match(/\d+\.\d{2}/g)
      if (quantity === 1 && moneyMatches && moneyMatches.length >= 2) {
        const values = [...new Set(moneyMatches.map(m => parseFloat(m)))].filter(v => v > 0 && v < 10000).sort((a, b) => a - b)
        // Only infer when exactly 2 distinct values (unit price + line total) to avoid false positives
        if (values.length === 2) {
          const unitPrice = values[0]
          const possibleLineTotal = values[1]
          // Only infer when unitPrice matches our price (avoid false positives)
          if (unitPrice > 0 && possibleLineTotal >= unitPrice && Math.abs(unitPrice - price!) < 0.02) {
            const inferredQty = Math.round(possibleLineTotal / unitPrice)
            if (inferredQty >= 2 && inferredQty <= 1000 && Math.abs(possibleLineTotal - unitPrice * inferredQty) < 0.02) {
              quantity = inferredQty
              lineTotal = possibleLineTotal
            }
          }
        }
      }
      if (lineTotal === price) lineTotal = price! * quantity
    }
    
    // Create item: use price as unit price, lineTotal from quantity * unit or Costco parse
    parsed.items.push({
      name,
      price: price!, // Unit price
      quantity,
      unit: 'pieces',
      lineTotal
    })
    
    if (linesConsumed > 1) {
      multiLineItemsCount++
    }
    
    // Skip consumed lines
    i += (linesConsumed - 1)
  }
  
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('📦 Item extraction results:', {
      totalItems: parsed.items.length,
      multiLineItems: multiLineItemsCount,
      weightItems: weightItemsCount,
      first5Items: parsed.items.slice(0, 5).map(item => ({
        name: item.name.substring(0, 30),
        price: item.price,
        lineTotal: item.lineTotal,
        quantity: item.quantity,
        unit: item.unit
      }))
    })
  }

  return parsed
}

export function buildScannedItemsFromOcr(parsedItems: ParsedOcrReceipt['items']): ScannedItem[] {
  return parsedItems.map(item => {
    const fullName = completeItemName(item.name)
    const category = detectCategoryFromName(fullName)
    const normalizedCategory = normalizeCategory(category)
    const location = determineStorageLocation(fullName, normalizedCategory)
    const emoji = getItemEmoji(fullName, normalizedCategory)
    return {
      name: fullName,
      emoji,
      quantity: item.quantity,
      unit: item.unit,
      category: normalizedCategory,
      location,
      price: item.price, // For weight items: lineTotal, for count items: unit price
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal || item.price // Use lineTotal if available, fallback to price
    }
  })
}
