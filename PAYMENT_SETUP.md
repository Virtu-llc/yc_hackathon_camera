# Payment Setup with Autumn

This app now includes a $5 payment requirement when users first open the app. The current implementation includes a demo version, but here's how to set up the complete Autumn integration:

## Current Implementation

The app currently shows a payment screen with:
- Welcome message and feature list
- $5 pricing display
- Demo payment simulation
- User ID generation and storage

## To Enable Real Payments

1. **Get Autumn API Key**
   - Visit [https://app.useautumn.com/sandbox/dev](https://app.useautumn.com/sandbox/dev)
   - Generate a TEST API key
   - Replace `'am_sk_test_your_key_here'` in `config.ts` with your actual key

2. **Create Product in Autumn Dashboard**
   - Go to Autumn dashboard
   - Create a product called "app-access"
   - Set price to $5.00 (one-time payment)
   - Note the product ID

3. **Update Payment Integration**
   - Uncomment the full Autumn integration in `PaymentProvider.tsx`
   - Update `app/payment.tsx` to use real checkout flow
   - Test with Stripe test cards

## Files Modified

- `app/payment.tsx` - Payment screen UI
- `components/PaymentProvider.tsx` - Payment state management
- `app/_layout.tsx` - App layout with payment provider
- `app/index.tsx` - App entry point with payment check
- `config.ts` - Configuration with Autumn API key

## Demo Flow

1. User opens app
2. App checks if payment completed (stored in SecureStore)
3. If not paid, shows payment screen
4. User can simulate payment in demo
5. After payment, user accesses main camera functionality

## Production Considerations

- Replace demo payment with real Autumn checkout
- Add proper error handling for payment failures
- Implement webhook handling for payment confirmations
- Add payment receipt storage
- Consider subscription vs one-time payment model