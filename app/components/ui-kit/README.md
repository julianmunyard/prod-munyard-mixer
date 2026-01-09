# UI Kit Components

Components extracted from your Figma UI Kit design.

## How to Use Components from Figma

### Step 1: Open Figma Design
1. Open your Figma file
2. Select the component you want to use
3. Check the **Design** panel on the right

### Step 2: Extract Measurements
From the Design panel, note:
- **Width & Height** (under Size)
- **X & Y** position (if needed)
- **Border radius** (under Corner radius)
- **Border** (width and color)
- **Fill** (background color/gradient)
- **Effects** (shadows, blurs)

### Step 3: Update Component
1. Open the component file (e.g., `MetalButton.tsx`)
2. Find the style objects
3. Replace values with Figma measurements

### Example: Updating MetalButton

**From Figma:**
- Width: 150px
- Height: 45px  
- Background: #B8001F (red)
- Border: 3px solid #000000
- Border radius: 6px
- Shadow: 0px 4px 8px rgba(0,0,0,0.3)

**Update in MetalButton.tsx:**
```tsx
const baseStyle = {
  width: '150px',  // ← From Figma
  height: '45px',  // ← From Figma
  backgroundColor: '#B8001F',  // ← From Figma
  border: '3px solid #000000',  // ← From Figma
  borderRadius: '6px',  // ← From Figma
  boxShadow: '0px 4px 8px rgba(0,0,0,0.3)',  // ← From Figma
  // ... rest of styles
}
```

## Available Components

- **MetalButton** - Buttons with metal styling
- **MetalKnob** - Rotatable knobs for controls
- **MetalToggle** - 3-position toggle switches

## Exporting Assets from Figma

### Icons/Graphics:
1. Right-click component → Export
2. Choose SVG format
3. Save to `/public/ui-kit/icons/`
4. Import in component:
   ```tsx
   import Icon from '/ui-kit/icons/my-icon.svg'
   ```

### Images:
1. Export as PNG (2x or 3x for retina)
2. Save to `/public/ui-kit/images/`
3. Use in component:
   ```tsx
   <img src="/ui-kit/images/texture.png" alt="" />
   ```

## Tips

- **Use Figma Dev Mode** - Shows CSS code directly
- **Copy CSS from Figma** - Paste and adapt to React
- **Test on mobile** - Your app is mobile-focused
- **Match pixel-perfect** - Use exact Figma measurements
- **Extract colors** - Add to CSS variables for consistency

