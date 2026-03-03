/**
 * Article page: load article by id, render content, share bar, related articles.
 * URL structure: /article/{id} (friendly). Legacy /article?id= redirects to canonical.
 * Depends on: filter.js (renderFilterSidebar, loadFilterOptions, getFilterState), seo.js (setPageSEO).
 */

/** Get article id from URL: path /article/{id} or query ?id= */
function getArticleIdFromUrl() {
    var path = window.location.pathname || '';
    var match = path.match(/^\/article\/([^/]+)\/?$/);
    if (match) return decodeURIComponent(match[1]);
    return new URLSearchParams(window.location.search).get('id');
}

/** Canonical article URL (friendly): /article/{id} */
function getArticleUrl(id) {
    return window.location.origin + '/article/' + encodeURIComponent(id);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryColor(category) {
    const colors = {
        'Tin chính': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        'Thể thao': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
        'Giải trí': 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
        'Chính luận': 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300',
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
    // List items: - , • (U+2022), ・ (U+30FB), ◆ (U+25C6 black diamond)
    html = html.replace(/^[-•・◆]\s*(.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, function(match) {
        return '<ul class="list-disc list-inside my-3 space-y-1">' + match + '</ul>';
    });
    // Preserve single line breaks: \n\n = new paragraph, single \n = <br>
    var paraPlaceholder = '<!--\u200bP-->';
    html = html.replace(/\n\n/g, paraPlaceholder);
    html = html.replace(/\n/g, '<br>');
    html = html.replace(new RegExp(paraPlaceholder, 'g'), '</p><p class="mb-3">');
    html = '<p class="mb-3">' + html + '</p>';
    html = html.replace(/<p class="mb-3"><\/p>/g, '');
    html = html.replace(/<p class="mb-3">(\s*<h[23])/g, '$1');
    html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p class="mb-3">(\s*<ul)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
    return html;
}

/** Render article body from content_jp_paragrap_list; each item has translate icon top-left (like title). */
function renderContentFromParagraphList(jpList, vnList) {
    var parts = [];
    var translateIconSvg = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>';
    for (var i = 0; i < jpList.length; i++) {
        var jp = jpList[i];
        var vn = (vnList && vnList[i]) ? vnList[i] : '';
        var hasVn = !!vn;
        var idSuffix = 'p' + i;
        var block = '<div class="relative mt-4 first:mt-0">';
        if (hasVn) {
            block += '<button type="button" class="articleParaTranslateBtn flex-shrink-0 absolute top-0 left-0 min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors z-10" title="Xem bản dịch tiếng Việt" aria-label="Xem bản dịch tiếng Việt" data-para-index="' + idSuffix + '">' + translateIconSvg + '</button>';
            block += '<div class="pl-10 text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">';
        } else {
            block += '<div class="text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">';
        }
        block += '<div id="articleParaJp' + idSuffix + '" class="para-jp">' + markdownToHtml(jp || '') + '</div>';
        if (hasVn) {
            block += '<div id="articleParaVn' + idSuffix + '" class="mt-2 text-gray-600 dark:text-gray-400 hidden para-vn">' + markdownToHtml(vn) + '</div>';
        }
        block += '</div></div>';
        parts.push(block);
    }
    var html = parts.join('');
    return '<div class="article-paragraph-list">' + html + '</div>';
}

async function loadArticle() {
    var id = getArticleIdFromUrl();
    if (!id) {
        document.getElementById('articlePageContent').innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p class="text-gray-600 dark:text-gray-400">Thiếu id bài viết.</p>
                <a href="/" class="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">Quay lại danh sách</a>
            </div>`;
        setPageSEO({
            title: 'Bài viết | Sugoi News',
            description: 'Đọc tin tức Nhật Bản có bản dịch tiếng Việt trên Sugoi News - Học tiếng Nhật qua tin tức. Tổng hợp tin từ Mainichi và nguồn uy tín.',
            keywords: 'học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, tin tức Nhật Bản tiếng Việt, học tiếng Nhật qua đọc tin tức, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, học từ vựng tiếng Nhật qua tin tức, đọc hiểu tiếng Nhật qua bài báo, Sugoi News',
            canonical_url: window.location.origin + '/article',
            og_type: 'website',
            base_url: window.location.origin
        });
        return;
    }
    // Redirect legacy /article?id=xxx to canonical /article/xxx
    var search = window.location.search || '';
    if (search.indexOf('id=') !== -1 && !/^\/article\/[^/]+\/?$/.test(window.location.pathname)) {
        window.location.replace(getArticleUrl(id));
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
            setPageSEO({
                title: 'Không tìm thấy bài viết | Sugoi News',
                description: 'Bài viết không tồn tại hoặc đã bị xóa. Khám phá tin tức Nhật Bản có bản dịch tiếng Việt tại Sugoi News - Học tiếng Nhật qua tin tức.',
                keywords: 'học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo, Sugoi News',
                canonical_url: getArticleUrl(id),
                og_type: 'website',
                base_url: window.location.origin
            });
            return;
        }
        renderArticle(article);
        var base = window.location.origin;
        var displayTitle = article.title || article.title_vn;
        var rawDesc = (article.summary_vn || article.summary || article.content || (article.content_vn_paragrap_list && article.content_vn_paragrap_list.length ? article.content_vn_paragrap_list.join(' ').slice(0, 500) : '') || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        var desc = rawDesc.length > 160 ? rawDesc.slice(0, 157).replace(/\s+\S*$/, '') + '...' : rawDesc;
        // Phase 3.1: Khi description quá ngắn, thêm từ khóa mục tiêu vào cuối (trong giới hạn 160 ký tự)
        var keywordSuffix = ' Đọc tin Nhật có dịch tiếng Việt miễn phí tại Sugoi News. Tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo.';
        if (desc && desc.length < 100) {
            var combined = (desc + keywordSuffix).trim();
            desc = combined.length > 160 ? combined.slice(0, 157).replace(/\s+\S*$/, '') + '...' : combined;
        } else if (!desc || !desc.length) {
            desc = 'Đọc tin Nhật có dịch tiếng Việt miễn phí trên Sugoi News. Tin tức Mainichi tiếng Việt, học từ vựng và đọc hiểu tiếng Nhật qua bài báo.';
        }
        setPageSEO({
            title: (displayTitle || 'Bài viết') + ' | Sugoi News',
            description: desc || (displayTitle || 'Đọc bài viết trên Sugoi News.'),
            keywords: (article.category ? article.category + ', ' : '') + 'học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, tin tức Nhật Bản tiếng Việt, học tiếng Nhật qua đọc tin tức, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, học từ vựng tiếng Nhật qua tin tức, đọc hiểu tiếng Nhật qua bài báo, Sugoi News',
            image: article.content_top_image || article.thumbnail || '',
            canonical_url: getArticleUrl(article.id),
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
        setPageSEO({
            title: (id ? 'Lỗi tải bài viết' : 'Bài viết') + ' | Sugoi News',
            description: 'Đọc tin tức Nhật Bản có bản dịch tiếng Việt trên Sugoi News - Học tiếng Nhật qua tin tức. Tổng hợp tin từ Mainichi và nguồn uy tín.',
            keywords: 'học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo, Sugoi News',
            canonical_url: id ? getArticleUrl(id) : (window.location.origin + window.location.pathname),
            og_type: 'website',
            base_url: window.location.origin
        });
    }
}

function renderArticle(article) {
    const displayTitle = article.title || article.title_vn;
    // Title already set by setPageSEO in loadArticle as "{Tiêu đề} | Sugoi News"
    const publishedDate = article.published ? new Date(article.published).toLocaleDateString('vi-VN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }) : '';
    const publishedISO = article.published ? new Date(article.published).toISOString() : '';
    const heroImage = article.content_top_image || article.thumbnail || 'https://picsum.photos/seed/' + encodeURIComponent(displayTitle) + '/1200/600';
    const canonicalUrl = getArticleUrl(article.id);
    const jpList = article.content_jp_paragrap_list;
    const vnList = article.content_vn_paragrap_list || [];
    const hasParagraphList = Array.isArray(jpList) && jpList.length > 0;
    const contentHtml = hasParagraphList
        ? renderContentFromParagraphList(jpList, vnList)
        : '<div class="text-gray-700 dark:text-gray-300 leading-relaxed text-base sm:text-lg">' + markdownToHtml((vnList.length ? vnList.join('\n\n') : null) || article.content || (article.summary_vn || article.summary) || 'Không có nội dung chi tiết.') + '</div>';
    const shareUrl = getArticleUrl(article.id);
    const shareTitle = displayTitle;
    var rawDesc = (article.summary_vn || article.summary || article.content || (article.content_vn_paragrap_list && article.content_vn_paragrap_list.length ? article.content_vn_paragrap_list.join(' ').slice(0, 500) : '') || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const shareDescription = rawDesc.length > 160 ? rawDesc.slice(0, 157).replace(/\s+\S*$/, '') + '...' : rawDesc;

    document.getElementById('articlePageContent').innerHTML = `
        <!-- SEO: Breadcrumb Navigation -->
        <nav class="mb-4" aria-label="Breadcrumb">
            <ol class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="/" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Trang chủ</a></li>
                <li><span class="mx-2">/</span></li>
                ${article.category ? `<li><a href="/?category=${encodeURIComponent(article.category)}" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">${escapeHtml(article.category)}</a></li><li><span class="mx-2">/</span></li>` : ''}
                <li class="text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs sm:max-w-md" aria-current="page">${escapeHtml(displayTitle)}</li>
            </ol>
        </nav>

        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <div class="relative">
                <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(displayTitle)}"
                    class="w-full h-72 sm:h-96 object-cover"
                    loading="lazy"
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
                <div class="flex items-start gap-3 mb-4">
                    ${article.title_vn ? `
                    <button type="button" id="articleToggleTitleVn" class="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors mt-1" title="Xem bản dịch tiếng Việt" aria-label="Xem bản dịch tiếng Việt">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
                    </button>
                    ` : ''}
                    <div class="flex-1 min-w-0">
                        <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 leading-tight">${escapeHtml(displayTitle)}</h1>
                        ${article.title_vn ? `
                        <p id="articleTitleVn" class="mt-2 text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed hidden">${escapeHtml(article.title_vn)}</p>
                        ` : ''}
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                    ${publishedISO ? `
                    <time datetime="${publishedISO}" class="flex items-center">
                        <svg class="w-5 h-5 mr-2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        ${escapeHtml(publishedDate)}
                    </time>
                    ` : ''}
                    <span class="text-gray-400 dark:text-gray-500">|</span>
                    <div class="flex items-center gap-2" id="articleShareBar" data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(shareTitle)}" data-share-description="${escapeHtml(shareDescription)}">
                        <span class="text-gray-600 dark:text-gray-300 font-medium">Chia sẻ:</span>
                        <a href="#" data-share="facebook" class="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex" title="Chia sẻ lên Facebook" aria-label="Chia sẻ Facebook"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
                        <a href="#" data-share="twitter" class="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 hover:text-sky-500 dark:hover:text-sky-400 transition-colors inline-flex" title="Chia sẻ lên X (Twitter)" aria-label="Chia sẻ X"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                        <a href="#" data-share="zalo" class="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors inline-flex" title="Chia sẻ qua Zalo" aria-label="Chia sẻ Zalo"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg></a>
                        <a href="#" data-share="linkedin" class="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-[#0a66c2] transition-colors inline-flex" title="Chia sẻ lên LinkedIn" aria-label="Chia sẻ LinkedIn"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
                        <button type="button" data-share="copy" class="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer border-0 inline-flex" title="Sao chép link" aria-label="Sao chép link"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
                    </div>
                </div>
                <div class="prose prose-lg prose-gray dark:prose-invert max-w-none">
                    ${contentHtml}
                </div>
                <div class="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                    ${article.link ? '<p class="text-sm text-gray-500 dark:text-gray-400"><span class="font-medium text-gray-600 dark:text-gray-300">Nguồn:</span> <span class="break-all">' + escapeHtml(article.link) + '</span></p>' : ''}
                </div>
            </div>
        </div>`;
    var toggleBtn = document.getElementById('articleToggleTitleVn');
    var titleVnEl = document.getElementById('articleTitleVn');
    if (toggleBtn && titleVnEl) {
        toggleBtn.addEventListener('click', function() {
            titleVnEl.classList.toggle('hidden');
        });
    }
    document.querySelectorAll('.articleParaTranslateBtn').forEach(function(btn) {
        var idx = btn.getAttribute('data-para-index');
        var vnEl = idx ? document.getElementById('articleParaVn' + idx) : null;
        if (vnEl) {
            btn.addEventListener('click', function() {
                vnEl.classList.toggle('hidden');
            });
        }
    });
    setupArticleShareBar();
    injectStructuredData(article, displayTitle, heroImage, canonicalUrl, publishedISO);
}

// SEO: Inject structured data (JSON-LD) for Article schema (Schema.org NewsArticle)
function injectStructuredData(article, displayTitle, heroImage, canonicalUrl, publishedISO) {
    // Remove existing structured data if any
    const existingScript = document.querySelector('script[type="application/ld+json"][data-article-schema]');
    if (existingScript) existingScript.remove();

    const origin = window.location.origin;
    const imageUrl = heroImage.startsWith('http') ? heroImage : (origin + heroImage);
    // Google: image can be URL or ImageObject; array recommended for multiple images
    const imageForSchema = imageUrl ? [{
        "@type": "ImageObject",
        "url": imageUrl
    }] : undefined;

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": displayTitle,
        "description": (article.summary_vn || article.summary || '').replace(/<[^>]+>/g, ' ').substring(0, 200),
        "image": imageForSchema,
        "datePublished": publishedISO || undefined,
        "dateModified": article.updated_at ? (new Date(article.updated_at).toISOString()) : publishedISO || undefined,
        "author": {
            "@type": "Organization",
            "name": article.source || "Sugoi News"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Sugoi News",
            "logo": {
                "@type": "ImageObject",
                "url": origin + "/static/img/og-default.png",
                "width": 1200,
                "height": 630
            }
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": canonicalUrl
        },
        "articleSection": article.category || undefined,
        "inLanguage": ["ja", "vi"]
    };

    // Remove undefined values
    Object.keys(structuredData).forEach(key => {
        if (structuredData[key] === undefined) {
            delete structuredData[key];
        }
    });

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-article-schema', 'true');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
    
    // Add BreadcrumbList schema
    injectBreadcrumbSchema(article, canonicalUrl);
}

// SEO: Inject BreadcrumbList schema
function injectBreadcrumbSchema(article, canonicalUrl) {
    const existingBreadcrumb = document.querySelector('script[type="application/ld+json"][data-breadcrumb-schema]');
    if (existingBreadcrumb) existingBreadcrumb.remove();
    
    const baseUrl = window.location.origin;
    const breadcrumbItems = [
        {
            "@type": "ListItem",
            "position": 1,
            "name": "Trang chủ",
            "item": baseUrl + "/"
        }
    ];
    
    if (article.category) {
        breadcrumbItems.push({
            "@type": "ListItem",
            "position": 2,
            "name": article.category,
            "item": baseUrl + "/?category=" + encodeURIComponent(article.category)
        });
    }
    
    const displayTitle = article.title || article.title_vn || "Bài viết";
    breadcrumbItems.push({
        "@type": "ListItem",
        "position": breadcrumbItems.length + 1,
        "name": displayTitle,
        "item": canonicalUrl
    });
    
    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbItems
    };
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-breadcrumb-schema', 'true');
    script.textContent = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(script);
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
            const displayTitle = article.title || article.title_vn;
            const thumbnail = article.thumbnail || 'https://picsum.photos/seed/' + encodeURIComponent(displayTitle) + '/400/240';
            const url = '/article/' + encodeURIComponent(article.id);
            return '<a href="' + escapeHtml(url) + '" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all block group">' +
                '<div class="relative h-32 overflow-hidden">' +
                '<img src="' + escapeHtml(thumbnail) + '" alt="' + escapeHtml(displayTitle) + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"' +
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
    // Load article immediately; don't block on filter options (so /api/categories hang/failure doesn't leave page stuck on "Đang tải bài viết...")
    loadArticle();
    loadFilterOptions(filterState).catch(function() { /* sidebar may stay empty on error */ });
    loadSharedHeaderData();
    setupSearchRedirect();
    setupFilterRedirect();
});
