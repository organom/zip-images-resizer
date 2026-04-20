# ZipToSize

A modern, client-side image compression tool that allows users to upload ZIP, RAR, 7z, TAR and other archives containing images and compress them to a target size while maintaining proportions.

Initial commit generated in Manus (https://manus.ai) and improved upon

## 🌟 Features

- **Client-side Processing**: All compression happens in your browser - no server uploads required
- **Multi-format Archive Support**: Upload ZIP, RAR, 7z, TAR, GZ, BZ2, XZ archives containing images
- **Smart Compression**: Iteratively adjusts image dimensions and quality to fit within the target ZIP size (converges to 80–100% of target); prioritizes larger files first
- **Format Preservation**: Maintains original file formats (JPEG, PNG, WebP). GIF and BMP are converted to PNG (Canvas API limitation)
- **Always outputs ZIP**: Output is always a standard ZIP file named `<original>-compressed.zip`
- **Modern UI**: Clean, responsive design with smooth animations
- **Real-time Progress**: Live progress tracking and compression statistics
- **Mobile Friendly**: Fully responsive design that works on all devices

## 🚀 Live Demo

The application is deployed and available at: **https://ricardo.heptasoft.com/zip-to-size/**

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**: 
  - JSZip for ZIP input and output
  - libarchive.js (WebAssembly) for reading RAR, 7z, TAR and other formats
  - Canvas API for image compression
  - Font Awesome for icons
  - Google Fonts (Inter)
- **Hosting**: Static hosting compatible with GitHub Pages

## 📋 How It Works

1. **Upload**: Drag and drop or click to select an archive (ZIP, RAR, 7z, TAR…) containing images
2. **Configure**: Set your target ZIP file size (default: 3.5 MB)
3. **Process**: The tool iteratively compresses images to converge on the target size
4. **Download**: Get your compressed ZIP file with optimized images

## 🔧 Technical Details

### Compression Algorithm

The tool uses an iterative convergence approach:

1. **Extraction**: Reads all images from the ZIP file and records their sizes
2. **Skip check**: If images already fit the target, re-zips at max compression and finishes immediately
3. **Initial ratio**: Calculates a starting compression ratio (`target size / total image size`)
4. **Iterative passes**: Each pass compresses every image — scaling dimensions by `sqrt(ratio)` and adjusting JPEG/WebP quality proportionally — with larger-than-average files receiving a more aggressive per-file ratio to equalize sizes first; then test-zips the result and checks its size
5. **Ratio adjustment**: If the result is over target, the ratio is reduced by 15%; if under, it is increased by 10%
6. **Convergence**: The loop stops when the result lands between 80–100% of target, or after 3 consecutive failed iterations
7. **Final assembly**: Re-zips the best result at maximum compression level

### Supported Formats

- **Archive input**: ZIP, RAR (v4/v5), 7z, TAR, GZ, BZ2, XZ and more (via libarchive WebAssembly)
- **Archive output**: always ZIP (`<original>-compressed.zip`)
- **Image formats (input)**: JPEG, PNG, GIF, BMP, WebP
- **Image formats (output)**: JPEG, PNG, WebP preserved as-is; GIF and BMP converted to PNG

## 🎨 Design Features

- **Modern Gradient Design**: Beautiful purple gradient header and accents
- **Smooth Animations**: Floating icons, progress bars with shimmer effects
- **Hover Effects**: Interactive elements with smooth transitions
- **Responsive Layout**: Adapts to desktop, tablet, and mobile screens
- **Accessibility**: Keyboard shortcuts for common actions

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + O`: Open file dialog
- `Ctrl/Cmd + S`: Download compressed file (only when the download button is visible)

## 🔒 Privacy & Security

- **100% Client-side**: No files are uploaded to any server
- **Local Processing**: All compression happens in your browser
- **No Data Collection**: No user data is stored or transmitted
- **Secure**: Works entirely offline after initial page load

## 📱 Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Mobile browsers with modern JavaScript support

## 🚀 Deployment

This is a static website that can be hosted on:

- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

Simply upload the files to your hosting provider - no server configuration required.

## 🧪 Testing

Install dependencies and run the test suite:

```bash
npm install
npm test
```

Other test commands:

```bash
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

The suite includes:
- **Unit tests** (`script.test.js`) — pure logic: formatting, path filtering, best-result selection, input validation, DOM state
- **Integration tests** (`compression.integration.test.js`) — full compression loop against a real ZIP, asserting the final size lands within 80–100% of the target

## 📁 Project Structure

```
zip-to-size/
├── index.html                          # Main HTML file
├── styles.css                          # CSS styles and animations
├── script.js                           # JavaScript functionality
├── libarchive.js                       # libarchive.js (local copy)
├── worker-bundle.js                    # libarchive WebWorker bundle (local copy)
├── libarchive.wasm                     # libarchive WebAssembly binary (local copy)
├── script.test.js                      # Unit tests (Vitest + jsdom)
├── compression.integration.test.js     # Integration tests
├── vitest.config.js                    # Vitest configuration
├── package.json                        # Node dependencies (dev/test only)
└── README.md                           # This file
```

## 🤝 Contributing

This project is designed to be simple and self-contained. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- JSZip library for ZIP output
- libarchive.js for multi-format archive reading (WebAssembly port of libarchive)
- Font Awesome for beautiful icons
- Google Fonts for the Inter typeface
- Canvas API for image processing capabilities
- Manus (https://manus.ai) for initial project scaffolding
- [Claude Code](https://claude.ai/code) for iterative improvements, test suite, and bug fixes

---

**Made with ❤️ for efficient image compression**

