
// ==================== КОНСТАНТЫ ====================
const API_URL = window.location.origin;
let token = localStorage.getItem('clientToken');
let userData = null;

// Состояние для раздела "Ход работ"
const cpState = {
    orders: [],
    currentId: null,
    expandedWorks: new Set() // Хранит ID развернутых работ
};

// ==================== ПРОВЕРКА АВТОРИЗАЦИИ ====================
if (!token) {
    window.location.href = '/client/login.html';
}

// ==================== ЗАГРУЗКА ДАННЫХ ПОЛЬЗОВАТЕЛЯ ====================
async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/api/client/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        userData = await response.json();
        document.getElementById('userNameSidebar').textContent = userData.FullName || 'Клиент';
        await checkPushStatus();
        showSection('dashboard');
        
    } catch (error) {
        console.error('Ошибка:', error);
        logout();
    }
}

// ==================== ПЕРЕКЛЮЧЕНИЕ РАЗДЕЛОВ ====================
async function showSection(section, orderId = null) {
    const content = document.getElementById('content');
    const progressSection = document.getElementById('section-progress');
    
    toggleMenu();
    
    content.style.display = 'block';
    progressSection.style.display = 'none';
    
    if (section === 'progress') {
content.style.display = 'none';
progressSection.style.display = 'block';
await initProgressSection(orderId);
} else {
        content.innerHTML = '<div class="loader">Загрузка...</div>';
        
        switch(section) {
            case 'dashboard':
                await showDashboard(content);
                break;
            case 'orders':
                await showOrders(content);
                break;
            case 'docs':
                await showDocs(content);
                break;
            case 'profile':
                await showProfile(content);
                break;
        }
    }
}

// ==================== ГЛАВНАЯ ====================
async function showDashboard(container) {
    try {
        const response = await fetch(`${API_URL}/api/client/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        container.innerHTML = `
            <div class="welcome-card">
                <h2>Здравствуйте, ${userData?.FullName || 'Клиент'}!</h2>
                <p>Добро пожаловать в личный кабинет. Здесь вы можете отслеживать статус ваших заказов и скачивать документы.</p>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.totalOrders || 0}</div>
                    <div class="stat-label">Всего заказов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.inProgress || 0}</div>
                    <div class="stat-label">В работе</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.completed || 0}</div>
                    <div class="stat-label">Завершено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.recentOrders?.length || 0}</div>
                    <div class="stat-label">Документов</div>
                </div>
            </div>
            
            <div class="section-title">
                <span>Последние заказы</span>
                <a href="#" onclick="showSection('orders')" style="color: #e31e24; text-decoration: none;">Все →</a>
            </div>
            
            ${renderOrdersList(data.recentOrders || [])}
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки dashboard:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки данных</div>';
    }
}

