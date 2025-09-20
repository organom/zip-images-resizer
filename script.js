class ImageCompressor {
    constructor() {
        this.maxSizeMB = 2.5;
        this.originalZip = null;
        this.compressedZip = null;
        this.imageFiles = [];
        this.totalImages = 0;
        this.processedImages = 0;
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const maxSizeInput = document.getElementById('maxSize');
        const downloadBtn = document.getElementById('downloadBtn');
        const newFileBtn = document.getElementById('newFileBtn');

        // File upload events
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Settings
        maxSizeInput.addEventListener('change', (e) => {
            this.maxSizeMB = parseFloat(e.target.value);
        });

        // Action buttons
        downloadBtn.addEventListener('click', this.downloadCompressedZip.bind(this));
        newFileBtn.addEventListener('click', this.resetApplication.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('uploadArea').classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    async processFile(file) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            this.showError('Please select a ZIP file.');
            return;
        }

        try {
            this.showProcessingSection();
            this.updateProgress('Loading ZIP file...', 0);
            
            // Load the ZIP file
            const arrayBuffer = await file.arrayBuffer();
            this.originalZip = await JSZip.loadAsync(arrayBuffer);
            
            // Extract image files
            await this.extractImageFiles();
            
            if (this.imageFiles.length === 0) {
                this.showError('No image files found in the ZIP archive.');
                return;
            }

            // Update file info
            this.updateFileInfo(file.name, file.size);
            
            // Start compression process
            await this.compressImages();
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError('Error processing the ZIP file. Please try again.');
        }
    }

    async extractImageFiles() {
        this.imageFiles = [];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const customIgnore = ['__MACOSX' ];
        
        for (const [filename, zipEntry] of Object.entries(this.originalZip.files)) {
            if (!zipEntry.dir) {
                // Skip macOS metadata files and other system files
                if (customIgnore.includes(filename) || filename.startsWith('.')) {
                    continue;
                }
                
                const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
                if (imageExtensions.includes(extension)) {
                    try {
                        const arrayBuffer = await zipEntry.async('arraybuffer');
                        this.imageFiles.push({
                            name: filename,
                            originalData: arrayBuffer,
                            extension: extension,
                            originalSize: arrayBuffer.byteLength
                        });
                    } catch (error) {
                        console.warn(`Failed to extract ${filename}:`, error);
                    }
                }
            }
        }
        
        this.totalImages = this.imageFiles.length;
        this.updateStats();
    }

    async compressImages() {
        this.updateProgress('Analyzing images...', 5);
        
        // Calculate target size per image
        const targetZipSizeBytes = this.maxSizeMB * 1024 * 1024;
        const overhead = 0.15; // 15% overhead for ZIP structure
        const targetTotalImageSize = targetZipSizeBytes * (1 - overhead);
        
        // Calculate initial compression ratio
        const currentTotalSize = this.imageFiles.reduce((sum, img) => sum + img.originalSize, 0);
        let compressionRatio = targetTotalImageSize / currentTotalSize;
        
        console.log(`Original total size: ${(currentTotalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Target total size: ${(targetTotalImageSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Initial compression ratio: ${compressionRatio.toFixed(3)}`);
        
        // Start with initial compression
        let currentIteration = 0;
        const maxIterations = 8;
        let currentZipSize = 0;
        let bestZip = null;
        let bestSize = Infinity;
        
        while (currentIteration < maxIterations) {
            this.updateProgress(`Compression iteration ${currentIteration + 1}/${maxIterations}...`, 10 + (currentIteration * 70 / maxIterations));
            
            // Adjust compression ratio for this iteration
            let iterationRatio = compressionRatio;
            if (currentIteration > 0) {
                // If we're over target, compress more aggressively
                if (currentZipSize > targetZipSizeBytes) {
                    iterationRatio *= 0.85; // Reduce by 15%
                } else if (currentZipSize < targetZipSizeBytes * 0.8) {
                    // If we're way under target, compress less
                    iterationRatio *= 1.1; // Increase by 10%
                }
            }
            
            // Ensure minimum quality
            iterationRatio = Math.max(iterationRatio, 0.05);
            
            console.log(`Iteration ${currentIteration + 1}: Using ratio ${iterationRatio.toFixed(3)}`);
            
            // Compress all images
            const compressedImages = [];
            this.processedImages = 0;
            
            for (let i = 0; i < this.imageFiles.length; i++) {
                const imageFile = this.imageFiles[i];
                
                try {
                    const compressedData = await this.compressImage(imageFile, iterationRatio);
                    compressedImages.push({
                        name: imageFile.name,
                        data: compressedData
                    });
                    
                    this.processedImages++;
                    this.updateStats();
                    
                    // Update progress within iteration
                    const iterationProgress = (this.processedImages / this.totalImages) * (70 / maxIterations);
                    this.updateProgress(`Processing ${imageFile.name.substring(0, 30)}...`, 
                        10 + (currentIteration * 70 / maxIterations) + iterationProgress);
                        
                } catch (error) {
                    console.error(`Failed to compress ${imageFile.name}:`, error);
                    // Use original data if compression fails
                    compressedImages.push({
                        name: imageFile.name,
                        data: new Blob([imageFile.originalData])
                    });
                    this.processedImages++;
                }
            }
            
            // Create ZIP and check size
            const testZip = new JSZip();
            for (const img of compressedImages) {
                testZip.file(img.name, img.data);
            }
            
            try {
                const zipBlob = await testZip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 6 }
                });
                currentZipSize = zipBlob.size;
                
                console.log(`Iteration ${currentIteration + 1}: ZIP size ${(currentZipSize / 1024 / 1024).toFixed(2)} MB`);
                
                // Keep track of the best result
                if (currentZipSize <= targetZipSizeBytes && currentZipSize < bestSize) {
                    bestZip = testZip;
                    bestSize = currentZipSize;
                }
                
                // Check if we've reached acceptable target size
                if (currentZipSize <= targetZipSizeBytes && currentZipSize >= targetZipSizeBytes * 0.8) {
                    this.compressedZip = testZip;
                    break;
                }
                
                // If this is the last iteration, use the best result we have
                if (currentIteration === maxIterations - 1) {
                    this.compressedZip = bestZip || testZip;
                    break;
                }
                
                // Adjust compression ratio for next iteration
                if (currentZipSize > targetZipSizeBytes) {
                    compressionRatio *= 0.8; // More aggressive compression
                } else {
                    compressionRatio *= 1.05; // Less compression
                }
                
            } catch (error) {
                console.error(`Failed to generate ZIP in iteration ${currentIteration + 1}:`, error);
                if (currentIteration === maxIterations - 1) {
                    throw error;
                }
            }
            
            currentIteration++;
        }
        
        this.updateProgress('Finalizing...', 90);
        
        // Generate final ZIP
        if (!this.compressedZip) {
            throw new Error('Failed to create compressed ZIP');
        }
        
        const finalBlob = await this.compressedZip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });
        this.finalZipBlob = finalBlob;
        
        console.log(`Final ZIP size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);
        
        this.updateProgress('Complete!', 100);
        this.showResultSection(finalBlob.size);
    }

    calculateCompressionRatio(iteration, targetTotalSize) {
        // Calculate current total size
        const currentTotalSize = this.imageFiles.reduce((sum, img) => sum + img.originalSize, 0);
        
        // Base compression ratio
        let ratio = targetTotalSize / currentTotalSize;
        
        // Apply progressive compression
        const progressiveFactor = Math.pow(0.8, iteration);
        ratio *= progressiveFactor;
        
        // Ensure minimum quality
        return Math.max(ratio, 0.1);
    }

    async compressImage(imageFile, compressionRatio) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            let timeoutId;
            
            // Set a timeout to prevent hanging
            timeoutId = setTimeout(() => {
                console.warn(`Timeout processing ${imageFile.name}, using fallback compression`);
                // Create a simple fallback blob
                const fallbackBlob = new Blob([imageFile.originalData]);
                resolve(fallbackBlob);
            }, 10000); // 10 second timeout
            
            img.onload = () => {
                try {
                    clearTimeout(timeoutId);
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calculate new dimensions with minimum size constraints
                    const scaleFactor = Math.sqrt(Math.max(compressionRatio, 0.05));
                    const minWidth = 50;
                    const minHeight = 50;
                    const maxWidth = 2048; // Limit maximum width to prevent memory issues
                    const maxHeight = 2048;
                    
                    let newWidth = Math.max(minWidth, Math.floor(img.width * scaleFactor));
                    let newHeight = Math.max(minHeight, Math.floor(img.height * scaleFactor));
                    
                    // Ensure we don't exceed maximum dimensions
                    if (newWidth > maxWidth || newHeight > maxHeight) {
                        const aspectRatio = img.width / img.height;
                        if (aspectRatio > 1) {
                            newWidth = Math.min(newWidth, maxWidth);
                            newHeight = Math.floor(newWidth / aspectRatio);
                        } else {
                            newHeight = Math.min(newHeight, maxHeight);
                            newWidth = Math.floor(newHeight * aspectRatio);
                        }
                    }
                    
                    canvas.width = newWidth;
                    canvas.height = newHeight;
                    
                    // Use high-quality scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Draw resized image
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to blob with quality adjustment
                    const quality = Math.max(0.1, Math.min(0.95, compressionRatio * 1.2));
                    
                    if (imageFile.extension === '.png') {
                        // For PNG, we can only resize, not adjust quality
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                console.warn(`Failed to create PNG blob for ${imageFile.name}, using original`);
                                resolve(new Blob([imageFile.originalData]));
                            }
                        }, 'image/png');
                    } else {
                        // For JPEG and other formats, adjust quality
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                console.warn(`Failed to create JPEG blob for ${imageFile.name}, using original`);
                                resolve(new Blob([imageFile.originalData]));
                            }
                        }, 'image/jpeg', quality);
                    }
                } catch (error) {
                    clearTimeout(timeoutId);
                    console.error(`Error processing ${imageFile.name}:`, error);
                    // Fallback to original data
                    resolve(new Blob([imageFile.originalData]));
                }
            };
            
            img.onerror = () => {
                clearTimeout(timeoutId);
                console.error(`Failed to load image: ${imageFile.name}`);
                // Fallback to original data
                resolve(new Blob([imageFile.originalData]));
            };
            
            // Create blob URL from array buffer
            try {
                const blob = new Blob([imageFile.originalData]);
                img.src = URL.createObjectURL(blob);
                
                // Clean up the blob URL after processing
                img.onload = (originalOnload => function() {
                    URL.revokeObjectURL(img.src);
                    return originalOnload.apply(this, arguments);
                })(img.onload);
                
                img.onerror = (originalOnerror => function() {
                    URL.revokeObjectURL(img.src);
                    return originalOnerror.apply(this, arguments);
                })(img.onerror);
                
            } catch (error) {
                clearTimeout(timeoutId);
                console.error(`Error creating blob URL for ${imageFile.name}:`, error);
                resolve(new Blob([imageFile.originalData]));
            }
        });
    }

    updateProgress(text, percent) {
        document.getElementById('progressText').textContent = text;
        document.getElementById('progressPercent').textContent = `${Math.round(percent)}%`;
        document.getElementById('progressFill').style.width = `${percent}%`;
    }

    updateFileInfo(fileName, fileSize) {
        document.getElementById('fileName').textContent = fileName;
        document.getElementById('fileSize').textContent = this.formatFileSize(fileSize);
    }

    updateStats() {
        const originalSize = this.imageFiles.reduce((sum, img) => sum + img.originalSize, 0);
        document.getElementById('originalSize').textContent = this.formatFileSize(originalSize);
        document.getElementById('imagesProcessed').textContent = `${this.processedImages}/${this.totalImages}`;
        
        if (this.finalZipBlob) {
            document.getElementById('compressedSize').textContent = this.formatFileSize(this.finalZipBlob.size);
            const ratio = ((originalSize - this.finalZipBlob.size) / originalSize * 100).toFixed(1);
            document.getElementById('compressionRatio').textContent = `${ratio}%`;
        }
    }

    showProcessingSection() {
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('processingSection').style.display = 'block';
        document.getElementById('resultSection').style.display = 'none';
    }

    showResultSection(finalSize) {
        const originalSize = this.imageFiles.reduce((sum, img) => sum + img.originalSize, 0);
        const spaceSaved = originalSize - finalSize;
        const savingsPercent = ((spaceSaved / originalSize) * 100).toFixed(1);
        
        document.getElementById('finalSize').textContent = this.formatFileSize(finalSize);
        document.getElementById('spaceSaved').textContent = `${this.formatFileSize(spaceSaved)} (${savingsPercent}%)`;
        
        document.getElementById('processingSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'block';
    }

    downloadCompressedZip() {
        if (this.finalZipBlob) {
            const url = URL.createObjectURL(this.finalZipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'compressed_images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    resetApplication() {
        this.originalZip = null;
        this.compressedZip = null;
        this.finalZipBlob = null;
        this.imageFiles = [];
        this.totalImages = 0;
        this.processedImages = 0;
        
        document.getElementById('fileInput').value = '';
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('processingSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'none';
    }

    showError(message) {
        console.error('Error:', message);
        alert(message);
        this.resetApplication();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ImageCompressor();
});

// Add some utility functions for better user experience
window.addEventListener('beforeunload', (e) => {
    const processingSection = document.getElementById('processingSection');
    if (processingSection && processingSection.style.display !== 'none') {
        e.preventDefault();
        e.returnValue = 'Image compression is in progress. Are you sure you want to leave?';
    }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'o':
                e.preventDefault();
                document.getElementById('fileInput').click();
                break;
            case 's':
                e.preventDefault();
                const downloadBtn = document.getElementById('downloadBtn');
                if (downloadBtn.style.display !== 'none') {
                    downloadBtn.click();
                }
                break;
        }
    }
});

