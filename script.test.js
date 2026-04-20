import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptSrc = readFileSync(resolve(__dirname, 'script.js'), 'utf8');

const DOM_HTML = `
    <div id="uploadArea"></div>
    <input id="fileInput" type="file" />
    <input id="maxSize" type="number" value="2.5" />
    <button id="downloadBtn"></button>
    <button id="newFileBtn"></button>
    <span id="progressText"></span>
    <span id="progressPercent"></span>
    <div id="progressFill"></div>
    <span id="fileName"></span>
    <span id="fileSize"></span>
    <span id="originalSize"></span>
    <span id="imagesProcessed"></span>
    <span id="compressedSize"></span>
    <span id="compressionRatio"></span>
    <span id="finalSize"></span>
    <span id="spaceSaved"></span>
    <div id="uploadSection"></div>
    <div id="processingSection"></div>
    <div id="resultSection"></div>
`;

// Execute the script once in a vm context that has window/document as globals.
// We wrap in a function so const/class declarations become properties of the
// explicit `sandbox` object (function-body vars are not block-scoped like const).
document.body.innerHTML = DOM_HTML;

const sandbox = Object.create(globalThis);
sandbox.window = sandbox;
vm.createContext(sandbox);

// Wrap in an IIFE that assigns everything to the sandbox explicitly
const wrapped = `
(function(global) {
    ${scriptSrc}
    global.ImageCompressor = ImageCompressor;
    global.CONFIG = CONFIG;
    global.MIME_TYPES = MIME_TYPES;
    global.IMAGE_EXTENSIONS = IMAGE_EXTENSIONS;
    global.QUALITY_FORMATS = QUALITY_FORMATS;
})(this);
`;
vm.runInContext(wrapped, sandbox);

const { ImageCompressor, CONFIG, MIME_TYPES, IMAGE_EXTENSIONS, QUALITY_FORMATS } = sandbox;

function resetDOM(maxSizeMBValue = '2.5') {
    document.body.innerHTML = DOM_HTML;
    document.getElementById('maxSize').value = maxSizeMBValue;
}

function makeCompressor(maxSizeMBValue = '2.5') {
    resetDOM(maxSizeMBValue);
    return new ImageCompressor();
}

// ─── CONFIG ─────────────────────────────────────────────────────────────────

describe('CONFIG', () => {
    it('has sane convergence bounds', () => {
        expect(CONFIG.ACCEPTABLE_LOW).toBeLessThan(CONFIG.ACCEPTABLE_HIGH);
        expect(CONFIG.ACCEPTABLE_LOW).toBeGreaterThan(0);
        expect(CONFIG.ACCEPTABLE_HIGH).toBeLessThanOrEqual(1);
    });

    it('ratio decrease is < 1, ratio increase is > 1', () => {
        expect(CONFIG.RATIO_DECREASE).toBeLessThan(1);
        expect(CONFIG.RATIO_INCREASE).toBeGreaterThan(1);
    });

    it('MIN_DIMENSION is less than MAX_DIMENSION', () => {
        expect(CONFIG.MIN_DIMENSION).toBeLessThan(CONFIG.MAX_DIMENSION);
    });

    it('quality bounds are valid', () => {
        expect(CONFIG.QUALITY_MIN).toBeGreaterThan(0);
        expect(CONFIG.QUALITY_MAX).toBeLessThanOrEqual(1);
        expect(CONFIG.QUALITY_MIN).toBeLessThan(CONFIG.QUALITY_MAX);
    });
});

// ─── MIME_TYPES / IMAGE_EXTENSIONS ──────────────────────────────────────────

describe('MIME_TYPES', () => {
    it('maps jpeg extensions to image/jpeg', () => {
        expect(MIME_TYPES['.jpg']).toBe('image/jpeg');
        expect(MIME_TYPES['.jpeg']).toBe('image/jpeg');
    });

    it('maps gif and bmp to image/png (canvas fallback)', () => {
        expect(MIME_TYPES['.gif']).toBe('image/png');
        expect(MIME_TYPES['.bmp']).toBe('image/png');
    });

    it('IMAGE_EXTENSIONS contains all MIME_TYPES keys', () => {
        for (const ext of Object.keys(MIME_TYPES)) {
            expect(IMAGE_EXTENSIONS.has(ext)).toBe(true);
        }
    });

    it('QUALITY_FORMATS only includes jpeg and webp', () => {
        expect(QUALITY_FORMATS.has('image/jpeg')).toBe(true);
        expect(QUALITY_FORMATS.has('image/webp')).toBe(true);
        expect(QUALITY_FORMATS.has('image/png')).toBe(false);
    });
});