// ==================== ЗАКАЗЫ ====================
async function showOrders(container) {
    try {
        const response = await fetch(`${API_URL}/api/client/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const orders = await response.json();
        
        container.innerHTML = `
            <div class="section-title">Мои заказы</div>
            ${orders.length > 0 ? renderOrdersList(orders) : `
                <div class="empty-state">
                    
                    <h3>У вас пока нет заказов</h3>
                    <p>После одобрения заявки заказы появятся здесь</p>
                </div>
            `}
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки заказов</div>';
    }
}

// ==================== ДОКУМЕНТЫ ====================
async function showDocs(container) {
try {
const response = await fetch(`${API_URL}/api/client/documents`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const docs = await response.json();

container.innerHTML = `
    <div class="section-title">Мои документы</div>
    
    <div class="docs-grid">
        ${docs.map(doc => `
            <div class="doc-card">
                
                <div class="doc-info">
                    <h4>${doc.name || 'Документ'}</h4>
                    <p>${doc.date || ''}</p>
                </div>
                <button onclick="downloadDoc('${doc.url}', '${doc.name || 'document'}')" 
                        class="doc-download" 
                        style="background:none;border:none;font-size:20px;cursor:pointer;"></button>
            </div>
        `).join('')}
    </div>
    
    ${docs.length === 0 ? `
        <div class="empty-state">
            
            <h3>Нет документов</h3>
        </div>
    ` : ''}
`;

} catch (error) {
console.error('Ошибка загрузки документов:', error);
container.innerHTML = '<div class="empty-state">Ошибка загрузки документов</div>';
}
}

async function downloadDoc(url, filename) {
try {
showToast('Загрузка файла...', 'info');

const response = await fetch(`${API_URL}${url}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (!response.ok) throw new Error('Ошибка загрузки файла');

const blob = await response.blob();
const blobUrl = window.URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = blobUrl;
a.download = filename;
document.body.appendChild(a);
a.click();

window.URL.revokeObjectURL(blobUrl);
document.body.removeChild(a);

showToast('Файл скачан', 'success');

} catch (error) {
console.error('Ошибка скачивания:', error);
showToast('Ошибка при скачивании файла', 'error');
}
}

// ==================== ПРОФИЛЬ ====================
async function showProfile(container) {
    container.innerHTML = `
        <div class="section-title">Мой профиль</div>
        
        <div style="background: white; border-radius: 15px; padding: 30px;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #666; margin-bottom: 5px;">ФИО</label>
                <div style="font-size: 18px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                    ${userData?.FullName || 'Не указано'}
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #666; margin-bottom: 5px;">Email</label>
                <div style="font-size: 18px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                    ${userData?.Email || 'Не указан'}
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; color: #666; margin-bottom: 5px;">Телефон</label>
                <div style="font-size: 18px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                    ${userData?.Phone || 'Не указан'}
                </div>
            </div>
            
            <button onclick="changePassword()" style="background: #e31e24; color: white; border: none; padding: 12px 20px; border-radius: 8px; width: 100%; font-size: 16px; cursor: pointer;">
                Сменить пароль
            </button>
        </div>
    `;
}

// ==================== РЕНДЕР СПИСКА ЗАКАЗОВ ====================
function renderOrdersList(orders) {
    if (!orders || orders.length === 0) {
        return '<div class="empty-state">Нет заказов</div>';
    }
    
    return `
        <div class="orders-list">
            ${orders.map(order => {
                let dateStr = '';
                if (order.date) {
                    const date = new Date(order.date);
                    dateStr = date.toLocaleDateString('ru-RU');
                }
                
                return `
                    <div class="order-item" onclick="showSection('progress', ${order.id})">
                        <div class="order-info">
                            <h3>Заказ №${order.number || order.id}</h3>
                            <p>${order.objectName || 'Объект'} • от ${dateStr}</p>
                        </div>
                        <div>
                            <div class="order-status status-${order.statusClass || 'new'}">
                                ${order.statusText || order.Status || 'Новый'}
                            </div>
                            <div class="order-price">${(order.total || 0).toLocaleString('ru-RU')} BYN</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}


function changePassword() {
    const newPass = prompt('Введите новый пароль (минимум 6 символов):');
    if (newPass && newPass.length >= 6) {
        fetch(`${API_URL}/api/client/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: newPass })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Пароль успешно изменен');
            } else {
                alert('Ошибка при смене пароля');
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Ошибка при смене пароля');
        });
    } else if (newPass) {
        alert('Пароль должен содержать минимум 6 символов');
    }
}

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function logout() {
    localStorage.removeItem('clientToken');
    window.location.href = '/client/login.html';
}

// ==================== ХОД РАБОТ ====================

function showCp(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function hideCp(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

async function initProgressSection(selectedOrderId = null) {
    showCp('cpLoading');
    hideCp('cpContent');
    hideCp('cpEmpty');
    hideCp('cpOrderSelector');

    try {
        const resp = await fetch(`${API_URL}/api/client/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!resp.ok) throw new Error('Ошибка загрузки заказов');
        
        const orders = await resp.json();

        cpState.orders = (orders || []).filter(o =>
            ['В работе', 'Завершена', 'Одобрена'].includes(o.Status)
        );

        hideCp('cpLoading');

        if (!cpState.orders.length) {
showCp('cpEmpty');
return;
}

// Определяем, какой заказ показывать
let targetOrder = null;
if (selectedOrderId) {
targetOrder = cpState.orders.find(o => o.id === selectedOrderId);
}
if (!targetOrder && cpState.orders.length) {
targetOrder = cpState.orders[0];
}

if (!targetOrder) {
showCp('cpEmpty');
return;
}

if (cpState.orders.length > 1) {
renderOrderTabs(targetOrder.id);
showCp('cpOrderSelector');
}

await loadOrderProgress(targetOrder.id);

    } catch (e) {
        hideCp('cpLoading');
        showCp('cpEmpty');
        console.error('Ошибка загрузки заказов:', e);
    }
}

function renderOrderTabs(activeId) {
const tabs = document.getElementById('cpOrderTabs');
tabs.innerHTML = cpState.orders.map(o => {
const objectName = o.objectName || o.ObjectAddress || `Договор №${o.number || o.id}`;
const displayName = objectName.length > 30 ? objectName.substring(0, 27) + '...' : objectName;
const isActive = (o.id === activeId);

return `
    <button class="cp-order-tab ${isActive ? 'active' : ''}"
            onclick="switchOrder(${o.id}, this)">
        ${escapeHtml(displayName)}
    </button>
`;
}).join('');
}

window.switchOrder = async function(contractId, btn) {
    document.querySelectorAll('.cp-order-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    cpState.expandedWorks.clear();
    await loadOrderProgress(contractId);
};

async function loadOrderProgress(contractId) {
    cpState.currentId = contractId;

    showCp('cpLoading');
    hideCp('cpContent');

    try {
        const resp = await fetch(`${API_URL}/api/client/orders/${contractId}/works`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!resp.ok) throw new Error('Ошибка загрузки');
        
        const data = await resp.json();
        const works = data.works || [];
        const comments = data.comments || [];
        const files = data.files || [];

        const order = cpState.orders.find(o => o.id === contractId) || {};

        hideCp('cpLoading');
        showCp('cpContent');

        renderOrderHeader(order, works, files);
        renderWorksList(works, comments, files);
        renderFeed(comments);
        renderFiles(files);

    } catch (e) {
        hideCp('cpLoading');
        showCp('cpEmpty');
        console.error('Ошибка:', e);
    }
}

function renderOrderHeader(order, works, files) {
    document.getElementById('cpOrderNum').textContent =
        'Договор №' + (order.number || order.id || '—');
    document.getElementById('cpOrderObj').textContent =
        order.objectName || order.ObjectAddress || '—';

    const total = works.length;
    const done = works.filter(w => w.Status === 'Выполнен').length;
    const progress = works.filter(w => w.Status === 'В процессе').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    document.getElementById('cpStatTotal').textContent = total;
    document.getElementById('cpStatDone').textContent = done;
    document.getElementById('cpStatProgress').textContent = progress;
    document.getElementById('cpStatFiles').textContent = files.length;
    document.getElementById('cpProgressPct').textContent = pct + '%';

    const bar = document.getElementById('cpProgressBar');
    bar.style.width = pct + '%';
}

function toggleWorkDetails(workId) {
    if (cpState.expandedWorks.has(workId)) {
        cpState.expandedWorks.delete(workId);
    } else {
        cpState.expandedWorks.add(workId);
    }
    
    const detailsDiv = document.getElementById(`work-details-${workId}`);
    const expandBtn = document.getElementById(`work-expand-${workId}`);
    
    if (detailsDiv) {
        if (cpState.expandedWorks.has(workId)) {
            detailsDiv.classList.add('expanded');
            if (expandBtn) expandBtn.classList.add('expanded');
        } else {
            detailsDiv.classList.remove('expanded');
            if (expandBtn) expandBtn.classList.remove('expanded');
        }
    }
}

function renderWorksList(works, allComments, allFiles) {
const container = document.getElementById('cpWorksList');

if (!works.length) {
container.innerHTML = '<div class="cp-empty-state"><p>Перечень работ пока не сформирован</p></div>';
return;
}

const statusConfig = {
'Не начат': { cls: 'new', label: 'Не начат' },
'В процессе': { cls: 'progress', label: 'В процессе' },
'Выполнен': { cls: 'done', label: 'Выполнен' },
'Приостановлен': { cls: 'paused', label: 'Приостановлен' }
};

container.innerHTML = works.map(w => {
const cfg = statusConfig[w.Status] || statusConfig['Не начат'];
const workComments = allComments.filter(c => c.OrderWorkID === w.WorkID);
const workFiles = allFiles.filter(f => String(f.OrderWorkID) === String(w.WorkID));
const isExpanded = cpState.expandedWorks.has(w.WorkID);

return `
<div class="cp-work-card">
    <div class="cp-work-header" onclick="toggleWorkDetails(${w.WorkID})">
        <div class="cp-work-header-left">
            <div class="cp-work-icon-circle cp-status-${cfg.cls}"></div>
            <div class="cp-work-title">
                <h4>${escapeHtml(w.WorkName)}</h4>
                <p>${escapeHtml(w.ServiceName || 'Основные работы')}</p>
            </div>
        </div>
        <span class="cp-work-badge ${cfg.cls}">${cfg.label}</span>
        <button class="cp-work-expand ${isExpanded ? 'expanded' : ''}" id="work-expand-${w.WorkID}" onclick="event.stopPropagation(); toggleWorkDetails(${w.WorkID})">▼</button>
    </div>
    <div class="cp-work-details ${isExpanded ? 'expanded' : ''}" id="work-details-${w.WorkID}">
        <div class="cp-detail-row">
            <div class="cp-detail-item">Количество: <strong>${w.Quantity || 0}</strong></div>
            <div class="cp-detail-item">Срок выполнения: <strong>${w.Duration || 0} дн.</strong></div>
            ${w.ResponsibleName ? `<div class="cp-detail-item">Исполнитель: <strong>${escapeHtml(w.ResponsibleName)}</strong></div>` : ''}
        </div>
        
        ${workComments.length > 0 ? `
            <div class="cp-work-comments">
                <div class="cp-work-comments-title">Комментарии (${workComments.length})</div>
                ${workComments.map(c => `
                    <div class="cp-work-comment-item">
                        <div class="cp-work-comment-header">
                            <span class="cp-work-comment-author">${escapeHtml(c.AuthorName || 'Менеджер')}</span>
                            <span class="cp-work-comment-date">${new Date(c.CreatedAt).toLocaleString('ru-RU')}</span>
                        </div>
                        <div class="cp-work-comment-text">${escapeHtml(c.CommentText)}</div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        ${workFiles.length > 0 ? `
            <div class="cp-work-files">
                <div class="cp-work-files-title">Файлы (${workFiles.length})</div>
                <div class="cp-work-files-list">
                    ${workFiles.map(f => {
                        const isImage = isImageFile(f.FileName);
                        if (isImage && f.FileUrl) {
                            return `
                                <div class="cp-work-file-item cp-work-file-image">
                                    <img src="${f.FileUrl}" alt="${escapeHtml(f.FileName)}" 
                                         class="cp-work-file-thumb"
                                         onclick="window.open('${f.FileUrl}', '_blank')"
                                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                                    <div class="cp-work-file-info" style="display: none;">
                                        <button onclick="downloadDoc('${f.FileUrl}', '${escapeHtml(f.FileName)}')" class="cp-work-file-name" style="background:none;border:none;cursor:pointer;color:inherit;text-align:left;padding:0;">${escapeHtml(f.FileName)}</button>
                                    </div>
                                    <div class="cp-work-file-info">
                                        <a href="${f.FileUrl}" download class="cp-work-file-name">${escapeHtml(f.FileName)}</a>
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="cp-work-file-item">
                                    <a href="${f.FileUrl}" download class="cp-work-file-name">${escapeHtml(f.FileName)}</a>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
            </div>
        ` : ''}
    </div>
</div>`;
}).join('');
}
// Функция для открытия изображения в лайтбоксе
function openLightbox(imageUrl) {
let lightbox = document.getElementById('cpLightbox');
if (!lightbox) {
lightbox = document.createElement('div');
lightbox.id = 'cpLightbox';
lightbox.className = 'cp-lightbox';
lightbox.innerHTML = `
    <span class="cp-lightbox-close">&times;</span>
    <img src="" alt="Просмотр">
`;
document.body.appendChild(lightbox);

lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox || e.target.className === 'cp-lightbox-close') {
        lightbox.classList.remove('active');
    }
});
}

const img = lightbox.querySelector('img');
img.src = imageUrl;
lightbox.classList.add('active');
}

function renderFeed(comments) {
    const feed = document.getElementById('cpFeed');

    if (!comments.length) {
        feed.innerHTML = '<div class="cp-empty-state"><div class="cp-empty-state-icon"></div><p>Пока нет обновлений от менеджера</p></div>';
        return;
    }

    feed.innerHTML = comments.map(c => {
        const date = new Date(c.CreatedAt).toLocaleString('ru-RU', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const initial = (c.AuthorName || 'М')[0].toUpperCase();

        return `
        <div class="cp-feed-item">
            <div class="cp-feed-avatar">${initial}</div>
            <div class="cp-feed-body">
                <div class="cp-feed-head">
                    <span class="cp-feed-author">${escapeHtml(c.AuthorName || 'Менеджер')}</span>
                    ${c.WorkName ? `<span class="cp-feed-work">· ${escapeHtml(c.WorkName)}</span>` : ''}
                    <span class="cp-feed-date">${date}</span>
                </div>
                <div class="cp-feed-text">${escapeHtml(c.CommentText)}</div>
            </div>
        </div>`;
    }).join('');
}

function renderFiles(files) {
const section = document.getElementById('cpFilesSection');
const grid = document.getElementById('cpFilesGrid');

if (!files.length) {
section.style.display = 'none';
return;
}

section.style.display = 'block';

grid.innerHTML = files.map(f => {
const fileName = f.FileName || '';
const isImage = isImageFile(fileName);
const icon = getFileIcon(fileName);
const date = new Date(f.UploadedAt).toLocaleDateString('ru-RU');
const size = f.FileSizeFormatted || '';
const fileUrl = f.FileUrl || '';

// Для изображений показываем превью, для остальных - иконку
if (isImage && fileUrl) {
    return `
        <div class="cp-file-card cp-file-card-image">
            <div class="cp-file-image-preview">
                <img src="${fileUrl}" alt="${escapeHtml(fileName)}" 
                     onclick="window.open('${fileUrl}', '_blank')"
                     onerror="this.parentElement.innerHTML='<div class=\\'cp-file-icon-big\\'>🖼</div>'">
            </div>
            <div class="cp-file-name">${escapeHtml(fileName)}</div>
            ${f.WorkName ? `<div class="cp-file-work"> ${escapeHtml(f.WorkName)}</div>` : ''}
            <div class="cp-file-info">${size} ${date}</div>
            <div class="cp-file-actions">
                <a href="${fileUrl}" download class="cp-file-dl">⬇ Скачать</a>
                <button onclick="window.open('${fileUrl}', '_blank')" class="cp-file-view">👁 Просмотр</button>
            </div>
        </div>
    `;
} else {
    // Для не-изображений показываем иконку
    return `
        <div class="cp-file-card">
            <div class="cp-file-icon-big">${icon}</div>
            <div class="cp-file-name">${escapeHtml(fileName)}</div>
            ${f.WorkName ? `<div class="cp-file-work"> ${escapeHtml(f.WorkName)}</div>` : ''}
            <div class="cp-file-info">${size} ${date}</div>
            <button onclick="downloadDoc('${fileUrl}', '${escapeHtml(fileName)}')" class="cp-file-dl">⬇ Скачать</button>
        </div>
    `;
}
}).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
loadUserData();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

// ==================== ОТЗЫВЫ ====================
let currentRating = 0;

function openReviewModal(orderId, applicationId) {
    document.getElementById('reviewOrderId').value = orderId;
    document.getElementById('reviewApplicationId').value = applicationId;
    document.getElementById('reviewRating').value = 0;
    document.getElementById('reviewText').value = '';
    
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
        star.style.color = '#ddd';
    });
    
    currentRating = 0;
    document.getElementById('reviewModal').style.display = 'block';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
}

function setRating(rating) {
    currentRating = rating;
    document.getElementById('reviewRating').value = rating;
    
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
            star.style.color = '#ffc107';
        } else {
            star.classList.remove('active');
            star.style.color = '#ddd';
        }
    });
}

