// Unit tests for ReceiptOcrParser
import {
  buildScannedItemsFromOcr,
  completeItemName,
  parseReceiptOcrText,
  parseTotalsFromText,
  parseWeightLinePair
} from '../ReceiptOcrParser'

describe('parseTotalsFromText', () => {
  it('should parse Walmart receipt totals correctly', () => {
    const text = `
ITEM 1                     5.48
ITEM 2                     1.00
ONIONS                     0.97
1.24 LB @ 0.78/LB
SUBTOTAL                   90.91
TAX 10.000%                 9.09
TOTAL                     100.00
`
    const result = parseTotalsFromText(text)
    
    // CRITICAL: Should extract from SUBTOTAL/TAX/TOTAL lines, NOT from item prices
    expect(result.subtotal).toBe(90.91)
    expect(result.taxAmount).toBe(9.09)
    expect(result.taxRate).toBe(10.000)
    expect(result.total).toBe(100.00)
    expect(result.selectedTotalsBlockIndex).toBe(0)
  })
  
  it('should NOT extract totals from item prices', () => {
    const text = `
EGG BEST ORGANIC           4.98
ITEM 2                     3.50
SUBTOTAL                   90.91
TAX 10.000%                 9.09
TOTAL                     100.00
`
    const result = parseTotalsFromText(text)
    
    // CRITICAL: Should NOT use 4.98 (last item price) as subtotal
    expect(result.subtotal).toBe(90.91) // From SUBTOTAL line
    expect(result.taxAmount).toBe(9.09)
    expect(result.total).toBe(100.00)
  })
  
  it('should parse Costco receipt with multiple total blocks correctly', () => {
    const text = `
ITEM 1                     50.00
ITEM 2                    411.80
SUBTOTAL                  461.80
TAX                         6.89
TOTAL                     468.69
EXECUTIVE REBATE          -10.00
SUBTOTAL                  451.80
TAX                         6.75
TOTAL                     458.55
`
    const result = parseTotalsFromText(text)
    
    // Should select FIRST complete block (before EXECUTIVE REBATE)
    expect(result.subtotal).toBe(461.80)
    expect(result.taxAmount).toBe(6.89)
    expect(result.total).toBe(468.69)
    expect(result.selectedTotalsBlockIndex).toBe(0)
    expect(result.allParsedTotalsBlocks?.length).toBe(2)
  })
  
  it('should ignore blocks after rebate keywords', () => {
    const text = `
SUBTOTAL                  461.80
TAX                         6.89
TOTAL                     468.69
REBATE                    -10.00
SUBTOTAL                  451.80
TAX                         6.75
TOTAL                     458.55
`
    const result = parseTotalsFromText(text)
    
    // Should select FIRST block, ignore second block after REBATE
    expect(result.subtotal).toBe(461.80)
    expect(result.taxAmount).toBe(6.89)
    expect(result.total).toBe(468.69)
  })
  
  it('should handle OCR mistakes (O→0)', () => {
    const text = `
SUBTOTAL                   9O.91
TAX 1O.OOO%                 9.O9
TOTAL                     1OO.OO
`
    const result = parseTotalsFromText(text)
    
    expect(result.subtotal).toBe(90.91)
    expect(result.taxAmount).toBe(9.09)
    expect(result.taxRate).toBe(10.000)
    expect(result.total).toBe(100.00)
  })
  
  it('should infer tax amount from total and subtotal', () => {
    const text = `
SUBTOTAL                   90.91
TOTAL                     100.00
`
    const result = parseTotalsFromText(text)
    
    expect(result.subtotal).toBe(90.91)
    expect(result.total).toBe(100.00)
    expect(result.taxAmount).toBe(9.09) // Inferred
  })
  
  it('should prioritize totals in bottom area', () => {
    const text = `
ITEM 1                     5.99
ITEM 2                     3.50
SUBTOTAL                    9.49
TAX 8.500%                  0.81
TOTAL                     10.30
`
    const result = parseTotalsFromText(text)
    
    expect(result.subtotal).toBe(9.49)
    expect(result.taxAmount).toBe(0.81)
    expect(result.taxRate).toBe(8.500)
    expect(result.total).toBe(10.30)
  })
})

