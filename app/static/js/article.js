/**
 * Article page: load article by id, render content, share bar, related articles.
 * Depends on: filter.js (renderFilterSidebar, loadFilterOptions, getFilterState), seo.js (setPageSEO).
 */

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

function markdownToHtml(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">$1</h2>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/^[-•] (.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, function(match) {
        return '<ul class="list-disc list-inside my-3 space-y-1">' + match + '</ul>';
    });
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');
    html = '<p class="mb-3">' + html + '</p>';
    html = html.replace(/<p class="mb-3"><\/p>/g, '');
    html = html.replace(/<p class="mb-3">(\s*<h[23])/g, '$1');
    html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p class="mb-3">(\s*<ul)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
    return html;
}

async function loadArticle() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) {
        document.getElementById('articlePageContent').innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p class="text-gray-600 dark:text-gray-400">Thiếu id bài viết.</p>
                <a href="/" class="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">Quay lại danh sách</a>
            </div>`;
        return;
    }
    try {
        const res = await fetch('/api/articles/' + encodeURIComponent(id));
        const article = await res.json();
        if (article.error) {
            document.getElementById('articlePageContent').innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
                    <p class="text-gray-600 dark:text-gray-400">Không tìm thấy bài viết.</p>
                    <a href="/" class="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">Quay lại danh sách</a>
                </div>`;
            return;
        }
        renderArticle(article);
        var base = window.location.origin;
        var displayTitle = article.title_vn || article.title;
        var rawDesc = (article.summary_vn || article.summary || article.content || article.content_VN || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        var desc = rawDesc.length > 160 ? rawDesc.slice(0, 157).replace(/\s+\S*$/, '') + '...' : rawDesc;
        setPageSEO({
            title: (displayTitle || 'Bài viết') + ' | News AI',
            description: desc || (displayTitle || 'Đọc bài viết trên News AI.'),
            keywords: (article.category ? article.category + ', ' : '') + 'tin tức, news, AI, dịch tin tức, tổng hợp tin',
            image: article.content_top_image || article.thumbnail || '',
            canonical_url: base + '/article?id=' + encodeURIComponent(article.id),
            og_type: 'article',
            article_published_time: article.published ? new Date(article.published).toISOString() : undefined,
            article_author: article.source || undefined,
            article_section: article.category || undefined,
            base_url: base
        });
        loadRelatedArticles(article.category, article.id);
    } catch (e) {
        document.getElementById('articlePageContent').innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p class="text-gray-600 dark:text-gray-400">Lỗi tải bài viết.</p>
                <a href="/" class="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">Quay lại danh sách</a>
            </div>`;
    }
}

function renderArticle(article) {
    const displayTitle = article.title_vn || article.title;
    document.title = escapeHtml(displayTitle) + ' - News AI';
    const publishedDate = article.published ? new Date(article.published).toLocaleDateString('vi-VN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }) : '';
    const heroImage = article.content_top_image || article.thumbnail || 'https://picsum.photos/seed/' + encodeURIComponent(displayTitle) + '/1200/600';
    const content = article.content_VN || article.content || (article.summary_vn || article.summary) || 'Không có nội dung chi tiết.';
    const shareUrl = window.location.origin + '/article?id=' + encodeURIComponent(article.id);
    const shareTitle = displayTitle;
    var rawDesc = (article.summary_vn || article.summary || article.content || article.content_VN || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const shareDescription = rawDesc.length > 160 ? rawDesc.slice(0, 157).replace(/\s+\S*$/, '') + '...' : rawDesc;

    document.getElementById('articlePageContent').innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <div class="relative">
                <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(displayTitle)}"
                    class="w-full h-72 sm:h-96 object-cover"
                    onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221200%22 height=%22600%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext fill=%22%239ca3af%22 font-family=%22sans-serif%22 font-size=%2224%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div class="absolute bottom-4 left-4 right-4">
                    <div class="flex flex-wrap gap-2 mb-3">
                        <span class="px-3 py-1 text-sm font-medium ${getCategoryColor(article.category)} rounded-full backdrop-blur-sm">${escapeHtml(article.category)}</span>
                        <span class="px-3 py-1 text-sm font-medium bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 rounded-full backdrop-blur-sm">${escapeHtml(article.source || 'Unknown')}</span>
                    </div>
                </div>
            </div>
            <div class="p-6 sm:p-8 lg:p-10">
                <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">${escapeHtml(displayTitle)}</h1>
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                    <span class="flex items-center">
                        <svg class="w-5 h-5 mr-2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        ${escapeHtml(publishedDate)}
                    </span>
                    <span class="text-gray-400 dark:text-gray-500">|</span>
                    <div class="flex items-center gap-2" id="articleShareBar" data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(shareTitle)}" data-share-description="${escapeHtml(shareDescription)}">
                        <span class="text-gray-600 dark:text-gray-300 font-medium">Chia sẻ:</span>
                        <a href="#" data-share="facebook" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Chia sẻ lên Facebook" aria-label="Chia sẻ Facebook"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                        <a href="#" data-share="twitter" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 hover:text-sky-500 dark:hover:text-sky-400 transition-colors" title="Chia sẻ lên X (Twitter)" aria-label="Chia sẻ X"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                        <a href="#" data-share="zalo" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors" title="Chia sẻ qua Zalo" aria-label="Chia sẻ Zalo"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg></a>
                        <a href="#" data-share="linkedin" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-[#0a66c2] transition-colors" title="Chia sẻ lên LinkedIn" aria-label="Chia sẻ LinkedIn"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
                        <button type="button" data-share="copy" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer border-0" title="Sao chép link" aria-label="Sao chép link"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
                    </div>
                </div>
                <div class="prose prose-lg prose-gray dark:prose-invert max-w-none">
                    <div class="text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">${markdownToHtml(content)}</div>
                </div>
                <div class="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                    ${article.link ? '<p class="text-sm text-gray-500 dark:text-gray-400"><span class="font-medium text-gray-600 dark:text-gray-300">Nguồn:</span> <span class="break-all">' + escapeHtml(article.link) + '</span></p>' : ''}
                </div>
            </div>
        </div>`;
    setupArticleShareBar();
}