async function submitReview(event) {
    event.preventDefault();
    
    const orderId = document.getElementById('reviewOrderId').value;
    const applicationId = document.getElementById('reviewApplicationId').value;
    const rating = document.getElementById('reviewRating').value;
    const text = document.getElementById('reviewText').value.trim();
    
    if (!applicationId || applicationId === 'undefined' || applicationId === '0' || applicationId === 'null') {
        showToast('Ошибка: не удалось определить ID заказа. Обновите страницу.', 'error');
        return;
    }
    
    if (!rating || rating === '0') {
        showToast('Пожалуйста, поставьте оценку', 'error');
        return;
    }
    
    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Отправка...';
        submitBtn.disabled = true;
        
        const response = await fetch(`${API_URL}/api/client/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                applicationId: parseInt(applicationId),
                rating: parseInt(rating),
                reviewText: text || null
            })
        });
        
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error('Сервер вернул некорректный ответ');
        }
        
        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}`);
        }
        
        showToast('Спасибо за ваш отзыв! Он будет опубликован после проверки', 'success');
        closeReviewModal();
        
        const container = document.getElementById('content');
        if (container) showOrders(container);
        
    } catch (error) {
        let userMessage = error.message;
        if (error.message.includes('Заказ не найден')) userMessage = 'Заказ не найден в системе';
        else if (error.message.includes('не принадлежит')) userMessage = 'Этот заказ не принадлежит вам';
        else if (error.message.includes('только для завершенных')) userMessage = 'Отзыв можно оставить только для завершенных заказов';
        else if (error.message.includes('уже оставили')) userMessage = 'Вы уже оставили отзыв для этого заказа';
        
        showToast(userMessage, 'error');
        
    } finally {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Отправить отзыв';
            submitBtn.disabled = false;
        }
    }
}

