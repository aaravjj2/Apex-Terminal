
import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from services.persistence import init_database, BarRecord
from sqlalchemy import select, func

async def check_db():
    db = await init_database()
    async with db.get_session() as session:
        result = await session.execute(select(func.count(BarRecord.id)))
        count = result.scalar()
        print(f"Total Bars in DB: {count}")
        
        for sym in ["AAPL", "MSFT", "TSLA"]:
            res = await session.execute(select(func.count(BarRecord.id)).where(BarRecord.symbol == sym))
            c = res.scalar()
            print(f"Bars for {sym}: {c}")

if __name__ == "__main__":
    asyncio.run(check_db())
