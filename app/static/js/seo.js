/**
 * SEO module - used for all pages. Sets document title, meta description,
 * keywords, Open Graph and Twitter Card tags for professional, consistent SEO.
 */
(function (global) {
    'use strict';

    var SITE_NAME = 'News AI';
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
        if (canonicalUrl && !/^https?:\/\//i.test(canonicalUrl)) {
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
        if (image) setOrCreateMeta('og:image', image, true);

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
     * Fetch SEO data from API and apply. Use for home, category, search, or article (with article_id).
     * @param {Object} params - { page: 'home'|'article'|'category'|'search'|'not_found', article_id?, category?, search? }
     * @returns {Promise<Object>} - Fetched SEO object (or default home SEO on error)
     */
    function fetchAndSetSEO(params) {
        params = params || {};
        var qs = new URLSearchParams();
        qs.set('page', params.page || 'home');
        if (params.article_id) qs.set('article_id', params.article_id);
        if (params.category) qs.set('category', params.category);
        if (params.search) qs.set('search', params.search);
        return fetch('/api/seo?' + qs.toString()).then(function (r) {
            return r.json();
        }).then(function (data) {
            data.base_url = window.location.origin;
            setPageSEO(data);
            return data;
        }).catch(function () {
            setPageSEO({
                title: SITE_NAME + ' - Tin tức thông minh',
                description: 'Nền tảng tổng hợp tin tức đa nguồn với dịch tự động sang tiếng Việt. Cập nhật tin thế giới, kinh tế, công nghệ và crypto từ các nguồn uy tín.',
                keywords: 'tin tức, news, AI, dịch tin tức, tổng hợp tin, tin thế giới, kinh tế, công nghệ, crypto',
                og_type: 'website'
            });
            return null;
        });
    }

    global.setPageSEO = setPageSEO;
    global.fetchAndSetSEO = fetchAndSetSEO;
})(typeof window !== 'undefined' ? window : this);
