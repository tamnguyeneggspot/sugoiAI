/**
 * Shared header + mobile search for index and article pages.
 * Call renderHeader(options) after the script loads; options read from data attributes if not passed.
 *
 * @param {{ linkLogo?: boolean, showStats?: boolean }} [options]
 *   - linkLogo: wrap logo in <a href="/"> (true on article page)
 *   - showStats: show "Bài viết" / "Đã dịch" in header (true on article, false on index)
 */
function renderHeader(options) {
    const opts = options || {};
    const linkLogo = opts.linkLogo !== undefined ? opts.linkLogo : (document.body.dataset.headerLinkLogo === 'true');
    const showStats = opts.showStats !== undefined ? opts.showStats : (document.body.dataset.headerShowStats === 'true');

    const logoHtml = `
        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
            </svg>
        </div>
        <div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-white">News AI</h1>
            <p class="text-xs text-gray-500 dark:text-gray-400">Tin tức thông minh</p>
        </div>`;

    const logoBlock = linkLogo
        ? '<a href="/" class="flex items-center space-x-3">' + logoHtml + '</a>'
        : '<div class="flex items-center space-x-3">' + logoHtml + '</div>';

    const headerHtml = `
    <header class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50 transition-colors">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex items-center space-x-3">
                    ${logoBlock}
                </div>
                <div class="hidden md:flex flex-1 max-w-lg mx-8 items-center gap-2">
                    <div class="flex gap-2 w-full">
                        <div class="relative flex-1 min-w-0">
                            <input type="text" id="searchInput"
                                class="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all"
                                placeholder="Tìm kiếm tin tức...">
                            <svg class="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </div>
                        <button type="button" id="searchBtn" title="Tìm kiếm" class="flex-shrink-0 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </button>
                    </div>
                    <button type="button" id="themeToggle" title="Đổi giao diện sáng/tối" aria-label="Đổi giao diện sáng/tối" class="flex-shrink-0 p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <svg id="themeIconLight" class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                        <svg id="themeIconDark" class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    </header>
    <div class="md:hidden px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex gap-2 items-center">
        <div class="flex gap-2 flex-1">
            <div class="relative flex-1 min-w-0">
                <input type="text" id="searchInputMobile"
                    class="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
                    placeholder="Tìm kiếm tin tức...">
                <svg class="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>
            <button type="button" id="searchBtnMobile" title="Tìm kiếm" class="flex-shrink-0 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </button>
        </div>
        <button type="button" id="themeToggleMobile" title="Đổi giao diện sáng/tối" aria-label="Đổi giao diện sáng/tối" class="flex-shrink-0 p-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg id="themeIconLightMobile" class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            <svg id="themeIconDarkMobile" class="w-5 h-5 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
        </button>
    </div>`;

    const container = document.getElementById('header-container');
    if (container) container.innerHTML = headerHtml;

    // Dark mode toggle
    function attachThemeToggle() {
        var btn = document.getElementById('themeToggle');
        var btnMobile = document.getElementById('themeToggleMobile');
        if (typeof window.toggleTheme === 'function') {
            if (btn) btn.addEventListener('click', function () { window.toggleTheme(); });
            if (btnMobile) btnMobile.addEventListener('click', function () { window.toggleTheme(); });
        }
    }
    attachThemeToggle();
}
