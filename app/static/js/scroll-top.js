/**
 * Nút "Top" (scroll lên đầu trang) - chỉ hiển thị ở mobile.
 */
(function () {
    const MOBILE_BREAKPOINT = 768;
    const SCROLL_THRESHOLD = 300;

    function isMobile() {
        return window.innerWidth < MOBILE_BREAKPOINT;
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.id = 'scrollTopBtn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Cuộn lên đầu trang');
        btn.className =
            'fixed bottom-6 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full ' +
            'bg-primary-600 text-white shadow-lg hover:bg-primary-700 active:scale-95 transition-all duration-200 ' +
            'md:hidden'; // Chỉ hiện trên mobile (Tailwind: ẩn từ md trở lên)
        btn.style.display = 'none'; // Ban đầu ẩn, JS sẽ show khi scroll
        btn.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
            </svg>
        `;
        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.body.appendChild(btn);
        return btn;
    }

    function showScrollTopButton() {
        var btn = document.getElementById('scrollTopBtn');
        if (!btn) btn = createButton();

        var mobile = isMobile();
        var show = mobile && window.scrollY > SCROLL_THRESHOLD;
        btn.style.display = show ? '' : 'none';
    }

    function init() {
        showScrollTopButton();
        window.addEventListener('scroll', showScrollTopButton, { passive: true });
        window.addEventListener('resize', showScrollTopButton);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
