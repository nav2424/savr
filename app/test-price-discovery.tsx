/**
 * Price Discovery Test Screen
 * Run tests to verify price extraction is working
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import {
  runAllPriceTests,
  testReceiptPriceExtraction,
  testPriceSearch,
  testPriceComparison,
  checkPriceDatabase,
  TestResult,
} from '../lib/test-utils/TestPriceExtraction';
import {
  runAllOpenFoodFactsTests,
  testGetProduct,
  testSearchProducts,
  testCommonGroceries,
  TEST_BARCODES,
} from '../lib/test-utils/TestOpenFoodFacts';

export default function TestPriceDiscoveryScreen() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Capture console.log
  const captureLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const runTest = async (testFn: () => Promise<void | TestResult>) => {
    setLogs([]);
    setTestResults([]);
    setRunning(true);

    // Override console.log temporarily
    const originalLog = console.log;
    console.log = (...args) => {
      captureLog(args.map(a => String(a)).join(' '));
      originalLog(...args);
    };

    try {
      const result = await testFn();
      if (result && 'success' in result) {
        setTestResults([result]);
      }
    } catch (error) {
      captureLog(`Error: ${error}`);
    } finally {
      console.log = originalLog;
      setRunning(false);
    }
  };

  const handleRunAllTests = async () => {
    if (!user) {
      captureLog('Please sign in to run tests');
      return;
    }
    await runTest(() => runAllPriceTests(user.id));
  };

  const handleTestExtraction = async () => {
    if (!user) {
      captureLog('Please sign in to run tests');
      return;
    }
    await runTest(() => testReceiptPriceExtraction(user.id));
  };

  const handleTestSearch = async () => {
    await runTest(() => testPriceSearch());
  };

  const handleTestComparison = async () => {
    await runTest(() => testPriceComparison());
  };

  const handleCheckDatabase = async () => {
    await runTest(() => checkPriceDatabase());
  };

  const handleTestOpenFoodFacts = async () => {
    await runTest(() => runAllOpenFoodFactsTests());
  };

  const handleTestCommonGroceries = async () => {
    await runTest(() => testCommonGroceries());
  };

  const handleTestBarcodeLookup = async () => {
    await runTest(() => testGetProduct(TEST_BARCODES.cocaCola));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Test Price Discovery',
          headerStyle: { backgroundColor: '#6A9571' },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🧪 Price Discovery Tests</Text>
          <Text style={styles.infoText}>
            Use these tests to verify that price extraction from receipts is working correctly.
          </Text>
        </View>

        {/* Test Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Tests</Text>

          <TouchableOpacity
            style={[styles.testButton, styles.primaryButton]}
            onPress={handleRunAllTests}
            disabled={running || !user}
          >
            <Text style={styles.buttonText}>🚀 Run All Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestExtraction}
            disabled={running || !user}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              📝 Test Receipt Extraction
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestSearch}
            disabled={running}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              🔍 Test Price Search
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestComparison}
            disabled={running}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              📊 Test Price Comparison
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleCheckDatabase}
            disabled={running}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              💾 Check Database
            </Text>
          </TouchableOpacity>
        </View>

        {/* Open Food Facts Tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Food Facts (Free API)</Text>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestOpenFoodFacts}
            disabled={running}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              🌍 Test Open Food Facts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestBarcodeLookup}
            disabled={running}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              🔍 Test Barcode Lookup
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestCommonGroceries}
            disabled={running}
          >
            <Text style={[styles.buttonText, styles.secondaryText]}>
              🛒 Test Common Groceries
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {running && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6A9571" />
            <Text style={styles.loadingText}>Running tests...</Text>
          </View>
        )}

        {/* Test Results */}
        {testResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Results</Text>
            {testResults.map((result, index) => (
              <View
                key={index}
                style={[
                  styles.resultCard,
                  result.success ? styles.successCard : styles.errorCard,
                ]}
              >
                <Text style={styles.resultText}>
                  {result.success ? '✅' : '❌'} {result.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Console Logs */}
        {logs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Console Output</Text>
            <View style={styles.consoleContainer}>
              <ScrollView style={styles.console}>
                {logs.map((log, index) => (
                  <Text key={index} style={styles.consoleText}>
                    {log}
                  </Text>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📖 How to Use</Text>
          <Text style={styles.instructionsText}>
            1. Make sure you've run the SQL migration{'\n'}
            2. Click "Run All Tests" to verify everything{'\n'}
            3. Check console output for details{'\n'}
            4. If tests pass, price extraction is working!{'\n'}
            {'\n'}
            You can also run individual tests to debug specific features.
          </Text>
        </View>

        {!user && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              ⚠️  Please sign in to run receipt extraction tests
            </Text>
          </View>
        )}
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
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1565C0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#6A9571',
  },
  primaryButton: {
    backgroundColor: '#6A9571',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  secondaryText: {
    color: '#6A9571',
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
  resultCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  successCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  resultText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  consoleContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    maxHeight: 400,
  },
  console: {
    maxHeight: 360,
  },
  consoleText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#00FF00',
    marginBottom: 4,
  },
  instructionsCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 22,
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    textAlign: 'center',
  },
});

