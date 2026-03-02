# Options Pricing Formulas Reference

> Mathematical models for options valuation, Greeks, and volatility analysis in Apex Terminal.

## Table of Contents

- [Black-Scholes Model](#black-scholes-model)
- [Put-Call Parity](#put-call-parity)
- [The Greeks](#the-greeks)
- [Binomial Tree Method](#binomial-tree-method)
- [Implied Volatility](#implied-volatility)
- [Monte Carlo Simulation](#monte-carlo-simulation)
- [Volatility Surface](#volatility-surface)

---

## Black-Scholes Model

The Black-Scholes formula prices European-style options on non-dividend-paying assets.

### Call Price

```
C = S·N(d₁) − K·e^(−rT)·N(d₂)
```

### Put Price

```
P = K·e^(−rT)·N(−d₂) − S·N(−d₁)
```

### d₁ and d₂

```
d₁ = [ln(S/K) + (r + σ²/2)·T] / (σ·√T)
d₂ = d₁ − σ·√T
```

| Symbol | Meaning |
|--------|---------|
| S | Current underlying price |
| K | Strike price |
| T | Time to expiration (years) |
| r | Risk-free interest rate (annualized) |
| σ | Volatility of the underlying (annualized) |
| N(x) | Standard normal CDF |

### Assumptions

1. Log-normal distribution of returns
2. Constant volatility and risk-free rate over the option's life
3. No dividends, no transaction costs, continuous trading
4. European exercise only

---

## Put-Call Parity

Relates European call and put prices with the same strike and expiry:

```
C − P = S − K·e^(−rT)
```

Any deviation from this equality represents an arbitrage opportunity.

---

## The Greeks

### Delta (Δ) — Price Sensitivity

| | Formula | Range |
|------|---------|-------|
| Call | `Δ = N(d₁)` | 0 to 1 |
| Put | `Δ = N(d₁) − 1` | −1 to 0 |

### Gamma (Γ) — Delta Sensitivity

```
Γ = N'(d₁) / (S·σ·√T)
```

Same for calls and puts. Peaks when the option is ATM near expiry.

### Theta (Θ) — Time Decay

| | Formula |
|------|---------|
| Call | `Θ = −[S·N'(d₁)·σ / (2√T)] − r·K·e^(−rT)·N(d₂)` |
| Put | `Θ = −[S·N'(d₁)·σ / (2√T)] + r·K·e^(−rT)·N(−d₂)` |

Expressed per calendar day, divide by 365.

### Vega (ν) — Volatility Sensitivity

```
ν = S·√T·N'(d₁)
```

Same for calls and puts. Expressed per 1% change in σ, divide by 100.

### Rho (ρ) — Interest Rate Sensitivity

| | Formula |
|------|---------|
| Call | `ρ = K·T·e^(−rT)·N(d₂)` |
| Put | `ρ = −K·T·e^(−rT)·N(−d₂)` |

### Standard Normal PDF

```
N'(x) = (1/√(2π)) · e^(−x²/2)
```

### Greeks Summary Table

| Greek | Measures | Call Sign | Put Sign | ATM Behavior |
|-------|----------|-----------|----------|--------------|
| Delta | Price sensitivity | + | − | ≈ 0.50 / −0.50 |
| Gamma | Delta curvature | + | + | Maximum |
| Theta | Time decay | − | − (usually) | Maximum |
| Vega | Vol sensitivity | + | + | Maximum |
| Rho | Rate sensitivity | + | − | Moderate |

---

## Binomial Tree Method

Prices American and European options by constructing a recombining price tree.

### Parameters

```
u = e^(σ·√Δt)          /* up factor */
d = 1 / u               /* down factor */
p = (e^(r·Δt) − d) / (u − d)   /* risk-neutral probability */
Δt = T / N              /* time step */
```

### Algorithm

1. **Forward pass:** build the price tree `S(i,j) = S · uʲ · d^(i−j)` for step i, state j.
2. **Terminal payoffs:** at step N, `V(N,j) = max(S(N,j)−K, 0)` for calls.
3. **Backward induction:**
   ```
   V(i,j) = e^(−r·Δt) · [p·V(i+1,j+1) + (1−p)·V(i+1,j)]
   ```
4. **American exercise:** at each node, compare continuation value with intrinsic value; take the maximum.

| Parameter | Typical Value | Notes |
|-----------|--------------|-------|
| Steps (N) | 100–500 | Higher = more accurate, slower |
| Convergence | O(1/N) | Use Richardson extrapolation for speed |

---

## Implied Volatility

Implied volatility (IV) is the σ that makes the Black-Scholes price equal to the observed market price. Solved numerically since there is no closed-form inverse.

### Newton-Raphson Iteration

```
σ_{n+1} = σₙ − [BS(σₙ) − C_market] / Vega(σₙ)
```

| Setting | Value |
|---------|-------|
| Initial guess | 0.20 (20%) |
| Convergence threshold | 1 × 10⁻⁶ |
| Max iterations | 100 |
| Fallback | Bisection on [0.001, 5.0] |

Vega is always positive, guaranteeing monotonicity and convergence for valid inputs.

---

## Monte Carlo Simulation

Used for path-dependent and exotic options where closed-form solutions do not exist.

### GBM Path Generation

```
S(t+Δt) = S(t) · exp[(r − σ²/2)·Δt + σ·√Δt·Z]
Z ~ N(0, 1)
```

### Pricing

```
V = e^(−rT) · (1/M) · Σ payoff(pathₘ)    for m = 1…M
```

| Parameter | Typical Value |
|-----------|--------------|
| Paths (M) | 10,000–100,000 |
| Time steps | 252 (daily) |
| Variance reduction | Antithetic variates, control variates |

### Supported Exotic Types

| Type | Payoff |
|------|--------|
| Asian (arithmetic) | `max(avg(S) − K, 0)` |
| Barrier (knock-out) | Standard payoff if barrier not breached |
| Lookback | `max(S_max − K, 0)` or `max(S − S_min, 0)` |

---

## Volatility Surface

The volatility surface maps IV across strike and expiry dimensions.

### Construction

1. Collect market IV for all liquid strikes/expiries.
2. Interpolate using cubic spline in the strike dimension.
3. Interpolate linearly in total variance `w = σ²·T` across expiry.
4. Enforce no-arbitrage constraints (non-negative butterfly spreads, monotone total variance).

### Smile Metrics

| Metric | Definition |
|--------|-----------|
| ATM IV | IV at the forward strike |
| Skew | ΔIV per Δ strike (25δ put IV − 25δ call IV) |
| Kurtosis / Wings | 25δ strangle IV − ATM IV |
| Term structure | ATM IV plotted across expiry |

---

*Source: `lib/options/` — see `blackScholes.ts`, `binomial.ts`, `greeks.ts`, `monteCarlo.ts`, `volatilitySurface.ts`.*
