/**
 * OrderTicket â€” Bloomberg Terminal Edition
 * Full order entry with market/limit/stop, validation, preview, and placement
 */
// â”€â”€â”€ Bloomberg palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BG='#0a0a0a',PANEL='#111111',BORDER='#1e1e1e'
const AMBER='#f5a623',GREEN='#26a69a',RED='#ef5350',BLUE='#42a5f5'
const SUBTLE='#555',TEXT='#d1d4dc'
const MONO='"Roboto Mono","Courier New",monospace'

import { useState, useCallback } from 'react';
import {
  OrderType as OmsOrderType,
  OrderSide as OmsOrderSide,
  TimeInForce,
  createMarketOrder,
  createLimitOrder,
  createStopOrder,
  createStopLimitOrder,
  validateOrderSpec,
  type OrderSpec,
} from '@/lib/oms/order-types';
import {
  validateOrder, previewOrder, placeOrder,
  type OrderTicket as OrderTicketType,
  type OrderSide, type OrderType, type OrderTIF, type OrderValidationError,
} from '../stores/orderTicketStore';

interface OrderTicketProps {
  testId?: string;
  onOrderPlaced?: (order: OrderTicketType) => void;
}

const FLD:React.CSSProperties={display:'flex',gap:8,alignItems:'center',marginBottom:6}
const LBL:React.CSSProperties={width:76,fontSize:9,color:SUBTLE,letterSpacing:'0.1em',textTransform:'uppercase' as const,fontFamily:MONO}
const INP:React.CSSProperties={flex:1,padding:'5px 8px',background:BG,border:`1px solid ${BORDER}`,borderRadius:2,
  color:TEXT,fontSize:11,fontFamily:MONO,outline:'none'}
const SEL:React.CSSProperties={...{flex:1,padding:'5px 8px',background:BG,border:`1px solid ${BORDER}`,borderRadius:2,
  color:TEXT,fontSize:11,fontFamily:MONO,outline:'none',appearance:'none' as const}}

import React from 'react';

