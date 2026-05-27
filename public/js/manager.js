
// СОСТОЯНИЕ 
let currentTab = 'leads';
let currentLeadsFilter = 'Новая';
let currentPage = 1;
let currentOrdersPage = 1;
let searchTimeout;
let token = localStorage.getItem('token');
let currentApplicationId = null;
let currentOrderId = null;
let currentWorkId = null;
let workTypes = [];
let specialists = [];

//КОНСТАНТЫ
const POSITIONS = [
'Директор',
'Генеральный директор',
'Исполнительный директор',
'Коммерческий директор',
'Технический директор',
'Финансовый директор',
'Руководитель отдела',
'Начальник',
'Заместитель директора',
'Управляющий',
'Главный инженер',
'Прораб',
'Мастер'
];

function switchTab(tab) {
    currentTab = tab;
    
    // Обновляем активный пункт меню
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.menu-item').classList.add('active');
    
    // Обновляем заголовок
    const pageTitle = document.getElementById('pageTitle');
    
    if (tab === 'leads') {
        pageTitle.innerHTML = 'Управление заявками';
        
        // Показываем статистику и фильтры для заявок
        document.getElementById('leadsStats').style.display = 'grid';
        document.getElementById('leadsFilters').style.display = 'block';
        document.getElementById('ordersStats').style.display = 'none';
        document.getElementById('ordersFilters').style.display = 'none';
        
        // Показываем список заявок
        document.getElementById('leadsSection').style.display = 'block';
        document.getElementById('ordersSection').style.display = 'none';
        
        // Загружаем данные
        loadLeads(currentPage);
        loadLeadsStats();
    } else {
        pageTitle.innerHTML = 'Управление заказами';
        
        // Показываем статистику и фильтры для заказов
        document.getElementById('leadsStats').style.display = 'none';
        document.getElementById('leadsFilters').style.display = 'none';
        document.getElementById('ordersStats').style.display = 'grid';
        document.getElementById('ordersFilters').style.display = 'block';
        
        // Показываем список заказов
        document.getElementById('leadsSection').style.display = 'none';
        document.getElementById('ordersSection').style.display = 'block';
        
        // Загружаем данные
        loadOrders(currentOrdersPage);
        loadOrdersStats();
    }
}

//  ПРОВЕРКА АВТОРИЗАЦИИ
async function checkAuth() {
    if (!token) {
        window.location.href = '/admin/login';
        return false;
    }

    try {
        const response = await fetch('/api/manager/check-auth', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            localStorage.removeItem('token');
            window.location.href = '/admin/login';
            return false;
        }
        
        const data = await response.json();
        if (data.user?.name) {
            document.getElementById('userName').textContent = data.user.name;
        }
        return true;
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
        return false;
    }
}

// ЗАГРУЗКА СПРАВОЧНИКОВ
async function loadWorkTypes() {
    try {
        const response = await fetch('/api/work-types', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки видов работ');
        
        workTypes = await response.json();
        
        // Заполняем selects
        const editSelect = document.getElementById('editWorkTypeId');
        const addSelect = document.getElementById('addWorkTypeId');
        
        if (editSelect) {
            editSelect.innerHTML = '<option value="">Выберите вид работы</option>';
            workTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.WorkTypeID;
                option.textContent = `${type.WorkName}`;
                option.dataset.defaultDuration = type.DefaultDuration;
                option.dataset.baseCost = type.BaseCost;
                editSelect.appendChild(option);
            });
        }
        
        if (addSelect) {
            addSelect.innerHTML = '<option value="">Выберите вид работы</option>';
            workTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.WorkTypeID;
                option.textContent = `${type.WorkName}`;
                option.dataset.defaultDuration = type.DefaultDuration;
                option.dataset.baseCost = type.BaseCost;
                addSelect.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки видов работ:', error);
    }
}



async function loadSpecialists() {
    try {
        const response = await fetch('/api/specialists', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки специалистов');
        
        specialists = await response.json();
        
        // Заполняем selects
        const editSelect = document.getElementById('editResponsibleUser');
        const addSelect = document.getElementById('addResponsibleUser');
        
        const options = '<option value="">Не назначен</option>' + 
            specialists.map(s => `<option value="${s.UserID}">${escapeHtml(s.FullName)} (${s.Role === 'admin' ? 'Админ' : 'Специалист'})</option>`).join('');
        
        if (editSelect) editSelect.innerHTML = options;
        if (addSelect) addSelect.innerHTML = options;
        
    } catch (error) {
        console.error('Ошибка загрузки специалистов:', error);
    }
}
let selectedOrderForWork = null;

// Открыть модальное окно выбора работы
async function openWorkSelectionModal(orderId) {
selectedOrderForWork = orderId;
const modal = document.getElementById('workSelectionModal');
const listContainer = document.getElementById('workSelectionList');

listContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка работ...</div>';
modal.style.display = 'flex';

try {
const response = await fetch(`/api/manager/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки работ');

const data = await response.json();
const works = data.works || [];

if (works.length === 0) {
    listContainer.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>Нет добавленных работ</p>
            <small>Сначала добавьте работы через «Детали заказа»</small>
        </div>
    `;
    return;
}

listContainer.innerHTML = works.map(work => `
    <div class="work-selection-item" onclick="selectWorkAndOpenJournal(${work.WorkID}, ${orderId})">
        <div class="work-selection-icon">
            <i class="fas fa-hard-hat"></i>
        </div>
        <div class="work-selection-info">
            <strong>${escapeHtml(work.WorkName)}</strong>
            <div class="work-selection-meta">
                <span>${work.Quantity} ед.</span>
                <span>${work.Duration} дн.</span>
                <span class="status-badge ${work.Status === 'Выполнен' ? 'status-completed' : work.Status === 'В процессе' ? 'status-progress' : 'status-new'}">
                    ${work.Status || 'Не начат'}
                </span>
            </div>
        </div>
        <i class="fas fa-chevron-right work-selection-arrow"></i>
    </div>
`).join('');

} catch (error) {
console.error('Ошибка:', error);
listContainer.innerHTML = `<div class="error-state">Ошибка загрузки: ${error.message}</div>`;
}
}

// Закрыть промежуточное окно
function closeWorkSelectionModal() {
document.getElementById('workSelectionModal').style.display = 'none';
selectedOrderForWork = null;
}

// Выбрать работу и открыть журнал
function selectWorkAndOpenJournal(workId, orderId) {
closeWorkSelectionModal();
// Используем существующую функцию openWorkDetails
openWorkDetails(workId, orderId);
}

//  ЗАГРУЗКА ТИПОВ ОБЪЕКТОВ 
async function loadObjectTypes() {
    try {
        console.log('Загрузка типов объектов...');
        const response = await fetch('/api/object-types', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки типов объектов');
        
        const types = await response.json();
        console.log('Загружены типы:', types);

        window.objectTypes = types;
        
        return types;
    } catch (error) {
        console.error('Ошибка загрузки типов объектов:', error);
        window.objectTypes = [];
        return [];
    }
}

// ЗАГРУЗКА СТАТИСТИКИ ЗАЯВОК 
async function loadLeads(page = 1) {
const authOk = await checkAuth();
if (!authOk) return;

currentPage = page;

const leadsList = document.getElementById('leadsList');
const leadsLoading = document.getElementById('leadsLoading');
const leadsPagination = document.getElementById('leadsPagination');

leadsLoading.style.display = 'block';
leadsList.style.display = 'none';
leadsPagination.style.display = 'none';

try {
const searchTerm = document.getElementById('searchInput')?.value || '';
const sortBy = document.getElementById('leadsSortBy')?.value || 'createdAt_desc';

// Поиск ТОЛЬКО по имени и компании (убрали телефон и email)
const url = `/api/manager/applications?filter=${encodeURIComponent(currentLeadsFilter)}&page=${page}&sort=${encodeURIComponent(sortBy)}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}&searchFields=name,company` : ''}`;

const response = await fetch(url, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

if (!response.ok) {
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
        return;
    }
    throw new Error(`Ошибка HTTP: ${response.status}`);
}

const data = await response.json();

leadsLoading.style.display = 'none';

if (!data.leads || data.leads.length === 0) {
    leadsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>Нет заявок</h3>
            <p>По выбранному фильтру заявки не найдены</p>
        </div>
    `;
    leadsList.style.display = 'block';
    return;
}

displayLeads(data.leads);
if (data.pagination) {
    displayPagination(data.pagination, 'leads');
}

} catch (error) {
console.error('Ошибка загрузки заявок:', error);
leadsLoading.style.display = 'none';
leadsList.innerHTML = `
    <div class="empty-state error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Ошибка загрузки</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadLeads(1)">
            <i class="fas fa-redo"></i> Повторить
        </button>
    </div>
`;
leadsList.style.display = 'block';
}
}