describe('parseWeightLinePair', () => {
  it('should parse Walmart-style weight item correctly (onions example)', () => {
    const itemNameLine = 'ONIONS'
    const weightLine = '1.24 LB @ 0.78/LB'
    const rightColumnTotal = '0.97'
    
    const result = parseWeightLinePair(itemNameLine, weightLine, rightColumnTotal)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('ONIONS')
    // CRITICAL: quantity is the WEIGHT (1.24), NOT unitPrice (0.78) or lineTotal (0.97)
    expect(result!.quantity).toBe(1.24)
    expect(result!.unit).toBe('lb')
    expect(result!.unitPrice).toBe(0.78) // Price per lb
    expect(result!.lineTotal).toBe(0.97) // Total for that line
    // Validation: quantity should NOT equal unitPrice or lineTotal
    expect(result!.quantity).not.toBe(result!.unitPrice)
    expect(result!.quantity).not.toBe(result!.lineTotal)
  })
  
  it('should parse weight item with variant format (1 lb/0.78)', () => {
    const itemNameLine = 'POTATOES'
    const weightLine = '1.8 LB @ 1 LB/0.88'
    const rightColumnTotal = '1.58'
    
    const result = parseWeightLinePair(itemNameLine, weightLine, rightColumnTotal)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('POTATOES')
    expect(result!.quantity).toBe(1.8) // Weight, not unitPrice
    expect(result!.unit).toBe('lb')
    expect(result!.unitPrice).toBe(0.88)
    expect(result!.lineTotal).toBe(1.58)
  })
  
  it('should parse weight item without right column total', () => {
    const itemNameLine = 'BANANAS'
    const weightLine = '2.52 LB @ 0.56/LB'
    
    const result = parseWeightLinePair(itemNameLine, weightLine)
    
    expect(result).not.toBeNull()
    expect(result!.name).toBe('BANANAS')
    expect(result!.quantity).toBe(2.52)
    expect(result!.unit).toBe('lb')
    expect(result!.unitPrice).toBe(0.56)
    expect(result!.lineTotal).toBe(1.41) // 2.52 * 0.56 = 1.4112, rounded to 1.41
  })
  
  it('should handle different weight unit formats', () => {
    const itemNameLine = 'POTATOES'
    const weightLine = '1.8 LBS @ 0.88/LBS'
    const rightColumnTotal = '1.58'
    
    const result = parseWeightLinePair(itemNameLine, weightLine, rightColumnTotal)
    
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('lb') // Normalized from LBS
    expect(result!.lineTotal).toBe(1.58)
  })
  
  it('should return null for invalid weight line', () => {
    const itemNameLine = 'REGULAR ITEM'
    const weightLine = 'NOT A WEIGHT LINE'
    
    const result = parseWeightLinePair(itemNameLine, weightLine)
    
    expect(result).toBeNull()
  })
  
  it('should handle GST/HST/QST tax lines', () => {
    const text = `
SUBTOTAL                   90.91
GST 5.000%                  4.55
HST 5.000%                  4.54
TOTAL                     100.00
`
    const result = parseTotalsFromText(text)
    
    // Should extract tax from GST or HST line
    expect(result.subtotal).toBe(90.91)
    expect(result.taxAmount).toBe(4.54) // Last tax line (HST)
    expect(result.taxRate).toBe(5.000) // From GST or HST line
    expect(result.total).toBe(100.00)
  })
})

