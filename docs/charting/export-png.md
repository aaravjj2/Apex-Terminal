# Chart Export (PNG)

Export chart canvas to PNG.

## Canvas to Blob

```typescript
const canvas = document.getElementById('chart-main') as HTMLCanvasElement;
canvas.toBlob((blob) => {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chart-${symbol}-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}, 'image/png');
```

## Scaling for High DPI

```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
ctx.scale(dpr, dpr);
// ... render at logical size
// Export uses full resolution
```

## Include Drawings

Ensure all drawing layers are rendered to the same canvas or composited before export.
