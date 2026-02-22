/**
 * Shared filter sidebar for index and article pages.
 * Chỉ có bộ lọc Danh mục.
 * - renderFilterSidebar(containerId) — render HTML vào container
 * - loadFilterOptions(initialState) — load categories từ API và set giá trị
 * - getFilterState() — đọc category hiện tại từ DOM
 */

const FILTER_LIST_ITEM_BASE = 'block w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer border-l-2 border-transparent';
const FILTER_LIST_ITEM_ACTIVE = 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-600 dark:border-blue-500 font-medium';
const FILTER_LIST_ITEM_INACTIVE = 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-gray-100 dark:border-gray-600';

function renderFilterSidebar(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sticky top-24 transition-colors">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Bộ lọc</h3>
            <div class="space-y-1">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Danh mục</label>
                <input type="hidden" id="categoryFilter" value="">
                <ul id="categoryFilterList" class="space-y-0.5" role="list">
                    <!-- Items rendered by loadFilterOptions -->
                </ul>
            </div>
        </div>
    `;
}

function setCategoryFilterValue(value) {
    const hidden = document.getElementById('categoryFilter');
    if (hidden) hidden.value = value || '';
    updateCategoryListActiveState(value);
}

function updateCategoryListActiveState(activeValue) {
    const list = document.getElementById('categoryFilterList');
    if (!list) return;
    const items = list.querySelectorAll('[data-category-value]');
    items.forEach(el => {
        const val = el.getAttribute('data-category-value') || '';
        const isActive = (activeValue || '') === (val || '');
        el.className = FILTER_LIST_ITEM_BASE + ' ' + (isActive ? FILTER_LIST_ITEM_ACTIVE : FILTER_LIST_ITEM_INACTIVE);
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}

async function generateFilterOption(listEl, apiUrl, defaultLabel, currentValue) {
    if (!listEl) return;
    const hidden = document.getElementById('categoryFilter');
    const response = await fetch(apiUrl);
    const items = await response.json();

    if (hidden) hidden.value = currentValue || '';

    const fragment = document.createDocumentFragment();

    const allItem = document.createElement('li');
    allItem.setAttribute('role', 'option');
    allItem.setAttribute('data-category-value', '');
    allItem.className = FILTER_LIST_ITEM_BASE + ' ' + (!currentValue ? FILTER_LIST_ITEM_ACTIVE : FILTER_LIST_ITEM_INACTIVE);
    allItem.setAttribute('aria-selected', !currentValue ? 'true' : 'false');
    allItem.textContent = defaultLabel;
    allItem.addEventListener('click', function () {
        if (hidden) hidden.value = '';
        updateCategoryListActiveState('');
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
    });
    fragment.appendChild(allItem);

    items.forEach(item => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.setAttribute('data-category-value', item.name);
        const isActive = currentValue === item.name;
        li.className = FILTER_LIST_ITEM_BASE + ' ' + (isActive ? FILTER_LIST_ITEM_ACTIVE : FILTER_LIST_ITEM_INACTIVE);
        li.setAttribute('aria-selected', isActive ? 'true' : 'false');
        li.textContent = `${item.name} (${item.count})`;
        li.addEventListener('click', function () {
            if (hidden) hidden.value = item.name;
            updateCategoryListActiveState(item.name);
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        });
        fragment.appendChild(li);
    });

    listEl.innerHTML = '';
    listEl.appendChild(fragment);
}

async function loadFilterOptions(initialState) {
    const state = initialState || {};
    const listEl = document.getElementById('categoryFilterList');
    if (listEl) {
        await generateFilterOption(listEl, '/api/categories', 'Tất cả danh mục', state.category);
    }
}

function getFilterState() {
    const categoryFilter = document.getElementById('categoryFilter');
    return {
        category: categoryFilter ? categoryFilter.value : ''
    };
}