async function loadLeadsStats() {
try {
const response = await fetch('/api/manager/stats', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

if (!response.ok) throw new Error('Ошибка загрузки статистики');

const stats = await response.json();

document.getElementById('totalLeads').textContent = stats.leads?.totalLeads || 0;
document.getElementById('newLeads').textContent = stats.leads?.newLeads || 0;
document.getElementById('contactedLeads').textContent = stats.leads?.contactedLeads || 0;
document.getElementById('inProgressLeads').textContent = stats.leads?.inProgressLeads || 0;
document.getElementById('completedLeads').textContent = stats.leads?.completedLeads || 0;
document.getElementById('rejectedLeads').textContent = stats.leads?.rejectedLeads || 0;
document.getElementById('leadsCount').textContent = stats.leads?.totalLeads || 0;

} catch (error) {
console.error('Ошибка загрузки статистики заявок:', error);
// Устанавливаем значения по умолчанию
document.getElementById('totalLeads').textContent = '0';
document.getElementById('newLeads').textContent = '0';
document.getElementById('contactedLeads').textContent = '0';
document.getElementById('inProgressLeads').textContent = '0';
document.getElementById('completedLeads').textContent = '0';
document.getElementById('rejectedLeads').textContent = '0';
document.getElementById('leadsCount').textContent = '0';
}
}

// ЗАГРУЗКА СТАТИСТИКИ ЗАКАЗОВ 
async function loadOrdersStats() {
    try {
        const response = await fetch('/api/manager/orders-stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки статистики заказов');
        
        const stats = await response.json();
        
        document.getElementById('totalOrders').textContent = stats.TotalOrders || 0;
        document.getElementById('inProgressOrders').textContent = stats.InProgressOrders || 0;
        document.getElementById('completedOrders').textContent = stats.CompletedOrders || 0;
        document.getElementById('totalRevenue').textContent = formatMoney(stats.TotalRevenue || 0);
        document.getElementById('ordersCount').textContent = stats.TotalOrders || 0;
        
    } catch (error) {
        console.error('Ошибка загрузки статистики заказов:', error);
        document.getElementById('totalOrders').textContent = '0';
        document.getElementById('inProgressOrders').textContent = '0';
        document.getElementById('completedOrders').textContent = '0';
        document.getElementById('totalRevenue').textContent = '0 ₽';
        document.getElementById('ordersCount').textContent = '0';
    }
}

// ЗАГРУЗКА ЗАЯВОК 
async function loadLeads(page = 1) {
const authOk = await checkAuth();
if (!authOk) return;

currentPage = page;

const leadsList = document.getElementById('leadsList');
const leadsLoading = document.getElementById('leadsLoading');
const leadsPagination = document.getElementById('leadsPagination');

leadsLoading.style.display = 'block';
leadsList.style.display = 'none';
leadsPagination.style.display = 'none';

try {
const searchTerm = document.getElementById('searchInput')?.value || '';
const sortBy = document.getElementById('leadsSortBy')?.value || 'createdAt_desc';

const url = `/api/manager/applications?filter=${encodeURIComponent(currentLeadsFilter)}&page=${page}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}&sort=${encodeURIComponent(sortBy)}`;

const response = await fetch(url, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

if (!response.ok) {
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
        return;
    }
    throw new Error(`Ошибка HTTP: ${response.status}`);
}

const data = await response.json();

leadsLoading.style.display = 'none';

if (!data.leads || data.leads.length === 0) {
    leadsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <h3>Нет заявок</h3>
            <p>По выбранному фильтру заявки не найдены</p>
        </div>
    `;
    leadsList.style.display = 'block';
    return;
}

displayLeads(data.leads);
if (data.pagination) {
    displayPagination(data.pagination, 'leads');
}

} catch (error) {
console.error('Ошибка загрузки заявок:', error);
leadsLoading.style.display = 'none';
leadsList.innerHTML = `
    <div class="empty-state error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Ошибка загрузки</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="loadLeads(1)">
            <i class="fas fa-redo"></i> Повторить
        </button>
    </div>
`;
leadsList.style.display = 'block';
}
}

// ==================== ОТОБРАЖЕНИЕ ЗАЯВОК ====================
function displayLeads(leads) {
const container = document.getElementById('leadsList');
if (!container) return;

if (!leads || leads.length === 0) {
container.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;">
        <i class="fas fa-inbox"></i>
        <h3>Нет заявок</h3>
        <p>По выбранному фильтру заявки не найдены</p>
    </div>
`;
container.style.display = 'grid';
return;
}

container.innerHTML = leads.map(lead => {
const date = lead.CreatedAt ? new Date(lead.CreatedAt).toLocaleString('ru-RU', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
}) : 'Дата не указана';

const statusClass = {
    'Новая': 'status-new',
    'На рассмотрении': 'status-contacted',
    'Одобрена': 'status-approved',
    'В работе': 'status-progress',
    'Завершена': 'status-completed',
    'Отклонена': 'status-rejected'
}[lead.Status] || '';

const statusText = lead.Status;

// заметки и сообщение
const hasMessage = lead.Message && lead.Message.trim();
const hasNotes = lead.Notes && lead.Notes.trim() && lead.Status !== 'Завершена';
const readonlyNotes = lead.Notes && lead.Notes.trim() && lead.Status === 'Завершена';

return `
    <div class="lead-card" id="lead-${lead.Id}" data-status="${lead.Status}">
        <div class="lead-card-header">
            <div class="lead-card-title">
                <h4>${escapeHtml(lead.Name)}</h4>
                <div class="lead-meta-grid">
                    ${lead.Phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(lead.Phone)}</span>` : ''}
                    ${lead.Email ? `<span><i class="fas fa-envelope"></i> ${escapeHtml(lead.Email)}</span>` : ''}
                    <span><i class="fas fa-calendar"></i> ${date}</span>
                    ${lead.CompanyName ? `<span><i class="fas fa-building"></i> ${escapeHtml(lead.CompanyName)}</span>` : ''}
                </div>
            </div>
            <span class="status-badge ${statusClass}">${statusText}</span>
        </div>

        <div class="lead-card-body">
            ${hasMessage ? `<div class="lead-message"><i class="fas fa-comment-dots"></i> ${escapeHtml(lead.Message)}</div>` : ''}
            
            ${hasNotes ? `<div class="lead-notes"><i class="fas fa-sticky-note"></i> <strong>Заметки:</strong> ${escapeHtml(lead.Notes)}</div>` : ''}
            ${readonlyNotes ? `<div class="lead-notes" style="background:#eef2ff;"><i class="fas fa-sticky-note"></i> <strong>Заметки (завершено):</strong> ${escapeHtml(lead.Notes)}</div>` : ''}
            
            ${lead.Address ? `<div style="font-size:0.75rem; color:#5f7d9c; margin-top:8px;"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(lead.Address)}</div>` : ''}
            ${lead.ObjectTypeName ? `<div style="font-size:0.75rem; color:#5f7d9c; margin-top:4px;"><i class="fas fa-building"></i> Тип объекта: ${escapeHtml(lead.ObjectTypeName)}</div>` : ''}
        </div>

        <div class="lead-card-footer">
            <div class="lead-actions-group">
                ${lead.Status === 'Новая' ? `
                    <button class="btn btn-contact btn-sm" onclick="updateLeadStatus(${lead.Id}, 'На рассмотрении')">
                        <i class="fas fa-phone"></i> Связались
                    </button>
                ` : ''}
                
                ${lead.Status === 'На рассмотрении' ? `
                    <button class="btn btn-approve btn-sm" onclick="quickApproveLead(${lead.Id})">
                        <i class="fas fa-check-circle"></i> Одобрить
                    </button>
                ` : ''}
                
                ${lead.Status === 'В работе' ? `
                    <button class="btn btn-complete btn-sm" onclick="updateLeadStatus(${lead.Id}, 'Завершена')">
                        <i class="fas fa-check"></i> Завершить
                    </button>
                ` : ''}
                
                ${!['Завершена', 'Отклонена', 'В работе'].includes(lead.Status) ? `
                    <button class="btn btn-reject btn-sm" onclick="updateLeadStatus(${lead.Id}, 'Отклонена')">
                        <i class="fas fa-times"></i> Отклонить
                    </button>
                ` : ''}

                ${lead.Status !== 'Завершена' ? `
                    <button class="btn btn-notes btn-sm" onclick="showNotesForm(${lead.Id})">
                        <i class="fas fa-sticky-note"></i> ${lead.Notes ? 'Изменить заметки' : 'Добавить заметки'}
                    </button>
                ` : ''}

                ${lead.Status === 'Завершена' && lead.OrderID ? `
                    <button class="btn btn-info btn-sm" onclick="showLeadOrderInfo(${lead.Id}, ${lead.OrderID})">
                        <i class="fas fa-info-circle"></i> Информация
                    </button>
                ` : ''}
            </div>
        </div>

        <div id="notes-form-${lead.Id}" class="notes-form" style="display: none; margin: 0 18px 16px 18px;">
            <textarea id="notes-text-${lead.Id}" class="notes-textarea" placeholder="Введите заметки по заявке...">${escapeHtml(lead.Notes || '')}</textarea>
            <div class="notes-actions" style="margin-top: 8px;">
                <button class="btn btn-save btn-sm" onclick="saveNotes(${lead.Id})">
                    <i class="fas fa-save"></i> Сохранить
                </button>
                <button class="btn btn-cancel btn-sm" onclick="hideNotesForm(${lead.Id})">
                    <i class="fas fa-times"></i> Отмена
                </button>
            </div>
        </div>
    </div>
`;
}).join('');

container.style.display = 'grid';
}
// Функция для показа информации о заказе из завершенной заявки
async function showLeadOrderInfo(leadId, orderId) {
if (!orderId) {
showToast('ID заказа не найден', 'error');
return;
}

try {
showToast('Загрузка информации...', 'info');

const response = await fetch(`/api/manager/orders/${orderId}`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

if (!response.ok) throw new Error('Ошибка загрузки заказа');

const data = await response.json();
const order = data.order;
const works = data.works || [];

// Формируем HTML для модального окна
let worksHtml = '';
if (works.length > 0) {
    worksHtml = `
        <div class="form-section">
            <h3>Работы по заказу</h3>
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Работа</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Кол-во</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Цена</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Сумма</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${works.map(work => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(work.WorkName)}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${work.Quantity}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${formatMoney(work.UnitCost)}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${formatMoney(work.TotalCost)}</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${work.Status || 'Не начат'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Создаем модальное окно
const modalContent = `
<div id="leadOrderInfoModal" class="modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
<div class="modal-content" style="max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; background: white; border-radius: 12px;">
    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #ddd;">
        <h2 style="margin: 0;"><i class="fas fa-clipboard-list"></i> Информация о заказе</h2>
        <button class="modal-close" onclick="closeLeadOrderInfoModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
    </div>
    <div class="modal-body" style="padding: 20px;">
        <div class="form-section" style="margin-bottom: 20px;">
            <h3 style="margin-top: 0;">Основная информация</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><strong>Номер заказа:</strong> ${escapeHtml(order.OrderNumber || order.ContractNumber || '—')}</div>
                <div><strong>Статус:</strong> ${order.Status || '—'}</div>
                <div><strong>Дата создания:</strong> ${order.CreatedAt ? new Date(order.CreatedAt).toLocaleDateString('ru-RU') : '—'}</div>
                <div><strong>Общая стоимость:</strong> ${formatMoney(order.TotalCost || 0)}</div>
            </div>
        </div>
        
        <div class="form-section" style="margin-bottom: 20px;">
            <h3>Клиент</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><strong>Организация:</strong> ${escapeHtml(order.CompanyName || '—')}</div>
                <div><strong>УНП:</strong> ${escapeHtml(order.UNP || '—')}</div>
                <div><strong>ФИО представителя:</strong> ${escapeHtml(order.DirectorName || '—')}</div>
                <div><strong>Телефон:</strong> ${escapeHtml(order.ClientPhone || '—')}</div>
                <div><strong>Email:</strong> ${escapeHtml(order.ClientEmail || '—')}</div>
            </div>
        </div>
        
        <div class="form-section" style="margin-bottom: 20px;">
            <h3>Объект</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><strong>Название объекта:</strong> ${escapeHtml(order.ObjectName || '—')}</div>
                <div><strong>Тип объекта:</strong> ${escapeHtml(order.ObjectType || '—')}</div>
                <div><strong>Адрес:</strong> ${escapeHtml(order.ObjectAddress || '—')}</div>
            </div>
            ${order.ObjectDescription ? `<div><strong>Описание:</strong> ${escapeHtml(order.ObjectDescription)}</div>` : ''}
        </div>
        
        ${worksHtml}
        
        ${order.Notes ? `
            <div class="form-section">
                <h3>Заметки</h3>
                <p>${escapeHtml(order.Notes)}</p>
            </div>
        ` : ''}

        <!-- СЕКЦИЯ ДОГОВОРА -->
        <div class="form-section" style="margin-bottom: 0;">
            <h3 style="display: flex; align-items: center; justify-content: space-between;">
                <span><i class="fas fa-file-contract"></i> Договор</span>
                <button 
                    class="btn btn-success btn-sm" 
                    onclick="downloadLeadOrderContract(${orderId})"
                    style="font-size: 13px;">
                    <i class="fas fa-download"></i> Скачать DOCX
                </button>
            </h3>
            <div id="leadOrderContractIframeWrap" style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; height: 420px; position: relative;">
                <div id="leadOrderContractLoading" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8f9fa; gap: 10px; color: #6c757d;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <span>Загрузка договора...</span>
                </div>
                <iframe 
                    id="leadOrderContractIframe"
                    style="width: 100%; height: 100%; border: none; display: none;"
                    sandbox="allow-same-origin allow-scripts allow-modals">
                </iframe>
            </div>
        </div>
    </div>
    
    <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid #ddd; text-align: right;">
        <button class="btn btn-secondary" onclick="closeLeadOrderInfoModal()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            <i class="fas fa-times"></i> Закрыть
        </button>
    </div>
</div>
</div>
`;

// Удаляем старое модальное окно, если есть
const existingModal = document.getElementById('leadOrderInfoModal');
if (existingModal) existingModal.remove();

// Добавляем новое
document.body.insertAdjacentHTML('beforeend', modalContent);
loadLeadOrderContractPreview(orderId);
} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка при загрузке заказа', 'error');
}
}
// Загрузка превью договора в iframe внутри leadOrderInfoModal
async function loadLeadOrderContractPreview(orderId) {
try {
const response = await fetch(`/api/manager/orders/${orderId}/contract-preview-page`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const loading = document.getElementById('leadOrderContractLoading');
const iframe  = document.getElementById('leadOrderContractIframe');

if (!response.ok) throw new Error('Ошибка загрузки договора');

const html = await response.text();

if (loading) loading.style.display = 'none';
if (iframe) {
    iframe.srcdoc = html;
    iframe.style.display = 'block';
}
} catch (error) {
const loading = document.getElementById('leadOrderContractLoading');
if (loading) {
    loading.innerHTML = `
        <i class="fas fa-exclamation-triangle fa-2x" style="color: #e53935;"></i>
        <span style="color: #e53935;">Не удалось загрузить договор</span>
        <small style="color: #999;">${error.message}</small>
    `;
}
}
}

// Скачивание DOCX договора из leadOrderInfoModal
async function downloadLeadOrderContract(orderId) {
try {
showToast('Подготовка документа...', 'info');

const response = await fetch(`/api/manager/orders/${orderId}/contract/download`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка скачивания');

const blob = await response.blob();
const url  = window.URL.createObjectURL(blob);
const a    = document.createElement('a');
a.href     = url;

const disposition = response.headers.get('Content-Disposition');
let filename = 'contract.docx';
if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) filename = match[1].replace(/['"]/g, '');
}
filename  = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
a.download = filename;

document.body.appendChild(a);
a.click();
setTimeout(() => { window.URL.revokeObjectURL(url); a.remove(); }, 100);

showToast('Договор скачан', 'success');
} catch (error) {
showToast(error.message, 'error');
}
}

// Функция закрытия модального окна
function closeLeadOrderInfoModal() {
const modal = document.getElementById('leadOrderInfoModal');
if (modal) modal.remove();
}

// ==================== ЗАГРУЗКА ЗАКАЗОВ ====================
async function loadOrders(page = 1) {
    const authOk = await checkAuth();
    if (!authOk) return;
    
    currentOrdersPage = page;
    
    const ordersList = document.getElementById('ordersList');
    const ordersLoading = document.getElementById('ordersLoading');
    const ordersPagination = document.getElementById('ordersPagination');
    
    ordersLoading.style.display = 'block';
    ordersList.style.display = 'none';
    ordersPagination.style.display = 'none';
    
    try {
        const searchTerm = document.getElementById('ordersSearchInput')?.value || '';
        const url = `/api/manager/orders?page=${page}&search=${encodeURIComponent(searchTerm)}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/admin/login';
                return;
            }
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        ordersLoading.style.display = 'none';
        
        if (!data.orders || data.orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Нет заказов</h3>
                    <p>Заказы появляются после одобрения заявок</p>
                </div>
            `;
            ordersList.style.display = 'block';
            return;
        }
        
        displayOrders(data.orders);
        if (data.pagination) {
            displayPagination(data.pagination, 'orders');
        }
        
        // Обновляем счетчик в сайдбаре
        document.getElementById('ordersCount').textContent = data.pagination?.totalCount || data.orders.length;
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        ordersLoading.style.display = 'none';
        ordersList.innerHTML = `
            <div class="empty-state error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadOrders(1)">
                    <i class="fas fa-redo"></i> Повторить
                </button>
            </div>
        `;
        ordersList.style.display = 'block';
    }
}

// ==================== ОТОБРАЖЕНИЕ ЗАКАЗОВ ====================
function displayOrders(orders) {
    const ordersList = document.getElementById('ordersList');
    
    ordersList.innerHTML = orders.map(order => {
        const date = order.CreatedAt ? new Date(order.CreatedAt).toLocaleDateString('ru-RU') : 'Дата не указана';
        
        const statusClass = order.Status === 'В работе' ? 'status-order-work' : 'status-order-completed';
        const progress = order.ProgressPercent || 0;
        
        return `
            <div class="order-item" id="order-${order.Id}">
                <div class="order-header">
                    <div class="order-info">
                        <h4>${escapeHtml(order.OrderNumber || 'Без номера')}</h4>
                        <div class="order-meta">
                            <span><i class="fas fa-building"></i> ${escapeHtml(order.CompanyName || order.ClientName || 'Клиент не указан')}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(order.ObjectName || 'Объект не указан')}</span>
                            <span><i class="fas fa-calendar"></i> ${date}</span>
                            ${order.TotalCost ? `<span><i class="fas fa-money-bill-wave"></i> ${formatMoney(order.TotalCost)}</span>` : ''}
                            <span><i class="fas fa-tasks"></i> ${order.CompletedWorks || 0}/${order.TotalWorks || 0} работ</span>
                        </div>
                    </div>
                    <span class="status-badge ${statusClass}">
                        ${order.Status}
                    </span>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="progress-text">${progress}% выполнено</div>
                
                <div class="order-actions">
                   <button class="btn btn-view" onclick="viewOrderDetails(${order.OrderID})">
                        <i class="fas fa-eye"></i> Детали заказа
                    </button>
                        <button class="btn btn-journal-card" onclick="openWorkSelectionModal(${order.OrderID})">
<i class="fas fa-clipboard-list"></i> Журнал работ
</button>
                </div>
            </div>
        `;
    }).join('');
    
    ordersList.style.display = 'block';
}

// ==================== ПРОСМОТР ДЕТАЛЕЙ ЗАКАЗА ====================
async function viewOrderDetails(orderId) {
currentOrderId = orderId;

try {
const id = parseInt(orderId);
if (isNaN(id)) {
    showToast('Ошибка: неверный ID заказа', 'error');
    return;
}

const response = await fetch(`/api/manager/orders/${id}`, {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

if (!response.ok) throw new Error('Ошибка загрузки деталей заказа');

const data = await response.json();
const order = data.order;
const works = data.works || [];
const details = data.details || {};

// Получаем текущую должность из данных заказа
const currentPosition = order.DirectorPosition || '';
console.log('Данные заказа:', order);
console.log('ФИО из БД:', {
    lastName: order.DirectorLastName,
    firstName: order.DirectorFirstName,
    patronymic: order.DirectorPatronymic
});

// Формируем опции для select
const positionsList = [
    'Директор',
    'Генеральный директор',
    'Исполнительный директор',
    'Коммерческий директор',
    'Технический директор',
    'Финансовый директор',
    'Руководитель отдела',
    'Начальник',
    'Заместитель директора',
    'Управляющий',
    'Главный инженер',
    'Прораб',
    'Мастер'
];

const positionsOptions = positionsList.map(pos => 
    `<option value="${escapeHtml(pos)}" ${currentPosition === pos ? 'selected' : ''}>${escapeHtml(pos)}</option>`
).join('');

// Формируем опции для типа объекта
const objectTypesList = window.objectTypes || [];
const objectTypeOptions = objectTypesList.map(type => 
    `<option value="${escapeHtml(type.TypeName)}" ${order.ObjectType === type.TypeName ? 'selected' : ''}>${escapeHtml(type.TypeName)}</option>`
).join('');

const modalContent = document.getElementById('orderDetailsContent');
console.log('StartDate:', order.StartDate, details.StartDate);
console.log('EndDate:', order.EndDate, details.EndDate);
modalContent.innerHTML = `
    <div class="form-section">
        <h3>
            Информация о заказе
            <div class="section-actions">
                <button class="btn btn-edit btn-sm" onclick="editOrder(${orderId})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
        </h3>
        <div class="form-row">
            <div class="form-group">
                <label>Номер заказа</label>
                <input type="text" class="form-control" id="editContractNumber" value="${escapeHtml(order.OrderNumber || order.ContractNumber || '')}" readonly>
            </div>
            <div class="form-group">
                <label>Статус</label>
                <select class="form-control" id="editOrderStatus" disabled>
                    <option value="В работе" ${order.Status === 'В работе' ? 'selected' : ''}>В работе</option>
                    <option value="Завершена" ${order.Status === 'Завершена' ? 'selected' : ''}>Завершена</option>
                </select>
            </div>
            <div class="form-group">
                <label>Дата создания</label>
                <input type="text" class="form-control" value="${order.CreatedAt ? new Date(order.CreatedAt).toLocaleDateString('ru-RU') : ''}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Дата договора</label>
                <input type="date" class="form-control" id="editSignDate" value="${order.SignDate || ''}" readonly>
            </div>
            <div class="form-group">
                <label>Город</label>
                <input type="text" class="form-control" id="editCity" value="${escapeHtml(order.City || '')}" readonly>
            </div>
            <div class="form-group">
                <label>Общая стоимость</label>
                <div class="form-control-static" style="padding: 8px 12px; background: #f5f5f5; border-radius: 4px; font-weight: bold;">
                    ${formatMoney(order.TotalCost || 0)}
                </div>
            </div>
        </div>
    </div>

    <div class="form-section">
        <h3>
            Информация о клиенте
            <div class="section-actions">
                <button class="btn btn-edit btn-sm" onclick="editClient(${orderId})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
        </h3>
        <div class="form-row">
            <div class="form-group">
                <label>Наименование организации</label>
                <input type="text" class="form-control" id="editCompanyName" value="${escapeHtml(order.CompanyName || '')}" readonly>
            </div>
            <div class="form-group">
                <label>УНП</label>
                <input type="text" class="form-control" id="editUNP" value="${escapeHtml(order.UNP || '')}" readonly>
            </div>
            <div class="form-group">
                <label>ОКПО</label>  
                <input type="text" class="form-control" id="editOKPO" value="${escapeHtml(order.OKPO || '')}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Фамилия представителя</label>
                <input type="text" class="form-control" id="editDirectorLastName" value="${escapeHtml(order.DirectorLastName || '')}" placeholder="Введите фамилию" readonly>
            </div>
            <div class="form-group">
                <label>Имя представителя</label>
                <input type="text" class="form-control" id="editDirectorFirstName" value="${escapeHtml(order.DirectorFirstName || '')}" placeholder="Введите имя" readonly>
            </div>
            <div class="form-group">
                <label>Отчество представителя</label>
                <input type="text" class="form-control" id="editDirectorPatronymic" value="${escapeHtml(order.DirectorPatronymic || '')}" placeholder="Введите отчество" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Должность представителя</label>
                <select class="form-control" id="editDirectorPosition" disabled>
                    <option value="">Выберите должность...</option>
                    ${positionsOptions}
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Юридический адрес</label>
                <input type="text" class="form-control" id="editLegalAddress" value="${escapeHtml(order.LegalAddress || '')}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="editClientEmail" value="${escapeHtml(order.ClientEmail || '')}" readonly>
            </div>
            <div class="form-group">
                <label>Телефон</label>
                <input type="text" class="form-control" id="editClientPhone" value="${escapeHtml(order.ClientPhone || '')}" readonly>
            </div>
        </div>
    </div>

    <!-- БАНКОВСКИЕ РЕКВИЗИТЫ -->
    <div class="form-section">
        <h3>
            Банковские реквизиты
            <div class="section-actions">
                <button class="btn btn-edit btn-sm" onclick="editBankDetails(${orderId})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
        </h3>
        <div class="form-row">
            <div class="form-group">
                <label>Название банка</label>
                <input type="text" class="form-control" id="editBankName" value="${escapeHtml(order.BankName || '')}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Расчетный счет</label>
                <input type="text" class="form-control" id="editBankAccount" value="${escapeHtml(order.BankAccount || '')}" readonly>
            </div>
            <div class="form-group">
                <label>БИК банка</label>
                <input type="text" class="form-control" id="editBankBIC" value="${escapeHtml(order.BankBIC || '')}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>
                    <input type="checkbox" id="editBankIsPrimary" disabled ${order.BankIsPrimary ? 'checked' : ''}>
                    Основные реквизиты
                </label>
            </div>
        </div>
    </div>
   
    <div class="form-section">
        <h3>
            Информация об объекте
            <div class="section-actions">
                <button class="btn btn-edit btn-sm" onclick="editObject(${orderId})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
        </h3>
        <div class="form-row">
            <div class="form-group">
                <label>Название объекта</label>
                <input type="text" class="form-control" id="editObjectName" value="${escapeHtml(order.ObjectName || '')}" readonly>
            </div>
            <div class="form-group">
                <label>Тип объекта</label>
                <select class="form-control" id="editObjectType" disabled>
                    <option value="">Выберите тип объекта...</option>
                    ${objectTypeOptions}
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Адрес объекта</label>
                <input type="text" class="form-control" id="editObjectAddress" value="${escapeHtml(order.ObjectAddress || '')}" readonly>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Описание</label>
                <textarea class="form-control" id="editObjectDescription" rows="3" readonly>${escapeHtml(order.ObjectDescription || '')}</textarea>
            </div>
        </div>
    </div>

    
    <div class="form-section">
        <h3>
            Детали договора
            <div class="section-actions">
                <button class="btn btn-edit btn-sm" onclick="editContractDetails(${orderId})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
            </div>
        </h3>
        <div class="form-row">
<div class="form-group">
<label>Дата начала работ</label>
<input type="date" class="form-control" id="editStartDate" 
value="${details.StartDate || order.StartDate || ''}" readonly>
</div>
<div class="form-group">
<label>Дата окончания работ</label>
<input type="date" class="form-control" id="editEndDate" 
value="${details.EndDate || order.EndDate || ''}" readonly>
</div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Стоимость без НДС</label>
                <input type="number" class="form-control" id="editCostWithoutVAT" value="${details.CostWithoutVAT || 0}" step="0.01" readonly>
            </div>
            <div class="form-group">
                <label>Ставка НДС</label>
                <select class="form-control" id="editVATRate" disabled>
                    <option value="0" ${details.VATRate == 0 ? 'selected' : ''}>0%</option>
                    <option value="10" ${details.VATRate == 10 ? 'selected' : ''}>10%</option>
                    <option value="20" ${details.VATRate == 20 ? 'selected' : ''}>20%</option>
                </select>
            </div>
            <div class="form-group">
                <label>Сумма НДС</label>
                <input type="number" class="form-control" id="editVATAmount" value="${details.VATAmount || 0}" step="0.01" readonly>
            </div>
        </div>
        ${details.TotalCostWords ? `
        <div class="form-row">
            <div class="form-group">
                <label>Сумма прописью</label>
                <textarea class="form-control" id="editTotalCostWords" rows="2" readonly>${escapeHtml(details.TotalCostWords)}</textarea>
            </div>
        </div>
        ` : ''}
        ${details.VATAmountWords ? `
        <div class="form-row">
            <div class="form-group">
                <label>Сумма НДС прописью</label>
                <textarea class="form-control" id="editVATAmountWords" rows="2" readonly>${escapeHtml(details.VATAmountWords)}</textarea>
            </div>
        </div>
        ` : ''}
        ${details.PaymentSchedule ? `
        <div class="form-row">
            <div class="form-group">
                <label>График платежей</label>
                <textarea class="form-control" id="editPaymentSchedule" rows="3" readonly>${escapeHtml(details.PaymentSchedule)}</textarea>
            </div>
        </div>
        ` : ''}
    </div>
    

    <div class="form-section">
        <h3>
            Работы по заказу
            <div class="section-actions">
                <button class="btn btn-sm" style="background: #ff9800; color: white;" onclick="suggestDurations()">
                    <i class="fas fa-magic"></i> Рассчитать оптимально
                </button>
                <button class="btn btn-add btn-sm" onclick="showAddWorkModal(${orderId})">
                    <i class="fas fa-plus"></i> Добавить сведения о работе
                </button>
            </div>
        </h3>
        ${works.length > 0 ? `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Работа</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>Сумма</th>
                        <th>Срок</th>
                        <th>Ответственный</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${works.map(work => `
                        <tr>
                            <td>${escapeHtml(work.WorkName)}</td>
                            <td>${work.Quantity}</td>
                            <td>${formatMoney(work.UnitCost)}</td>
                            <td>${formatMoney(work.TotalCost)}</td>
                            <td>${work.Duration} дн.</td>
                            <td>${escapeHtml(work.ResponsibleName || 'Не назначен')}</td>
                            <td>
                                <span class="status-badge ${work.Status === 'Выполнен' ? 'status-completed' : work.Status === 'В процессе' ? 'status-progress' : 'status-new'}">
                                    ${work.Status || 'Не начат'}
                                </span>
                            </td>

                            <td class="actions">
                                <button class="btn btn-edit btn-sm" onclick="editWork(${work.WorkID}, ${orderId})" title="Редактировать">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteWork(${work.WorkID}, ${orderId})" title="Удалить">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                         </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>Нет добавленных работ</p>'}
    </div>

    ${order.Notes ? `
    <div class="form-section">
        <h3>Заметки</h3>
        <div class="form-row">
            <div class="form-group">
                <textarea class="form-control" id="editOrderNotes" rows="3" readonly>${escapeHtml(order.Notes)}</textarea>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="form-section">
        <div class="form-row">
            <div class="form-group">
                <button class="btn btn-success" onclick="saveAllChanges(${orderId})" style="width: 100%;">
                    <i class="fas fa-save"></i> Сохранить все изменения
                </button>
            </div>
        </div>
    </div>
    <div class="form-section">
        <h3>
            Документы
            <div class="section-actions">
                <button class="btn btn-primary btn-sm" onclick="generateContract(${orderId})">
                    <i class="fas fa-file-contract"></i> Сформировать договор
                </button>
            </div>
        </h3>
        <p>Нажмите кнопку для просмотра и скачивания договора в формате DOC</p>
    </div>
`;
showAddressFormatHint('editObjectAddress');
showAddressFormatHint('editLegalAddress');
// Сохраняем данные заказа в глобальную переменную
window.currentOrderData = order;

document.getElementById('orderViewModal').style.display = 'flex';

} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка загрузки деталей заказа', 'error');
}
}

async function loadBankDetailsForOrder(companyId) {
    if (!companyId) return;
    
    try {
        const response = await fetch(`/api/companies/${companyId}/bank-details`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const details = await response.json();
            
            if (details && details.length > 0) {
                const primary = details.find(d => d.IsPrimary) || details[0];
                
                // Сохраняем в глобальные переменные для последующего использования
                window.currentBankDetails = details;
                
                // Если поля уже существуют в DOM, заполняем их
                const bankNameField = document.getElementById('editBankName');
                const bankAccountField = document.getElementById('editBankAccount');
                const bankBICField = document.getElementById('editBankBIC');
                const bankIsPrimaryField = document.getElementById('editBankIsPrimary');
                
                if (bankNameField) bankNameField.value = primary.BankName || '';
                if (bankAccountField) bankAccountField.value = primary.BankAccount || '';
                if (bankBICField) bankBICField.value = primary.BankBIC || '';
                if (bankIsPrimaryField) bankIsPrimaryField.checked = primary.IsPrimary || false;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки банковских реквизитов:', error);
    }
}

function editBankDetails(orderId) {
    enableEditing(['editBankName', 'editBankAccount', 'editBankBIC', 'editBankIsPrimary']);
    
    // Делаем чекбокс редактируемым
    const bankIsPrimary = document.getElementById('editBankIsPrimary');
    if (bankIsPrimary) {
        bankIsPrimary.disabled = false;
        bankIsPrimary.removeAttribute('readonly');
    }
    
    showToast('Режим редактирования банковских реквизитов активирован', 'info');
}

// ==================== ФУНКЦИИ РЕДАКТИРОВАНИЯ ====================
function editOrder(orderId) {
    enableEditing(['editContractNumber', 'editOrderStatus', 'editSignDate', 'editCity']);
    showToast('Режим редактирования заказа активирован', 'info');
}
function editClient(orderId) {
enableEditing([
'editCompanyName', 
'editUNP', 
'editOKPO', 
'editDirectorLastName', 
'editDirectorFirstName', 
'editDirectorPatronymic', 
'editLegalAddress', 
'editClientEmail', 
'editClientPhone'
]);

// Для select просто убираем disabled
const positionSelect = document.getElementById('editDirectorPosition');
if (positionSelect) {
positionSelect.disabled = false;
}

showToast('Режим редактирования клиента активирован', 'info');
}

function editObject(orderId) {
    enableEditing(['editObjectName', 'editObjectAddress', 'editObjectDescription']);
    
    // Для select просто убираем disabled
    const objectTypeSelect = document.getElementById('editObjectType');
    if (objectTypeSelect) {
        objectTypeSelect.disabled = false;
    }
    
    showToast('Режим редактирования объекта активирован', 'info');
}

function editContractDetails(orderId) {
    enableEditing(['editStartDate', 'editEndDate', 'editCostWithoutVAT', 'editVATRate', 'editVATAmount', 'editTotalCostWords', 'editPaymentSchedule']);
    // Добавляем обработчик для автоматического расчета НДС
    document.getElementById('editCostWithoutVAT').addEventListener('input', calculateVAT);
    document.getElementById('editVATRate').addEventListener('change', calculateVAT);
    showToast('Режим редактирования деталей договора активирован', 'info');
}

function enableEditing(fieldIds) {
fieldIds.forEach(id => {
const field = document.getElementById(id);
if (field) {
    if (field.tagName === 'SELECT') {
        field.disabled = false;
    } else {
        field.readOnly = false;
        field.disabled = false;
    }
    field.classList.add('editable');
}
});
}

function calculateVAT() {
    const costWithoutVAT = parseFloat(document.getElementById('editCostWithoutVAT').value) || 0;
    const vatRate = parseInt(document.getElementById('editVATRate').value) || 0;
    const vatAmount = costWithoutVAT * vatRate / 100;
    const totalCost = costWithoutVAT + vatAmount;
    
    document.getElementById('editVATAmount').value = vatAmount.toFixed(2);
    document.getElementById('editTotalCost').value = formatMoney(totalCost);
}

// ==================== РАБОТЫ ====================
function showAddWorkModal(orderId) {

    // Скрываем поле ответственного при добавлении
const responsibleGroup = document.getElementById('addResponsibleUser')?.closest('.form-group');
if (responsibleGroup) responsibleGroup.style.display = 'none';
    document.getElementById('addOrderId').value = orderId;
    document.getElementById('addWorkModal').style.display = 'flex';
    
    // Устанавливаем значения по умолчанию
    document.getElementById('addQuantity').value = '1';
    document.getElementById('addDuration').value = '1';
    document.getElementById('addUnitCost').value = '';
    document.getElementById('addWorkComment').value = '';
}

function closeAddWorkModal() {
    document.getElementById('addWorkModal').style.display = 'none';
}

async function addWork() {
    const orderId = document.getElementById('addOrderId').value;
    const workTypeId = document.getElementById('addWorkTypeId').value;
    const quantity = document.getElementById('addQuantity').value;
    const unitCost = document.getElementById('addUnitCost').value;
    const duration = document.getElementById('addDuration').value;
  
    const comment = document.getElementById('addWorkComment').value;
    
    // Валидация
    const workData = {
        workTypeId,
        quantity,
        unitCost,
        duration
    };
    
    const validation = validateWorkData(workData);
    if (!validation.valid) {
        showValidationErrors(validation.errors);
        return;
    }
    
    try {
       
        
        const response = await fetch(`/api/manager/orders/${orderId}/works`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                workTypeId: parseInt(workTypeId),
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost),
                duration: parseInt(duration),
                comment: comment
            })
        });
        
        if (!response.ok) throw new Error('Ошибка при добавлении работы');
        
        showToast('Работа успешно добавлена!', 'success');
        closeAddWorkModal();
        await autoUpdateEndDate(orderId);

        await viewOrderDetails(orderId); // Перезагружаем детали заказа
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast(error.message, 'error');
    }
}

async function editWork(workId, orderId) {
    currentWorkId = workId;
    
    try {
        // Загружаем данные работы
        const response = await fetch(`/api/manager/works/${workId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки данных работы');
        
        const work = await response.json();
        
        document.getElementById('editWorkId').value = workId;
        document.getElementById('editOrderId').value = orderId;
        document.getElementById('editWorkTypeId').value = work.WorkTypeID;
        document.getElementById('editQuantity').value = work.Quantity;
        document.getElementById('editUnitCost').value = work.UnitCost;
        document.getElementById('editDuration').value = work.Duration;
        document.getElementById('editResponsibleUser').value = work.ResponsibleUserID || '';
        document.getElementById('editWorkStatus').value = work.Status;
        document.getElementById('editWorkComment').value = work.Comment || '';
        
        document.getElementById('editWorkModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка загрузки данных работы', 'error');
    }
}

function closeEditWorkModal() {
    document.getElementById('editWorkModal').style.display = 'none';
    currentWorkId = null;
}

async function saveWorkChanges() {
    const workId = document.getElementById('editWorkId').value;
    const orderId = document.getElementById('editOrderId').value;
    const workTypeId = document.getElementById('editWorkTypeId').value;
    const quantity = document.getElementById('editQuantity').value;
    const unitCost = document.getElementById('editUnitCost').value;
    const duration = document.getElementById('editDuration').value;
    const responsibleUserId = document.getElementById('editResponsibleUser').value;
    const status = document.getElementById('editWorkStatus').value;
    const comment = document.getElementById('editWorkComment').value;
    
    // Валидация
    const workData = {
        workTypeId,
        quantity,
        unitCost,
        duration
    };
    
    const validation = validateWorkData(workData);
    if (!validation.valid) {
        showValidationErrors(validation.errors);
        return;
    }
    
    try {
        showToast('Сохранение изменений...', 'info');
        
        const response = await fetch(`/api/manager/works/${workId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                workTypeId: parseInt(workTypeId),
                quantity: parseFloat(quantity),
                unitCost: parseFloat(unitCost),
                duration: parseInt(duration),
                responsibleUserId: responsibleUserId ? parseInt(responsibleUserId) : null,
                status: status,
                comment: comment
            })
        });
        
        if (!response.ok) throw new Error('Ошибка при сохранении работы');
        
        showToast(' Работа успешно обновлена!', 'success');
        closeEditWorkModal();
        await autoUpdateEndDate(orderId);

        await viewOrderDetails(orderId); // Перезагружаем детали заказа
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast( error.message, 'error');
    }
}

async function deleteWork(workId, orderId) {
    if (!confirm('Вы уверены, что хотите удалить эту работу?')) return;
    
    try {
        const response = await fetch(`/api/manager/works/${workId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка при удалении работы');
        
        showToast('Работа успешно удалена', 'success');
        await autoUpdateEndDate(orderId);
        viewOrderDetails(orderId); // Перезагружаем детали заказа
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка при удалении работы', 'error');
    }
}

// ==================== ВАЛИДАЦИЯ ДАННЫХ РАБОТЫ ====================
function validateWorkData(workData) {
const errors = [];

// Проверка вида работы
if (!workData.workTypeId || workData.workTypeId === '') {
errors.push('Выберите вид работы');
}

// Проверка количества
if (!workData.quantity || workData.quantity <= 0) {
errors.push('Количество должно быть больше 0');
} else if (isNaN(parseFloat(workData.quantity))) {
errors.push('Введите корректное количество');
}

// Проверка цены
if (!workData.unitCost || workData.unitCost < 0) {
errors.push('Цена должна быть неотрицательной');
} else if (isNaN(parseFloat(workData.unitCost))) {
errors.push('Введите корректную цену');
}

// Проверка длительности
if (!workData.duration || workData.duration <= 0) {
errors.push('Длительность должна быть больше 0');
} else if (isNaN(parseInt(workData.duration))) {
errors.push('Введите корректную длительность');
}

return {
valid: errors.length === 0,
errors: errors
};
}
// ==================== СОХРАНЕНИЕ ВСЕХ ИЗМЕНЕНИЙ ====================
async function saveAllChanges(orderId) {
try {
// Принудительно получаем значение чекбокса ДО лога
const primaryCheckbox = document.getElementById('editBankIsPrimary');
let isPrimaryValue = 0;
if (primaryCheckbox) {
    isPrimaryValue = primaryCheckbox.checked ? 1 : 0;
}
console.log('Отправляем bankIsPrimary:', isPrimaryValue);

console.log('Сохраняем изменения:', {
    companyName: document.getElementById('editCompanyName')?.value,
    unp: document.getElementById('editUNP')?.value,
    okpo: document.getElementById('editOKPO')?.value,
    bankName: document.getElementById('editBankName')?.value,
    bankAccount: document.getElementById('editBankAccount')?.value,
    bankBIC: document.getElementById('editBankBIC')?.value,
    bankIsPrimary: isPrimaryValue, 
    bankIsPrimaryRaw: document.getElementById('editBankIsPrimary')?.checked  
});

clearValidationErrors();

const newStatus = document.getElementById('editOrderStatus')?.value;
const currentStatus = window.currentOrderData?.Status;

// Если статус меняется на "Завершена"
if (newStatus === 'Завершена' && currentStatus !== 'Завершена') {
const checkResponse = await fetch(`/api/manager/orders/${orderId}`, {
headers: { 'Authorization': `Bearer ${token}` }
});

if (!checkResponse.ok) {
throw new Error('Не удалось проверить статус работ');
}

const checkData = await checkResponse.json();
const works = checkData.works || [];
const incompleteWorks = works.filter(w => (w.Status || 'Не начат') !== 'Выполнен');

if (incompleteWorks.length > 0) {
const confirmed = await showCompletionWarning(incompleteWorks);

if (!confirmed) {
    document.getElementById('editOrderStatus').value = currentStatus;
    showToast('Завершение заказа отменено', 'info');
    return;
}

// Приостанавливаем незавершенные работы
showToast('Приостановка незавершенных работ...', 'info');

for (const work of incompleteWorks) {
    await fetch(`/api/manager/works/${work.WorkID}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'Приостановлен' })
    });
}

showToast(` ${incompleteWorks.length} работ(а) приостановлены`, 'success');

// Добавляем запись в заметки
const notesField = document.getElementById('editOrderNotes');
const existingNotes = notesField?.value || '';
const note = `\n\n[${new Date().toLocaleString()}] Заказ завершен. Приостановлены работы: ${incompleteWorks.map(w => w.WorkName).join(', ')}`;
if (notesField) notesField.value = existingNotes + note;
}
}

// Собираем данные из всех полей
const orderData = {
    // Основная информация
    contractNumber: document.getElementById('editContractNumber')?.value,
    status: document.getElementById('editOrderStatus')?.value,
    signDate: document.getElementById('editSignDate')?.value,
    city: document.getElementById('editCity')?.value,
    
    // Информация о клиенте
    companyId: orderId,
    companyName: document.getElementById('editCompanyName')?.value,
    unp: document.getElementById('editUNP')?.value,
    okpo: document.getElementById('editOKPO')?.value,
    directorLastName: document.getElementById('editDirectorLastName')?.value,
    directorFirstName: document.getElementById('editDirectorFirstName')?.value,
    directorPatronymic: document.getElementById('editDirectorPatronymic')?.value,
    directorPosition: document.getElementById('editDirectorPosition')?.value,
    legalAddress: document.getElementById('editLegalAddress')?.value,
    clientEmail: document.getElementById('editClientEmail')?.value,
    clientPhone: document.getElementById('editClientPhone')?.value,
    
    // БАНКОВСКИЕ РЕКВИЗИТЫ
    bankName: document.getElementById('editBankName')?.value,
    bankAccount: document.getElementById('editBankAccount')?.value,
    bankBIC: document.getElementById('editBankBIC')?.value,
    bankIsPrimary: isPrimaryValue,
    
    // Информация об объекте
    objectName: document.getElementById('editObjectName')?.value,
    objectType: document.getElementById('editObjectType')?.disabled === false
        ? document.getElementById('editObjectType')?.value || null
        : null,
    objectAddress: document.getElementById('editObjectAddress')?.value,
    objectDescription: document.getElementById('editObjectDescription')?.value,
    
    // Детали договора
    startDate: document.getElementById('editStartDate')?.value,
    endDate: document.getElementById('editEndDate')?.value,
    costWithoutVAT: document.getElementById('editCostWithoutVAT')?.value,
    vatRate: document.getElementById('editVATRate')?.value,
    vatAmount: document.getElementById('editVATAmount')?.value,
    vatAmountWords: document.getElementById('editVATAmountWords')?.value,
    totalCostWords: document.getElementById('editTotalCostWords')?.value,
    paymentSchedule: document.getElementById('editPaymentSchedule')?.value,
    
    notes: document.getElementById('editOrderNotes')?.value
};

// Валидация данных
showToast('Проверка данных...', 'info');

const validation = await validateOrderData(orderData);

if (!validation.valid) {
    // Показываем ошибки под соответствующими полями
    validation.errors.forEach(error => {
        if (error.includes('ФИО')) {
            showFieldError('editDirectorName', error);
        } else if (error.includes('Должность')) {
            showFieldError('editDirectorPosition', error);
        } else if (error.includes('УНП')) {
            showFieldError('editUNP', error);
        } else if (error.includes('ОКПО')) {
            showFieldError('editOKPO', error);
        } else if (error.includes('Email')) {
            showFieldError('editClientEmail', error);
        } else if (error.includes('Телефон')) {
            showFieldError('editClientPhone', error);
        } else if (error.includes('Название организации')) {
            showFieldError('editCompanyName', error);
        } else if (error.includes('Юридический адрес')) {
            showFieldError('editLegalAddress', error);
        } else if (error.includes('Название объекта')) {
            showFieldError('editObjectName', error);
        } else if (error.includes('Адрес объекта')) {
            showFieldError('editObjectAddress', error);
        } else if (error.includes('Тип объекта')) {
            showFieldError('editObjectType', error);
        } else if (error.includes('Дата начала')) {
            showFieldError('editStartDate', error);
        } else if (error.includes('Дата окончания')) {
            showFieldError('editEndDate', error);
        } else if (error.includes('Стоимость')) {
            showFieldError('editCostWithoutVAT', error);
        } else if (error.includes('НДС')) {
            showFieldError('editVATRate', error);
        } else if (error.includes('банка')) {
            showFieldError('editBankName', error);
        } else if (error.includes('счет')) {
            showFieldError('editBankAccount', error);
        } else if (error.includes('БИК')) {
            showFieldError('editBankBIC', error);
        }
    });
    
    showValidationErrors(validation.errors);
    return;
}

showToast('Сохранение изменений...', 'info');

const response = await fetch(`/api/manager/orders/${orderId}`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
   body: JSON.stringify({
contractNumber: orderData.contractNumber,
status:         orderData.status,
signDate:       orderData.signDate,
city:           orderData.city,
notes:          orderData.notes,

companyName:      validation.data.companyName      ?? orderData.companyName,
unp:              validation.data.unp              ?? orderData.unp,
okpo:             validation.data.okpo             ?? orderData.okpo,
directorName:     validation.data.directorName     ?? orderData.directorName,
directorPosition: validation.data.directorPosition ?? orderData.directorPosition,
legalAddress:     validation.data.legalAddress     ?? orderData.legalAddress,
clientEmail:      validation.data.clientEmail      ?? orderData.clientEmail,
clientPhone:      validation.data.clientPhone      ?? orderData.clientPhone,

objectName:        validation.data.objectName        ?? orderData.objectName,
objectType:        validation.data.objectType        ?? orderData.objectType,
objectAddress:     validation.data.objectAddress     ?? orderData.objectAddress,
objectDescription: orderData.objectDescription,

bankName:      validation.data.bankName      ?? orderData.bankName,
bankAccount:   validation.data.bankAccount   ?? orderData.bankAccount,
bankBIC:       validation.data.bankBIC       ?? orderData.bankBIC,
bankIsPrimary: orderData.bankIsPrimary,

startDate:      validation.data.startDate      ?? orderData.startDate,
endDate:        validation.data.endDate        ?? orderData.endDate,
costWithoutVAT: validation.data.costWithoutVAT ?? orderData.costWithoutVAT,
vatRate:        validation.data.vatRate        ?? orderData.vatRate,
vatAmount: (() => {
const amt = parseFloat(orderData.vatAmount);
if (amt && amt > 0) return amt;
const cost = parseFloat(validation.data.costWithoutVAT ?? orderData.costWithoutVAT) || 0;
const rate = parseInt(validation.data.vatRate ?? orderData.vatRate) || 0;
return cost && rate ? Math.round(cost * rate / 100 * 100) / 100 : 0;
})(),
totalCostWords: orderData.totalCostWords,
paymentSchedule: orderData.paymentSchedule,
})
});

if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при сохранении');
}

showToast(' Все изменения успешно сохранены!', 'success');

// Очищаем подсветку ошибок
clearValidationErrors();

// Перезагружаем детали заказа
await viewOrderDetails(orderId);

} catch (error) {
console.error('Ошибка:', error);
showToast( error.message, 'error');
}
}

// ==================== ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН ====================
function closeOrderViewModal() {
    document.getElementById('orderViewModal').style.display = 'none';
    currentOrderId = null;
    // Перезагружаем список заказов, чтобы увидеть изменения
    if (currentTab === 'orders') {
        loadOrders(currentOrdersPage);
        loadOrdersStats();
    }
}

// ==================== ФУНКЦИИ ДЛЯ РАБОТЫ С ДОГОВОРОМ ====================
async function generateContract(orderId) {
const iframe = document.getElementById('contractIframe');
if (!iframe) {
showToast('Ошибка: элемент договора не найден', 'error');
return;
}

showToast('Загрузка договора...', 'info');

try {
const response = await fetch(`/api/manager/orders/${orderId}/contract-preview-page`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки');

const html = await response.text();
iframe.srcdoc = html;

document.getElementById('downloadContractBtn').onclick = () => downloadContractWord(orderId);
document.getElementById('contractModal').style.display = 'flex';

} catch (error) {
showToast(error.message, 'error');
}
}

async function showContractModal(orderId) {
const response = await fetch(`/api/manager/orders/${orderId}/contract-preview`, {
headers: { 'Authorization': `Bearer ${token}` }
});

const data = await response.json();

// Показываем HTML в модалке
document.getElementById('contractTextContainer').innerHTML = data.html;
document.getElementById('contractModal').style.display = 'flex';
}

function formatContractText(text) {
    if (!text) return '';
    
    // Разбиваем на строки
    const lines = text.split('\n');
    
    let html = '<div class="contract-content" style="font-family: \'Times New Roman\', Times, serif; font-size: 12pt; line-height: 1.5; max-width: 100%;">';
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Пустые строки
        if (trimmed === '') {
            html += '<div style="height: 1em;"></div>';
            return;
        }
        
        // Заголовок договора (ДОГОВОР)
        if (/^ДОГОВОР/.test(trimmed)) {
            html += `<div style="text-align: center; font-weight: bold; font-size: 14pt; margin: 15px 0;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Номер договора
        if (/№/.test(trimmed) && trimmed.length < 30) {
            html += `<div style="text-align: center; font-weight: bold; margin: 10px 0;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Город и дата (обычно в одной строке или в таблице)
        if (trimmed.startsWith('г.') || trimmed.includes('«') && trimmed.includes('»') && trimmed.includes('г.')) {
            html += `<div style="text-align: right; margin: 10px 0;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Заголовки разделов (1. ПРЕДМЕТ ДОГОВОРА)
        if (/^\d{1,2}\.\s+[А-ЯЁ\s,]+$/.test(trimmed) && trimmed.length < 80) {
            html += `<div style="font-weight: bold; margin: 20px 0 10px 0; font-size: 13pt;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Подзаголовки (ПОДРЯДЧИК:, ЗАКАЗЧИК:)
        if (/^(ПОДРЯДЧИК|ЗАКАЗЧИК):/.test(trimmed)) {
            html += `<div style="font-weight: bold; margin: 15px 0 5px 0;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Пункты с отступом (1.1, 2.2 и т.д.)
        if (/^\d{1,2}\.\d{1,2}\./.test(trimmed)) {
            html += `<div style="text-indent: 1.5cm; margin: 0;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Пункты списка с дефисом или цифрой в начале
        if (/^[–—\-•]/.test(trimmed) || /^\d{1,2}\.\d{1,2}\.\d{1,2}/.test(trimmed)) {
            html += `<div style="margin-left: 1.5cm; text-indent: -0.5cm;">${escapeHtml(line)}</div>`;
            return;
        }
        
        // Обычный текст с отступом первой строки
        if (line.startsWith('    ') || line.startsWith('\t')) {
            html += `<div style="text-indent: 1.5cm; margin: 0;">${escapeHtml(line.replace(/^[\s\t]+/, ''))}</div>`;
            return;
        }
        
        // Обычный текст
        html += `<div style="margin: 0; ${trimmed.length > 50 ? 'text-indent: 1.5cm;' : ''}">${escapeHtml(line)}</div>`;
    });
    
    html += '</div>';
    return html;
}

function closeContractModal() {
const modal = document.getElementById('contractModal');
if (modal) modal.style.display = 'none';
const iframe = document.getElementById('contractIframe');
if (iframe) iframe.srcdoc = '';
}

async function downloadContractWord(orderId) {
    try {
        showToast(' Подготовка документа...', 'info');
        
        const response = await fetch(`/api/manager/orders/${orderId}/contract/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Ошибка скачивания');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Получаем имя файла из заголовка Content-Disposition
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'contract.doc';
        
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        // Убеждаемся что имя файла безопасное
        filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
        
        showToast(' Договор скачан', 'success');
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast( error.message, 'error');
    }
}



function printContract() {
const iframe = document.getElementById('contractIframe');
if (iframe && iframe.contentWindow) {
iframe.contentWindow.focus();
iframe.contentWindow.print();
}
}

// ==================== ПАГИНАЦИЯ ====================
function displayPagination(pagination, type) {
    const container = document.getElementById(type === 'leads' ? 'leadsPagination' : 'ordersPagination');
    if (!pagination || pagination.totalPages <= 1) {
        container.style.display = 'none';
        return;
    }
    
    let html = '<div class="pagination-container">';
    
    html += `<button class="pagination-btn" ${pagination.page === 1 ? 'disabled' : ''} onclick="${type === 'leads' ? 'loadLeads' : 'loadOrders'}(${pagination.page - 1})">
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    for (let i = 1; i <= pagination.totalPages; i++) {
        if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
            html += `<button class="pagination-btn ${i === pagination.page ? 'active' : ''}" onclick="${type === 'leads' ? 'loadLeads' : 'loadOrders'}(${i})">${i}</button>`;
        } else if (i === pagination.page - 3 || i === pagination.page + 3) {
            html += `<span class="pagination-dots">...</span>`;
        }
    }
    
    html += `<button class="pagination-btn" ${pagination.page === pagination.totalPages ? 'disabled' : ''} onclick="${type === 'leads' ? 'loadLeads' : 'loadOrders'}(${pagination.page + 1})">
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
}

// ==================== ОБНОВЛЕНИЕ СТАТУСА ЗАЯВКИ ====================
async function updateLeadStatus(id, status) {
let notes = null;

if (status === 'Отклонена') {
notes = prompt('Укажите причину отклонения (это будет отправлено клиенту на email):');
// Если пользователь нажал "Отмена" или не ввел причину, но можно отправить и без причины
if (notes === null) return; // пользователь отменил
// Если причина пустая, оставляем null (будет отправлено стандартное сообщение)
if (notes.trim() === '') notes = null;
}

try {
const response = await fetch(`/api/manager/applications/${id}/status`, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status, notes })
});

if (response.ok) {
    showToast(`Статус заявки обновлен`, 'success');
    loadLeads(currentPage);
    loadLeadsStats();
} else {
    const error = await response.json();
    showToast(error.error || 'Ошибка при обновлении статуса', 'error');
}
} catch (error) {
console.error('Ошибка:', error);
showToast('Ошибка при обновлении статуса', 'error');
}
}

// ==================== ЗАМЕТКИ ДЛЯ ЗАЯВОК ====================
function showNotesForm(id) {
    document.getElementById(`notes-form-${id}`).style.display = 'block';
}

function hideNotesForm(id) {
    document.getElementById(`notes-form-${id}`).style.display = 'none';
}

async function saveNotes(id) {
    const notes = document.getElementById(`notes-text-${id}`).value;
    const leadElement = document.getElementById(`lead-${id}`);
    const currentStatus = leadElement.dataset.status;
    
    try {
        const response = await fetch(`/api/manager/applications/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                status: currentStatus,
                notes 
            })
        });

        if (response.ok) {
            showToast('Заметки сохранены', 'success');
            hideNotesForm(id);
            loadLeads(currentPage);
        } else {
            showToast('Ошибка при сохранении заметок', 'error');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка при сохранении заметок', 'error');
    }
}

// ==================== ПОИСК И ФИЛЬТРАЦИЯ ====================
function searchLeads() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadLeads(1);
    }, 500);
}

function searchOrders() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadOrders(1);
    }, 500);
}

function filterLeads(filter, event) {
currentLeadsFilter = filter;

document.querySelectorAll('#leadsFilters .filter-btn').forEach(btn => {
btn.classList.remove('active');
});
if (event && event.target) {
event.target.classList.add('active');
}

loadLeads(1); 
}

// ==================== БЫСТРОЕ ОДОБРЕНИЕ ЗАЯВКИ ====================
async function quickApproveLead(applicationId) {
    try {
        showToast('Одобрение заявки...', 'info');
        const today = new Date();
        const startDate = today.toISOString().split('T')[0];

        const response = await fetch(`/api/manager/applications/${applicationId}/quick-approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sendEmail: true,
                startDate: startDate
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка при одобрении');
        }
        
        const result = await response.json();
        
        showToast(' Заявка одобрена!', 'success');
        
        // Перезагружаем список заявок
        loadLeads(currentPage);
        loadLeadsStats();
        
        // Автоматический переход к заказу через 2 секунды
        if (result.orderId) {
const startDate = await setOrderStartDate(result.orderId); // 1. дата начала
if (startDate) await autoUpdateEndDate(result.orderId); // 2. дата конца
setTimeout(() => {
switchTab('orders');
setTimeout(() => viewOrderDetails(result.orderId), 500);
}, 2000);
}
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast(error.message, 'error');
    }
}
async function autoUpdateEndDate(orderId) {
if (!orderId) return;

try {
const response = await fetch(`/api/manager/orders/${orderId}`, {
headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) return;

const data = await response.json();
const works = data.works || [];
let startDate = data.order.StartDate;

// Если нет даты начала — устанавливаем и берём сегодня
if (!startDate) {
startDate = await setOrderStartDate(orderId);
if (!startDate) return;
}

if (works.length === 0) return;

// СУММА длительностей
const totalDuration = works.reduce((sum, w) => sum + (parseInt(w.Duration) || 0), 0);

if (totalDuration === 0) return;

const start = new Date(startDate);
const end = new Date(start);
end.setDate(start.getDate() + totalDuration);
const newEndDateStr = end.toISOString().split('T')[0];

// Обновляем только если дата изменилась
if (data.order.EndDate === newEndDateStr) return;

await fetch(`/api/manager/orders/${orderId}`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
body: JSON.stringify({ endDate: newEndDateStr })
});

// Обновляем поле в открытой модалке, если она открыта
const endDateField = document.getElementById('editEndDate');
const modalOpen = document.getElementById('orderViewModal')?.style.display === 'flex';
if (endDateField && modalOpen) endDateField.value = newEndDateStr;

console.log(` Дата окончания: ${newEndDateStr} (начало: ${startDate} + ${totalDuration} дн.)`);

} catch (error) {
console.error('Ошибка авто-расчёта даты окончания:', error);
}
}
// Автоматическая установка даты начала при создании заказа
async function setOrderStartDate(orderId) {
try {
const today = new Date();
const startDate = today.toISOString().split('T')[0];

const response = await fetch(`/api/manager/orders/${orderId}`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
body: JSON.stringify({ startDate })
});

if (response.ok) {
console.log(' Дата начала установлена:', startDate);
return startDate; // возвращаем дату
}
} catch (error) {
console.error('Ошибка установки даты начала:', error);
}
return null;
}

// ==================== ВАЛИДАЦИЯ: отображение ошибок ====================
function clearValidationErrors() {
document.querySelectorAll('.field-error').forEach(el => el.remove());
document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function showValidationErrors(errors) {
if (!errors || errors.length === 0) return;
showToast(errors[0], 'error');
}


// Валидация названия объекта
function validateObjectName(name) {
const normalized = normalizeText(name);
if (!normalized) {
return { valid: false, message: 'Название объекта обязательно для заполнения' };
}
if (normalized.length < 2) {
return { valid: false, message: 'Название объекта: минимум 2 символа' };
}
if (normalized.length > 300) {
return { valid: false, message: 'Название объекта не должно превышать 300 символов' };
}
return { valid: true, value: normalized };
}

// Валидация телефона
function validatePhone(phone) {
const normalized = normalizeText(phone);
if (!normalized) {
return { valid: false, message: 'Телефон обязателен для заполнения' };
}
const phoneClean = normalized.replace(/[\s\-\(\)]/g, '');
if (!/^\+?[\d]{7,15}$/.test(phoneClean)) {
return { valid: false, message: 'Введите корректный номер телефона' };
}
return { valid: true, value: normalized };
}
// ==================== УВЕДОМЛЕНИЯ ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMoney(amount) {
return new Intl.NumberFormat('ru-RU', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
}).format(amount) + ' BYN';
}



// Валидация ОКПО 
function validateOKPO(okpo) {
if (!okpo) return { valid: true, value: '' }; 

const okpoStr = okpo.toString().replace(/\s/g, '');

// Проверяем только цифры
if (!/^\d+$/.test(okpoStr)) {
return { valid: false, message: 'ОКПО должен содержать только цифры' };
}

// Проверяем длину 
if (okpoStr.length !== 8 && okpoStr.length !== 10) {
return { valid: false, message: 'ОКПО должен содержать 8 или 10 цифр' };
}

return { valid: true, value: okpoStr };
}

// Валидация расчетного счета 
function validateBankAccount(account) {
if (!account) return { valid: true, value: '' }; 

const accountStr = account.toString().replace(/\s/g, '');

if (!/^[A-Z0-9]+$/i.test(accountStr)) {
return { valid: false, message: 'Расчетный счет может содержать только буквы и цифры' };
}

// Проверяем минимальную и максимальную длину для IBAN
if (accountStr.length < 5 || accountStr.length > 34) {
return { valid: false, message: 'Расчетный счет должен содержать от 5 до 34 символов' };
}

return { valid: true, value: accountStr.toUpperCase() };
}

// Валидация БИК
function validateBIC(bic) {
if (!bic) return { valid: true, value: '' };

const bicStr = bic.toString().replace(/\s/g, '');

// БИК может содержать буквы и цифры
if (!/^[A-Z0-9]+$/i.test(bicStr)) {
return { valid: false, message: 'БИК может содержать только буквы и цифры' };
}

// Проверяем длину
if (bicStr.length < 3 || bicStr.length > 9) {
return { valid: false, message: 'БИК должен содержать от 3 до 9 символов' };
}

return { valid: true, value: bicStr.toUpperCase() };
}



// ==================== ВЫХОД ====================
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/admin/logout', { 
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error('Ошибка при выходе:', error);
    } finally {
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
    }
});

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    token = localStorage.getItem('token');
    
    if (token) {
const authOk = await checkAuth();
if (authOk) {
    await loadLeadsStats();
    await loadLeads(1);

    await loadOrdersStats();  
    
    await loadWorkTypes();
    await loadSpecialists();
    
    const types = await loadObjectTypes();
    window.objectTypes = types;
}
}
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchLeads);
    }
    
    const ordersSearchInput = document.getElementById('ordersSearchInput');
    if (ordersSearchInput) {
        ordersSearchInput.addEventListener('input', searchOrders);
    }
    
    setInterval(async () => {
        if (token && await checkAuth()) {
            if (currentTab === 'leads') {
                await loadLeadsStats();
                await loadLeads(currentPage);
            } else {
                await loadOrdersStats();
                await loadOrders(currentOrdersPage);
            }
        }
    }, 30000);
    // Мобильное меню
const mobileToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

if (mobileToggle) {
mobileToggle.addEventListener('click', () => {
sidebar.classList.toggle('open');
overlay.classList.toggle('active');
});

overlay.addEventListener('click', () => {
sidebar.classList.remove('open');
overlay.classList.remove('active');
});

document.querySelectorAll('.menu-item').forEach(link => {
link.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
});
});
}
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

// ==================== МОДАЛКА РАБОТЫ (wdm) ====================
let wdm = {
    workId: null,
    orderId: null,
    currentStatus: null
};

async function openWorkDetails(workId, orderId) {
    wdm.workId  = workId;
    wdm.orderId = orderId;

    document.getElementById('workDetailsModal').style.display = 'flex';
    document.getElementById('wdmWorkName').textContent = 'Загрузка...';
    document.getElementById('wdmCommentsList').innerHTML = '<div class="wdm-loading">Загрузка...</div>';
    document.getElementById('wdmFilesList').innerHTML    = '<div class="wdm-loading">Загрузка...</div>';
    const backBtn = document.getElementById('backToWorkSelectionBtn');
if (backBtn) {
// Убираем старые обработчики
const newBtn = backBtn.cloneNode(true);
backBtn.parentNode.replaceChild(newBtn, backBtn);

newBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // СОХРАНЯЕМ ID ЗАКАЗА ДО ЗАКРЫТИЯ
    const savedOrderId = wdm.orderId;
    
    // Закрываем журнал
    document.getElementById('workDetailsModal').style.display = 'none';
    wdm.workId = null;
    wdm.orderId = null;
    
    // Открываем окно выбора работ для того же заказа
    if (savedOrderId) {
        openWorkSelectionModal(savedOrderId);
    }
});
}

    await loadWorkDetails();
}

function closeWorkDetailsModal() {
    document.getElementById('workDetailsModal').style.display = 'none';
    wdm.workId  = null;
    wdm.orderId = null;
}

async function loadWorkDetails() {
    try {
        const resp = await fetch(`/api/manager/works/${wdm.workId}/details`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('Ошибка загрузки');

        const { work, comments, files } = await resp.json();

        renderWorkMeta(work);
        renderComments(comments);
        renderFiles(files);
    } catch (e) {
        console.error(e);
        showToast('Ошибка загрузки деталей работы', 'error');
    }
}

function renderWorkMeta(work) {
    wdm.currentStatus = work.Status;

    document.getElementById('wdmWorkName').textContent = work.WorkName;

    const statusMap = {
        'Не начат':    ['wdm-st-new',      'Не начат'],
        'В процессе':  ['wdm-st-progress',  'В процессе'],
        'Выполнен':    ['wdm-st-done',      'Выполнен '],
        'Приостановлен':['wdm-st-paused',   'Приостановлен']
    };
    const [cls, label] = statusMap[work.Status] || ['wdm-st-new', work.Status];
    const badge = document.getElementById('wdmStatusBadge');
    badge.className = 'wdm-status ' + cls;
    badge.textContent = label;

    document.getElementById('wdmQty').textContent =
        (work.Quantity || 0) + ' ед.';
    document.getElementById('wdmPrice').textContent =
        formatMoney(work.UnitCost || 0);
    document.getElementById('wdmTotal').textContent =
        formatMoney(work.TotalCost || 0);
    document.getElementById('wdmDuration').textContent =
        (work.Duration || 0) + ' дн.';
    document.getElementById('wdmResponsible').textContent =
        work.ResponsibleName || 'Не назначен';
    document.getElementById('wdmCompleted').textContent =
        work.CompletedAt ? new Date(work.CompletedAt).toLocaleDateString('ru-RU') : '—';

    const btns = [
        { status: 'Не начат',      cls: 'btn-new',      label: ' Не начат' },
        { status: 'В процессе',    cls: 'btn-progress',  label: ' В процессе' },
        { status: 'Выполнен',      cls: 'btn-done',      label: ' Выполнен' },
        { status: 'Приостановлен', cls: 'btn-paused',    label: ' Приостановлен' }
    ];
    document.getElementById('wdmStatusBtns').innerHTML = btns.map(b => `
        <button class="wdm-status-btn ${b.cls} ${work.Status === b.status ? 'active' : ''}"
                onclick="changeWorkStatus('${b.status}')">
            ${b.label}
        </button>
    `).join('');
}

async function changeWorkStatus(newStatus) {
    if (newStatus === wdm.currentStatus) return;

    try {
        const resp = await fetch(`/api/manager/works/${wdm.workId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        if (!resp.ok) throw new Error('Ошибка сохранения');

        showToast('Статус обновлён', 'success');
        await loadWorkDetails();

        if (wdm.orderId) {
            refreshWorksTable(wdm.orderId);
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function renderComments(comments) {
    const list = document.getElementById('wdmCommentsList');

    if (!comments.length) {
        list.innerHTML = '<div class="wdm-empty">Нет комментариев</div>';
        return;
    }

    list.innerHTML = comments.map(c => {
        const date = new Date(c.CreatedAt).toLocaleString('ru-RU', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        });
        const roleLabel = { admin:'Администратор', specialist:'Менеджер', client:'Клиент' }[c.AuthorRole] || c.AuthorRole;
        const visText  = c.IsVisibleToClient
            ? '<span class="wdm-comment-vis"> Видит клиент</span>'
            : '<span class="wdm-comment-vis internal"> Внутренняя запись</span>';

        return `
        <div class="wdm-comment" id="comment-${c.CommentID}">
            <div class="wdm-comment-header">
                <span class="wdm-comment-author">${escapeHtml(c.AuthorName)}</span>
                <span class="wdm-comment-role">${roleLabel}</span>
                <span class="wdm-comment-date">${date}</span>
            </div>
            <div class="wdm-comment-text">${escapeHtml(c.CommentText)}</div>
            ${visText}
            <button class="wdm-comment-del" onclick="deleteComment(${c.CommentID})" title="Удалить">✕</button>
        </div>`;
    }).join('');

    list.scrollTop = list.scrollHeight;
}

async function loadWorkComments() {
    try {
        const resp = await fetch(`/api/manager/works/${wdm.workId}/comments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const comments = await resp.json();
        renderComments(comments);
    } catch (e) {
        console.error(e);
    }
}

async function submitComment() {
    const text    = document.getElementById('wdmNewComment').value.trim();
    const visible = document.getElementById('wdmVisibleClient').checked;

    if (!text) {
        showToast('Введите текст комментария', 'warning');
        return;
    }

    try {
        const resp = await fetch(`/api/manager/works/${wdm.workId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ commentText: text, isVisibleToClient: visible })
        });
        if (!resp.ok) throw new Error('Ошибка отправки');

        document.getElementById('wdmNewComment').value = '';
        showToast('Комментарий добавлен', 'success');
        await loadWorkComments();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteComment(commentId) {
    if (!confirm('Удалить комментарий?')) return;
    try {
        const resp = await fetch(`/api/manager/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('Ошибка удаления');
        document.getElementById(`comment-${commentId}`)?.remove();
        showToast('Комментарий удалён', 'success');
    } catch (e) {
        showToast( e.message, 'error');
    }
}

function renderFiles(files) {
    const list = document.getElementById('wdmFilesList');

    if (!files.length) {
        list.innerHTML = '<div class="wdm-empty">Файлы не прикреплены</div>';
        return;
    }

    list.innerHTML = files.map(f => {
        const icon = getFileIcon(f.FileName);
        const date = new Date(f.UploadedAt).toLocaleDateString('ru-RU');

        return `
        <div class="wdm-file-item" id="file-${f.FileID}">
            <span class="wdm-file-icon">${icon}</span>
            <div class="wdm-file-info">
                <div class="wdm-file-name" title="${escapeHtml(f.FileName)}">${escapeHtml(f.FileName)}</div>
                <div class="wdm-file-meta">${f.FileSizeFormatted || ''} · ${f.UploaderName} · ${date}</div>
                ${f.Description ? `<div class="wdm-file-desc">${escapeHtml(f.Description)}</div>` : ''}
            </div>
            <div class="wdm-file-actions">
                <a href="${f.FileUrl}" download="${escapeHtml(f.FileName)}"
                   class="wdm-file-btn wdm-file-btn-down">⬇ Скачать</a>
                <button class="wdm-file-btn wdm-file-btn-del"
                        onclick="deleteWorkFile(${f.FileID})">✕</button>
            </div>
        </div>`;
    }).join('');
}

function getFileIcon(name) {
    if (!name) return '📄';
    const ext = name.split('.').pop().toLowerCase();
    const map = {
        pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗',
        jpg:'🖼', jpeg:'🖼', png:'🖼', gif:'🖼', webp:'🖼',
        zip:'📦', rar:'📦', txt:'📝', csv:'📊'
    };
    return map[ext] || '📄';
}

function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('wdmDropzone').classList.remove('drag-over');
    uploadFiles(Array.from(e.dataTransfer.files));
}

function handleFileSelect(e) {
    uploadFiles(Array.from(e.target.files));
    e.target.value = '';
}

async function uploadFiles(fileList) {
    if (!fileList.length) return;

    const description = document.getElementById('wdmFileDesc').value.trim();
    const progress    = document.getElementById('wdmUploadProgress');
    const fill        = document.getElementById('wdmProgressFill');
    const text        = document.getElementById('wdmProgressText');

    progress.style.display = 'block';

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];

        fill.style.width = Math.round(((i) / fileList.length) * 100) + '%';
        text.textContent = `Загрузка: ${file.name}...`;

        const formData = new FormData();
        formData.append('file', file);
        if (description) formData.append('description', description);

        try {
            const resp = await fetch(`/api/manager/works/${wdm.workId}/files`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!resp.ok) {
                const err = await resp.json();
                showToast(`${file.name}: ${err.error}`, 'error');
            }
        } catch (e) {
            showToast(`Ошибка при загрузке ${file.name}`, 'error');
        }
    }

    fill.style.width = '100%';
    text.textContent = 'Готово!';

    setTimeout(() => {
        progress.style.display = 'none';
        fill.style.width = '0%';
    }, 800);

    document.getElementById('wdmFileDesc').value = '';

    const resp = await fetch(`/api/manager/works/${wdm.workId}/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const files = await resp.json();
    renderFiles(files);

    showToast(` ${fileList.length > 1 ? fileList.length + ' файлов загружено' : 'Файл загружен'}`, 'success');
}

async function deleteWorkFile(fileId) {
    if (!confirm('Удалить файл?')) return;
    try {
        const resp = await fetch(`/api/manager/works/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error('Ошибка удаления');
        document.getElementById(`file-${fileId}`)?.remove();

        const list = document.getElementById('wdmFilesList');
        if (!list.children.length || list.innerHTML.trim() === '') {
            list.innerHTML = '<div class="wdm-empty">Файлы не прикреплены</div>';
        }
        showToast('Файл удалён', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function refreshWorksTable(orderId) {
    try {
        const resp = await fetch(`/api/manager/orders/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const tbody = document.querySelector('#orderDetailsContent table tbody');
        if (!tbody || !data.works) return;

        tbody.innerHTML = data.works.map(work => `
            <tr>
                <td>${escapeHtml(work.WorkName)}</td>
                <td>${work.Quantity}</td>
                <td>${formatMoney(work.UnitCost)}</td>
                <td>${formatMoney(work.TotalCost)}</td>
                <td>${work.Duration} дн.</td>
                <td>${escapeHtml(work.ResponsibleName || 'Не назначен')}</td>
                <td>
                    <span class="status-badge ${work.Status === 'Выполнен' ? 'status-completed' : work.Status === 'В процессе' ? 'status-progress' : 'status-new'}">
                        ${work.Status || 'Не начат'}
                    </span>
                </td>
                <td class="actions">
                    <button class="btn btn-edit btn-sm" onclick="editWork(${work.WorkID}, ${orderId})" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteWork(${work.WorkID}, ${orderId})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Ошибка обновления таблицы:', e);
    }
}

document.getElementById('workDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) closeWorkDetailsModal();
});

// Функция для получения и применения рекомендаций

async function suggestDurations() {
if (!currentOrderId) {
showToast('Нет активного заказа', 'error');
return;
}

const orderData = await getOrderData(currentOrderId);
if (!orderData) {
showToast('Не удалось загрузить данные заказа', 'error');
return;
}

// Берём objectTypeId из формы или по названию
let objectTypeId = null;
const objectTypeSelect = document.getElementById('editObjectType');
if (objectTypeSelect && !objectTypeSelect.disabled && objectTypeSelect.value) {
objectTypeId = objectTypeSelect.value;
}
if (!objectTypeId && orderData.ObjectType) {
objectTypeId = await getObjectTypeIdByName(orderData.ObjectType);
}

if (!objectTypeId) {
showToast('Тип объекта не указан. Заполните поле "Тип объекта" и сохраните заказ.', 'warning');
return;
}

if (!confirm('Текущие работы будут заменены автоматически рассчитанным списком. Продолжить?')) {
return;
}

try {
showToast('Формируем список работ...', 'info');

const response = await fetch('/api/manager/orders/suggest-works', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        objectTypeId: parseInt(objectTypeId),
        orderId: currentOrderId,
        area: parseFloat(orderData.Area) || 0,
        floors: parseInt(orderData.Floors) || 1
    })
});

if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Ошибка сервера');
}

const result = await response.json();
showToast(` ${result.message}`, 'success');
await autoUpdateEndDate(currentOrderId);

await viewOrderDetails(currentOrderId);
await viewOrderDetails(currentOrderId);

} catch (error) {
console.error('Ошибка:', error);
showToast( error.message, 'error');
}
}


// Вспомогательная функция для получения данных заказа
async function getOrderData(orderId) {
try {
const response = await fetch(`/api/manager/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) return null;
const data = await response.json();
return data.order;
} catch (e) {
console.error('Ошибка получения данных заказа:', e);
return null;
}
}

// Вспомогательная функция для получения ID типа объекта по названию
async function getObjectTypeIdByName(typeName) {
if (!typeName) return null;

try {
const response = await fetch('/api/object-types', {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) return null;

const types = await response.json();
const found = types.find(t => t.TypeName === typeName || t.TypeName.toLowerCase() === typeName.toLowerCase());

return found ? found.ObjectTypeID : null;
} catch (e) {
console.error('Ошибка получения типов объектов:', e);
return null;
}
}


// Вспомогательная функция для получения данных заказа
async function getOrderData(orderId) {
try {
const response = await fetch(`/api/manager/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});
if (!response.ok) return null;
const data = await response.json();
return data.order;
} catch (e) {
console.error('Ошибка получения данных заказа:', e);
return null;
}
}

function closeOrderViewModal() {
document.getElementById('orderViewModal').style.display = 'none';
currentOrderId = null;

// Убираем модалку рекомендаций если осталась
const suggestModal = document.getElementById('suggestionsModal');
if (suggestModal) suggestModal.remove();

if (currentTab === 'orders') {
loadOrders(currentOrdersPage);
loadOrdersStats();
}
}
// ==================== ВАЛИДАЦИЯ ПОЛЕЙ ====================

// Очистка и нормализация текста
function normalizeText(text) {
if (!text) return '';
return text.toString().trim().replace(/\s+/g, ' ');
}

// Валидация ФИО
function validateFullName(name) {
const normalized = normalizeText(name);

if (!normalized) {
return { valid: false, message: 'ФИО обязательно для заполнения' };
}

if (normalized.length < 2) {
return { valid: false, message: 'Введите полное ФИО (минимум 2 символа)' };
}

if (normalized.length > 200) {
return { valid: false, message: 'ФИО не должно превышать 200 символов' };
}

// Разрешены: русские/белорусские/английские буквы, дефисы, пробелы
const nameRegex = /^[а-яА-ЯёЁa-zA-Z\s\-]+$/;
if (!nameRegex.test(normalized)) {
return { valid: false, message: 'ФИО должно содержать только буквы, дефисы и пробелы' };
}

return { valid: true, value: normalized };
}

// Валидация должности
function validatePosition(position) {
const normalized = normalizeText(position);

if (!normalized) {
return { valid: false, message: 'Должность обязательна для заполнения' };
}

if (normalized.length < 2) {
return { valid: false, message: 'Должность должна содержать минимум 2 символа' };
}

if (normalized.length > 100) {
return { valid: false, message: 'Должность не должна превышать 100 символов' };
}

// Разрешены: буквы, пробелы, точки (для сокращений), дефисы
const positionRegex = /^[а-яА-ЯёЁa-zA-Z\s\.\-]+$/;
if (!positionRegex.test(normalized)) {
return { valid: false, message: 'Должность содержит недопустимые символы' };
}

return { valid: true, value: normalized };
}

// Валидация названия организации
function validateCompanyName(name) {
const normalized = normalizeText(name);

if (!normalized) {
return { valid: false, message: 'Название организации обязательно для заполнения' };
}

if (normalized.length < 2) {
return { valid: false, message: 'Название организации должно содержать минимум 2 символа' };
}

if (normalized.length > 300) {
return { valid: false, message: 'Название организации не должно превышать 300 символов' };
}

return { valid: true, value: normalized };
}

// Валидация УНП - упрощенная версия для тестирования
function validateUNP(unp) {
if (!unp) {
return { valid: false, message: 'УНП обязателен для заполнения' };
}

const normalized = unp.toString().replace(/\s/g, '');

// Для тестирования разрешаем любые 9 цифр
if (!/^\d{9}$/.test(normalized)) {
return { valid: false, message: 'УНП должен содержать 9 цифр' };
}

return { valid: true, value: normalized };
}

// Валидация ОКПО
function validateOKPO(okpo) {
if (!okpo) return { valid: true, value: '' }; // Необязательное поле

const okpoStr = okpo.toString().replace(/\s/g, '');

// Проверяем только цифры
if (!/^\d+$/.test(okpoStr)) {
return { valid: false, message: 'ОКПО должен содержать только цифры' };
}

// Проверяем длину (обычно 8 или 10 цифр)
if (okpoStr.length !== 8 && okpoStr.length !== 10) {
return { valid: false, message: 'ОКПО должен содержать 8 или 10 цифр' };
}

return { valid: true, value: okpoStr };
}

// Валидация email
function validateEmail(email) {
if (!email) {
return { valid: false, message: 'Email обязателен для заполнения' };
}

const normalized = normalizeText(email);

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
if (!emailRegex.test(normalized)) {
return { valid: false, message: 'Введите корректный email' };
}

if (normalized.length > 100) {
return { valid: false, message: 'Email не должен превышать 100 символов' };
}

return { valid: true, value: normalized.toLowerCase() };
}

// Валидация телефона
function validatePhone(phone) {
if (!phone) {
return { valid: false, message: 'Телефон обязателен для заполнения' };
}

const normalized = normalizeText(phone);
const phoneClean = normalized.replace(/[\s\-\(\)]/g, '');

if (!/^\+?[\d]{7,15}$/.test(phoneClean)) {
return { valid: false, message: 'Введите корректный номер телефона' };
}

return { valid: true, value: normalized };
}

// Валидация адреса
function validateAddress(address, fieldName) {
if (!address) {
return { valid: false, message: `${fieldName} обязателен для заполнения` };
}

const normalized = normalizeText(address);

if (normalized.length < 5) {
return { valid: false, message: `${fieldName}: минимум 5 символов` };
}

if (normalized.length > 500) {
return { valid: false, message: `${fieldName} не должен превышать 500 символов` };
}

// ПРОВЕРКА ФОРМАТА АДРЕСА
const formatValidation = validateAddressFormat(normalized, fieldName);
if (!formatValidation.valid) {
return formatValidation;
}

return { valid: true, value: normalized };
}

function validateAddressFormat(address, fieldName) {
const addr = address.trim();


const cityPatterns = [
/[гГ]\.?\s*[А-ЯЁ][а-яё\-]+/,          
/[гГ]ород\s+[А-ЯЁ][а-яё\-]+/,        
/^[А-ЯЁ][а-яё\-]+\s*[,]?\s*[уУ]л\.?/,   
/^[А-ЯЁ][а-яё\-]+$/          
];

const hasCity = cityPatterns.some(pattern => pattern.test(addr));

if (!hasCity) {
return { 
    valid: false, 
    message: `${fieldName} должен содержать город (например: г. Минск, ул. Ленина 15)` 
};
}

// Проверка наличия улицы 
const streetPatterns = [
/[уУ]л\.?\s*[А-ЯЁ][а-яё\-]+/,       
/[пП]р\.?\s*[А-ЯЁ][а-яё\-]+/,          
/[пП]роспект\s+[А-ЯЁ][а-яё\-]+/,    
/[бБ]ульвар\s+[А-ЯЁ][а-яё\-]+/,         
/[пП]ереулок\s+[А-ЯЁ][а-яё\-]+/,        
/[шШ]оссе\s+[А-ЯЁ][а-яё\-]+/            
];

const hasStreet = streetPatterns.some(pattern => pattern.test(addr));

// Проверка наличия номера дома 
const housePatterns = [
/[дД]\.?\s*\d+[а-яА-Я]?/,              
/\d+[а-яА-Я]?\s*$/,                   
/,\s*\d+[а-яА-Я]?/          
];

const hasHouse = housePatterns.some(pattern => pattern.test(addr));

// Если нет улицы и нет дома
if (!hasStreet && !hasHouse) {
// Возвращаем предупреждение, но адрес считается валидным
console.warn(`${fieldName}: рекомендуется указать улицу и номер дома`);
}

return { valid: true, value: address };
}

// Дополнительная функция для показа подсказки о формате адреса
function showAddressFormatHint(fieldId) {
const field = document.getElementById(fieldId);
if (!field) return;

// Добавляем подсказку под полем, если её нет
let hint = field.parentNode.querySelector('.address-hint');
if (!hint) {
hint = document.createElement('div');
hint.className = 'address-hint';
hint.style.cssText = 'font-size: 11px; color: #6c757d; margin-top: 4px;';
hint.innerHTML = '<i class="fas fa-info-circle"></i> Пример: <strong>г. Минск, ул. Ленина 15</strong>';
field.parentNode.appendChild(hint);
}
}

// Валидация названия объекта
function validateObjectName(name) {
if (!name) {
return { valid: false, message: 'Название объекта обязательно для заполнения' };
}

const normalized = normalizeText(name);

if (normalized.length < 2) {
return { valid: false, message: 'Название объекта: минимум 2 символа' };
}

if (normalized.length > 300) {
return { valid: false, message: 'Название объекта не должно превышать 300 символов' };
}

return { valid: true, value: normalized };
}

// Валидация расчетного счета 
function validateBankAccount(account) {
if (!account) return { valid: true, value: '' }; 

const accountStr = account.toString().replace(/\s/g, '');

// Разрешены: буквы латинского алфавита (A-Z) и цифры для IBAN
if (!/^[A-Z0-9]+$/i.test(accountStr)) {
return { valid: false, message: 'Расчетный счет может содержать только буквы и цифры' };
}

// Проверяем минимальную и максимальную длину для IBAN
if (accountStr.length < 5 || accountStr.length > 34) {
return { valid: false, message: 'Расчетный счет должен содержать от 5 до 34 символов' };
}

return { valid: true, value: accountStr.toUpperCase() };
}

// Валидация БИК
function validateBIC(bic) {
if (!bic) return { valid: true, value: '' }; 

const bicStr = bic.toString().replace(/\s/g, '');

// БИК может содержать буквы и цифры
if (!/^[A-Z0-9]+$/i.test(bicStr)) {
return { valid: false, message: 'БИК может содержать только буквы и цифры' };
}

// Проверяем длину
if (bicStr.length < 3 || bicStr.length > 11) {
return { valid: false, message: 'БИК должен содержать от 3 до 11 символов' };
}

return { valid: true, value: bicStr.toUpperCase() };
}

// Валидация банковских реквизитов (обновленная)
function validateBankDetails(bankName, bankAccount, bankBIC) {
const errors = [];
const result = {};

if (bankName) {
const normalized = normalizeText(bankName);
if (normalized.length < 2) {
    errors.push('Название банка должно содержать минимум 2 символа');
} else if (normalized.length > 200) {
    errors.push('Название банка не должно превышать 200 символов');
} else {
    result.bankName = normalized;
}
}

if (bankAccount) {
const accountResult = validateBankAccount(bankAccount);
if (!accountResult.valid) {
    errors.push(accountResult.message);
} else {
    result.bankAccount = accountResult.value;
}
}

if (bankBIC) {
const bicResult = validateBIC(bankBIC);
if (!bicResult.valid) {
    errors.push(bicResult.message);
} else {
    result.bankBIC = bicResult.value;
}
}

return { valid: errors.length === 0, errors, values: result };
}

// Валидация числовых значений
function validateNumber(value, fieldName, min = 0, max = 999999999, required = true) {
if (required && (value === undefined || value === null || value === '')) {
return { valid: false, message: `${fieldName} обязательно для заполнения` };
}

const num = parseFloat(value);
if (isNaN(num)) {
return { valid: false, message: `${fieldName} должно быть числом` };
}

if (num < min) {
return { valid: false, message: `${fieldName} должно быть не меньше ${min}` };
}

if (num > max) {
return { valid: false, message: `${fieldName} не должно превышать ${max}` };
}

return { valid: true, value: num };
}

// Валидация даты
function validateDate(date, fieldName, required = false) {
if (!date) {
if (required) {
    return { valid: false, message: `${fieldName} обязательна для заполнения` };
}
return { valid: true, value: null };
}

const dateObj = new Date(date);
if (isNaN(dateObj.getTime())) {
return { valid: false, message: `Введите корректную дату для ${fieldName.toLowerCase()}` };
}

return { valid: true, value: date };
}

// Валидация типа объекта
function validateObjectType(typeId, objectTypes) {
if (!typeId) {
return { valid: false, message: 'Выберите тип объекта' };
}

// Проверяем, есть ли такой тип в списке
const exists = objectTypes.some(t => 
t.TypeName === typeId || t.ObjectTypeID == typeId || t.ObjectTypeID === parseInt(typeId)
);

if (!exists) {
return { valid: false, message: 'Выбран некорректный тип объекта' };
}

return { valid: true, value: typeId };
}
// Функция для проверки уникальности УНП - более мягкая
async function checkUNPUnique(unp, excludeCompanyId = null) {
if (!unp) return true;

try {
const url = `/api/check-unp?unp=${encodeURIComponent(unp)}` + 
           (excludeCompanyId ? `&excludeId=${excludeCompanyId}` : '');

const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    console.warn('Ошибка ответа при проверке УНП:', response.status);
    return true;
}

const data = await response.json();
console.log(' Результат проверки УНП:', data);

return !data.exists;
} catch (e) {
console.error('Ошибка проверки УНП:', e);
return true;
}
}

