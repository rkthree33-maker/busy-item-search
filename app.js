/**
 * Busy Item Search - Main Application Logic
 * Architecture: Virtualized/Chunked rendering for performance, pure Vanilla JS.
 */

// State
let rawData = [];
let filteredData = [];
const CHUNK_SIZE = 50;
let currentRenderIndex = 0;

// DOM Elements
const els = {
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    groupFilter: document.getElementById('groupFilter'),
    sortOrder: document.getElementById('sortOrder'),
    resultCount: document.getElementById('resultCount'),
    resultsGrid: document.getElementById('resultsGrid'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    emptyState: document.getElementById('emptyState'),
    loadMoreTrigger: document.getElementById('loadMoreTrigger'),
    themeToggle: document.getElementById('themeToggle'),
    retryBtn: document.getElementById('retryBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    copyAllBtn: document.getElementById('copyAllBtn'),
    toast: document.getElementById('toast'),
    installAppBtn: document.getElementById('installAppBtn')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchData();
});

function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.body.classList.add('dark-theme');
}

function setupEventListeners() {
    // Search with Debounce
    els.searchInput.addEventListener('input', debounce(() => {
        els.clearSearchBtn.classList.toggle('hidden', els.searchInput.value.trim() === '');
        applyFiltersAndSort();
    }, 300));

    els.clearSearchBtn.addEventListener('click', () => {
        els.searchInput.value = '';
        els.clearSearchBtn.classList.add('hidden');
        els.searchInput.focus();
        applyFiltersAndSort();
    });

    els.groupFilter.addEventListener('change', applyFiltersAndSort);
    els.sortOrder.addEventListener('change', applyFiltersAndSort);
    els.retryBtn.addEventListener('click', fetchData);
    els.exportCsvBtn.addEventListener('click', exportCSV);
    els.copyAllBtn.addEventListener('click', copyAllResults);

    els.themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            els.searchInput.focus();
        }
        if (e.key === 'Escape') {
            els.searchInput.value = '';
            els.clearSearchBtn.classList.add('hidden');
            els.searchInput.blur();
            applyFiltersAndSort();
        }
    });

    // Infinite Scroll Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            renderNextChunk();
        }
    }, { rootMargin: '200px' });
    observer.observe(els.loadMoreTrigger);
}

async function fetchData() {
    toggleState('loading');
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        rawData = data;
        populateGroups(rawData);
        applyFiltersAndSort();
    } catch (error) {
        console.error('Fetch error:', error);
        toggleState('error');
    }
}

function populateGroups(data) {
    const groups = new Set(data.map(item => item.itemGroup).filter(g => g));
    const sortedGroups = Array.from(groups).sort();
    
    els.groupFilter.innerHTML = '<option value="ALL">All Groups</option>';
    sortedGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        els.groupFilter.appendChild(option);
    });
}

function applyFiltersAndSort() {
    const query = els.searchInput.value.toLowerCase().replace(/\s+/g, ' ').trim();
    const group = els.groupFilter.value;
    const sort = els.sortOrder.value;

    // Filter
    filteredData = rawData.filter(item => {
        const matchesGroup = group === 'ALL' || item.itemGroup === group;
        if (!matchesGroup) return false;

        if (!query) return true;
        
        // Search across all fields
        const searchableText = `${item.itemName} ${item.itemId} ${item.itemGroup} ${item.purchaseRate} ${item.aRate} ${item.bRate}`.toLowerCase();
        return query.split(' ').every(term => searchableText.includes(term));
    });

    // Sort
    filteredData.sort((a, b) => {
        switch(sort) {
            case 'NAME_ASC': return a.itemName.localeCompare(b.itemName);
            case 'NAME_DESC': return b.itemName.localeCompare(a.itemName);
            case 'PURCHASE_ASC': return a.purchaseRate - b.purchaseRate;
            case 'PURCHASE_DESC': return b.purchaseRate - a.purchaseRate;
            case 'ARATE_ASC': return a.aRate - b.aRate;
            case 'ARATE_DESC': return b.aRate - a.aRate;
            default: return 0;
        }
    });

    // Reset render state
    currentRenderIndex = 0;
    els.resultsGrid.innerHTML = '';
    els.resultCount.textContent = `${filteredData.length} items`;

    if (filteredData.length === 0) {
        toggleState('empty');
    } else {
        toggleState('results');
        renderNextChunk();
    }
}

