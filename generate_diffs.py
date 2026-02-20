"""
Generate DIFF images between BEFORE and AFTER screenshots.
Shows pixel differences highlighted in a visual format.
"""
import os
import sys

BEFORE_DIR = "artifacts/proof/v1-53-54-uiux/screenshots_before"
AFTER_DIR = "artifacts/proof/v1-53-54-uiux/screenshots_after"
DIFF_DIR = "artifacts/proof/v1-53-54-uiux/screenshots_diff"

os.makedirs(DIFF_DIR, exist_ok=True)

# Map BEFORE to AFTER by view name (extract view component from filename)
before_files = sorted(f for f in os.listdir(BEFORE_DIR) if f.endswith('.png'))
after_files = sorted(f for f in os.listdir(AFTER_DIR) if f.endswith('.png'))

print(f"BEFORE: {len(before_files)} files")
print(f"AFTER:  {len(after_files)} files")

# Extract view names from filenames
def extract_view_name(filename):
    """Extract the view/panel name from filename like 001-001-dashboard-home.png"""
    parts = filename.replace('.png', '').split('-')
    # Skip numeric prefixes and join the rest
    view_parts = [p for p in parts if not p.isdigit()]
    return '-'.join(view_parts)

# Try to match files by similar view names
before_views = {extract_view_name(f): f for f in before_files}
after_views = {extract_view_name(f): f for f in after_files}

# Find common views
common_views = set(before_views.keys()) & set(after_views.keys())
print(f"Common views: {len(common_views)}")

# If not enough common views, try positional matching (pair by index)
if len(common_views) < 20:
    print("Using positional matching (pairing by index)...")
    pairs = list(zip(before_files[:min(len(before_files), len(after_files))], 
                     after_files[:min(len(before_files), len(after_files))]))
else:
    pairs = [(before_views[v], after_views[v]) for v in sorted(common_views)]

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageFilter
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

diff_count = 0

if HAS_PIL:
    for i, (bf, af) in enumerate(pairs):
        try:
            before_img = Image.open(os.path.join(BEFORE_DIR, bf)).convert('RGB')
            after_img = Image.open(os.path.join(AFTER_DIR, af)).convert('RGB')
            
            # Resize to same dimensions if needed
            w = max(before_img.width, after_img.width)
            h = max(before_img.height, after_img.height)
            before_img = before_img.resize((w, h), Image.LANCZOS)
            after_img = after_img.resize((w, h), Image.LANCZOS)
            
            # Create side-by-side comparison with DIFF
            diff_img = ImageChops.difference(before_img, after_img)
            
            # Enhance the diff for visibility
            # Amplify differences
            from PIL import ImageEnhance
            enhancer = ImageEnhance.Contrast(diff_img)
            diff_enhanced = enhancer.enhance(5.0)
            enhancer2 = ImageEnhance.Brightness(diff_enhanced)
            diff_enhanced = enhancer2.enhance(3.0)
            
            # Create triptych: BEFORE | AFTER | DIFF
            canvas_w = w * 3 + 4  # 2px gaps
            canvas_h = h + 30  # header space
            canvas = Image.new('RGB', (canvas_w, canvas_h), (10, 10, 14))
            
            # Add headers
            draw = ImageDraw.Draw(canvas)
            try:
                font = ImageFont.truetype("arial.ttf", 14)
            except:
                font = ImageFont.load_default()
            
            draw.text((10, 8), f"BEFORE", fill=(180, 180, 180), font=font)
            draw.text((w + 12, 8), f"AFTER", fill=(100, 200, 255), font=font)
            draw.text((w * 2 + 14, 8), f"DIFF (enhanced)", fill=(255, 100, 100), font=font)
            
            # Paste images
            canvas.paste(before_img, (0, 30))
            canvas.paste(after_img, (w + 2, 30))
            canvas.paste(diff_enhanced, (w * 2 + 4, 30))
            
            view_name = extract_view_name(af)
            diff_filename = f"{str(i+1).zfill(3)}-diff-{view_name}.png"
            canvas.save(os.path.join(DIFF_DIR, diff_filename), quality=95)
            diff_count += 1
            print(f"  DIFF {diff_count}: {diff_filename}")
        except Exception as e:
            print(f"  SKIP {bf} vs {af}: {e}")
else:
    # Simple file-size comparison if PIL not available
    for i, (bf, af) in enumerate(pairs):
        before_size = os.path.getsize(os.path.join(BEFORE_DIR, bf))
        after_size = os.path.getsize(os.path.join(AFTER_DIR, af))
        diff_pct = abs(before_size - after_size) / max(before_size, 1) * 100
        view_name = extract_view_name(af)
        
        # Create a simple text-based diff report
        with open(os.path.join(DIFF_DIR, f"{str(i+1).zfill(3)}-diff-{view_name}.txt"), 'w') as f:
            f.write(f"BEFORE: {bf} ({before_size:,} bytes)\n")
            f.write(f"AFTER:  {af} ({after_size:,} bytes)\n")
            f.write(f"SIZE DIFF: {diff_pct:.1f}%\n")
            f.write(f"Files differ: {'YES' if before_size != after_size else 'NO'}\n")
        diff_count += 1
        tag = "CHANGED" if before_size != after_size else "SAME"
        print(f"  DIFF {diff_count}: {view_name} [{tag}] {diff_pct:.1f}% size diff")

print(f"\nTotal DIFFs generated: {diff_count}")