function setupArticleShareBar() {
    var bar = document.getElementById('articleShareBar');
    if (!bar) return;
    var url = bar.getAttribute('data-share-url') || window.location.href;
    var title = bar.getAttribute('data-share-title') || document.title;
    var description = bar.getAttribute('data-share-description') || '';
    var encodedUrl = encodeURIComponent(url);
    var tweetText = title + (description ? ' - ' + description : '');
    if (tweetText.length > 250) tweetText = tweetText.slice(0, 247) + '...';
    var encodedTweetText = encodeURIComponent(tweetText);
    var facebookQuote = (title + (description ? ' - ' + description : '')).slice(0, 200);
    var shareUrls = {
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl + '&quote=' + encodeURIComponent(facebookQuote),
        twitter: 'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedTweetText,
        zalo: 'https://sp.zalo.me/share_inline?u=' + encodedUrl + (title ? '&title=' + encodeURIComponent(title) : '') + (description ? '&desc=' + encodeURIComponent(description.slice(0, 200)) : ''),
        linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl
    };
    bar.querySelectorAll('[data-share]').forEach(function(el) {
        var kind = el.getAttribute('data-share');
        if (kind === 'copy') {
            el.addEventListener('click', function() {
                var copyText = title + (description ? '\n\n' + description + '\n\n' : '\n\n') + url;
                navigator.clipboard.writeText(copyText).then(function() {
                    var toast = document.createElement('div');
                    toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-gray-800 dark:bg-gray-700 text-white text-sm shadow-lg z-50 fade-in';
                    toast.textContent = 'Đã sao chép (tiêu đề + mô tả + link)!';
                    document.body.appendChild(toast);
                    setTimeout(function() { toast.remove(); }, 2000);
                });
            });
            return;
        }
        if (shareUrls[kind]) {
            el.addEventListener('click', function(e) {
                e.preventDefault();
                if (kind === 'facebook') {
                    var copyText = title + (description ? '\n\n' + description + '\n\n' : '\n\n') + url;
                    navigator.clipboard.writeText(copyText).then(function() {
                        window.open(shareUrls[kind], 'share', 'width=600,height=500,scrollbars=yes');
                        var toast = document.createElement('div');
                        toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg bg-gray-800 dark:bg-gray-700 text-white text-sm shadow-lg z-50 fade-in max-w-sm text-center';
                        toast.innerHTML = 'Đã copy nội dung. <strong>Dán (Ctrl+V)</strong> vào bài viết Facebook để có chữ + link preview.';
                        document.body.appendChild(toast);
                        setTimeout(function() { toast.remove(); }, 4500);
                    });
                } else {
                    window.open(shareUrls[kind], 'share', 'width=600,height=400,scrollbars=yes');
                }
            });
        }
    });
}

