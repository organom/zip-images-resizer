// Compression algorithm constants
const CONFIG = {
    ZIP_OVERHEAD_FACTOR: 0.15,
    MIN_COMPRESSION_RATIO: 0.05,
    QUALITY_MIN: 0.1,
    QUALITY_MAX: 95 / 100,
    QUALITY_MULTIPLIER: 1.2,
    MIN_DIMENSION: 50,
    MAX_DIMENSION: 2048,
    IMAGE_TIMEOUT_MS: 10000,
    // Convergence: if result is within this range of target, accept it
    ACCEPTABLE_LOW: 0.8,   // 80% of target
    ACCEPTABLE_HIGH: 1.0,  // 100% of target
    // Ratio adjustments per iteration
    RATIO_DECREASE: 0.85,  // compress more aggressively when over target
    RATIO_INCREASE: 1.1,   // compress less when far under target
    // ZIP compression levels
    ZIP_TEST_LEVEL: 6,
    ZIP_FINAL_LEVEL: 9,
};

// Map extensions to their correct MIME types for canvas export
const MIME_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    // GIF and BMP are not supported by canvas.toBlob — fall back to PNG
    '.gif': 'image/png',
    '.bmp': 'image/png',
};

const IMAGE_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

// Formats that support a quality parameter in canvas.toBlob
const QUALITY_FORMATS = new Set(['image/jpeg', 'image/webp']);

class ImageCompressor {
    originalZip = null;
    compressedZip = null;
    imageFiles = [];
    totalImages = 0;
    processedImages = 0;
    finalZipBlob = null;

