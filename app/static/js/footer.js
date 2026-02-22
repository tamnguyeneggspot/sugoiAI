/**
 * Shared professional footer for index and article pages.
 * Call renderFooter(options) after the script loads; options read from data attributes if not passed.
 *
 * @param {{
 *   year?: number,
 *   showTechStack?: boolean,
 *   companyName?: string,
 *   tagline?: string
 * }} [options]
 */
function renderFooter(options) {
    const opts = options || {};
    const year = opts.year !== undefined ? opts.year : (parseInt(document.body.dataset.footerYear, 10) || new Date().getFullYear());
    const showTechStack = opts.showTechStack !== undefined ? opts.showTechStack : (document.body.dataset.footerShowTech !== 'false');
    const companyName = opts.companyName || document.body.dataset.footerCompanyName || 'News AI';
    const tagline = opts.tagline || document.body.dataset.footerTagline || 'Tin tức thông minh';

    const footerHtml = `
    <footer class="bg-gray-900 dark:bg-black text-gray-300 mt-12 transition-colors">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="py-12 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                <!-- Brand -->
                <div>
                    <a href="/" class="inline-flex items-center space-x-3 group">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center group-hover:from-blue-400 group-hover:to-indigo-500 transition-all">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
                            </svg>
                        </div>
                        <div>
                            <span class="text-lg font-bold text-white">${escapeHtml(companyName)}</span>
                            <p class="text-xs text-gray-400">${escapeHtml(tagline)}</p>
                        </div>
                    </a>
                </div>

                <!-- Tech / Status -->
                <div>
                    <h3 class="text-sm font-semibold text-white uppercase tracking-wider mb-4">Công nghệ</h3>
                    <p class="text-sm text-gray-400 leading-relaxed">
                        Tổng hợp tin đa nguồn, dịch tự động sang tiếng Việt. Nền tảng chạy trên FastAPI &amp; MongoDB.
                    </p>
                </div>
            </div>

            <!-- Bottom bar -->
            <div class="border-t border-gray-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p class="text-sm text-gray-500">
                    &copy; ${year} ${escapeHtml(companyName)}. Powered by AI Translation.
                </p>
                ${showTechStack ? '<p class="text-xs text-gray-500">FastAPI · MongoDB · Tailwind CSS</p>' : ''}
            </div>
        </div>
    </footer>`;

    const container = document.getElementById('footer-container');
    if (container) container.innerHTML = footerHtml;
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
