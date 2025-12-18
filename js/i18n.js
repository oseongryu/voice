/**
 * Internationalization (i18n) Support
 */

let translations = {};
let currentLang = 'ko';

async function setLanguage(lang) {
    try {
        const response = await fetch(`/static/locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load language: ${lang}`);
        }
        translations = await response.json();

        currentLang = lang;
        localStorage.setItem('app_language', lang);

        // Update UI after loading translations
        updateUI();

        // Update HTML lang attribute
        document.documentElement.lang = lang;

        // Update language select state
        updateLanguageSelect(lang);
    } catch (error) {
        console.error('Error setting language:', error);
    }
}

function updateLanguageSelect(lang) {
    const select = document.getElementById('languageSelect');
    if (select) {
        select.value = lang;
    }
}

function t(key) {
    return translations[key] || key;
}

function updateUI() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            // Check if element has specific target attribute
            const targetAttr = el.getAttribute('data-i18n-target');
            if (targetAttr) {
                el.setAttribute(targetAttr, t(key));
            } else {
                // If the element has children (like icons), we might be overwriting them.
                // Strategy: if element has 'bi' class children, preserve them?
                // Or expect the developer to put text in a span.
                // For simplicity, I'll assume text-only or carefully wrapped elements.
                // If there's an icon, we might need a structure like <i class="..."></i> <span data-i18n="key">Text</span>
                el.innerText = t(key);
            }
        }
    });

    // Update placeholders
    const inputs = document.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.placeholder = t(key);
        }
    });
}

// Auto-detect or load saved language
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('app_language');
    if (savedLang) {
        setLanguage(savedLang);
    } else {
        // Default to Korean as per origin
        setLanguage('ko');
    }
});