describe('completeItemName', () => {
  describe('OCR typos', () => {
    it('fixes Acocado → Avocado in any context', () => {
      expect(completeItemName('Acocado Oil')).toBe('Avocado Oil')
      expect(completeItemName('acocado')).toBe('Avocado')
      expect(completeItemName('ACOCODO')).toBe('Avocado')
      expect(completeItemName('Organic Acocado')).toBe('Organic Avocado')
      expect(completeItemName('Acocado')).toBe('Avocado')
    })
    it('fixes Eq → Equal (Eq Duo, Eq packets)', () => {
      expect(completeItemName('Eq Duo')).toBe('Equal Duo')
      expect(completeItemName('Eq duo')).toBe('Equal Duo')
      expect(completeItemName('Eq Packets')).toBe('Equal Packets')
    })
  })

  describe('truncated phrases (Sea, Walmart Sea, etc.)', () => {
    it('completes Sea → Sea Salt', () => {
      expect(completeItemName('Sea')).toBe('Sea Salt')
      expect(completeItemName('sea')).toBe('Sea Salt')
      expect(completeItemName('SEA')).toBe('Sea Salt')
    })
    it('completes Walmart Sea / WM Sea → Walmart Sea Salt', () => {
      expect(completeItemName('Walmart Sea')).toBe('Walmart Sea Salt')
      expect(completeItemName('WM Sea')).toBe('Walmart Sea Salt')
      expect(completeItemName('walmart sea')).toBe('Walmart Sea Salt')
    })
    it('completes Kirkland Signature Sea → Kirkland Signature Sea Salt', () => {
      expect(completeItemName('Kirkland Signature Sea')).toBe('Kirkland Signature Sea Salt')
    })
    it('completes Jasmine → Jasmine Rice', () => {
      expect(completeItemName('Jasmine')).toBe('Jasmine Rice')
    })
    it('completes Pure Salt → Pure Sea Salt', () => {
      expect(completeItemName('Pure Salt')).toBe('Pure Sea Salt')
    })
    it('completes Ground Peppercorn → Ground Black Peppercorn', () => {
      expect(completeItemName('Ground Peppercorn')).toBe('Ground Black Peppercorn')
    })
    it('completes Sesame Seed → Sesame Seeds', () => {
      expect(completeItemName('Sesame Seed')).toBe('Sesame Seeds')
    })
  })

  describe('brand + fragment (Ks, Mahatma, Swiss, Sushi Chef, Broc, Eq)', () => {
    it('Ks/KS + product → Kirkland Signature', () => {
      expect(completeItemName('Ks Pure Salt')).toBe('Kirkland Signature Pure Salt')
      expect(completeItemName('KS Pure Salt')).toBe('Kirkland Signature Pure Salt')
      expect(completeItemName('Ks Sea')).toBe('Kirkland Signature Sea Salt')
      expect(completeItemName('Ks Sea Salt')).toBe('Kirkland Signature Sea Salt')
      expect(completeItemName('Ks Granola')).toBe('Kirkland Signature Granola')
    })
    it('Mahatma Jasmine → Mahatma Jasmine Rice', () => {
      expect(completeItemName('Mahatma Jasmine')).toBe('Mahatma Jasmine Rice')
      expect(completeItemName('mahatma jasmine')).toBe('Mahatma Jasmine Rice')
    })
    it('Swiss Dark → Swiss Dark Chocolate', () => {
      expect(completeItemName('Swiss Dark')).toBe('Swiss Dark Chocolate')
      expect(completeItemName('SWISS DARK')).toBe('Swiss Dark Chocolate')
    })
    it('Sushi Chef → Sushi Chef Rice Vinegar', () => {
      expect(completeItemName('Sushi Chef')).toBe('Sushi Chef Rice Vinegar')
    })
    it('Broc Crowns → Broccoli Crowns', () => {
      expect(completeItemName('Broc Crowns')).toBe('Broccoli Crowns')
      expect(completeItemName('Broc Crown')).toBe('Broccoli Crowns')
    })
    it('Eq Duo → Equal Duo', () => {
      expect(completeItemName('Eq Duo')).toBe('Equal Duo')
    })
  })

  describe('full-name completions (no truncated receipt names)', () => {
    it('LC Taco → full name with Soft (title-cased)', () => {
      expect(completeItemName('LC Taco')).toBe('Lc Soft Taco')
      expect(completeItemName('Lc Taco')).toBe('Lc Soft Taco')
      expect(completeItemName('Low Carb Taco')).toBe('Low Carb Soft Taco')
    })
    it('Kirkland Signature Dental Ch → Kirkland Signature Dental Chews', () => {
      expect(completeItemName('Kirkland Signature Dental Ch')).toBe('Kirkland Signature Dental Chews')
      expect(completeItemName('KS Dental Ch')).toBe('Kirkland Signature Dental Chews')
    })
  })

  describe('already-complete names unchanged', () => {
    it('leaves full product names as-is', () => {
      expect(completeItemName('Kirkland Signature Pure Salt')).toBe('Kirkland Signature Pure Salt')
      expect(completeItemName('Sesame Oil')).toBe('Sesame Oil')
      expect(completeItemName('100% Pure Creatine Monohydrate')).toBe('100% Pure Creatine Monohydrate')
      expect(completeItemName('Mahatma Jasmine Rice')).toBe('Mahatma Jasmine Rice')
      expect(completeItemName('Walmart Sea Salt')).toBe('Walmart Sea Salt')
      expect(completeItemName('Organic Avocado Oil')).toBe('Organic Avocado Oil')
      expect(completeItemName('Coated peanut nut cracker')).toBe('Coated Peanut Nut Cracker')
    })
    it('does not alter names that only partially match', () => {
      expect(completeItemName('Sea Bass')).toBe('Sea Bass')
      expect(completeItemName('Jasmine Tea')).toBe('Jasmine Tea')
      expect(completeItemName('Dark Chocolate Bar')).toBe('Dark Chocolate Bar')
      expect(completeItemName('Pure Honey')).toBe('Pure Honey')
      expect(completeItemName('Sesame Seeds')).toBe('Sesame Seeds')
    })
  })

  describe('edge cases and robustness', () => {
    it('handles empty, whitespace, and invalid input', () => {
      expect(completeItemName('')).toBe('')
      expect(completeItemName('   ')).toBe('   ')
      expect(completeItemName('  \t  ')).toBe('  \t  ')
      // trim leaves empty -> return name (original)
      expect(completeItemName('  ').trim()).toBe('')
    })
    it('handles single-word names', () => {
      expect(completeItemName('Sea')).toBe('Sea Salt')
      expect(completeItemName('Jasmine')).toBe('Jasmine Rice')
      expect(completeItemName('Milk')).toBe('Milk')
      expect(completeItemName('Bread')).toBe('Bread')
    })
    it('normalizes multiple spaces to one', () => {
      expect(completeItemName('Ks   Pure   Salt')).toBe('Kirkland Signature Pure Salt')
      expect(completeItemName('  Walmart   Sea  ')).toBe('Walmart Sea Salt')
    })
    it('handles names with numbers and punctuation', () => {
      expect(completeItemName('100% Pure Creatine Monohydrate')).toBe('100% Pure Creatine Monohydrate')
      expect(completeItemName('2% Milk')).toBe('2% Milk')
    })
    it('returns original for null/undefined (type guard)', () => {
      expect(completeItemName(null as any)).toBe(null)
      expect(completeItemName(undefined as any)).toBe(undefined)
    })
  })

  describe('no false positives', () => {
    it('does not complete Sea when part of longer phrase', () => {
      expect(completeItemName('Sea Bass')).toBe('Sea Bass')
      expect(completeItemName('Seaweed')).toBe('Seaweed')
      expect(completeItemName('Seafood')).toBe('Seafood')
    })
    it('does not complete Jasmine when part of longer phrase', () => {
      expect(completeItemName('Jasmine Tea')).toBe('Jasmine Tea')
      expect(completeItemName('Jasmine Rice 5lb')).toBe('Jasmine Rice 5lb')
    })
    it('does not alter unrelated names', () => {
      expect(completeItemName('Sushi')).toBe('Sushi')
      expect(completeItemName('Chef Boyardee')).toBe('Chef Boyardee')
      expect(completeItemName('Broccoli')).toBe('Broccoli')
      expect(completeItemName('Equal')).toBe('Equal')
    })
  })
})

