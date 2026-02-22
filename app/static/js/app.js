// News AI Application

// State
let currentPage = 1;
let pageSize = 100;
let totalPages = 1;
let currentCategory = '';
let currentSearch = '';

// DOM Elements
let articlesGrid;
let loadingSkeleton;
let emptyState;
let pagination;
let categoryFilter;
let searchInput;
let searchInputMobile;
let pageSizeSelect;
let resultCount;
let totalArticlesEl;
let translatedArticlesEl;
let featuredSection;
let featuredGrid;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    applyParamsFromUrl();
    renderFilterSidebar('filterSidebarContainer');
    await loadFilterOptions({ category: currentCategory });
    initDomElements();
    if (isHomeView()) {
        await loadFeatured();
    } else {
        hideFeatured();
    }
    loadArticles();
    setupEventListeners();
});

// Initialize DOM elements
function initDomElements() {
    articlesGrid = document.getElementById('articlesGrid');
    loadingSkeleton = document.getElementById('loadingSkeleton');
    emptyState = document.getElementById('emptyState');
    pagination = document.getElementById('pagination');
    categoryFilter = document.getElementById('categoryFilter');
    searchInput = document.getElementById('searchInput');
    searchInputMobile = document.getElementById('searchInputMobile');
    pageSizeSelect = document.getElementById('pageSizeSelect');
    resultCount = document.getElementById('resultCount');
    totalArticlesEl = document.getElementById('totalArticles');
    translatedArticlesEl = document.getElementById('translatedArticles');
    featuredSection = document.getElementById('featuredSection');
    featuredGrid = document.getElementById('featuredGrid');
}

function isHomeView() {
    return !currentCategory && !currentSearch;
}

async function loadFeatured() {
    if (!featuredSection || !featuredGrid) return;
    try {
        const response = await fetch('/api/featured?limit=3');
        const articles = await response.json();
        if (articles.length > 0) {
            renderFeatured(articles);
            featuredSection.classList.remove('hidden');
        } else {
            featuredSection.classList.add('hidden');
        }
    } catch (e) {
        featuredSection.classList.add('hidden');
    }
}

function hideFeatured() {
    if (featuredSection) featuredSection.classList.add('hidden');
}

function renderFeatured(articles) {
    if (!featuredGrid) return;
    featuredGrid.innerHTML = '';
    articles.forEach((article, index) => {
        const card = createFeaturedCard(article, index);
        featuredGrid.appendChild(card);
    });
}

function createFeaturedCard(article, index) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 cursor-pointer fade-in';
    div.style.animationDelay = `${index * 80}ms`;
    div.onclick = () => { window.location.href = '/article?id=' + encodeURIComponent(article.id); };

    const displayTitle = article.title_vn || article.title;
    const thumbnail = article.thumbnail || article.content_top_image || `https://picsum.photos/seed/${encodeURIComponent(displayTitle)}/400/240`;
    const publishedDate = article.published ? new Date(article.published).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : '';
    const sourceLabel = article.source || 'Unknown';
    const categoryColor = getCategoryColor(article.category);
    const summaryPlain = stripHtml(article.summary_vn || article.summary || '');

    div.innerHTML = `
        <div class="relative h-44 sm:h-52 overflow-hidden">
            <img src="${thumbnail}" alt="${escapeHtml(displayTitle)}"
                class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22240%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="absolute top-3 left-3 flex flex-wrap gap-2">
                <span class="px-2.5 py-1 text-xs font-medium rounded-full ${categoryColor}">
                    ${escapeHtml(article.category)}
                </span>
            </div>
            <div class="absolute top-3 right-3">
                <span class="px-2.5 py-1 text-xs font-medium bg-black/60 text-white rounded-full">
                    ${escapeHtml(sourceLabel)}
                </span>
            </div>
        </div>
        <div class="p-4 sm:p-5">
            <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 leading-snug">
                ${escapeHtml(displayTitle)}
            </h3>
            <p class="article-card-summary text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                ${escapeHtml(summaryPlain.slice(0, 120))}${summaryPlain.length > 120 ? '…' : ''}
            </p>
            <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>${publishedDate}</span>
                <span class="flex items-center">Đọc tiếp →</span>
            </div>
        </div>
    `;
    return div;
}

