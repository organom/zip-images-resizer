const TRANSLATIONS = {
    en: {
        title: 'ZipToSize - Compress images inside any archive to a target size',
        subtitle: 'Compress your images inside any archive to fit a given size',
        dropArchive: 'Drop your archive here',
        orBrowse: 'or click to browse',
        supports: 'Supports: ZIP, RAR, 7z, TAR and more',
        targetSize: 'Target final ZIP Size (MB)',
        processing: 'Processing...',
        analyzingFile: 'Analyzing file...',
        initializing: 'Initializing...',
        originalSize: 'Original Size',
        compressedSize: 'Compressed Size',
        imagesProcessed: 'Images Processed',
        compressionRatio: 'Compression Ratio',
        compressionComplete: 'Compression Complete!',
        successMsg: 'Your images have been successfully compressed',
        finalSize: 'Final Size',
        spaceSaved: 'Space Saved',
        downloadBtn: 'Download Compressed ZIP',
        compressAnother: 'Compress Another File',
        footer: '© 2025 ZipToSize by Ricardo Gomes. All processing is done locally in your browser.',
        loadingArchive: 'Loading archive...',
        extractingArchive: 'Extracting archive...',
        analyzingImages: 'Analyzing images...',
        compressionIteration: (n) => `Compression iteration ${n}...`,
        finalizing: 'Finalizing...',
        complete: 'Complete!',
        errorUnsupported: 'Unsupported file format. Please select a ZIP, RAR, 7z, or TAR archive.',
        errorNoImages: 'No image files found in the archive.',
        errorProcessing: 'Error processing the archive. Please try again.',
        zipOverhead: 'ZIP overhead',
    },
    pt: {
        title: 'ZipToSize - Comprimir imagens em qualquer arquivo para um tamanho alvo',
        subtitle: 'Comprima as suas imagens dentro de qualquer arquivo para um tamanho definido',
        dropArchive: 'Arraste o seu ficheiro aqui',
        orBrowse: 'ou clique para procurar',
        supports: 'Suporta: ZIP, RAR, 7z, TAR e mais',
        targetSize: 'Tamanho final ZIP alvo (MB)',
        processing: 'A processar...',
        analyzingFile: 'A analisar ficheiro...',
        initializing: 'A inicializar...',
        originalSize: 'Tamanho Original',
        compressedSize: 'Tamanho Comprimido',
        imagesProcessed: 'Imagens Processadas',
        compressionRatio: 'Rácio de Compressão',
        compressionComplete: 'Compressão Concluída!',
        successMsg: 'As suas imagens foram comprimidas com sucesso',
        finalSize: 'Tamanho Final',
        spaceSaved: 'Espaço Poupado',
        downloadBtn: 'Descarregar ZIP Comprimido',
        compressAnother: 'Comprimir Outro Ficheiro',
        footer: '© 2025 ZipToSize by Ricardo Gomes. Todo o processamento é feito localmente no seu browser.',
        loadingArchive: 'A carregar ficheiro...',
        extractingArchive: 'A extrair ficheiro...',
        analyzingImages: 'A analisar imagens...',
        compressionIteration: (n) => `Iteração de compressão ${n}...`,
        finalizing: 'A finalizar...',
        complete: 'Concluído!',
        errorUnsupported: 'Formato não suportado. Selecione um ficheiro ZIP, RAR, 7z ou TAR.',
        errorNoImages: 'Nenhuma imagem encontrada no ficheiro.',
        errorProcessing: 'Erro ao processar o ficheiro. Por favor tente novamente.',
        zipOverhead: 'overhead ZIP',
    },
    de: {
        title: 'ZipToSize - Bilder in jedem Archiv auf eine Zielgröße komprimieren',
        subtitle: 'Komprimieren Sie Ihre Bilder in jedem Archiv auf eine gewünschte Zielgröße',
        dropArchive: 'Archiv hier ablegen',
        orBrowse: 'oder zum Durchsuchen klicken',
        supports: 'Unterstützt: ZIP, RAR, 7z, TAR und mehr',
        targetSize: 'Ziel-ZIP-Größe (MB)',
        processing: 'Wird verarbeitet...',
        analyzingFile: 'Datei wird analysiert...',
        initializing: 'Initialisierung...',
        originalSize: 'Originalgröße',
        compressedSize: 'Komprimierte Größe',
        imagesProcessed: 'Verarbeitete Bilder',
        compressionRatio: 'Kompressionsrate',
        compressionComplete: 'Komprimierung abgeschlossen!',
        successMsg: 'Ihre Bilder wurden erfolgreich komprimiert',
        finalSize: 'Endgröße',
        spaceSaved: 'Eingesparter Speicher',
        downloadBtn: 'Komprimierte ZIP herunterladen',
        compressAnother: 'Weitere Datei komprimieren',
        footer: '© 2025 ZipToSize by Ricardo Gomes. Alle Verarbeitungen erfolgen lokal in Ihrem Browser.',
        loadingArchive: 'Archiv wird geladen...',
        extractingArchive: 'Archiv wird entpackt...',
        analyzingImages: 'Bilder werden analysiert...',
        compressionIteration: (n) => `Komprimierungsdurchlauf ${n}...`,
        finalizing: 'Wird abgeschlossen...',
        complete: 'Abgeschlossen!',
        errorUnsupported: 'Nicht unterstütztes Format. Bitte ZIP, RAR, 7z oder TAR wählen.',
        errorNoImages: 'Keine Bilder im Archiv gefunden.',
        errorProcessing: 'Fehler beim Verarbeiten des Archivs. Bitte erneut versuchen.',
        zipOverhead: 'ZIP-Overhead',
    },
};

const SUPPORTED_LANGS = Object.keys(TRANSLATIONS);

function detectLang() {
    const saved = localStorage.getItem('ziptosize-lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    const browser = (navigator.language || 'en').substring(0, 2).toLowerCase();
    return SUPPORTED_LANGS.includes(browser) ? browser : 'en';
}

let currentLang = detectLang();

export function t(key, ...args) {
    const val = TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.en[key];
    return typeof val === 'function' ? val(...args) : (val ?? key);
}

export function setLang(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem('ziptosize-lang', lang);
}

export function getLang() { return currentLang; }
export function getSupportedLangs() { return SUPPORTED_LANGS; }
