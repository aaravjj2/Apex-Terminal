# Greeks

Option sensitivity measures.

## Interface

```typescript
interface Greeks {
  delta: number;   // ∂V/∂S
  gamma: number;   // ∂²V/∂S²
  theta: number;   // ∂V/∂t
  vega: number;    // ∂V/∂σ
  rho: number;     // ∂V/∂r
  vanna: number;   // ∂²V/∂S∂σ
  volga: number;   // vomma
  charm: number;   // delta decay
  veta: number;    // vega decay
  speed: number;   // 3rd order delta
  zomma: number;   // gamma/vol
  color: number;   // gamma decay
}
```

## Interpretation

| Greek | Meaning |
|-------|---------|
| Delta | $ change per $1 underlying move |
| Gamma | Delta change per $1 move |
| Theta | $ decay per day |
| Vega | $ change per 1% IV change |

## API

Options chain returns Greeks per contract: `GET /api/options/chain/:symbol`
