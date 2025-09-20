# Image Compressor

A modern, client-side image compression tool that allows users to upload ZIP files containing images and compress them to a target size while maintaining proportions and file formats.

Initial commit generated in Manus (https://manus.ai) and improved upon

## 🌟 Features

- **Client-side Processing**: All compression happens in your browser - no server uploads required
- **ZIP File Support**: Upload ZIP files containing multiple images
- **Smart Compression**: Automatically adjusts image dimensions to meet target file size
- **Format Preservation**: Maintains original file formats (JPEG, PNG, GIF, BMP, WebP)
- **Modern UI**: Clean, responsive design with smooth animations
- **Real-time Progress**: Live progress tracking and compression statistics
- **Mobile Friendly**: Fully responsive design that works on all devices

## 🚀 Live Demo

The application is deployed and available at: **https://muiwvwct.manus.space**

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**: 
  - JSZip for ZIP file handling
  - Canvas API for image compression
  - Font Awesome for icons
  - Google Fonts (Inter)
- **Hosting**: Static hosting compatible with GitHub Pages

## 📋 How It Works

1. **Upload**: Drag and drop or click to select a ZIP file containing images
2. **Configure**: Set your target ZIP file size (default: 2.5 MB)
3. **Process**: The tool analyzes images and applies progressive compression
4. **Download**: Get your compressed ZIP file with optimized images

## 🔧 Technical Details

### Compression Algorithm

The tool uses a sophisticated multi-pass compression approach:

1. **Analysis Phase**: Extracts and analyzes all images from the ZIP file
2. **Target Calculation**: Determines optimal compression ratio based on target size
3. **Progressive Compression**: Applies iterative compression with quality adjustments
4. **Dimension Scaling**: Reduces image dimensions while maintaining aspect ratios
5. **Quality Optimization**: Adjusts JPEG quality and PNG optimization
6. **Final Assembly**: Creates new ZIP file with compressed images

### Supported Formats

- **Input**: ZIP files containing images
- **Image Formats**: JPEG, PNG, GIF, BMP, WebP
- **Output**: ZIP file with compressed images in original formats

## 🎨 Design Features

- **Modern Gradient Design**: Beautiful purple gradient header and accents
- **Smooth Animations**: Floating icons, progress bars with shimmer effects
- **Hover Effects**: Interactive elements with smooth transitions
- **Responsive Layout**: Adapts to desktop, tablet, and mobile screens
- **Accessibility**: Keyboard shortcuts and screen reader friendly

## ⌨️ Keyboard Shortcuts

- `Ctrl/Cmd + O`: Open file dialog
- `Ctrl/Cmd + S`: Download compressed file (when available)

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

## 📁 Project Structure

```
image-compressor/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and animations
├── script.js           # JavaScript functionality
└── README.md           # This file
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

- JSZip library for ZIP file handling
- Font Awesome for beautiful icons
- Google Fonts for the Inter typeface
- Canvas API for image processing capabilities
- Manus (https://manus.ai) for initial project scaffolding

---

**Made with ❤️ for efficient image compression**

