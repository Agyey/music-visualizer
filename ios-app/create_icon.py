#!/usr/bin/env python3
"""
Generate app icon images for Music Visualizer iOS app
Creates all required sizes from a base 1024x1024 design
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

def create_app_icon(size):
    """Create a music visualizer themed app icon"""
    img = Image.new('RGB', (size, size), color='#050608')
    draw = ImageDraw.Draw(img)
    
    center = size // 2
    radius = size * 0.35
    
    # Create gradient background (dark purple to black)
    for y in range(size):
        for x in range(size):
            dist = math.sqrt((x - center)**2 + (y - center)**2)
            if dist < radius * 1.5:
                intensity = max(0, 1 - dist / (radius * 1.5))
                r = int(5 + intensity * 20)
                g = int(6 + intensity * 15)
                b = int(10 + intensity * 30)
                img.putpixel((x, y), (r, g, b))
    
    # Draw audio waveform visualization
    num_bars = 12
    bar_width = size // (num_bars * 2)
    bar_spacing = size // num_bars
    
    for i in range(num_bars):
        x = center - (num_bars // 2) * bar_spacing + i * bar_spacing
        # Varying bar heights for visual interest
        height = radius * (0.3 + 0.7 * abs(math.sin(i * math.pi / num_bars)))
        
        # Draw bar with glow effect
        y_top = int(center - height // 2)
        y_bottom = int(center + height // 2)
        x_pos = int(x)
        bar_w = int(bar_width)
        
        # Bar color (neon cyan/purple)
        hue = (i / num_bars) * 360
        if i % 2 == 0:
            color = (100, 200, 255)  # Cyan
        else:
            color = (200, 100, 255)  # Purple
        
        # Draw main bar
        draw.rectangle([x_pos - bar_w//2, y_top, x_pos + bar_w//2, y_bottom], 
                      fill=color, outline=None)
        
        # Add glow
        glow_size = int(bar_w * 2)
        glow_height = int(height + glow_size)
        glow_img = Image.new('RGBA', (glow_size, glow_height), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_img)
        glow_draw.rectangle([glow_size//2 - bar_w//2, glow_size//2, 
                           glow_size//2 + bar_w//2, glow_size//2 + int(height)],
                          fill=color + (180,))
        glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=max(1, bar_w)))
        img.paste(glow_img, (x_pos - glow_size//2, y_top - glow_size//2), glow_img)
    
    # Add center circle (music note symbol simplified)
    circle_radius = size * 0.08
    draw.ellipse([center - circle_radius, center - circle_radius,
                  center + circle_radius, center + circle_radius],
                 fill=(255, 255, 255), outline=None)
    
    return img

def generate_all_icons():
    """Generate all required icon sizes"""
    sizes = {
        # iPhone
        'Icon-20@2x.png': 40,
        'Icon-20@3x.png': 60,
        'Icon-29@2x.png': 58,
        'Icon-29@3x.png': 87,
        'Icon-40@2x.png': 80,
        'Icon-40@3x.png': 120,
        'Icon-60@2x.png': 120,
        'Icon-60@3x.png': 180,
        # iPad
        'Icon-20.png': 20,
        'Icon-20@2x.png': 40,
        'Icon-29.png': 29,
        'Icon-29@2x.png': 58,
        'Icon-40.png': 40,
        'Icon-40@2x.png': 80,
        'Icon-76@2x.png': 152,
        'Icon-83.5@2x.png': 167,
        # App Store
        'Icon-1024.png': 1024
    }
    
    output_dir = 'MusicVisualizer/Assets.xcassets/AppIcon.appiconset'
    os.makedirs(output_dir, exist_ok=True)
    
    for filename, size in sizes.items():
        print(f"Generating {filename} ({size}x{size})...")
        icon = create_app_icon(size)
        icon.save(os.path.join(output_dir, filename), 'PNG')
        print(f"  ✓ Saved {filename}")
    
    print(f"\n✅ Generated {len(sizes)} icon files in {output_dir}")

if __name__ == '__main__':
    generate_all_icons()