async function loadRelatedArticles(category, excludeId) {
    try {
        const params = new URLSearchParams({ page: 1, page_size: 5, category: category });
        const res = await fetch('/api/articles?' + params);
        const data = await res.json();
        const related = data.articles.filter(function(a) { return a.id !== excludeId; }).slice(0, 4);
        const grid = document.getElementById('relatedArticlesGrid');
        const section = document.getElementById('relatedSection');
        if (related.length === 0) {
            section.classList.add('hidden');
            return;
        }
        section.classList.remove('hidden');
        grid.innerHTML = related.map(function(article) {
            const displayTitle = article.title_vn || article.title;
            const thumbnail = article.thumbnail || 'https://picsum.photos/seed/' + encodeURIComponent(displayTitle) + '/400/240';
            const url = '/article?id=' + encodeURIComponent(article.id);
            return '<a href="' + escapeHtml(url) + '" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all block group">' +
                '<div class="relative h-32 overflow-hidden">' +
                '<img src="' + escapeHtml(thumbnail) + '" alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"' +
                ' onerror="this.onerror=null;this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22240%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22100%25%22 height=%22100%25%22/%3E%3C/svg%3E\'">' +
                '</div>' +
                '<div class="p-3">' +
                '<h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">' + escapeHtml(displayTitle) + '</h3>' +
                '<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">' + escapeHtml(article.source || 'Unknown') + '</p>' +
                '</div></a>';
        }).join('');
    } catch (e) {
        document.getElementById('relatedSection').classList.add('hidden');
    }
}

function loadSharedHeaderData() {
    fetch('/api/stats').then(function(r) { return r.json(); }).then(function(data) {
        var el = document.getElementById('totalArticles');
        if (el) el.textContent = data.total_articles.toLocaleString();
        el = document.getElementById('translatedArticles');
        if (el) el.textContent = data.translated_articles.toLocaleString();
    }).catch(function() {});
}

function goToIndexWithParams(params) {
    var q = new URLSearchParams(params);
    window.location.href = '/' + (q.toString() ? '?' + q.toString() : '');
}

function getArticleFilterParams() {
    var state = getFilterState();
    var params = {};
    if (state.category) params.category = state.category;
    return params;
}

function setupSearchRedirect() {
    var searchInput = document.getElementById('searchInput');
    var searchInputMobile = document.getElementById('searchInputMobile');
    function redirectSearch() {
        var params = getArticleFilterParams();
        var q = (searchInput && searchInput.value.trim()) || (searchInputMobile && searchInputMobile.value.trim()) || '';
        if (q) params.search = q;
        goToIndexWithParams(params);
    }
    if (searchInput) {
        searchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); redirectSearch(); } });
    }
    if (searchInputMobile) {
        searchInputMobile.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); redirectSearch(); } });
        searchInputMobile.addEventListener('input', function() { if (searchInput) searchInput.value = searchInputMobile.value; });
    }
    var searchBtn = document.getElementById('searchBtn');
    var searchBtnMobile = document.getElementById('searchBtnMobile');
    if (searchBtn) searchBtn.addEventListener('click', redirectSearch);
    if (searchBtnMobile) searchBtnMobile.addEventListener('click', redirectSearch);
}

function setupFilterRedirect() {
    var categoryFilter = document.getElementById('categoryFilter');
    function redirectFilter() {
        var params = getArticleFilterParams();
        var searchInput = document.getElementById('searchInput');
        var searchInputMobile = document.getElementById('searchInputMobile');
        var q = (searchInput && searchInput.value.trim()) || (searchInputMobile && searchInputMobile.value.trim()) || '';
        if (q) params.search = q;
        goToIndexWithParams(params);
    }
    if (categoryFilter) categoryFilter.addEventListener('change', redirectFilter);
}

document.addEventListener('DOMContentLoaded', async function() {
    var params = new URLSearchParams(window.location.search);
    var filterState = { category: params.get('category') || '' };
    renderFilterSidebar('filterSidebarContainer');
    await loadFilterOptions(filterState);
    loadArticle();
    loadSharedHeaderData();
    setupSearchRedirect();
    setupFilterRedirect();
});
