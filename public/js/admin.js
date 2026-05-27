
// Текущее состояние
let currentPage = 1;
let totalPages = 1;
let searchTimeout;
let currentProjects = [];
let currentSpecialists = [];
let categories = [];
let currentTab = 'projects';
let objectTypesData = [];

// Проверка авторизации
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = '/admin/login';
        return;
    }
    
    try {
        const response = await fetch('/api/admin/check-auth', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            localStorage.removeItem('token');
            window.location.href = '/admin/login';
        } else {
            const data = await response.json();
            document.getElementById('userName').textContent = data.user.name || 'Администратор';
        }
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        window.location.href = '/admin/login';
    }
}

// ==================== ПРОЕКТЫ ====================

// Загрузка категорий из БД
async function loadCategories() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('projectCategory');
    
    select.innerHTML = '<option value="">Загрузка категорий...</option>';
    
    try {
        const response = await fetch('/api/object-types/all', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки категорий');
        
        const categories = await response.json();
        
        let options = '<option value="">Выберите категорию</option>';
        categories.forEach(cat => {
            options += `<option value="${cat.TypeName}">${cat.TypeName}</option>`;
        });
        
        select.innerHTML = options;
        
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        select.innerHTML = `
            <option value="">Выберите категорию</option>
            <option value="Строительство">Строительство</option>
            <option value="Реконструкция">Реконструкция</option>
            <option value="Отделка">Отделка</option>
            <option value="Дизайн интерьера">Дизайн интерьера</option>
            <option value="Коммерческая недвижимость">Коммерческая недвижимость</option>
            <option value="Жилая недвижимость">Жилая недвижимость</option>
        `;
    }
}

// Загрузка проектов
async function loadProjects(page = 1) {
const token = localStorage.getItem('token');

// Читаем значения фильтров
const search   = document.getElementById('searchInput')?.value   || '';
const category = document.getElementById('categoryFilter')?.value || '';

let url = `/api/admin/projects?page=${page}`;
if (search)   url += `&search=${encodeURIComponent(search)}`;
if (category) url += `&category=${encodeURIComponent(category)}`;

// Первый вызов — вся страница ещё не отрисована, строим полную разметку
const isFirstRender = !document.getElementById('projectsGrid');

if (isFirstRender) {
renderProjectsShell(); // рисуем оболочку с фильтрами один раз
}

// Показываем лоадер только в области списка
const grid = document.getElementById('projectsGrid');
if (grid) grid.innerHTML = '<div class="loader"></div>';

try {
const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();
currentProjects = data.projects || [];

if (data.categories?.length) categories = data.categories;

totalPages  = data.pagination?.totalPages || 1;
currentPage = page;

// Заполняем категории в селект (только при первом рендере)
if (isFirstRender) {
    populateCategoryFilter(categories, category);
}

// Обновляем только список карточек
renderProjectsList(data.projects, {
    search, category,
    currentPage: page,
    totalPages:  data.pagination?.totalPages || 1,
    totalCount:  data.pagination?.totalCount || 0
});

} catch (error) {
console.error('Ошибка загрузки проектов:', error);
const grid = document.getElementById('projectsGrid');
if (grid) grid.innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Ошибка загрузки</h3>
        <p>Не удалось загрузить проекты.</p>
        <button class="btn-add" onclick="loadProjects()" style="margin-top:20px;">
            <i class="fas fa-redo"></i> Повторить
        </button>
    </div>`;
}
}
function renderProjectsShell() {
document.getElementById('dynamicContent').innerHTML = `
<button class="btn-add" onclick="openProjectModal()" style="margin-bottom:20px;">
    <i class="fas fa-plus"></i> Добавить сведения о новом проекте
</button>

<div class="filters-panel" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px; align-items:center;">
    
    <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="searchInput" placeholder="Поиск проектов..." oninput="debounceSearch()">
    </div>

    <select class="filter-select" id="categoryFilter" onchange="loadProjects(1)" style="flex:1; min-width:150px; padding:10px 12px; border:1px solid #ddd; border-radius:6px; height:42px;">
        <option value="">Все категории</option>
    </select>

    <button onclick="resetFilters()" style="padding:8px 15px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; height:42px; display:inline-flex; align-items:center; gap:5px;">
        <i class="fas fa-times"></i> Сбросить
    </button>
</div>

<div id="projectsInfo" style="margin-bottom:15px;"></div>
<div id="projectsGrid"></div>
<div id="projectsPagination" style="margin-top:30px; text-align:center;"></div>
`;
}

// Функция перевода названий месяцев на русский
function translateMonth(monthName) {
if (!monthName) return '';

const months = {
'January': 'Январь',
'February': 'Февраль',
'March': 'Март',
'April': 'Апрель',
'May': 'Май',
'June': 'Июнь',
'July': 'Июль',
'August': 'Август',
'September': 'Сентябрь',
'October': 'Октябрь',
'November': 'Ноябрь',
'December': 'Декабрь',
// Короткие формы (если приходят из БД)
'Jan': 'Янв',
'Feb': 'Фев',
'Mar': 'Мар',
'Apr': 'Апр',
'May': 'Май',
'Jun': 'Июн',
'Jul': 'Июл',
'Aug': 'Авг',
'Sep': 'Сен',
'Oct': 'Окт',
'Nov': 'Ноя',
'Dec': 'Дек'
};

return months[monthName] || monthName;
}

// Заполняем опции категорий в селект
function populateCategoryFilter(cats, selectedCategory) {
const select = document.getElementById('categoryFilter');
if (!select) return;
let options = '<option value="">Все категории</option>';
cats.forEach(cat => {
const val = cat.Category || cat;
const sel = val === selectedCategory ? 'selected' : '';
options += `<option value="${escapeHtml(val)}" ${sel}>${escapeHtml(val)}</option>`;
});
select.innerHTML = options;
}

// Обновляем только список карточек — фильтры НЕ трогаем
function renderProjectsList(projects, filterState = {}) {
const grid       = document.getElementById('projectsGrid');
const info       = document.getElementById('projectsInfo');
const pagination = document.getElementById('projectsPagination');

if (!grid) return;

const { search = '', category = '',
    currentPage = 1, totalPages = 1, totalCount = 0 } = filterState;

// Информационная строка
if (info) {
if (totalCount > 0 || search || category) {
    info.innerHTML = `
        <div style="padding:10px; background:#e3f2fd; border-radius:4px; color:#0d47a1;">
            <i class="fas fa-info-circle"></i>
            Всего: <strong>${totalCount}</strong>
            ${search   ? `по запросу «${escapeHtml(search)}»` : ''}
            ${category ? `в категории «${escapeHtml(category)}»` : ''}
        </div>`;
} else {
    info.innerHTML = '';
}
}

// Пустое состояние
if (!projects || projects.length === 0) {
let msg = 'Создайте первый проект, нажав кнопку выше';
if (search)    msg = `По запросу «${escapeHtml(search)}» ничего не найдено`;
else if (category) msg = `В категории «${escapeHtml(category)}» нет проектов`;

grid.innerHTML = `
    <div class="empty-state">
        <i class="fas fa-folder-open"></i>
        <h3>${msg}</h3>
    </div>`;
if (pagination) pagination.innerHTML = '';
return;
}

// Карточки
let html = '<div class="projects-grid">';
projects.forEach(project => {
const imageUrl    = project.MainImage || '/images/no-image.jpg';
const statusLabel = project.IsPublished ? 'Опубликован' : 'Черновик';
const statusClass = project.IsPublished ? 'status-published' : 'status-unpublished';

html += `
    <div class="project-card ${!project.IsPublished ? 'unpublished' : ''}">
        <div class="project-image" style="background-image:url('${imageUrl}')">
            <span class="project-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="project-content">
            <span class="project-category">${project.Category || 'Без категории'}</span>
            <h3 class="project-title">${escapeHtml(project.Title)}</h3>
            <div class="project-meta">
                ${project.Location ? `<span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(project.Location)}</span>` : ''}
                ${project.Area     ? `<span><i class="fas fa-ruler-combined"></i> ${project.Area} м²</span>` : ''}
                ${project.Year     ? `<span><i class="fas fa-calendar"></i> ${project.Year}</span>` : ''}
            </div>
            <p class="project-description">
                ${escapeHtml(project.ShortDescription || project.Description || 'Нет описания')}
            </p>
            <div class="project-actions">
                <button class="btn-action btn-edit" onclick="openProjectModal(${project.Id})">
                    <i class="fas fa-edit"></i> Ред.
                </button>
                <button class="btn-action ${project.IsPublished ? 'btn-unpublish' : 'btn-publish'}"
                        onclick="togglePublish(${project.Id}, ${!project.IsPublished})">
                    <i class="fas ${project.IsPublished ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    ${project.IsPublished ? 'Снять' : 'Опубл.'}
                </button>
                <button class="btn-action btn-delete" onclick="deleteProject(${project.Id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    </div>`;
});
html += '</div>';
grid.innerHTML = html;

// Пагинация
if (pagination) {
if (totalPages > 1) {
    let pages = '';
    for (let i = 1; i <= totalPages; i++) {
        pages += `<button class="page-btn ${i === currentPage ? 'active' : ''}"
                          onclick="loadProjects(${i})">${i}</button>`;
    }
    pagination.innerHTML = pages;
} else {
    pagination.innerHTML = '';
}
}
}

// Сброс фильтров
function resetFilters() {
const s = document.getElementById('searchInput');
const c = document.getElementById('categoryFilter');
if (s) s.value = '';
if (c) c.value = '';
loadProjects(1);
}


// функция debounceSearch с поддержкой отзывов
function debounceSearch() {
clearTimeout(searchTimeout);

searchTimeout = setTimeout(() => {
if (currentTab === 'projects') {
    loadProjects(1);
} else if (currentTab === 'specialists') {
    loadSpecialists(1);
} else if (currentTab === 'reviews') {
    loadReviews(1, currentReviewFilter);
}
}, 400);
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
if (!text) return '';
const div = document.createElement('div');
div.textContent = text;
return div.innerHTML;
}

// обработчик клика по меню
document.querySelectorAll('.menu-item').forEach(item => {
item.addEventListener('click', (e) => {
e.preventDefault();
const page = item.dataset.page;

document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
item.classList.add('active');

currentTab = page;

const titleSpan = document.getElementById('pageTitleSpan');

if (page === 'projects') {
    titleSpan.textContent = 'сведениями о проектах';
    // Сбрасываем фильтры
    setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        const categorySelect = document.getElementById('categoryFilter');
        const statusSelect = document.getElementById('statusFilter');
        
        if (searchInput) searchInput.value = '';
        if (categorySelect) categorySelect.value = '';
        if (statusSelect) statusSelect.value = 'all';
    }, 100);
    loadProjects();
} 
else if (page === 'specialists') {
    titleSpan.textContent = 'сведениями о специалистах';
    loadSpecialists();
} 
else if (page === 'work-rules') {
    titleSpan.textContent = 'нормами сроков работ';
    loadWorkRules();
}
else if (page === 'reviews') {
    titleSpan.textContent = 'отзывами';
    loadReviews(1, 'all');
}
else if (page === 'stats') {
    titleSpan.textContent = 'статистикой';
    renderStatsPage();
}
else if (page === 'object-types') {
titleSpan.textContent = 'сведениями о типах объектов';
loadObjectTypes();
}
else if (page === 'work-types') {
titleSpan.textContent = 'сведениями о видах работ';
loadWorkTypes();
}
else if (page === 'clients') {
titleSpan.textContent = 'сведениями о клиентах';
loadClients();
}
else if (page === 'report-clients') {        // <-- НОВЫЙ БЛОК
titleSpan.textContent = 'отчетом по клиентам';
renderClientsReportPage();
}
else if (page === 'report-orders') {         // <-- НОВЫЙ БЛОК
titleSpan.textContent = 'отчетом по заказам';
renderOrdersReportPage();
}
else {
    titleSpan.textContent = page;
    document.getElementById('dynamicContent').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-tools"></i>
            <h3>Раздел в разработке</h3>
            <p>Функционал будет доступен позже</p>
        </div>
    `;
}
});
});
// ==================== СПЕЦИАЛИСТЫ ====================

async function loadSpecialists(page = 1) {
const token = localStorage.getItem('token');
const search = document.getElementById('specialistSearch')?.value || '';
const showInactive = document.getElementById('showInactive')?.checked ? 1 : 0;

const isFirstRender = !document.getElementById('specialistsTable');

if (isFirstRender) {
renderSpecialistsShell();
}

const tbody = document.getElementById('specialistsTbody');
if (tbody) {
tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;"><div class="loader" style="margin:auto;"></div></td></tr>';
}

try {
const response = await fetch(
    `/api/admin/specialists?page=${page}&search=${encodeURIComponent(search)}&showInactive=${showInactive}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
);

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();
currentSpecialists = data.specialists;
totalPages = data.pagination.totalPages;
currentPage = page;

renderSpecialistRows(data.specialists, page, data.pagination.totalPages);
loadSpecialistsStats();

} catch (error) {
console.error('Ошибка:', error);
const tbody = document.getElementById('specialistsTbody');
if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:#dc3545;">
        <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки. 
        <button onclick="loadSpecialists()" style="margin-left:10px;background:#e31e24;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">
            <i class="fas fa-redo"></i> Повторить
        </button>
    </td></tr>`;
}
}
}
function renderSpecialistsShell() {
document.getElementById('dynamicContent').innerHTML = `
<div class="stats-grid">
    <div class="stat-card">
        <div class="stat-info">
            <h3>Всего специалистов</h3>
            <div class="stat-number" id="totalSpecialists">—</div>
        </div>
        <div class="stat-icon"><i class="fas fa-users"></i></div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Активных</h3>
            <div class="stat-number" id="activeSpecialists">—</div>
        </div>
        <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Администраторы</h3>
            <div class="stat-number" id="admins">—</div>
        </div>
        <div class="stat-icon"><i class="fas fa-user-tie"></i></div>
    </div>
</div>

<button class="btn-add" onclick="openSpecialistModal()" style="margin-bottom:20px;">
    <i class="fas fa-plus"></i> Добавить сведения о специалисте
</button>

<div class="filters-panel" style="display:flex;flex-wrap:wrap;gap:10px; margin-bottom:20px;padding:15px;background:#f8f9fa;border-radius:8px;align-items:center;">

    <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="specialistSearch" placeholder="Поиск по имени, email или логину..." oninput="debounceSearch()">
    </div>

    <label style="display:flex;align-items:center;gap:8px;cursor:pointer; height:42px;white-space:nowrap;">
        <input type="checkbox" id="showInactive" onchange="loadSpecialists(1)">
        Показывать неактивных
    </label>

    <button onclick="resetSpecialistFilters()" style="padding:8px 15px;background:#6c757d;color:white; border:none;border-radius:4px;cursor:pointer;height:42px; display:inline-flex;align-items:center;gap:5px;">
        <i class="fas fa-times"></i> Сбросить
    </button>
</div>

<div id="specialistsTable" class="specialists-table">
    <table>
        <thead>
            <tr>
                <th>ФИО</th>
                <th>Логин</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Последний вход</th>
                <th>Действия</th>
            </tr>
        </thead>
        <tbody id="specialistsTbody">
            <tr><td colspan="8" style="text-align:center;padding:30px;"><div class="loader" style="margin:auto;"></div></td></tr>
        </tbody>
    </table>
</div>

<div id="specialistsPagination" style="margin-top:20px;text-align:center;"></div>
`;
}

function renderSpecialistRows(specialists, page, totalPages) {
const tbody      = document.getElementById('specialistsTbody');
const pagination = document.getElementById('specialistsPagination');

if (!specialists || specialists.length === 0) {
tbody.innerHTML = `<tr><td colspan="8">
    <div class="empty-state" style="padding:40px;">
        <i class="fas fa-users"></i>
        <h3>Нет специалистов</h3>
        <p>Добавьте первого специалиста, нажав кнопку выше</p>
    </div>
</td></tr>`;
if (pagination) pagination.innerHTML = '';
return;
}

tbody.innerHTML = specialists.map(spec => {
const statusClass = spec.IsActive ? 'status-active'    : 'status-inactive';
const statusText  = spec.IsActive ? 'Активен'          : 'Неактивен';
const roleClass   = spec.Role === 'admin' ? 'role-admin' : 'role-specialist';
const roleText    = spec.Role === 'admin' ? 'Администратор' : 'Специалист';
const lastLogin   = spec.LastLoginAt
    ? new Date(spec.LastLoginAt).toLocaleString('ru-RU')
    : 'Никогда';

// Экранируем имя для безопасной передачи в JavaScript
const safeFullName = escapeHtml(spec.FullName).replace(/'/g, "\\'");

return `
    <tr>
        <td><strong>${escapeHtml(spec.FullName)}</strong></td>
        <td>${escapeHtml(spec.Login)}</td>
        <td>${escapeHtml(spec.Email)}</td>
        <td>${escapeHtml(spec.Phone || '—')}</td>
        <td><span class="role-badge ${roleClass}">${roleText}</span></td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${lastLogin}</td>
        <td>
           <div class="action-buttons">
<button class="btn-icon btn-edit"
    onclick="openSpecialistModal(${spec.UserID})" title="Редактировать">
<i class="fas fa-edit"></i>
</button>
<button class="btn-icon btn-password"
    onclick="openPasswordModal(${spec.UserID})" title="Сменить пароль">
<i class="fas fa-key"></i>
</button>
${spec.Role !== 'admin' ? `
<button class="btn-icon btn-history"
    onclick="openHistoryModal(${spec.UserID}, '${safeFullName}')"
    title="История работы">
<i class="fas fa-history"></i>
</button>
` : ''}
<button class="btn-icon btn-delete"
    onclick="deleteSpecialist(${spec.UserID})" title="Удалить">
<i class="fas fa-trash"></i>
</button>
</div>
        </td>
    </tr>`;
}).join('');

if (pagination) {
if (totalPages > 1) {
    pagination.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
        .map(i => `<button class="page-btn ${i === page ? 'active' : ''}"
                           onclick="loadSpecialists(${i})">${i}</button>`)
        .join('');
} else {
    pagination.innerHTML = '';
}
}
}
async function loadSpecialistsStats() {
const token = localStorage.getItem('token');

try {
const response = await fetch('/api/admin/specialists/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки статистики');

const stats = await response.json();

const total  = document.getElementById('totalSpecialists');
const active = document.getElementById('activeSpecialists');
const admins = document.getElementById('admins');

if (total)  total.textContent  = stats.TotalSpecialists  || 0;
if (active) active.textContent = stats.ActiveSpecialists || 0;
if (admins) admins.textContent = stats.Admins            || 0;

} catch (error) {
console.error('Ошибка загрузки статистики специалистов:', error);
}
}

function resetSpecialistFilters() {
const s = document.getElementById('specialistSearch');
const c = document.getElementById('showInactive');
if (s) s.value = '';
if (c) c.checked = false;
loadSpecialists(1);
}

function resetSpecialistFilters() {
const s = document.getElementById('specialistSearch');
const c = document.getElementById('showInactive');
if (s) s.value = '';
if (c) c.checked = false;
loadSpecialists(1);
}

// Открытие модального окна специалиста
function openSpecialistModal(userId = null) {
    document.getElementById('specialistForm').reset();
    document.getElementById('specialistId').value = '';
    document.getElementById('specialistModalTitle').textContent = 'Новый специалист';
    document.getElementById('passwordField').style.display = 'block';
    document.getElementById('specialistPassword').required = true;
    document.getElementById('specialistIsActive').checked = true;
    document.getElementById('specialistLogin').disabled = false;
    
    if (userId) {
        loadSpecialistForEdit(userId);
    }
    
    document.getElementById('specialistModal').style.display = 'block';
}

// Загрузка специалиста для редактирования
async function loadSpecialistForEdit(userId) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/admin/specialists/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const specialist = await response.json();
        
        document.getElementById('specialistModalTitle').textContent = 'Редактирование данных специалиста';
        document.getElementById('specialistId').value = specialist.UserID;
        document.getElementById('specialistLogin').value = specialist.Login;
        document.getElementById('specialistLogin').disabled = true;
        document.getElementById('passwordField').style.display = 'none';
        document.getElementById('specialistPassword').required = false;
        document.getElementById('specialistFullName').value = specialist.FullName || '';
        document.getElementById('specialistEmail').value = specialist.Email || '';
        document.getElementById('specialistPhone').value = specialist.Phone || '';
        document.getElementById('specialistRole').value = specialist.Role || 'specialist';
        document.getElementById('specialistIsActive').checked = specialist.IsActive === true;
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка загрузки данных специалиста', 'error');
    }
}

// Сохранение специалиста
async function saveSpecialist(event) {
event.preventDefault();

// ── Валидация ────────────────────────────────────────────────
const fullName = document.getElementById('specialistFullName').value.trim();
const email    = document.getElementById('specialistEmail').value.trim();
const phone    = document.getElementById('specialistPhone').value.trim();
const userId   = document.getElementById('specialistId').value;

// ФИО — только буквы (кириллица, латиница), пробелы, дефис
const nameRegex = /^[А-ЯЁа-яёA-Za-z\s\-]+$/;
if (!nameRegex.test(fullName)) {
showToast('ФИО должно содержать только буквы, пробелы и дефис', 'error');
document.getElementById('specialistFullName').focus();
return;
}

// Email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
showToast('Введите корректный email', 'error');
document.getElementById('specialistEmail').focus();
return;
}

// Телефон — если заполнен, проверяем формат
if (phone) {
const phoneRegex = /^[\+]?[\d\s\(\)\-]{7,20}$/;
if (!phoneRegex.test(phone)) {
    showToast('Введите корректный номер телефона (например: +375 29 123-45-67)', 'error');
    document.getElementById('specialistPhone').focus();
    return;
}
}
// ────────────────────────────────────────────────────────────

const token = localStorage.getItem('token');

const specialistData = {
login: document.getElementById('specialistLogin').value,
fullName,
email,
phone: phone || null,
role: document.getElementById('specialistRole').value,
isActive: document.getElementById('specialistIsActive').checked
};

if (!userId) {
specialistData.password = document.getElementById('specialistPassword').value;
if (specialistData.password.length < 6) {
    showToast('Пароль должен содержать минимум 6 символов', 'error');
    return;
}
}

try {
const url    = userId ? `/api/admin/specialists/${userId}` : '/api/admin/specialists';
const method = userId ? 'PUT' : 'POST';

const response = await fetch(url, {
    method,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(specialistData)
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка сохранения');
}

const result = await response.json();
showToast(result.message, 'success');
closeSpecialistModal();
loadSpecialists(currentPage);

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Удаление специалиста
// Удаление специалиста (ПОЛНОЕ УДАЛЕНИЕ)
async function deleteSpecialist(userId) {
if (!confirm('Вы уверены, что хотите ПОЛНОСТЬЮ УДАЛИТЬ специалиста? Это действие нельзя отменить!')) {
return;
}

const token = localStorage.getItem('token');

try {
// Добавляем параметр hardDelete=true для физического удаления
const response = await fetch(`/api/admin/specialists/${userId}?hardDelete=true`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка удаления');
}

const result = await response.json();
showToast(result.message, 'success');
loadSpecialists(currentPage);

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Открытие модального окна смены пароля
function openPasswordModal(userId) {
    document.getElementById('passwordUserId').value = userId;
    document.getElementById('newPassword').value = '';
    document.getElementById('passwordModal').style.display = 'block';
}

// Смена пароля
async function changePassword(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    const userId = document.getElementById('passwordUserId').value;
    const password = document.getElementById('newPassword').value;
    
    if (password.length < 6) {
        showToast('Пароль должен содержать минимум 6 символов', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/specialists/${userId}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка смены пароля');
        }
        
        const result = await response.json();
        showToast(result.message, 'success');
        closePasswordModal();
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast(error.message, 'error');
    }
}

// Генерация пароля
function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('specialistPassword').value = password;
}

function generateNewPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('newPassword').value = password;
}

// ==================== ОБЩИЕ ФУНКЦИИ ====================

// Отрисовка пагинации
function renderPagination() {
    const pagination = document.querySelector('.pagination');
    if (!pagination) return;
    
    let html = '';
    
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    
    pagination.innerHTML = html;
}

// Смена страницы
function changePage(page) {
    if (currentTab === 'projects') {
        loadProjects(page);
    } else if (currentTab === 'specialists') {
        loadSpecialists(page);
    }
}

// Обновляем функцию debounceSearch для поддержки отзывов
function debounceSearch() {
clearTimeout(searchTimeout);

const searchBox = document.querySelector('.search-box');
if (searchBox) {
searchBox.classList.add('searching');
}

searchTimeout = setTimeout(() => {
if (currentTab === 'projects') {
    loadProjects(1);
} else if (currentTab === 'specialists') {
    loadSpecialists(1);
} else if (currentTab === 'reviews') {  // Добавляем поддержку отзывов
    loadReviews(1, currentReviewFilter);
}

if (searchBox) {
    setTimeout(() => {
        searchBox.classList.remove('searching');
    }, 300);
}
}, 400);
}

// Открытие модального окна проекта
function openProjectModal(projectId = null) {
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';
    document.getElementById('modalTitle').textContent = 'Новый проект';
    document.getElementById('mainImagePreview').innerHTML = '';
    document.getElementById('galleryPreview').innerHTML = '';
    document.getElementById('projectMainImage').value = '';
    document.getElementById('projectImages').value = '[]';
    document.getElementById('projectFeatures').value = '';
    
    loadCategories();
    
    if (projectId) {
        loadProjectForEdit(projectId);
    }
    
    document.getElementById('projectModal').style.display = 'block';
}

// Загрузка проекта для редактирования
async function loadProjectForEdit(projectId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const project = await response.json();
        
        document.getElementById('modalTitle').textContent = 'Редактирование данных проекта';
        document.getElementById('projectId').value = project.Id;
        document.getElementById('projectTitle').value = project.Title || '';
        
        const categorySelect = document.getElementById('projectCategory');
        if (project.Category) {
            setTimeout(() => {
                categorySelect.value = project.Category;
            }, 500);
        }
        
        document.getElementById('projectLocation').value = project.Location || '';
        document.getElementById('projectArea').value = project.Area || '';
        document.getElementById('projectYear').value = project.Year || '';
        document.getElementById('projectStatus').value = project.Status || '';
        document.getElementById('projectShortDescription').value = project.ShortDescription || '';
        document.getElementById('projectDescription').value = project.Description || '';
        document.getElementById('projectIsPublished').checked = project.IsPublished === true;
        document.getElementById('projectSortOrder').value = project.SortOrder || 0;
        document.getElementById('projectMainImage').value = project.MainImage || '';
        
        if (project.MainImage) {
            document.getElementById('mainImagePreview').innerHTML = `
                <div class="preview-item">
                    <img src="${project.MainImage}" alt="Main">
                    <span class="preview-remove" onclick="removeMainImage()">&times;</span>
                </div>
            `;
        }
        
        if (project.Images && Array.isArray(project.Images)) {
document.getElementById('projectImages').value = JSON.stringify(project.Images);
renderGalleryPreview(project.Images.map(img => img.Url || img));
}
        
        if (project.Features && Array.isArray(project.Features)) {
            document.getElementById('projectFeatures').value = project.Features.join('\n');
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка загрузки проекта', 'error');
    }
}

// Сохранение проекта
async function saveProject(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    const projectId = document.getElementById('projectId').value;
    
    const featuresText = document.getElementById('projectFeatures').value;
    const features = featuresText.split('\n').filter(f => f.trim() !== '');
    
    let images = [];
    try {
        images = JSON.parse(document.getElementById('projectImages').value || '[]');
    } catch (e) {
        images = [];
    }
    
    const projectData = {
        Title: document.getElementById('projectTitle').value,
        Category: document.getElementById('projectCategory').value,
        Location: document.getElementById('projectLocation').value,
        Area: parseFloat(document.getElementById('projectArea').value) || null,
        Year: parseInt(document.getElementById('projectYear').value) || null,
        Status: document.getElementById('projectStatus').value,
        ShortDescription: document.getElementById('projectShortDescription').value,
        Description: document.getElementById('projectDescription').value,
        MainImage: document.getElementById('projectMainImage').value,
        Images: images,
        Features: features,
        IsPublished: document.getElementById('projectIsPublished').checked,
        SortOrder: parseInt(document.getElementById('projectSortOrder').value) || 0
    };
    
    try {
        const url = projectId ? `/api/admin/projects/${projectId}` : '/api/admin/projects';
        const method = projectId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(projectData)
        });
        
        if (!response.ok) throw new Error('Ошибка сохранения');
        
        const result = await response.json();
        showToast(result.message, 'success');
        closeProjectModal();
        loadProjects(currentPage);
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка сохранения проекта', 'error');
    }
}

// Удаление проекта
async function deleteProject(projectId) {
    if (!confirm('Вы уверены, что хотите удалить этот проект? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка удаления');
        
        showToast('Проект успешно удален', 'success');
        loadProjects(currentPage);
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка удаления проекта', 'error');
    }
}

// Переключение публикации
async function togglePublish(projectId, publish) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/projects/${projectId}/toggle-publish`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ isPublished: publish })
        });
        
        if (!response.ok) throw new Error('Ошибка обновления');
        
        showToast(`Проект ${publish ? 'опубликован' : 'снят с публикации'}`, 'success');
        loadProjects(currentPage);
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка обновления статуса', 'error');
    }
}

