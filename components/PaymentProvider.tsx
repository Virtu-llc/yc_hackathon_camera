import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface PaymentContextType {
  hasPayment: boolean;
  isLoading: boolean;
  checkPaymentStatus: () => Promise<void>;
  userId: string | null;
  simulatePayment: () => Promise<void>;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

// Simple user ID generation for demo purposes
const generateUserId = async (): Promise<string> => {
  try {
    let userId = await SecureStore.getItemAsync('user_id');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await SecureStore.setItemAsync('user_id', userId);
    }
    return userId;
  } catch (error) {
    console.error('Error managing user ID:', error);
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [hasPayment, setHasPayment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const checkPaymentStatus = async () => {
    try {
      setIsLoading(true);
      const paymentStatus = await SecureStore.getItemAsync('payment_completed');
      setHasPayment(paymentStatus === 'true');
      
      // Also generate/get user ID
      const currentUserId = await generateUserId();
      setUserId(currentUserId);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setHasPayment(false);
    } finally {
      setIsLoading(false);
    }
  };

  const simulatePayment = async () => {
    // Simulate payment processing for demo
    await new Promise(resolve => setTimeout(resolve, 2000));
    await SecureStore.setItemAsync('payment_completed', 'true');
    setHasPayment(true);
  };

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  return (
    <PaymentContext.Provider value={{ hasPayment, isLoading, checkPaymentStatus, userId, simulatePayment }}>
      {children}
    </PaymentContext.Provider>
  );
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
}