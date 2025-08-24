import { usePayment } from '@/components/PaymentProvider';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function PaymentScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { simulatePayment } = usePayment();

  const handlePayment = async () => {
    try {
      setIsProcessing(true);
      
      // For demo purposes, simulate payment processing
      Alert.alert(
        'Payment Simulation',
        'This is a demo. In production, this would integrate with Autumn for real payments.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsProcessing(false),
          },
          {
            text: 'Simulate Payment',
            onPress: async () => {
              await simulatePayment();
              router.replace('/(tabs)');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Error', 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Payment Required',
      'A $5 payment is required to access the app. This helps us maintain and improve our AI photography features.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Foxos</Text>
        <Text style={styles.subtitle}>
          Your AI Photography Assistant
        </Text>
        
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• AI-powered photography coaching</Text>
          <Text style={styles.featureItem}>• Real-time composition suggestions</Text>
          <Text style={styles.featureItem}>• Location-based photo opportunities</Text>
          <Text style={styles.featureItem}>• Professional photography tips</Text>
        </View>

        <View style={styles.pricingContainer}>
          <Text style={styles.priceText}>Lift time access fee</Text>
          <Text style={styles.priceAmount}>$5.00</Text>
          <Text style={styles.priceDescription}>
            Unlock lifetime access to all premium features
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.payButtonText}>Pay $5 & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Why do I need to pay?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
  },
  featureList: {
    marginBottom: 40,
  },
  featureItem: {
    fontSize: 16,
    color: 'white',
    marginBottom: 10,
    paddingLeft: 10,
  },
  pricingContainer: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    backgroundColor: '#111',
  },
  priceText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 5,
  },
  priceAmount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  priceDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  payButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 60,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#555',
  },
  payButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: 10,
  },
  skipButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});