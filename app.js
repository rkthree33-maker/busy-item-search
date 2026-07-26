/**
 * Busy Item Search - Table Layout & Custom Data Logic
 */

let rawData = [];
let filteredData = [];
const CHUNK_SIZE = 50;
let currentRenderIndex = 0;
let forceShowAll = false; // Remembers if the user clicked "Show All"

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
    els.searchInput.addEventListener('input', debounce(() => {
        forceShowAll = false; // Reset show all if typing
        els.clearSearchBtn.classList.toggle('hidden', els.searchInput.value.trim() === '');
        applyFiltersAndSort();
    }, 300));

    els.clearSearchBtn.addEventListener('click', () => {
        forceShowAll = false; // Reset on clear
        els.searchInput.value = '';
        els.clearSearchBtn.classList.add('hidden');
        els.searchInput.focus();
        applyFiltersAndSort();
    });

    els.groupFilter.addEventListener('change', () => {
        forceShowAll = false;
        applyFiltersAndSort();
    });
    
    els.sortOrder.addEventListener('change', applyFiltersAndSort);
    els.retryBtn.addEventListener('click', fetchData);
    els.exportCsvBtn.addEventListener('click', exportCSV);
    els.copyAllBtn.addEventListener('click', copyAllResults);

    els.themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            els.searchInput.focus();
        }
        if (e.key === 'Escape') {
            forceShowAll = false;
            els.searchInput.value = '';
            els.clearSearchBtn.classList.add('hidden');
            els.searchInput.blur();
            applyFiltersAndSort();
        }
    });

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) renderNextChunk();
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

    // Show logic: Show if searched, OR if group is selected, OR if "Show All" was clicked
    const shouldShowData = query !== '' || group !== 'ALL' || forceShowAll;

    if (!shouldShowData) {
        filteredData = [];
        els.resultsGrid.innerHTML = '';
        els.resultCount.textContent = '0 items';
        
        // Build the dynamic Empty State with the Show All button
        els.emptyState.querySelector('p').innerHTML = `
            Search an item, filter by Group, or <br><br>
            <button id="showAllDataBtn" style="padding: 10px 20px; font-weight: bold; cursor: pointer; background: var(--primary-color); color: white; border: none; border-radius: 6px;">Show All Items</button>
        `;
        
        document.getElementById('showAllDataBtn').addEventListener('click', () => {
            forceShowAll = true;
            applyFiltersAndSort();
        });
        
        toggleState('empty');
        return;
    }

    // Reset empty state text for actual failed searches
    els.emptyState.querySelector('p').textContent = "No items found";

    filteredData = rawData.filter(item => {
        const matchesGroup = group === 'ALL' || item.itemGroup === group;
        if (!matchesGroup) return false;
        
        const searchableText = `${item.itemName} ${item.itemId} ${item.itemGroup} ${item.purchaseRate} ${item.aRate} ${item.bRate}`.toLowerCase();
        return query.split(' ').every(term => searchableText.includes(term));
    });

    filteredData.sort((a, b) => {
        switch(sort) {
            case 'NAME_ASC': return a.itemName.localeCompare(b.itemName);
            case 'NAME_DESC': return b.itemName.localeCompare(a.itemName);
            case 'ARATE_ASC': return a.aRate - b.aRate;
            case 'ARATE_DESC': return b.aRate - a.aRate;
            default: return 0;
        }
    });

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
        card.className = 'item-row';
        
        // Clean 2-line layout
        card.innerHTML = `
            <div class="row-top">
                <div class="row-name" onclick="copyToClipboard('${escapeHTML(item.itemName).replace(/'/g, "\\'")}')" title="Click to copy name">${escapeHTML(item.itemName)}</div>
                <div class="row-rates">
                    <span class="rate-badge rate-a">A: ${formatCurrency(item.aRate)}</span>
                    <span class="rate-badge rate-b">B: ${formatCurrency(item.bRate)}</span>
                </div>
            </div>
            <div class="row-bottom">
                <span class="row-group">${escapeHTML(item.itemGroup) || 'No Group'}</span>
            </div>
        `;
        fragment.appendChild(card);
    });

    els.resultsGrid.appendChild(fragment);
    currentRenderIndex += CHUNK_SIZE;
}

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

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(showToast);
};

function copyAllResults() {
    if (filteredData.length === 0) return;
    const text = filteredData.map(item => `${item.itemName}\t${item.aRate}\t${item.bRate}`).join('\n');
    navigator.clipboard.writeText(`Name\tA Rate\tB Rate\n${text}`).then(showToast);
}

function exportCSV() {
    if (filteredData.length === 0) return;
    const headers = ['Item Name', 'Item Group', 'A Rate', 'B Rate'];
    const csvContent = [
        headers.join(','),
        ...filteredData.map(item => `"${item.itemName}","${item.itemGroup}",${item.aRate},${item.bRate}`)
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
        if (outcome === 'accepted') els.installAppBtn.classList.add('hidden');
        deferredPrompt = null;
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.warn(err));
    });
}