function renderNextChunk() {
    const chunk = filteredData.slice(currentRenderIndex, currentRenderIndex + CHUNK_SIZE);
    if (chunk.length === 0) return;

    const fragment = document.createDocumentFragment();
    
    chunk.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="item-name">${escapeHTML(item.itemName)}</div>
                    <span class="item-id">ID: ${escapeHTML(item.itemId)}</span>
                </div>
                ${item.itemGroup ? `<span class="badge">${escapeHTML(item.itemGroup)}</span>` : ''}
            </div>
            <div class="card-body">
                <div class="rate-box">
                    <span class="rate-label">Purchase</span>
                    <span class="rate-value">${formatCurrency(item.purchaseRate)}</span>
                </div>
                <div class="rate-box">
                    <span class="rate-label">A Rate</span>
                    <span class="rate-value">${formatCurrency(item.aRate)}</span>
                </div>
                <div class="rate-box">
                    <span class="rate-label">B Rate</span>
                    <span class="rate-value">${formatCurrency(item.bRate)}</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn-secondary" onclick="copyToClipboard('${escapeHTML(item.itemName).replace(/'/g, "\\'")}')">Copy Name</button>
                <button class="btn-secondary" onclick="copyDetails('${escapeHTML(item.itemId)}', '${escapeHTML(item.itemName).replace(/'/g, "\\'")}', '${escapeHTML(item.itemGroup).replace(/'/g, "\\'")}', ${item.purchaseRate}, ${item.aRate}, ${item.bRate})">Copy Details</button>
            </div>
        `;
        fragment.appendChild(card);
    });

    els.resultsGrid.appendChild(fragment);
    currentRenderIndex += CHUNK_SIZE;
}

// Utility Functions
function toggleState(state) {
    els.loadingState.classList.add('hidden');
    els.errorState.classList.add('hidden');
    els.emptyState.classList.add('hidden');
    els.resultsGrid.classList.add('hidden');

    if (state === 'loading') els.loadingState.classList.remove('hidden');
    if (state === 'error') els.errorState.classList.remove('hidden');
    if (state === 'empty') els.emptyState.classList.remove('hidden');
    if (state === 'results') els.resultsGrid.classList.remove('hidden');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}

function formatCurrency(val) {
    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Global scope for inline onclick handlers
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(showToast);
};

window.copyDetails = (id, name, group, pRate, aRate, bRate) => {
    const text = `Item: ${name}\nID: ${id}\nGroup: ${group}\nPurchase Rate: ${pRate}\nA Rate: ${aRate}\nB Rate: ${bRate}`;
    navigator.clipboard.writeText(text).then(showToast);
};

function copyAllResults() {
    if (filteredData.length === 0) return;
    const text = filteredData.map(item => `${item.itemName}\t${item.itemId}\t${item.purchaseRate}\t${item.aRate}\t${item.bRate}`).join('\n');
    navigator.clipboard.writeText(`Name\tID\tPurchase Rate\tA Rate\tB Rate\n${text}`).then(showToast);
}

function exportCSV() {
    if (filteredData.length === 0) return;
    const headers = ['ItemID', 'Item Name', 'Item Group', 'Purchase Rate', 'A Rate', 'B Rate'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map(item => `"${item.itemId}","${item.itemName}","${item.itemGroup}",${item.purchaseRate},${item.aRate},${item.bRate}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "busy_items_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showToast() {
    els.toast.classList.remove('hidden');
    setTimeout(() => els.toast.classList.add('hidden'), 2000);
}

// PWA Install Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installAppBtn.classList.remove('hidden');
});

els.installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            els.installAppBtn.classList.add('hidden');
        }
        deferredPrompt = null;
    }
});

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
            console.warn('Service Worker registration failed: ', err);
        });
    });
}