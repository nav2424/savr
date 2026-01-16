/**
 * Price Comparison Card Component
 * Shows price comparisons across stores and highlights best deals
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { PriceData } from '../lib/PriceDiscoveryService';

interface PriceComparisonCardProps {
  productName: string;
  prices: PriceData[];
  onStorePress?: (price: PriceData) => void;
}

export const PriceComparisonCard: React.FC<PriceComparisonCardProps> = ({
  productName,
  prices,
  onStorePress
}) => {
  if (prices.length === 0) {
    return null;
  }

  // Sort by price (cheapest first)
  const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
  const bestPrice = sortedPrices[0];
  const avgPrice = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.productName} numberOfLines={2}>
          {productName}
        </Text>
        <Text style={styles.priceCount}>
          {prices.length} {prices.length === 1 ? 'store' : 'stores'}
        </Text>
      </View>

      {/* Best Price Highlight */}
      <View style={styles.bestPriceContainer}>
        <View style={styles.bestPriceTag}>
          <Text style={styles.bestPriceTagText}>BEST PRICE</Text>
        </View>
        <TouchableOpacity
          style={styles.bestPriceCard}
          onPress={() => onStorePress?.(bestPrice)}
        >
          <Text style={styles.bestPriceStore}>{bestPrice.storeChain}</Text>
          <Text style={styles.bestPrice}>
            ${bestPrice.price.toFixed(2)}
          </Text>
          {bestPrice.isOnSale && bestPrice.discountPercentage && (
            <View style={styles.saleTag}>
              <Text style={styles.saleTagText}>
                {bestPrice.discountPercentage}% OFF
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Other Prices */}
      {sortedPrices.length > 1 && (
        <View style={styles.otherPricesContainer}>
          <Text style={styles.otherPricesTitle}>Other stores:</Text>
          {sortedPrices.slice(1, 4).map((price, index) => (
            <TouchableOpacity
              key={index}
              style={styles.priceRow}
              onPress={() => onStorePress?.(price)}
            >
              <Text style={styles.storeName}>{price.storeChain}</Text>
              <View style={styles.priceInfo}>
                <Text style={styles.price}>${price.price.toFixed(2)}</Text>
                <Text style={styles.priceDiff}>
                  (+${(price.price - bestPrice.price).toFixed(2)})
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Average Price */}
      <View style={styles.avgPriceContainer}>
        <Text style={styles.avgPriceLabel}>Average price:</Text>
        <Text style={styles.avgPrice}>${avgPrice.toFixed(2)}</Text>
      </View>
    </View>
  );
};

interface DealsListProps {
  deals: PriceData[];
  onDealPress?: (deal: PriceData) => void;
}

export const DealsList: React.FC<DealsListProps> = ({ deals, onDealPress }) => {
  if (deals.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No deals available right now</Text>
        <Text style={styles.emptyStateSubtext}>
          Scan receipts to help us find better prices!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.dealsContainer}>
      {deals.map((deal, index) => (
        <TouchableOpacity
          key={index}
          style={styles.dealCard}
          onPress={() => onDealPress?.(deal)}
        >
          {/* Deal Badge */}
          {deal.discountPercentage && (
            <View style={styles.dealBadge}>
              <Text style={styles.dealBadgeText}>
                {deal.discountPercentage}% OFF
              </Text>
            </View>
          )}

          {/* Product Info */}
          <View style={styles.dealInfo}>
            <Text style={styles.dealProductName} numberOfLines={2}>
              {deal.productName}
            </Text>
            {deal.brand && (
              <Text style={styles.dealBrand}>{deal.brand}</Text>
            )}
            <Text style={styles.dealStore}>
              📍 {deal.storeChain}
            </Text>
          </View>

          {/* Price Info */}
          <View style={styles.dealPriceContainer}>
            {deal.originalPrice && (
              <Text style={styles.dealOriginalPrice}>
                ${deal.originalPrice.toFixed(2)}
              </Text>
            )}
            <Text style={styles.dealPrice}>
              ${deal.price.toFixed(2)}
            </Text>
            {deal.validTo && (
              <Text style={styles.dealValidity}>
                Until {new Date(deal.validTo).toLocaleDateString()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  priceCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestPriceContainer: {
    marginBottom: 16,
  },
  bestPriceTag: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  bestPriceTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bestPriceCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  bestPriceStore: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  bestPrice: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1B5E20',
  },
  saleTag: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  saleTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  otherPricesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginBottom: 12,
  },
  otherPricesTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  storeName: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  priceDiff: {
    fontSize: 12,
    color: '#999',
  },
  avgPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  avgPriceLabel: {
    fontSize: 14,
    color: '#666',
  },
  avgPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  
  // Deals List Styles
  dealsContainer: {
    gap: 12,
  },
  dealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dealBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  dealBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dealInfo: {
    flex: 1,
    marginRight: 12,
    paddingTop: 24, // Space for badge
  },
  dealProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  dealBrand: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  dealStore: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  dealPriceContainer: {
    alignItems: 'flex-end',
  },
  dealOriginalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  dealPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  dealValidity: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  
  // Empty State
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

