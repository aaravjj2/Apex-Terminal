import os
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path('c:/Tradingview/Tradingview recreation/keys.env'))
key = os.environ.get('APCA_API_KEY_ID','')
secret = os.environ.get('APCA_API_SECRET_KEY','')
print(f'Key: {key[:8]}... len={len(key)}')
print(f'Secret: {secret[:8]}... len={len(secret)}')

from alpaca.trading.client import TradingClient
client = TradingClient(key, secret, paper=True)
account = client.get_account()
print(f'Account: {account.account_number}')
print(f'Cash: {float(account.cash):,.2f}')
print(f'Status: {account.status}')
print('BROKER CONNECTED OK')
