
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  let out = {};
  try {
    const br = await chromium.launch({ headless: true });
    const ctx = await br.newContext({ viewport: { width:1920, height:1080 } });
    const pg = await ctx.newPage();
    const errs=[]; const netFails=[];
    pg.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
    pg.on('response', r=>{ if(r.status()>=400&&!r.url().includes('hmr')&&!r.url().includes('hot')) netFails.push({url:r.url(),status:r.status()}); });
    await pg.goto('http://localhost:5100',{waitUntil:'networkidle',timeout:30000});
    await pg.screenshot({path:'C:/Tradingview/Tradingview recreation/w01_judge_report/_screenshot.png',fullPage:true});
    const comps={
      canvas:       await pg.evaluate(()=>document.querySelectorAll('canvas').length),
      chart:        await pg.locator('[class*="chart" i],[class*="Chart"]').count(),
      dashboard:    await pg.locator('[class*="dashboard" i],[class*="Dashboard"]').count(),
      watchlist:    await pg.locator('[class*="watchlist" i],[class*="Watchlist"]').count(),
      blotter:      await pg.locator('[class*="blotter" i],[class*="orders" i]').count(),
    };
    let palette=false;
    try { await pg.keyboard.press('Control+k'); await pg.waitForTimeout(600); palette=await pg.locator('[role="dialog"],[role="combobox"],[class*="palette" i]').count()>0; } catch(e){}
    const text=(await pg.evaluate(()=>document.body.innerText)).trim().length;
    const aria=await pg.evaluate(()=>document.querySelectorAll('[aria-label]').length);
    const roles=await pg.evaluate(()=>document.querySelectorAll('[role]').length);
    const hdgs=await pg.evaluate(()=>document.querySelectorAll('h1,h2,h3').length);
    out={title:await pg.title(),comps,paletteOpened:palette,hasContent:text>50,ariaCount:aria,roleCount:roles,headingCount:hdgs,consoleErrors:errs.slice(0,10),netFails:netFails.slice(0,10)};
    await br.close();
  } catch(e) { out={error:e.message}; }
  fs.writeFileSync('C:/Tradingview/Tradingview recreation/w01_judge_report/_pw_report.json', JSON.stringify(out,null,2));
})();