// Apply search/filter from URL (e.g. when redirecting from article page)
function applyParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search') || '';
    const category = params.get('category') || '';
    currentSearch = search;
    currentCategory = category;
    if (searchInput) searchInput.value = search;
    if (searchInputMobile) searchInputMobile.value = search;
}

// Sync URL with current filter state (clear search from URL when user selects category)
function updateUrlFromState() {
    const params = new URLSearchParams();
    if (currentCategory) params.set('category', currentCategory);
    if (currentSearch) params.set('search', currentSearch);
    const query = params.toString();
    const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', url);
}

// Setup event listeners
function setupEventListeners() {
    categoryFilter.addEventListener('change', () => {
        currentCategory = categoryFilter.value;
        currentSearch = '';
        currentPage = 1;
        if (searchInput) searchInput.value = '';
        if (searchInputMobile) searchInputMobile.value = '';
        updateUrlFromState();
        if (!isHomeView()) hideFeatured();
        loadArticles();
    });

    let searchTimeout;
    const handleSearch = (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value;
            currentPage = 1;
            loadArticles();
        }, 300);
    };

    searchInput.addEventListener('input', handleSearch);
    searchInputMobile.addEventListener('input', (e) => {
        searchInput.value = e.target.value;
        handleSearch(e);
    });

    const doSearch = () => {
        currentSearch = (searchInput && searchInput.value.trim()) || (searchInputMobile && searchInputMobile.value.trim()) || '';
        currentCategory = '';
        currentPage = 1;
        if (typeof setCategoryFilterValue === 'function') setCategoryFilterValue('');
        updateUrlFromState();
        if (!isHomeView()) hideFeatured();
        loadArticles();
    };
    const searchBtn = document.getElementById('searchBtn');
    const searchBtnMobile = document.getElementById('searchBtnMobile');
    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (searchBtnMobile) searchBtnMobile.addEventListener('click', doSearch);

    pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value);
        currentPage = 1;
        loadArticles();
    });
}

// Filter UI is rendered and loaded by filter.js (renderFilterSidebar + loadFilterOptions)

// Load articles
async function loadArticles() {
    if (isHomeView() && featuredSection && featuredGrid) {
        loadFeatured();
    } else {
        hideFeatured();
    }
    showLoading();

    const params = new URLSearchParams({
        page: currentPage,
        page_size: pageSize,
    });

    if (currentCategory) params.append('category', currentCategory);
    if (currentSearch) params.append('search', currentSearch);

    try {
        const response = await fetch(`/api/articles?${params}`);
        const data = await response.json();

        totalPages = data.total_pages;
        resultCount.textContent = data.total.toLocaleString();

        if (data.articles.length === 0) {
            showEmpty();
        } else {
            renderArticles(data.articles);
            renderPagination();
        }
    } catch (error) {
        console.error('Error loading articles:', error);
        showEmpty();
    }
}