export function OrderTicket({ testId='ui2-order-ticket', onOrderPlaced }: OrderTicketProps) {
  const [symbol, setSymbol] = useState('SPY');
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [stopLimitPrice, setStopLimitPrice] = useState(0);
  const [quantity, setQuantity] = useState(100);
  const [limitPrice, setLimitPrice] = useState(0);
  const [stopPrice, setStopPrice] = useState(0);
  const [tif, setTif] = useState<OrderTIF>('day');
  const [errors, setErrors] = useState<OrderValidationError[]>([]);
  const [preview, setPreview] = useState<OrderTicketType|null>(null);
  const [lastPlaced, setLastPlaced] = useState<OrderTicketType|null>(null);

  const handlePreview = useCallback(() => {
    const omsSide = side === 'buy' ? OmsOrderSide.BUY : OmsOrderSide.SELL;
    const tifMap = { day: TimeInForce.DAY, gtc: TimeInForce.GTC, ioc: TimeInForce.IOC, fok: TimeInForce.FOK } as const;
    let spec: OrderSpec | null = null;
    if (type === 'market') {
      spec = { type: OmsOrderType.MARKET, symbol, side: omsSide, quantity, timeInForce: tifMap[tif] };
    } else if (type === 'limit') {
      spec = { type: OmsOrderType.LIMIT, symbol, side: omsSide, quantity, limitPrice, timeInForce: tifMap[tif] };
    } else if (type === 'stop') {
      spec = { type: OmsOrderType.STOP, symbol, side: omsSide, quantity, stopPrice, timeInForce: tifMap[tif] };
    } else if (type === 'stop_limit') {
      spec = { type: OmsOrderType.STOP_LIMIT, symbol, side: omsSide, quantity, stopPrice, limitPrice: stopLimitPrice, timeInForce: tifMap[tif] };
    }
    if (spec) {
      const vr = validateOrderSpec(spec);
      if (!vr.valid) {
        setErrors(vr.errors.map(m => ({ field: 'order', message: m })));
        setPreview(null);
        return;
      }
    }
    const ticket = { symbol, side, type, quantity, limitPrice: type === 'limit' ? limitPrice : type === 'stop_limit' ? stopLimitPrice : undefined, stopPrice: type === 'stop' || type === 'stop_limit' ? stopPrice : undefined, tif };
    const errs = validateOrder(ticket);
    setErrors(errs);
    if (errs.length === 0) { setPreview(previewOrder(ticket)); } else { setPreview(null); }
  }, [symbol, side, type, quantity, limitPrice, stopPrice, stopLimitPrice, tif]);

  const handlePlace = useCallback(() => {
    if(!preview) return;
    const placed=placeOrder(preview);
    setLastPlaced(placed); setPreview(null); setErrors([]);
    onOrderPlaced?.(placed);
  },[preview,onOrderPlaced]);

  const handleCancel = useCallback(() => {setPreview(null);setErrors([]);},[]);

  const sideColor=(s:OrderSide)=>s==='buy'?GREEN:RED;
  const typeColor=(t:OrderType)=>t==='market'?AMBER:t==='limit'?BLUE:t==='stop_limit'?RED:RED;

  return (
    <div data-testid={testId}
      style={{background:PANEL,border:`1px solid ${BORDER}`,borderRadius:2,fontFamily:MONO,overflow:'hidden' as const}}>
      {/* Header */}
      <div style={{padding:'6px 12px',borderBottom:`1px solid ${BORDER}`,background:BG,
        display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:11,color:AMBER,letterSpacing:'0.1em'}}>OT</span>
        <span style={{fontSize:12,color:TEXT,fontWeight:700}}>ORDER TICKET</span>
        <div style={{flex:1}}/>
        {lastPlaced&&<span style={{fontSize:10,color:GREEN}}>âœ“ {lastPlaced.id?.slice(-8)}</span>}
      </div>

      <div style={{padding:12}}>
        {/* Errors */}
        {errors.length>0&&(
          <div data-testid={`${testId}-errors`}
            style={{padding:'6px 10px',marginBottom:10,background:`${RED}18`,border:`1px solid ${RED}44`,
              borderRadius:2,color:RED,fontSize:10}}>
            {errors.map((e,i)=>(
              <div key={i} data-testid={`${testId}-error-${e.field}`}>{e.field.toUpperCase()}: {e.message}</div>
            ))}
          </div>
        )}
        {/* Success */}
        {lastPlaced&&(
          <div data-testid={`${testId}-success`}
            style={{padding:'6px 10px',marginBottom:10,background:`${GREEN}18`,border:`1px solid ${GREEN}44`,
              borderRadius:2,color:GREEN,fontSize:10}}>
            âœ“ ORDER PLACED: {lastPlaced.side.toUpperCase()} {lastPlaced.quantity} {lastPlaced.symbol} [{lastPlaced.status}]
          </div>
        )}

        {!preview?(
          /* Entry Form */
          <div>
            {/* Symbol */}
            <div style={FLD}>
              <span style={LBL}>SYMBOL</span>
              <input data-testid={`${testId}-symbol`} value={symbol}
                onChange={e=>setSymbol(e.target.value.toUpperCase())}
                style={{...INP,color:BLUE,fontWeight:700,fontSize:13}}/>
            </div>
            {/* Side */}
            <div style={FLD}>
              <span style={LBL}>SIDE</span>
              <div style={{display:'flex',gap:4}}>
                {(['buy','sell'] as OrderSide[]).map(s=>(
                  <button key={s} data-testid={`${testId}-side-${s}`} onClick={()=>setSide(s)}
                    style={{padding:'4px 14px',fontSize:10,fontFamily:MONO,letterSpacing:'0.08em',
                      cursor:'pointer',border:`1px solid ${side===s?sideColor(s):BORDER}`,
                      background:side===s?`${sideColor(s)}33`:BG,
                      color:side===s?sideColor(s):SUBTLE,borderRadius:2,fontWeight:side===s?700:400}}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {/* Type */}
            <div style={FLD}>
              <span style={LBL}>TYPE</span>
              <select data-testid={`${testId}-type`} aria-label="Order type" value={type}
                onChange={e=>setType(e.target.value as OrderType)} style={SEL}>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
                <option value="stop_limit">Stop-Limit</option>
              </select>
              <span style={{fontSize:9,padding:'2px 6px',border:`1px solid ${typeColor(type)}`,
                color:typeColor(type),borderRadius:2}}>{type.toUpperCase()}</span>
            </div>
            {/* Quantity */}
            <div style={FLD}>
              <span style={LBL}>QTY</span>
              <input data-testid={`${testId}-quantity`} type="number" value={quantity}
                onChange={e=>setQuantity(parseInt(e.target.value)||0)}
                style={INP}/>
            </div>
            {/* Limit Price */}
            {type==='limit'&&(
              <div style={FLD}>
                <span style={LBL}>LIMIT $</span>
                <input data-testid={`${testId}-limit-price`} type="number" step="0.01" value={limitPrice}
                  onChange={e=>setLimitPrice(parseFloat(e.target.value)||0)} style={INP}/>
              </div>
            )}
            {/* Stop Price */}
            {(type==='stop'||type==='stop_limit')&&(
              <div style={FLD}>
                <span style={LBL}>STOP $</span>
                <input data-testid={`${testId}-stop-price`} type="number" step="0.01" value={stopPrice}
                  onChange={e=>setStopPrice(parseFloat(e.target.value)||0)} style={INP}/>
              </div>
            )}
            {/* Limit Price for Stop-Limit */}
            {type==='stop_limit'&&(
              <div style={FLD}>
                <span style={LBL}>LIMIT $</span>
                <input data-testid={`${testId}-stop-limit-price`} type="number" step="0.01" value={stopLimitPrice}
                  onChange={e=>setStopLimitPrice(parseFloat(e.target.value)||0)} style={INP}/>
              </div>
            )}
            {/* TIF */}
            <div style={FLD}>
              <span style={LBL}>TIF</span>
              <select data-testid={`${testId}-tif`} aria-label="Time in force" value={tif}
                onChange={e=>setTif(e.target.value as OrderTIF)} style={SEL}>
                <option value="day">DAY</option>
                <option value="gtc">GTC</option>
                <option value="ioc">IOC</option>
                <option value="fok">FOK</option>
              </select>
            </div>
            {/* Cost Estimate */}
            {type!=='market'&&((type==='limit'?limitPrice:type==='stop_limit'?stopLimitPrice:stopPrice)||0)>0&&quantity>0&&(
              <div style={{padding:'6px 10px',marginBottom:8,background:BG,border:`1px solid ${BORDER}`,borderRadius:2}}>
                <div style={{fontSize:9,color:SUBTLE,marginBottom:2}}>EST. COST</div>
                <div style={{fontSize:13,color:TEXT,fontFamily:MONO,fontWeight:700}}>
                  ${(((type==='limit'?limitPrice:type==='stop_limit'?stopLimitPrice:stopPrice)||0)*quantity).toLocaleString('en-US',{minimumFractionDigits:2})}
                </div>
              </div>
            )}
            {/* Preview Button */}
            <button data-testid={`${testId}-preview-btn`} onClick={handlePreview}
              style={{width:'100%',marginTop:8,padding:'8px 0',fontFamily:MONO,fontSize:11,
                letterSpacing:'0.08em',cursor:'pointer',border:`1px solid ${AMBER}`,
                background:`${AMBER}22`,color:AMBER,borderRadius:2,fontWeight:700}}>
              PREVIEW ORDER
            </button>
          </div>
        ):(
          /* Preview confirmation */
          <div data-testid={`${testId}-preview`}>
            <div style={{padding:'10px 12px',background:BG,border:`1px solid ${BORDER}`,borderRadius:2,marginBottom:10}}>
              <div style={{fontSize:9,color:SUBTLE,marginBottom:6,letterSpacing:'0.1em'}}>ORDER PREVIEW</div>
              {[
                ['ID',preview.id||'â€”',SUBTLE],
                ['SYMBOL',preview.symbol,BLUE],
                ['ACTION',`${preview.side.toUpperCase()} ${preview.quantity} ${preview.symbol}`,sideColor(preview.side)],
                ['TYPE',preview.type.toUpperCase(),typeColor(preview.type)],
                ...(preview.limitPrice?[['LIMIT',`$${preview.limitPrice.toFixed(2)}`,AMBER]]:[] as [string,string,string][]),
                ...(preview.stopPrice?[['STOP',`$${preview.stopPrice.toFixed(2)}`,RED]]:[] as [string,string,string][]),
                ['TIF',preview.tif.toUpperCase(),TEXT],
              ].map(([k,v,c])=>(
                <div key={k as string} style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:10,color:SUBTLE}}>{k}</span>
                  <span style={{fontSize:11,color:c as string,fontFamily:MONO,fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <button data-testid={`${testId}-place-btn`} onClick={handlePlace}
                style={{flex:1,padding:'8px 0',fontFamily:MONO,fontSize:11,letterSpacing:'0.08em',
                  cursor:'pointer',border:`1px solid ${sideColor(side)}`,
                  background:`${sideColor(side)}33`,color:sideColor(side),borderRadius:2,fontWeight:700}}>
                PLACE ORDER â€” {preview.side.toUpperCase()}
              </button>
              <button data-testid={`${testId}-cancel-btn`} onClick={handleCancel}
                style={{padding:'8px 14px',fontFamily:MONO,fontSize:11,letterSpacing:'0.08em',
                  cursor:'pointer',border:`1px solid ${BORDER}`,background:BG,color:SUBTLE,borderRadius:2}}>
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