// Функция для проверки уникальности email - более мягкая
async function checkEmailUnique(email, excludeUserId = null) {
if (!email) return true;

try {
const url = `/api/check-email?email=${encodeURIComponent(email)}` + 
           (excludeUserId ? `&excludeId=${excludeUserId}` : '');

const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    console.warn('Ошибка ответа при проверке email:', response.status);
    return true;
}

const data = await response.json();
console.log('Результат проверки email:', data);

return !data.exists;
} catch (e) {
console.error('Ошибка проверки email:', e);
return true;
}
}

// Функция для проверки уникальности телефона 
async function checkPhoneUnique(phone, excludeUserId = null) {
if (!phone) return true;

try {
const url = `/api/check-phone?phone=${encodeURIComponent(phone)}` + 
           (excludeUserId ? `&excludeId=${excludeUserId}` : '');

const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) {
    console.warn('Ошибка ответа при проверке телефона:', response.status);
    return true;
}

const data = await response.json();
console.log('Результат проверки телефона:', data);

return !data.exists;
} catch (e) {
console.error('Ошибка проверки телефона:', e);
return true;
}
}
// Основная функция валидации заказа
async function validateOrderData(orderData) {
const errors = [];
const validatedData = {};

console.log('Валидация данных заказа:', orderData);

// Валидация организации
if (orderData.companyName !== undefined) {
const companyResult = validateCompanyName(orderData.companyName);
if (!companyResult.valid) errors.push(companyResult.message);
else validatedData.companyName = companyResult.value;
}

// Валидация УНП
if (orderData.unp !== undefined) {
const unpResult = validateUNP(orderData.unp);
if (!unpResult.valid) errors.push(unpResult.message);
else validatedData.unp = unpResult.value;

}

// Валидация ОКПО
if (orderData.okpo !== undefined) {
const okpoResult = validateOKPO(orderData.okpo);
if (!okpoResult.valid) errors.push(okpoResult.message);
else validatedData.okpo = okpoResult.value;
}

// Валидация ФИО руководителя
if (orderData.directorName !== undefined) {
const directorResult = validateFullName(orderData.directorName);
if (!directorResult.valid) errors.push('ФИО представителя: ' + directorResult.message);
else validatedData.directorName = directorResult.value;
}

// Валидация должности
if (orderData.directorPosition !== undefined) {
const positionResult = validatePosition(orderData.directorPosition);
if (!positionResult.valid) errors.push('Должность: ' + positionResult.message);
else validatedData.directorPosition = positionResult.value;
}

// Валидация юридического адреса
if (orderData.legalAddress !== undefined) {
const addressResult = validateAddress(orderData.legalAddress, 'Юридический адрес');
if (!addressResult.valid) errors.push(addressResult.message);
else validatedData.legalAddress = addressResult.value;
}

// Валидация email
if (orderData.clientEmail !== undefined) {
const emailResult = validateEmail(orderData.clientEmail);
if (!emailResult.valid) errors.push(emailResult.message);
else validatedData.clientEmail = emailResult.value;


}

// Валидация телефона
if (orderData.clientPhone !== undefined) {
const phoneResult = validatePhone(orderData.clientPhone);
if (!phoneResult.valid) errors.push(phoneResult.message);
else validatedData.clientPhone = phoneResult.value;


}

// Валидация названия объекта
if (orderData.objectName !== undefined) {
const objectNameResult = validateObjectName(orderData.objectName);
if (!objectNameResult.valid) errors.push(objectNameResult.message);
else validatedData.objectName = objectNameResult.value;
}

// Валидация типа объекта
if (orderData.objectType !== undefined && orderData.objectType) {
const objectTypeResult = validateObjectType(orderData.objectType, window.objectTypes || []);
if (!objectTypeResult.valid) errors.push(objectTypeResult.message);
else validatedData.objectType = objectTypeResult.value;
}

// Валидация адреса объекта
if (orderData.objectAddress !== undefined) {
const objectAddressResult = validateAddress(orderData.objectAddress, 'Адрес объекта');
if (!objectAddressResult.valid) errors.push(objectAddressResult.message);
else validatedData.objectAddress = objectAddressResult.value;
}

// Валидация дат
if (orderData.startDate !== undefined) {
const startDateResult = validateDate(orderData.startDate, 'Дата начала', false);
if (!startDateResult.valid) errors.push(startDateResult.message);
else validatedData.startDate = startDateResult.value;
}

if (orderData.endDate !== undefined) {
const endDateResult = validateDate(orderData.endDate, 'Дата окончания', false);
if (!endDateResult.valid) errors.push(endDateResult.message);
else validatedData.endDate = endDateResult.value;

// Проверка логики дат
if (endDateResult.valid && validatedData.startDate && endDateResult.value) {
    const start = new Date(validatedData.startDate);
    const end = new Date(endDateResult.value);
    if (end < start) {
        errors.push('Дата окончания не может быть раньше даты начала');
    }
}
}

// Валидация стоимости
if (orderData.costWithoutVAT !== undefined) {
const costResult = validateNumber(orderData.costWithoutVAT, 'Стоимость без НДС', 0, 1000000000, false);
if (!costResult.valid) errors.push(costResult.message);
else validatedData.costWithoutVAT = costResult.value;
}

// Валидация НДС
if (orderData.vatRate !== undefined) {
const validRates = [0, 10, 20];
const rate = parseInt(orderData.vatRate);
if (isNaN(rate) || !validRates.includes(rate)) {
    errors.push('Ставка НДС должна быть 0%, 10% или 20%');
} else {
    validatedData.vatRate = rate;
}
}

// ВАЛИДАЦИЯ БАНКОВСКИХ РЕКВИЗИТОВ
if (orderData.bankName !== undefined || orderData.bankAccount !== undefined || orderData.bankBIC !== undefined) {
const bankResult = validateBankDetails(
    orderData.bankName,
    orderData.bankAccount,
    orderData.bankBIC
);

if (!bankResult.valid) {
    errors.push(...bankResult.errors);
} else {
    Object.assign(validatedData, bankResult.values);
}
}

console.log(' Результат валидации:', {
valid: errors.length === 0,
errors: errors,
data: validatedData
});

return {
valid: errors.length === 0,
errors: errors,
data: validatedData
};
}

