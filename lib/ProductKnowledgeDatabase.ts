// Product Knowledge Database for Bulk Pack Intelligence
export interface ProductPackInfo {
  brand?: string
  productName: string
  packQuantity: number
  unit: string
  store?: string
  alternativeNames?: string[]
}

// Comprehensive product database with bulk pack information
export const PRODUCT_KNOWLEDGE_DB: ProductPackInfo[] = [
  // Costco / Kirkland Signature - Paper Products
  { brand: 'Kirkland Signature', productName: 'Parchment Paper', packQuantity: 6, unit: 'rolls', store: 'Costco', alternativeNames: ['KS Parchment Paper'] },
  { brand: 'Kirkland Signature', productName: 'Paper Towels', packQuantity: 12, unit: 'rolls', store: 'Costco', alternativeNames: ['KS Paper Towels'] },
  { brand: 'Kirkland Signature', productName: 'Toilet Paper', packQuantity: 30, unit: 'rolls', store: 'Costco', alternativeNames: ['KS Toilet Paper', 'KS Bath Tissue'] },
  { brand: 'Kirkland Signature', productName: 'Aluminum Foil', packQuantity: 2, unit: 'rolls', store: 'Costco' },
  { brand: 'Kirkland Signature', productName: 'Plastic Wrap', packQuantity: 2, unit: 'rolls', store: 'Costco' },
  
  // Costco / Kirkland Signature - Beverages
  { brand: 'Kirkland Signature', productName: 'Bottled Water', packQuantity: 40, unit: 'bottles', store: 'Costco', alternativeNames: ['KS Water', 'Kirkland Water'] },
  { brand: 'Kirkland Signature', productName: 'Sparkling Water', packQuantity: 24, unit: 'cans', store: 'Costco' },
  
  // Costco / Kirkland Signature - Canned Goods
  { brand: 'Kirkland Signature', productName: 'Diced Tomatoes', packQuantity: 8, unit: 'cans', store: 'Costco', alternativeNames: ['KS Diced Tomatoes'] },
  { brand: 'Kirkland Signature', productName: 'Tomato Sauce', packQuantity: 8, unit: 'cans', store: 'Costco' },
  { brand: 'Kirkland Signature', productName: 'Black Beans', packQuantity: 8, unit: 'cans', store: 'Costco' },
  { brand: 'Kirkland Signature', productName: 'Chicken Broth', packQuantity: 6, unit: 'cartons', store: 'Costco' },
  { brand: 'Kirkland Signature', productName: 'Tuna', packQuantity: 8, unit: 'cans', store: 'Costco' },
  
  // Costco / Kirkland Signature - Snacks & Bars
  { brand: 'Kirkland Signature', productName: 'Protein Bar', packQuantity: 20, unit: 'bars', store: 'Costco', alternativeNames: ['KS Protein Bar', 'Kirkland Protein Bars'] },
  { brand: 'Kirkland Signature', productName: 'Granola Bar', packQuantity: 24, unit: 'bars', store: 'Costco', alternativeNames: ['KS Granola Bar'] },
  { brand: 'Kirkland Signature', productName: 'Nut Bar', packQuantity: 20, unit: 'bars', store: 'Costco' },
  { brand: 'Kirkland Signature', productName: 'Trail Mix', packQuantity: 2, unit: 'bags', store: 'Costco' },
  { brand: 'Kirkland Signature', productName: 'Organic Tortilla Chips', packQuantity: 2, unit: 'bags', store: 'Costco' },
  
  // Costco / Kirkland Signature - Dairy
  { brand: 'Kirkland Signature', productName: 'Greek Yogurt', packQuantity: 18, unit: 'cups', store: 'Costco', alternativeNames: ['KS Greek Yogurt'] },
  { brand: 'Kirkland Signature', productName: 'String Cheese', packQuantity: 48, unit: 'sticks', store: 'Costco', alternativeNames: ['KS String Cheese'] },
  { brand: 'Kirkland Signature', productName: 'Organic Milk', packQuantity: 3, unit: 'cartons', store: 'Costco' },
  
  // Sam's Club / Member's Mark
  { brand: "Member's Mark", productName: 'Paper Towels', packQuantity: 12, unit: 'rolls', store: "Sam's Club" },
  { brand: "Member's Mark", productName: 'Toilet Paper', packQuantity: 45, unit: 'rolls', store: "Sam's Club" },
  { brand: "Member's Mark", productName: 'Bottled Water', packQuantity: 40, unit: 'bottles', store: "Sam's Club" },
  { brand: "Member's Mark", productName: 'Protein Bars', packQuantity: 20, unit: 'bars', store: "Sam's Club" },
]

export function findProductPackInfo(itemName: string, store?: string): ProductPackInfo | null {
  const searchTerm = itemName.toLowerCase().trim()
  
  for (const product of PRODUCT_KNOWLEDGE_DB) {
    const fullName = product.brand 
      ? `${product.brand} ${product.productName}`.toLowerCase()
      : product.productName.toLowerCase()
    
    if (searchTerm.includes(fullName) || fullName.includes(searchTerm)) {
      if (product.store && store && product.store.toLowerCase() === store.toLowerCase()) {
        return product
      }
      if (!product.store || !store) {
        return product
      }
    }
    
    if (product.alternativeNames) {
      for (const altName of product.alternativeNames) {
        if (searchTerm.includes(altName.toLowerCase())) {
          return product
        }
      }
    }
  }
  
  return null
}

export function isWarehouseStore(store?: string): boolean {
  if (!store) return false
  const storeLower = store.toLowerCase()
  return ['costco', 'sam\'s club', 'bj\'s'].some(ws => storeLower.includes(ws))
}
