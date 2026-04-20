import { Archive } from './libarchive.js';
import { t, setLang, getLang } from './i18n.js';

Archive.init({ workerUrl: './worker-bundle.js' });

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
    MAX_ITERATIONS: 50,
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
        this.el.uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); this.el.uploadArea.classList.add('dragover'); });
        this.el.uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); this.el.uploadArea.classList.remove('dragover'); });
        this.el.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.el.uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.processFile(file);
        });
        this.el.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.processFile(file);
        });

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

    outputFileName(inputName) {
        const dot = inputName.lastIndexOf('.');
        const base = dot === -1 ? inputName : inputName.substring(0, dot);
        return `${base}-compressed.zip`;
    }

    async processFile(file) {
        const name = file.name.toLowerCase();
        const isZip = name.endsWith('.zip');
        const supported = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].some(ext => name.endsWith(ext));

        if (!supported) {
            this.showError(t('errorUnsupported'));
            return;
        }

        try {
            this.showSection('processingSection');
            this.updateProgress(t('loadingArchive'), 0);
            this.outputName = this.outputFileName(file.name);

            if (isZip) {
                const arrayBuffer = await file.arrayBuffer();
                this.originalZip = await JSZip.loadAsync(arrayBuffer);
            } else {
                this.originalZip = await this.loadViaLibarchive(file);
            }

            await this.extractImageFiles();

            if (this.imageFiles.length === 0) {
                this.showError(t('errorNoImages'));
                return;
            }

            this.el.fileName.textContent = file.name;
            this.el.fileSize.textContent = this.formatFileSize(file.size);
            await this.compressImages();
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError(t('errorProcessing'));
        }
    }

    async loadViaLibarchive(file) {
        this.updateProgress(t('extractingArchive'), 2);
        const archive = await Archive.open(file);
        // extractFiles() extracts all entries and returns nested { path: File } object.
        // getFilesArray() then flattens it to [{ file: File, path: "dir/" }].
        // Must call extractFiles() first so entries are File objects, not ArchiveReader stubs.
        await archive.extractFiles();
        const entries = await archive.getFilesArray();
        const zip = new JSZip();

        await Promise.all(entries.map(async ({ file: entry, path }) => {
            if (entry instanceof File) {
                zip.file(path + entry.name, await entry.arrayBuffer());
            }
        }));

        return zip;
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

        this.finalZipBlob = finalBlob;
        this.processedImages = this.totalImages;
        this.updateProgress(t('complete'), 100);
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

        this.updateProgress(t('compressionIteration', iteration + 1), Math.min(10 + iteration * 8, 80));

        console.log(`Iteration ${iteration + 1}: ratio=${ratio.toFixed(3)}`);

        const compressedImages = await this.compressAllImages(ratio);
        const testZip = new JSZip();
        for (const img of compressedImages) testZip.file(img.name, img.data);

        const zipBlob = await this.generateZipBlob(testZip, CONFIG.ZIP_TEST_LEVEL);

        console.log(`Iteration ${iteration + 1}: ZIP size ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);
        return { testZip, zipSize: zipBlob.size };
    }

    async compressImages() {
        this.updateProgress(t('analyzingImages'), 5);

        const targetZipSizeBytes = this.maxSizeMB * 1024 * 1024;

        if (await this.trySkipCompression(targetZipSizeBytes)) return;

        const targetTotalImageSize = targetZipSizeBytes * (1 - CONFIG.ZIP_OVERHEAD_FACTOR);
        let compressionRatio = this.totalOriginalSize > 0
            ? targetTotalImageSize / this.totalOriginalSize
            : CONFIG.MIN_COMPRESSION_RATIO;
        let bestZip = null;
        let bestSize = Infinity;

        let consecutiveFailures = 0;
        let prevSize = Infinity;
        let stagnationCount = 0;
        for (let iteration = 0; iteration < CONFIG.MAX_ITERATIONS; iteration++) {
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

            // Break if size stopped changing (oscillation / floor reached)
            if (Math.abs(result.zipSize - prevSize) / Math.max(prevSize, 1) < 0.001) {
                stagnationCount++;
                if (stagnationCount >= 3) break;
            } else {
                stagnationCount = 0;
            }
            prevSize = result.zipSize;

            if (result.zipSize > targetZipSizeBytes) {
                compressionRatio *= CONFIG.RATIO_DECREASE;
            } else {
                compressionRatio *= CONFIG.RATIO_INCREASE;
            }
        }

        if (!bestZip) throw new Error('Failed to create compressed ZIP');

        this.updateProgress(t('finalizing'), 90);

        const finalBlob = await this.generateZipBlob(bestZip, CONFIG.ZIP_FINAL_LEVEL);
        this.finalZipBlob = finalBlob;

        console.log(`Final ZIP size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);

        this.updateProgress(t('complete'), 100);
        this.updateStats();
        this.showResults(finalBlob.size);
    }

    async compressAllImages(ratio) {
        const compressedImages = [];
        this.processedImages = 0;

        const avgSize = this.totalOriginalSize / this.imageFiles.length;

        for (const imageFile of this.imageFiles) {
            // Files larger than average get a more aggressive per-file ratio so they
            // shrink toward the average first; smaller files get a gentler ratio.
            // Once sizes are roughly equal the per-file ratio converges to the global one.
            const sizeRatio = avgSize / imageFile.originalSize; // < 1 for big files, > 1 for small
            const perFileRatio = Math.min(ratio, ratio * sizeRatio);

            try {
                const compressedData = await this.compressImage(imageFile, perFileRatio);
                compressedImages.push({ name: imageFile.name, data: compressedData });
            } catch (error) {
                console.error(`Failed to compress ${imageFile.name}:`, error);
                compressedImages.push({ name: imageFile.name, data: new Blob([imageFile.originalData]) });
            }

            this.processedImages++;
            this.updateStats();
        }

        return compressedImages;
    }

    clampDimensions(width, height) {
        const aspect = width / height;
        if (width > CONFIG.MAX_DIMENSION || height > CONFIG.MAX_DIMENSION) {
            return aspect > 1
                ? { w: CONFIG.MAX_DIMENSION, h: Math.floor(CONFIG.MAX_DIMENSION / aspect) }
                : { w: Math.floor(CONFIG.MAX_DIMENSION * aspect), h: CONFIG.MAX_DIMENSION };
        }
        if (width < CONFIG.MIN_DIMENSION || height < CONFIG.MIN_DIMENSION) {
            return aspect > 1
                ? { w: Math.floor(CONFIG.MIN_DIMENSION * aspect), h: CONFIG.MIN_DIMENSION }
                : { w: CONFIG.MIN_DIMENSION, h: Math.floor(CONFIG.MIN_DIMENSION / aspect) };
        }
        return { w: width, h: height };
    }

    drawAndExport(img, imageFile, compressionRatio, settle, fallback) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = Math.sqrt(compressionRatio);
            const { w, h } = this.clampDimensions(Math.floor(img.width * scale), Math.floor(img.height * scale));

            canvas.width = w;
            canvas.height = h;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            const mimeType = MIME_TYPES[imageFile.extension] || 'image/jpeg';
            const quality = QUALITY_FORMATS.has(mimeType)
                ? Math.max(CONFIG.QUALITY_MIN, Math.min(CONFIG.QUALITY_MAX, compressionRatio * CONFIG.QUALITY_MULTIPLIER))
                : undefined;

            canvas.toBlob((resultBlob) => {
                if (resultBlob) {
                    settle(resultBlob);
                } else {
                    console.warn(`Failed to create blob for ${imageFile.name}, using original`);
                    fallback();
                }
            }, mimeType, quality);
        } catch (error) {
            console.error(`Error processing ${imageFile.name}:`, error);
            fallback();
        }
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
                blobUrl = URL.createObjectURL(new Blob([imageFile.originalData]));
            } catch (error) {
                console.error(`Error creating blob URL for ${imageFile.name}:`, error);
                fallback();
                return;
            }

            const img = new Image();
            img.onload = () => this.drawAndExport(img, imageFile, compressionRatio, settle, fallback);
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
            : `+${this.formatFileSize(-spaceSaved)} (${t('zipOverhead')})`;

        this.showSection('resultSection');
    }

    downloadCompressedZip() {
        if (!this.finalZipBlob) return;

        const url = URL.createObjectURL(this.finalZipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.outputName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    resetApplication() {
        this.originalZip = null;
        this.finalZipBlob = null;
        this.outputName = null;
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

function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : '';
    document.getElementById('themeBtn').textContent = dark ? '☀️' : '🌙';
    localStorage.setItem('ziptosize-theme', dark ? 'dark' : 'light');
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.documentElement.lang = getLang();
    document.title = t('title');
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === getLang());
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const version = document.querySelector('meta[name="app-version"]')?.content;
    if (version) document.getElementById('appVersion').textContent = `v${version}`;

    const savedDark = localStorage.getItem('ziptosize-theme') === 'dark'
        || (localStorage.getItem('ziptosize-theme') === null && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(savedDark);

    document.getElementById('themeBtn').addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme !== 'dark');
    });

    applyTranslations();

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setLang(btn.dataset.lang);
            applyTranslations();
        });
    });

    const app = new ImageCompressor();

    window.addEventListener('beforeunload', (e) => {
        if (app.el.processingSection.style.display !== 'none') {
            e.preventDefault();
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
