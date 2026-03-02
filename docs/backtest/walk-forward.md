# Walk-Forward Analysis

Out-of-sample validation for strategies.

## Concept

1. Train on period 1, test on period 2
2. Roll forward: train on 2, test on 3
3. Aggregate OOS metrics

## Implementation

Split bars into train/test windows; run backtest on train, apply rules on test (no refit).
