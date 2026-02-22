/**
 * Dark mode: lưu preference vào localStorage, áp class "dark" lên <html>.
 * Gọi initTheme() sớm (hoặc dùng inline script trong head) để tránh nháy màn hình.
 */
(function () {
    const STORAGE_KEY = 'newsai-theme';

    function getStored() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function setStored(value) {
        try {
            if (value) localStorage.setItem(STORAGE_KEY, value);
            else localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    }

    function applyClass(isDark) {
        const html = document.documentElement;
        if (isDark) html.classList.add('dark');
        else html.classList.remove('dark');
    }

    function prefersDark() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    window.getTheme = function () {
        const stored = getStored();
        if (stored === 'dark' || stored === 'light') return stored;
        return prefersDark() ? 'dark' : 'light';
    };

    window.setTheme = function (theme) {
        const isDark = theme === 'dark';
        applyClass(isDark);
        setStored(theme);
        dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme, isDark: isDark } }));
    };

    window.toggleTheme = function () {
        const next = getTheme() === 'dark' ? 'light' : 'dark';
        setTheme(next);
        return next;
    };

    /** Gọi khi DOM đã có (sau khi load theme.js). Nếu đã chạy inline trong head thì không cần gọi lại. */
    window.initTheme = function () {
        const theme = getTheme();
        applyClass(theme === 'dark');
    };
})();
