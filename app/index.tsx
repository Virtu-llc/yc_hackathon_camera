import { usePayment } from '@/components/PaymentProvider';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function IndexScreen() {
  const { hasPayment, isLoading } = usePayment();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (hasPayment) {
        // User has paid, redirect to main app
        router.replace('/(tabs)');
      } else {
        // User hasn't paid, redirect to payment screen
        router.replace('/payment');
      }
    }
  }, [hasPayment, isLoading, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loadingText}>Loading AesthetIQ...</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 20,
  },
});