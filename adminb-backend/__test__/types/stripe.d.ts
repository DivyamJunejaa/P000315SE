// Augment the 'stripe' module to include test-only helper exports
// This ensures TypeScript understands the Jest-mapped mock in __test__/mocks/stripe.ts

declare module 'stripe' {
  /**
   * Test-only helper to configure Stripe mock state.
   * Provided via Jest's moduleNameMapper to point to __test__/mocks/stripe.ts.
   */
  export function setStripeMockState(partial: any): void;

  // Default export used in api/dashboard.ts; keep it permissive for tests
  const Stripe: any;
  export default Stripe;
}