// Загрузка изображений
async function uploadMainImage(input) {
    if (!input.files || !input.files[0]) return;
    
    const formData = new FormData();
    formData.append('image', input.files[0]);
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/upload/project-image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const result = await response.json();
        document.getElementById('projectMainImage').value = result.url;
        
        document.getElementById('mainImagePreview').innerHTML = `
            <div class="preview-item">
                <img src="${result.url}" alt="Main">
                <span class="preview-remove" onclick="removeMainImage()">&times;</span>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка загрузки изображения', 'error');
    }
}

function removeMainImage() {
    document.getElementById('projectMainImage').value = '';
    document.getElementById('mainImagePreview').innerHTML = '';
}

async function uploadGalleryImages(input) {
    if (!input.files || input.files.length === 0) return;
    
    const token = localStorage.getItem('token');
    let images = [];
    
    try {
        images = JSON.parse(document.getElementById('projectImages').value || '[]');
    } catch (e) {
        images = [];
    }
    
    for (let file of input.files) {
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await fetch('/api/admin/upload/project-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                images.push(result.url);
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
        }
    }
    
    document.getElementById('projectImages').value = JSON.stringify(images);
    renderGalleryPreview(images);
}

function renderGalleryPreview(images) {
    let html = '';
    images.forEach((img, index) => {
        html += `
            <div class="preview-item">
                <img src="${img}" alt="Gallery">
                <span class="preview-remove" onclick="removeGalleryImage(${index})">&times;</span>
            </div>
        `;
    });
    document.getElementById('galleryPreview').innerHTML = html;
}

async function removeGalleryImage(index) {
let images = [];
try {
images = JSON.parse(document.getElementById('projectImages').value || '[]');
} catch { images = []; }

const img = images[index];

// Если у изображения есть ImageID — удаляем через API
if (img && img.ImageID) {
const projectId = document.getElementById('projectId').value;
const token = localStorage.getItem('token');
await fetch(`/api/admin/projects/${projectId}/images/${img.ImageID}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});
}

images.splice(index, 1);
document.getElementById('projectImages').value = JSON.stringify(images);
renderGalleryPreview(images.map(img => img.Url || img));
}

// Закрытие модальных окон
function closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
}

function closeSpecialistModal() {
    document.getElementById('specialistModal').style.display = 'none';
    document.getElementById('specialistLogin').disabled = false;
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
}

// Показ уведомлений
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; margin-left: 15px; cursor: pointer;">&times;</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadProjects();

    document.getElementById('logoutBtn').addEventListener('click', () => {
localStorage.removeItem('token');
window.location.href = '/admin/login';
});
    
    // Закрытие модальных окон по клику вне их
    window.onclick = function(event) {
        const projectModal = document.getElementById('projectModal');
        const specialistModal = document.getElementById('specialistModal');
        const passwordModal = document.getElementById('passwordModal');
        
        if (event.target === projectModal) {
            closeProjectModal();
        }
        if (event.target === specialistModal) {
            closeSpecialistModal();
        }
        if (event.target === passwordModal) {
            closePasswordModal();
        }
    }
});


// Текущие переменные для истории
let currentHistoryPage = 1;
let currentSpecialistId = null;
let currentSpecialistName = '';

// Открытие модального окна истории
function openHistoryModal(specialistId, specialistName) {
currentSpecialistId = specialistId;
currentSpecialistName = specialistName;
document.getElementById('historySpecialistName').textContent = specialistName;
document.getElementById('historyModal').style.display = 'block';

loadSpecialistStats(specialistId);
loadSpecialistHistory();
}

// Закрытие модального окна истории
function closeHistoryModal() {
document.getElementById('historyModal').style.display = 'none';
currentSpecialistId = null;
}

// Загрузка статистики специалиста
async function loadSpecialistStats(specialistId) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/specialists/${specialistId}/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки статистики');

const stats = await response.json();

document.getElementById('statsTotalApps').textContent = stats.TotalApplications || 0;
document.getElementById('statsCompletedApps').textContent = stats.CompletedApplications || 0;
document.getElementById('statsOrders').textContent = stats.TotalOrders || 0;
document.getElementById('statsClients').textContent = stats.TotalClients || 0;

} catch (error) {
console.error('Ошибка:', error);
}
}