// ─── formatFileSize ──────────────────────────────────────────────────────────

describe('formatFileSize', () => {
    let app;
    beforeEach(() => { app = makeCompressor(); });

    it('returns "0 Bytes" for 0', () => {
        expect(app.formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats bytes', () => {
        expect(app.formatFileSize(512)).toBe('512 Bytes');
    });

    it('formats kilobytes', () => {
        expect(app.formatFileSize(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
        expect(app.formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('formats gigabytes', () => {
        expect(app.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('rounds to 2 decimal places', () => {
        expect(app.formatFileSize(1500)).toBe('1.46 KB');
    });
});

// ─── isIgnoredPath ───────────────────────────────────────────────────────────

describe('isIgnoredPath', () => {
    let app;
    beforeEach(() => { app = makeCompressor(); });

    it('ignores __MACOSX paths', () => {
        expect(app.isIgnoredPath('__MACOSX/image.jpg')).toBe(true);
    });

    it('ignores dot-prefixed files', () => {
        expect(app.isIgnoredPath('.DS_Store')).toBe(true);
        expect(app.isIgnoredPath('folder/.hidden')).toBe(true);
    });

    it('allows normal paths', () => {
        expect(app.isIgnoredPath('photos/image.jpg')).toBe(false);
        expect(app.isIgnoredPath('image.png')).toBe(false);
    });
});

// ─── trackBestResult ─────────────────────────────────────────────────────────

describe('trackBestResult', () => {
    let app;
    const target = 1000;
    const zipA = { id: 'A' };
    const zipB = { id: 'B' };

    beforeEach(() => { app = makeCompressor(); });

    it('prefers under-target over over-target', () => {
        const result = app.trackBestResult(zipA, 900, target, zipB, 1100);
        expect(result.zip).toBe(zipA);
        expect(result.size).toBe(900);
    });

    it('prefers larger under-target when both are under', () => {
        const result = app.trackBestResult(zipA, 950, target, zipB, 800);
        expect(result.zip).toBe(zipA);
        expect(result.size).toBe(950);
    });

    it('keeps existing best when new is smaller under-target', () => {
        const result = app.trackBestResult(zipA, 800, target, zipB, 950);
        expect(result.zip).toBe(zipB);
        expect(result.size).toBe(950);
    });

    it('prefers smaller over-target when nothing fits', () => {
        const result = app.trackBestResult(zipA, 1050, target, zipB, 1200);
        expect(result.zip).toBe(zipA);
        expect(result.size).toBe(1050);
    });

    it('keeps existing best when no improvement over target', () => {
        const result = app.trackBestResult(zipA, 1200, target, zipB, 1050);
        expect(result.zip).toBe(zipB);
        expect(result.size).toBe(1050);
    });

    it('handles Infinity as initial bestSize (first iteration)', () => {
        const result = app.trackBestResult(zipA, 1200, target, null, Infinity);
        expect(result.zip).toBe(zipA);
        expect(result.size).toBe(1200);
    });
});

// ─── maxSizeMB input validation ──────────────────────────────────────────────

describe('maxSize input validation', () => {
    it('reads initial value from input', () => {
        const app = makeCompressor('5');
        expect(app.maxSizeMB).toBe(5);
    });

    it('defaults to 2.5 for invalid initial value', () => {
        const app = makeCompressor('abc');
        expect(app.maxSizeMB).toBe(2.5);
    });

    it('updates maxSizeMB on valid change event', () => {
        const app = makeCompressor('2.5');
        const input = document.getElementById('maxSize');
        input.value = '10';
        input.dispatchEvent(new Event('change'));
        expect(app.maxSizeMB).toBe(10);
    });

    it('rejects value below minimum and restores previous', () => {
        const app = makeCompressor('2.5');
        const input = document.getElementById('maxSize');
        input.value = '0.05';
        input.dispatchEvent(new Event('change'));
        expect(app.maxSizeMB).toBe(2.5);
        expect(input.value).toBe('2.5');
    });

    it('rejects value above maximum and restores previous', () => {
        const app = makeCompressor('2.5');
        const input = document.getElementById('maxSize');
        input.value = '100';
        input.dispatchEvent(new Event('change'));
        expect(app.maxSizeMB).toBe(2.5);
        expect(input.value).toBe('2.5');
    });

    it('rejects NaN and restores previous', () => {
        const app = makeCompressor('2.5');
        const input = document.getElementById('maxSize');
        input.value = 'not-a-number';
        input.dispatchEvent(new Event('change'));
        expect(app.maxSizeMB).toBe(2.5);
    });
});

// ─── totalOriginalSize ───────────────────────────────────────────────────────

describe('totalOriginalSize', () => {
    let app;
    beforeEach(() => { app = makeCompressor(); });

    it('returns 0 with no images', () => {
        expect(app.totalOriginalSize).toBe(0);
    });

    it('sums originalSize across all images', () => {
        app.imageFiles = [
            { originalSize: 100 },
            { originalSize: 200 },
            { originalSize: 300 },
        ];
        expect(app.totalOriginalSize).toBe(600);
    });
});

// ─── showSection ─────────────────────────────────────────────────────────────

describe('showSection', () => {
    let app;
    beforeEach(() => { app = makeCompressor(); });

    it('shows the named section and hides others', () => {
        app.showSection('processingSection');
        expect(document.getElementById('processingSection').style.display).toBe('block');
        expect(document.getElementById('uploadSection').style.display).toBe('none');
        expect(document.getElementById('resultSection').style.display).toBe('none');
    });

    it('can switch to resultSection', () => {
        app.showSection('resultSection');
        expect(document.getElementById('resultSection').style.display).toBe('block');
        expect(document.getElementById('uploadSection').style.display).toBe('none');
    });
});

// ─── showResults ─────────────────────────────────────────────────────────────

describe('showResults', () => {
    let app;
    beforeEach(() => { app = makeCompressor(); });

    it('shows space saved as positive when images shrank', () => {
        app.imageFiles = [{ originalSize: 2000 }];
        app.showResults(1000);
        expect(document.getElementById('spaceSaved').textContent).toContain('(50.0%)');
        expect(document.getElementById('spaceSaved').textContent).not.toContain('ZIP overhead');
    });

    it('shows ZIP overhead message when final size exceeds original', () => {
        app.imageFiles = [{ originalSize: 500 }];
        app.showResults(1000);
        expect(document.getElementById('spaceSaved').textContent).toContain('ZIP overhead');
    });

    it('handles zero original size without crashing', () => {
        app.imageFiles = [];
        expect(() => app.showResults(0)).not.toThrow();
    });
});

// ─── resetApplication ────────────────────────────────────────────────────────

describe('resetApplication', () => {
    let app;
    beforeEach(() => { app = makeCompressor(); });

    it('clears all state and shows upload section', () => {
        app.imageFiles = [{ originalSize: 100 }];
        app.totalImages = 1;
        app.processedImages = 1;
        app.finalZipBlob = new Blob(['x']);
        app.resetApplication();

        expect(app.imageFiles).toHaveLength(0);
        expect(app.totalImages).toBe(0);
        expect(app.processedImages).toBe(0);
        expect(app.finalZipBlob).toBeNull();
        expect(app.originalZip).toBeNull();
        expect(document.getElementById('uploadSection').style.display).toBe('block');
    });
});

// ─── processFile ─────────────────────────────────────────────────────────────

describe('processFile', () => {
    let app;
    beforeEach(() => {
        app = makeCompressor();
        vi.spyOn(app, 'showError');
    });

    it('rejects non-ZIP files', async () => {
        const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
        await app.processFile(file);
        expect(app.showError).toHaveBeenCalledWith('Please select a ZIP file.');
    });
});
