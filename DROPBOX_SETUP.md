# Dropbox Integration Setup

This document explains how to set up Dropbox file picker integration for the create page.

## Current Status
The Dropbox file picker is implemented but shows a "Coming Soon" message. To enable full functionality, you need to set up a Dropbox app.

## Setup Instructions

### 1. Create a Dropbox App
1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access"
4. Choose "Full Dropbox" or "App folder" (recommended: App folder for security)
5. Give your app a name (e.g., "Munyard Mixer File Picker")
6. Click "Create app"

### 2. Configure App Settings
1. In your app dashboard, go to the "Permissions" tab
2. Enable the following permissions:
   - `files.metadata.read` - Read file metadata
   - `files.content.read` - Read file contents
3. Go to the "Settings" tab
4. Copy your "App key" - you'll need this

### 3. Update the Code
1. Open `app/components/DropboxFilePicker.tsx`
2. Replace `'YOUR_DROPBOX_APP_KEY'` with your actual app key
3. Uncomment the Dropbox integration code in the `handleDropboxClick` function

### 4. Example Implementation
```typescript
const handleDropboxClick = async () => {
  setIsLoading(true)
  setError(null)

  try {
    // Load Dropbox Chooser script
    const script = document.createElement('script')
    script.src = 'https://www.dropbox.com/static/api/2/dropins.js'
    script.setAttribute('data-app-key', 'YOUR_ACTUAL_APP_KEY_HERE')
    script.async = true

    await new Promise((resolve, reject) => {
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })

    // Initialize Dropbox Chooser
    const options = {
      success: (files: any[]) => {
        // Convert Dropbox files to File objects
        const filePromises = files.map(async (file) => {
          const response = await fetch(file.link)
          const blob = await response.blob()
          return new File([blob], file.name, { type: blob.type })
        })

        Promise.all(filePromises)
          .then((fileObjects) => {
            onFilesSelected(fileObjects)
            setIsLoading(false)
          })
          .catch((err) => {
            setError('Failed to download files from Dropbox')
            setIsLoading(false)
          })
      },
      cancel: () => {
        setIsLoading(false)
      },
      linkType: 'direct',
      multiselect: true,
      extensions: ['.mp3', '.wav'],
      folderselect: false,
    }

    // @ts-ignore - Dropbox global
    window.Dropbox.choose(options)
  } catch (err) {
    setError('Failed to load Dropbox picker')
    setIsLoading(false)
  }
}
```

## Security Considerations
- Never commit your Dropbox app key to version control
- Consider using environment variables for the app key
- The app key should be kept secure and not exposed in client-side code in production

## Testing
1. After setup, users will see a "Choose from Dropbox" button
2. Clicking it will open the Dropbox file picker
3. Users can select multiple audio files (.mp3, .wav)
4. Files will be downloaded and processed the same way as local files

## Troubleshooting
- Make sure your app has the correct permissions
- Check that the app key is correct
- Ensure the Dropbox script loads properly
- Check browser console for any errors

## Alternative: Use Dropbox API v2
For more advanced features, you could also implement using the Dropbox API v2 with OAuth authentication, but the Chooser API is simpler for basic file selection.