    constructor() {
        this.el = {
            uploadArea: document.getElementById('uploadArea'),
            fileInput: document.getElementById('fileInput'),
            maxSize: document.getElementById('maxSize'),
            downloadBtn: document.getElementById('downloadBtn'),
            newFileBtn: document.getElementById('newFileBtn'),
            progressText: document.getElementById('progressText'),
            progressPercent: document.getElementById('progressPercent'),
            progressFill: document.getElementById('progressFill'),
            fileName: document.getElementById('fileName'),
            fileSize: document.getElementById('fileSize'),
            originalSize: document.getElementById('originalSize'),
            imagesProcessed: document.getElementById('imagesProcessed'),
            compressedSize: document.getElementById('compressedSize'),
            compressionRatio: document.getElementById('compressionRatio'),
            finalSize: document.getElementById('finalSize'),
            spaceSaved: document.getElementById('spaceSaved'),
            uploadSection: document.getElementById('uploadSection'),
            processingSection: document.getElementById('processingSection'),
            resultSection: document.getElementById('resultSection'),
        };
        this.maxSizeMB = Number.parseFloat(this.el.maxSize.value) || 2.5;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.el.uploadArea.addEventListener('click', () => this.el.fileInput.click());
        this.el.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.el.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.el.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        this.el.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        this.el.maxSize.addEventListener('change', (e) => {
            const val = Number.parseFloat(e.target.value);
            if (!Number.isNaN(val) && val >= 0.1 && val <= 50) {
                this.maxSizeMB = val;
            } else {
                e.target.value = this.maxSizeMB;
            }
        });

        this.el.downloadBtn.addEventListener('click', this.downloadCompressedZip.bind(this));
        this.el.newFileBtn.addEventListener('click', this.resetApplication.bind(this));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.el.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.el.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.el.uploadArea.classList.remove('dragover');
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
            this.showSection('processingSection');
            this.updateProgress('Loading ZIP file...', 0);

            const arrayBuffer = await file.arrayBuffer();
            this.originalZip = await JSZip.loadAsync(arrayBuffer);

            await this.extractImageFiles();

            if (this.imageFiles.length === 0) {
                this.showError('No image files found in the ZIP archive.');
                return;
            }

            this.updateFileInfo(file.name, file.size);
            await this.compressImages();
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError('Error processing the ZIP file. Please try again.');
        }
    }

    get totalOriginalSize() {
        return this.imageFiles.reduce((sum, img) => sum + img.originalSize, 0);
    }

    generateZipBlob(zip, level) {
        return zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level },
        });
    }

    showSection(name) {
        for (const section of ['uploadSection', 'processingSection', 'resultSection']) {
            this.el[section].style.display = section === name ? 'block' : 'none';
        }
    }

    isIgnoredPath(filename) {
        const parts = filename.split('/');
        return parts.some(part => part === '__MACOSX' || part.startsWith('.'));
    }

    async extractImageFiles() {
        this.imageFiles = [];

        for (const [filename, zipEntry] of Object.entries(this.originalZip.files)) {
            if (zipEntry.dir || this.isIgnoredPath(filename)) {
                continue;
            }

            const dotIndex = filename.lastIndexOf('.');
            if (dotIndex === -1) continue;
            const extension = filename.toLowerCase().substring(dotIndex);
            if (!IMAGE_EXTENSIONS.has(extension)) {
                continue;
            }

            try {
                const arrayBuffer = await zipEntry.async('arraybuffer');
                this.imageFiles.push({
                    name: filename,
                    originalData: arrayBuffer,
                    extension: extension,
                    originalSize: arrayBuffer.byteLength,
                });
            } catch (error) {
                console.warn(`Failed to extract ${filename}:`, error);
            }
        }

        this.totalImages = this.imageFiles.length;
        this.updateStats();
    }

    async trySkipCompression(targetZipSizeBytes) {
        const targetTotalImageSize = targetZipSizeBytes * (1 - CONFIG.ZIP_OVERHEAD_FACTOR);

        if (this.totalOriginalSize > targetTotalImageSize) return false;

        const finalBlob = await this.generateZipBlob(this.originalZip, CONFIG.ZIP_FINAL_LEVEL);

        if (finalBlob.size > targetZipSizeBytes) return false;

        this.compressedZip = this.originalZip;
        this.finalZipBlob = finalBlob;
        this.processedImages = this.totalImages;
        this.updateProgress('Complete!', 100);
        this.updateStats();
        this.showResults(finalBlob.size);
        return true;
    }

    trackBestResult(testZip, currentZipSize, targetZipSizeBytes, bestZip, bestSize) {
        const underTarget = currentZipSize <= targetZipSizeBytes;
        const bestUnderTarget = bestSize <= targetZipSizeBytes;

        // Prefer the largest result that fits under target
        if (underTarget && (!bestUnderTarget || currentZipSize > bestSize)) {
            return { zip: testZip, size: currentZipSize };
        }
        // If nothing fits yet, prefer the smallest over-target result
        if (!bestUnderTarget && !underTarget && currentZipSize < bestSize) {
            return { zip: testZip, size: currentZipSize };
        }
        return { zip: bestZip, size: bestSize };
    }

    async runCompressionIteration(compressionRatio, iteration) {
        const ratio = Math.max(compressionRatio, CONFIG.MIN_COMPRESSION_RATIO);

        this.updateProgress(`Compression iteration ${iteration + 1}...`, Math.min(10 + iteration * 8, 80));

        console.log(`Iteration ${iteration + 1}: ratio=${ratio.toFixed(3)}`);

        const compressedImages = await this.compressAllImages(ratio, iteration);
        const testZip = this.buildZip(compressedImages);

        const zipBlob = await this.generateZipBlob(testZip, CONFIG.ZIP_TEST_LEVEL);

        console.log(`Iteration ${iteration + 1}: ZIP size ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
        return { testZip, zipSize: zipBlob.size };
    }

    async compressImages() {
        this.updateProgress('Analyzing images...', 5);

        const targetZipSizeBytes = this.maxSizeMB * 1024 * 1024;

        if (await this.trySkipCompression(targetZipSizeBytes)) return;

        const targetTotalImageSize = targetZipSizeBytes * (1 - CONFIG.ZIP_OVERHEAD_FACTOR);
        let compressionRatio = this.totalOriginalSize > 0
            ? targetTotalImageSize / this.totalOriginalSize
            : CONFIG.MIN_COMPRESSION_RATIO;
        let bestZip = null;
        let bestSize = Infinity;

        let consecutiveFailures = 0;
        for (let iteration = 0; ; iteration++) {
            let result;
            try {
                result = await this.runCompressionIteration(compressionRatio, iteration);
                consecutiveFailures = 0;
            } catch (error) {
                console.error(`Failed ZIP generation in iteration ${iteration + 1}:`, error);
                consecutiveFailures++;
                if (consecutiveFailures >= 3) break;
                compressionRatio *= CONFIG.RATIO_DECREASE;
                continue;
            }

            const best = this.trackBestResult(result.testZip, result.zipSize, targetZipSizeBytes, bestZip, bestSize);
            bestZip = best.zip;
            bestSize = best.size;

            const relativeSize = result.zipSize / targetZipSizeBytes;
            if (relativeSize >= CONFIG.ACCEPTABLE_LOW && relativeSize <= CONFIG.ACCEPTABLE_HIGH) {
                break;
            }

            if (result.zipSize > targetZipSizeBytes) {
                compressionRatio *= CONFIG.RATIO_DECREASE;
            } else {
                compressionRatio *= CONFIG.RATIO_INCREASE;
            }
        }

        this.compressedZip = bestZip;
        if (!this.compressedZip) {
            throw new Error('Failed to create compressed ZIP');
        }

        this.updateProgress('Finalizing...', 90);

        const finalBlob = await this.generateZipBlob(this.compressedZip, CONFIG.ZIP_FINAL_LEVEL);
        this.finalZipBlob = finalBlob;

        console.log(`Final ZIP size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);

        this.updateProgress('Complete!', 100);
        this.updateStats();
        this.showResults(finalBlob.size);
    }

    async compressAllImages(ratio, iteration) {
        const compressedImages = [];
        this.processedImages = 0;

        for (const imageFile of this.imageFiles) {
            try {
                const compressedData = await this.compressImage(imageFile, ratio);
                compressedImages.push({ name: imageFile.name, data: compressedData });
            } catch (error) {
                console.error(`Failed to compress ${imageFile.name}:`, error);
                compressedImages.push({ name: imageFile.name, data: new Blob([imageFile.originalData]) });
            }

            this.processedImages++;
            this.updateStats();

            this.updateProgress(
                `Processing ${imageFile.name.split('/').pop().substring(0, 30)}...`,
                Math.min(10 + iteration * 8, 80)
            );
        }

        return compressedImages;
    }

    buildZip(compressedImages) {
        const zip = new JSZip();
        for (const img of compressedImages) {
            zip.file(img.name, img.data);
        }
        return zip;
    }

    compressImage(imageFile, compressionRatio) {
        return new Promise((resolve) => {
            let settled = false;

            const settle = (blob) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                resolve(blob);
            };

            const fallback = () => settle(new Blob([imageFile.originalData]));

            const timeoutId = setTimeout(() => {
                console.warn(`Timeout processing ${imageFile.name}, using original`);
                fallback();
            }, CONFIG.IMAGE_TIMEOUT_MS);

            let blobUrl = null;

            try {
                const blob = new Blob([imageFile.originalData]);
                blobUrl = URL.createObjectURL(blob);
            } catch (error) {
                console.error(`Error creating blob URL for ${imageFile.name}:`, error);
                fallback();
                return;
            }

            const img = new Image();

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const scaleFactor = Math.sqrt(compressionRatio);
                    let newWidth = Math.floor(img.width * scaleFactor);
                    let newHeight = Math.floor(img.height * scaleFactor);

                    const aspectRatio = img.width / img.height;

                    // Clamp to max dimensions while preserving aspect ratio
                    if (newWidth > CONFIG.MAX_DIMENSION || newHeight > CONFIG.MAX_DIMENSION) {
                        if (aspectRatio > 1) {
                            newWidth = CONFIG.MAX_DIMENSION;
                            newHeight = Math.floor(CONFIG.MAX_DIMENSION / aspectRatio);
                        } else {
                            newHeight = CONFIG.MAX_DIMENSION;
                            newWidth = Math.floor(CONFIG.MAX_DIMENSION * aspectRatio);
                        }
                    }

                    // Apply minimum dimension floor after all ratio-preserving logic
                    if (newWidth < CONFIG.MIN_DIMENSION || newHeight < CONFIG.MIN_DIMENSION) {
                        if (aspectRatio > 1) {
                            newHeight = CONFIG.MIN_DIMENSION;
                            newWidth = Math.floor(CONFIG.MIN_DIMENSION * aspectRatio);
                        } else {
                            newWidth = CONFIG.MIN_DIMENSION;
                            newHeight = Math.floor(CONFIG.MIN_DIMENSION / aspectRatio);
                        }
                    }

                    canvas.width = newWidth;
                    canvas.height = newHeight;

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, newWidth, newHeight);

                    const mimeType = MIME_TYPES[imageFile.extension] || 'image/jpeg';
                    const supportsQuality = QUALITY_FORMATS.has(mimeType);
                    const quality = supportsQuality
                        ? Math.max(CONFIG.QUALITY_MIN, Math.min(CONFIG.QUALITY_MAX, compressionRatio * CONFIG.QUALITY_MULTIPLIER))
                        : undefined;

                    canvas.toBlob(
                        (resultBlob) => {
                            if (resultBlob) {
                                settle(resultBlob);
                            } else {
                                console.warn(`Failed to create blob for ${imageFile.name}, using original`);
                                fallback();
                            }
                        },
                        mimeType,
                        quality
                    );
                } catch (error) {
                    console.error(`Error processing ${imageFile.name}:`, error);
                    fallback();
                }
            };

            img.onerror = () => {
                console.error(`Failed to load image: ${imageFile.name}`);
                fallback();
            };

            img.src = blobUrl;
        });
    }

    updateProgress(text, percent) {
        this.el.progressText.textContent = text;
        this.el.progressPercent.textContent = `${Math.round(percent)}%`;
        this.el.progressFill.style.width = `${percent}%`;
    }

    updateFileInfo(fileName, fileSize) {
        this.el.fileName.textContent = fileName;
        this.el.fileSize.textContent = this.formatFileSize(fileSize);
    }

    updateStats() {
        this.el.originalSize.textContent = this.formatFileSize(this.totalOriginalSize);
        this.el.imagesProcessed.textContent = `${this.processedImages}/${this.totalImages}`;

        if (this.finalZipBlob) {
            this.el.compressedSize.textContent = this.formatFileSize(this.finalZipBlob.size);
            const ratio = this.totalOriginalSize > 0
                ? ((this.totalOriginalSize - this.finalZipBlob.size) / this.totalOriginalSize * 100).toFixed(1)
                : '0.0';
            this.el.compressionRatio.textContent = `${ratio}%`;
        }
    }

    showResults(finalSize) {
        const spaceSaved = this.totalOriginalSize - finalSize;
        const savingsPercent = this.totalOriginalSize > 0
            ? ((spaceSaved / this.totalOriginalSize) * 100).toFixed(1)
            : '0.0';

        this.el.finalSize.textContent = this.formatFileSize(finalSize);
        this.el.spaceSaved.textContent = spaceSaved >= 0
            ? `${this.formatFileSize(spaceSaved)} (${savingsPercent}%)`
            : `+${this.formatFileSize(-spaceSaved)} (ZIP overhead)`;

        this.showSection('resultSection');
    }

    downloadCompressedZip() {
        if (!this.finalZipBlob) return;

        const url = URL.createObjectURL(this.finalZipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'compressed_images.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    resetApplication() {
        this.originalZip = null;
        this.compressedZip = null;
        this.finalZipBlob = null;
        this.imageFiles = [];
        this.totalImages = 0;
        this.processedImages = 0;

        this.el.fileInput.value = '';
        this.showSection('uploadSection');
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new ImageCompressor();

    window.addEventListener('beforeunload', (e) => {
        if (app.el.processingSection.style.display !== 'none') {
            e.preventDefault();
            e.returnValue = 'Image compression is in progress. Are you sure you want to leave?';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'o':
                    e.preventDefault();
                    app.el.fileInput.click();
                    break;
                case 's':
                    e.preventDefault();
                    if (app.el.downloadBtn.offsetParent !== null) {
                        app.el.downloadBtn.click();
                    }
                    break;
            }
        }
    });
});