function showCompletionWarning(incompleteWorks) {
return new Promise((resolve) => {
const workList = incompleteWorks.map(w => {
    const statusText = w.Status || 'Не начат';
    let statusIcon = '🔴';
    if (statusText === 'В процессе') statusIcon = '🟠';
    else if (statusText === 'Приостановлен') statusIcon = '⏸';
    
    return `<div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                ${statusIcon} <strong>${escapeHtml(w.WorkName)}</strong> — ${statusText}
            </div>`;
}).join('');

const old = document.getElementById('completionReasonModal');
if (old) old.remove();

const modalHtml = `
    <div id="completionReasonModal" class="modal" style="display: flex; z-index: 10001;">
        <div class="modal-content" style="max-width: 550px;">
            <div class="modal-header" style="background: #ff9800; color: white;">
                <h2 style="margin: 0;">Внимание! Незавершенные работы</h2>
                <button class="modal-close" id="completionReasonCloseBtn" style="color: white;">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Вы завершаете заказ с незавершенными работами.</strong></p>
                <div style="background: #fff3e0; padding: 12px; border-radius: 8px; margin: 10px 0;">
                    <p><strong>Незавершенные работы:</strong></p>
                    ${workList}
                </div>
                <div style="background: #e3f2fd; padding: 12px; border-radius: 8px;">
                    <p><strong>Что произойдет:</strong></p>
                    <ul style="margin: 5px 0 0 20px;">
                        <li>Заказ будет завершен</li>
                        <li>Незавершенные работы получат статус <strong>"Приостановлен"</strong></li>
                    </ul>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="completionReasonCancelBtn">Отмена</button>
                <button class="btn btn-warning" id="submitCompletionReasonBtn" style="background: #ff9800;">Подтвердить</button>
            </div>
        </div>
    </div>
`;

document.body.insertAdjacentHTML('beforeend', modalHtml);

let resolved = false;
function doResolve(value) {
    if (resolved) return;
    resolved = true;
    document.getElementById('completionReasonModal')?.remove();
    resolve(value);
}

document.getElementById('submitCompletionReasonBtn').onclick = () => doResolve(true);
document.getElementById('completionReasonCancelBtn').onclick = () => doResolve(false);
document.getElementById('completionReasonCloseBtn').onclick = () => doResolve(false);
document.getElementById('completionReasonModal').onclick = (e) => {
    if (e.target === e.currentTarget) doResolve(false);
};
});
}