function renderOrderWithReviewButton(order) {
    const hasReview = order.hasReview || false;
    const appId = order.ApplicationID || order.applicationId || '';
    const canReview = order.Status === 'Завершена' && !hasReview && appId;
    
    return `
        <div class="order-item" onclick="showSection('progress', ${order.id})">
            <div class="order-info">
                <h3>Заказ №${order.number || order.id}</h3>
                <p>${order.objectName || 'Объект'} • от ${new Date(order.date).toLocaleDateString('ru-RU')}</p>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                <div class="order-status status-${order.statusClass || 'new'}">
                    ${order.statusText || order.Status || 'Новый'}
                </div>
                <div class="order-price">${(order.total || 0).toLocaleString('ru-RU')} BYN</div>
                ${canReview ? 
                    `<button class="btn-review" onclick="event.stopPropagation(); openReviewModal(${order.id}, ${appId})">
                        ★ Оставить отзыв
                    </button>` : 
                    (hasReview ? 
                        `<span class="review-badge"> Отзыв оставлен</span>` : '')
                }
            </div>
        </div>
    `;
}

async function loadUserOrders() {
    try {
        const response = await fetch(`${API_URL}/api/client/orders-with-reviews`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await response.json();
    } catch (error) {
        console.error('Ошибка загрузки заказов с отзывами:', error);
        return [];
    }
}

async function showOrders(container) {
    try {
        const orders = await loadUserOrders();
        
        container.innerHTML = `
            <div class="section-title">Мои заказы</div>
            ${orders.length > 0 ? 
                `<div class="orders-list">
                    ${orders.map(order => renderOrderWithReviewButton(order)).join('')}
                </div>` : 
                `<div class="empty-state">
                    
                    <h3>У вас пока нет заказов</h3>
                    <p>После одобрения заявки заказы появятся здесь</p>
                </div>`
            }
        `;
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки заказов</div>';
    }
}

async function showDashboard(container) {
    try {
        const response = await fetch(`${API_URL}/api/client/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        const recentOrders = data.recentOrders || [];
        
        container.innerHTML = `
            <div class="welcome-card">
                <h2>Здравствуйте, ${userData?.FullName || 'Клиент'}!</h2>
                <p>Добро пожаловать в личный кабинет. Здесь вы можете отслеживать статус ваших заказов и скачивать документы.</p>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.totalOrders || 0}</div>
                    <div class="stat-label">Всего заказов</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.inProgress || 0}</div>
                    <div class="stat-label">В работе</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.completed || 0}</div>
                    <div class="stat-label">Завершено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.stats?.reviews || 0}</div>
                    <div class="stat-label">Отзывов</div>
                </div>
            </div>
            
            <div class="section-title">
                <span>Последние заказы</span>
                <a href="#" onclick="showSection('orders')" style="color: #e31e24; text-decoration: none;">Все →</a>
            </div>
            
            ${renderOrdersListWithReviews(recentOrders)}
        `;
    } catch (error) {
        console.error('Ошибка загрузки dashboard:', error);
        container.innerHTML = '<div class="empty-state">Ошибка загрузки данных</div>';
    }
}

function renderOrdersListWithReviews(orders) {
    if (!orders || orders.length === 0) {
        return '<div class="empty-state">Нет заказов</div>';
    }
    return `<div class="orders-list">${orders.map(order => renderOrderWithReviewButton(order)).join('')}</div>`;
}

function viewOrderDetails(orderId) {
    console.log('Просмотр деталей заказа #' + orderId);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
}

window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) closeReviewModal();
}

// Функция для проверки, является ли файл изображением
function isImageFile(filename) {
if (!filename) return false;
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
const ext = filename.split('.').pop().toLowerCase();
return imageExtensions.includes(ext);
}

// Функция для получения иконки по типу файла (только для не-изображений)
function getFileIcon(filename) {
if (!filename) return '';
const ext = filename.split('.').pop().toLowerCase();
const iconMap = {
pdf: '',
doc: '',
docx: '',
xls: '',
xlsx: '',
zip: '',
rar: '',
txt: '',
csv: ''
};
return iconMap[ext] || '';
}

// Функция для получения миниатюры
function getThumbnailUrl(fileUrl) {
// Если это изображение, возвращаем оригинальный URL
if (isImageFile(fileUrl)) {
return fileUrl;
}
return null;
}
// Push-уведомления 
async function initPushNotifications() {
if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

try {
const reg = await navigator.serviceWorker.ready;

// Уже подписаны?
let sub = await reg.pushManager.getSubscription();
if (sub) return; // всё готово

// Спрашиваем разрешение
const permission = await Notification.requestPermission();
if (permission !== 'granted') return;

// Получаем VAPID-ключ с сервера
const keyResp = await fetch(`${API_URL}/api/vapid-public-key`);
const { key } = await keyResp.json();

// Подписываемся
sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key)
});

// Сохраняем на сервере
await fetch(`${API_URL}/api/client/push-subscribe`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(sub)
});

console.log('Push-подписка активирована');
} catch (err) {
console.warn('Push-уведомления недоступны:', err);
}
}

// Вспомогательная: конвертация VAPID-ключа
function urlBase64ToUint8Array(base64String) {
const padding = '='.repeat((4 - base64String.length % 4) % 4);
const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
const raw = atob(base64);
return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
// ─── Управление push-уведомлениями ─────────────────────────────────
let pushEnabled = false;
let currentSubscription = null;

// Проверка статуса подписки при загрузке
async function checkPushStatus() {
if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
updatePushButtonUI(false, false);
return false;
}

try {
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();

if (sub) {
    pushEnabled = true;
    currentSubscription = sub;
    updatePushButtonUI(true, true);
    return true;
} else {
    pushEnabled = false;
    currentSubscription = null;
    updatePushButtonUI(true, false);
    return false;
}
} catch (err) {
console.error('Ошибка проверки статуса:', err);
updatePushButtonUI(false, false);
return false;
}
}

// Обновление UI кнопки
function updatePushButtonUI(supported, enabled) {
const btn = document.getElementById('pushNotificationBtn');
if (!btn) return;

if (!supported) {
btn.style.opacity = '0.3';
btn.title = 'Push-уведомления не поддерживаются';
btn.disabled = true;
return;
}

if (enabled) {
btn.classList.add('active');
btn.classList.remove('disabled');
btn.title = 'Уведомления включены. Нажмите чтобы отключить';
} else {
btn.classList.remove('active');
btn.classList.add('disabled');
btn.title = 'Уведомления выключены. Нажмите чтобы включить';
}
}
async function togglePushNotifications() {
if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
showToast('Push-уведомления не поддерживаются вашим браузером', 'error');
return;
}

try {
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();

if (sub) {
    // Отключаем уведомления
    await sub.unsubscribe();
    
    // Удаляем подписку с сервера
    await fetch(`${API_URL}/api/client/push-subscribe`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    pushEnabled = false;
    currentSubscription = null;
    updatePushButtonUI(true, false);
    showToast(' Уведомления отключены', 'info');
    
} else {
    // Включаем уведомления
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        showToast(' Необходимо разрешить уведомления в настройках браузера', 'error');
        return;
    }
    
    // Получаем VAPID-ключ
    const keyResp = await fetch(`${API_URL}/api/vapid-public-key`);
    const { key } = await keyResp.json();
    
    if (!key) {
        showToast('Ошибка: VAPID ключ не получен', 'error');
        return;
    }
    
    // Подписываемся
    const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
    });
    
    // Сохраняем на сервере
    const saveResp = await fetch(`${API_URL}/api/client/push-subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSub)
    });
    
    if (!saveResp.ok) throw new Error('Ошибка сохранения подписки');
    
    pushEnabled = true;
    currentSubscription = newSub;
    updatePushButtonUI(true, true);
    
    // Тестовое уведомление
    await reg.showNotification(' МСК-Релайбл', {
        body: 'Уведомления успешно включены!',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'test-notification',
        vibrate: [200, 100, 200]
    });
    
    showToast('Уведомления включены!', 'success');
}

} catch (err) {
console.error('Ошибка переключения уведомлений:', err);
showToast('Ошибка: ' + err.message, 'error');
}
}
// ==================== ДОКУМЕНТАЦИЯ ====================
function openClientDocumentation() {
const modal = document.getElementById('clientDocumentationModal');
if (modal) {
modal.classList.add('show');
document.body.style.overflow = 'hidden';
toggleMenu(); // Закрываем меню при открытии документации
}
}

function closeClientDocumentation() {
const modal = document.getElementById('clientDocumentationModal');
if (modal) {
modal.classList.remove('show');
document.body.style.overflow = '';
}
}

// Закрытие по клику на фон
document.addEventListener('click', function(e) {
const modal = document.getElementById('clientDocumentationModal');
if (modal && e.target === modal) {
closeClientDocumentation();
}
});

// Закрытие по ESC
document.addEventListener('keydown', function(e) {
if (e.key === 'Escape') {
const modal = document.getElementById('clientDocumentationModal');
if (modal && modal.classList.contains('show')) {
    closeClientDocumentation();
}
}
});