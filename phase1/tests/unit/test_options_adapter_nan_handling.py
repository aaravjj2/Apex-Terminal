import math
from services.options.adapter import OptionsDataAdapter
from services.options import OptionType


class FakeRow(dict):
    def get(self, k, default=None):
        return super().get(k, default)


def test_row_with_nan_values_is_sanitized():
    adapter = OptionsDataAdapter()
    # Create a row with NaN bid and NaN markable values
    row = FakeRow({
        'strike': 100.0,
        'bid': float('nan'),
        'ask': 0.05,
        'lastPrice': None,
        'contractSymbol': 'FAKE100C',
        'volume': 0,
        'openInterest': 0,
        'impliedVolatility': float('nan'),
    })

    # expiration and today are arbitrary dates
    from datetime import date
    contract = adapter._row_to_contract('FAKE', row, OptionType.CALL, date.today(), 100.0, date.today())

    # We expect NaN to be converted to None for bid and implied_volatility and mark
    assert contract is not None
    assert contract.bid is None
    assert contract.mark is None
    assert contract.implied_volatility is None
