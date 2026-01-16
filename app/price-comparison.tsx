/**
 * Price Comparison Screen
 * Example screen showing how to use the Price Discovery System
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { priceDiscoveryService, PriceData } from '../lib/PriceDiscoveryService';
import { PriceComparisonCard, DealsList } from '../components/PriceComparisonCard';
import { useAuth } from '../lib/AuthContext';

export default function PriceComparisonScreen() {
  const { user } = useAuth();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [deals, setDeals] = useState<PriceData[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<'CA' | 'US'>('CA');
  const [postalCode, setPostalCode] = useState('');

  // Load nearby deals on mount
  useEffect(() => {
    loadNearbyDeals();
  }, [selectedCountry, postalCode]);

  /**
   * Search for product prices
   */
  const searchPrices = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Please enter a product name');
      return;
    }

    setSearching(true);
    try {
      const results = await priceDiscoveryService.searchProductPrices(
        searchQuery,
        {
          country: selectedCountry,
          postalCode: postalCode || undefined,
          maxResults: 20,
        }
      );

      setPrices(results);

      if (results.length === 0) {
        Alert.alert(
          'No Prices Found',
          'Try scanning a receipt with this product to add it to our database!'
        );
      }
    } catch (error) {
      console.error('Error searching prices:', error);
      Alert.alert('Error', 'Failed to search prices');
    } finally {
      setSearching(false);
    }
  };

  /**
   * Load nearby deals
   */
  const loadNearbyDeals = async () => {
    setLoadingDeals(true);
    try {
      const nearbyDeals = await priceDiscoveryService.getDealsNearby(
        postalCode || 'M5V', // Default to Toronto if no postal code
        selectedCountry
      );

      setDeals(nearbyDeals);
    } catch (error) {
      console.error('Error loading deals:', error);
    } finally {
      setLoadingDeals(false);
    }
  };

  /**
   * Set price alert for a product
   */
  const setPriceAlert = async (productName: string, maxPrice: number) => {
    if (!user) {
      Alert.alert('Please sign in to set price alerts');
      return;
    }

    try {
      await priceDiscoveryService.createPriceAlert(
        user.id,
        productName,
        maxPrice
      );

      Alert.alert(
        'Price Alert Set! 🔔',
        `We'll notify you when ${productName} drops below $${maxPrice.toFixed(2)}`
      );
    } catch (error) {
      console.error('Error setting price alert:', error);
      Alert.alert('Error', 'Failed to set price alert');
    }
  };

  /**
   * Handle store press
   */
  const handleStorePress = (price: PriceData) => {
    Alert.alert(
      price.storeChain,
      `${price.productName}\n\n` +
      `Price: $${price.price.toFixed(2)}\n` +
      `${price.isOnSale ? `🎉 ON SALE (${price.discountPercentage}% off)\n` : ''}` +
      `${price.validTo ? `Valid until: ${new Date(price.validTo).toLocaleDateString()}` : ''}`,
      [
        {
          text: 'Set Alert',
          onPress: () => setPriceAlert(price.productName, price.price * 0.9),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Price Comparison',
          headerStyle: { backgroundColor: '#6A9571' },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Find Best Prices</Text>
          
          {/* Country Selector */}
          <View style={styles.countrySelector}>
            <TouchableOpacity
              style={[
                styles.countryButton,
                selectedCountry === 'CA' && styles.countryButtonActive,
              ]}
              onPress={() => setSelectedCountry('CA')}
            >
              <Text
                style={[
                  styles.countryButtonText,
                  selectedCountry === 'CA' && styles.countryButtonTextActive,
                ]}
              >
                🇨🇦 Canada
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.countryButton,
                selectedCountry === 'US' && styles.countryButtonActive,
              ]}
              onPress={() => setSelectedCountry('US')}
            >
              <Text
                style={[
                  styles.countryButtonText,
                  selectedCountry === 'US' && styles.countryButtonTextActive,
                ]}
              >
                🇺🇸 USA
              </Text>
            </TouchableOpacity>
          </View>

          {/* Postal Code Input */}
          <TextInput
            style={styles.input}
            placeholder={selectedCountry === 'CA' ? 'Postal Code (e.g., M5V)' : 'ZIP Code (e.g., 10001)'}
            value={postalCode}
            onChangeText={setPostalCode}
            autoCapitalize="characters"
            maxLength={selectedCountry === 'CA' ? 3 : 5}
          />

          {/* Search Input */}
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search product (e.g., milk, eggs, bread)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchPrices}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchPrices}
              disabled={searching}
            >
              {searching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>🔍</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Price Results */}
          {prices.length > 0 && (
            <View style={styles.resultsContainer}>
              <PriceComparisonCard
                productName={searchQuery}
                prices={prices}
                onStorePress={handleStorePress}
              />
            </View>
          )}
        </View>

        {/* Deals Section */}
        <View style={styles.dealsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Deals 🔥</Text>
            <TouchableOpacity onPress={loadNearbyDeals}>
              <Text style={styles.refreshButton}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {loadingDeals ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6A9571" />
              <Text style={styles.loadingText}>Loading deals...</Text>
            </View>
          ) : (
            <DealsList deals={deals} onDealPress={handleStorePress} />
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 How it works</Text>
          <Text style={styles.infoText}>
            • Prices come from user-scanned receipts{'\n'}
            • Scan your receipts to help build the database{'\n'}
            • More scans = better price comparisons{'\n'}
            • Set alerts to never miss a deal
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                'Scan Receipt',
                'Go to the Scan tab to scan a receipt and contribute price data!'
              );
            }}
          >
            <Text style={styles.actionButtonText}>📸 Scan Receipt</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              Alert.alert(
                'Price Alerts',
                'Search for a product and tap a price to set an alert!'
              );
            }}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              🔔 My Alerts
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    color: '#6A9571',
    fontSize: 14,
    fontWeight: '600',
  },
  countrySelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  countryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  countryButtonActive: {
    backgroundColor: '#6A9571',
  },
  countryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  countryButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: '#6A9571',
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  searchButtonText: {
    fontSize: 24,
  },
  resultsContainer: {
    marginTop: 8,
  },
  dealsSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1B5E20',
    lineHeight: 22,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6A9571',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6A9571',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#6A9571',
  },
});

