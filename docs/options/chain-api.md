# Options Chain API

REST client for options chains.

## Endpoints

```typescript
// GET /api/options/chain/:symbol?expiration=&strikes=
const chain = await getOptionsChain('AAPL', { expiration: '2024-06-21' });

// Response
interface OptionsChainResponse {
  underlying: string;
  underlyingPrice: number;
  chains: OptionsChain[];
  expirations: string[];
  totalContracts: number;
}
```
