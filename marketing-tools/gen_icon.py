"""Generate iOS-compatible PNG icon from the SVG owl icon."""
import subprocess, sys, os

# Use cairosvg if available, otherwise use a built-in fallback
svg_path = os.path.join(os.path.dirname(__file__), 'frontend', 'icon.svg')
png_path = os.path.join(os.path.dirname(__file__), 'frontend', 'icon-180.png')

try:
    import cairosvg
    cairosvg.svg2png(url=svg_path, output_width=180, output_height=180, write_to=png_path)
    print(f"✅ Generated {png_path} via cairosvg")
except ImportError:
    # Fallback: use PIL to draw a simple green owl icon
    from PIL import Image, ImageDraw
    
    size = 180
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Body (green circle)
    cx, cy = size//2, size//2
    body_r = 75
    draw.ellipse([cx-body_r, cy-body_r+5, cx+body_r, cy+body_r+5], fill=(34, 197, 94, 255))
    
    # Belly (lighter)
    belly_r = 42
    draw.ellipse([cx-belly_r, cy-belly_r+15, cx+belly_r, cy+belly_r+15], fill=(187, 247, 208, 255))
    
    # Eyes (white circles)
    eye_y = cy - 15
    eye_spacing = 28
    eye_r = 16
    draw.ellipse([cx-eye_spacing-eye_r, eye_y-eye_r, cx-eye_spacing+eye_r, eye_y+eye_r], fill=(255, 255, 255, 255))
    draw.ellipse([cx+eye_spacing-eye_r, eye_y-eye_r, cx+eye_spacing+eye_r, eye_y+eye_r], fill=(255, 255, 255, 255))
    
    # Pupils
    pupil_r = 7
    draw.ellipse([cx-eye_spacing-pupil_r, eye_y-pupil_r+2, cx-eye_spacing+pupil_r, eye_y+pupil_r+2], fill=(30, 30, 30, 255))
    draw.ellipse([cx+eye_spacing-pupil_r, eye_y-pupil_r+2, cx+eye_spacing+pupil_r, eye_y+pupil_r+2], fill=(30, 30, 30, 255))
    
    # Beak
    beak_points = [cx, cy+10, cx-10, cy+5, cx+10, cy+5]
    draw.polygon(beak_points, fill=(251, 191, 36, 255))
    
    # Feet (orange)
    foot_y = cy + 68
    foot_w = 20
    foot_h = 8
    draw.ellipse([cx-35-foot_w//2, foot_y-foot_h//2, cx-35+foot_w//2, foot_y+foot_h//2], fill=(251, 146, 60, 255))
    draw.ellipse([cx+35-foot_w//2, foot_y-foot_h//2, cx+35+foot_w//2, foot_y+foot_h//2], fill=(251, 146, 60, 255))
    
    # Mortarboard (graduation cap)
    cap_y = cy - 72
    # Cap top (square)
    cap_top_w = 60
    cap_top_h = 12
    draw.rectangle([cx-cap_top_w//2, cap_y-cap_top_h, cx+cap_top_w//2, cap_y], fill=(79, 70, 229, 255))
    # Cap bottom (trapezoid)
    cap_bot_w = 44
    cap_bot_h = 12
    draw.polygon([cx-cap_bot_w//2, cap_y, cx+cap_bot_w//2, cap_y,
                   cx+cap_bot_w//3, cap_y+cap_bot_h, cx-cap_bot_w//3, cap_y+cap_bot_h],
                  fill=(67, 56, 202, 255))
    # Tassel
    tassel_start = (cx+cap_top_w//2-2, cap_y - 2)
    tassel_end = (cx+cap_top_w//2+18, cap_y + 20)
    draw.line([tassel_start, tassel_end], fill=(234, 179, 8, 255), width=3)
    
    img.save(png_path, 'PNG')
    print(f"✅ Generated {png_path} via PIL fallback")

# Also generate a 512x512 version for the manifest
png_512 = os.path.join(os.path.dirname(__file__), 'frontend', 'icon-512.png')
try:
    import cairosvg
    cairosvg.svg2png(url=svg_path, output_width=512, output_height=512, write_to=png_512)
except ImportError:
    img_512 = img.resize((512, 512), Image.LANCZOS)
    img_512.save(png_512, 'PNG')
print(f"✅ Generated {png_512}")