describe('parseReceiptOcrText', () => {
  it('extracts items from receipt with prices', () => {
    const text = `
TR# 123
TE# 456
Ks Pure Salt                2.99
Organic Milk                4.49
SUBTOTAL                    7.48
TAX 10%                      0.75
TOTAL                        8.23
`
    const parsed = parseReceiptOcrText(text)
    expect(parsed.items.length).toBeGreaterThanOrEqual(2)
    const names = parsed.items.map(i => i.name)
    expect(names.some(n => n.includes('Salt') || n.includes('Kirkland'))).toBe(true)
  })

  it('parses weight items when format has name line, weight line, and extended total', () => {
    const text = `
TR# 123
TE# 456
ONIONS                      0.97
1.24 LB @ 0.78/LB
0.97
SUBTOTAL                    0.97
TOTAL                       0.97
`
    const parsed = parseReceiptOcrText(text)
    const weightItem = parsed.items.find(i => i.unit === 'lb' || i.unit === 'kg')
    if (parsed.items.length >= 1 && weightItem) {
      expect(weightItem.quantity).toBeGreaterThan(0)
      expect(weightItem.lineTotal).toBeDefined()
    }
    expect(parsed.receiptSubtotal).toBeDefined()
    expect(parsed.receiptTotal).toBeDefined()
  })

  it('does not use weight as price when line has "X.XX lbs" and a separate price', () => {
    // Line with weight then line total: price must be the total (1.41), not the weight (2.52)
    const text = `
TR# 1
BANANAS 2.52 lbs 1.41
SUBTOTAL                    1.41
TOTAL                       1.41
`
    const parsed = parseReceiptOcrText(text)
    const bananas = parsed.items.find(i => /banana/i.test(i.name))
    expect(bananas).toBeDefined()
    expect(bananas!.price).toBe(1.41)
    expect(bananas!.price).not.toBe(2.52)
  })

  it('does not create item with weight as price when only weight appears on line', () => {
    // "BANANAS 2.52 lbs" has no separate price - 2.52 is weight, so we must not use it as price
    const text = `
TR# 1
BANANAS 2.52 lbs
SUBTOTAL                    0.00
TOTAL                       0.00
`
    const parsed = parseReceiptOcrText(text)
    const bananas = parsed.items.find(i => /banana/i.test(i.name))
    // Should either be missing (no valid price) or have a different price; must not be 2.52
    if (bananas) {
      expect(bananas.price).not.toBe(2.52)
    }
  })

  it('parses Costco-style lines (item# + name then price)', () => {
    const text = `
TR# 1
***********
1095660 DURA C 14PK
18.99 A
251680 ORG RASPBERY
9.99
SUBTOTAL                    28.98
TAX                         0.00
**** TOTAL                  28.98
`
    const parsed = parseReceiptOcrText(text)
    expect(parsed.items.length).toBeGreaterThanOrEqual(2)
    const dura = parsed.items.find(i => /dura/i.test(i.name) || /dura c/i.test(i.name))
    const rasp = parsed.items.find(i => /raspber/i.test(i.name))
    expect(dura).toBeDefined()
    expect(dura!.price).toBe(18.99)
    expect(rasp).toBeDefined()
    expect(rasp!.price).toBe(9.99)
  })

  it('includes store and date when present', () => {
    const text = `
Walmart Supercenter
123 Main St
01/28/2025
ITEM 1                       3.99
SUBTOTAL                      3.99
TOTAL                         3.99
`
    const parsed = parseReceiptOcrText(text)
    expect(parsed.store).toBe('Walmart')
    expect(parsed.date).toBeDefined()
  })

  it('parses Costco "N @ X.XX" quantity format correctly', () => {
    const text = `
COSTCO WHOLESALE
TR# 1
313973 BL. D'OEUFS          14.99
1868769 ALANI
12 @ 9,99                   119,88
SUBTOTAL                   160,79
TOTAL                      160,79
`
    const parsed = parseReceiptOcrText(text)
    const eggs = parsed.items.find(i => /oeuf|egg/i.test(i.name))
    const alani = parsed.items.find(i => /alani/i.test(i.name))
    expect(eggs).toBeDefined()
    expect(eggs!.quantity).toBe(1)
    expect(eggs!.price).toBe(14.99)
    expect(alani).toBeDefined()
    expect(alani!.quantity).toBe(12)
    expect(alani!.price).toBe(9.99)
    expect(alani!.lineTotal).toBe(119.88)
  })

  it('excludes ECOFRAIS and CONSIGNE QC fees from items', () => {
    const text = `
COSTCO WHOLESALE
TR# 1
1868769 ALANI
12 @ 9,99                   119,88
12 @ 0,36
*ECOFRAIS 4,32
12 @ 1,80
CONSIGNE QC 21.60
SUBTOTAL                   160,79
TOTAL                      160,79
`
    const parsed = parseReceiptOcrText(text)
    const ecofrais = parsed.items.find(i => /ecofrais/i.test(i.name))
    const consigne = parsed.items.find(i => /consigne/i.test(i.name))
    expect(ecofrais).toBeUndefined()
    expect(consigne).toBeUndefined()
    expect(parsed.items.length).toBe(1)
    expect(parsed.items[0].name).toMatch(/alani/i)
    expect(parsed.items[0].quantity).toBe(12)
  })

  it('parses quantity from "N @ X.XX" pattern on single line', () => {
    const text = `
TR# 1
TE# 1
Soda 3 @ 1.99 5.97
SUBTOTAL                    5.97
TOTAL                       5.97
`
    const parsed = parseReceiptOcrText(text)
    const soda = parsed.items.find(i => /soda/i.test(i.name))
    expect(soda).toBeDefined()
    expect(soda!.quantity).toBe(3)
    expect(soda!.price).toBe(1.99)
    expect(soda!.lineTotal).toBe(5.97)
  })
})