// Функция для отображения ошибок под полями
function showFieldError(fieldId, message) {
const field = document.getElementById(fieldId);
if (!field) return;

// Удаляем предыдущую ошибку
const existingError = field.parentNode.querySelector('.field-error');
if (existingError) existingError.remove();

field.classList.add('is-invalid');

const errorDiv = document.createElement('div');
errorDiv.className = 'field-error';
errorDiv.style.color = '#e53935';
errorDiv.style.fontSize = '12px';
errorDiv.style.marginTop = '4px';
errorDiv.textContent = message;

field.parentNode.appendChild(errorDiv);
}

// Функция для получения ID пользователя по ID компании
async function getUserIdFromOrder(orderId) {
try {
// Если у вас есть данные заказа в глобальной переменной
if (window.currentOrderData && window.currentOrderData.ClientUserID) {
    return window.currentOrderData.ClientUserID;
}

// Иначе делаем запрос
const response = await fetch(`/api/manager/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) return null;

const data = await response.json();
window.currentOrderData = data.order; // Сохраняем для следующих запросов

return data.order.ClientUserID;
} catch (e) {
console.error('Ошибка получения ID пользователя:', e);
return null;
}
}

// Функция для очистки ошибок поля
function clearFieldError(fieldId) {
const field = document.getElementById(fieldId);
if (!field) return;

field.classList.remove('is-invalid');

const existingError = field.parentNode.querySelector('.field-error');
if (existingError) existingError.remove();
}

// Функция для очистки всех ошибок валидации
function clearValidationErrors() {
document.querySelectorAll('.field-error').forEach(el => el.remove());
document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

// Функция для отображения списка ошибок
function showValidationErrors(errors) {
if (!errors || errors.length === 0) return;

// Показываем первую ошибку как toast
showToast(errors[0], 'error');

// Также выводим в консоль для отладки
console.error('Ошибки валидации:', errors);
}

// Функция для валидации всех полей перед сохранением
async function validateAllFields(orderId) {
clearValidationErrors();

// Собираем данные для валидации
const orderData = {
companyId: orderId,
companyName: document.getElementById('editCompanyName')?.value,
unp: document.getElementById('editUNP')?.value,
okpo: document.getElementById('editOKPO')?.value,
directorName: document.getElementById('editDirectorName')?.value,
directorPosition: document.getElementById('editDirectorPosition')?.value,
legalAddress: document.getElementById('editLegalAddress')?.value,
clientEmail: document.getElementById('editClientEmail')?.value,
clientPhone: document.getElementById('editClientPhone')?.value,
objectName: document.getElementById('editObjectName')?.value,
objectType: document.getElementById('editObjectType')?.value,
objectAddress: document.getElementById('editObjectAddress')?.value,
startDate: document.getElementById('editStartDate')?.value,
endDate: document.getElementById('editEndDate')?.value,
costWithoutVAT: document.getElementById('editCostWithoutVAT')?.value,
vatRate: document.getElementById('editVATRate')?.value,
vatAmount: document.getElementById('editVATAmount')?.value,
bankName: document.getElementById('editBankName')?.value,
bankAccount: document.getElementById('editBankAccount')?.value,
bankBIC: document.getElementById('editBankBIC')?.value
};

// Валидируем
const validation = await validateOrderData(orderData);

// Показываем ошибки под соответствующими полями
if (!validation.valid) {
validation.errors.forEach(error => {
    if (error.includes('ФИО')) {
        showFieldError('editDirectorName', error);
    } else if (error.includes('Должность')) {
        showFieldError('editDirectorPosition', error);
    } else if (error.includes('УНП')) {
        showFieldError('editUNP', error);
    } else if (error.includes('ОКПО')) {
        showFieldError('editOKPO', error);
    } else if (error.includes('Email')) {
        showFieldError('editClientEmail', error);
    } else if (error.includes('Телефон')) {
        showFieldError('editClientPhone', error);
    } else if (error.includes('Название организации')) {
        showFieldError('editCompanyName', error);
    } else if (error.includes('Юридический адрес')) {
        showFieldError('editLegalAddress', error);
    } else if (error.includes('Название объекта')) {
        showFieldError('editObjectName', error);
    } else if (error.includes('Адрес объекта')) {
        showFieldError('editObjectAddress', error);
    } else if (error.includes('Тип объекта')) {
        showFieldError('editObjectType', error);
    } else if (error.includes('Дата начала')) {
        showFieldError('editStartDate', error);
    } else if (error.includes('Дата окончания')) {
        showFieldError('editEndDate', error);
    } else if (error.includes('Стоимость')) {
        showFieldError('editCostWithoutVAT', error);
    } else if (error.includes('НДС')) {
        showFieldError('editVATRate', error);
    } else if (error.includes('банка')) {
        showFieldError('editBankName', error);
    } else if (error.includes('счет')) {
        showFieldError('editBankAccount', error);
    } else if (error.includes('БИК')) {
        showFieldError('editBankBIC', error);
    }
});

showValidationErrors(validation.errors);
}

return validation;
}
// ========== МОБИЛЬНОЕ МЕНЮ ==========
function initMobileMenu() {
const menuBtn = document.getElementById('mobileMenuToggle');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebarOverlay');

if (!menuBtn || !sidebar || !overlay) return;

// Открытие/закрытие меню
menuBtn.addEventListener('click', function(e) {
e.stopPropagation();
sidebar.classList.toggle('open');
overlay.classList.toggle('active');

// Блокируем прокрутку body
if (sidebar.classList.contains('open')) {
    document.body.style.overflow = 'hidden';
} else {
    document.body.style.overflow = '';
}
});

// Закрытие по клику на оверлей
overlay.addEventListener('click', function() {
sidebar.classList.remove('open');
overlay.classList.remove('active');
document.body.style.overflow = '';
});

// Закрытие при клике на пункт меню
document.querySelectorAll('.menu-item').forEach(item => {
item.addEventListener('click', function() {
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});
});

// При изменении размера окна
window.addEventListener('resize', function() {
if (window.innerWidth > 768) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}
});
}

// Запускаем инициализацию после загрузки страницы
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initMobileMenu);
} else {
initMobileMenu();
}