// Show loading skeleton
function showLoading() {
    articlesGrid.innerHTML = '';
    emptyState.classList.add('hidden');
    
    for (let i = 0; i < pageSize; i++) {
        const skeleton = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="h-48 skeleton"></div>
                <div class="p-5">
                    <div class="h-4 skeleton rounded mb-3 w-1/4"></div>
                    <div class="h-5 skeleton rounded mb-2"></div>
                    <div class="h-5 skeleton rounded mb-4 w-3/4"></div>
                    <div class="h-3 skeleton rounded mb-2"></div>
                    <div class="h-3 skeleton rounded w-2/3"></div>
                </div>
            </div>
        `;
        articlesGrid.innerHTML += skeleton;
    }
}

// Show empty state
function showEmpty() {
    articlesGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    pagination.innerHTML = '';
}

// Render articles
function renderArticles(articles) {
    emptyState.classList.add('hidden');
    articlesGrid.innerHTML = '';

    articles.forEach((article, index) => {
        const card = createArticleCard(article, index);
        articlesGrid.appendChild(card);
    });
}

// Create article card
function createArticleCard(article, index) {
    const div = document.createElement('div');
    div.className = 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 cursor-pointer fade-in';
    div.style.animationDelay = `${index * 50}ms`;
    div.onclick = () => { window.location.href = '/article?id=' + encodeURIComponent(article.id); };

    const displayTitle = article.title_vn || article.title;
    const thumbnail = article.thumbnail || `https://picsum.photos/seed/${encodeURIComponent(displayTitle)}/400/240`;
    const publishedDate = article.published ? new Date(article.published).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : '';

    const sourceLabel = article.source || 'Unknown';
    const categoryColor = getCategoryColor(article.category);

    div.innerHTML = `
        <div class="relative h-48 overflow-hidden">
            <img src="${thumbnail}" alt="${escapeHtml(displayTitle)}" 
                class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22240%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2216%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="absolute top-3 left-3 flex flex-wrap gap-2">
                <span class="px-2.5 py-1 text-xs font-medium rounded-full ${categoryColor}">
                    ${escapeHtml(article.category)}
                </span>
            </div>
            <div class="absolute top-3 right-3">
                <span class="px-2.5 py-1 text-xs font-medium bg-black/60 text-white rounded-full">
                    ${escapeHtml(sourceLabel)}
                </span>
            </div>
        </div>
        <div class="p-5">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 line-clamp-2 leading-snug">
                ${escapeHtml(displayTitle)}
            </h3>
            <p class="article-card-summary text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
                ${escapeHtml(stripHtml(article.summary_vn || article.summary || ''))}
            </p>
            <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>${publishedDate}</span>
                <span class="flex items-center">
                    <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    Đọc tiếp
                </span>
            </div>
        </div>
    `;

    return div;
}

// Get category color
function getCategoryColor(category) {
    const colors = {
        'Tin thế giới': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        'Kinh tế': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
        'Công nghệ': 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
        'Khoa học & Môi trường': 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
        'Sức khỏe': 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
        'Thể thao': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
        'Crypto': 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
        'Reuters World': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    };
    return colors[category] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300';
}

// Render pagination
function renderPagination() {
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = `px-3 py-2 text-sm rounded-lg ${currentPage === 1 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`;
    prevBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
    `;
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadArticles();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    pagination.appendChild(prevBtn);

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pagination.appendChild(createPageButton(1));
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'px-2 py-2 text-gray-400 dark:text-gray-500';
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createPageButton(i));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'px-2 py-2 text-gray-400 dark:text-gray-500';
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
        pagination.appendChild(createPageButton(totalPages));
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = `px-3 py-2 text-sm rounded-lg ${currentPage === totalPages ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`;
    nextBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
        </svg>
    `;
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadArticles();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    pagination.appendChild(nextBtn);
}

// Create page button
function createPageButton(page) {
    const btn = document.createElement('button');
    btn.className = `w-10 h-10 text-sm rounded-lg transition-colors ${
        page === currentPage 
            ? 'bg-blue-600 text-white font-medium' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`;
    btn.textContent = page;
    btn.onclick = () => {
        currentPage = page;
        loadArticles();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    return btn;
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Strip HTML tags so summary_vn with <p>, <img> etc. shows as plain text (avoids float/layout affecting text in dark mode)
function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

// Strip markdown syntax for plain text display
function stripMarkdown(text) {
    if (!text) return '';
    let plain = text;
    // Remove headers
    plain = plain.replace(/^#{1,6}\s+/gm, '');
    // Remove bold/italic markers
    plain = plain.replace(/\*\*([^*]+)\*\*/g, '$1');
    plain = plain.replace(/\*([^*]+)\*/g, '$1');
    // Remove bullet points
    plain = plain.replace(/^[-•]\s+/gm, '');
    return escapeHtml(plain);
}

// Convert markdown to HTML (basic support)
function markdownToHtml(text) {
    if (!text) return '';
    
    // First escape HTML to prevent XSS
    let html = escapeHtml(text);
    
    // Convert headers (## and ###)
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">$1</h2>');
    
    // Convert bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convert italic *text* (but not if it's part of **)
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Convert bullet points (- or •)
    html = html.replace(/^[-•] (.+)$/gm, '<li class="ml-4">$1</li>');
    
    // Wrap consecutive <li> tags in <ul>
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, function(match) {
        return '<ul class="list-disc list-inside my-3 space-y-1">' + match + '</ul>';
    });
    
    // Convert line breaks to paragraphs for better readability
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');
    html = '<p class="mb-3">' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p class="mb-3"><\/p>/g, '');
    html = html.replace(/<p class="mb-3">(\s*<h[23])/g, '$1');
    html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p class="mb-3">(\s*<ul)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
    
    return html;
}