describe('buildScannedItemsFromOcr', () => {
  it('applies completeItemName to every item name', () => {
    const parsedItems = [
      { name: 'Ks Pure Salt', price: 2.99, quantity: 1, unit: 'pieces', lineTotal: 2.99 },
      { name: 'Walmart Sea', price: 1.49, quantity: 1, unit: 'pieces', lineTotal: 1.49 },
      { name: 'Mahatma Jasmine', price: 4.99, quantity: 1, unit: 'pieces', lineTotal: 4.99 },
      { name: 'Acocado Oil', price: 6.99, quantity: 1, unit: 'pieces', lineTotal: 6.99 },
      { name: 'Swiss Dark', price: 3.49, quantity: 1, unit: 'pieces', lineTotal: 3.49 },
      { name: 'Sushi Chef', price: 2.99, quantity: 1, unit: 'pieces', lineTotal: 2.99 },
      { name: 'Broc Crowns', price: 2.49, quantity: 1, unit: 'pieces', lineTotal: 2.49 },
      { name: 'Eq Duo', price: 5.99, quantity: 1, unit: 'pieces', lineTotal: 5.99 },
      { name: 'Sea', price: 0.99, quantity: 1, unit: 'pieces', lineTotal: 0.99 },
    ]
    const scanned = buildScannedItemsFromOcr(parsedItems)
    expect(scanned).toHaveLength(parsedItems.length)
    expect(scanned[0].name).toBe('Kirkland Signature Pure Salt')
    expect(scanned[1].name).toBe('Walmart Sea Salt')
    expect(scanned[2].name).toBe('Mahatma Jasmine Rice')
    expect(scanned[3].name).toBe('Avocado Oil')
    expect(scanned[4].name).toBe('Swiss Dark Chocolate')
    expect(scanned[5].name).toBe('Sushi Chef Rice Vinegar')
    expect(scanned[6].name).toBe('Broccoli Crowns')
    expect(scanned[7].name).toBe('Equal Duo')
    expect(scanned[8].name).toBe('Sea Salt')
  })

  it('preserves quantity, unit, price, lineTotal', () => {
    const parsedItems = [
      { name: 'Milk', price: 4.99, quantity: 2, unit: 'pieces', lineTotal: 9.98 },
    ]
    const scanned = buildScannedItemsFromOcr(parsedItems)
    expect(scanned[0].name).toBe('Milk')
    expect(scanned[0].quantity).toBe(2)
    expect(scanned[0].unit).toBe('pieces')
    expect(scanned[0].price).toBe(4.99)
    expect(scanned[0].lineTotal).toBe(9.98)
  })

  it('assigns category and location from name', () => {
    const parsedItems = [
      { name: 'Kirkland Signature Pure Salt', price: 2.99, quantity: 1, unit: 'pieces', lineTotal: 2.99 },
      { name: 'Organic Milk', price: 4.49, quantity: 1, unit: 'pieces', lineTotal: 4.49 },
    ]
    const scanned = buildScannedItemsFromOcr(parsedItems)
    expect(scanned[0].category).toBeDefined()
    expect(scanned[0].location).toBeDefined()
    expect(scanned[1].category).toBeDefined()
    expect(scanned[1].location).toBeDefined()
  })

  it('handles empty parsed items', () => {
    const scanned = buildScannedItemsFromOcr([])
    expect(scanned).toEqual([])
  })
})

