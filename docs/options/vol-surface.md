# Volatility Surface

SABR and SVI parametrization.

## SABR Params

```typescript
interface SABRParams {
  alpha: number;  // initial vol
  beta: number;   // CEV exponent (0=normal, 1=lognormal)
  rho: number;    // asset-vol correlation
  nu: number;     // vol of vol
}
```

## SVI Params

```typescript
interface SVIParams {
  a: number;    // vertical shift
  b: number;    // wing angle
  rho: number;  // rotation
  m: number;    // horizontal shift
  sigma: number;// smoothing
}
```