// Загрузка истории специалиста
async function loadSpecialistHistory(page = 1) {
if (!currentSpecialistId) return;

const token = localStorage.getItem('token');
const actionType = document.getElementById('historyActionFilter')?.value || '';
const dateFrom = document.getElementById('historyDateFrom')?.value || '';
const dateTo = document.getElementById('historyDateTo')?.value || '';

try {
document.getElementById('historyList').innerHTML = '<div class="loader"></div>';

let url = `/api/admin/specialists/${currentSpecialistId}/history?page=${page}`;
if (actionType) url += `&actionType=${encodeURIComponent(actionType)}`;
if (dateFrom) url += `&dateFrom=${dateFrom}`;
if (dateTo) url += `&dateTo=${dateTo}`;

const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки истории');

const data = await response.json();

currentHistoryPage = page;

renderHistory(data.history);
renderHistoryPagination(data.pagination.totalPages);

} catch (error) {
console.error('Ошибка:', error);
document.getElementById('historyList').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки истории</p>
    </div>
`;
}
}
function resetHistoryFilters() {
const action = document.getElementById('historyActionFilter');
const from   = document.getElementById('historyDateFrom');
const to     = document.getElementById('historyDateTo');
if (action) action.value = '';
if (from)   from.value   = '';
if (to)     to.value     = '';
loadSpecialistHistory(1);
}

// Отрисовка истории
function renderHistory(history) {
const container = document.getElementById('historyList');

if (!history || history.length === 0) {
container.innerHTML = `
    <div class="empty-state">
        <i class="fas fa-history"></i>
        <h3>История пуста</h3>
        <p>У специалиста пока нет записей в истории</p>
    </div>
`;
return;
}

let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';

history.forEach(entry => {
const date = new Date(entry.ActionDate).toLocaleString('ru-RU');

let actionIcon = 'fa-clock';
let actionColor = '#17a2b8';

switch(entry.ActionType) {
    case 'application_status':
        actionIcon = 'fa-tasks';
        actionColor = '#007bff';
        break;
    case 'order_created':
        actionIcon = 'fa-file-contract';
        actionColor = '#28a745';
        break;
    case 'client_contact':
        actionIcon = 'fa-phone';
        actionColor = '#ffc107';
        break;
    case 'comment':
        actionIcon = 'fa-comment';
        actionColor = '#6c757d';
        break;
}

html += `
    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; border-left: 4px solid ${actionColor};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <div>
                <i class="fas ${actionIcon}" style="color: ${actionColor}; margin-right: 8px;"></i>
                <strong>${entry.Description || 'Действие'}</strong>
            </div>
            <small style="color: #666;">${date}</small>
        </div>
        ${entry.Details ? `<p style="margin: 5px 0; color: #333;">${entry.Details}</p>` : ''}
        <div style="display: flex; gap: 15px; margin-top: 10px; font-size: 12px; color: #999;">
            ${entry.ClientName ? `<span><i class="fas fa-user"></i> ${entry.ClientName}</span>` : ''}
            ${entry.ClientPhone ? `<span><i class="fas fa-phone"></i> ${entry.ClientPhone}</span>` : ''}
            ${entry.OrderNumber ? `<span><i class="fas fa-file"></i> ${entry.OrderNumber}</span>` : ''}
        </div>
    </div>
`;
});

html += '</div>';
container.innerHTML = html;
}

// Отрисовка пагинации истории
function renderHistoryPagination(totalPages) {
const container = document.getElementById('historyPagination');
if (!container) return;

if (totalPages <= 1) {
container.innerHTML = '';
return;
}

let html = '';
for (let i = 1; i <= totalPages; i++) {
html += `<button class="page-btn ${i === currentHistoryPage ? 'active' : ''}" onclick="loadSpecialistHistory(${i})">${i}</button>`;
}

container.innerHTML = html;
}

// Добавляем обработчики для фильтров истории
document.addEventListener('click', function(e) {
if (e.target.closest('#historyActionFilter') || e.target.closest('#historyDateFrom') || e.target.closest('#historyDateTo')) {
// Фильтры применяются по кнопке, не нужно ничего делать
}
});

// ==================== ОТЧЕТЫ ====================
let currentReportTab = 'clients';

// Открытие модального окна отчетов
function openReportsModal() {
document.getElementById('reportsModal').style.display = 'block';
// Устанавливаем даты по умолчанию (последний месяц)
const today = new Date();
const monthAgo = new Date();
monthAgo.setMonth(monthAgo.getMonth() - 1);

document.getElementById('reportDateFrom').value = monthAgo.toISOString().split('T')[0];
document.getElementById('reportDateTo').value = today.toISOString().split('T')[0];

loadSpecialistsForFilter();
loadCategoriesForFilter();
loadCurrentReport();
}

// Закрытие модального окна отчетов
function closeReportsModal() {
document.getElementById('reportsModal').style.display = 'none';
}

// Переключение вкладок отчетов
function showReportTab(tab) {
currentReportTab = tab;

// Обновляем стили кнопок
document.querySelectorAll('#reportsModal .btn').forEach(btn => {
btn.style.background = '#6c757d';
});
event.target.style.background = '#e31e24';

// Показываем/скрываем доп. фильтры для заказов
document.getElementById('ordersFilters').style.display = tab === 'orders' ? 'block' : 'none';

loadCurrentReport();
}

// Загрузка текущего отчета
async function loadCurrentReport() {
const dateFrom = document.getElementById('reportDateFrom').value;
const dateTo = document.getElementById('reportDateTo').value;

document.getElementById('reportContent').innerHTML = '<div class="loader"></div>';

switch(currentReportTab) {
case 'clients':
    await loadClientsReport(dateFrom, dateTo);
    break;
case 'orders':
    await loadOrdersReport(dateFrom, dateTo);
    break;
case 'applications':
    await loadApplicationsReport(dateFrom, dateTo);
    break;
case 'specialists':
    await loadSpecialistsReport(dateFrom, dateTo);
    break;
}
}

// Загрузка отчета по клиентам
async function loadClientsReport(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/clients?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=month`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки отчета');

const data = await response.json();

let html = `
    <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
            <div class="stat-info">
                <h3>Всего клиентов</h3>
                <div class="stat-number">${data.summary.TotalClients || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <h3>Новых клиентов</h3>
                <div class="stat-number">${data.summary.NewClients || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <h3>Заявок</h3>
                <div class="stat-number">${data.summary.TotalApplications || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <h3>Стоимость</h3>
                <div class="stat-number">${(data.summary.TotalRevenue || 0).toLocaleString()} BYN</div>
            </div>
        </div>
    </div>
    
    <h3 style="margin-bottom: 15px;">Динамика по месяцам</h3>
`;

if (data.dynamics && data.dynamics.length > 0) {
    html += '<div class="specialists-table"><table><thead><tr><th>Год</th><th>Месяц</th><th>Новые клиенты</th><th>Заявки</th><th>Заказы</th><th>Стоимость</th></tr></thead><tbody>';
    
        data.dynamics.forEach(item => {
const monthRu = translateMonth(item.MonthName);
html += `
<tr>
    <td>${item.Year}</td>
    <td>${monthRu}</td>
    <td>${item.NewClients}</td>
    <td>${item.Applications}</td>
    <td>${item.Orders}</td>
    <td>${(item.Revenue || 0).toLocaleString()} BYN</td>
</tr>
`;
});
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет данных за выбранный период</p>';
}

html += `
    <h3 style="margin: 20px 0 15px;">Топ клиентов</h3>
`;

if (data.topClients && data.topClients.length > 0) {
    html += '<div class="specialists-table"><table><thead><tr><th>Клиент</th><th>Email</th><th>Телефон</th><th>Заказов</th><th>Сумма</th><th>Последний заказ</th></tr></thead><tbody>';
    
    data.topClients.forEach(client => {
        const lastOrder = client.LastOrderDate ? new Date(client.LastOrderDate).toLocaleDateString() : '-';
        html += `
            <tr>
                <td><strong>${client.FullName || 'Без имени'}</strong></td>
                <td>${client.Email || '-'}</td>
                <td>${client.Phone || '-'}</td>
                <td>${client.OrdersCount || 0}</td>
                <td>${(client.TotalSpent || 0).toLocaleString()} BYN</td>
                <td>${lastOrder}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет данных о клиентах</p>';
}

document.getElementById('reportContent').innerHTML = html;

} catch (error) {
console.error('Ошибка:', error);
document.getElementById('reportContent').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки отчета</p>
    </div>
`;
}
}

// Загрузка отчета по заказам
async function loadOrdersReport(dateFrom, dateTo) {
const token = localStorage.getItem('token');
const status = document.getElementById('orderStatusFilter')?.value || '';
const specialistId = document.getElementById('specialistFilter')?.value || '';
const category = document.getElementById('categoryFilter')?.value || '';
const minAmount = document.getElementById('minAmountFilter')?.value || '';
const maxAmount = document.getElementById('maxAmountFilter')?.value || '';

try {
// Загружаем сводку по периодам
const periodResponse = await fetch(`/api/admin/reports/orders/period?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=month${status ? '&status='+status : ''}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!periodResponse.ok) throw new Error('Ошибка загрузки отчета');

const periodData = await periodResponse.json();

// Загружаем детальные заказы с фильтрами
let filterUrl = `/api/admin/reports/orders/filter?dateFrom=${dateFrom}&dateTo=${dateTo}`;
if (status) filterUrl += `&status=${status}`;
if (specialistId) filterUrl += `&specialistId=${specialistId}`;
if (category) filterUrl += `&category=${category}`;
if (minAmount) filterUrl += `&minAmount=${minAmount}`;
if (maxAmount) filterUrl += `&maxAmount=${maxAmount}`;

const ordersResponse = await fetch(filterUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const orders = await ordersResponse.json();

let html = `
    <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card">
            <div class="stat-info">
                <h3>Всего заказов</h3>
                <div class="stat-number">${periodData.summary.TotalOrders || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <h3>Завершено</h3>
                <div class="stat-number">${periodData.summary.CompletedOrders || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <h3>Стоимость</h3>
                <div class="stat-number">${(periodData.summary.TotalRevenue || 0).toLocaleString()} BYN</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-info">
                <h3>Средний чек</h3>
                <div class="stat-number">${(periodData.summary.AverageOrderValue || 0).toLocaleString()} BYN</div>
            </div>
        </div>
    </div>
    
    <h3 style="margin-bottom: 15px;">Динамика по месяцам</h3>
`;

if (periodData.dynamics && periodData.dynamics.length > 0) {
    html += '<div class="specialists-table"><table><thead><tr><th>Год</th><th>Месяц</th><th>Заказы</th><th>Завершено</th><th>Стоимость</th><th>Клиентов</th></tr></thead><tbody>';
    
        periodData.dynamics.forEach(item => {
const monthRu = translateMonth(item.MonthName);
html += `
<tr>
    <td>${item.Year}</td>
    <td>${monthRu}</td>
    <td>${item.OrdersCount}</td>
    <td>${item.CompletedCount}</td>
    <td>${(item.Revenue || 0).toLocaleString()} BYN</td>
    <td>${item.ClientsCount || 0}</td>
</tr>
`;
});
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет данных за выбранный период</p>';
}

html += `
    <h3 style="margin: 20px 0 15px;">Детальный список заказов</h3>
`;

if (orders && orders.length > 0) {
    html += '<div class="specialists-table" style="max-height: 400px; overflow-y: auto;"><table><thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Объект</th><th>Специалист</th><th>Статус</th><th>Сумма</th></tr></thead><tbody>';
    
    orders.forEach(order => {
        const date = order.SignDate ? new Date(order.SignDate).toLocaleDateString() : '-';
        html += `
            <tr>
                <td><strong>${order.ContractNumber || '-'}</strong></td>
                <td>${date}</td>
                <td>${order.ClientName || '-'}</td>
                <td>${order.ObjectName || '-'}</td>
                <td>${order.SpecialistName || '-'}</td>
                <td><span class="status-badge ${order.Status === 'Завершена' ? 'status-active' : 'status-inactive'}">${order.Status || '-'}</span></td>
                <td>${(order.TotalCost || 0).toLocaleString()} BYN</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет заказов по заданным фильтрам</p>';
}

document.getElementById('reportContent').innerHTML = html;

} catch (error) {
console.error('Ошибка:', error);
document.getElementById('reportContent').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки отчета</p>
    </div>
`;
}
}

// Загрузка отчета по заявкам
async function loadApplicationsReport(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/applications/status?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки отчета');

const data = await response.json();

let html = `
    <h3 style="margin-bottom: 15px;">Распределение по статусам</h3>
`;

if (data.summary && data.summary.length > 0) {
    html += '<div class="specialists-table"><tr><thead><tr><th>Статус</th><th>Количество</th><th>Доля</th></tr></thead><tbody>';
    
    data.summary.forEach(item => {
        html += `
            <tr>
                <td><span class="status-badge ${item.Status === 'Завершена' ? 'status-active' : 'status-inactive'}">${item.Status || '-'}</span></td>
                <td><strong>${item.Count}</strong></td>
                <td>${(item.Percentage || 0).toFixed(1)}%</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет данных за выбранный период</p>';
}

html += `
    <h3 style="margin: 20px 0 15px;">Динамика по месяцам</h3>
`;

if (data.dynamics && data.dynamics.length > 0) {
    html += '<div class="specialists-table" style="max-height: 400px; overflow-y: auto;"><tr><thead><tr><th>Год</th><th>Месяц</th><th>Статус</th><th>Количество</th></tr></thead><tbody>';
    
    data.dynamics.forEach(item => {
        // ПЕРЕВОД МЕСЯЦА НА РУССКИЙ
        const monthRu = translateMonth(item.MonthName);
        html += `
            <tr>
                <td>${item.Year}</td>
                <td>${monthRu}</td>
                <td><span class="status-badge ${item.Status === 'Завершена' ? 'status-active' : 'status-inactive'}">${item.Status}</span></td>
                <td>${item.Count}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет данных за выбранный период</p>';
}

document.getElementById('reportContent').innerHTML = html;

} catch (error) {
console.error('Ошибка:', error);
document.getElementById('reportContent').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки отчета</p>
    </div>
`;
}
}

// Загрузка отчета по специалистам
async function loadSpecialistsReport(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/specialists/performance?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки отчета');

const specialists = await response.json();

let html = `
    <h3 style="margin-bottom: 15px;">Эффективность специалистов</h3>
`;

if (specialists && specialists.length > 0) {
    html += '<div class="specialists-table"><table><thead><tr><th>Специалист</th><th>Заявки</th><th>Завершено</th><th>Заказы</th><th>Стоимость</th><th>Ср. чек</th><th>Клиентов</th></tr></thead><tbody>';
    
    specialists.forEach(spec => {
        html += `
            <tr>
                <td><strong>${spec.FullName}</strong><br><small>${spec.Email}</small></td>
                <td>${spec.TotalApplications || 0}</td>
                <td>${spec.CompletedApplications || 0}</td>
                <td>${spec.TotalOrders || 0}</td>
                <td>${(spec.TotalRevenue || 0).toLocaleString()} BYN</td>
                <td>${(spec.AverageOrderValue || 0).toLocaleString()} BYN</td>
                <td>${spec.UniqueClients || 0}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
} else {
    html += '<p class="empty-state">Нет данных за выбранный период</p>';
}

document.getElementById('reportContent').innerHTML = html;

} catch (error) {
console.error('Ошибка:', error);
document.getElementById('reportContent').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки отчета</p>
    </div>
`;
}
}

// Загрузка списка специалистов для фильтра
async function loadSpecialistsForFilter() {
const token = localStorage.getItem('token');

try {
const response = await fetch('/api/admin/specialists?pageSize=100', {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();
const select = document.getElementById('specialistFilter');

let options = '<option value="">Все специалисты</option>';
data.specialists.forEach(spec => {
    options += `<option value="${spec.UserID}">${spec.FullName}</option>`;
});

select.innerHTML = options;

} catch (error) {
console.error('Ошибка:', error);
}
}

// Загрузка категорий для фильтра
async function loadCategoriesForFilter() {
const token = localStorage.getItem('token');

try {
const response = await fetch('/api/object-types/all', {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const categories = await response.json();
const select = document.getElementById('categoryFilter');

let options = '<option value="">Все категории</option>';
categories.forEach(cat => {
    options += `<option value="${cat.TypeName}">${cat.TypeName}</option>`;
});

select.innerHTML = options;

} catch (error) {
console.error('Ошибка:', error);
}
}

// Экспорт текущего отчета
function exportCurrentReport() {
const dateFrom = document.getElementById('reportDateFrom').value;
const dateTo = document.getElementById('reportDateTo').value;
const token = localStorage.getItem('token');

let exportType = currentReportTab;

// Создаем ссылку для скачивания
const link = document.createElement('a');

// Формируем правильный URL
if (exportType === 'orders') {
link.href = `/api/admin/reports/export/orders?dateFrom=${dateFrom}&dateTo=${dateTo}`;
} else if (exportType === 'clients') {
link.href = `/api/admin/reports/export/clients?dateFrom=${dateFrom}&dateTo=${dateTo}`;
} else if (exportType === 'specialists') {
link.href = `/api/admin/reports/export/specialists?dateFrom=${dateFrom}&dateTo=${dateTo}`;
} else {
showToast('Экспорт для этого типа отчета пока не поддерживается', 'info');
return;
}

// Добавляем заголовок авторизации через fetch, так как просто ссылка не передаст заголовки
fetch(link.href, {
headers: {
    'Authorization': `Bearer ${token}`
}
})
.then(response => {
if (!response.ok) throw new Error('Ошибка экспорта');
return response.blob();
})
.then(blob => {
// Создаем временную ссылку для скачивания
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = exportType + '_report.csv';
document.body.appendChild(a);
a.click();
window.URL.revokeObjectURL(url);
document.body.removeChild(a);
})
.catch(error => {
console.error('Ошибка:', error);
showToast('Ошибка при экспорте отчета', 'error');
});
}


// ==================== ФУНКЦИИ ДЛЯ ГРАФИКОВ ====================

// Загрузка статистики по клиентам с графиками
async function loadClientsStats(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/clients?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=month`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();

const container = document.getElementById('statsCharts');

// Формируем данные для графиков
const months = data.dynamics.map(d => `${d.MonthName} ${d.Year}`);
const newClients = data.dynamics.map(d => d.NewClients);
const applications = data.dynamics.map(d => d.Applications);
const orders = data.dynamics.map(d => d.Orders);

container.innerHTML = `
    <div class="charts-grid">
        <div class="chart-card">
            <h3>Динамика новых клиентов</h3>
            <canvas id="clientsChart" style="width: 100%; height: 300px;"></canvas>
        </div>
        <div class="chart-card">
            <h3>Активность клиентов</h3>
            <canvas id="activityChart" style="width: 100%; height: 300px;"></canvas>
        </div>
    </div>
    
    <div class="chart-card" style="margin-top: 30px;">
        <h3>Топ-10 клиентов по сумме заказов</h3>
        <div class="specialists-table">
            <table>
                <thead>
                    <tr>
                        <th>Клиент</th>
                        <th>Email</th>
                        <th>Заказов</th>
                        <th>Сумма</th>
                        <th>Последний заказ</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.topClients.map(client => `
                        <tr>
                            <td><strong>${client.FullName || 'Без имени'}</strong></td>
                            <td>${client.Email || '-'}</td>
                            <td>${client.OrdersCount || 0}</td>
                            <td>${(client.TotalSpent || 0).toLocaleString()} BYN</td>
                            <td>${client.LastOrderDate ? new Date(client.LastOrderDate).toLocaleDateString() : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
`;

// Инициализируем графики после добавления в DOM
setTimeout(() => {
    initClientsChart(months, newClients);
    initActivityChart(months, applications, orders);
}, 100);

} catch (error) {
console.error('Ошибка загрузки статистики клиентов:', error);
document.getElementById('statsCharts').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки данных</p>
    </div>
`;
}
}

// Загрузка статистики по заказам с графиками
async function loadOrdersStats(dateFrom, dateTo) {
const token = localStorage.getItem('token');
const status = document.getElementById('ordersStatusFilter')?.value || '';
const specialistId = document.getElementById('ordersSpecialistFilter')?.value || '';
const category = document.getElementById('ordersCategoryFilter')?.value || '';
const minAmount = document.getElementById('ordersMinAmount')?.value || '';
const maxAmount = document.getElementById('ordersMaxAmount')?.value || '';

try {
// Загружаем сводку по периодам
let periodUrl = `/api/admin/reports/orders/period?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=month`;
if (status) periodUrl += `&status=${status}`;

const periodResponse = await fetch(periodUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
});
const periodData = await periodResponse.json();

// Загружаем детальные заказы
let detailUrl = `/api/admin/reports/orders/filter?dateFrom=${dateFrom}&dateTo=${dateTo}`;
if (status) detailUrl += `&status=${status}`;
if (specialistId) detailUrl += `&specialistId=${specialistId}`;
if (category) detailUrl += `&category=${category}`;
if (minAmount) detailUrl += `&minAmount=${minAmount}`;
if (maxAmount) detailUrl += `&maxAmount=${maxAmount}`;

const detailResponse = await fetch(detailUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
});
const orders = await detailResponse.json();

const container = document.getElementById('statsCharts');

// Формируем данные для графика
const months = periodData.dynamics.map(d => `${d.MonthName} ${d.Year}`);
const ordersCount = periodData.dynamics.map(d => d.OrdersCount);
const revenue = periodData.dynamics.map(d => d.Revenue);

container.innerHTML = `
    <div class="charts-grid">
        <div class="chart-card">
            <h3>Динамика заказов</h3>
            <canvas id="ordersChart" style="width: 100%; height: 300px;"></canvas>
        </div>
        <div class="chart-card">
            <h3>Стоимость по месяцам</h3>
            <canvas id="revenueChart" style="width: 100%; height: 300px;"></canvas>
        </div>
    </div>
    
    <div class="chart-card" style="margin-top: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Детальный список заказов</h3>
            <button class="btn-add" onclick="exportOrders()" style="background: #28a745; padding: 8px 15px;">
                <i class="fas fa-download"></i> Экспорт
            </button>
        </div>
        <div class="specialists-table" style="max-height: 400px; overflow-y: auto;">
            <table>
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Дата</th>
                        <th>Клиент</th>
                        <th>Объект</th>
                        <th>Статус</th>
                        <th>Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td><strong>${order.ContractNumber || '-'}</strong></td>
                            <td>${order.SignDate ? new Date(order.SignDate).toLocaleDateString() : '-'}</td>
                            <td>${order.ClientName || '-'}</td>
                            <td>${order.ObjectName || '-'}</td>
                            <td><span class="status-badge ${order.Status === 'Завершена' ? 'status-active' : 'status-inactive'}">${order.Status || '-'}</span></td>
                            <td>${(order.TotalCost || 0).toLocaleString()} BYN</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
`;

setTimeout(() => {
    initOrdersChart(months, ordersCount);
    initRevenueChart(months, revenue);
}, 100);

} catch (error) {
console.error('Ошибка загрузки статистики заказов:', error);
document.getElementById('statsCharts').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки данных</p>
    </div>
`;
}
}

// Загрузка статистики по заявкам с графиками
async function loadApplicationsStats(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/applications/status?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();

const container = document.getElementById('statsCharts');

// Данные для круговой диаграммы
const statusLabels = data.summary.map(s => s.Status);
const statusCounts = data.summary.map(s => s.Count);

// Данные для линейной диаграммы по месяцам
const months = [...new Set(data.dynamics.map(d => `${d.MonthName} ${d.Year}`))];
const statuses = [...new Set(data.dynamics.map(d => d.Status))];

container.innerHTML = `
    <div class="charts-grid">
        <div class="chart-card">
            <h3>Распределение по статусам</h3>
            <canvas id="statusPieChart" style="width: 100%; height: 300px;"></canvas>
        </div>
        <div class="chart-card">
            <h3>Динамика статусов</h3>
            <canvas id="statusLineChart" style="width: 100%; height: 300px;"></canvas>
        </div>
    </div>
    
    <div class="chart-card" style="margin-top: 30px;">
        <h3>Детальная статистика по статусам</h3>
        <div class="specialists-table">
            <table>
                <thead>
                    <tr>
                        <th>Статус</th>
                        <th>Количество</th>
                        <th>Доля</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.summary.map(item => `
                        <tr>
                            <td><span class="status-badge ${item.Status === 'Завершена' ? 'status-active' : 'status-inactive'}">${item.Status}</span></td>
                            <td><strong>${item.Count}</strong></td>
                            <td>${(item.Percentage || 0).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
`;

setTimeout(() => {
    initPieChart(statusLabels, statusCounts);
    initStatusLineChart(months, statuses, data.dynamics);
}, 100);

} catch (error) {
console.error('Ошибка загрузки статистики заявок:', error);
document.getElementById('statsCharts').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки данных</p>
    </div>
`;
}
}

// Загрузка статистики по специалистам с графиками
async function loadSpecialistsStatsReport(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/specialists/performance?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const specialists = await response.json();

const container = document.getElementById('statsCharts');

// Данные для графика
const names = specialists.map(s => s.FullName);
const orders = specialists.map(s => s.TotalOrders);
const revenue = specialists.map(s => s.TotalRevenue);

container.innerHTML = `
    <div class="charts-grid">
        <div class="chart-card">
            <h3>Заказы по специалистам</h3>
            <canvas id="specialistsOrdersChart" style="width: 100%; height: 300px;"></canvas>
        </div>
        <div class="chart-card">
            <h3>Стоимость по специалистам</h3>
            <canvas id="specialistsRevenueChart" style="width: 100%; height: 300px;"></canvas>
        </div>
    </div>
    
    <div class="chart-card" style="margin-top: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Эффективность специалистов</h3>
            <button class="btn-add" onclick="exportSpecialists()" style="background: #28a745; padding: 8px 15px;">
                <i class="fas fa-download"></i> Экспорт
            </button>
        </div>
        <div class="specialists-table">
            <table>
                <thead>
                    <tr>
                        <th>Специалист</th>
                        <th>Заявки</th>
                        <th>Завершено</th>
                        <th>Заказы</th>
                        <th>Стоимость</th>
                        <th>Клиентов</th>
                    </tr>
                </thead>
                <tbody>
                    ${specialists.map(spec => `
                        <tr>
                            <td><strong>${spec.FullName}</strong></td>
                            <td>${spec.TotalApplications || 0}</td>
                            <td>${spec.CompletedApplications || 0}</td>
                            <td>${spec.TotalOrders || 0}</td>
                            <td>${(spec.TotalRevenue || 0).toLocaleString()} BYN</td>
                            <td>${spec.UniqueClients || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
`;

setTimeout(() => {
    initSpecialistsOrdersChart(names, orders);
    initSpecialistsRevenueChart(names, revenue);
}, 100);

} catch (error) {
console.error('Ошибка загрузки статистики специалистов:', error);
document.getElementById('statsCharts').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки данных</p>
    </div>
`;
}
}

// Загрузка статистики по выручке с графиками
async function loadRevenueStats(dateFrom, dateTo) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reports/orders/period?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=month`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();

const container = document.getElementById('statsCharts');

const months = data.dynamics.map(d => `${d.MonthName} ${d.Year}`);
const revenue = data.dynamics.map(d => d.Revenue);
const avgCheck = data.dynamics.map(d => d.Revenue / (d.OrdersCount || 1));

container.innerHTML = `
    <div class="charts-grid">
        <div class="chart-card">
            <h3>Динамика выручки</h3>
            <canvas id="revenueLineChart" style="width: 100%; height: 300px;"></canvas>
        </div>
        <div class="chart-card">
            <h3>Средний чек</h3>
            <canvas id="avgCheckChart" style="width: 100%; height: 300px;"></canvas>
        </div>
    </div>
    
    <div class="charts-grid" style="margin-top: 30px;">
        <div class="chart-card">
            <h3>Основные показатели</h3>
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <span>Общая Стоимость:</span>
                    <strong>${(data.summary?.TotalRevenue || 0).toLocaleString()} BYN</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <span>Средний чек:</span>
                    <strong>${(data.summary?.AverageOrderValue || 0).toLocaleString()} BYN</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <span>Всего заказов:</span>
                    <strong>${data.summary?.TotalOrders || 0}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Уникальных клиентов:</span>
                    <strong>${data.summary?.UniqueClients || 0}</strong>
                </div>
            </div>
        </div>
        <div class="chart-card">
            <h3>Прогноз на следующий месяц</h3>
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <span>Ожидаемая Стоимость:</span>
                    <strong style="color: #28a745;">${(calculateForecast(revenue) || 0).toLocaleString()} BYN</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Рост к прошлому месяцу:</span>
                    <strong style="color: ${getGrowthColor(revenue)}">${calculateGrowth(revenue)}%</strong>
                </div>
            </div>
        </div>
    </div>
`;

setTimeout(() => {
    initRevenueLineChart(months, revenue);
    initAvgCheckChart(months, avgCheck);
}, 100);

} catch (error) {
console.error('Ошибка загрузки статистики выручки:', error);
document.getElementById('statsCharts').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка загрузки данных</p>
    </div>
`;
}
}

// ==================== ФУНКЦИИ ДЛЯ ИНИЦИАЛИЗАЦИИ ГРАФИКОВ ====================

function initClientsChart(labels, data) {
const ctx = document.getElementById('clientsChart').getContext('2d');
new Chart(ctx, {
type: 'line',
data: {
    labels: labels,
    datasets: [{
        label: 'Новые клиенты',
        data: data,
        borderColor: '#e31e24',
        backgroundColor: 'rgba(227, 30, 36, 0.1)',
        tension: 0.4,
        fill: true
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false }
    }
}
});
}

function initActivityChart(labels, applications, orders) {
const ctx = document.getElementById('activityChart').getContext('2d');
new Chart(ctx, {
type: 'bar',
data: {
    labels: labels,
    datasets: [
        {
            label: 'Заявки',
            data: applications,
            backgroundColor: '#17a2b8',
        },
        {
            label: 'Заказы',
            data: orders,
            backgroundColor: '#28a745',
        }
    ]
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

function initOrdersChart(labels, data) {
const ctx = document.getElementById('ordersChart').getContext('2d');
new Chart(ctx, {
type: 'line',
data: {
    labels: labels,
    datasets: [{
        label: 'Количество заказов',
        data: data,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        tension: 0.4,
        fill: true
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

function initRevenueChart(labels, data) {
const ctx = document.getElementById('revenueChart').getContext('2d');
new Chart(ctx, {
type: 'bar',
data: {
    labels: labels,
    datasets: [{
        label: 'Стоимость (BYN)',
        data: data,
        backgroundColor: '#28a745',
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            ticks: {
                callback: function(value) {
                    return value.toLocaleString() + ' BYN';
                }
            }
        }
    }
}
});
}

function initPieChart(labels, data) {
const ctx = document.getElementById('statusPieChart').getContext('2d');
new Chart(ctx, {
type: 'doughnut',
data: {
    labels: labels,
    datasets: [{
        data: data,
        backgroundColor: [
            '#ffc107',
            '#17a2b8',
            '#28a745',
            '#dc3545',
            '#6c757d'
        ]
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

function initStatusLineChart(months, statuses, dynamics) {
const ctx = document.getElementById('statusLineChart').getContext('2d');

const datasets = statuses.map((status, index) => {
const colors = ['#ffc107', '#17a2b8', '#28a745', '#dc3545', '#6c757d'];
const data = months.map(month => {
    const entry = dynamics.find(d => `${d.MonthName} ${d.Year}` === month && d.Status === status);
    return entry ? entry.Count : 0;
});

return {
    label: status,
    data: data,
    borderColor: colors[index % colors.length],
    tension: 0.4
};
});

new Chart(ctx, {
type: 'line',
data: {
    labels: months,
    datasets: datasets
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

function initSpecialistsOrdersChart(labels, data) {
const ctx = document.getElementById('specialistsOrdersChart').getContext('2d');
new Chart(ctx, {
type: 'bar',
data: {
    labels: labels,
    datasets: [{
        label: 'Количество заказов',
        data: data,
        backgroundColor: '#007bff',
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

function initSpecialistsRevenueChart(labels, data) {
const ctx = document.getElementById('specialistsRevenueChart').getContext('2d');
new Chart(ctx, {
type: 'bar',
data: {
    labels: labels,
    datasets: [{
        label: 'Стоимость (BYN)',
        data: data,
        backgroundColor: '#28a745',
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            ticks: {
                callback: function(value) {
                    return value.toLocaleString() + ' BYN';
                }
            }
        }
    }
}
});
}

function initRevenueLineChart(labels, data) {
const ctx = document.getElementById('revenueLineChart').getContext('2d');
new Chart(ctx, {
type: 'line',
data: {
    labels: labels,
    datasets: [{
        label: 'Стоимость',
        data: data,
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4,
        fill: true
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

function initAvgCheckChart(labels, data) {
const ctx = document.getElementById('avgCheckChart').getContext('2d');
new Chart(ctx, {
type: 'line',
data: {
    labels: labels,
    datasets: [{
        label: 'Средний чек',
        data: data,
        borderColor: '#ffc107',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        tension: 0.4,
        fill: true
    }]
},
options: {
    responsive: true,
    maintainAspectRatio: false
}
});
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function calculateForecast(revenue) {
if (revenue.length < 3) return 0;
const last3 = revenue.slice(-3);
const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
return Math.round(avg * 1.1); // +10% прогноз
}

function calculateGrowth(revenue) {
if (revenue.length < 2) return 0;
const last = revenue[revenue.length - 1];
const prev = revenue[revenue.length - 2];
if (prev === 0) return 100;
return ((last - prev) / prev * 100).toFixed(1);
}

function getGrowthColor(revenue) {
const growth = calculateGrowth(revenue);
return growth >= 0 ? '#28a745' : '#dc3545';
}

// Функции для экспорта
function exportOrders() {
const dateFrom = document.getElementById('statsDateFrom').value;
const dateTo = document.getElementById('statsDateTo').value;
const token = localStorage.getItem('token');

fetch(`/api/admin/reports/export/orders?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
headers: {
    'Authorization': `Bearer ${token}`
}
})
.then(response => {
if (!response.ok) throw new Error('Ошибка экспорта');
return response.blob();
})
.then(blob => {
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'orders_report.csv';
document.body.appendChild(a);
a.click();
window.URL.revokeObjectURL(url);
document.body.removeChild(a);
})
.catch(error => {
console.error('Ошибка:', error);
showToast('Ошибка при экспорте отчета', 'error');
});
}


function exportSpecialists() {
const dateFrom = document.getElementById('statsDateFrom').value;
const dateTo = document.getElementById('statsDateTo').value;
const token = localStorage.getItem('token');

fetch(`/api/admin/reports/export/specialists?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
headers: {
    'Authorization': `Bearer ${token}`
}
})
.then(response => {
if (!response.ok) throw new Error('Ошибка экспорта');
return response.blob();
})
.then(blob => {
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'specialists_report.csv';
document.body.appendChild(a);
a.click();
window.URL.revokeObjectURL(url);
document.body.removeChild(a);
})
.catch(error => {
console.error('Ошибка:', error);
showToast('Ошибка при экспорте отчета', 'error');
});
}

// ==================== СТРАНИЦА СТАТИСТИКИ ====================
let currentStatsTab = 'clients';

function renderStatsPage() {
const container = document.getElementById('dynamicContent');

container.innerHTML = `
<div style="margin-bottom:24px;">
    <h2 style="margin:0 0 4px 0;">Аналитика и отчёты</h2>
    <p style="margin:0;color:#888;font-size:13px;">Отчёт по клиентам и отчёт по заказам</p>
</div>

<div class="filters-panel" style="margin-bottom:24px;">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
       <div>
<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Период с</label>
<input type="date" id="statsDateFrom" class="filter-select" 
   value="${getDateMonthsAgo(3)}" 
   max="${getCurrentDate()}"
   onchange="onStatsDateChange()">
</div>
<div>
<label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Период по</label>
<input type="date" id="statsDateTo" class="filter-select" 
   value="${getCurrentDate()}" 
   max="${getCurrentDate()}"
   onchange="onStatsDateChange()">
</div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Группировка</label>
            <select id="statsGroupBy" class="filter-select">
                <option value="month">По месяцам</option>
                <option value="day">По дням</option>
                <option value="year">По годам</option>
            </select>
        </div>
        <button class="btn-primary" onclick="loadStatsData()" style="padding:10px 20px;height:38px;">
            <i class="fas fa-sync-alt"></i> Обновить
        </button>
    </div>
</div>

<div class="stats-grid" id="statsSummaryCards" style="margin-bottom:24px;">
    <div class="stat-card">
        <div class="stat-info">
            <h3>Загрузка...</h3>
            <div class="stat-number"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
    </div>
</div>

<div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid #e8ecf0;">
    <button id="tabBtnClients" onclick="switchStatsTab('clients', event)"
        style="padding:10px 24px;border:none;background:none;cursor:pointer;
               font-size:14px;font-weight:600;color:#e31e24;
               border-bottom:3px solid #e31e24;margin-bottom:-2px;transition:all .2s;">
        <i class="fas fa-users"></i> Клиенты
    </button>
    <button id="tabBtnOrders" onclick="switchStatsTab('orders', event)"
        style="padding:10px 24px;border:none;background:none;cursor:pointer;
               font-size:14px;font-weight:400;color:#888;
               border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .2s;">
        <i class="fas fa-file-contract"></i> Заказы
    </button>
</div>

<div id="ordersExtraFilters" style="display:none;margin-bottom:16px;">
    <div class="filters-panel" style="padding:12px 16px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
            <div>
                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Статус</label>
                <select id="ordersStatusFilter" class="filter-select" style="min-width:160px;">
                    <option value="">Все статусы</option>
                    <option value="Новая">Новая</option>
                    <option value="В работе">В работе</option>
                    <option value="Завершена">Завершена</option>
                    <option value="Отклонена">Отклонена</option>
                </select>
            </div>
            <div>
                <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Специалист</label>
                <select id="ordersSpecialistFilter" class="filter-select" style="min-width:180px;">
                    <option value="">Все специалисты</option>
                </select>
            </div>
            <button class="btn-primary" onclick="loadStatsData()" style="padding:8px 16px;height:36px;">
                <i class="fas fa-filter"></i> Применить
            </button>
        </div>
    </div>
</div>

<div id="statsReportContent"><div class="loader"></div></div>

<style>
    .report-section { 
        margin-bottom: 28px; 
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        overflow: hidden;
    }
    .report-section h3 {
        font-size:14px;font-weight:600;color:#1a1a2e;
        margin:0;padding:15px 20px;
        background: #f8fafc;
        border-bottom:2px solid #e31e24;
    }
    .report-table-wrap { 
        max-height: 400px; 
        overflow-y: auto; 
        border-bottom: 1px solid #e8ecf0;
    }
    .report-table {
        width:100%;
        border-collapse:collapse;
        font-size:13px;
        font-family:'Segoe UI',Arial,sans-serif;
    }
    .report-table thead {
        position: sticky;
        top: 0;
        z-index: 10;
    }
    .report-table thead tr {
        background: #c0392b;
        color: #fff;
    }
    .report-table thead th {
        padding: 12px 14px;
        text-align: left;
        font-weight: 600;
        white-space: nowrap;
        border: 1px solid #a93226;
    }
    .report-table tbody tr:nth-child(even) td { 
        background: #f8fafc; 
    }
    .report-table tbody tr:hover td { 
        background: #fef9f9; 
    }
    .report-table tbody td {
        padding: 10px 14px;
        border: 1px solid #e8ecf0;
        color: #333;
        vertical-align: middle;
    }
    .report-table tfoot td {
        padding: 10px 14px;
        border: 1px solid #d5e8f5;
        background: #ebf5fb;
        font-weight: 700;
        color: #1a1a2e;
        position: sticky;
        bottom: 0;
        z-index: 5;
    }
    .badge-done   { 
        background:#d5f5e3;color:#1e8449;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:600; 
        display: inline-block;
    }
    .badge-work   { 
        background:#fef9e7;color:#b7770d;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:600;
        display: inline-block;
    }
    .badge-new    { 
        background:#eaf4fb;color:#1a5276;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:600;
        display: inline-block;
    }
    .badge-reject { 
        background:#fdedec;color:#922b21;padding:3px 9px;border-radius:12px;font-size:11px;font-weight:600;
        display: inline-block;
    }
    .export-btn {
        display:inline-flex;align-items:center;gap:8px;
        background:#217346;color:#fff;border:none;
        padding:10px 22px;border-radius:6px;font-size:14px;
        font-weight:600;cursor:pointer;transition:background .2s;
    }
    .export-btn:hover { background:#185c38; }
    
    /* Стили для скроллбара */
    .report-table-wrap::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .report-table-wrap::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
    }
    .report-table-wrap::-webkit-scrollbar-thumb {
        background: #c0392b;
        border-radius: 4px;
    }
    .report-table-wrap::-webkit-scrollbar-thumb:hover {
        background: #a93226;
    }
</style>
`;

loadStatsData();
}

// Функция для построения таблицы с прокруткой
function buildTable(title, ths, rows, showTotals = false) {
// Определяем, есть ли строки с данными
const hasRows = rows && rows.length > 0;

// Если есть подвал (итоги), отделяем его от основного контента
let tfootContent = '';
let bodyContent = rows;

if (showTotals && rows.includes('</tfoot>')) {
const parts = rows.split('</tfoot>');
bodyContent = parts[0];
tfootContent = parts[1] ? parts[1] + '</tfoot>' : '';
}

return `
<div class="report-section">
    <h3>${title}</h3>
    <div class="report-table-wrap">
        <table class="report-table">
            <thead>
                <tr>${ths}</tr>
            </thead>
            <tbody>
                ${bodyContent}
            </tbody>
            ${tfootContent ? `<tfoot>${tfootContent}</tfoot>` : ''}
        </table>
    </div>
</div>`;
}

function getCurrentDate() {
return new Date().toISOString().split('T')[0];
}

function getDateMonthsAgo(months) {
const d = new Date();
d.setMonth(d.getMonth() - months);
return d.toISOString().split('T')[0];
}

function fmtNum(v) {
if (v === null || v === undefined) return '0';
return Number(v).toLocaleString('ru-RU');
}

function fmtDate(v) {
if (!v) return '—';
try { return new Date(v).toLocaleDateString('ru-RU'); } catch { return v; }
}

// ── Переключение вкладок ─────────────────────────────────────────

function switchStatsTab(tab, event) {
currentStatsTab = tab;

['clients','orders'].forEach(t => {
const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
if (!btn) return;
const active = t === tab;
btn.style.color = active ? '#e31e24' : '#888';
btn.style.borderBottomColor = active ? '#e31e24' : 'transparent';
btn.style.fontWeight = active ? '600' : '400';
});

const extra = document.getElementById('ordersExtraFilters');
if (extra) {
extra.style.display = tab === 'orders' ? 'block' : 'none';
if (tab === 'orders') loadSpecialistsForOrdersFilter();
}

loadStatsData();
}

// ── Загрузка ─────────────────────────────────────────────────────

async function loadStatsData() {
const df = document.getElementById('statsDateFrom')?.value || getDateMonthsAgo(3);
const dt = document.getElementById('statsDateTo')?.value   || getCurrentDate();
await loadSummaryCards(df, dt);
if (currentStatsTab === 'clients') loadClientsTabData(df, dt);
else loadOrdersTabData(df, dt);
}

// Алиас для обратной совместимости
function loadAllStats() { loadStatsData(); }

async function loadSummaryCards(df, dt) {
const token = localStorage.getItem('token');
try {
const [cRes, oRes] = await Promise.all([
    fetch(`/api/admin/reports/clients?dateFrom=${df}&dateTo=${dt}`, { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch(`/api/admin/reports/orders/period?dateFrom=${df}&dateTo=${dt}`, { headers: { 'Authorization': `Bearer ${token}` } })
]);
const cData = cRes.ok ? await cRes.json() : {};
const oData = oRes.ok ? await oRes.json() : {};
const cs = cData.summary || {};
const os = oData.summary || {};

document.getElementById('statsSummaryCards').innerHTML = `
    ${kpiCard('fa-user-plus','Новых клиентов', fmtNum(cs.NewClients), 'Всего: ' + fmtNum(cs.TotalClients))}
    ${kpiCard('fa-file-alt','Заявок', fmtNum(cs.TotalApplications), 'За период')}
    ${kpiCard('fa-file-contract','Заказов', fmtNum(os.TotalOrders), 'Завершено: ' + fmtNum(os.CompletedOrders))}
    ${kpiCard('fa-users','Уникальных клиентов', fmtNum(os.UniqueClients), 'В заказах')}
`;
} catch(e) { console.error('KPI error:', e); }
}

function kpiCard(icon, label, value, sub) {
return `
<div class="stat-card">
    <div class="stat-info">
        <h3>${label}</h3>
        <div class="stat-number">${value}</div>
        <small style="color:#999;">${sub}</small>
    </div>
    <div class="stat-icon"><i class="fas ${icon}"></i></div>
</div>`;
}

// ── ОТЧЁТ ПО КЛИЕНТАМ ────────────────────────────────────────────

async function loadClientsTabData(df, dt) {
const token = localStorage.getItem('token');
const groupBy = document.getElementById('statsGroupBy')?.value || 'month';
const container = document.getElementById('statsReportContent');
container.innerHTML = '<div class="loader"></div>';

try {
const res = await fetch(
    `/api/admin/reports/clients?dateFrom=${df}&dateTo=${dt}&groupBy=${groupBy}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
);
if (!res.ok) throw new Error();
const data = await res.json();
const { dynamics = [], topClients = [] } = data;

let dynHtml = '';
if (dynamics.length) {
    const byMonth = !!dynamics[0].MonthName;
    let ths, rows, showTotals = false;
    
    if (byMonth) {
        ths = `<th>Год</th><th>Месяц</th><th>Новых клиентов</th><th>Заявок</th><th>Заказов</th>`;
        rows = dynamics.map(d => `
            <tr>
                <td style="text-align:center">${d.Year}</td>
                <td>${d.MonthName}</td>
                <td style="text-align:center">${fmtNum(d.NewClients)}</td>
                <td style="text-align:center">${fmtNum(d.Applications)}</td>
                <td style="text-align:center">${fmtNum(d.Orders)}</td>
            </tr>`).join('');
        
        const totNC = dynamics.reduce((s,d)=>s+(d.NewClients||0),0);
        const totAp = dynamics.reduce((s,d)=>s+(d.Applications||0),0);
        const totOr = dynamics.reduce((s,d)=>s+(d.Orders||0),0);
        rows += `<tfoot><tr>
            <td colspan="2" style="text-align:left;">ИТОГО</td>
            <td style="text-align:center">${fmtNum(totNC)}</td>
            <td style="text-align:center">${fmtNum(totAp)}</td>
            <td style="text-align:center">${fmtNum(totOr)}</td>
        </tr></tfoot>`;
        showTotals = true;
    } else {
        ths = `<th>Год</th><th>Новых клиентов</th><th>Заявок</th><th>Заказов</th>`;
        rows = dynamics.map(d => `
            <tr>
                <td style="text-align:center">${d.Year}</td>
                <td style="text-align:center">${fmtNum(d.NewClients)}</td>
                <td style="text-align:center">${fmtNum(d.Applications)}</td>
                <td style="text-align:center">${fmtNum(d.Orders)}</td>
            </tr>`).join('');
    }
    dynHtml = buildTable('Динамика по периодам', ths, rows, showTotals);
}

let topHtml = '';
if (topClients.length) {
    const ths2 = `<th>ФИО клиента</th><th>Email</th><th>Телефон</th><th>Заказов</th><th>Последний заказ</th>`;
    const rows2 = topClients.map(c => `
        <tr>
            <td><strong>${escapeHtml(c.FullName||'—')}</strong></td>
            <td>${escapeHtml(c.Email||'—')}</td>
            <td>${escapeHtml(c.Phone||'—')}</td>
            <td style="text-align:center">${fmtNum(c.OrdersCount)}</td>
            <td style="text-align:center">${fmtDate(c.LastOrderDate)}</td>
        </tr>`).join('');
    topHtml = buildTable('Топ клиентов по количеству заказов', ths2, rows2, false);
}

container.innerHTML = `
    ${dynHtml}
    ${topHtml}
    ${!dynHtml && !topHtml ? emptyState('fa-users','Нет данных за выбранный период') : ''}
    <div style="margin-top:20px;display:flex;justify-content:flex-end;">
        <button class="export-btn" onclick="exportClientsReport()">
            <i class="fas fa-file-excel"></i> Экспорт в Excel
        </button>
    </div>`;
} catch(e) {
console.error(e);
container.innerHTML = emptyState('fa-exclamation-triangle','Ошибка загрузки данных');
}
}
// ── ОТЧЁТ ПО ЗАКАЗАМ ─────────────────────────────────────────────
async function loadOrdersTabData(df, dt) {
const token = localStorage.getItem('token');
const groupBy = document.getElementById('statsGroupBy')?.value || 'month';
const status = document.getElementById('ordersStatusFilter')?.value || '';
const specialistId = document.getElementById('ordersSpecialistFilter')?.value || '';
const container = document.getElementById('statsReportContent');
container.innerHTML = '<div class="loader"></div>';

try {
let periodUrl = `/api/admin/reports/orders/period?dateFrom=${df}&dateTo=${dt}&groupBy=${groupBy}`;
if (status) periodUrl += `&status=${encodeURIComponent(status)}`;

let filterUrl = `/api/admin/reports/orders/filter?dateFrom=${df}&dateTo=${dt}`;
if (status) filterUrl += `&status=${encodeURIComponent(status)}`;
if (specialistId) filterUrl += `&specialistId=${specialistId}`;

const [pRes, fRes] = await Promise.all([
    fetch(periodUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch(filterUrl, { headers: { 'Authorization': `Bearer ${token}` } })
]);
const periodData = pRes.ok ? await pRes.json() : {};
const orders     = fRes.ok ? await fRes.json() : [];
const { dynamics = [] } = periodData;

let dynHtml = '';
if (dynamics.length) {
    const byMonth = !!dynamics[0].MonthName;
    let ths, rows, showTotals = false;
    
    if (byMonth) {
        ths = `<th>Год</th><th>Месяц</th><th>Заказов</th><th>Завершено</th><th>Клиентов</th>`;
        rows = dynamics.map(d => `
            <tr>
                <td style="text-align:center">${d.Year}</td>
                <td>${d.MonthName}</td>
                <td style="text-align:center">${fmtNum(d.OrdersCount)}</td>
                <td style="text-align:center">${fmtNum(d.CompletedCount)}</td>
                <td style="text-align:center">${fmtNum(d.ClientsCount)}</td>
            </tr>`).join('');
        
        const totO = dynamics.reduce((s,d)=>s+(d.OrdersCount||0),0);
        const totC = dynamics.reduce((s,d)=>s+(d.CompletedCount||0),0);
        rows += `<tfoot><tr>
            <td colspan="2" style="text-align:left;">ИТОГО</td>
            <td style="text-align:center">${fmtNum(totO)}</td>
            <td style="text-align:center">${fmtNum(totC)}</td>
            <td></td>
        </tr></tfoot>`;
        showTotals = true;
    } else {
        ths = `<th>Год</th><th>Заказов</th><th>Завершено</th><th>Клиентов</th>`;
        rows = dynamics.map(d => `
            <tr>
                <td style="text-align:center">${d.Year}</td>
                <td style="text-align:center">${fmtNum(d.OrdersCount)}</td>
                <td style="text-align:center">${fmtNum(d.CompletedCount)}</td>
                <td style="text-align:center">${fmtNum(d.ClientsCount)}</td>
            </tr>`).join('');
    }
    dynHtml = buildTable('Динамика по периодам', ths, rows, showTotals);
}

let listHtml = '';
if (orders.length) {
    const ths2 = `<th>№ Договора</th><th>Дата</th><th>Клиент</th><th>Объект</th><th>Специалист</th><th>Статус</th>`;
    const rows2 = orders.map(o => {
        const st = o.Status || '';
        const badge = st === 'Завершена' ? `<span class="badge-done">${st}</span>` :
                      st === 'В работе'  ? `<span class="badge-work">${st}</span>` :
                      st === 'Новая'     ? `<span class="badge-new">${st}</span>`  :
                      st === 'Отклонена' ? `<span class="badge-reject">${st}</span>` :
                      `<span>${st}</span>`;
        return `
            <tr>
                <td><strong>${escapeHtml(o.ContractNumber||'—')}</strong></td>
                <td style="text-align:center">${fmtDate(o.SignDate)}</td>
                <td>${escapeHtml(o.ClientName||'—')}</td>
                <td>${escapeHtml(o.ObjectName||'—')}</td>
                <td>${escapeHtml(o.SpecialistName||'—')}</td>
                <td style="text-align:center">${badge}</td>
            </tr>`;
    }).join('');
    listHtml = buildTable(`Список заказов — всего: ${orders.length}`, ths2, rows2, false);
}

container.innerHTML = `
    ${dynHtml}
    ${listHtml}
    ${!dynHtml && !listHtml ? emptyState('fa-file-contract','Нет заказов по заданным фильтрам') : ''}
    <div style="margin-top:20px;display:flex;justify-content:flex-end;">
        <button class="export-btn" onclick="exportOrdersReport()">
            <i class="fas fa-file-excel"></i> Экспорт в Excel
        </button>
    </div>`;
} catch(e) {
console.error(e);
container.innerHTML = emptyState('fa-exclamation-triangle','Ошибка загрузки данных');
}
}

// ── Вспомогательные функции HTML ─────────────────────────────────

function emptyState(icon, text) {
return `<div class="empty-state"><i class="fas ${icon}"></i><p>${text}</p></div>`;
}

// ── Специалисты для фильтра заказов ──────────────────────────────

async function loadSpecialistsForOrdersFilter() {
const token = localStorage.getItem('token');
const sel = document.getElementById('ordersSpecialistFilter');
if (!sel) return;
try {
const res = await fetch('/api/admin/specialists?pageSize=100', { headers: { 'Authorization': `Bearer ${token}` } });
const data = res.ok ? await res.json() : {};
let opts = '<option value="">Все специалисты</option>';
(data.specialists || []).forEach(s => { opts += `<option value="${s.UserID}">${escapeHtml(s.FullName)}</option>`; });
sel.innerHTML = opts;
} catch(e) { console.error(e); }
}

// ==================== ЭКСПОРТ В EXCEL ====================

// Экспорт текущего отчета
function exportCurrentStats() {
if (currentStatsTab === 'clients') exportClientsReport();
else if (currentStatsTab === 'orders') exportOrdersReport();
else showToast('Выберите вкладку Клиенты или Заказы для экспорта', 'info');
}

// Экспорт отчета по клиентам
async function exportClientsReport() {
const token = localStorage.getItem('token');
const df = document.getElementById('statsDateFrom')?.value || getDateMonthsAgo(3);
const dt = document.getElementById('statsDateTo')?.value   || getCurrentDate();
const groupBy = document.getElementById('statsGroupBy')?.value || 'month';

showToast('Формирование файла Excel...', 'info');

try {
const response = await fetch(
    `/api/admin/reports/export/clients?dateFrom=${df}&dateTo=${dt}&groupBy=${groupBy}`,
    { 
        headers: { 'Authorization': `Bearer ${token}` },
        // Важно: не указываем 'Accept' как application/json, чтобы получить blob
    }
);

if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Ошибка сервера');
}

// Получаем blob из ответа
const blob = await response.blob();

// Создаем URL для blob
const url = window.URL.createObjectURL(blob);

// Создаем временную ссылку для скачивания
const a = document.createElement('a');
a.href = url;
a.download = `Отчёт_клиенты_${df}_${dt}.xlsx`;
document.body.appendChild(a);
a.click();

// Очищаем
window.URL.revokeObjectURL(url);
document.body.removeChild(a);

showToast('Файл Excel готов!', 'success');

} catch (error) {
console.error('Ошибка экспорта:', error);
showToast('Ошибка экспорта: ' + error.message, 'error');
}
}

// Экспорт отчета по заказам
async function exportOrdersReport() {
const token = localStorage.getItem('token');
const df = document.getElementById('statsDateFrom')?.value || getDateMonthsAgo(3);
const dt = document.getElementById('statsDateTo')?.value   || getCurrentDate();
const groupBy = document.getElementById('statsGroupBy')?.value || 'month';
const status = document.getElementById('ordersStatusFilter')?.value || '';
const specialistId = document.getElementById('ordersSpecialistFilter')?.value || '';

showToast('Формирование файла Excel...', 'info');

try {
let url = `/api/admin/reports/export/orders?dateFrom=${df}&dateTo=${dt}&groupBy=${groupBy}`;
if (status) url += `&status=${encodeURIComponent(status)}`;
if (specialistId) url += `&specialistId=${specialistId}`;

const response = await fetch(url, { 
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Ошибка сервера');
}

const blob = await response.blob();
const url_blob = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url_blob;
a.download = `Отчёт_заказы_${df}_${dt}.xlsx`;
document.body.appendChild(a);
a.click();
window.URL.revokeObjectURL(url_blob);
document.body.removeChild(a);

showToast('Файл Excel готов!', 'success');

} catch (error) {
console.error('Ошибка экспорта:', error);
showToast('Ошибка экспорта: ' + error.message, 'error');
}
}

// Функция для скачивания blob (универсальная)
function downloadBlob(blob, filename) {
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
window.URL.revokeObjectURL(url);
document.body.removeChild(a);
}

// Алиас для обратной совместимости с menu-item обработчиком
function loadStatsTabData() { loadStatsData(); }

// ==================== УПРАВЛЕНИЕ НОРМАМИ СРОКОВ РАБОТ ====================

// Загрузка страницы с правилами
async function loadWorkRules() {
const token = localStorage.getItem('token');

try {
document.getElementById('dynamicContent').innerHTML = '<div class="loader"></div>';

// Загружаем все необходимые справочники
const [typesResponse, worksResponse, rulesResponse] = await Promise.all([
    fetch('/api/object-types/all', { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch('/api/work-types', { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch('/api/admin/work-rules', { headers: { 'Authorization': `Bearer ${token}` } })
]);

const objectTypes = await typesResponse.json();
const workTypes = await worksResponse.json();
const rules = await rulesResponse.json();

renderWorkRulesPage(objectTypes, workTypes, rules);

} catch (error) {
console.error('Ошибка загрузки:', error);
document.getElementById('dynamicContent').innerHTML = `
    <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Ошибка загрузки</h3>
        <p>Не удалось загрузить данные</p>
        <button class="btn-add" onclick="loadWorkRules()">Повторить</button>
    </div>
`;
}
}
// Отрисовка страницы с правилами
function renderWorkRulesPage(objectTypes, workTypes, rules) {
const rulesByType = {};
rules.forEach(rule => {
if (!rulesByType[rule.ObjectTypeID]) {
    rulesByType[rule.ObjectTypeID] = {
        typeName: rule.ObjectTypeName,
        objectTypeId: rule.ObjectTypeID,
        rules: []
    };
}
rulesByType[rule.ObjectTypeID].rules.push(rule);
});

const typeEntries = Object.entries(rulesByType);

let html = `
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
    <h2 style="margin:0;"></h2>
    <button class="btn-add" onclick="openRuleModal()">
        <i class="fas fa-plus"></i> Добавить правило
    </button>
</div>

<div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
    <div class="search-box" style="flex:1; min-width:200px;">
        <i class="fas fa-search"></i>
        <input type="text" id="rulesSearch"
               placeholder="Поиск по типу объекта или виду работы..."
               oninput="filterRules()"
               style="width:100%;">
    </div>
    <button onclick="document.getElementById('rulesSearch').value=''; filterRules();"
            style="padding:8px 14px; background:#6c757d; color:white; border:none;
                   border-radius:4px; cursor:pointer; height:42px; white-space:nowrap;">
        <i class="fas fa-times"></i> Сбросить
    </button>
</div>

<div id="rulesSearchInfo" style="margin-bottom:10px; font-size:13px; color:#666; min-height:20px;"></div>
`;

if (typeEntries.length === 0) {
html += `
    <div class="empty-state">
        <i class="fas fa-clock"></i>
        <h3>Нет правил расчета сроков</h3>
        <p>Добавьте первое правило, нажав кнопку выше</p>
    </div>
`;
} else {
html += '<div id="rulesAccordion">';
typeEntries.forEach(([typeId, typeData]) => {
    html += `
        <div class="rule-group-wrap" data-type-name="${escapeHtml(typeData.typeName).toLowerCase()}"
             style="background:white; border-radius:8px; margin-bottom:10px;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08); overflow:hidden;">

            <div onclick="toggleRuleGroup(${typeId})"
                 style="padding:14px 20px; background:#f8f9fa; border-left:4px solid #e31e24;
                        display:flex; justify-content:space-between; align-items:center;
                        cursor:pointer; user-select:none;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i id="chevron-${typeId}" class="fas fa-chevron-right"
                       style="color:#e31e24; transition:transform .2s; width:14px;"></i>
                    <span style="font-weight:600; font-size:15px;">
                        <i class="fas fa-building" style="color:#999; margin-right:6px;"></i>
                        ${escapeHtml(typeData.typeName)}
                    </span>
                    <span id="badge-${typeId}" style="background:#e31e24; color:white;
                          border-radius:12px; font-size:12px; padding:2px 10px; font-weight:600;">
                        ${typeData.rules.length}
                    </span>
                </div>
                <div style="display:flex; gap:8px;" onclick="event.stopPropagation()">
                    <button onclick="openRuleModal(null, ${typeData.objectTypeId})"
                            style="background:#28a745; color:white; border:none; padding:6px 12px;
                                   border-radius:4px; cursor:pointer; font-size:13px;">
                        <i class="fas fa-plus"></i> Добавить
                    </button>
                    <button onclick="deleteRuleGroup(${typeData.objectTypeId}, '${escapeHtml(typeData.typeName)}')"
                            style="background:#dc3545; color:white; border:none; padding:6px 12px;
                                   border-radius:4px; cursor:pointer; font-size:13px;">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>

            <div id="body-${typeId}" style="display:none;">
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <thead>
                            <tr style="background:#f8f9fa;">
                                <th style="padding:10px 14px; text-align:left;">Работа</th>
                                <th style="padding:10px 14px; text-align:left;">Правило</th>
                                <th style="padding:10px 14px; text-align:center;">Обязательная</th>
                                <th style="padding:10px 14px; text-align:center;">Множитель</th>
                                <th style="padding:10px 14px; text-align:center;">Мин. дней</th>
                                <th style="padding:10px 14px; text-align:center;">Порядок</th>
                                <th style="padding:10px 14px; text-align:center;">Действия</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-${typeId}">
                            ${typeData.rules.slice().sort((a,b) => a.SortOrder - b.SortOrder).map(rule => {
                                const ruleLabel = {
                                    'always':     '<span style="background:#d4edda;color:#155724;padding:2px 8px;border-radius:10px;font-size:11px;">Всегда</span>',
                                    'area_based': '<span style="background:#d1ecf1;color:#0c5460;padding:2px 8px;border-radius:10px;font-size:11px;">По площади</span>',
                                    'per_floor':  '<span style="background:#fff3cd;color:#856404;padding:2px 8px;border-radius:10px;font-size:11px;">На этаж</span>',
                                    'optional':   '<span style="background:#f8d7da;color:#721c24;padding:2px 8px;border-radius:10px;font-size:11px;">Опционально</span>'
                                }[rule.InclusionRule] || rule.InclusionRule;

                                return `
                                <tr class="rule-row"
                                    data-work="${escapeHtml(rule.WorkName).toLowerCase()}"
                                    style="border-bottom:1px solid #f0f0f0;">
                                    <td style="padding:10px 14px; font-weight:500;">${escapeHtml(rule.WorkName)}</td>
                                    <td style="padding:10px 14px;">${ruleLabel}</td>
                                    <td style="padding:10px 14px; text-align:center;">
                                        ${rule.IsRequired
                                            ? '<i class="fas fa-check-circle" style="color:#28a745;"></i>'
                                            : '<i class="fas fa-times-circle" style="color:#dc3545;"></i>'}
                                    </td>
                                    <td style="padding:10px 14px; text-align:center;">${rule.DurationMultiplier}</td>
                                    <td style="padding:10px 14px; text-align:center;">${rule.MinDuration || '—'}</td>
                                    <td style="padding:10px 14px; text-align:center;">${rule.SortOrder}</td>
                                    <td style="padding:10px 14px; text-align:center;">
                                        <div style="display:flex; gap:6px; justify-content:center;">
                                            <button class="btn-icon btn-edit"
                                                    onclick="openRuleModal(${rule.RequirementID})"
                                                    title="Редактировать">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="btn-icon btn-delete"
                                                    onclick="deleteSingleWorkRule(${rule.RequirementID})"
                                                    title="Удалить">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div id="empty-${typeId}"
                     style="display:none; padding:16px; text-align:center; color:#999; font-size:13px;">
                    <i class="fas fa-search"></i> Работы не найдены
                </div>
            </div>
        </div>
    `;
});
html += '</div>';

// Блок "ничего не найдено" для поиска по типам
html += `
    <div id="rulesNotFound"
         style="display:none; padding:40px; text-align:center; color:#999;">
        <i class="fas fa-search" style="font-size:32px; margin-bottom:10px; display:block;"></i>
        Ничего не найдено
    </div>
`;
}

document.getElementById('dynamicContent').innerHTML = html;
}

function toggleRuleGroup(typeId) {
const body    = document.getElementById(`body-${typeId}`);
const chevron = document.getElementById(`chevron-${typeId}`);
if (!body) return;
const isOpen = body.style.display !== 'none';
body.style.display      = isOpen ? 'none'  : 'block';
chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
}

function filterRules() {
const q = (document.getElementById('rulesSearch')?.value || '').toLowerCase().trim();
const info = document.getElementById('rulesSearchInfo');
const notFound = document.getElementById('rulesNotFound');

let visibleGroups = 0;

document.querySelectorAll('.rule-group-wrap').forEach(group => {
const typeId   = group.querySelector('[id^="body-"]')?.id?.replace('body-', '');
const typeName = group.dataset.typeName || '';
const body     = document.getElementById(`body-${typeId}`);
const chevron  = document.getElementById(`chevron-${typeId}`);
const badge    = document.getElementById(`badge-${typeId}`);
const emptyMsg = document.getElementById(`empty-${typeId}`);
const rows     = group.querySelectorAll('.rule-row');

if (!q) {
    // Сбрасываем всё
    group.style.display = '';
    rows.forEach(r => r.style.display = '');
    if (body)     body.style.display     = 'none';
    if (chevron)  chevron.style.transform = 'rotate(0deg)';
    if (badge)    badge.textContent        = rows.length;
    if (emptyMsg) emptyMsg.style.display   = 'none';
    visibleGroups++;
    return;
}

// Ищем совпадение в названии типа
const typeMatch = typeName.includes(q);

// Ищем совпадение в строках работ
let matchedRows = 0;
rows.forEach(row => {
    const workName  = row.dataset.work || '';
    const rowMatch  = typeMatch || workName.includes(q);
    row.style.display = rowMatch ? '' : 'none';
    if (rowMatch) matchedRows++;
});

if (typeMatch || matchedRows > 0) {
    group.style.display = '';
    // Раскрываем при поиске
    if (body)    body.style.display     = 'block';
    if (chevron) chevron.style.transform = 'rotate(90deg)';
    if (badge)   badge.textContent        = matchedRows;
    if (emptyMsg) emptyMsg.style.display  = matchedRows === 0 ? 'block' : 'none';
    visibleGroups++;
} else {
    group.style.display = 'none';
}
});

if (notFound) notFound.style.display = (q && visibleGroups === 0) ? 'block' : 'none';

if (info) {
info.innerHTML = q
    ? `<i class="fas fa-info-circle"></i> Найдено в <strong>${visibleGroups}</strong> группах по запросу «${escapeHtml(q)}»`
    : '';
}
}
// Удаление ВСЕХ норм для конкретного типа здания
async function deleteRuleGroup(objectTypeId, typeName) {
if (!confirm(`Вы уверены, что хотите УДАЛИТЬ ВСЕ НОРМЫ для типа здания "${typeName}"?\n\nЭто действие нельзя отменить!`)) {
return;
}

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/work-rules/group/${objectTypeId}`, {
    method: 'DELETE',
    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});

if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(error.error || 'Ошибка удаления');
}

const result = await response.json();
showToast(result.message || `Все нормы для "${typeName}" успешно удалены`, 'success');

// Перезагружаем страницу с правилами
loadWorkRules();

} catch (error) {
console.error('Ошибка удаления группы:', error);
showToast(error.message || 'Ошибка при удалении норм', 'error');
}
}

// Удаление отдельной работы из нормы
async function deleteSingleWorkRule(requirementId) {
if (!confirm('Вы уверены, что хотите удалить эту работу из норм?')) {
return;
}

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/work-rules/${requirementId}`, {
    method: 'DELETE',
    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});

if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(error.error || 'Ошибка удаления');
}

const result = await response.json();
showToast(result.message || 'Работа успешно удалена из норм', 'success');

// Перезагружаем страницу с правилами
loadWorkRules();

} catch (error) {
console.error('Ошибка удаления:', error);
showToast(error.message || 'Ошибка при удалении работы', 'error');
}
}
// Модальное окно для правила
// Модальное окно для правила
async function openRuleModal(ruleId = null, presetObjectTypeId = null) {
const token = localStorage.getItem('token');

// Создаем модалку если её нет
let modal = document.getElementById('ruleModal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'ruleModal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
            <h2 id="ruleModalTitle">Новое правило</h2>
            <span class="modal-close" onclick="closeRuleModal()">&times;</span>
        </div>
        <div class="modal-body">
            <form id="ruleForm" onsubmit="saveRule(event)">
                <input type="hidden" id="ruleId">
                
                <div class="form-group">
                    <label>Тип объекта *</label>
                    <select id="ruleObjectTypeId" class="form-control" required>
                        <option value="">Загрузка...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Вид работы *</label>
                    <select id="ruleWorkTypeId" class="form-control" required>
                        <option value="">Загрузка...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Правило расчета *</label>
                    <select id="ruleInclusionRule" class="form-control" required>
                        <option value="always">Всегда включать</option>
                        <option value="area_based">Зависит от площади (на 100 м²)</option>
                        <option value="per_floor">На каждый этаж</option>
                        <option value="optional">Опционально (можно убрать)</option>
                    </select>
                </div>
                
                <div class="form-row" style="grid-template-columns: 1fr 1fr;">
                    <div class="form-group">
                        <label>Множитель срока</label>
                        <input type="number" id="ruleMultiplier" class="form-control" step="0.1" min="0.1" value="1.0">
                        <small>Базовый срок × множитель</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Минимальный срок (дней)</label>
                        <input type="number" id="ruleMinDuration" class="form-control" min="1">
                        <small>Оставьте пустым, если не нужно</small>
                    </div>
                </div>
                
                <div class="form-row" style="grid-template-columns: 1fr 1fr;">
                    <div class="form-group checkbox-group">
                        <input type="checkbox" id="ruleIsRequired" checked>
                        <label>Обязательная работа</label>
                    </div>
                    
                    <div class="form-group">
                        <label>Порядок сортировки</label>
                        <input type="number" id="ruleSortOrder" class="form-control" value="0" step="10">
                    </div>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
                    <h4 style="margin: 0 0 10px 0;">Как это будет работать:</h4>
                    <div id="rulePreview" style="font-size: 13px; color: #666;">
                        Выберите тип объекта и работу, чтобы увидеть пример расчета
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeRuleModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.appendChild(modal);
}

// Загружаем справочники
try {
const [typesResponse, worksResponse] = await Promise.all([
    fetch('/api/object-types/all', { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch('/api/work-types', { headers: { 'Authorization': `Bearer ${token}` } })
]);

const objectTypes = await typesResponse.json();
const workTypes = await worksResponse.json();

// Заполняем селекты
const typeSelect = document.getElementById('ruleObjectTypeId');
typeSelect.innerHTML = '<option value="">Выберите тип объекта</option>';
objectTypes.forEach(type => {
    typeSelect.innerHTML += `<option value="${type.ObjectTypeID}">${escapeHtml(type.TypeName)}</option>`;
});

const workSelect = document.getElementById('ruleWorkTypeId');
workSelect.innerHTML = '<option value="">Выберите вид работы</option>';
workTypes.forEach(work => {
    workSelect.innerHTML += `<option value="${work.WorkTypeID}">${escapeHtml(work.WorkName)}</option>`;
});

// Если передан presetObjectTypeId, устанавливаем его и блокируем выбор
if (presetObjectTypeId) {
    typeSelect.value = presetObjectTypeId;
    typeSelect.disabled = true; // Блокируем выбор типа здания
    typeSelect.style.backgroundColor = '#f0f0f0';
    typeSelect.style.cursor = 'not-allowed';
} else {
    typeSelect.disabled = false;
    typeSelect.style.backgroundColor = '';
    typeSelect.style.cursor = '';
}

// Если редактируем, загружаем данные
if (ruleId) {
    document.getElementById('ruleModalTitle').textContent = 'Редактирование сведений о работе';
    await loadRuleForEdit(ruleId);
} else {
    document.getElementById('ruleModalTitle').textContent = presetObjectTypeId ? 'Добавить сведения о работе' : 'Новое правило';
    document.getElementById('ruleId').value = '';
    // Сбрасываем форму
    document.getElementById('ruleForm').reset();
    document.getElementById('ruleMultiplier').value = '1.0';
    document.getElementById('ruleIsRequired').checked = true;
    document.getElementById('ruleSortOrder').value = '0';
    
    // Если есть presetObjectTypeId, снова устанавливаем его (reset сбросил)
    if (presetObjectTypeId) {
        typeSelect.value = presetObjectTypeId;
        typeSelect.disabled = true;
    }
}

// Добавляем обработчики для предпросмотра
document.getElementById('ruleObjectTypeId').removeEventListener('change', updateRulePreview);
document.getElementById('ruleWorkTypeId').removeEventListener('change', updateRulePreview);
document.getElementById('ruleInclusionRule').removeEventListener('change', updateRulePreview);
document.getElementById('ruleMultiplier').removeEventListener('input', updateRulePreview);

document.getElementById('ruleObjectTypeId').addEventListener('change', updateRulePreview);
document.getElementById('ruleWorkTypeId').addEventListener('change', updateRulePreview);
document.getElementById('ruleInclusionRule').addEventListener('change', updateRulePreview);
document.getElementById('ruleMultiplier').addEventListener('input', updateRulePreview);

modal.style.display = 'block';

} catch (error) {
console.error('Ошибка загрузки справочников:', error);
showToast('Ошибка загрузки данных', 'error');
}
}

// Загрузка правила для редактирования
async function loadRuleForEdit(ruleId) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/work-rules/${ruleId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const rule = await response.json();

document.getElementById('ruleId').value = rule.RequirementID;
document.getElementById('ruleObjectTypeId').value = rule.ObjectTypeID;
document.getElementById('ruleWorkTypeId').value = rule.WorkTypeID;
document.getElementById('ruleInclusionRule').value = rule.InclusionRule;
document.getElementById('ruleMultiplier').value = rule.DurationMultiplier;
document.getElementById('ruleMinDuration').value = rule.MinDuration || '';
document.getElementById('ruleIsRequired').checked = rule.IsRequired;
document.getElementById('ruleSortOrder').value = rule.SortOrder || 0;

updateRulePreview();

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка загрузки правила', 'error');
}
}

// Обновление предпросмотра
async function updateRulePreview() {
const objectTypeId = document.getElementById('ruleObjectTypeId').value;
const workTypeId = document.getElementById('ruleWorkTypeId').value;
const inclusionRule = document.getElementById('ruleInclusionRule').value;
const multiplier = parseFloat(document.getElementById('ruleMultiplier').value) || 1;

if (!objectTypeId || !workTypeId) {
document.getElementById('rulePreview').innerHTML = 'Выберите тип объекта и работу для предпросмотра';
return;
}

// Получаем базовый срок работы
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/work-types`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const works = await response.json();
const work = works.find(w => w.WorkTypeID == workTypeId);

if (!work) return;

const baseDuration = work.DefaultDuration || 30;

let example = '';
switch(inclusionRule) {
    case 'always':
        example = `Срок: ${baseDuration * multiplier} дней (фиксированный)`;
        break;
    case 'area_based':
        example = `Для площади 250 м²: ${Math.ceil(baseDuration * multiplier * (250/100))} дней`;
        break;
    case 'per_floor':
        example = `Для 3 этажей: ${baseDuration * multiplier * 3} дней`;
        break;
    case 'optional':
        example = `Опционально, базовый срок: ${baseDuration * multiplier} дней`;
        break;
}

document.getElementById('rulePreview').innerHTML = `
    <p><strong>Работа:</strong> ${escapeHtml(work.WorkName)}</p>
    <p><strong>Базовый срок:</strong> ${work.DefaultDuration || 30} дней</p>
    <p><strong>С учетом правил:</strong> ${example}</p>
`;

} catch (error) {
console.error('Ошибка:', error);
}
}

// Сохранение правила
async function saveRule(event) {
event.preventDefault();

const token = localStorage.getItem('token');
const ruleId = document.getElementById('ruleId').value;

const ruleData = {
objectTypeId: parseInt(document.getElementById('ruleObjectTypeId').value),
workTypeId: parseInt(document.getElementById('ruleWorkTypeId').value),
inclusionRule: document.getElementById('ruleInclusionRule').value,
durationMultiplier: parseFloat(document.getElementById('ruleMultiplier').value) || 1,
minDuration: document.getElementById('ruleMinDuration').value ? parseInt(document.getElementById('ruleMinDuration').value) : null,
isRequired: document.getElementById('ruleIsRequired').checked,
sortOrder: parseInt(document.getElementById('ruleSortOrder').value) || 0
};

try {
const url = ruleId ? `/api/admin/work-rules/${ruleId}` : '/api/admin/work-rules';
const method = ruleId ? 'PUT' : 'POST';

const response = await fetch(url, {
    method: method,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(ruleData)
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка сохранения');
}

showToast('Правило успешно сохранено', 'success');
closeRuleModal();
loadWorkRules();

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Удаление правила
async function deleteRule(ruleId) {
if (!confirm('Вы уверены, что хотите удалить это правило?')) return;

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/work-rules/${ruleId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка удаления');

showToast('Правило удалено', 'success');
loadWorkRules();

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка удаления правила', 'error');
}
}

function closeRuleModal() {
const modal = document.getElementById('ruleModal');
if (modal) {
modal.style.display = 'none';
}
// Снимаем блокировку с селекта типа здания при закрытии
const typeSelect = document.getElementById('ruleObjectTypeId');
if (typeSelect) {
typeSelect.disabled = false;
typeSelect.style.backgroundColor = '';
typeSelect.style.cursor = '';
}
// Сбрасываем форму
const form = document.getElementById('ruleForm');
if (form) form.reset();
}
// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Функция для экранирования HTML
function escapeHtml(text) {
if (!text) return '';
return String(text)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#039;');
}

// ==================== УПРАВЛЕНИЕ ОТЗЫВАМИ (ДЛЯ АДМИНА) ====================

let currentReviewsPage = 1;
let totalReviewsPages = 1;
let currentReviewFilter = 'all';
let reviewSearchTimeout;

// Загрузка отзывов
async function loadReviews(page = 1, filter = 'all') {
const token = localStorage.getItem('token');
const search = document.getElementById('reviewSearch')?.value || '';

const isFirstRender = !document.getElementById('reviewsList');

if (isFirstRender) {
renderReviewsShell();
}

let approvedParam = '';
if (filter === 'pending') approvedParam = '&approved=false';
else if (filter === 'approved') approvedParam = '&approved=true';

currentReviewFilter = filter;

// Показываем лоадер только в области списка
const list = document.getElementById('reviewsList');
if (list) list.innerHTML = '<div class="loader"></div>';

try {
const response = await fetch(`/api/admin/reviews?page=${page}&approved=${filter === 'pending' ? 'false' : filter === 'approved' ? 'true' : ''}&search=${encodeURIComponent(search)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();

currentReviewsPage = page;
totalReviewsPages = data.pagination.totalPages;

// Обновляем информацию о количестве
const info = document.getElementById('reviewsInfo');
if (info && data.pagination.totalCount > 0) {
info.innerHTML = `
<div style="padding:10px; background:#e3f2fd; border-radius:4px; color:#0d47a1;">
    <i class="fas fa-info-circle"></i>
    Всего: <strong>${data.pagination.totalCount}</strong>
    ${currentReviewFilter === 'pending' ? 'на модерации' : 
      currentReviewFilter === 'approved' ? 'опубликовано' : ''}
</div>
`;
} else if (info) {
info.innerHTML = '';
}

renderReviewsList(data.reviews, {
    page: currentReviewsPage,
    totalPages: data.pagination.totalPages
});

} catch (error) {
console.error('Ошибка загрузки отзывов:', error);
const list = document.getElementById('reviewsList');
if (list) {
    list.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Ошибка загрузки</h3>
            <p>Не удалось загрузить отзывы</p>
            <button class="btn-add" onclick="loadReviews(1, '${filter}')" style="margin-top: 20px;">
                <i class="fas fa-redo"></i> Повторить
            </button>
        </div>
    `;
}
}
}

// Отрисовка скелета страницы (фильтры, поиск, контейнер)
function renderReviewsShell() {
document.getElementById('dynamicContent').innerHTML = `
<button class="btn-add" onclick="openReviewModal()" style="margin-bottom:20px; display: none;">
    <i class="fas fa-plus"></i> Добавить отзыв
</button>

<div class="filters-panel" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px; align-items:center;">
    <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="reviewSearch" placeholder="Поиск отзывов..." oninput="debounceReviewSearch()">
    </div>

    <div style="display: flex; gap: 10px;">
        <button class="btn-filter" onclick="filterReviews('all')" style="padding: 8px 16px; border: 1px solid #ddd; background: ${currentReviewFilter === 'all' ? '#e31e24' : 'white'}; color: ${currentReviewFilter === 'all' ? 'white' : '#333'}; border-radius: 4px; cursor: pointer;">
            Все
        </button>
        <button class="btn-filter" onclick="filterReviews('pending')" style="padding: 8px 16px; border: 1px solid #ddd; background: ${currentReviewFilter === 'pending' ? '#e31e24' : 'white'}; color: ${currentReviewFilter === 'pending' ? 'white' : '#333'}; border-radius: 4px; cursor: pointer;">
            На модерации
        </button>
        <button class="btn-filter" onclick="filterReviews('approved')" style="padding: 8px 16px; border: 1px solid #ddd; background: ${currentReviewFilter === 'approved' ? '#e31e24' : 'white'}; color: ${currentReviewFilter === 'approved' ? 'white' : '#333'}; border-radius: 4px; cursor: pointer;">
            Опубликованные
        </button>
    </div>

    <button onclick="resetReviewFilters()" style="padding:8px 15px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
        <i class="fas fa-times"></i> Сбросить
    </button>
</div>

<div id="reviewsInfo" style="margin-bottom:15px;"></div>
<div id="reviewsList"></div>
<div id="reviewsPagination" style="margin-top:30px; text-align:center;"></div>
`;
}

// Отрисовка только списка отзывов
function renderReviewsList(reviews, pagination) {
const list = document.getElementById('reviewsList');
const paginationContainer = document.getElementById('reviewsPagination');

if (!reviews || reviews.length === 0) {
list.innerHTML = `
    <div class="empty-state" style="text-align: center; padding: 60px 20px;">
        <i class="fas fa-comment-alt" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
        <h3 style="margin: 0 0 10px 0; color: #666;">Нет отзывов</h3>
        <p style="margin: 0; color: #999;">${currentReviewFilter === 'pending' ? 'Нет отзывов на модерации' : 
              currentReviewFilter === 'approved' ? 'Нет опубликованных отзывов' : 
              'Пока никто не оставил отзывы'}</p>
    </div>
`;
if (paginationContainer) paginationContainer.innerHTML = '';
return;
}

let html = '<div class="reviews-list" style="display: flex; flex-direction: column; gap: 15px;">';

reviews.forEach(review => {
const stars = '★'.repeat(review.Rating) + '☆'.repeat(5 - review.Rating);
const date = new Date(review.CreatedAt).toLocaleString('ru-RU');

html += `
    <div class="review-card" style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
                <strong style="font-size: 16px;">${escapeHtml(review.ClientName)}</strong>
                <div style="color: #666; font-size: 13px;">${escapeHtml(review.ClientEmail)}</div>
                <div style="color: #ffc107; font-size: 18px; margin-top: 5px;">${stars}</div>
            </div>
            <div style="text-align: right;">
                <span class="status-badge" style="display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; ${review.IsApproved ? 'background: #d4edda; color: #155724;' : 'background: #fff3cd; color: #856404;'}">
                    ${review.IsApproved ? 'Опубликован' : 'На модерации'}
                </span>
                <div style="color: #999; font-size: 12px; margin-top: 5px;">${date}</div>
            </div>
        </div>

        <div style="margin: 10px 0; padding: 15px; background: #f8f9fa; border-radius: 5px;">
            <p style="margin: 0; font-style: italic; line-height: 1.5;">${escapeHtml(review.ReviewText || 'Без текста')}</p>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            <div style="color: #666; font-size: 13px;">
                Заказ: ${review.OrderNumber || 'Не указан'}
            </div>
            <div style="display: flex; gap: 8px;">
                ${!review.IsApproved ? 
                    `<button class="btn-action" onclick="moderateReview(${review.ReviewID}, true)" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-check"></i> Опубликовать
                    </button>` : 
                    `<button class="btn-action" onclick="moderateReview(${review.ReviewID}, false)" style="background: #ffc107; color: #333; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fas fa-eye-slash"></i> Скрыть
                    </button>`
                }
                <button class="btn-action" onclick="deleteReview(${review.ReviewID})" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
        </div>
    </div>
`;
});

html += '</div>';
list.innerHTML = html;

// Пагинация
if (paginationContainer) {
if (pagination.totalPages > 1) {
    let pages = '';
    for (let i = 1; i <= pagination.totalPages; i++) {
        pages += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" onclick="loadReviews(${i}, '${currentReviewFilter}')" style="padding: 8px 12px; border: 1px solid #ddd; background: ${i === pagination.page ? '#e31e24' : 'white'}; color: ${i === pagination.page ? 'white' : '#333'}; border-radius: 4px; cursor: pointer; margin: 0 3px;">${i}</button>`;
    }
    paginationContainer.innerHTML = `<div style="display: flex; justify-content: center; gap: 5px;">${pages}</div>`;
} else {
    paginationContainer.innerHTML = '';
}
}
}

// Фильтрация отзывов
function filterReviews(filter) {
currentReviewFilter = filter;

// Обновляем стили кнопок
document.querySelectorAll('.btn-filter').forEach(btn => {
btn.style.background = 'white';
btn.style.color = '#333';
});

const activeBtn = event?.target;
if (activeBtn) {
activeBtn.style.background = '#e31e24';
activeBtn.style.color = 'white';
}

loadReviews(1, filter);
}

// Debounce для поиска в отзывах
function debounceReviewSearch() {
clearTimeout(reviewSearchTimeout);
reviewSearchTimeout = setTimeout(() => {
loadReviews(1, currentReviewFilter);
}, 400);
}
// Сброс фильтров отзывов
function resetReviewFilters() {
const search = document.getElementById('reviewSearch');
if (search) search.value = '';
currentReviewFilter = 'all';

// Обновляем стили кнопок
document.querySelectorAll('.btn-filter').forEach(btn => {
btn.style.background = 'white';
btn.style.color = '#333';
});

// Активируем кнопку "Все"
const allBtn = document.querySelector('.btn-filter[onclick*="all"]');
if (allBtn) {
allBtn.style.background = '#e31e24';
allBtn.style.color = 'white';
}

loadReviews(1, 'all');
}

// Обновляем основную функцию debounceSearch
function debounceSearch() {
clearTimeout(searchTimeout);

searchTimeout = setTimeout(() => {
if (currentTab === 'projects') {
    loadProjects(1);
} else if (currentTab === 'specialists') {
    loadSpecialists(1);
} else if (currentTab === 'reviews') {
    loadReviews(1, currentReviewFilter);
}
}, 400);
}

// Модерация отзыва
async function moderateReview(reviewId, approve) {
if (!confirm(`Вы уверены, что хотите ${approve ? 'опубликовать' : 'скрыть'} этот отзыв?`)) {
return;
}

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reviews/${reviewId}/moderate`, {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ approved: approve })
});

if (!response.ok) throw new Error('Ошибка модерации');

showToast(`Отзыв успешно ${approve ? 'опубликован' : 'скрыт'}`, 'success');
loadReviews(currentReviewsPage, currentReviewFilter);

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка при модерации отзыва', 'error');
}
}

// Удаление отзыва
async function deleteReview(reviewId) {
if (!confirm('Вы уверены, что хотите удалить этот отзыв? Это действие нельзя отменить.')) {
return;
}

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/reviews/${reviewId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка удаления');
}

const result = await response.json();
showToast(result.message || 'Отзыв успешно удален', 'success');
loadReviews(currentReviewsPage, currentReviewFilter);

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}
// Создание мобильного меню
function initMobileMenu() {
// Создаем кнопку меню
if (!document.querySelector('.mobile-menu-toggle')) {
const menuBtn = document.createElement('button');
menuBtn.className = 'mobile-menu-toggle';
menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
menuBtn.onclick = toggleMobileMenu;
document.body.appendChild(menuBtn);
}

// Создаем оверлей
if (!document.querySelector('.sidebar-overlay')) {
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
overlay.onclick = closeMobileMenu;
document.body.appendChild(overlay);
}
}

function toggleMobileMenu() {
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.sidebar-overlay');
if (!sidebar || !overlay) return;
sidebar.classList.toggle('open');
overlay.classList.toggle('active');

// Блокируем прокрутку body при открытом меню
if (sidebar.classList.contains('open')) {
document.body.style.overflow = 'hidden';
} else {
document.body.style.overflow = '';
}
}

function closeMobileMenu() {
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.sidebar-overlay');
if (!sidebar || !overlay) return;
sidebar.classList.remove('open');
overlay.classList.remove('active');
document.body.style.overflow = '';
}

// Закрытие меню при клике на пункт меню
document.addEventListener('click', function(e) {
const menuItem = e.target.closest('.menu-item');
if (menuItem && window.innerWidth <= 768) {
closeMobileMenu();
}
});

// При изменении размера окна
window.addEventListener('resize', function() {
if (window.innerWidth > 768) {
closeMobileMenu();
const menuBtn = document.querySelector('.mobile-menu-toggle');
if (menuBtn) menuBtn.style.display = 'none';
} else {
const menuBtn = document.querySelector('.mobile-menu-toggle');
if (menuBtn) menuBtn.style.display = 'flex';
else initMobileMenu();
}
});

// Инициализация при загрузке
if (window.innerWidth <= 768) {
initMobileMenu();
} else {
const menuBtn = document.querySelector('.mobile-menu-toggle');
if (menuBtn) menuBtn.style.display = 'none';
}

// Автоматическое добавление обертки для всех таблиц
function makeTablesScrollable() {
// Находим все контейнеры с таблицами
const tables = [
'.specialists-table table',
'.report-table',
'.rule-group table',
'#reviewsList table'
];

tables.forEach(selector => {
const tables_elements = document.querySelectorAll(selector);
tables_elements.forEach(table => {
    // Проверяем, не обернута ли уже таблица
    const parent = table.parentElement;
    if (!parent.classList.contains('table-responsive') && 
        !parent.parentElement?.classList.contains('table-responsive')) {
        
        // Создаем обертку
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        
        // Вставляем обертку перед таблицей
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    }
});
});

// Добавляем подсказку о прокрутке
addScrollHint();
}

// Добавление подсказки о горизонтальной прокрутке
function addScrollHint() {
if (window.innerWidth <= 768) {
const wrappers = document.querySelectorAll('.table-responsive');
wrappers.forEach(wrapper => {
    // Проверяем, есть ли уже подсказка
    if (!wrapper.nextElementSibling?.classList.contains('scroll-hint')) {
        const hint = document.createElement('div');
        hint.className = 'scroll-hint';
        hint.innerHTML = '<i class="fas fa-arrows-alt-h"></i> Листайте вправо для просмотра всех колонок';
        wrapper.parentNode.insertBefore(hint, wrapper.nextSibling);
    }
});
}
}

// Проверка, нужна ли прокрутка для таблицы
function checkTableScroll() {
const wrappers = document.querySelectorAll('.table-responsive');
wrappers.forEach(wrapper => {
const hint = wrapper.nextElementSibling;
if (hint && hint.classList.contains('scroll-hint')) {
    // Если прокрутка не нужна, скрываем подсказку
    if (wrapper.scrollWidth <= wrapper.clientWidth) {
        hint.style.display = 'none';
    } else {
        hint.style.display = 'block';
    }
}
});
}

// Вызываем при загрузке и после обновления контента
function initScrollableTables() {
makeTablesScrollable();
checkTableScroll();
}

// Следим за изменением размера окна
window.addEventListener('resize', function() {
setTimeout(checkTableScroll, 100);
});

// Наблюдатель за изменениями в DOM (для динамически загружаемого контента)
const observer = new MutationObserver(function(mutations) {
mutations.forEach(function(mutation) {
if (mutation.addedNodes.length) {
    initScrollableTables();
}
});
});

// Запускаем наблюдение за изменениями
observer.observe(document.getElementById('dynamicContent'), {
childList: true,
subtree: true
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
initScrollableTables();
});

const originalLoadProjects = loadProjects;
window.loadProjects = async function(page) {
await originalLoadProjects(page);
setTimeout(initScrollableTables, 100);
};

const originalLoadSpecialists = loadSpecialists;
window.loadSpecialists = async function(page) {
await originalLoadSpecialists(page);
setTimeout(initScrollableTables, 100);
};

const originalLoadWorkRules = loadWorkRules;
window.loadWorkRules = async function() {
await originalLoadWorkRules();
setTimeout(initScrollableTables, 100);
};

const originalLoadReviews = loadReviews;
window.loadReviews = async function(page, filter) {
await originalLoadReviews(page, filter);
setTimeout(initScrollableTables, 100);
};

const originalLoadStatsData = loadStatsData;
window.loadStatsData = async function() {
await originalLoadStatsData();
setTimeout(initScrollableTables, 100);
};

// ==================== ВАЛИДАЦИЯ ДАТ ДЛЯ ОТЧЁТОВ ====================

function validateReportDates(dateFrom, dateTo) {
if (!dateFrom || !dateTo) {
showToast('Выберите обе даты', 'error');
return false;
}

const startDate = new Date(dateFrom);
const endDate = new Date(dateTo);
const today = new Date();
today.setHours(0, 0, 0, 0);

if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
showToast('Некорректный формат даты', 'error');
return false;
}

if (startDate > endDate) {
showToast('Дата начала не может быть позже даты окончания', 'error');
return false;
}

if (startDate > today) {
showToast('Дата начала не может быть в будущем', 'error');
return false;
}

const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
if (diffDays > 730) {
showToast('Период не может превышать 2 года', 'error');
return false;
}

return true;
}

// Переопределяем функцию openReportsModal
window.openReportsModal = function() {
const today = new Date().toISOString().split('T')[0];
const threeMonthsAgo = new Date();
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

const fromInput = document.getElementById('reportDateFrom');
const toInput = document.getElementById('reportDateTo');

if (fromInput) {
fromInput.value = threeMonthsAgo.toISOString().split('T')[0];
fromInput.max = today;
fromInput.onchange = function() { validateDatePair(fromInput, toInput); };
}
if (toInput) {
toInput.value = today;
toInput.max = today;
toInput.onchange = function() { validateDatePair(fromInput, toInput); };
}

document.getElementById('reportsModal').style.display = 'block';
loadSpecialistsForFilter();
loadCategoriesForFilter();
loadCurrentReport();
};

function validateDatePair(fromInput, toInput) {
if (!fromInput?.value || !toInput?.value) return;
if (new Date(fromInput.value) > new Date(toInput.value)) {
toInput.value = fromInput.value;
showToast('Дата окончания скорректирована', 'info');
}
}

// Переопределяем loadCurrentReport
const originalLoadCurrentReport = loadCurrentReport;
window.loadCurrentReport = async function() {
const dateFrom = document.getElementById('reportDateFrom')?.value;
const dateTo = document.getElementById('reportDateTo')?.value;
if (!validateReportDates(dateFrom, dateTo)) return;
await originalLoadCurrentReport();
};

// Переопределяем exportCurrentReport
const originalExportCurrentReport = exportCurrentReport;
window.exportCurrentReport = function() {
const dateFrom = document.getElementById('reportDateFrom')?.value;
const dateTo = document.getElementById('reportDateTo')?.value;
if (!validateReportDates(dateFrom, dateTo)) return;
originalExportCurrentReport();
};
function onStatsDateChange() {
const fromInput = document.getElementById('statsDateFrom');
const toInput   = document.getElementById('statsDateTo');
const today     = getCurrentDate();

// Не пускаем будущие даты
if (fromInput.value > today) {
fromInput.value = today;
showToast('Дата начала не может быть в будущем', 'error');
}
if (toInput.value > today) {
toInput.value = today;
showToast('Дата окончания не может быть в будущем', 'error');
}

// Дата начала не может быть позже даты конца
if (fromInput.value && toInput.value && fromInput.value > toInput.value) {
// Двигаем то поле, которое только что изменили
const active = document.activeElement;
if (active === fromInput) {
    toInput.value = fromInput.value;
} else {
    fromInput.value = toInput.value;
}
showToast('Период скорректирован', 'info');
}

// Обновляем max у обоих инпутов, чтобы браузерный пикер тоже не давал выбрать будущее
fromInput.max = today;
toInput.max   = today;

// Пересчитываем min: дата конца не может быть раньше даты начала
if (fromInput.value) toInput.min = fromInput.value;
if (toInput.value)   fromInput.max = toInput.value;
}

// Общая функция закрытия модалок
function closeModal(modalId) {
const modal = document.getElementById(modalId);
if (modal) modal.style.display = 'none';
}

// ==================== УПРАВЛЕНИЕ ТИПАМИ ОБЪЕКТОВ ====================

let currentObjectTypesPage = 1;
let totalObjectTypesPages = 1;
let objectTypesSearchTimeout;

// Загрузка страницы с типами объектов
async function loadObjectTypes(page = 1) {
const token = localStorage.getItem('token');
const search = document.getElementById('objectTypeSearch')?.value || '';

const isFirstRender = !document.getElementById('objectTypesTable');

if (isFirstRender) {
renderObjectTypesShell();
}

const tbody = document.getElementById('objectTypesTbody');
if (tbody) {
tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;"><div class="loader"></div></td></tr>';
}

try {
const response = await fetch(`/api/admin/object-types?page=${page}&search=${encodeURIComponent(search)}&showInactive=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();

currentObjectTypesPage = page;
totalObjectTypesPages = data.pagination?.totalPages || 1;

renderObjectTypesTable(data.objectTypes, {
    page: page,
    totalPages: data.pagination?.totalPages || 1,
    totalCount: data.pagination?.totalCount || 0,
    search: search
});

} catch (error) {
console.error('Ошибка загрузки типов объектов:', error);
const tbody = document.getElementById('objectTypesTbody');
if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#dc3545;">
        <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки. 
        <button onclick="loadObjectTypes()" style="margin-left:10px;background:#e31e24;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">
            <i class="fas fa-redo"></i> Повторить
        </button>
     </td></tr>`;
}
}
}

// Отрисовка оболочки страницы
function renderObjectTypesShell() {
document.getElementById('dynamicContent').innerHTML = `
<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <h2 style="margin: 0;"></h2>
    <button class="btn-add" onclick="openObjectTypeModal()">
        <i class="fas fa-plus"></i> Добавить сведения типа объекта
    </button>
</div>

<div class="filters-panel" style="display:flex; gap:10px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px;">
    <div class="search-box" style="flex:1;">
        <i class="fas fa-search"></i>
        <input type="text" id="objectTypeSearch" placeholder="Поиск по названию или описанию..." oninput="debounceObjectTypeSearch()" style="width:100%;">
    </div>
</div>

<div id="objectTypesInfo" style="margin-bottom:15px;"></div>

<div id="objectTypesTable" class="specialists-table">
    <table style="width:100%; border-collapse:collapse;">
        <thead>
            <tr style="background:#f8f9fa;">
                <th style="padding:12px; text-align:left;">Название</th>
                
                <th style="padding:12px; text-align:center;">Порядок</th>
                <th style="padding:12px; text-align:center;">Объектов</th>
                <th style="padding:12px; text-align:center;">Правил</th>
                <th style="padding:12px; text-align:center;">Действия</th>
            </tr>
        </thead>
        <tbody id="objectTypesTbody">
            <tr><td colspan="6" style="text-align:center;padding:30px;"><div class="loader"></div></td></tr>
        </tbody>
    </table>
</div>

<div id="objectTypesPagination" style="margin-top:20px; text-align:center;"></div>
`;
}

// Отрисовка таблицы
function renderObjectTypesTable(types, state) {
const tbody = document.getElementById('objectTypesTbody');
const info = document.getElementById('objectTypesInfo');
const pagination = document.getElementById('objectTypesPagination');

if (!types || types.length === 0) {
tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;">
    <div class="empty-state">
        <i class="fas fa-tag"></i>
        <h3>Нет типов объектов</h3>
        <p>Добавьте первый тип, нажав кнопку выше</p>
    </div>
 </td></tr>`;

if (info && state.search) {
    info.innerHTML = `<div style="padding:10px; background:#fff3cd; border-radius:4px; color:#856404;">
        <i class="fas fa-info-circle"></i> По запросу "${escapeHtml(state.search)}" ничего не найдено
    </div>`;
} else if (info) {
    info.innerHTML = '';
}

if (pagination) pagination.innerHTML = '';
return;
}

// Информация
if (info && state.totalCount > 0) {
info.innerHTML = `<div style="padding:10px; background:#e3f2fd; border-radius:4px; color:#0d47a1;">
    <i class="fas fa-info-circle"></i> Всего: <strong>${state.totalCount}</strong>
    ${state.search ? `по запросу «${escapeHtml(state.search)}»` : ''}
</div>`;
}

// Строки таблицы (без колонки Статус)
tbody.innerHTML = types.map(type => {
return `
    <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px;"><strong>${escapeHtml(type.TypeName)}</strong></td>
        
        <td style="padding:12px; text-align:center;">${type.SortOrder || 0}</td>
        <td style="padding:12px; text-align:center;">
            <span style="background:#e3f2fd; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">
                ${type.ObjectsCount || 0}
            </span>
        </td>
        <td style="padding:12px; text-align:center;">
            <span style="background:#fff3cd; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">
                ${type.RulesCount || 0}
            </span>
        </td>
        <td style="padding:12px; text-align:center;">
            <div style="display:flex; gap:8px; justify-content:center;">
                <button class="btn-icon btn-edit" onclick="openObjectTypeModal(${type.ObjectTypeID})" title="Редактировать">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteObjectType(${type.ObjectTypeID}, '${escapeHtml(type.TypeName).replace(/'/g, "\\'")}', ${type.ObjectsCount || 0})" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    </tr>
`;
}).join('');

// Пагинация
if (pagination && state.totalPages > 1) {
let pages = '';
for (let i = 1; i <= state.totalPages; i++) {
    pages += `<button class="page-btn ${i === state.page ? 'active' : ''}" onclick="loadObjectTypes(${i})">${i}</button>`;
}
pagination.innerHTML = `<div style="display:flex; justify-content:center; gap:5px;">${pages}</div>`;
} else if (pagination) {
pagination.innerHTML = '';
}
}

// Debounce для поиска
function debounceObjectTypeSearch() {
clearTimeout(objectTypesSearchTimeout);
objectTypesSearchTimeout = setTimeout(() => {
loadObjectTypes(1);
}, 400);
}

// Открытие модального окна
async function openObjectTypeModal(typeId = null) {
let modal = document.getElementById('objectTypeModal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'objectTypeModal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
            <h2 id="objectTypeModalTitle">Тип объекта</h2>
            <span class="modal-close" onclick="closeObjectTypeModal()">&times;</span>
        </div>
        <div class="modal-body">
            <form id="objectTypeForm" onsubmit="saveObjectType(event)">
                <input type="hidden" id="objectTypeId">
                
                <div class="form-group">
                    <label>Название *</label>
                    <input type="text" id="objectTypeName" required maxlength="100">
                </div>
                
                
                
                <div class="form-group">
                    <label>Порядок сортировки</label>
                    <input type="number" id="objectTypeSortOrder" value="0" step="10">
                    <small>Меньше число = выше в списке</small>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeObjectTypeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.appendChild(modal);
}

document.getElementById('objectTypeForm').reset();
document.getElementById('objectTypeId').value = '';
document.getElementById('objectTypeSortOrder').value = '0';

if (typeId) {
document.getElementById('objectTypeModalTitle').textContent = 'Редактирование сведений типа объекта';
await loadObjectTypeForEdit(typeId);
} else {
document.getElementById('objectTypeModalTitle').textContent = 'Новые сведения о типе объекта';
}

modal.style.display = 'block';
}

// Загрузка для редактирования
async function loadObjectTypeForEdit(typeId) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/object-types/${typeId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const type = await response.json();

document.getElementById('objectTypeId').value = type.ObjectTypeID;
document.getElementById('objectTypeName').value = type.TypeName;

document.getElementById('objectTypeSortOrder').value = type.SortOrder || 0;

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка загрузки данных', 'error');
closeObjectTypeModal();
}
}

// Сохранение
async function saveObjectType(event) {
event.preventDefault();

const token = localStorage.getItem('token');
const typeId = document.getElementById('objectTypeId').value;

const typeData = {
typeName: document.getElementById('objectTypeName').value.trim(),
isActive: true,
sortOrder: parseInt(document.getElementById('objectTypeSortOrder').value) || 0
};

if (!typeData.typeName) {
showToast('Введите название типа объекта', 'error');
return;
}

try {
const url = typeId ? `/api/admin/object-types/${typeId}` : '/api/admin/object-types';
const method = typeId ? 'PUT' : 'POST';

const response = await fetch(url, {
    method: method,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(typeData)
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка сохранения');
}

const result = await response.json();
showToast(result.message || 'Тип объекта успешно сохранен', 'success');
closeObjectTypeModal();
loadObjectTypes(currentObjectTypesPage);

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Удаление (с проверкой на наличие объектов)
async function deleteObjectType(typeId, typeName, objectsCount) {
let message = `Вы уверены, что хотите удалить тип "${typeName}"?`;

if (objectsCount > 0) {
message = `Невозможно удалить тип "${typeName}"!\n\nС этим типом связано ${objectsCount} объектов строительства.\n\nСначала удалите или переназначьте эти объекты.`;
showToast(message, 'error');
return;
}

if (!confirm(message)) return;

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/object-types/${typeId}?hardDelete=true`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка');
}

const result = await response.json();
showToast(result.message, 'success');
loadObjectTypes(currentObjectTypesPage);

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}
// ==================== УПРАВЛЕНИЕ ВИДАМИ РАБОТ ====================

let currentWorkTypesPage = 1;
let totalWorkTypesPages = 1;
let workTypesSearchTimeout;

// Загрузка страницы с видами работ
async function loadWorkTypes(page = 1) {
const token = localStorage.getItem('token');
const search = document.getElementById('workTypeSearch')?.value || '';

const isFirstRender = !document.getElementById('workTypesTable');

if (isFirstRender) {
renderWorkTypesShell();
}

const tbody = document.getElementById('workTypesTbody');
if (tbody) {
tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;"><div class="loader"></div></td></tr>';
}

try {
const response = await fetch(`/api/admin/work-types?page=${page}&search=${encodeURIComponent(search)}&showInactive=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();

currentWorkTypesPage = page;
totalWorkTypesPages = data.pagination?.totalPages || 1;

renderWorkTypesTable(data.workTypes, {
    page: page,
    totalPages: data.pagination?.totalPages || 1,
    totalCount: data.pagination?.totalCount || 0,
    search: search
});

await loadWorkTypesStats();

} catch (error) {
console.error('Ошибка загрузки видов работ:', error);
const tbody = document.getElementById('workTypesTbody');
if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#dc3545;">
        <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки. 
        <button onclick="loadWorkTypes()" style="margin-left:10px;background:#e31e24;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">
            <i class="fas fa-redo"></i> Повторить
        </button>
      </td></tr>`;
}
}
}

// Отрисовка оболочки страницы
function renderWorkTypesShell() {
document.getElementById('dynamicContent').innerHTML = `


<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <h2 style="margin: 0;"></h2>
    <button class="btn-add" onclick="openWorkTypeModal()">
        <i class="fas fa-plus"></i> Добавить сведения о виде работы
    </button>
</div>

<div class="filters-panel" style="display:flex; gap:10px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px;">
    <div class="search-box" style="flex:1;">
        <i class="fas fa-search"></i>
        <input type="text" id="workTypeSearch" placeholder="Поиск по названию..." oninput="debounceWorkTypeSearch()" style="width:100%;">
    </div>
</div>

<div id="workTypesInfo" style="margin-bottom:15px;"></div>

<div id="workTypesTable" class="specialists-table">
    <table style="width:100%; border-collapse:collapse;">
        <thead>
            <tr style="background:#f8f9fa;">
                <th style="padding:12px; text-align:left;">Название</th>
                <th style="padding:12px; text-align:center;">Базовый срок (дни)</th>
                <th style="padding:12px; text-align:center;">Базовая стоимость</th>
                <th style="padding:12px; text-align:center;">Использований</th>
                <th style="padding:12px; text-align:center;">Правил</th>
                <th style="padding:12px; text-align:center;">Действия</th>
            </tr>
        </thead>
        <tbody id="workTypesTbody">
            <tr><td colspan="6" style="text-align:center;padding:30px;"><div class="loader"></div></td></tr>
        </tbody>
    </table>
</div>

<div id="workTypesPagination" style="margin-top:20px; text-align:center;"></div>
`;
}

// Отрисовка таблицы
// Отрисовка таблицы
function renderWorkTypesTable(workTypes, state) {
const tbody = document.getElementById('workTypesTbody');
const info = document.getElementById('workTypesInfo');
const pagination = document.getElementById('workTypesPagination');

if (!workTypes || workTypes.length === 0) {
tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;">
    <div class="empty-state">
        <i class="fas fa-tools"></i>
        <h3>Нет видов работ</h3>
        <p>Добавьте первый вид работы, нажав кнопку выше</p>
    </div>
  </td></tr>`;

if (info && state.search) {
    info.innerHTML = `<div style="padding:10px; background:#fff3cd; border-radius:4px; color:#856404;">
        <i class="fas fa-info-circle"></i> По запросу "${escapeHtml(state.search)}" ничего не найдено
    </div>`;
} else if (info) {
    info.innerHTML = '';
}

if (pagination) pagination.innerHTML = '';
return;
}

// Информация
if (info && state.totalCount > 0) {
info.innerHTML = `<div style="padding:10px; background:#e3f2fd; border-radius:4px; color:#0d47a1;">
    <i class="fas fa-info-circle"></i> Всего: <strong>${state.totalCount}</strong>
    ${state.search ? `по запросу «${escapeHtml(state.search)}»` : ''}
</div>`;
}

// Строки таблицы
tbody.innerHTML = workTypes.map(work => {
// ФОРМАТИРУЕМ СТОИМОСТЬ ВНУТРИ МАПА
const costText = work.BaseCost ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN', minimumFractionDigits: 2 }).format(work.BaseCost) : '—';

// Экранируем для передачи в onclick
const safeName = escapeHtml(work.WorkName).replace(/'/g, "\\'");
const safeDesc = (work.Description || '').replace(/'/g, "\\'").replace(/\n/g, ' ');

return `
    <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px;">
            <strong style="cursor: pointer; color: #e31e24; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px;" 
                    onclick="showWorkTypeDescription(${work.WorkTypeID}, '${safeName}', '${safeDesc}', ${work.UsageCount || 0}, ${work.RulesCount || 0})"
                    title="Нажмите для просмотра описания">
                ${escapeHtml(work.WorkName)}
            </strong>
        </td>
        <td style="padding:12px; text-align:center;">${work.DefaultDuration || '—'}</td>
        <td style="padding:12px; text-align:center;">${costText}</td>
        <td style="padding:12px; text-align:center;">
            <span style="background:#e3f2fd; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">
                ${work.UsageCount || 0}
            </span>
        </td>
        <td style="padding:12px; text-align:center;">
            <span style="background:#fff3cd; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">
                ${work.RulesCount || 0}
            </span>
        </td>
        <td style="padding:12px; text-align:center;">
            <div style="display:flex; gap:8px; justify-content:center;">
                <button class="btn-icon btn-edit" onclick="openWorkTypeModal(${work.WorkTypeID})" title="Редактировать">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteWorkType(${work.WorkTypeID}, '${escapeHtml(work.WorkName).replace(/'/g, "\\'")}', ${work.UsageCount || 0})" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    </table>
`;
}).join('');

// Пагинация
if (pagination && state.totalPages > 1) {
let pages = '';
for (let i = 1; i <= state.totalPages; i++) {
    pages += `<button class="page-btn ${i === state.page ? 'active' : ''}" onclick="loadWorkTypes(${i})">${i}</button>`;
}
pagination.innerHTML = `<div style="display:flex; justify-content:center; gap:5px;">${pages}</div>`;
} else if (pagination) {
pagination.innerHTML = '';
}
}

// Загрузка статистики
async function loadWorkTypesStats() {
const token = localStorage.getItem('token');

try {
const response = await fetch('/api/admin/work-types/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки статистики');

const stats = await response.json();

const total = document.getElementById('totalWorkTypes');
const active = document.getElementById('activeWorkTypes');
const usage = document.getElementById('totalWorkTypesUsage');
const rules = document.getElementById('totalWorkTypesRules');

if (total) total.textContent = stats.TotalTypes || 0;
if (active) active.textContent = stats.ActiveTypes || 0;
if (usage) usage.textContent = stats.TotalUsage || 0;
if (rules) rules.textContent = stats.TotalRules || 0;

} catch (error) {
console.error('Ошибка загрузки статистики:', error);
}
}

// Debounce для поиска
function debounceWorkTypeSearch() {
clearTimeout(workTypesSearchTimeout);
workTypesSearchTimeout = setTimeout(() => {
loadWorkTypes(1);
}, 400);
}

// Открытие модального окна
async function openWorkTypeModal(workTypeId = null) {
let modal = document.getElementById('workTypeModal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'workTypeModal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
            <h2 id="workTypeModalTitle">Вид работы</h2>
            <span class="modal-close" onclick="closeWorkTypeModal()">&times;</span>
        </div>
        <div class="modal-body">
            <form id="workTypeForm" onsubmit="saveWorkType(event)">
                <input type="hidden" id="workTypeId">
                
                <div class="form-group">
                    <label>Название *</label>
                    <input type="text" id="workTypeName" required maxlength="200">
                </div>

                <div class="form-group">
<label>Описание</label>
<textarea id="workTypeDescription" rows="3" maxlength="500" 
      placeholder="Краткое описание вида работ..."></textarea>
</div>
                
                <div class="form-row" style="grid-template-columns: 1fr 1fr;">
                    <div class="form-group">
                        <label>Базовый срок (дни)</label>
                        <input type="number" id="workTypeDuration" min="1" step="1">
                        <small>Стандартная длительность</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Базовая стоимость</label>
                        <input type="number" id="workTypeCost" step="0.01" min="0">
                        <small>За единицу измерения</small>
                    </div>
                </div>
                
                <div class="form-group checkbox-group">
                    <input type="checkbox" id="workTypeIsActive" checked>
                    <label>Активен</label>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeWorkTypeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.appendChild(modal);
}

document.getElementById('workTypeForm').reset();
document.getElementById('workTypeId').value = '';
document.getElementById('workTypeIsActive').checked = true;
document.getElementById('workTypeDuration').value = '';
document.getElementById('workTypeCost').value = '';

if (workTypeId) {
document.getElementById('workTypeModalTitle').textContent = 'Редактирование сведений вида работы';
await loadWorkTypeForEdit(workTypeId);
} else {
document.getElementById('workTypeModalTitle').textContent = 'Новое сведение о виде работ';
}

modal.style.display = 'block';
}

// Загрузка для редактирования
async function loadWorkTypeForEdit(workTypeId) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/work-types/${workTypeId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const work = await response.json();

document.getElementById('workTypeId').value = work.WorkTypeID;
document.getElementById('workTypeName').value = work.WorkName;
document.getElementById('workTypeDescription').value = work.Description || '';
document.getElementById('workTypeDuration').value = work.DefaultDuration || '';
document.getElementById('workTypeCost').value = work.BaseCost || '';
document.getElementById('workTypeIsActive').checked = work.IsActive === true;

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка загрузки данных', 'error');
closeWorkTypeModal();
}
}

// Сохранение
async function saveWorkType(event) {
event.preventDefault();

const token = localStorage.getItem('token');
const workTypeId = document.getElementById('workTypeId').value;
const isNewWork = !workTypeId; // Запоминаем, создаём ли новый вид работы

const workData = {
workName: document.getElementById('workTypeName').value.trim(),
description: document.getElementById('workTypeDescription').value.trim() || null,
defaultDuration: document.getElementById('workTypeDuration').value ? parseInt(document.getElementById('workTypeDuration').value) : null,
baseCost: document.getElementById('workTypeCost').value ? parseFloat(document.getElementById('workTypeCost').value) : null,
isActive: document.getElementById('workTypeIsActive').checked
};

if (!workData.workName) {
showToast('Введите название вида работы', 'error');
return;
}

try {
const url = workTypeId ? `/api/admin/work-types/${workTypeId}` : '/api/admin/work-types';
const method = workTypeId ? 'PUT' : 'POST';

const response = await fetch(url, {
    method: method,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(workData)
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка сохранения');
}

const result = await response.json();
console.log('Ответ сервера при создании вида работы:', result);
showToast(result.message || 'Вид работы успешно сохранен', 'success');
closeWorkTypeModal();

// ========== НОВАЯ ЛОГИКА ==========
// Если это НОВЫЙ вид работы (не редактирование)
if (isNewWork && result.id) {
    // Открываем окно добавления в правила
    openAddToRulesModal(result.id, workData.workName);
} else {
    // При редактировании просто обновляем список
    loadWorkTypes(currentWorkTypesPage);
}
// ==================================

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Открытие модального окна с описанием вида работы
function showWorkTypeDescription(workTypeId, workName, description, usageCount, rulesCount) {
let modal = document.getElementById('workTypeDescriptionModal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'workTypeDescriptionModal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
            <h2 id="workDescModalTitle">Описание вида работы</h2>
            <span class="modal-close" onclick="closeWorkTypeDescriptionModal()">&times;</span>
        </div>
        <div class="modal-body">
            <div id="workDescModalContent"></div>
            <div class="form-actions" style="margin-top: 20px;">
                <button type="button" class="btn btn-primary" onclick="closeWorkTypeDescriptionModal()">Закрыть</button>
            </div>
        </div>
    </div>
`;
document.body.appendChild(modal);
}

document.getElementById('workDescModalTitle').innerHTML = `<i class="fas fa-tools"></i> ${escapeHtml(workName)}`;

const descriptionText = description && description.trim() 
? escapeHtml(description) 
: '<em style="color: #999;">Описание отсутствует</em>';

document.getElementById('workDescModalContent').innerHTML = `
<div style="margin-bottom: 15px;">
    <p style="font-size: 14px; line-height: 1.5; background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #e31e24;">
        ${descriptionText}
    </p>
</div>
<div style="display: flex; gap: 15px; justify-content: space-around; padding-top: 10px; border-top: 1px solid #eee;">
    <div style="text-align: center;">
        <div style="font-size: 24px; color: #007bff;">${usageCount || 0}</div>
        <small style="color: #666;">Использований</small>
    </div>
    <div style="text-align: center;">
        <div style="font-size: 24px; color: #28a745;">${rulesCount || 0}</div>
        <small style="color: #666;">Правил</small>
    </div>
</div>
`;

modal.style.display = 'block';
}

function closeWorkTypeDescriptionModal() {
const modal = document.getElementById('workTypeDescriptionModal');
if (modal) modal.style.display = 'none';
}
async function openAddToRulesModal(workTypeId, workName) {
const token = localStorage.getItem('token');

const typesResponse = await fetch('/api/object-types/all', {
headers: { 'Authorization': `Bearer ${token}` }
});
const objectTypes = await typesResponse.json();

// Удаляем старую модалку если есть
document.getElementById('addToRulesModal')?.remove();

const modalHtml = `
<div id="addToRulesModal" class="modal" style="display:block;">
    <div class="modal-content" style="max-width:620px; width:95%;">
        <div class="modal-header">
            <h2> Добавить в правила</h2>
            <span class="modal-close" onclick="closeAddToRulesModal()">&times;</span>
        </div>
        <div class="modal-body" style="padding:0;">

            <!-- Шапка с названием работы -->
            <div style="padding:14px 20px; background:#f8f9fa; border-bottom:1px solid #e9ecef;">
                <div style="font-size:13px; color:#888; margin-bottom:2px;">Вид работы</div>
                <div style="font-weight:600; font-size:15px; color:#1a1a2e;">
                    
                    ${escapeHtml(workName)}
                </div>
            </div>

            <!-- Подсказка -->
            <div style="padding:10px 20px; background:#e3f2fd; border-bottom:1px solid #bbdefb;
                        font-size:12px; color:#1565c0;">
                <i class="fas fa-info-circle"></i>
                Выберите типы объектов, для которых эта работа будет предлагаться при расчёте сроков
            </div>

            <!-- Список типов -->
            <div style="max-height:420px; overflow-y:auto; padding:12px 16px;">
                <form id="addToRulesForm">
                    <input type="hidden" id="addToRulesWorkTypeId" value="${workTypeId}">

                    ${objectTypes.map((type, i) => `
                        <div class="atr-item" id="atr-item-${type.ObjectTypeID}"
                             style="border:1px solid #e9ecef; border-radius:8px;
                                    margin-bottom:8px; overflow:hidden;">

                            <!-- Строка с чекбоксом -->
                            <label style="display:flex; align-items:center; gap:12px;
                                          padding:12px 14px; cursor:pointer; margin:0;
                                          background:white; user-select:none;"
                                   onclick="toggleAtrItem(${type.ObjectTypeID})">
                                <input type="checkbox"
                                       class="atr-checkbox"
                                       id="atr-cb-${type.ObjectTypeID}"
                                       data-id="${type.ObjectTypeID}"
                                       style="width:16px; height:16px; cursor:pointer; flex-shrink:0;"
                                       onclick="event.stopPropagation(); handleAtrCheck(${type.ObjectTypeID})">
                                <span style="font-weight:500; font-size:14px; flex:1;">
                                    ${escapeHtml(type.TypeName)}
                                </span>
                                <i id="atr-chevron-${type.ObjectTypeID}"
                                   class="fas fa-chevron-down"
                                   style="color:#aaa; font-size:12px; transition:transform .2s;
                                          display:none;"></i>
                            </label>

                            <!-- Настройки (скрыты пока не выбран чекбокс) -->
                            <div id="atr-opts-${type.ObjectTypeID}"
                                 style="display:none; padding:12px 14px 14px;
                                        background:#fafafa; border-top:1px solid #f0f0f0;">
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                    <div>
                                        <label style="font-size:11px; color:#666; font-weight:600;
                                                      text-transform:uppercase; letter-spacing:.5px;
                                                      display:block; margin-bottom:4px;">
                                            Правило расчёта
                                        </label>
                                        <select class="atr-rule" data-id="${type.ObjectTypeID}"
                                                style="width:100%; padding:7px 10px; border:1px solid #ddd;
                                                       border-radius:4px; font-size:13px; background:white;">
                                            <option value="always">Всегда включать</option>
                                            <option value="area_based">Зависит от площади</option>
                                            <option value="per_floor">На каждый этаж</option>
                                            <option value="optional">Опционально</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:#666; font-weight:600;
                                                      text-transform:uppercase; letter-spacing:.5px;
                                                      display:block; margin-bottom:4px;">
                                            Обязательная
                                        </label>
                                        <select class="atr-required" data-id="${type.ObjectTypeID}"
                                                style="width:100%; padding:7px 10px; border:1px solid #ddd;
                                                       border-radius:4px; font-size:13px; background:white;">
                                            <option value="1">Да</option>
                                            <option value="0">Нет</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:#666; font-weight:600;
                                                      text-transform:uppercase; letter-spacing:.5px;
                                                      display:block; margin-bottom:4px;">
                                            Множитель срока
                                        </label>
                                        <input type="number" class="atr-multiplier" data-id="${type.ObjectTypeID}"
                                               value="1.0" step="0.1" min="0.1"
                                               style="width:100%; padding:7px 10px; border:1px solid #ddd;
                                                      border-radius:4px; font-size:13px; box-sizing:border-box;">
                                    </div>
                                    <div>
                                        <label style="font-size:11px; color:#666; font-weight:600;
                                                      text-transform:uppercase; letter-spacing:.5px;
                                                      display:block; margin-bottom:4px;">
                                            Мин. срок (дней)
                                        </label>
                                        <input type="number" class="atr-min-duration" data-id="${type.ObjectTypeID}"
                                               placeholder="не задан" min="1"
                                               style="width:100%; padding:7px 10px; border:1px solid #ddd;
                                                      border-radius:4px; font-size:13px; box-sizing:border-box;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </form>
            </div>

            <!-- Счётчик выбранных -->
            <div style="padding:10px 20px; border-top:1px solid #e9ecef; background:#f8f9fa;
                        font-size:13px; color:#555;">
                Выбрано: <strong id="atrSelectedCount">0</strong> из ${objectTypes.length} типов
            </div>
        </div>

        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
            <button type="button" class="btn btn-secondary" onclick="closeAddToRulesModal()">
                Пропустить
            </button>
            <button type="button" class="btn btn-primary" onclick="saveWorkRules(${workTypeId}, '${escapeHtml(workName).replace(/'/g, "\\'")}')">
                 Сохранить
            </button>
        </div>
    </div>
</div>
`;

document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Обработчик клика на строку типа
function toggleAtrItem(typeId) {
const cb = document.getElementById(`atr-cb-${typeId}`);
if (!cb) return;
cb.checked = !cb.checked;
handleAtrCheck(typeId);
}

// Показать/скрыть настройки и обновить счётчик
function handleAtrCheck(typeId) {
const cb      = document.getElementById(`atr-cb-${typeId}`);
const opts    = document.getElementById(`atr-opts-${typeId}`);
const chevron = document.getElementById(`atr-chevron-${typeId}`);
const item    = document.getElementById(`atr-item-${typeId}`);

if (!cb || !opts) return;

if (cb.checked) {
opts.style.display    = 'block';
chevron.style.display = 'inline-block';
chevron.style.transform = 'rotate(180deg)';
item.style.border     = '1px solid #e31e24';
} else {
opts.style.display    = 'none';
chevron.style.display = 'none';
chevron.style.transform = 'rotate(0deg)';
item.style.border     = '1px solid #e9ecef';
}

// Обновляем счётчик
const total = document.querySelectorAll('.atr-checkbox:checked').length;
const counter = document.getElementById('atrSelectedCount');
if (counter) counter.textContent = total;
}
async function saveWorkRules(workTypeId, workName) {
const token = localStorage.getItem('token');

const rules = [];
document.querySelectorAll('.atr-checkbox:checked').forEach(cb => {
const id = cb.dataset.id;
rules.push({
    objectTypeId:       parseInt(id),
    inclusionRule:      document.querySelector(`.atr-rule[data-id="${id}"]`)?.value || 'always',
    isRequired:         document.querySelector(`.atr-required[data-id="${id}"]`)?.value === '1',
    durationMultiplier: parseFloat(document.querySelector(`.atr-multiplier[data-id="${id}"]`)?.value) || 1,
    minDuration:        document.querySelector(`.atr-min-duration[data-id="${id}"]`)?.value
                            ? parseInt(document.querySelector(`.atr-min-duration[data-id="${id}"]`).value)
                            : null,
    sortOrder: 0
});
});

if (rules.length === 0) {
closeAddToRulesModal();
showToast('Вид работы создан, правила не добавлены', 'info');
loadWorkTypes();
return;
}

try {
const response = await fetch(`/api/admin/work-types/${workTypeId}/add-to-rules`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ rules, workName })
});

if (!response.ok) throw new Error('Ошибка сохранения правил');

showToast(`"${workName}" добавлен в ${rules.length} правил`, 'success');
closeAddToRulesModal();
loadWorkTypes();
} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

function closeAddToRulesModal() {
document.getElementById('addToRulesModal')?.remove();
}
// Удаление (с проверкой на использование)
async function deleteWorkType(workTypeId, workName, usageCount) {
let message = `Вы уверены, что хотите удалить вид работы "${workName}"?`;

if (usageCount > 0) {
message = `Невозможно удалить вид работы "${workName}"!\n\nЭтот вид работы используется в ${usageCount} заказах.\n\nСначала удалите или измените эти заказы.`;
showToast(message, 'error');
return;
}

if (!confirm(message)) return;

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/work-types/${workTypeId}?hardDelete=true`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка');
}

const result = await response.json();
showToast(result.message, 'success');
loadWorkTypes(currentWorkTypesPage);

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// ==================== УПРАВЛЕНИЕ КЛИЕНТАМИ ====================

let currentClientsPage = 1;
let totalClientsPages = 1;
let clientsSearchTimeout;

// Загрузка страницы с клиентами
async function loadClients(page = 1) {
const token = localStorage.getItem('token');
const search = document.getElementById('clientSearch')?.value || '';

const isFirstRender = !document.getElementById('clientsTable');

if (isFirstRender) {
renderClientsShell();
}

const tbody = document.getElementById('clientsTbody');
if (tbody) {
tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;"><div class="loader"></div></td></tr>';
}

try {
const response = await fetch(`/api/admin/clients?page=${page}&search=${encodeURIComponent(search)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();

currentClientsPage = page;
totalClientsPages = data.pagination?.totalPages || 1;

renderClientsTable(data.clients, {
    page: page,
    totalPages: data.pagination?.totalPages || 1,
    totalCount: data.pagination?.totalCount || 0,
    search: search
});

await loadClientsStats();

} catch (error) {
console.error('Ошибка загрузки клиентов:', error);
const tbody = document.getElementById('clientsTbody');
if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#dc3545;">
        <i class="fas fa-exclamation-triangle"></i> Ошибка загрузки. 
        <button onclick="loadClients()" style="margin-left:10px;background:#e31e24;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">
            <i class="fas fa-redo"></i> Повторить
        </button>
        </td></tr>`;
}
}
}

function renderClientsShell() {
document.getElementById('dynamicContent').innerHTML = `
<div class="stats-grid" style="margin-bottom:20px;">
    <div class="stat-card">
        <div class="stat-info">
            <h3>Всего клиентов</h3>
            <div class="stat-number" id="totalClients">—</div>
        </div>
        <div class="stat-icon"><i class="fas fa-users"></i></div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>С компанией</h3>
            <div class="stat-number" id="clientsWithCompany">—</div>
        </div>
        <div class="stat-icon"><i class="fas fa-building"></i></div>
    </div>
    <div class="stat-card">
        <div class="stat-info">
            <h3>Заказов</h3>
            <div class="stat-number" id="totalClientOrders">—</div>
        </div>
        <div class="stat-icon"><i class="fas fa-file-contract"></i></div>
    </div>
</div>

<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <h2 style="margin: 0;"></h2>
</div>

<div class="filters-panel" style="display:flex; gap:10px; margin-bottom:20px; padding:15px; background:#f8f9fa; border-radius:8px;">
    <div class="search-box" style="flex:1;">
        <i class="fas fa-search"></i>
        <input type="text" id="clientSearch" placeholder="Поиск по имени, email, телефону, компании или УНП..." oninput="debounceClientSearch()" style="width:100%;">
    </div>
</div>

<div id="clientsInfo" style="margin-bottom:15px;"></div>

<div id="clientsTable" class="specialists-table">
    <table style="width:100%; border-collapse:collapse;">
        <thead>
            <tr style="background:#f8f9fa;">
                <th style="padding:12px; text-align:left;">Клиент</th>
                <th style="padding:12px; text-align:left;">Компания</th>
                <th style="padding:12px; text-align:left;">Контакты</th>
                <th style="padding:12px; text-align:center;">УНП</th>
                <th style="padding:12px; text-align:center;">Заказов</th>
                <th style="padding:12px; text-align:center;">Действия</th>
            </tr>
        </thead>
        <tbody id="clientsTbody">
            <tr><td colspan="6" style="text-align:center;padding:30px;"><div class="loader"></div></td></tr>
        </tbody>
    </table>
</div>

<div id="clientsPagination" style="margin-top:20px; text-align:center;"></div>
`;
}
function renderClientsTable(clients, state) {
const tbody = document.getElementById('clientsTbody');
const info = document.getElementById('clientsInfo');
const pagination = document.getElementById('clientsPagination');

if (!clients || clients.length === 0) {
tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;">
    <div class="empty-state">
        <i class="fas fa-user-friends"></i>
        <h3>Нет клиентов</h3>
        <p>Клиенты появляются после одобрения заявок</p>
    </div>
    </td></tr>`;

if (info && state.search) {
    info.innerHTML = `<div style="padding:10px; background:#fff3cd; border-radius:4px; color:#856404;">
        <i class="fas fa-info-circle"></i> По запросу "${escapeHtml(state.search)}" ничего не найдено
    </div>`;
} else if (info) {
    info.innerHTML = '';
}

if (pagination) pagination.innerHTML = '';
return;
}

if (info && state.totalCount > 0) {
info.innerHTML = `<div style="padding:10px; background:#e3f2fd; border-radius:4px; color:#0d47a1;">
    <i class="fas fa-info-circle"></i> Всего: <strong>${state.totalCount}</strong>
    ${state.search ? `по запросу «${escapeHtml(state.search)}»` : ''}
</div>`;
}

tbody.innerHTML = clients.map(client => {
const phone = client.Phone || '—';

return `
    <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px;">
            <strong>${escapeHtml(client.FullName || '—')}</strong>
        </td>
        <td style="padding:12px;">
            <strong>${escapeHtml(client.CompanyName || '—')}</strong>
        </td>
        <td style="padding:12px;">
            <div>${escapeHtml(client.Email || '—')}</div>
            <div style="font-size:12px; color:#666;">${escapeHtml(phone)}</div>
        </td>
        <td style="padding:12px; text-align:center;">${escapeHtml(client.UNP || '—')}</td>
        <td style="padding:12px; text-align:center;">
            <span style="background:#e3f2fd; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">
                ${client.OrdersCount || 0}
            </span>
        </td>
        <td style="padding:12px; text-align:center;">
            <div style="display:flex; gap:8px; justify-content:center;">
                <button class="btn-icon btn-edit" onclick="openClientModal(${client.UserID})" title="Редактировать">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-password" onclick="openClientPasswordModal(${client.UserID}, '${escapeHtml(client.FullName).replace(/'/g, "\\'")}')" title="Сбросить пароль">
                    <i class="fas fa-key"></i>
                </button>
                <button class="btn-icon btn-history" onclick="viewClientOrders(${client.UserID}, '${escapeHtml(client.FullName).replace(/'/g, "\\'")}')" title="Заказы клиента">
                    <i class="fas fa-file-contract"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteClient(${client.UserID}, '${escapeHtml(client.FullName).replace(/'/g, "\\'")}', ${client.OrdersCount || 0})" title="Удалить клиента">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
                `;
}).join('');

if (pagination && state.totalPages > 1) {
let pages = '';
for (let i = 1; i <= state.totalPages; i++) {
    pages += `<button class="page-btn ${i === state.page ? 'active' : ''}" onclick="loadClients(${i})">${i}</button>`;
}
pagination.innerHTML = `<div style="display:flex; justify-content:center; gap:5px;">${pages}</div>`;
} else if (pagination) {
pagination.innerHTML = '';
}
}
async function loadClientsStats() {
const token = localStorage.getItem('token');
try {
const response = await fetch('/api/admin/clients/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) throw new Error('Ошибка загрузки статистики');
const stats = await response.json();

const total = document.getElementById('totalClients');
const withCompany = document.getElementById('clientsWithCompany');
const orders = document.getElementById('totalClientOrders');

if (total) total.textContent = stats.TotalClients || 0;
if (withCompany) withCompany.textContent = stats.WithCompanies || 0;
if (orders) orders.textContent = stats.TotalOrders || 0;

} catch (error) {
console.error('Ошибка загрузки статистики:', error);
}
}

// Debounce для поиска
function debounceClientSearch() {
clearTimeout(clientsSearchTimeout);
clientsSearchTimeout = setTimeout(() => {
loadClients(1);
}, 400);
}

// Сброс фильтров
function resetClientFilters() {
const search = document.getElementById('clientSearch');
const showInactive = document.getElementById('showInactiveClients');
if (search) search.value = '';
if (showInactive) showInactive.checked = false;
loadClients(1);
}

// Открытие модального окна клиента
async function openClientModal(userId) {
let modal = document.getElementById('clientModal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'clientModal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header">
            <h2 id="clientModalTitle">Редактирование данных клиента</h2>
            <span class="modal-close" onclick="closeClientModal()">&times;</span>
        </div>
        <div class="modal-body">
            <form id="clientForm" onsubmit="saveClient(event)">
                <input type="hidden" id="clientUserId">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>ФИО *</label>
                        <input type="text" id="clientFullName" required>
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" id="clientEmail" required>
                    </div>
                    <div class="form-group">
                        <label>Телефон</label>
                        <input type="text" id="clientPhone">
                    </div>
                    <div class="form-group checkbox-group" style="display: flex; align-items: center;">
                        <input type="checkbox" id="clientIsActive" checked>
                        <label>Активен</label>
                    </div>
                </div>
                
                <hr style="margin: 20px 0;">
                <h3 style="font-size: 16px; margin-bottom: 15px;">Данные компании (юридического лица)</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label>Название компании</label>
                        <input type="text" id="clientCompanyName">
                    </div>
                    <div class="form-group">
                        <label>УНП</label>
                        <input type="text" id="clientUNP">
                    </div>
                    <div class="form-group">
                        <label>ОКПО</label>
                        <input type="text" id="clientOKPO">
                    </div>
                    <div class="form-group">
                        <label>Веб-сайт</label>
                        <input type="text" id="clientWebsite">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Юридический адрес</label>
                        <input type="text" id="clientLegalAddress">
                    </div>
                    <div class="form-group">
                        <label>Директор</label>
                        <input type="text" id="clientDirectorName">
                    </div>
                    <div class="form-group">
                        <label>Должность директора</label>
                        <input type="text" id="clientDirectorPosition" value="Директор">
                    </div>
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Основание полномочий</label>
                        <input type="text" id="clientAuthorityDoc" placeholder="Устава">
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeClientModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.appendChild(modal);
}

document.getElementById('clientForm').reset();
document.getElementById('clientUserId').value = userId;
document.getElementById('clientIsActive').checked = true;

await loadClientForEdit(userId);

modal.style.display = 'block';
}

// Загрузка клиента для редактирования
async function loadClientForEdit(userId) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/clients/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();
const client = data.client;

document.getElementById('clientFullName').value = client.FullName || '';
document.getElementById('clientEmail').value = client.Email || '';
document.getElementById('clientPhone').value = client.Phone || '';
document.getElementById('clientIsActive').checked = client.IsActive === true;
document.getElementById('clientCompanyName').value = client.CompanyName || '';
document.getElementById('clientUNP').value = client.UNP || '';
document.getElementById('clientOKPO').value = client.OKPO || '';
document.getElementById('clientLegalAddress').value = client.LegalAddress || '';
document.getElementById('clientDirectorName').value = client.DirectorName || '';
document.getElementById('clientDirectorPosition').value = client.DirectorPosition || 'Директор';
document.getElementById('clientAuthorityDoc').value = client.AuthorityDoc || 'Устава';
document.getElementById('clientWebsite').value = client.Website || '';

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка загрузки данных клиента', 'error');
closeClientModal();
}
}

// Сохранение клиента
async function saveClient(event) {
event.preventDefault();

const token = localStorage.getItem('token');
const userId = document.getElementById('clientUserId').value;

const clientData = {
fullName: document.getElementById('clientFullName').value.trim(),
email: document.getElementById('clientEmail').value.trim(),
phone: document.getElementById('clientPhone').value.trim() || null,
isActive: document.getElementById('clientIsActive').checked,
companyName: document.getElementById('clientCompanyName').value.trim() || null,
unp: document.getElementById('clientUNP').value.trim() || null,
okpo: document.getElementById('clientOKPO').value.trim() || null,
legalAddress: document.getElementById('clientLegalAddress').value.trim() || null,
directorName: document.getElementById('clientDirectorName').value.trim() || null,
directorPosition: document.getElementById('clientDirectorPosition').value.trim() || null,
authorityDoc: document.getElementById('clientAuthorityDoc').value.trim() || null,
website: document.getElementById('clientWebsite').value.trim() || null
};

if (!clientData.fullName) {
showToast('Введите ФИО клиента', 'error');
return;
}

if (!clientData.email) {
showToast('Введите Email клиента', 'error');
return;
}

try {
const response = await fetch(`/api/admin/clients/${userId}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(clientData)
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка сохранения');
}

const result = await response.json();
showToast(result.message || 'Данные клиента сохранены', 'success');
closeClientModal();
loadClients(currentClientsPage);
loadClientsStats();

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Открытие модального окна сброса пароля
function openClientPasswordModal(userId, clientName) {
let modal = document.getElementById('clientPasswordModal');
if (!modal) {
modal = document.createElement('div');
modal.id = 'clientPasswordModal';
modal.className = 'modal';
modal.innerHTML = `
    <div class="modal-content" style="max-width: 450px;">
        <div class="modal-header">
            <h2>Сброс пароля</h2>
            <span class="modal-close" onclick="closeClientPasswordModal()">&times;</span>
        </div>
        <div class="modal-body">
            <p>Клиент: <strong id="passwordClientName"></strong></p>
            <form id="clientPasswordForm" onsubmit="resetClientPassword(event)">
                <input type="hidden" id="passwordClientUserId">
                
                <div class="form-group">
                    <label>Новый пароль</label>
                    <div class="password-input-group">
                        <input type="text" id="clientNewPassword" required>
                        <button type="button" class="btn-generate" onclick="generateClientPassword()">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                    <small>Минимум 6 символов</small>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeClientPasswordModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сбросить пароль</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.appendChild(modal);
}

document.getElementById('passwordClientUserId').value = userId;
document.getElementById('passwordClientName').textContent = clientName;
document.getElementById('clientNewPassword').value = '';

modal.style.display = 'block';
}

// Генерация пароля для клиента
function generateClientPassword() {
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
let password = '';
for (let i = 0; i < 10; i++) {
password += chars.charAt(Math.floor(Math.random() * chars.length));
}
document.getElementById('clientNewPassword').value = password;
}

// Сброс пароля клиента
async function resetClientPassword(event) {
event.preventDefault();

const token = localStorage.getItem('token');
const userId = document.getElementById('passwordClientUserId').value;
const password = document.getElementById('clientNewPassword').value;

if (password.length < 6) {
showToast('Пароль должен содержать минимум 6 символов', 'error');
return;
}

try {
const response = await fetch(`/api/admin/clients/${userId}/reset-password`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ password })
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка сброса пароля');
}

const result = await response.json();
showToast(result.message || `Новый пароль: ${password}`, 'success');
closeClientPasswordModal();

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Просмотр заказов клиента
async function viewClientOrders(userId, clientName) {
const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/clients/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const data = await response.json();
const orders = data.orders || [];

let modal = document.getElementById('clientOrdersModal');
if (!modal) {
    modal = document.createElement('div');
    modal.id = 'clientOrdersModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h2>Заказы клиента: <span id="ordersClientName"></span></h2>
                <span class="modal-close" onclick="closeClientOrdersModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="ordersList"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

document.getElementById('ordersClientName').textContent = clientName;

const ordersList = document.getElementById('ordersList');

if (orders.length === 0) {
    ordersList.innerHTML = `<div class="empty-state"><p>У клиента нет заказов</p></div>`;
} else {
    let html = '<div class="specialists-table"><table style="width:100%;"><thead><tr>';
    html += '<th>№ договора</th><th>Дата</th><th>Объект</th><th>Статус</th><th>Сумма</th>';
    html += '</tr></thead><tbody>';
    
    orders.forEach(order => {
        const date = order.SignDate ? new Date(order.SignDate).toLocaleDateString('ru-RU') : '—';
        const total = order.TotalCost ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN' }).format(order.TotalCost) : '—';
        
        html += `<tr>
            <td><strong>${escapeHtml(order.ContractNumber || '—')}</strong></td>
            <td>${date}</td>
            <td>${escapeHtml(order.ObjectName || '—')}</td>
            <td><span class="status-badge">${escapeHtml(order.Status || '—')}</span></td>
            <td>${total}</td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    ordersList.innerHTML = html;
}

modal.style.display = 'block';

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка загрузки заказов', 'error');
}
}
async function deleteClient(userId, clientName, ordersCount) {
let msg = `Вы уверены, что хотите ПОЛНОСТЬЮ УДАЛИТЬ клиента "${clientName}"?`;

if (ordersCount > 0) {
msg += `\n\nВместе с клиентом будут удалены ЕГО ${ordersCount} ЗАКАЗ(ОВ)!`;
}
msg += `\n\nЭто действие НЕЛЬЗЯ отменить!`;

if (!confirm(msg)) return;

const token = localStorage.getItem('token');

try {
const response = await fetch(`/api/admin/clients/${userId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка удаления');
}

const result = await response.json();
showToast(result.message, 'success');
loadClients(currentClientsPage);
loadClientsStats();

} catch (error) {
console.error('Ошибка:', error);
showToast(error.message, 'error');
}
}

// Закрытие модальных окон
function closeClientModal() {
const modal = document.getElementById('clientModal');
if (modal) modal.style.display = 'none';
}

function closeClientPasswordModal() {
const modal = document.getElementById('clientPasswordModal');
if (modal) modal.style.display = 'none';
}

function closeClientOrdersModal() {
const modal = document.getElementById('clientOrdersModal');
if (modal) modal.style.display = 'none';
}

function closeWorkTypeModal() {
const modal = document.getElementById('workTypeModal');
if (modal) {
modal.style.display = 'none';
}
}

// Закрытие модального окна
function closeObjectTypeModal() {
const modal = document.getElementById('objectTypeModal');
if (modal) {
modal.style.display = 'none';
}
}

// ==================== НОВЫЕ СТРАНИЦЫ ОТЧЕТОВ ====================

function renderClientsReportPage() {
document.getElementById('dynamicContent').innerHTML = `
<div style="margin-bottom:24px;">
    <h2 style="margin:0 0 4px 0;">Отчет по клиентам</h2>
    <p style="margin:0;color:#888;font-size:13px;">Аналитика по клиентам, заявкам и заказам</p>
</div>
<div class="filters-panel" style="margin-bottom:24px;">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
        <div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Период с</label>
            <input type="date" id="clientsReportDateFrom" class="filter-select" value="${getDateMonthsAgo(3)}" max="${getCurrentDate()}">
        </div>
        <div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Период по</label>
            <input type="date" id="clientsReportDateTo" class="filter-select" value="${getCurrentDate()}" max="${getCurrentDate()}">
        </div>
        <div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Группировка</label>
            <select id="clientsReportGroupBy" class="filter-select">
                <option value="month">По месяцам</option>
                <option value="year">По годам</option>
            </select>
        </div>
        <button class="btn-primary" onclick="loadClientsReportData()" style="padding:10px 20px;height:38px;">
            <i class="fas fa-sync-alt"></i> Обновить
        </button>
    </div>
</div>
<div id="clientsReportContent"><div class="loader"></div></div>
`;
document.getElementById('clientsReportDateFrom').addEventListener('change', () => validateReportDates('clients'));
document.getElementById('clientsReportDateTo').addEventListener('change', () => validateReportDates('clients'));
loadClientsReportData();
}

async function loadClientsReportData() {
const token = localStorage.getItem('token');
const dateFrom = document.getElementById('clientsReportDateFrom')?.value;
const dateTo = document.getElementById('clientsReportDateTo')?.value;
const groupBy = document.getElementById('clientsReportGroupBy')?.value || 'month';
if (!validateReportDates('clients')) return;
const container = document.getElementById('clientsReportContent');
container.innerHTML = '<div class="loader"></div>';
try {
const response = await fetch(`/api/admin/reports/clients?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) throw new Error('Ошибка загрузки');
const data = await response.json();
const { dynamics = [], topClients = [] } = data;
let html = '';

if (dynamics.length) {
    const byMonth = !!dynamics[0].MonthName;
    let labels = [];
    let newClientsData = [];
    let cumulativeData = [];
    let revenueData = [];
    
    let cumulativeTotal = 0;
    
    dynamics.forEach((d) => {
        let label = byMonth ? `${translateMonth(d.MonthName)} ${d.Year}` : `${d.Year}`;
        labels.push(label);
        newClientsData.push(d.NewClients || 0);
        cumulativeTotal += (d.NewClients || 0);
        cumulativeData.push(cumulativeTotal);
        revenueData.push(d.Revenue || 0);
    });
    
    // Добавляем canvas с уникальным ID и стилями
    html += `
        <div class="report-section">
            <h3><i class="fas fa-chart-line"></i> График динамики клиентов</h3>
            <div style="padding: 20px;">
                <canvas id="clientsChartCanvas" style="width: 100%; height: 400px; display: block;"></canvas>
            </div>
        </div>
    `;
    
    // Таблица
    let ths, rows;
    if (byMonth) {
        ths = `<th>Год</th><th>Месяц</th><th>Новых клиентов</th><th>Всего клиентов</th><th>Заявок</th><th>Заказов</th><th>Стоимость</th><th>Ср. чек</th>`;
        
        cumulativeTotal = 0;
        const enhancedDynamics = dynamics.map((d) => {
            cumulativeTotal += (d.NewClients || 0);
            return { ...d, CumulativeTotal: cumulativeTotal };
        });
        
        rows = enhancedDynamics.map(d => {
            const avgCheck = d.Revenue && d.CumulativeTotal ? (d.Revenue / d.CumulativeTotal).toFixed(0) : 0;
            return `<tr>
                <td style="text-align:center">${d.Year}</td>
                <td>${translateMonth(d.MonthName)}</span></td>
                <td style="text-align:center"><strong>${fmtNum(d.NewClients)}</strong></span></td>
                <td style="text-align:center">${fmtNum(d.CumulativeTotal)}</span></span></td>
                <td style="text-align:center">${fmtNum(d.Applications)}</span></span></td>
                <td style="text-align:center">${fmtNum(d.Orders)}</span></span></td>
                <td style="text-align:center">${fmtNum(d.Revenue)} BYN</span></span></td>
                <td style="text-align:center">${fmtNum(avgCheck)} BYN</span></span></td>
            </tr>`;
        }).join('');
        
        const totalNew = dynamics.reduce((s,d)=>s+(d.NewClients||0),0);
        const totalApps = dynamics.reduce((s,d)=>s+(d.Applications||0),0);
        const totalOrders = dynamics.reduce((s,d)=>s+(d.Orders||0),0);
        const totalRevenue = dynamics.reduce((s,d)=>s+(d.Revenue||0),0);
        const finalCumulative = enhancedDynamics[enhancedDynamics.length-1]?.CumulativeTotal || 0;
        const avgCheckTotal = totalRevenue && finalCumulative ? (totalRevenue / finalCumulative).toFixed(0) : 0;
        
        rows += `<tfoot>
            <tr style="background:#f1f5f9; font-weight:700;">
                <td colspan="2" style="text-align:left;">ИТОГО</span></td>
                <td style="text-align:center">${fmtNum(totalNew)}</span></span></td>
                <td style="text-align:center">${fmtNum(finalCumulative)}</span></span></td>
                <td style="text-align:center">${fmtNum(totalApps)}</span></span></td>
                <td style="text-align:center">${fmtNum(totalOrders)}</span></span></td>
                <td style="text-align:center">${fmtNum(totalRevenue)} BYN</span></span></td>
                <td style="text-align:center">${fmtNum(avgCheckTotal)} BYN</span></span></td>
            </tr>
        </tfoot>`;
    } else {
        ths = `<th>Год</th><th>Новых клиентов</th><th>Всего клиентов</th><th>Заявок</th><th>Заказов</th><th>Стоимость</th><th>Ср. чек</th>`;
        
        let yearlyCumulative = 0;
        const yearlyData = dynamics.map(d => {
            yearlyCumulative += (d.NewClients || 0);
            return { ...d, CumulativeTotal: yearlyCumulative };
        });
        
        rows = yearlyData.map(d => {
            const avgCheck = d.Revenue && d.CumulativeTotal ? (d.Revenue / d.CumulativeTotal).toFixed(0) : 0;
            return `<tr>
                <td style="text-align:center">${d.Year}</td>
                <td style="text-align:center"><strong>${fmtNum(d.NewClients)}</strong></span></td>
                <td style="text-align:center">${fmtNum(d.CumulativeTotal)}</span></span></td>
                <td style="text-align:center">${fmtNum(d.Applications)}</span></span></td>
                <td style="text-align:center">${fmtNum(d.Orders)}</span></span></td>
                <td style="text-align:center">${fmtNum(d.Revenue)} BYN</span></span></td>
                <td style="text-align:center">${fmtNum(avgCheck)} BYN</span></span></td>
            </tr>`;
        }).join('');
    }
    
    html += `
        <div class="report-section">
            <h3><i class="fas fa-table"></i> Детальная таблица</h3>
            <div class="report-table-wrap">
                <table class="report-table">
                    <thead><tr>${ths}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // === ОТРИСОВКА ГРАФИКА ПОСЛЕ ВСТАВКИ HTML ===
    setTimeout(() => {
        const canvas = document.getElementById('clientsChartCanvas');
        if (!canvas) {
            console.error('Canvas элемент не найден');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Не удалось получить контекст canvas');
            return;
        }
        
        // Уничтожаем старый график
        if (window.clientsChartInstance) {
            try {
                window.clientsChartInstance.destroy();
            } catch(e) {}
        }
        
        // Проверяем, что Chart доступен
        if (typeof Chart === 'undefined') {
            console.error('Chart.js не загружен!');
            return;
        }
        
        try {
            window.clientsChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Новые клиенты',
                            data: newClientsData,
                            borderColor: '#e31e24',
                            backgroundColor: 'rgba(227, 30, 36, 0.1)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        },
                        {
                            label: 'Всего клиентов (накоплено)',
                            data: cumulativeData,
                            borderColor: '#28a745',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.3,
                            fill: false,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'Стоимость (тыс. BYN)',
                            data: revenueData.map(v => v / 1000),
                            borderColor: '#ffc107',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    let value = context.raw;
                                    if (context.dataset.label === 'Стоимость (тыс. BYN)') {
                                        return `${label}: ${(value * 1000).toLocaleString()} BYN`;
                                    }
                                    return `${label}: ${value.toLocaleString()}`;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                boxWidth: 12,
                                font: { size: 12 }
                            }
                        }
                    },
                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: 'Количество клиентов',
                                color: '#666',
                                font: { size: 12 }
                            },
                            beginAtZero: true,
                            grid: { color: '#e9ecef' }
                        },
                        y1: {
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Стоимость (тыс. BYN)',
                                color: '#ffc107',
                                font: { size: 12 }
                            },
                            beginAtZero: true,
                            grid: { drawOnChartArea: false }
                        },
                        x: {
                            title: {
                                display: true,
                                text: byMonth ? 'Месяц' : 'Год',
                                color: '#666',
                                font: { size: 12 }
                            },
                            grid: { display: false }
                        }
                    }
                }
            });
            console.log('График успешно создан');
        } catch(err) {
            console.error('Ошибка при создании графика:', err);
        }
    }, 150);
    
} else {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>Нет данных за выбранный период</p></div>`;
    return;
}

// Топ клиентов
if (topClients.length) {
    const ths2 = `<th>ФИО клиента</th><th>Email</th><th>Телефон</th><th>Заказов</th><th>Сумма</th><th>Ср. чек</th><th>Последний заказ</th>`;
    const rows2 = topClients.map(c => {
        const avgCheck = c.OrdersCount ? (c.TotalSpent / c.OrdersCount).toFixed(0) : 0;
        return `<tr>
            <td><strong>${escapeHtml(c.FullName||'—')}</strong></td>
            <td>${escapeHtml(c.Email||'—')}</span></td>
            <td>${escapeHtml(c.Phone||'—')}</span></td>
            <td style="text-align:center">${fmtNum(c.OrdersCount)}</span></span></td>
            <td style="text-align:center">${fmtNum(c.TotalSpent)} BYN</span></span></td>
            <td style="text-align:center">${fmtNum(avgCheck)} BYN</span></span></td>
            <td style="text-align:center">${fmtDate(c.LastOrderDate)}</span></span></td>
        </tr>`;
    }).join('');
    html += `
        <div class="report-section">
            <h3><i class="fas fa-trophy"></i> Топ клиентов по сумме заказов</h3>
            <div class="report-table-wrap">
                <table class="report-table">
                    <thead><tr>${ths2}</tr></thead>
                    <tbody>${rows2}</tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// Кнопка экспорта
const exportBtnHtml = `
    <div style="margin-top:20px;display:flex;justify-content:flex-end;">
        <button class="export-btn" onclick="exportClientsReport()">
            <i class="fas fa-file-excel"></i> Экспорт в Excel
        </button>
    </div>
`;
container.insertAdjacentHTML('beforeend', exportBtnHtml);

} catch(e) { 
console.error('Ошибка:', e); 
container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки данных: ${e.message}</p></div>`; 
}
}
function renderOrdersReportPage() {
document.getElementById('dynamicContent').innerHTML = `
<div style="margin-bottom:24px;">
    <h2 style="margin:0 0 4px 0;">Отчет по заказам</h2>
    <p style="margin:0;color:#888;font-size:13px;">Аналитика по заказам, выручке и эффективности</p>
</div>
<div class="filters-panel" style="margin-bottom:24px;">
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
        <div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Период с</label>
            <input type="date" id="ordersReportDateFrom" class="filter-select" value="${getDateMonthsAgo(3)}" max="${getCurrentDate()}">
        </div>
        <div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Период по</label>
            <input type="date" id="ordersReportDateTo" class="filter-select" value="${getCurrentDate()}" max="${getCurrentDate()}">
        </div>
        <div>
            <label style="font-size:12px;color:#666;display:block;margin-bottom:4px;">Группировка</label>
            <select id="ordersReportGroupBy" class="filter-select">
                <option value="month">По месяцам</option>
                <option value="year">По годам</option>
            </select>
        </div>
        <button class="btn-primary" onclick="loadOrdersReportData()" style="padding:10px 20px;height:38px;">
            <i class="fas fa-sync-alt"></i> Обновить
        </button>
    </div>
</div>
<div class="extra-filters-panel" style="margin-bottom:20px;padding:15px;background:#f8f9fa;border-radius:8px;">
    <div style="display:flex;gap:15px;flex-wrap:wrap;align-items:flex-end;">
        <div>
            <label>Статус</label>
            <select id="ordersReportStatusFilter" class="filter-select">
                <option value="">Все статусы</option>
                <option value="Новая">Новая</option>
                <option value="В работе">В работе</option>
                <option value="Завершена">Завершена</option>
                <option value="Отклонена">Отклонена</option>
            </select>
        </div>
        <div>
            <label>Специалист</label>
            <select id="ordersReportSpecialistFilter" class="filter-select">
                <option value="">Все специалисты</option>
            </select>
        </div>
        <div>
            <label>Категория</label>
            <select id="ordersReportCategoryFilter" class="filter-select">
                <option value="">Все категории</option>
            </select>
        </div>
        <button class="btn-primary" onclick="loadOrdersReportData()" style="padding:8px 16px;height:36px;">
            <i class="fas fa-filter"></i> Применить
        </button>
    </div>
</div>
<div id="ordersReportContent"><div class="loader"></div></div>
`;
document.getElementById('ordersReportDateFrom').addEventListener('change', () => validateReportDates('orders'));
document.getElementById('ordersReportDateTo').addEventListener('change', () => validateReportDates('orders'));
loadSpecialistsForOrdersFilter();
loadCategoriesForOrdersFilter();
loadOrdersReportData();
}

async function loadSpecialistsForOrdersFilter() {
const token = localStorage.getItem('token');
const sel = document.getElementById('ordersReportSpecialistFilter');
if (!sel) return;
try {
const res = await fetch('/api/admin/specialists?pageSize=100', { headers: { 'Authorization': `Bearer ${token}` } });
const data = res.ok ? await res.json() : {};
let opts = '<option value="">Все специалисты</option>';
(data.specialists || []).forEach(s => { opts += `<option value="${s.UserID}">${escapeHtml(s.FullName)}</option>`; });
sel.innerHTML = opts;
} catch(e) { console.error(e); }
}

async function loadCategoriesForOrdersFilter() {
const token = localStorage.getItem('token');
const sel = document.getElementById('ordersReportCategoryFilter');
if (!sel) return;
try {
const res = await fetch('/api/object-types/all', { headers: { 'Authorization': `Bearer ${token}` } });
const data = res.ok ? await res.json() : [];
let opts = '<option value="">Все категории</option>';
(data || []).forEach(cat => { opts += `<option value="${cat.TypeName}">${escapeHtml(cat.TypeName)}</option>`; });
sel.innerHTML = opts;
} catch(e) { console.error(e); }
}

async function loadOrdersReportData() {
const token = localStorage.getItem('token');
const dateFrom = document.getElementById('ordersReportDateFrom')?.value;
const dateTo = document.getElementById('ordersReportDateTo')?.value;
const groupBy = document.getElementById('ordersReportGroupBy')?.value || 'month';
const status = document.getElementById('ordersReportStatusFilter')?.value || '';
const specialistId = document.getElementById('ordersReportSpecialistFilter')?.value || '';
const category = document.getElementById('ordersReportCategoryFilter')?.value || '';
if (!validateReportDates('orders')) return;
const container = document.getElementById('ordersReportContent');
container.innerHTML = '<div class="loader"></div>';
try {
let periodUrl = `/api/admin/reports/orders/period?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`;
if (status) periodUrl += `&status=${encodeURIComponent(status)}`;
let filterUrl = `/api/admin/reports/orders/filter?dateFrom=${dateFrom}&dateTo=${dateTo}`;
if (status) filterUrl += `&status=${encodeURIComponent(status)}`;
if (specialistId) filterUrl += `&specialistId=${specialistId}`;
if (category) filterUrl += `&category=${encodeURIComponent(category)}`;
const [pRes, fRes] = await Promise.all([
    fetch(periodUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
    fetch(filterUrl, { headers: { 'Authorization': `Bearer ${token}` } })
]);
const periodData = pRes.ok ? await pRes.json() : {};
const orders = fRes.ok ? await fRes.json() : [];
const { dynamics = [] } = periodData;
let html = '';

if (dynamics.length) {
    const byMonth = !!dynamics[0].MonthName;
    let ths, rows;
    if (byMonth) {
        ths = `<th>Год</th><th>Месяц</th><th>Заказов</th><th>Завершено</th><th>Стоимость</th><th>Клиентов</th>`;
        rows = dynamics.map(d => `<tr><td style="text-align:center">${d.Year}</td><td>${translateMonth(d.MonthName)}</td><td style="text-align:center">${fmtNum(d.OrdersCount)}</td><td style="text-align:center">${fmtNum(d.CompletedCount)}</td><td style="text-align:center">${fmtNum(d.Revenue)} BYN</td><td style="text-align:center">${fmtNum(d.ClientsCount)}</td>`).join('');
        const totO = dynamics.reduce((s,d)=>s+(d.OrdersCount||0),0);
        const totC = dynamics.reduce((s,d)=>s+(d.CompletedCount||0),0);
        const totR = dynamics.reduce((s,d)=>s+(d.Revenue||0),0);
        rows += `<tfoot><tr><td colspan="2" style="text-align:left;">ИТОГО</td><td style="text-align:center">${fmtNum(totO)}</td><td style="text-align:center">${fmtNum(totC)}</td><td style="text-align:center">${fmtNum(totR)} BYN</td><td>-</td></tr></tfoot>`;
    } else {
        ths = `<th>Год</th><th>Заказов</th><th>Завершено</th><th>Стоимость</th><th>Клиентов</th>`;
        rows = dynamics.map(d => `<tr><td style="text-align:center">${d.Year}</td><td style="text-align:center">${fmtNum(d.OrdersCount)}</td><td style="text-align:center">${fmtNum(d.CompletedCount)}</td><td style="text-align:center">${fmtNum(d.Revenue)} BYN</td><td style="text-align:center">${fmtNum(d.ClientsCount)}</td>`).join('');
    }
    html += `<div class="report-section"><h3>Динамика по периодам</h3><div class="report-table-wrap"><table class="report-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

if (orders.length) {
    const ths2 = `<th>№ договора</th><th>Дата</th><th>Клиент</th><th>Объект</th><th>Специалист</th><th>Статус</th><th>Сумма</th>`;
    const rows2 = orders.map(o => {
        const st = o.Status || '';
        const badge = st === 'Завершена' ? `<span class="badge-done">${st}</span>` : st === 'В работе' ? `<span class="badge-work">${st}</span>` : st === 'Новая' ? `<span class="badge-new">${st}</span>` : st === 'Отклонена' ? `<span class="badge-reject">${st}</span>` : `<span>${st}</span>`;
        return `<tr><td><strong>${escapeHtml(o.ContractNumber||'—')}</strong></td><td style="text-align:center">${fmtDate(o.SignDate)}</td><td>${escapeHtml(o.ClientName||'—')}</td><td>${escapeHtml(o.ObjectName||'—')}</td><td>${escapeHtml(o.SpecialistName||'—')}</td><td style="text-align:center">${badge}</td><td style="text-align:center">${fmtNum(o.TotalCost)} BYN</td></tr>`;
    }).join('');
    html += `<div class="report-section"><h3>Список заказов — всего: ${orders.length}</h3><div class="report-table-wrap"><table class="report-table"><thead><tr>${ths2}</tr></thead><tbody>${rows2}</tbody></table></div></div>`;
}

if (!html) html = `<div class="empty-state"><i class="fas fa-file-contract"></i><p>Нет заказов по заданным фильтрам</p></div>`;
html += `<div style="margin-top:20px;display:flex;justify-content:flex-end;"><button class="export-btn" onclick="exportOrdersReport()"><i class="fas fa-file-excel"></i> Экспорт в Excel</button></div>`;
container.innerHTML = html;
} catch(e) { console.error(e); container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки данных</p></div>`; }
}

async function exportClientsReport() {
const token = localStorage.getItem('token');
const dateFrom = document.getElementById('clientsReportDateFrom')?.value || getDateMonthsAgo(3);
const dateTo = document.getElementById('clientsReportDateTo')?.value || getCurrentDate();
const groupBy = document.getElementById('clientsReportGroupBy')?.value || 'month';
try {
const response = await fetch(`/api/admin/reports/export/clients?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) throw new Error('Ошибка экспорта');
const blob = await response.blob();
downloadBlob(blob, `Отчёт_клиенты_${dateFrom}_${dateTo}.xlsx`);
showToast('Файл Excel готов!', 'success');
} catch (error) { console.error('Ошибка экспорта:', error); showToast('Ошибка экспорта', 'error'); }
}

async function exportOrdersReport() {
const token = localStorage.getItem('token');
const dateFrom = document.getElementById('ordersReportDateFrom')?.value || getDateMonthsAgo(3);
const dateTo = document.getElementById('ordersReportDateTo')?.value || getCurrentDate();
const groupBy = document.getElementById('ordersReportGroupBy')?.value || 'month';
const status = document.getElementById('ordersReportStatusFilter')?.value || '';
const specialistId = document.getElementById('ordersReportSpecialistFilter')?.value || '';
try {
let url = `/api/admin/reports/export/orders?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`;
if (status) url += `&status=${encodeURIComponent(status)}`;
if (specialistId) url += `&specialistId=${specialistId}`;
const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
if (!response.ok) throw new Error('Ошибка экспорта');
const blob = await response.blob();
downloadBlob(blob, `Отчёт_заказы_${dateFrom}_${dateTo}.xlsx`);
showToast('Файл Excel готов!', 'success');
} catch (error) { console.error('Ошибка экспорта:', error); showToast('Ошибка экспорта', 'error'); }
}

function validateReportDates(type) {
const fromInput = document.getElementById(`${type}ReportDateFrom`);
const toInput = document.getElementById(`${type}ReportDateTo`);
if (!fromInput || !toInput) return true;
const dateFrom = fromInput.value, dateTo = toInput.value;
if (!dateFrom || !dateTo) return true;
const startDate = new Date(dateFrom), endDate = new Date(dateTo), today = new Date();
today.setHours(0,0,0,0);
if (startDate > endDate) { toInput.value = dateFrom; showToast('Дата окончания скорректирована', 'info'); return false; }
if (startDate > today) { fromInput.value = getCurrentDate(); showToast('Дата начала не может быть в будущем', 'error'); return false; }
return true;
}

function getDateMonthsAgo(months) { const d = new Date(); d.setMonth(d.getMonth() - months); return d.toISOString().split('T')[0]; }
function getCurrentDate() { return new Date().toISOString().split('T')[0]; }
function fmtNum(v) { if (v === null || v === undefined) return '0'; return Number(v).toLocaleString('ru-RU'); }
function fmtDate(v) { if (!v) return '—'; try { return new Date(v).toLocaleDateString('ru-RU'); } catch { return v; } }
function downloadBlob(blob, filename) { const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); }