describe('parseTotalsFromText — additional edge cases', () => {
  it('handles missing tax line (subtotal and total only)', () => {
    const text = `SUBTOTAL 50.00\nTOTAL 55.00`
    const result = parseTotalsFromText(text)
    expect(result.subtotal).toBe(50.00)
    expect(result.total).toBe(55.00)
    expect(result.taxAmount).toBe(5.00)
  })
  it('handles empty or whitespace-only text', () => {
    const result = parseTotalsFromText('')
    expect(result.subtotal).toBeUndefined()
    expect(result.total).toBeUndefined()
    const result2 = parseTotalsFromText('\n\n  \n')
    expect(result2.subtotal).toBeUndefined()
  })
  it('handles text with no totals section', () => {
    const text = `ITEM A 1.99\nITEM B 2.99`
    const result = parseTotalsFromText(text)
    expect(result.subtotal).toBeUndefined()
    expect(result.total).toBeUndefined()
  })
})

describe('parseWeightLinePair — additional cases', () => {
  it('parses oz weight format', () => {
    const result = parseWeightLinePair('CHEESE', '8 OZ @ 2.50/OZ', '20.00')
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('oz')
    expect(result!.quantity).toBe(8)
  })
  it('returns null when weight line has no valid weight', () => {
    const result = parseWeightLinePair('ITEM', 'NO WEIGHT HERE', '5.00')
    expect(result).toBeNull()
  })
  it('handles kg unit', () => {
    const result = parseWeightLinePair('APPLES', '1.5 KG @ 3.00/KG', '4.50')
    expect(result).not.toBeNull()
    expect(result!.unit).toBe('kg')
    expect(result!.quantity).toBe(1.5)
  })
})
