# Integrating Figma UI Kit into Munyard Mixer

## Step 1: Export Assets from Figma

### For Icons/Graphics:
1. Select the component in Figma
2. Right-click → **Export** → Choose format:
   - **SVG** for icons/graphics (best quality, scalable)
   - **PNG** for complex graphics (at 2x or 3x resolution)
3. Save to `/public/ui-kit/` folder

### For Images/Textures:
- Export as PNG at appropriate resolution
- Save to `/public/ui-kit/images/`

## Step 2: Extract Design Tokens

### Colors:
1. In Figma, select elements with colors
2. Note the hex codes from the right panel
3. Add to `app/globals.css` or create a new design tokens file

### Typography:
1. Note font family, size, weight, line-height
2. Extract CSS values from Figma's text properties

### Spacing:
1. Use Figma's spacing measurements
2. Document padding, margins, gaps

## Step 3: Create React Components

For each component in your Figma UI kit:

1. Create a new file in `app/components/ui-kit/`
2. Extract dimensions, colors, and styles from Figma
3. Convert to React component with props

## Step 4: Use Figma Plugins (Recommended)

### Helpful Figma Plugins:
- **Figma to React** - Auto-generates React code
- **Figma to CSS** - Extracts CSS
- **Design Tokens** - Exports design tokens as JSON
- **Copy CSS** - Quick CSS extraction
- **Figma to Code** - Multiple export formats

## Step 5: Manual Component Creation

For complex components like knobs, buttons, toggles:

1. **Measure in Figma**: Use the design panel to get exact dimensions
2. **Extract Styles**: 
   - Border radius
   - Shadows
   - Gradients
   - Opacity
3. **Recreate in React**: Use inline styles or CSS classes

## Example: Converting a Figma Button to React

```
Figma Specs:
- Width: 120px
- Height: 40px
- Background: #B8001F
- Border: 2px solid #000000
- Border radius: 4px
- Shadow: inset -1px -1px 0 #000
```

```tsx
// app/components/ui-kit/MetalButton.tsx
export default function MetalButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '120px',
        height: '40px',
        backgroundColor: '#B8001F',
        border: '2px solid #000000',
        borderRadius: '4px',
        boxShadow: 'inset -1px -1px 0 #000',
        cursor: 'pointer',
        fontFamily: 'monospace',
      }}
    >
      {children}
    </button>
  )
}
```

## Recommended Folder Structure

```
app/
  components/
    ui-kit/
      buttons/
        MetalButton.tsx
      knobs/
        MetalKnob.tsx
      toggles/
        MetalToggle.tsx
      sliders/
        MetalSlider.tsx
      shared/
        styles.ts  // Shared styles
        tokens.ts  // Design tokens

public/
  ui-kit/
    icons/
    images/
    fonts/
```

## Quick Start Workflow

1. **Export assets** → Save to `/public/ui-kit/`
2. **Create component file** → `app/components/ui-kit/[ComponentName].tsx`
3. **Extract styles** → Copy from Figma design panel
4. **Build component** → Recreate with React + styles
5. **Import and use** → Import into your pages

## Tips

- **Use SVG for icons** - Better quality, scalable, smaller file size
- **Match exact dimensions** - Pixel-perfect recreation
- **Extract colors as CSS variables** - Easier to maintain
- **Test on mobile** - Your app has mobile considerations
- **Use Figma dev mode** - Shows CSS, dimensions, spacing

## Automation Tools

- **Figma API** - Programmatic access to designs
- **Design Tokens** - Export as JSON for code generation
- **Style Dictionary** - Convert design tokens to code

