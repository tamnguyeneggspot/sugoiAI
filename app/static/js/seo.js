/**
 * SEO module - used for all pages. Sets document title, meta description,
 * keywords, Open Graph and Twitter Card tags for professional, consistent SEO.
 */
(function (global) {
    'use strict';

    var SITE_NAME = 'Sugoi News';
    var META_DESC_MAX = 160;

    function escapeAttr(str) {
        if (str == null || str === '') return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML.replace(/"/g, '&quot;');
    }

    function setOrCreateMeta(attr, value, isProperty) {
        if (!value) return;
        var name = isProperty ? 'property' : 'name';
        var selector = isProperty ? 'meta[property="' + escapeAttr(attr) + '"]' : 'meta[name="' + escapeAttr(attr) + '"]';
        var el = document.querySelector(selector);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(name, attr);
            document.head.appendChild(el);
        }
        el.setAttribute('content', value);
    }

    function setOrCreateLink(rel, href) {
        if (!href) return;
        var el = document.querySelector('link[rel="' + rel + '"]');
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            document.head.appendChild(el);
        }
        el.setAttribute('href', href);
    }

    /**
     * Set page SEO for all pages. Call on every page (home, article, category, search).
     * @param {Object} options - SEO options (from API /api/seo or built manually)
     * @param {string} [options.title] - Page title (document.title)
     * @param {string} [options.description] - Meta description (truncate to ~160 chars)
     * @param {string} [options.keywords] - Meta keywords
     * @param {string} [options.image] - Absolute image URL for og:image / twitter:image
     * @param {string} [options.canonical_url] - Canonical URL
     * @param {string} [options.og_type] - og:type (website | article)
     * @param {string} [options.article_published_time] - ISO date for article
     * @param {string} [options.article_author] - Author/source for article
     * @param {string} [options.article_section] - Section/category for article
     */
    function setPageSEO(options) {
        if (!options || typeof options !== 'object') return;
        var title = (options.title || '').trim();
        var description = (options.description || '').trim();
        if (description.length > META_DESC_MAX) {
            description = description.slice(0, META_DESC_MAX - 3).replace(/\s+\S*$/, '') + '...';
        }
        var keywords = (options.keywords || '').trim();
        var image = (options.image || '').trim();
        var canonicalUrl = (options.canonical_url || '').trim();
        var ogType = (options.og_type || 'website').toLowerCase();
        var baseUrl = (options.base_url || window.location.origin || '').replace(/\/$/, '');
        if (image && !/^https?:\/\//i.test(image)) {
            image = baseUrl + (image.indexOf('/') === 0 ? image : '/' + image);
        }
        // If no canonical URL provided, use current URL (without hash/fragment)
        if (!canonicalUrl) {
            canonicalUrl = window.location.origin + window.location.pathname + window.location.search;
        } else if (!/^https?:\/\//i.test(canonicalUrl)) {
            canonicalUrl = baseUrl + (canonicalUrl.indexOf('/') === 0 ? canonicalUrl : '/' + canonicalUrl);
        }
        var currentUrl = window.location.href;

        if (title) document.title = title;

        setOrCreateMeta('description', description, false);
        if (keywords) setOrCreateMeta('keywords', keywords, false);

        setOrCreateMeta('og:title', title, true);
        setOrCreateMeta('og:description', description, true);
        setOrCreateMeta('og:type', ogType, true);
        setOrCreateMeta('og:site_name', SITE_NAME, true);
        setOrCreateMeta('og:url', currentUrl, true);
        if (image) {
            setOrCreateMeta('og:image', image, true);
            setOrCreateMeta('og:image:width', '1200', true);
            setOrCreateMeta('og:image:height', '630', true);
        }

        setOrCreateMeta('twitter:card', 'summary_large_image', false);
        setOrCreateMeta('twitter:title', title, false);
        setOrCreateMeta('twitter:description', description, false);
        if (image) setOrCreateMeta('twitter:image', image, false);

        if (canonicalUrl) setOrCreateLink('canonical', canonicalUrl);

        if (ogType === 'article') {
            if (options.article_published_time) setOrCreateMeta('article:published_time', options.article_published_time, true);
            if (options.article_author) setOrCreateMeta('article:author', options.article_author, true);
            if (options.article_section) setOrCreateMeta('article:section', options.article_section, true);
        }
    }

    /**
     * Fallback SEO for category pages (when /api/seo fails). Matches app.js categoryNames.
     */
    function getCategorySEOFallback(categoryName) {
        var map = {
            'Tin chính': {
                title: 'Tin tức Nhật Bản - Tin chính',
                description: 'Tin tức mới nhất về các sự kiện quan trọng tại Nhật Bản. Đọc tin chính có bản dịch tiếng Việt, học từ vựng và cải thiện kỹ năng đọc hiểu tiếng Nhật.',
                keywords: 'tin tức Nhật Bản, tin thời sự Nhật, học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, học tiếng Nhật qua đọc tin tức, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, học từ vựng tiếng Nhật qua tin tức, đọc hiểu tiếng Nhật qua bài báo, Sugoi News'
            },
            'Thể thao': {
                title: 'Tin thể thao Nhật Bản',
                description: 'Tin tức thể thao mới nhất từ Nhật Bản: bóng đá, sumo, bóng chày và các môn thể thao khác. Đọc tin thể thao có bản dịch tiếng Việt.',
                keywords: 'tin thể thao Nhật Bản, bóng đá Nhật, học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo, Sugoi News'
            },
            'Giải trí': {
                title: 'Tin giải trí Nhật Bản',
                description: 'Tin tức giải trí, showbiz, phim ảnh, âm nhạc Nhật Bản. Đọc tin giải trí có bản dịch tiếng Việt, cập nhật xu hướng văn hóa Nhật.',
                keywords: 'tin giải trí Nhật Bản, showbiz Nhật, học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo, Sugoi News'
            },
            'Chính luận': {
                title: 'Chính luận & Bình luận Nhật Bản',
                description: 'Các bài xã luận, bình luận và phân tích về các vấn đề quan trọng tại Nhật Bản. Đọc chính luận có bản dịch tiếng Việt để hiểu sâu hơn về xã hội Nhật.',
                keywords: 'bình luận Nhật Bản, xã luận Nhật, học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo, Sugoi News'
            }
        };
        var info = map[categoryName];
        if (info) return info;
        return {
            title: categoryName,
            description: 'Tin tức mới nhất về ' + categoryName + '. Tổng hợp và dịch sang tiếng Việt bởi Sugoi News. Học tiếng Nhật qua tin tức.',
            keywords: categoryName + ', học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, đọc hiểu tiếng Nhật qua bài báo, Sugoi News'
        };
    }

    /**
     * Fetch SEO data from API and apply. Use for home, category, search, or article (with article_id).
     * @param {Object} params - { page: 'home'|'article'|'category'|'search'|'not_found', article_id?, category?, search? }
     * @returns {Promise<Object>} - Fetched SEO object (or default/fallback SEO on error)
     */
    function fetchAndSetSEO(params) {
        params = params || {};
        var qs = new URLSearchParams();
        qs.set('page', params.page || 'home');
        if (params.article_id) qs.set('article_id', params.article_id);
        if (params.category) qs.set('category', params.category);
        if (params.search) qs.set('search', params.search);
        var baseUrl = window.location.origin.replace(/\/$/, '');
        return fetch('/api/seo?' + qs.toString()).then(function (r) {
            return r.json();
        }).then(function (data) {
            data.base_url = baseUrl;
            setPageSEO(data);
            return data;
        }).catch(function () {
            var page = params.page || 'home';
            var opts = { base_url: baseUrl, og_type: 'website' };
            if (page === 'category' && params.category) {
                var catSEO = getCategorySEOFallback(params.category);
                opts.title = (catSEO.title || params.category) + ' | ' + SITE_NAME;
                opts.description = (catSEO.description && catSEO.description.length > META_DESC_MAX)
                    ? catSEO.description.slice(0, META_DESC_MAX - 3).replace(/\s+\S*$/, '') + '...'
                    : (catSEO.description || '');
                opts.keywords = catSEO.keywords || '';
                opts.canonical_url = baseUrl + '/?category=' + encodeURIComponent(params.category);
            } else if (page === 'search' && params.search) {
                opts.title = 'Tìm kiếm: ' + params.search + ' | ' + SITE_NAME;
                opts.description = 'Kết quả tìm kiếm tin tức cho "' + params.search + '" trên Sugoi News. Tổng hợp tin đa nguồn, dịch sang tiếng Việt. Học tiếng Nhật qua tin tức.';
                opts.keywords = params.search + ', tìm kiếm tin tức Nhật Bản, Sugoi News';
                opts.canonical_url = baseUrl + '/?search=' + encodeURIComponent(params.search);
            } else {
                opts.title = SITE_NAME + ' - Học tiếng Nhật qua tin tức';
                opts.description = 'Sugoi News - Học tiếng Nhật qua tin tức. Đọc tin Nhật có dịch tiếng Việt miễn phí từ Mainichi. Tin tức Mainichi tiếng Việt, học từ vựng và đọc hiểu tiếng Nhật qua bài báo mỗi ngày.';
                opts.keywords = 'học tiếng Nhật qua tin tức, đọc tin Nhật có bản dịch, tin tức Nhật Bản tiếng Việt, học tiếng Nhật qua đọc tin tức, đọc tin Nhật có dịch tiếng Việt miễn phí, tin tức Mainichi tiếng Việt, học từ vựng tiếng Nhật qua tin tức, đọc hiểu tiếng Nhật qua bài báo, Sugoi News';
            }
            setPageSEO(opts);
            return null;
        });
    }

    global.setPageSEO = setPageSEO;
    global.fetchAndSetSEO = fetchAndSetSEO;
})(typeof window !== 'undefined' ? window : this);
