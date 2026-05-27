const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const nodemailer = require('nodemailer');
const { 
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType
    } = require("docx");
require('dotenv').config();
const webpush = require('web-push');
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;
const { execFile } = require('child_process');
const os = require('os');

// ==================== МИДЛВАРЫ ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ==================== НАСТРОЙКИ ====================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Настройки email
const emailConfig = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
};

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport(emailConfig);
}

app.get('/api/vapid-public-key', (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC_KEY });
});
// Сохранение подписки
app.post('/api/client/push-subscribe', authenticateClient, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            return res.status(400).json({ error: 'Неверный формат подписки' });
        }

        await pool.request()
            .input('UserID',   sql.Int,      req.user.id)
            .input('Endpoint', sql.NVarChar, endpoint)
            .input('P256dh',   sql.NVarChar, keys.p256dh)
            .input('Auth',     sql.NVarChar, keys.auth)
            .execute('sp_SavePushSubscription');

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения подписки:', err);
        res.status(500).json({ error: err.message });
    }
});

// Удаление подписки (выход / пользователь отказался)
app.delete('/api/client/push-subscribe', authenticateClient, async (req, res) => {
    try {
        await pool.request()
            .input('UserID', sql.Int, req.user.id)
            .execute('sp_DeletePushSubscriptions');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ПОДКЛЮЧЕНИЕ К БД ====================
const dbConfig = {
    user: process.env.DB_USER || 'node_d',
    password: process.env.DB_PASSWORD || '12345',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'ConstructionOrders',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool;

async function connectToDB() {
    try {
        pool = await sql.connect(dbConfig);
        console.log('Подключено к SQL Server');
        return pool;
    } catch (err) {
        console.error('Ошибка подключения к БД:', err);
        process.exit(1);
    }
}


// Путь к папке с изображениями проектов
const PROJECT_IMAGES_PATH = '/uploads/projects/';

// Хелпер: добавить путь к имени файла
function addImagePath(filename) {
    if (!filename) return null;
    // Если уже полный путь — не добавляем
    if (filename.startsWith('/') || filename.startsWith('http')) return filename;
    return PROJECT_IMAGES_PATH + filename;
}

// Хелпер: убрать путь, оставить только имя файла
function stripImagePath(url) {
    if (!url) return null;
    return url.replace(PROJECT_IMAGES_PATH, '').replace(/.*\//, '');
}



// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ 
function generateToken(user) {
    return jwt.sign(
        { id: user.UserID, login: user.Login, role: user.Role },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
}

function generateTemporaryPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Недействительный токен' });
        req.user = user;
        next();
    });
}

async function checkManagerRole(req, res, next) {
    if (!req.user || (req.user.role !== 'specialist' && req.user.role !== 'admin')) {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    next();
}

// Функция отправки email
async function sendApprovalEmail(clientEmail, clientName, temporaryPassword, isNewUser = true) {
    try {
        console.log('sendApprovalEmail вызван:', { 
            clientEmail, 
            clientName, 
            hasPassword: !!temporaryPassword,
            isNewUser 
        });
        
        if (!transporter) {
            console.log('Транспортер не настроен! Проверьте EMAIL_USER и EMAIL_PASS в .env');
            console.log('Данные для входа (транспортер не настроен):', {
                login: clientEmail,
                password: temporaryPassword
            });
            return false;
        }
        
        if (!clientEmail) {
            console.log(' Нет email для отправки');
            return false;
        }

        const loginUrl = 'http://localhost:3000/client/login'; 

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #e31e24; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px; }
                    .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e31e24; }
                    .button { 
                        display: inline-block; 
                        background: #28a745; 
                        color: white !important; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 6px; 
                        font-size: 18px;
                        font-weight: bold;
                        margin: 5px;
                    }
                    .info-box { background: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8; }
                    .button-link {
                        text-align: center;
                        margin: 25px 0 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"><h1>MCK-Reliable</h1></div>
                    <div class="content">
                        <h2>Здравствуйте, ${clientName}!</h2>
                        
                        <p>Ваша заявка <strong>одобрена</strong>! Вы можете войти в личный кабинет.</p>
                        
                        <div class="credentials">
                            <h3> Данные для входа:</h3>
                            <p><strong>Логин:</strong> ${clientEmail}</p>
                            <p><strong>Пароль:</strong> ${temporaryPassword}</p>
                        </div>
                        
                        <div class="info-box">
                            <p style="font-size: 18px; margin-bottom: 10px;"> <strong>Доступ в личный кабинет</strong></p>
                            <p style="color: #666; margin-bottom: 15px;">Нажмите на кнопку ниже для входа в систему</p>
                            
                            <div class="button-link">
                                <a href="${loginUrl}" class="button"> Войти в личный кабинет</a>
                            </div>
                        </div>
                        
                        <p style="margin-top: 20px; font-size: 14px; color: #666; text-align: center;">
                             <strong>Совет:</strong> Сохраните данные для входа в надежном месте
                        </p>
                        
                        <p style="margin-top: 30px;">С уважением,<br>Команда MCK-Reliable</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"MCK-Reliable" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: clientEmail,
            subject: ' Ваша заявка одобрена! Данные для входа',
            html: emailHtml
        };

        console.log(' Отправка письма...');
        const info = await transporter.sendMail(mailOptions);
        console.log(' Email отправлен:', info.messageId);
        return true;
        
    } catch (error) {
        console.error(' Ошибка отправки email:', error);
        return false;
    }
}
// Функция отправки email при отклонении заявки
async function sendRejectionEmail(clientEmail, clientName, rejectionReason) {
    try {
        console.log('sendRejectionEmail вызван:', { clientEmail, clientName, hasReason: !!rejectionReason });
        
        if (!transporter) {
            console.log('Транспортер не настроен!');
            console.log('Данные для уведомления:', { login: clientEmail });
            return false;
        }
        
        if (!clientEmail) {
            console.log('Нет email для отправки');
            return false;
        }

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #e31e24; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px; }
                    .reason-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e31e24; }
                    .button { display: inline-block; background: #e31e24; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
                    .button-green { background: #28a745; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>MCK-Reliable</h1>
                    </div>
                    <div class="content">
                        <h2>Уважаемый(ая) ${escapeHtml(clientName)}!</h2>
                        
                        <p>К сожалению, ваша заявка была <strong style="color: #e31e24;">отклонена</strong>.</p>
                        
                        ${rejectionReason ? `
                        <div class="reason-box">
                            <h3>Причина отклонения:</h3>
                            <p>${escapeHtml(rejectionReason)}</p>
                        </div>
                        ` : `
                        <div class="reason-box">
                            <p>К сожалению, мы не можем принять вашу заявку в данный момент.</p>
                            <p>Вы можете связаться с нами для уточнения деталей:</p>
                            <p> Телефон: +375(29)-663-82-02<br>
                             Email: mck-reliable@yandex.ru</p>
                        </div>
                        `}
                        
                        <p style="margin-top: 30px; font-size: 12px; color: #999;">
                            С уважением,<br>Команда MCK-Reliable
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `"MCK-Reliable" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: clientEmail,
            subject: ' Ваша заявка отклонена',
            html: emailHtml
        };

        console.log('Отправка письма об отклонении...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email об отклонении отправлен:', info.messageId);
        return true;
        
    } catch (error) {
        console.error('Ошибка отправки email об отклонении:', error);
        return false;
    }
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// API: ЗАЯВКИ 

// Создание заявки (с главной страницы)
app.post('/api/applications', async (req, res) => {
    try {
        const { name, phone, email, message, address, source, objectTypeId } = req.body;
        
        const result = await pool.request()
            .input('GuestName', sql.NVarChar, name?.trim())
            .input('GuestPhone', sql.NVarChar, phone)
            .input('GuestEmail', sql.NVarChar, email || null)
            .input('GuestDescription', sql.NVarChar, message || null)
            .input('Source', sql.NVarChar, source || 'site')
            .input('ObjectTypeID', sql.Int, objectTypeId || null)
            .output('ApplicationID', sql.Int)
            .execute('sp_CreateApplication');
        
        res.json({ 
            success: true, 
            id: result.output.ApplicationID,
            message: 'Заявка успешно отправлена' 
        });
        
    } catch (err) {
        console.error('Ошибка создания заявки:', err);
        res.status(500).json({ error: err.message || 'Ошибка сервера' });
    }
});

// Получение заявок для менеджера
app.get('/api/manager/applications', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { filter = 'all', page = 1, search = '', sort = 'createdAt_desc' } = req.query;
        
        const result = await pool.request()
            .input('Filter', sql.NVarChar, filter)
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .input('Search', sql.NVarChar, search)
            .input('UserRole', sql.NVarChar, req.user.role)
            .input('UserID', sql.Int, req.user.id)
            .input('SortBy', sql.NVarChar, sort) 
            .execute('sp_GetManagerApplications');
        
        const applications = result.recordsets[0];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            leads: applications,
            pagination: {
                page: parseInt(page),
                pageSize: 10,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 10)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения заявок:', err);
        res.status(500).json({ 
            error: 'Ошибка сервера',
            leads: [],
            pagination: { page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }
        });
    }
});

// Обновление статуса заявки
app.put('/api/manager/applications/:id/status', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        console.log(' Обновление статуса заявки:', { id, status, notes });
        
        const result = await pool.request()
            .input('ApplicationID', sql.Int, id)
            .input('Status', sql.NVarChar, status)
            .input('Notes', sql.NVarChar, notes || null)
            .input('SpecialistID', sql.Int, req.user.id)
            .output('ShouldSendEmail', sql.Bit)
            .output('ClientEmail', sql.NVarChar(150))
            .output('ClientName', sql.NVarChar(200))
            .execute('sp_UpdateApplicationStatus');
        
        console.log('Результат процедуры:', {
            ShouldSendEmail: result.output.ShouldSendEmail,
            ClientEmail: result.output.ClientEmail,
            ClientName: result.output.ClientName
        });
                // Если статус "Отклонена" - отправляем письмо об отклонении
                if (status === 'Отклонена' && result.output.ClientEmail) {
                    console.log('Отправка письма об отклонении для заявки #' + id);
                    
                    const emailSent = await sendRejectionEmail(
                        result.output.ClientEmail,
                        result.output.ClientName || 'Клиент',
                        notes || null  // причина отклонения
                    );
                    
                    if (emailSent) {
                        console.log('Письмо об отклонении отправлено');
                    } else {
                        console.log('Ошибка отправки письма об отклонении');
                    }
                }
        
        // Если нужно отправить email
        if (result.output.ShouldSendEmail && result.output.ClientEmail) {
            console.log(' Отправка email для заявки #' + id);
            
            // Получаем или создаем пользователя
            const userResult = await pool.request()
                .input('Email', sql.NVarChar, result.output.ClientEmail)
                .input('Name', sql.NVarChar, result.output.ClientName || 'Клиент')
                .input('Phone', sql.NVarChar, null)
                .input('ApplicationID', sql.Int, id)
                .output('UserID', sql.Int)
                .output('IsNew', sql.Bit)
                .output('TemporaryPassword', sql.NVarChar(50))
                .execute('sp_GetOrCreateClientUser');
            
            console.log('Результат создания пользователя:', {
                UserID: userResult.output.UserID,
                IsNew: userResult.output.IsNew,
                TemporaryPassword: userResult.output.TemporaryPassword
            });
            
            let tempPassword = userResult.output.TemporaryPassword;
            let isNewUser = userResult.output.IsNew;
            
            if (isNewUser && tempPassword && userResult.output.UserID) {
                console.log(' Хеширование пароля для нового пользователя');
                const hashedPassword = await bcrypt.hash(tempPassword, 10);
                
                await pool.request()
                    .input('UserID', sql.Int, userResult.output.UserID)
                    .input('PasswordHash', sql.NVarChar, hashedPassword)
                    .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE UserID = @UserID');
                
                console.log(' Пароль захеширован и сохранен');
            }
            
            // Если пользователь уже существует, генерируем новый временный пароль
            if (!isNewUser && userResult.output.UserID) {
                tempPassword = generateTemporaryPassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);
                
                await pool.request()
                    .input('UserID', sql.Int, userResult.output.UserID)
                    .input('PasswordHash', sql.NVarChar, hashedPassword)
                    .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE UserID = @UserID');
                
                console.log(' Сброшен пароль для существующего пользователя');
            }
            
            // Отправляем email
            if (tempPassword) {
                const emailSent = await sendApprovalEmail(
                    result.output.ClientEmail,
                    result.output.ClientName || 'Клиент',
                    tempPassword,
                    isNewUser
                );
                
                if (emailSent) {
                    console.log('Email успешно отправлен');
                } else {
                    console.log('Ошибка отправки email');
                }
            }
        }
        
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка обновления статуса:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Получение детальной информации о заявке
app.get('/api/manager/applications/:id/details', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('ApplicationID', sql.Int, id)
            .execute('sp_GetApplicationDetails');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('Ошибка получения деталей заявки:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: СТАТИСТИКА 

app.get('/api/manager/stats', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetManagerStats');
        
        res.json({
            leads: result.recordsets[0]?.[0] || {
                totalLeads: 0, newLeads: 0, contactedLeads: 0,
                inProgressLeads: 0, completedLeads: 0, rejectedLeads: 0
            },
            reviews: result.recordsets[1]?.[0] || {
                totalReviews: 0, pendingReviews: 0, approvedReviews: 0
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

//  API: АВТОРИЗАЦИЯ

app.get('/api/manager/check-auth', authenticateToken, checkManagerRole, (req, res) => {
    res.json({ authenticated: true, user: req.user });
});
app.get('/api/admin/check-auth', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещен' });
    }
    res.json({ authenticated: true, user: req.user });
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }
        
        const userResult = await pool.request()
            .input('login', sql.NVarChar, login)
            .query('SELECT UserID, Login, PasswordHash, Role, FullName FROM Users WHERE Login = @login AND IsActive = 1');
        
        const user = userResult.recordset[0];
        
        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        const isValid = await bcrypt.compare(password, user.PasswordHash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        const token = generateToken(user);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.UserID,
                login: user.Login,
                role: user.Role === 'admin' ? 'admin' : 'manager',
                name: user.FullName
            }
        });
        
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/admin/logout', (req, res) => {
    res.json({ success: true });
});

// API: ПРОЕКТЫ 
// API для получения проектов с фильтрацией
app.get('/api/projects', async (req, res) => {
    try {
        const { 
            category = '', 
            status = '', 
            search = '', 
            page = 1, 
            pageSize = 10,
            showAll = 0 
        } = req.query;
        
        // Вызываем хранимую процедуру
        const result = await pool.request()
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, parseInt(pageSize))
            .input('Search', sql.NVarChar(100), search || '')
            .input('Category', sql.NVarChar(100), category || '')
            .input('Status', sql.NVarChar(50), status || '') 
            .input('ShowAll', sql.Bit, parseInt(showAll) || 0)
            .execute('sp_GetProjects');
        
        // 1 - проекты, 2 - общее количество, 3 - категории
        const projects = result.recordsets[0] || [];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        const categories = result.recordsets[2] || [];
        
        // Добавляем пути к изображениям
        projects.forEach(project => {
            if (project.MainImage) {
                project.MainImage = addImagePath(project.MainImage);
            }
            
            // Парсим Features если есть
            if (project.Features) {
                try {
                    project.Features = JSON.parse(project.Features);
                } catch {
                    project.Features = [];
                }
            }
        });
        
        res.json({
            projects,
            pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalCount,
                totalPages: Math.ceil(totalCount / parseInt(pageSize))
            },
            categories: categories.map(c => c.Category).filter(Boolean)
        });
        
    } catch (err) {
        console.error('Ошибка получения проектов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const projectId = parseInt(id);
        if (isNaN(projectId)) return res.status(400).json({ error: 'Неверный ID' });

        // Получаем проект
        const projectResult = await pool.request()
            .input('Id', sql.Int, projectId)
            .query('SELECT * FROM Projects WHERE Id = @Id');
        
        if (projectResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Проект не найден' });
        }
        
        const project = projectResult.recordset[0];
        
        // Получаем все изображения из таблицы ProjectImages
        const imagesResult = await pool.request()
            .input('ProjectID', sql.Int, projectId)
            .query('SELECT FileName, SortOrder FROM ProjectImages WHERE ProjectID = @ProjectID ORDER BY SortOrder');
        
        // Добавляем путь к главному изображению
        project.MainImage = addImagePath(project.MainImage);
        
        // Собираем все изображения (главное + галерея)
        const allImages = [];
        
        // Добавляем главное, если есть
        if (project.MainImage) {
            allImages.push({
                url: project.MainImage,
                isMain: true
            });
        }
        
        // Добавляем из галереи
        imagesResult.recordset.forEach(img => {
            allImages.push({
                url: addImagePath(img.FileName),
                isMain: false
            });
        });
        
        // Парсим Features если есть
        if (project.Features) {
            try { project.Features = JSON.parse(project.Features); }
            catch { project.Features = []; }
        }
        
        // Добавляем массив всех изображений в ответ
        project.Images = allImages;
        
        res.json(project);
        
    } catch (err) {
        console.error('Ошибка получения проекта:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Публичный endpoint для типов объектов (без авторизации)
app.get('/api/object-types/public', async (req, res) => {
    try {
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, 0)
            .execute('sp_GetObjectTypes');
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения типов объектов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// Получение категорий
app.get('/api/projects/categories', async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetCategories');
        
        res.json(result.recordset.map(c => c.Category));
        
    } catch (err) {
        console.error('Ошибка получения категорий:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: АДМИН - УПРАВЛЕНИЕ ПРОЕКТАМИ 

// Получение списка проектов для админа (с неопубликованными)
app.get('/api/admin/projects', authenticateToken, async (req, res) => {
    try {
        const { page = 1, search = '', category = '', showAll = 1 } = req.query;

        const result = await pool.request()
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .input('Search', sql.NVarChar, search)
            .input('Category', sql.NVarChar, category)
            .input('ShowAll', sql.Bit, parseInt(showAll))
            .execute('sp_GetProjects');

        const projects = result.recordsets[0].map(p => ({
            ...p,
            MainImage: addImagePath(p.MainImage)
        }));

        res.json({
            projects,
            categories: result.recordsets[2] || [],
            pagination: {
                page: parseInt(page),
                pageSize: 10,
                totalCount: result.recordsets[1]?.[0]?.TotalCount || 0,
                totalPages: Math.ceil((result.recordsets[1]?.[0]?.TotalCount || 0) / 10)
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение одного проекта по ID

app.get('/api/admin/projects/:id', authenticateToken, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) return res.status(400).json({ error: 'Неверный ID' });

        const result = await pool.request()
            .input('Id', sql.Int, projectId)
            .execute('sp_GetProjectById');

        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Проект не найден' });
        }

        const project = result.recordsets[0][0];
        const images = result.recordsets[1] || [];

        project.MainImage = addImagePath(project.MainImage);

        if (project.Features) {
            try { project.Features = JSON.parse(project.Features); }
            catch { project.Features = []; }
        }

        project.Images = images.map(img => ({
            ImageID: img.ImageID,
            FileName: img.FileName,
            Url: addImagePath(img.FileName),
            SortOrder: img.SortOrder
        }));

        res.json(project);
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание нового проекта
app.post('/api/admin/projects', authenticateToken, async (req, res) => {
    try {
        const project = req.body;
        const featuresJson = project.Features ? JSON.stringify(project.Features) : null;

        const result = await pool.request()
            .input('Id', sql.Int, null)
            .input('Title', sql.NVarChar, project.Title)
            .input('Description', sql.NVarChar, project.Description || null)
            .input('ShortDescription', sql.NVarChar, project.ShortDescription || null)
            .input('Category', sql.NVarChar, project.Category)
            .input('Location', sql.NVarChar, project.Location || null)
            .input('Area', sql.Decimal(10,2), project.Area || null)
            .input('Year', sql.Int, project.Year || null)
            .input('Status', sql.NVarChar, project.Status || null)
            .input('MainImage', sql.NVarChar, stripImagePath(project.MainImage))
            .input('Features', sql.NVarChar, featuresJson)
            .input('IsPublished', sql.Bit, project.IsPublished ? 1 : 0)
            .input('SortOrder', sql.Int, project.SortOrder || 0)
            .output('NewId', sql.Int)
            .execute('sp_SaveProject');

        const newId = result.output.NewId;

        // Сохраняем галерею в ProjectImages
        if (project.Images && Array.isArray(project.Images)) {
            for (let i = 0; i < project.Images.length; i++) {
                const img = project.Images[i];
                const filename = typeof img === 'string' ? stripImagePath(img) : stripImagePath(img.FileName);
                if (filename) {
                    await pool.request()
                        .input('ProjectID', sql.Int, newId)
                        .input('FileName', sql.NVarChar, filename)
                        .input('SortOrder', sql.Int, i * 10)
                        .output('NewImageID', sql.Int)
                        .execute('sp_AddProjectImage');
                }
            }
        }

        res.json({ success: true, id: newId, message: 'Проект успешно создан' });
    } catch (err) {
        console.error('Ошибка создания проекта:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.put('/api/admin/projects/:id', authenticateToken, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const project = req.body;
        const featuresJson = project.Features ? JSON.stringify(project.Features) : null;

        await pool.request()
            .input('Id', sql.Int, projectId)
            .input('Title', sql.NVarChar, project.Title)
            .input('Description', sql.NVarChar, project.Description || null)
            .input('ShortDescription', sql.NVarChar, project.ShortDescription || null)
            .input('Category', sql.NVarChar, project.Category)
            .input('Location', sql.NVarChar, project.Location || null)
            .input('Area', sql.Decimal(10,2), project.Area || null)
            .input('Year', sql.Int, project.Year || null)
            .input('Status', sql.NVarChar, project.Status || null)
            .input('MainImage', sql.NVarChar, stripImagePath(project.MainImage))
            .input('Features', sql.NVarChar, featuresJson)
            .input('IsPublished', sql.Bit, project.IsPublished ? 1 : 0)
            .input('SortOrder', sql.Int, project.SortOrder || 0)
            .output('NewId', sql.Int)
            .execute('sp_SaveProject');

        // Обновляем галерею: удаляем старые, вставляем новые
        if (project.Images !== undefined) {
            await pool.request()
                .input('ProjectID', sql.Int, projectId)
                .query('DELETE FROM ProjectImages WHERE ProjectID = @ProjectID');

            if (Array.isArray(project.Images)) {
                for (let i = 0; i < project.Images.length; i++) {
                    const img = project.Images[i];
                    const filename = typeof img === 'string'
                        ? stripImagePath(img)
                        : stripImagePath(img.FileName || img.Url);
                    if (filename) {
                        await pool.request()
                            .input('ProjectID', sql.Int, projectId)
                            .input('FileName', sql.NVarChar, filename)
                            .input('SortOrder', sql.Int, i * 10)
                            .output('NewImageID', sql.Int)
                            .execute('sp_AddProjectImage');
                    }
                }
            }
        }

        res.json({ success: true, id: projectId, message: 'Проект успешно обновлен' });
    } catch (err) {
        console.error('Ошибка обновления:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.delete('/api/admin/projects/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.request()
            .input('Id', sql.Int, parseInt(id))
            .execute('sp_DeleteProject');
        
        res.json({ 
            success: true, 
            message: 'Проект успешно удален'
        });
        
    } catch (err) {
        console.error('Ошибка удаления проекта:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.patch('/api/admin/projects/:id/toggle-publish', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublished } = req.body;
        
        await pool.request()
            .input('Id', sql.Int, parseInt(id))
            .input('IsPublished', sql.Bit, isPublished ? 1 : 0)
            .execute('sp_ToggleProjectPublish');
        
        res.json({ 
            success: true, 
            message: `Проект ${isPublished ? 'опубликован' : 'снят с публикации'}`
        });
        
    } catch (err) {
        console.error('Ошибка обновления статуса:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.patch('/api/admin/projects/:id/sort', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sortOrder } = req.body;
        
        await pool.request()
            .input('Id', sql.Int, parseInt(id))
            .input('SortOrder', sql.Int, sortOrder)
            .execute('sp_UpdateProjectSortOrder');
        
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка обновления сортировки:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});


// Загрузка изображения для проекта
const multer = require('multer');
const fs = require('fs');

// Создаем папку для загрузок, если её нет
const uploadDir = path.join(__dirname, 'public', 'uploads', 'projects');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'project-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены (jpeg, jpg, png, gif, webp)'));
        }
    }
});
// Получение изображений проекта
app.get('/api/admin/projects/:id/images', authenticateToken, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const result = await pool.request()
            .input('ProjectID', sql.Int, projectId)
            .execute('sp_GetProjectImages');

        const images = result.recordset.map(img => ({
            ImageID: img.ImageID,
            FileName: img.FileName,
            Url: addImagePath(img.FileName),
            SortOrder: img.SortOrder
        }));

        res.json(images);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Удаление конкретного изображения из галереи
app.delete('/api/admin/projects/:id/images/:imageId', authenticateToken, async (req, res) => {
    try {
        const imageId = parseInt(req.params.imageId);

        const result = await pool.request()
            .input('ImageID', sql.Int, imageId)
            .output('FileName', sql.NVarChar(255))
            .execute('sp_DeleteProjectImage');

        const filename = result.output.FileName;

        // Удаляем физический файл
        if (filename) {
            const filePath = path.join(__dirname, 'public', 'uploads', 'projects', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление порядка сортировки изображений
app.patch('/api/admin/projects/:id/images/:imageId/sort', authenticateToken, async (req, res) => {
    try {
        const { imageId } = req.params;
        const { sortOrder } = req.body;

        await pool.request()
            .input('ImageID', sql.Int, parseInt(imageId))
            .input('SortOrder', sql.Int, sortOrder)
            .execute('sp_UpdateProjectImageOrder');

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/upload/project-image', authenticateToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }
        
        // Формируем URL для доступа к файлу
        const fileUrl = `/uploads/projects/${req.file.filename}`;
        
        res.json({
            success: true,
            url: fileUrl,
            filename: req.file.filename
        });
        
    } catch (err) {
        console.error('Ошибка загрузки файла:', err);
        res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
});

//  БЫСТРОЕ ОДОБРЕНИЕ ЗАЯВКИ
app.post('/api/manager/applications/:id/quick-approve', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { sendEmail } = req.body;
        
        console.log(' Быстрое одобрение заявки #' + id);
        
        // Вызываем процедуру для быстрого одобрения
        const result = await pool.request()
            .input('ApplicationID', sql.Int, id)
            .input('UserID', sql.Int, req.user.id)
            .input('SendEmail', sql.Bit, sendEmail ? 1 : 0)
            .output('OrderID', sql.Int)
            .output('ClientEmail', sql.NVarChar(150))
            .output('ClientName', sql.NVarChar(200))
            .output('TemporaryPassword', sql.NVarChar(50))
            .output('IsNewUser', sql.Bit)
            .execute('sp_QuickApproveApplication');
        
        console.log(' Заявка быстро одобрена, создан заказ #' + result.output.OrderID);
        
        if (result.output.TemporaryPassword && result.output.ClientEmail) {
            const hashedPassword = await bcrypt.hash(result.output.TemporaryPassword, 10);
            await pool.request()
                .input('Email', sql.NVarChar, result.output.ClientEmail)
                .input('PasswordHash', sql.NVarChar, hashedPassword)
                .query(`UPDATE Users SET PasswordHash = @PasswordHash 
                        WHERE Email = @Email AND Role = 'client'`);
        }
        
        // Отправляем email если нужно
        if (sendEmail && result.output.ClientEmail && result.output.TemporaryPassword) {
            try {
                await sendApprovalEmail(
                    result.output.ClientEmail,
                    result.output.ClientName || 'Клиент',
                    result.output.TemporaryPassword,
                    result.output.IsNewUser
                );
                console.log('Email отправлен');
            } catch (emailError) {
                console.error(' Ошибка отправки email:', emailError);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Заявка одобрена',
            orderId: result.output.OrderID
        });
        
    } catch (err) {
        console.error(' Ошибка при быстром одобрении:', err);
        res.status(500).json({ 
            error: 'Ошибка сервера: ' + err.message
        });
    }
});


//  API: ЗАКАЗЫ 

// Получение списка заказов
app.get('/api/manager/orders', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { page = 1, search = '' } = req.query;
        
        const result = await pool.request()
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .input('Search', sql.NVarChar, search)
            .execute('sp_GetOrders');
        
        const orders = result.recordsets[0];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            orders: orders,
            pagination: {
                page: parseInt(page),
                pageSize: 10,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 10)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения заказов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
app.post('/api/manager/orders/suggest-works', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { objectTypeId, orderId, area, floors } = req.body;

        if (!objectTypeId || !orderId) {
            return res.status(400).json({ error: 'Укажите тип объекта и ID заказа' });
        }

        const rulesResult = await pool.request()
            .input('ObjectTypeID', sql.Int, parseInt(objectTypeId))
            .input('ObjectArea', sql.Decimal(10,2), parseFloat(area) || 0)
            .input('ObjectFloors', sql.Int, parseInt(floors) || 1)
            .execute('sp_GetRecommendedWorks');

        const rules = rulesResult.recordset || [];

        if (rules.length === 0) {
            return res.status(404).json({ error: 'Для данного типа объекта правила не найдены' });
        }

        // Удаляем все существующие работы заказа
        await pool.request()
            .input('ContractID', sql.Int, parseInt(orderId))
            .query('DELETE FROM OrderWorks WHERE ContractID = @ContractID');

        // Добавляем работы из справочника со стоимостью 0
        let added = 0;
        for (const rule of rules) {
            const duration = rule.RecommendedDuration || rule.DefaultDuration || 1;

            await pool.request()
                .input('OrderID', sql.Int, parseInt(orderId))
                .input('WorkTypeID', sql.Int, rule.WorkTypeID)
                .input('Quantity', sql.Decimal(10,2), 1)
                .input('UnitCost', sql.Decimal(18,2), 0)
                .input('Duration', sql.Int, duration)
                .input('ResponsibleUserID', sql.Int, null)
                .input('Comment', sql.NVarChar, 
                    rule.InclusionRule === 'optional' ? 'Опциональная работа — уточните необходимость' : null)
                .output('WorkID', sql.Int)
                .execute('sp_AddOrderWork');

            added++;
        }

        res.json({ 
            success: true, 
            added,
            message: `Добавлено ${added} работ. Заполните стоимость для каждой.`
        });

    } catch (err) {
        console.error('Ошибка расчёта работ:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});


app.post('/api/manager/orders/:id/apply-suggested-durations', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { works } = req.body;

        if (!works || !works.length) {
            return res.status(400).json({ error: 'Нет работ для обновления' });
        }

        const orderResult = await pool.request()
            .input('OrderID', sql.Int, orderId)
            .execute('sp_GetOrderDetails');

        const orderWorks = orderResult.recordsets[1] || [];
        let updated = 0;

        for (const suggestion of works) {
            const match = orderWorks.find(w => w.WorkTypeID === suggestion.WorkTypeID);
            if (!match) continue;

            await pool.request()
                .input('WorkID',   sql.Int, match.WorkID || match.OrderWorkID)
                .input('Duration', sql.Int, suggestion.RecommendedDuration)
                .query(`
                    UPDATE OrderWorks
                    SET Duration = @Duration
                    WHERE OrderWorkID = @WorkID
                `);
            updated++;
        }

        res.json({ 
            success: true, 
            message: `Обновлено ${updated} из ${works.length} работ`,
            updated 
        });

    } catch (err) {
        console.error('Ошибка применения сроков:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Получение деталей заказа
app.get('/api/manager/orders/:id', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Преобразуем id в число
        const orderId = parseInt(id);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'Неверный ID заказа' });
        }
        
        const result = await pool.request()
            .input('OrderID', sql.Int, orderId)
            .execute('sp_GetOrderDetails');
        
        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        
        const order = result.recordsets[0][0];
        const works = result.recordsets[1] || [];
        
        // Функция для форматирования даты
        function formatDate(dateValue) {
            if (!dateValue) return null;
            if (dateValue instanceof Date) {
                return dateValue.toISOString().split('T')[0];
            }
            if (typeof dateValue === 'string') {
                if (dateValue.includes('T')) {
                    return dateValue.split('T')[0];
                }
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                    return dateValue;
                }
            }
            return dateValue;
        }
        
        // Форматируем даты
        if (order.SignDate) {
            order.SignDate = formatDate(order.SignDate);
        }
        
        // Извлекаем детали договора
        const contractDetails = result.recordsets[2]?.[0] || {};  // третий recordset
        console.log('contractDetails полный:', JSON.stringify(contractDetails)); // ← СЮДА

        const details = {
            StartDate: formatDate(contractDetails.StartDate),
            EndDate: formatDate(contractDetails.EndDate),
            CostWithoutVAT: contractDetails.CostWithoutVAT,
            VATRate: contractDetails.VATRate,
            VATAmount: contractDetails.VATAmount,
            VATAmountWords: contractDetails.VATAmountWords,
            TotalCostWords: contractDetails.TotalCostWords,
            PaymentSchedule: contractDetails.PaymentSchedule
        };
        
        // Удаляем дублирующиеся поля из order
        delete order.StartDate;
delete order.EndDate;
        delete order.CostWithoutVAT;
        delete order.VATRate;
        delete order.VATAmount;
        delete order.TotalCostWords;
        delete order.PaymentSchedule;
        
        res.json({
            order: order,
            works: works,
            details: details
        });
        
    } catch (err) {
        console.error('Ошибка получения деталей заказа:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление заказа
app.put('/api/manager/orders/:id', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        
        console.log('Обновление заказа #' + id);
        console.log('ФИО (раздельно):', {
            lastName: data.directorLastName,
            firstName: data.directorFirstName,
            patronymic: data.directorPatronymic
        });
        
        function formatDate(dateValue) {
            if (!dateValue) return null;
            if (typeof dateValue === 'string') {
                if (dateValue.includes('T')) return dateValue.split('T')[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
            }
            if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
                return dateValue.toISOString().split('T')[0];
            }
            return null;
        }
        // Автоматический пересчёт VATAmount если не указан явно
let vatAmount = data.vatAmount ? parseFloat(data.vatAmount) : null;
const costWithoutVAT = data.costWithoutVAT ? parseFloat(data.costWithoutVAT) : null;
const vatRate = data.vatRate ? parseInt(data.vatRate) : null;

if (costWithoutVAT && vatRate !== null && (!vatAmount || vatAmount === 0)) {
    vatAmount = Math.round(costWithoutVAT * vatRate / 100 * 100) / 100;
}
        const request = pool.request()
            .input('OrderID', sql.Int, parseInt(id))
            .input('ContractNumber', sql.NVarChar, data.contractNumber || null)
            .input('SignDate', sql.Date, formatDate(data.signDate))
            .input('City', sql.NVarChar, data.city || null)
            .input('Status', sql.NVarChar, data.status || null)
            .input('Notes', sql.NVarChar, data.notes || null)
            .input('CompanyName', sql.NVarChar, data.companyName || null)
            .input('UNP', sql.NVarChar, data.unp || null)
            .input('OKPO', sql.NVarChar, data.okpo || null)
            .input('LegalAddress', sql.NVarChar, data.legalAddress || null)
            .input('DirectorLastName', sql.NVarChar, data.directorLastName || null)
            .input('DirectorFirstName', sql.NVarChar, data.directorFirstName || null)
            .input('DirectorPatronymic', sql.NVarChar, data.directorPatronymic || null)
            .input('DirectorPosition', sql.NVarChar, data.directorPosition || null)
            .input('ClientEmail', sql.NVarChar, data.clientEmail || null)
            .input('ClientPhone', sql.NVarChar, data.clientPhone || null)
            .input('ObjectName', sql.NVarChar, data.objectName || null)
            .input('ObjectAddress', sql.NVarChar, data.objectAddress || null)
            .input('ObjectDescription', sql.NVarChar, data.objectDescription || null)
            .input('ObjectTypeID', sql.Int, data.objectTypeId || null)
            .input('BankName', sql.NVarChar, data.bankName || null)
            .input('BankAccount', sql.NVarChar, data.bankAccount || null)
            .input('BankBIC', sql.NVarChar, data.bankBIC || null)
            .input('BankIsPrimary', sql.Bit, data.bankIsPrimary ? 1 : 0)
            .input('StartDate', sql.Date, formatDate(data.startDate))
            .input('EndDate', sql.Date, formatDate(data.endDate))
            .input('CostWithoutVAT', sql.Decimal(18,2), data.costWithoutVAT ? parseFloat(data.costWithoutVAT) : null)
            .input('VATRate', sql.Int, data.vatRate ? parseInt(data.vatRate) : null)
            .input('VATAmount', sql.Decimal(18,2), vatAmount)
            .input('VATAmountWords', sql.NVarChar, data.VATAmountWords || null)
            .input('TotalCostWords', sql.NVarChar, data.totalCostWords || null)
            .input('PaymentSchedule', sql.NVarChar, data.paymentSchedule || null);
        
        const result = await request.execute('sp_UpdateOrder');
        
        const updatedOrder = result.recordsets[0]?.[0];
        const updatedWorks = result.recordsets[1] || [];
        
        res.json({ 
            success: true, 
            message: 'Заказ успешно обновлен',
            order: updatedOrder,
            works: updatedWorks
        });
        
    } catch (err) {
        console.error('Ошибка обновления заказа:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Добавление работы в заказ
app.post('/api/manager/orders/:id/works', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { workTypeId, quantity, unitCost, duration, comment } = req.body;
        const responsibleUserId = req.user.id;
        const result = await pool.request()
            .input('OrderID', sql.Int, parseInt(id))
            .input('WorkTypeID', sql.Int, parseInt(workTypeId))
            .input('Quantity', sql.Decimal(10,2), parseFloat(quantity))
            .input('UnitCost', sql.Decimal(18,2), parseFloat(unitCost))
            .input('Duration', sql.Int, parseInt(duration))
            .input('ResponsibleUserID', sql.Int, responsibleUserId ? parseInt(responsibleUserId) : null)
            .input('Comment', sql.NVarChar, comment || null)
            .output('WorkID', sql.Int)
            .execute('sp_AddOrderWork');
        
        res.json({ 
            success: true, 
            workId: result.output.WorkID 
        });
        
    } catch (err) {
        console.error('Ошибка добавления работы:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Получение работы по ID
app.get('/api/manager/works/:id', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('WorkID', sql.Int, parseInt(id))
            .query(`
                SELECT 
                    ow.OrderWorkID as WorkID,
                    ow.ContractID,
                    ow.WorkTypeID,
                    ow.Quantity,
                    ow.UnitCost,
                    ow.Duration,
                    ow.Status,
                    ow.Comment,
                    ow.ResponsibleUserID,
                    wt.WorkName
                FROM OrderWorks ow
                JOIN WorkTypes wt ON ow.WorkTypeID = wt.WorkTypeID
                WHERE ow.OrderWorkID = @WorkID
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Работа не найдена' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('Ошибка получения работы:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление работы
app.put('/api/manager/works/:id', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { workTypeId, quantity, unitCost, duration, responsibleUserId, status, comment } = req.body;
        
        await pool.request()
            .input('WorkID', sql.Int, parseInt(id))
            .input('WorkTypeID', sql.Int, workTypeId ? parseInt(workTypeId) : null)
            .input('Quantity', sql.Decimal(10,2), quantity ? parseFloat(quantity) : null)
            .input('UnitCost', sql.Decimal(18,2), unitCost ? parseFloat(unitCost) : null)
            .input('Duration', sql.Int, duration ? parseInt(duration) : null)
            .input('ResponsibleUserID', sql.Int, responsibleUserId ? parseInt(responsibleUserId) : null)
            .input('Status', sql.NVarChar, status || null)
            .input('Comment', sql.NVarChar, comment || null)
            .execute('sp_UpdateOrderWork');
try {
    const info = await pool.request()
        .input('WorkID', sql.Int, parseInt(id))
        .execute('sp_GetWorkClientInfo');

    if (info.recordset.length) {
        const { UserID, WorkName, Status } = info.recordset[0];
        const statusLabel = {
            'Выполнен':      'Завершена',
            'В процессе':    'Начата',
            'Приостановлен': 'Приостановлена',
            'Не начат':      'Ожидает',
        }[Status] || Status;

        await sendPushToClient(UserID, {
            title: `${statusLabel}: ${WorkName}`,
            body:  'Статус работы обновлён',
            url:   '/client',
            tag:   `work-${id}`,
        });
    }
} catch (pushErr) {
    console.error('Push (work update):', pushErr);
}
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка обновления работы:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Удаление работы
app.delete('/api/manager/works/:id', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.request()
            .input('WorkID', sql.Int, parseInt(id))
            .execute('sp_DeleteOrderWork');
        
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка удаления работы:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Статистика по заказам
app.get('/api/manager/orders-stats', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetOrdersStats');
        
        res.json(result.recordset[0] || {
            TotalOrders: 0,
            InProgressOrders: 0,
            CompletedOrders: 0,
            TotalRevenue: 0
        });
        
    } catch (err) {
        console.error('Ошибка получения статистики заказов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Массовое добавление вида работы в правила
app.post('/api/admin/work-types/:id/add-to-rules', authenticateToken, async (req, res) => {
    try {
        const workTypeId = parseInt(req.params.id);
        const { rules, workName } = req.body;
        
        if (!rules || !rules.length) {
            return res.status(400).json({ error: 'Не выбрано ни одного правила' });
        }
        
        const request = pool.request();
        request.input('WorkTypeID', sql.Int, workTypeId);
        
        // Создаём табличный параметр или JSON для массовой вставки
        const rulesJson = JSON.stringify(rules.map(rule => ({
            ObjectTypeID: rule.objectTypeId,
            InclusionRule: rule.inclusionRule,
            DurationMultiplier: rule.durationMultiplier,
            MinDuration: rule.minDuration,
            IsRequired: rule.isRequired ? 1 : 0,
            SortOrder: rule.sortOrder || 0
        })));
        
        request.input('RulesJSON', sql.NVarChar('max'), rulesJson);
        
        const result = await request.execute('sp_Admin_BulkAddWorkRules');
        
        res.json({ 
            success: true, 
            added: result.recordset?.[0]?.AddedCount || rules.length,
            message: `Вид работы "${workName}" добавлен в правила` 
        });
        
    } catch (err) {
        console.error('Ошибка массового добавления правил:', err);
        res.status(500).json({ error: err.message });
    }
});
// API: БАНКОВСКИЕ РЕКВИЗИТЫ 

// Получение банковских реквизитов компании
app.post('/api/companies/:companyId/bank-details', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { companyId } = req.params;
        const { bankName, bankAccount, bankBIC, isPrimary } = req.body;
        
        await pool.request()
            .input('CompanyID', sql.Int, parseInt(companyId))
            .input('BankName', sql.NVarChar, bankName)
            .input('BankAccount', sql.NVarChar, bankAccount)
            .input('BankBIC', sql.NVarChar, bankBIC)
            .input('IsPrimary', sql.Bit, isPrimary ? 1 : 0)
            .execute('sp_SaveCompanyBankDetails');
        
        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка сохранения банковских реквизитов:', err);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/companies/:companyId/bank-details', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('GET запрос банковских реквизитов для companyId:', companyId);
        
        const result = await pool.request()
            .input('CompanyID', sql.Int, parseInt(companyId))
            .query(`
                SELECT 
                    BankDetailID,
                    CompanyID,
                    ISNULL(BankName, '') as BankName,
                    ISNULL(BankAccount, '') as BankAccount,
                    ISNULL(BankBIC, '') as BankBIC,
                    ISNULL(IsPrimary, 0) as IsPrimary
                FROM CompanyBankDetails 
                WHERE CompanyID = @CompanyID
                ORDER BY IsPrimary DESC, BankDetailID ASC
            `);
        
        console.log('Найдено реквизитов:', result.recordset.length);
        
        // Возвращаем массив (даже если пустой)
        res.json(result.recordset || []);
        
    } catch (err) {
        console.error('Ошибка получения банковских реквизитов:', err);
        res.status(500).json({ error: err.message });
    }
});
//  API: СПРАВОЧНИКИ 

// Получение списка видов работ
app.get('/api/work-types', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetWorkTypes');
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения видов работ:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение списка специалистов
app.get('/api/specialists', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetSpecialistsList');
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения специалистов:', err);
        res.status(500).json({ error: err.message });
    }
});

// API: ТИПЫ ОБЪЕКТОВ
app.get('/api/object-types', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, 0)
            .execute('sp_GetObjectTypes');
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения типов объектов:', err);
        res.status(500).json({ error: err.message });
    }
});
app.get('/api/manager/orders/:id/contract-preview', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
 
        const result = await pool.request()
            .input('ContractID', sql.Int, parseInt(id))
            .input('IncludeWorks', sql.Bit, 1)
            .execute('sp_GenerateContract');
 
        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }
 
        const contract = result.recordsets[0][0];
        const works    = result.recordsets[1] || [];
 
        const html = generateFullContractHTML(contract, works);
 
        res.json({ success: true, html });
 
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/manager/orders/:id/contract-preview-page', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.request()
            .input('ContractID', sql.Int, parseInt(id))
            .input('IncludeWorks', sql.Bit, 1)
            .execute('sp_GenerateContract');

        if (result.recordsets[0].length === 0) {
            return res.status(404).send('<p>Договор не найден</p>');
        }

        const contract = result.recordsets[0][0];
        const works = result.recordsets[1] || [];

        const html = generateFullContractHTML(contract, works);
        res.send(html);

    } catch (err) {
        console.error('Ошибка превью договора:', err);
        res.status(500).send('<p>Ошибка: ' + err.message + '</p>');
    }
});

// Получение текста договора
app.get('/api/manager/orders/:id/contract', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('ContractID', sql.Int, parseInt(id))
            .input('IncludeWorks', sql.Bit, 1)
            .execute('sp_GenerateContract');
        
        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }
        
        res.json({
            contract: result.recordsets[0][0],
            works: result.recordsets[1] || []
        });
        
    } catch (err) {
        console.error('Ошибка получения договора:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});


app.get('/api/manager/orders/:id/contract/download', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { execFile } = require('child_process');
        const path = require('path');
        const os = require('os');

        const result = await pool.request()
            .input('ContractID', sql.Int, parseInt(id))
            .input('IncludeWorks', sql.Bit, 1)
            .execute('sp_GenerateContract');

        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }

        const contract = result.recordsets[0][0];
        const works = result.recordsets[1] || [];

        // Форматируем дату
        const contractDate = contract.SignDate ? new Date(contract.SignDate) : new Date();
        const day = contractDate.getDate().toString().padStart(2, '0');
        const monthNames = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        const month = monthNames[contractDate.getMonth()];
        const year = contractDate.getFullYear();

        // Дата начала/окончания
        function formatRuDate(d) {
            if (!d) return '___';
            const dt = new Date(d);
            const mn = monthNames[dt.getMonth()];
            return `${dt.getDate()} ${mn} ${dt.getFullYear()}`;
        }

        const contractData = {
            contractNumber: contract.ContractNumber || id,
            city: (contract.City || 'г. Минск').replace('г. ', ''),
            day,
            month,
            year: String(year),

    clientCompanyFull: contract.CompanyName || '____________________',
    clientAuthorityDoc: 'Устава',

    clientDirectorLastName: contract.DirectorLastName || '',
    clientDirectorFirstName: contract.DirectorFirstName || '',
    clientDirectorPatronymic: contract.DirectorPatronymic || '',
    clientDirectorPosition: contract.DirectorPosition || 'директора',

            // Объект
            objectName: [contract.ObjectName, contract.ObjectAddress].filter(Boolean).join(', расположенного по адресу: ') || '____________________',

            // Сроки
            startDate: formatRuDate(contract.StartDate),
            endDate: formatRuDate(contract.EndDate),

            // Стоимость
            costWithoutVAT: contract.CostWithoutVAT ? Number(contract.CostWithoutVAT).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            vatRate: String(contract.VATRate || 20),
            vatAmount: contract.VATAmount ? Number(contract.VATAmount).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            totalCost: contract.TotalCost ? Number(contract.TotalCost).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            totalCostWords: contract.TotalCostWords || '________________________________________________',
            vatAmountWords: contract.VATAmountWords || null,
            paymentSchedule: contract.PaymentSchedule || '',

            // Реквизиты заказчика
            clientName: contract.CompanyName || '____________________',
            clientUNP: contract.UNP || '____',      
            clientOKPO: contract.OKPO || '____',
            clientAddress: contract.LegalAddress || '____________________',
            clientBank: contract.ClientBank || '____________________',
            clientBankName: contract.ClientBankName || '____________________',
            clientBankBIC: contract.ClientBankBIC || '____',
            clientEmail: contract.ClientEmail || '',
            clientPhone: contract.ClientPhone || '',
            clientFax: contract.ClientFax || '',
            clientDirectorShort: contract.DirectorName || '____________________',

            clientDirectorShort: (() => {
                if (contract.DirectorLastName) {
                    const firstNameInitial = contract.DirectorFirstName ? contract.DirectorFirstName.charAt(0).toUpperCase() + '.' : '';
                    const patronymicInitial = contract.DirectorPatronymic ? contract.DirectorPatronymic.charAt(0).toUpperCase() + '.' : '';
                    return `${contract.DirectorLastName} ${firstNameInitial}${patronymicInitial}`.trim();
                }
                return contract.DirectorName || '____________________';
            })(),
            // Реквизиты подрядчика (константы)
            contractorName: 'ООО «МСК Релайбл»',
            contractorAddress: '220113, г. Минск, ул. Мележа, д. 4',
            contractorUNP: '193607959',
            contractorBank: 'BY91ALFA30122B38250010270000 в BYN',
            contractorBankName: 'ЗАО «Альфа-Банк»',
            contractorBankBIC: 'ALFABY2X',
            contractorBankAddress: '220013, г. Минск, ул. Сурганова, 43-47',
            contractorEmail: 'MCK-Reliable@yandex.ru',
            contractorPhone: '+375444543857',
            contractorDirectorShort: 'В.И. Хурс',

            // Работы
            works: works.map(w => ({
                name: w.WorkName || '',
                quantity: String(w.Quantity || ''),
                unitCost: w.UnitCost ? Number(w.UnitCost).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
                total: (w.Quantity && w.UnitCost)
                    ? Number(w.Quantity * w.UnitCost).toLocaleString('ru', {minimumFractionDigits:2})
                    : '0,00',
            }))
        };

        // Временный файл для вывода
        const tmpPath = path.join(os.tmpdir(), `contract_${id}_${Date.now()}.docx`);
        const scriptPath = path.join(__dirname, 'generate_contract.js');

        await new Promise((resolve, reject) => {
            execFile('node', [scriptPath, JSON.stringify(contractData), tmpPath], (err, stdout, stderr) => {
                if (err) reject(new Error(stderr || err.message));
                else resolve();
            });
        });

        const buffer = require('fs').readFileSync(tmpPath);
        require('fs').unlinkSync(tmpPath); // удаляем временный файл

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        const filenameDocx = `Договор_${contractData.contractNumber}_${day}_${month}_${year}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(filenameDocx)}`);
        res.send(buffer);

    } catch (err) {
        console.error("Ошибка генерации DOCX:", err);
        res.status(500).json({ error: "Ошибка генерации договора: " + err.message });
    }
});


// Сохранение суммы прописью
app.post('/api/manager/orders/:id/contract/total-words', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const { id } = req.params;
        const { totalCostWords } = req.body;
        
        await pool.request()
            .input('ContractID', sql.Int, parseInt(id))
            .input('TotalCostWords', sql.NVarChar, totalCostWords)
            .query(`
                UPDATE ContractDetails 
                SET TotalCostWords = @TotalCostWords
                WHERE ContractID = @ContractID
            `);
        
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка сохранения суммы прописью:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Страница, которая предложит установить приложение
app.get('/install-app', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Установка приложения</title>
            <link rel="manifest" href="/manifest.json">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
                .btn { background: #e31e24; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 18px; cursor: pointer; }
            </style>
        </head>
        <body>
            <h1>Установите приложение "Личный кабинет"</h1>
            <p>Нажмите кнопку ниже, чтобы установить приложение на телефон</p>
            <button class="btn" onclick="installPWA()">Установить приложение</button>
            
            <script>
                let deferredPrompt;
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    deferredPrompt = e;
                });
                
                async function installPWA() {
                    if (!deferredPrompt) {
                        alert('Для установки нажмите "Поделиться" → "На экран домой"');
                        return;
                    }
                    deferredPrompt.prompt();
                }
                
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw.js');
                }
            </script>
        </body>
        </html>
    `);
});

// API: КЛИЕНТСКИЙ КАБИНЕТ 

// Функция проверки токена клиента
async function authenticateClient(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Недействительный токен' });
        if (user.role !== 'client') return res.status(403).json({ error: 'Доступ запрещен' });
        req.user = user;
        next();
    });
}

// Вход клиента
app.post('/api/client/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('Role', sql.NVarChar, 'client')
            .query('SELECT UserID, Login, PasswordHash, FullName, Email, Phone FROM Users WHERE Email = @Email AND Role = @Role AND IsActive = 1');
        
        const user = result.recordset[0];
        
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        // Проверка пароля
        const isValid = await bcrypt.compare(password, user.PasswordHash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }
        
        const token = jwt.sign(
            { id: user.UserID, email: user.Email, role: 'client' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.UserID,
                name: user.FullName,
                email: user.Email,
                phone: user.Phone
            }
        });
        
    } catch (err) {
        console.error('Ошибка входа клиента:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Профиль клиента
app.get('/api/client/profile', authenticateClient, async (req, res) => {
    try {
        const result = await pool.request()
            .input('UserID', sql.Int, req.user.id)
            .execute('sp_GetClientProfile');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Профиль не найден' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Ошибка получения профиля:', err);
        res.status(500).json({ error: err.message });
    }
});

// Дашборд клиента
app.get('/api/client/dashboard', authenticateClient, async (req, res) => {
    try {
        const result = await pool.request()
            .input('ClientUserID', sql.Int, req.user.id)
            .execute('sp_GetClientDashboard');
        
        res.json({
            stats: result.recordsets[0][0] || { totalOrders: 0, inProgress: 0, completed: 0, reviews: 0 },
            recentOrders: result.recordsets[1] || []
        });
    } catch (err) {
        console.error('Ошибка получения данных:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Список заказов клиента
app.get('/api/client/orders', authenticateClient, async (req, res) => {
    try {
        const result = await pool.request()
            .input('ClientUserID', sql.Int, req.user.id)
            .execute('sp_GetClientOrders');
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения заказов:', err);
        res.status(500).json({ error: err.message });
    }
});

// Документы клиента
app.get('/api/client/documents', authenticateClient, async (req, res) => {
    try {
        const result = await pool.request()
            .input('ClientUserID', sql.Int, req.user.id)
            .execute('sp_GetClientDocuments');
        
        const docs = result.recordset.map(d => ({
            ...d,
            url: `/api/client/orders/${d.ContractID}/contract/download`,
            date: new Date(d.date).toLocaleDateString('ru-RU')
        }));
        
        res.json(docs);
    } catch (err) {
        console.error('Ошибка получения документов:', err);
        res.status(500).json({ error: err.message });
    }
});

// Смена пароля
app.post('/api/client/change-password', authenticateClient, async (req, res) => {
    try {
        const { password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.request()
            .input('UserID', sql.Int, req.user.id)
            .input('PasswordHash', sql.NVarChar, hashedPassword)
            .query('UPDATE Users SET PasswordHash = @PasswordHash WHERE UserID = @UserID');
        
        res.json({ success: true });
        
    } catch (err) {
        console.error('Ошибка смены пароля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// Список заказов с проверкой отзывов
app.get('/api/client/orders-with-reviews', authenticateClient, async (req, res) => {
    try {
        const result = await pool.request()
            .input('ClientUserID', sql.Int, req.user.id)
            .execute('sp_GetClientOrdersWithReviews');
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения заказов с отзывами:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отправка отзыва
app.post('/api/client/reviews', authenticateClient, async (req, res) => {
    try {
        const { applicationId, rating, reviewText } = req.body;
        
        if (!applicationId || !rating) {
            return res.status(400).json({ error: 'Укажите заказ и оценку' });
        }
        
        const result = await pool.request()
            .input('ApplicationID', sql.Int, parseInt(applicationId))
            .input('ClientUserID', sql.Int, req.user.id)
            .input('Rating', sql.TinyInt, parseInt(rating))
            .input('ReviewText', sql.NVarChar, reviewText || null)
            .output('ReviewID', sql.Int)
            .execute('sp_AddReview');
        
        res.json({ success: true, reviewId: result.output.ReviewID });
    } catch (err) {
        console.error('Ошибка отправки отзыва:', err);
        const message = err.originalError?.info?.message || err.message || 'Ошибка сервера';
        res.status(400).json({ error: message });
    }
});
// API: ТИПЫ ОБЪЕКТОВ ДЛЯ ПРОЕКТОВ 
app.get('/api/object-types/all', authenticateToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, 1)
            .execute('sp_GetObjectTypes');
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения типов объектов:', err);
        res.status(500).json({ error: err.message });
    }
});

// Публичный endpoint для галереи (без авторизации)
app.get('/api/object-types/public', async (req, res) => {
    try {
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, 0)
            .execute('sp_GetObjectTypes');
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения типов объектов:', err);
        res.status(500).json({ error: err.message });
    }
});

//  API: ПРОВЕРКА

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: pool ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

app.get('/api/test', async (req, res) => {
    try {
        if (!pool) {
            return res.json({ server: 'running', database: 'disconnected' });
        }
        
        const testResult = await pool.request().query('SELECT 1 as test');
        
        res.json({
            server: 'running',
            database: 'connected',
            testQuery: testResult.recordset[0].test,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.json({ server: 'running', database: 'error', error: err.message });
    }
});
// API: УПРАВЛЕНИЕ СПЕЦИАЛИСТАМИ

// Получение списка специалистов
app.get('/api/admin/specialists', authenticateToken, async (req, res) => {
    try {
        const { page = 1, search = '', showInactive = 0 } = req.query;
        
        const result = await pool.request()
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .input('Search', sql.NVarChar, search)
            .input('ShowInactive', sql.Bit, parseInt(showInactive))
            .execute('sp_GetSpecialists');
        
        const specialists = result.recordsets[0];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            specialists: specialists,
            pagination: {
                page: parseInt(page),
                pageSize: 10,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 10)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения специалистов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение статистики по специалистам
app.get('/api/admin/specialists/stats', authenticateToken, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetSpecialistsStats');
        
        res.json(result.recordset[0] || {
            TotalSpecialists: 0,
            ActiveSpecialists: 0,
            Admins: 0
        });
        
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение специалиста по ID
app.get('/api/admin/specialists/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Неверный ID пользователя' });
        }
        
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .execute('sp_GetSpecialistById');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Специалист не найден' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('Ошибка получения специалиста:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание нового специалиста
app.post('/api/admin/specialists', authenticateToken, async (req, res) => {
    try {
        const { login, password, fullName, email, phone, role, isActive } = req.body;
        
        // Валидация
        if (!login || !password || !fullName || !email) {
            return res.status(400).json({ error: 'Заполните обязательные поля' });
        }
        
        // Хешируем пароль
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = await pool.request()
            .input('Login', sql.NVarChar, login)
            .input('PasswordHash', sql.NVarChar, passwordHash)
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email)
            .input('Phone', sql.NVarChar, phone || null)
            .input('Role', sql.NVarChar, role || 'specialist')
            .input('IsActive', sql.Bit, isActive ? 1 : 0)
            .output('NewUserID', sql.Int)
            .execute('sp_CreateSpecialist');
        
        res.json({
            success: true,
            id: result.output.NewUserID,
            message: 'Специалист успешно создан'
        });
        
    } catch (err) {
        console.error('Ошибка создания специалиста:', err);
        
        if (err.message.includes('логином уже существует')) {
            return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
        }
        if (err.message.includes('email уже существует')) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Обновление специалиста
app.put('/api/admin/specialists/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const { fullName, email, phone, role, isActive } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Неверный ID пользователя' });
        }
        
        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('FullName', sql.NVarChar, fullName)
            .input('Email', sql.NVarChar, email)
            .input('Phone', sql.NVarChar, phone || null)
            .input('Role', sql.NVarChar, role)
            .input('IsActive', sql.Bit, isActive ? 1 : 0)
            .execute('sp_UpdateSpecialist');
        
        res.json({
            success: true,
            message: 'Данные специалиста обновлены'
        });
        
    } catch (err) {
        console.error('Ошибка обновления специалиста:', err);
        
        if (err.message.includes('email уже существует')) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Смена пароля специалиста
app.post('/api/admin/specialists/:id/change-password', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const { password } = req.body;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Неверный ID пользователя' });
        }
        
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('PasswordHash', sql.NVarChar, passwordHash)
            .execute('sp_ChangeSpecialistPassword');
        
        res.json({
            success: true,
            message: 'Пароль успешно изменен'
        });
        
    } catch (err) {
        console.error('Ошибка смены пароля:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Удаление/деактивация специалиста
app.delete('/api/admin/specialists/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const { hardDelete } = req.query;
        
        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Неверный ID пользователя' });
        }
        
        // Не даем удалить самого себя
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Нельзя удалить собственную учетную запись' });
        }
        
        await pool.request()
            .input('UserID', sql.Int, userId)
            .input('HardDelete', sql.Bit, hardDelete === 'true' ? 1 : 0)
            .execute('sp_DeleteSpecialist');
        
        res.json({
            success: true,
            message: hardDelete === 'true' ? 'Специалист удален' : 'Специалист деактивирован'
        });
        
    } catch (err) {
        console.error('Ошибка удаления специалиста:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});


// API: ИСТОРИЯ РАБОТЫ СПЕЦИАЛИСТА 

// Получение истории специалиста
app.get('/api/admin/specialists/:id/history', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, actionType, dateFrom, dateTo } = req.query;
        const specialistId = parseInt(id);
        
        if (isNaN(specialistId)) {
            return res.status(400).json({ error: 'Неверный ID специалиста' });
        }
        
        const result = await pool.request()
            .input('SpecialistID', sql.Int, specialistId)
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 20)
            .input('ActionType', sql.NVarChar, actionType || null)
            .input('DateFrom', sql.Date, dateFrom || null)
            .input('DateTo', sql.Date, dateTo || null)
            .execute('sp_GetSpecialistHistory');
        
        const history = result.recordsets[0];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            history: history,
            pagination: {
                page: parseInt(page),
                pageSize: 20,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 20)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения истории:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение статистики специалиста
app.get('/api/admin/specialists/:id/stats', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const specialistId = parseInt(id);
        
        if (isNaN(specialistId)) {
            return res.status(400).json({ error: 'Неверный ID специалиста' });
        }
        
        const result = await pool.request()
            .input('SpecialistID', sql.Int, specialistId)
            .execute('sp_GetSpecialistStats');
        
        res.json(result.recordset[0] || {
            TotalApplications: 0,
            CompletedApplications: 0,
            TotalOrders: 0,
            TotalRevenue: 0,
            TotalClients: 0
        });
        
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


// API: ОТЧЕТЫ (ЧТЕНИЕ)

app.get('/api/admin/reports/clients', authenticateToken, async (req, res) => {
    try {
        const { dateFrom, dateTo, groupBy = 'month' } = req.query;
        const df = dateFrom || '2020-01-01';
        const dt = dateTo   || new Date().toISOString().split('T')[0];

        const result = await pool.request()
            .input('DateFrom', sql.Date, df)
            .input('DateTo',   sql.Date, dt)
            .input('GroupBy',  sql.NVarChar, groupBy)
            .execute('sp_Report_ClientsByPeriod');

        res.json({
            summary:    result.recordsets[0][0] || {},
            dynamics:   result.recordsets[1]    || [],
            topClients: result.recordsets[2]    || []
        });
    } catch (err) {
        console.error('Ошибка отчёта по клиентам:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.get('/api/admin/reports/orders/period', authenticateToken, async (req, res) => {
    try {
        const { dateFrom, dateTo, groupBy = 'month', status } = req.query;
        const df = dateFrom || '2020-01-01';
        const dt = dateTo   || new Date().toISOString().split('T')[0];

        const result = await pool.request()
            .input('DateFrom', sql.Date,     df)
            .input('DateTo',   sql.Date,     dt)
            .input('GroupBy',  sql.NVarChar, groupBy)
            .input('Status',   sql.NVarChar, status || null)
            .execute('sp_Report_OrdersByPeriod');

        res.json({
            summary:  result.recordsets[0][0] || {},
            dynamics: result.recordsets[1]    || []
        });
    } catch (err) {
        console.error('Ошибка отчёта по заказам:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

app.get('/api/admin/reports/orders/filter', authenticateToken, async (req, res) => {
    try {
        const { dateFrom, dateTo, status, specialistId,
                category, minAmount, maxAmount } = req.query;

        const result = await pool.request()
            .input('DateFrom',     sql.Date,         dateFrom     || null)
            .input('DateTo',       sql.Date,         dateTo       || null)
            .input('Status',       sql.NVarChar,     status       || null)
            .input('SpecialistID', sql.Int,           specialistId ? parseInt(specialistId) : null)
            .input('Category',     sql.NVarChar,     category     || null)
            .input('MinAmount',    sql.Decimal(18,2), minAmount   ? parseFloat(minAmount)  : null)
            .input('MaxAmount',    sql.Decimal(18,2), maxAmount   ? parseFloat(maxAmount)  : null)
            .execute('sp_Report_OrdersByParams');

        res.json(result.recordset || []);
    } catch (err) {
        console.error('Ошибка фильтра заказов:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});
//  API: ОТЧЕТЫ 

async function exportReportToExcel(type, data, dateFrom, dateTo, res) {
    const timestamp = Date.now();
    const tmpPath = path.join(os.tmpdir(), `report_${type}_${timestamp}.xlsx`);
    const tmpDataPath = path.join(os.tmpdir(), `report_data_${timestamp}.json`);
    const scriptPath = path.join(__dirname, 'generate_report.py');

    const dfStr = dateFrom || '';
    const dtStr = dateTo || '';

    try {
        // Пишем данные во временный файл
        fs.writeFileSync(tmpDataPath, JSON.stringify(data), 'utf8');

        // Вызываем Python скрипт
        await new Promise((resolve, reject) => {
            execFile(
                'python',
                [scriptPath, type, tmpDataPath, dfStr, dtStr, tmpPath],
                { maxBuffer: 20 * 1024 * 1024 },
                (err, stdout, stderr) => {
                    // Удаляем файл с данными в любом случае
                    fs.unlink(tmpDataPath, () => {});
                    
                    if (err) {
                        console.error('Ошибка Python:', stderr);
                        reject(new Error(stderr || err.message));
                    } else {
                        console.log('Python stdout:', stdout);
                        resolve(stdout);
                    }
                }
            );
        });

        // Проверяем, что файл создан
        if (!fs.existsSync(tmpPath)) {
            throw new Error('Файл отчета не был создан');
        }

        // Читаем созданный файл
        const buffer = fs.readFileSync(tmpPath);
        
        // Удаляем временный файл
        fs.unlink(tmpPath, () => {});

        // Устанавливаем заголовки для скачивания
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="report_${type}_${dateFrom}_${dateTo}.xlsx"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        
        // Отправляем файл
        res.send(buffer);
        
    } catch (err) {
        console.error('Ошибка генерации Excel:', err);
        
        // Очищаем временные файлы в случае ошибки
        try {
            if (fs.existsSync(tmpDataPath)) fs.unlinkSync(tmpDataPath);
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (e) {}
        
        res.status(500).json({ error: 'Ошибка генерации Excel: ' + err.message });
    }
}

app.post('/api/admin/reports/export/excel', authenticateToken, async (req, res) => {
    const { type, data, dateFrom, dateTo } = req.body;

    if (!['clients', 'orders'].includes(type)) {
        return res.status(400).json({ error: 'Неверный тип отчёта. Доступно: clients, orders' });
    }

    try {
        await exportReportToExcel(type, data, dateFrom, dateTo, res);
    } catch (err) {
        console.error('Ошибка генерации Excel:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Ошибка генерации Excel: ' + err.message });
        }
    }
});

app.get('/api/admin/reports/export/clients', authenticateToken, async (req, res) => {
    try {
        const { dateFrom, dateTo, groupBy = 'month' } = req.query;
        const df = dateFrom || '2020-01-01';
        const dt = dateTo || new Date().toISOString().split('T')[0];

        console.log(`Экспорт отчета по клиентам: ${df} - ${dt}`);

        const result = await pool.request()
            .input('DateFrom', sql.Date, df)
            .input('DateTo', sql.Date, dt)
            .input('GroupBy', sql.NVarChar, groupBy)
            .execute('sp_Report_ClientsByPeriod');

        const data = {
            summary: result.recordsets[0][0] || {},
            dynamics: result.recordsets[1] || [],
            topClients: result.recordsets[2] || []
        };

        await exportReportToExcel('clients', data, df, dt, res);
        
    } catch (err) {
        console.error('Ошибка экспорта клиентов:', err);
        res.status(500).json({ error: 'Ошибка: ' + err.message });
    }
});

app.get('/api/admin/reports/export/orders', authenticateToken, async (req, res) => {
    try {
        const { dateFrom, dateTo, groupBy = 'month', status,
                specialistId, category, minAmount, maxAmount } = req.query;
        const df = dateFrom || '2020-01-01';
        const dt = dateTo || new Date().toISOString().split('T')[0];

        console.log(`Экспорт отчета по заказам: ${df} - ${dt}`);

        const [periodRes, detailRes] = await Promise.all([
            pool.request()
                .input('DateFrom', sql.Date, df)
                .input('DateTo', sql.Date, dt)
                .input('GroupBy', sql.NVarChar, groupBy)
                .input('Status', sql.NVarChar, status || null)
                .execute('sp_Report_OrdersByPeriod'),

            pool.request()
                .input('DateFrom', sql.Date, df)
                .input('DateTo', sql.Date, dt)
                .input('Status', sql.NVarChar, status || null)
                .input('SpecialistID', sql.Int, specialistId ? parseInt(specialistId) : null)
                .input('Category', sql.NVarChar, category || null)
                .input('MinAmount', sql.Decimal(18,2), minAmount ? parseFloat(minAmount) : null)
                .input('MaxAmount', sql.Decimal(18,2), maxAmount ? parseFloat(maxAmount) : null)
                .execute('sp_Report_OrdersByParams')
        ]);

        const data = {
            summary: periodRes.recordsets[0][0] || {},
            dynamics: periodRes.recordsets[1] || [],
            orders: detailRes.recordset || []
        };

        await exportReportToExcel('orders', data, df, dt, res);
        
    } catch (err) {
        console.error(' Ошибка экспорта заказов:', err);
        res.status(500).json({ error: 'Ошибка: ' + err.message });
    }
});
//API: ФАЙЛЫ И КОММЕНТАРИИ К РАБОТАМ

const workFilesDir = path.join(__dirname, 'public', 'uploads', 'works');
if (!fs.existsSync(workFilesDir)) {
    fs.mkdirSync(workFilesDir, { recursive: true });
}

const workStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, workFilesDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, 'work-' + unique + ext);
    }
});

const uploadWork = multer({
    storage: workStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|zip|rar|txt/;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowed.test(ext)) return cb(null, true);
        cb(new Error('Недопустимый тип файла'));
    }
});

function formatFileSize(bytes) {
    if (!bytes) return '0 Б';
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

// КОММЕНТАРИИ К РАБОТЕ


//  список комментариев
app.get('/api/manager/works/:id/comments', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const workId = parseInt(req.params.id);
        if (isNaN(workId)) return res.status(400).json({ error: 'Неверный ID работы' });

        const result = await pool.request()
            .input('OrderWorkID', sql.Int, workId)
            .input('ClientView', sql.Bit, 0)
            .execute('sp_GetWorkComments');

        res.json(result.recordset || []);
    } catch (err) {
        console.error('Ошибка получения комментариев:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

//  добавить комментарий
app.post('/api/manager/works/:id/comments', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const workId = parseInt(req.params.id);
        if (isNaN(workId)) return res.status(400).json({ error: 'Неверный ID работы' });

        const { commentText, isVisibleToClient = true } = req.body;
        if (!commentText || !commentText.trim()) {
            return res.status(400).json({ error: 'Текст комментария не может быть пустым' });
        }

        const result = await pool.request()
            .input('OrderWorkID',       sql.Int,     workId)
            .input('AuthorID',          sql.Int,     req.user.id)
            .input('CommentText',       sql.NVarChar, commentText.trim())
            .input('IsVisibleToClient', sql.Bit,     isVisibleToClient ? 1 : 0)
            .output('CommentID',        sql.Int)
            .execute('sp_AddWorkComment');

        res.json({ success: true, commentId: result.output.CommentID });
try {
    const info = await pool.request()
        .input('WorkID', sql.Int, workId)
        .execute('sp_GetWorkClientInfo');

    if (info.recordset.length) {
        const { UserID, WorkName } = info.recordset[0];
        await sendPushToClient(UserID, {
            title: 'Новый комментарий',
            body:  `По работе «${WorkName}»`,
            url:   '/client',
            tag:   `comment-work-${workId}`,
        });
    }
} catch (pushErr) {
    console.error('Push (comment):', pushErr);
}
    } catch (err) {
        console.error('Ошибка добавления комментария:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

//  удалить комментарий
app.delete('/api/manager/comments/:commentId', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);
        if (isNaN(commentId)) return res.status(400).json({ error: 'Неверный ID комментария' });

        await pool.request()
            .input('CommentID', sql.Int, commentId)
            .input('AuthorID',  sql.Int, req.user.id)
            .execute('sp_DeleteWorkComment');

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка удаления комментария:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ФАЙЛЫ К РАБОТЕ

// список файлов
app.get('/api/manager/works/:id/files', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const workId = parseInt(req.params.id);
        if (isNaN(workId)) return res.status(400).json({ error: 'Неверный ID работы' });

        const result = await pool.request()
            .input('OrderWorkID', sql.Int, workId)
            .execute('sp_GetWorkFiles');

        const files = (result.recordset || []).map(f => ({
            ...f,
            FileSizeFormatted: formatFileSize(f.FileSize),
            FileUrl: `/uploads/works/${path.basename(f.FilePath)}`
        }));

        res.json(files);
    } catch (err) {
        console.error('Ошибка получения файлов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// загрузить файл
app.post('/api/manager/works/:id/files',
    authenticateToken, checkManagerRole,
    uploadWork.single('file'),
    async (req, res) => {
        try {
            const workId = parseInt(req.params.id);
            if (isNaN(workId)) return res.status(400).json({ error: 'Неверный ID работы' });

            if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

            const { description } = req.body;
            const filePath = req.file.filename; 

            const result = await pool.request()
                .input('OrderWorkID', sql.Int,     workId)
                .input('FileName',    sql.NVarChar, req.file.originalname)
                .input('FilePath',    sql.NVarChar, filePath)
                .input('Description', sql.NVarChar, description || null)
                .input('FileSize',    sql.BigInt,   req.file.size)
                .input('MimeType',    sql.NVarChar, req.file.mimetype)
                .input('UploadedBy',  sql.Int,      req.user.id)
                .output('FileID',     sql.Int)
                .execute('sp_AddWorkFile');

            res.json({
                success: true,
                fileId: result.output.FileID,
                fileUrl: `/uploads/works/${filePath}`,
                fileName: req.file.originalname,
                fileSize: formatFileSize(req.file.size)
            });
        } catch (err) {
            console.error('Ошибка загрузки файла:', err);
            res.status(500).json({ error: 'Ошибка загрузки: ' + err.message });
        }
    }
);

//  удалить файл
app.delete('/api/manager/works/files/:fileId', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const fileId = parseInt(req.params.fileId);
        if (isNaN(fileId)) return res.status(400).json({ error: 'Неверный ID файла' });

        const result = await pool.request()
            .input('FileID',  sql.Int, fileId)
            .output('FilePath', sql.NVarChar(500))
            .execute('sp_DeleteWorkFile');

        const filePath = result.output.FilePath;
        if (filePath) {
            const fullPath = path.join(workFilesDir, filePath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка удаления файла:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

//  полные детали работы 
app.get('/api/manager/works/:id/details', authenticateToken, checkManagerRole, async (req, res) => {
    try {
        const workId = parseInt(req.params.id);
        if (isNaN(workId)) return res.status(400).json({ error: 'Неверный ID работы' });

        const result = await pool.request()
            .input('OrderWorkID', sql.Int, workId)
            .execute('sp_GetWorkDetails');

        if (!result.recordsets[0]?.length) {
            return res.status(404).json({ error: 'Работа не найдена' });
        }

        const work     = result.recordsets[0][0];
        const comments = result.recordsets[1] || [];
        const files    = (result.recordsets[2] || []).map(f => ({
            ...f,
            FileSizeFormatted: formatFileSize(f.FileSize),
            FileUrl: `/uploads/works/${path.basename(f.FilePath)}`
        }));

        res.json({ work, comments, files });
    } catch (err) {
        console.error('Ошибка получения деталей работы:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// КЛИЕНТСКИЙ КАБИНЕТ

app.get('/api/client/orders/:id/works', authenticateClient, async (req, res) => {
    try {
        const contractId = parseInt(req.params.id);
        if (isNaN(contractId)) return res.status(400).json({ error: 'Неверный ID заказа' });

        const result = await pool.request()
            .input('ContractID',   sql.Int, contractId)
            .input('ClientUserID', sql.Int, req.user.id)
            .execute('sp_GetClientOrderWorks');

        const works    = result.recordsets[0] || [];
        const comments = result.recordsets[1] || [];
        const files    = (result.recordsets[2] || []).map(f => ({
            ...f,
            FileSizeFormatted: formatFileSize(f.FileSize),
            FileUrl: `/uploads/works/${path.basename(f.FilePath)}`
        }));

        res.json({ works, comments, files });
    } catch (err) {
        console.error('Ошибка получения работ для клиента:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Скачивание договора клиентом
app.get('/api/client/orders/:id/contract/download', authenticateClient, async (req, res) => {
    try {
        const contractId = parseInt(req.params.id);
        if (isNaN(contractId)) return res.status(400).json({ error: 'Неверный ID' });

        // Проверяем, что этот договор принадлежит клиенту
        const checkResult = await pool.request()
            .input('ContractID',   sql.Int, contractId)
            .input('ClientUserID', sql.Int, req.user.id)
            .query(`
                SELECT c.ContractID 
                FROM Contracts c
                JOIN Applications a ON c.ApplicationID = a.ApplicationID
                JOIN Users u ON a.ClientUserID = u.UserID
                WHERE c.ContractID = @ContractID 
                  AND u.UserID = @ClientUserID
            `);

        if (checkResult.recordset.length === 0) {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        const result = await pool.request()
            .input('ContractID',   sql.Int, contractId)
            .input('IncludeWorks', sql.Bit, 1)
            .execute('sp_GenerateContract');

        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Договор не найден' });
        }

        const contract = result.recordsets[0][0];
        const works    = result.recordsets[1] || [];

        const contractDate = contract.SignDate ? new Date(contract.SignDate) : new Date();
        const day = contractDate.getDate().toString().padStart(2, '0');
        const monthNames = ['января','февраля','марта','апреля','мая','июня',
                            'июля','августа','сентября','октября','ноября','декабря'];
        const month = monthNames[contractDate.getMonth()];
        const year  = contractDate.getFullYear();

        function formatRuDate(d) {
            if (!d) return '___';
            const dt = new Date(d);
            return `${dt.getDate()} ${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
        }

        const contractData = {
            contractNumber:    contract.ContractNumber || contractId,
            city:              (contract.City || 'г. Минск').replace('г. ', ''),
            day, month, year:  String(year),
            clientCompanyFull: contract.CompanyName     || '____________________',
            clientDirectorFull:`${contract.DirectorPosition||'директора'} ${contract.DirectorName||'____________________'}`,
            clientAuthorityDoc:'Устава',
            objectName:        [contract.ObjectName, contract.ObjectAddress]
                                   .filter(Boolean).join(', расположенного по адресу: ') || '____________________',
            startDate:  formatRuDate(contract.StartDate),
            endDate:    formatRuDate(contract.EndDate),
            costWithoutVAT: contract.CostWithoutVAT
                ? Number(contract.CostWithoutVAT).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            vatRate:    String(contract.VATRate || 20),
            vatAmount:  contract.VATAmount
                ? Number(contract.VATAmount).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            totalCost:  contract.TotalCost
                ? Number(contract.TotalCost).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            totalCostWords: contract.TotalCostWords || '________________________________________________',
            vatAmountWords: contract.VATAmountWords || null,
            paymentSchedule:contract.PaymentSchedule || '',
            clientName:     contract.CompanyName     || '____________________',
            clientUNP:      contract.UNP             || '____',
            clientOKPO:     contract.OKPO            || '',
            clientAddress:  contract.LegalAddress    || '____________________',
            clientBank:     contract.ClientBank      || '____________________',
            clientBankName: contract.ClientBankName  || '____________________',
            clientBankBIC:  contract.ClientBankBIC   || '____',
            clientEmail:    contract.ClientEmail     || '',
            clientPhone:    contract.ClientPhone     || '',
            clientFax:      contract.ClientFax       || '',
            clientDirectorShort: contract.DirectorName || '____________________',
            contractorName:    'ООО «МСК Релайбл»',
            contractorAddress: '220113, г. Минск, ул. Мележа, д. 4',
            contractorUNP:     '193607959',
            contractorBank:    'BY91ALFA30122B38250010270000 в BYN',
            contractorBankName:'ЗАО «Альфа-Банк»',
            contractorBankBIC: 'ALFABY2X',
            contractorBankAddress: '220013, г. Минск, ул. Сурганова, 43-47',
            contractorEmail:   'MCK-Reliable@yandex.ru',
            contractorPhone:   '+375444543857',
            contractorDirectorShort: 'В.И. Хурс',
            works: works.map(w => ({
                name:     w.WorkName || '',
                quantity: String(w.Quantity || ''),
                unitCost: w.UnitCost
                    ? Number(w.UnitCost).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
                total:    (w.Quantity && w.UnitCost)
                    ? Number(w.Quantity * w.UnitCost).toLocaleString('ru', {minimumFractionDigits:2}) : '0,00',
            }))
        };

        const tmpPath    = path.join(os.tmpdir(), `contract_client_${contractId}_${Date.now()}.docx`);
        const scriptPath = path.join(__dirname, 'generate_contract.js');

        await new Promise((resolve, reject) => {
            execFile('node', [scriptPath, JSON.stringify(contractData), tmpPath],
                (err, stdout, stderr) => {
                    if (err) reject(new Error(stderr || err.message));
                    else resolve();
                }
            );
        });

        const buffer = fs.readFileSync(tmpPath);
        fs.unlinkSync(tmpPath);

        const filenameDocx = `Договор_${contractData.contractNumber}_${day}_${month}_${year}.docx`;
        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition',
            `attachment; filename="contract.docx"; filename*=UTF-8''${encodeURIComponent(filenameDocx)}`);
        res.send(buffer);

    } catch (err) {
        console.error('Ошибка скачивания договора клиентом:', err);
        res.status(500).json({ error: 'Ошибка генерации договора: ' + err.message });
    }
});

// Отдаём статические файлы работ
app.use('/uploads/works', express.static(path.join(__dirname, 'public', 'uploads', 'works')));

// API: УПРАВЛЕНИЕ ПРАВИЛАМИ РАСЧЕТА СРОКОВ (ДЛЯ АДМИНА)


// Получение всех правил
app.get('/api/admin/work-rules', authenticateToken, async (req, res) => {
    try {
        const result = await pool.request()
            .execute('sp_GetAllWorkRules');
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка получения правил:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение правила по ID
app.get('/api/admin/work-rules/:id', authenticateToken, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        
        const result = await pool.request()
            .input('RequirementID', sql.Int, ruleId)
            .execute('sp_GetWorkRuleById');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Правило не найдено' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Ошибка получения правила:', err);
        res.status(500).json({ error: err.message });
    }
});

// Создание нового правила
app.post('/api/admin/work-rules', authenticateToken, async (req, res) => {
    try {
        const { objectTypeId, workTypeId, inclusionRule, 
                durationMultiplier, minDuration, isRequired, sortOrder } = req.body;
        
        const result = await pool.request()
            .input('ObjectTypeID', sql.Int, parseInt(objectTypeId))
            .input('WorkTypeID', sql.Int, parseInt(workTypeId))
            .input('InclusionRule', sql.NVarChar, inclusionRule)
            .input('DurationMultiplier', sql.Decimal(3,1), parseFloat(durationMultiplier))
            .input('MinDuration', sql.Int, minDuration ? parseInt(minDuration) : null)
            .input('IsRequired', sql.Bit, isRequired ? 1 : 0)
            .input('SortOrder', sql.Int, sortOrder || 0)
            .execute('sp_CreateWorkRule');
        
        res.json({ 
            success: true, 
            ruleId: result.recordset[0]?.RequirementID,
            message: 'Правило успешно создано' 
        });
    } catch (err) {
        console.error('Ошибка создания правила:', err);
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/admin/work-rules/:id', authenticateToken, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        
        await pool.request()
            .input('RequirementID', sql.Int, ruleId)
            .execute('sp_DeleteWorkRule');
        
        res.json({ success: true, message: 'Правило удалено' });
    } catch (err) {
        console.error('Ошибка удаления правила:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/work-rules/:id', authenticateToken, async (req, res) => {
    try {
        const ruleId = parseInt(req.params.id);
        const { objectTypeId, workTypeId, inclusionRule,
                durationMultiplier, minDuration, isRequired, sortOrder } = req.body;
        
        await pool.request()
            .input('RequirementID', sql.Int, ruleId)
            .input('ObjectTypeID', sql.Int, parseInt(objectTypeId))
            .input('WorkTypeID', sql.Int, parseInt(workTypeId))
            .input('InclusionRule', sql.NVarChar, inclusionRule)
            .input('DurationMultiplier', sql.Decimal(3,1), parseFloat(durationMultiplier))
            .input('MinDuration', sql.Int, minDuration ? parseInt(minDuration) : null)
            .input('IsRequired', sql.Bit, isRequired ? 1 : 0)
            .input('SortOrder', sql.Int, sortOrder || 0)
            .execute('sp_UpdateWorkRule');
        
        res.json({ success: true, message: 'Правило успешно обновлено' });
    } catch (err) {
        console.error('Ошибка обновления правила:', err);
        res.status(500).json({ error: err.message });
    }
});
// Удаление всех правил для конкретного типа объекта
app.delete('/api/admin/work-rules/group/:objectTypeId', authenticateToken, async (req, res) => {
    try {
        const objectTypeId = parseInt(req.params.objectTypeId);
        
        if (isNaN(objectTypeId)) {
            return res.status(400).json({ error: 'Неверный ID типа объекта' });
        }
        
        const result = await pool.request()
            .input('ObjectTypeID', sql.Int, objectTypeId)
            .execute('sp_DeleteWorkRulesByObjectType');
        
        res.json({ 
            success: true, 
            message: 'Все нормы для данного типа здания успешно удалены' 
        });
        
    } catch (err) {
        console.error('Ошибка удаления группы правил:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// API: УПРАВЛЕНИЕ ОТЗЫВАМИ

// Получение списка отзывов для админа
app.get('/api/admin/reviews', authenticateToken, async (req, res) => {
    try {
        const { page = 1, approved, search = '' } = req.query;
        
        const result = await pool.request()
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .input('IsApproved', sql.Bit, approved === 'true' ? 1 : approved === 'false' ? 0 : null)
            .input('Search', sql.NVarChar, search)
            .execute('sp_GetReviewsForAdmin');
        
        const reviews = result.recordsets[0];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            reviews: reviews,
            pagination: {
                page: parseInt(page),
                pageSize: 10,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 10)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения отзывов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// Модерация отзыва (публикация/скрытие)
app.patch('/api/admin/reviews/:id/moderate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;
        
        await pool.request()
            .input('ReviewID', sql.Int, parseInt(id))
            .input('IsApproved', sql.Bit, approved ? 1 : 0)
            .input('ModeratorID', sql.Int, req.user.id)
            .execute('sp_ModerateReview');
        
        res.json({ 
            success: true, 
            message: `Отзыв успешно ${approved ? 'опубликован' : 'скрыт'}`
        });
        
    } catch (err) {
        console.error('Ошибка модерации отзыва:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Удаление отзыва
app.delete('/api/admin/reviews/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const reviewId = parseInt(id);
        
        if (isNaN(reviewId)) {
            return res.status(400).json({ error: 'Неверный ID отзыва' });
        }
        const result = await pool.request()
            .input('ReviewID', sql.Int, reviewId)
            .execute('sp_DeleteReview');
        
        res.json({ 
            success: true, 
            message: 'Отзыв успешно удален'
        });
        
    } catch (err) {
        console.error('Ошибка удаления отзыва:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});


// Получение публичных отзывов (для главной страницы)
app.get('/api/reviews/public', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const result = await pool.request()
            .input('Limit', sql.Int, parseInt(limit))
            .execute('sp_GetPublicReviews');
        
        res.json(result.recordset || []);
        
    } catch (err) {
        console.error('Ошибка получения публичных отзывов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/check-unp', authenticateToken, async (req, res) => {
    try {
        const { unp, excludeId } = req.query;
        if (!unp) return res.json({ exists: false });
        
        const result = await pool.request()
            .input('UNP', sql.NVarChar, unp)
            .input('ExcludeID', sql.Int, excludeId ? parseInt(excludeId) : null)
            .query(`
                SELECT COUNT(*) as cnt FROM ClientCompanies 
                WHERE UNP = @UNP 
                AND (@ExcludeID IS NULL OR CompanyID != @ExcludeID)
            `);
        
        res.json({ exists: result.recordset[0].cnt > 0 });
    } catch (error) {
        console.error('Ошибка check-unp:', error);
        res.json({ exists: false });
    }
});
// Проверка уникальности email
app.get('/api/check-email', authenticateToken, async (req, res) => {
    try {
        const { email, excludeId } = req.query;
        if (!email) return res.json({ exists: false });
        
        const result = await pool.request()
            .input('Email', sql.NVarChar, email)
            .input('ExcludeUserID', sql.Int, excludeId ? parseInt(excludeId) : null)
            .execute('sp_CheckEmailExists');
        
        res.json({ exists: result.recordset[0].cnt > 0 });
    } catch (error) {
        console.error('Ошибка check-email:', error);
        res.json({ exists: false }); // В случае ошибки возвращаем false
    }
});

// Проверка уникальности телефона
app.get('/api/check-phone', authenticateToken, async (req, res) => {
    try {
        const { phone, excludeId } = req.query;
        if (!phone) return res.json({ exists: false });
        
        const result = await pool.request()
            .input('Phone', sql.NVarChar, phone)
            .input('ExcludeUserID', sql.Int, excludeId ? parseInt(excludeId) : null)
            .execute('sp_CheckPhoneExists');
        
        res.json({ exists: result.recordset[0].cnt > 0 });
    } catch (error) {
        console.error('Ошибка check-phone:', error);
        res.json({ exists: false }); // В случае ошибки возвращаем false
    }
});

// API: ТИПЫ ОБЪЕКТОВ 

// Получение списка типов объектов (с пагинацией на сервере)
app.get('/api/admin/object-types', authenticateToken, async (req, res) => {
    try {
        const { page = 1, search = '', showInactive = 1 } = req.query;
        
        // Вызываем хранимую процедуру
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, parseInt(showInactive))
            .input('Search', sql.NVarChar, search || '')
            .execute('sp_Admin_GetObjectTypes');
        
        const allTypes = result.recordset || [];
        
        // Пагинация на стороне сервера
        const pageSize = 10;
        const currentPage = parseInt(page);
        const offset = (currentPage - 1) * pageSize;
        const paginatedTypes = allTypes.slice(offset, offset + pageSize);
        const totalCount = allTypes.length;
        
        res.json({
            objectTypes: paginatedTypes,
            pagination: {
                page: currentPage,
                pageSize: pageSize,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения типов объектов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение статистики (используем ту же процедуру)
app.get('/api/admin/object-types/stats', authenticateToken, async (req, res) => {
    try {
        // Получаем все типы (включая неактивные)
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, 1)
            .input('Search', sql.NVarChar, '')
            .execute('sp_Admin_GetObjectTypes');
        
        const types = result.recordset || [];
        const totalTypes = types.length;
        const activeTypes = types.filter(t => t.IsActive === 1).length;
        const totalRules = types.reduce((sum, t) => sum + (t.RulesCount || 0), 0);
        
        res.json({
            TotalTypes: totalTypes,
            ActiveTypes: activeTypes,
            TotalRules: totalRules
        });
        
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

//  Получение одного типа объекта по ID
app.get('/api/admin/object-types/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('ObjectTypeID', sql.Int, parseInt(id))
            .execute('sp_Admin_GetObjectTypeById');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Тип объекта не найден' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('Ошибка получения типа объекта:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание нового типа объекта
app.post('/api/admin/object-types', authenticateToken, async (req, res) => {
    try {
        const { typeName, description, isActive, sortOrder } = req.body;
        
        if (!typeName || !typeName.trim()) {
            return res.status(400).json({ error: 'Название типа объекта обязательно' });
        }
        
        const request = pool.request();
        request.input('TypeName', sql.NVarChar, typeName.trim());
        request.input('Description', sql.NVarChar, description || null);
        request.input('IsActive', sql.Bit, isActive ? 1 : 0);
        request.input('SortOrder', sql.Int, sortOrder || 0);
        request.output('NewID', sql.Int);
        
        const result = await request.execute('sp_Admin_CreateObjectType'); // один вызов
        const newId = result.output.NewID; // читаем из result
        
        res.json({ 
            success: true, 
            id: newId, // используем newId
            message: 'Тип объекта успешно создан' 
        });
        
    } catch (err) {
        console.error('Ошибка создания типа объекта:', err);
        if (err.message.includes('уже существует')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Обновление типа объекта
app.put('/api/admin/object-types/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { typeName, description, isActive, sortOrder } = req.body;
        
        if (!typeName || !typeName.trim()) {
            return res.status(400).json({ error: 'Название типа объекта обязательно' });
        }
        
        const request = pool.request();
        request.input('ObjectTypeID', sql.Int, parseInt(id));
        request.input('TypeName', sql.NVarChar, typeName.trim());
        request.input('Description', sql.NVarChar, description || null);
        request.input('IsActive', sql.Bit, isActive ? 1 : 0);
        request.input('SortOrder', sql.Int, sortOrder || 0);
        
        await request.execute('sp_Admin_UpdateObjectType');
        
        res.json({ 
            success: true, 
            message: 'Тип объекта успешно обновлен' 
        });
        
    } catch (err) {
        console.error('Ошибка обновления типа объекта:', err);
        if (err.message.includes('уже существует')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Удаление или деактивация типа объекта
app.delete('/api/admin/object-types/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { hardDelete } = req.query;
        
        const request = pool.request();
        request.input('ObjectTypeID', sql.Int, parseInt(id));
        request.input('HardDelete', sql.Bit, hardDelete === 'true' ? 1 : 0);
        
        await request.execute('sp_Admin_DeleteObjectType');
        
        const message = hardDelete === 'true' 
            ? 'Тип объекта полностью удален' 
            : 'Тип объекта деактивирован';
        
        res.json({ success: true, message });
        
    } catch (err) {
        console.error('Ошибка удаления типа объекта:', err);
        // Обрабатываем ошибку из RAISERROR
        if (err.message.includes('невозможно удалить') || err.message.includes('существуют объекты')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// ВИДЫ РАБОТ

// Получение списка видов работ (с пагинацией)
app.get('/api/admin/work-types', authenticateToken, async (req, res) => {
    try {
        const { page = 1, search = '', showInactive = 1 } = req.query;
        
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, parseInt(showInactive))
            .input('Search', sql.NVarChar, search || '')
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .execute('sp_Admin_GetWorkTypes');
        
        const workTypes = result.recordsets[0] || [];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            workTypes: workTypes,
            pagination: {
                page: parseInt(page),
                pageSize: 10,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 10)
            }
        });
        
    } catch (err) {
        console.error('Ошибка получения видов работ:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение статистики по видам работ
app.get('/api/admin/work-types/stats', authenticateToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('IncludeInactive', sql.Bit, 1)
            .input('Search', sql.NVarChar, '')
            .input('Page', sql.Int, 1)
            .input('PageSize', sql.Int, 9999)
            .execute('sp_Admin_GetWorkTypes');
        
        const workTypes = result.recordsets[0] || [];
        const totalTypes = workTypes.length;
        const activeTypes = workTypes.filter(w => w.IsActive === 1).length;
        const totalUsage = workTypes.reduce((sum, w) => sum + (w.UsageCount || 0), 0);
        const totalRules = workTypes.reduce((sum, w) => sum + (w.RulesCount || 0), 0);
        
        res.json({
            TotalTypes: totalTypes,
            ActiveTypes: activeTypes,
            TotalUsage: totalUsage,
            TotalRules: totalRules
        });
        
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение одного вида работы по ID
app.get('/api/admin/work-types/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('WorkTypeID', sql.Int, parseInt(id))
            .execute('sp_Admin_GetWorkTypeById');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Вид работы не найден' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('Ошибка получения вида работы:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание нового вида работы
app.post('/api/admin/work-types', authenticateToken, async (req, res) => {
    try {
        const { workName,description, defaultDuration, baseCost, isActive } = req.body;
        
        if (!workName || !workName.trim()) {
            return res.status(400).json({ error: 'Название вида работы обязательно' });
        }
        
        const request = pool.request();
        request.input('WorkName', sql.NVarChar, workName.trim());
        request.input('Description', sql.NVarChar, description || null);
        request.input('DefaultDuration', sql.Int, defaultDuration ? parseInt(defaultDuration) : null);
        request.input('BaseCost', sql.Decimal(18,2), baseCost ? parseFloat(baseCost) : null);
        request.input('IsActive', sql.Bit, isActive ? 1 : 0);
        request.output('NewID', sql.Int);
        
        const result = await request.execute('sp_Admin_CreateWorkType');
        
        // Читаем из result.output, а не request.output
        const newId = result.output.NewID;
        
        res.json({ 
            success: true, 
            id: newId,      
            message: 'Вид работы успешно создан' 
        });
        
    } catch (err) {
        console.error('Ошибка создания вида работы:', err);
        if (err.message.includes('уже существует')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

//Обновление вида работы
app.put('/api/admin/work-types/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { workName,  description,defaultDuration, baseCost, isActive } = req.body;
        
        if (!workName || !workName.trim()) {
            return res.status(400).json({ error: 'Название вида работы обязательно' });
        }
        
        const request = pool.request();
        request.input('WorkTypeID', sql.Int, parseInt(id));
        request.input('WorkName', sql.NVarChar, workName.trim());
        request.input('Description', sql.NVarChar, description || null);
        request.input('DefaultDuration', sql.Int, defaultDuration ? parseInt(defaultDuration) : null);
        request.input('BaseCost', sql.Decimal(18,2), baseCost ? parseFloat(baseCost) : null);
        request.input('IsActive', sql.Bit, isActive ? 1 : 0);
        
        await request.execute('sp_Admin_UpdateWorkType');
        
        res.json({ 
            success: true, 
            message: 'Вид работы успешно обновлен' 
        });
        
    } catch (err) {
        console.error('Ошибка обновления вида работы:', err);
        if (err.message.includes('уже существует')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Удаление или деактивация вида работы
app.delete('/api/admin/work-types/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { hardDelete } = req.query;
        
        const request = pool.request();
        request.input('WorkTypeID', sql.Int, parseInt(id));
        request.input('HardDelete', sql.Bit, hardDelete === 'true' ? 1 : 0);
        
        await request.execute('sp_Admin_DeleteWorkType');
        
        const message = hardDelete === 'true' 
            ? 'Вид работы полностью удален' 
            : 'Вид работы деактивирован';
        
        res.json({ success: true, message });
        
    } catch (err) {
        console.error('Ошибка удаления вида работы:', err);
        if (err.message.includes('невозможно удалить') || err.message.includes('используется в заказах')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// КЛИЕНТЫ

// Получение списка клиентов
app.get('/api/admin/clients', authenticateToken, async (req, res) => {
    try {
        const { page = 1, search = '' } = req.query;
        
        const result = await pool.request()
            .input('Page', sql.Int, parseInt(page))
            .input('PageSize', sql.Int, 10)
            .input('Search', sql.NVarChar, search || '')
            .execute('sp_Admin_GetClients');
        
        const clients = result.recordsets[0] || [];
        const totalCount = result.recordsets[1]?.[0]?.TotalCount || 0;
        
        res.json({
            clients: clients,
            pagination: {
                page: parseInt(page),
                pageSize: 9,
                totalCount: totalCount,
                totalPages: Math.ceil(totalCount / 10)
            }
        });
    } catch (err) {
        console.error('Ошибка получения клиентов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
app.get('/api/admin/clients/stats', authenticateToken, async (req, res) => {
    try {
        const result = await pool.request()
            .input('Page', sql.Int, 1)
            .input('PageSize', sql.Int, 9999)
            .input('Search', sql.NVarChar, '')
            .execute('sp_Admin_GetClients');
        
        const clients = result.recordsets[0] || [];
        const totalClients = clients.length;
        const withCompanies = clients.filter(c => c.CompanyID !== null).length;
        const totalOrders = clients.reduce((sum, c) => sum + (c.OrdersCount || 0), 0);
        
        res.json({ 
            TotalClients: totalClients, 
            WithCompanies: withCompanies, 
            TotalOrders: totalOrders 
        });
    } catch (err) {
        console.error('Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение одного клиента по ID 
app.get('/api/admin/clients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.request()
            .input('UserID', sql.Int, parseInt(id))
            .execute('sp_Admin_GetClientById');
        
        if (result.recordsets[0].length === 0) {
            return res.status(404).json({ error: 'Клиент не найден' });
        }
        
        const client = result.recordsets[0][0];
        const bankDetails = result.recordsets[1] || [];
        const orders = result.recordsets[2] || [];
        
        res.json({
            client: client,
            bankDetails: bankDetails,
            orders: orders
        });
        
    } catch (err) {
        console.error('Ошибка получения клиента:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление клиента
app.put('/api/admin/clients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fullName, email, phone, isActive,
            companyName, unp, okpo, legalAddress,
            directorName, directorPosition, authorityDoc, website
        } = req.body;
        
        if (!fullName || !email) {
            return res.status(400).json({ error: 'ФИО и Email обязательны' });
        }
        
        const request = pool.request();
        request.input('UserID', sql.Int, parseInt(id));
        request.input('FullName', sql.NVarChar, fullName.trim());
        request.input('Email', sql.NVarChar, email.trim());
        request.input('Phone', sql.NVarChar, phone || null);
        request.input('IsActive', sql.Bit, isActive ? 1 : 0);
        request.input('CompanyName', sql.NVarChar, companyName || null);
        request.input('UNP', sql.NVarChar, unp || null);
        request.input('OKPO', sql.NVarChar, okpo || null);
        request.input('LegalAddress', sql.NVarChar, legalAddress || null);
        request.input('DirectorName', sql.NVarChar, directorName || null);
        request.input('DirectorPosition', sql.NVarChar, directorPosition || null);
        request.input('AuthorityDoc', sql.NVarChar, authorityDoc || null);
        request.input('Website', sql.NVarChar, website || null);
        
        await request.execute('sp_Admin_UpdateClient');
        
        res.json({ 
            success: true, 
            message: 'Данные клиента успешно обновлены' 
        });
        
    } catch (err) {
        console.error('Ошибка обновления клиента:', err);
        if (err.message.includes('email уже существует')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Сброс пароля клиента
app.post('/api/admin/clients/:id/reset-password', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const request = pool.request();
        request.input('UserID', sql.Int, parseInt(id));
        request.input('PasswordHash', sql.NVarChar, passwordHash);
        
        await request.execute('sp_Admin_ResetClientPassword');
        
        res.json({ 
            success: true, 
            message: 'Пароль успешно изменен' 
        });
        
    } catch (err) {
        console.error('Ошибка сброса пароля:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});

// Удаление клиента
app.delete('/api/admin/clients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`Удаление клиента с ID: ${id}`);
        
        const request = pool.request();
        request.input('UserID', sql.Int, parseInt(id));
        
        const result = await request.execute('sp_Admin_DeleteClient');
        
        const deletedOrders = result.recordsets[0]?.[0]?.DeletedOrdersCount || 0;
        
        res.json({ 
            success: true, 
            message: `Клиент успешно удален вместе с ${deletedOrders} заказ(ами)`,
            deletedOrders 
        });
        
    } catch (err) {
        console.error('Ошибка удаления клиента:', err);
        
        let errorMessage = 'Ошибка при удалении клиента';
        if (err.originalError && err.originalError.info) {
            errorMessage = err.originalError.info.message;
        } else if (err.message) {
            errorMessage = err.message;
        }
        
        res.status(500).json({ error: errorMessage });
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'views', 'admin')));
app.use('/manager', express.static(path.join(__dirname, 'views', 'manager')));
app.use('/client', express.static(path.join(__dirname, 'views', 'client')));
app.use(express.static(path.join(__dirname, 'views', 'site')));
// страницы

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'site', 'index.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(__dirname, 'views', 'site', 'gallery.html')));
app.get('/contacts', (req, res) => res.sendFile(path.join(__dirname, 'views', 'site', 'contacts.html')));
app.get('/services', (req, res) => res.sendFile(path.join(__dirname, 'views', 'site', 'services.html')));
app.get('/calculator', (req, res) => res.sendFile(path.join(__dirname, 'views', 'site', 'calculator.html')));
app.get('/manager', (req, res) => res.sendFile(path.join(__dirname, 'views', 'manager', 'index.html')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin', 'index.html')));

app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'client', 'index.html'));
});

app.get('/client/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'client', 'login.html'));
});


app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', 'site', '404.html'));
});

app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

function generateFullContractHTML(contract, works) {
    const date = contract.SignDate ? new Date(contract.SignDate) : new Date();
    const months = ['января','февраля','марта','апреля','мая','июня',
                    'июля','августа','сентября','октября','ноября','декабря'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    function fmtDate(d) {
        if (!d) return '___';
        const dt = new Date(d);
        return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    }
    function fmtMoney(n) {
        if (!n && n !== 0) return '0,00';
        return Number(n).toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2});
    }
    function esc(s) {
        return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    const d = {
        num:        esc(contract.ContractNumber || '______'),
        city:       esc((contract.City||'г. Минск').replace('г. ','')),
        day, month: esc(month), year,
        clientFull: esc(contract.CompanyName || '____________________'),
        dirLine:    esc(`${contract.DirectorPosition||'директора'} ${contract.DirectorName||'____________________'}`),
        authority:  esc(contract.AuthorityDoc || 'Устава'),
        objectName: esc([contract.ObjectName, contract.ObjectAddress].filter(Boolean)
                        .join(', расположенного по адресу: ') || '____________________'),
        startDate:  esc(fmtDate(contract.StartDate)),
        endDate:    esc(fmtDate(contract.EndDate)),
        costNoVAT:  esc(fmtMoney(contract.CostWithoutVAT)),
        vatRate:    esc(String(contract.VATRate||20)),
        vatAmt:     esc(fmtMoney(contract.VATAmount)),
        total:      esc(fmtMoney(contract.TotalCost)),
        totalWords: esc(contract.TotalCostWords || '________________________________________________'),
        vatWords:   esc(contract.VATAmountWords || fmtMoney(contract.VATAmount)),
        clName:     esc(contract.CompanyName    || '____________________'),
        clUNP:      esc(contract.UNP            || '____'),
        clOKPO:     esc(contract.OKPO           || ''),
        clAddr:     esc(contract.LegalAddress   || '____________________'),
        clBank:     esc(contract.ClientBank     || '____________________'),
        clBankName: esc(contract.ClientBankName || '____________________'),
        clBankBIC:  esc(contract.ClientBankBIC  || '____'),
        clEmail:    esc(contract.ClientEmail    || ''),
        clPhone:    esc(contract.ClientPhone    || ''),
        clDirector: esc(contract.DirectorName   || '____________________'),
    };

    let worksRows = '';
    let totalSum = 0;
    (works||[]).forEach((w, i) => {
        const sum = (w.Quantity||0) * (w.UnitCost||0);
        totalSum += sum;
        worksRows += `<tr>
            <td style="text-align:center">${i+1}</td>
            <td>${esc(w.WorkName||'')}</td>
            <td style="text-align:center">${esc(String(w.Quantity||0))}</td>
            <td style="text-align:right">${esc(fmtMoney(w.UnitCost))}</td>
            <td style="text-align:right">${esc(fmtMoney(sum))}</td>
         </tr>`;
    });
    worksRows += `<tr style="font-weight:bold;background:#f5f5f5">
        <td colspan="4" style="text-align:right">ИТОГО:</td>
        <td style="text-align:right">${esc(fmtMoney(totalSum))}</td>
     </tr>`;

    // Полный HTML с текстом, синхронизированным с generate_contract.js
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Договор №${d.num}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.4;color:#000;background:#fff;padding:20px 28px}
.c{text-align:center;font-weight:bold;font-size:13pt;margin:4px 0}
.hdr{display:flex;justify-content:space-between;margin:6px 0}
.body{text-indent:1.27cm;text-align:justify;margin:1px 0}
.body.b{font-weight:bold}
.list{margin-left:1.27cm;text-align:justify;margin-bottom:1px}
.sh{font-weight:bold;margin:6px 0 2px 0}
.sp{margin:4px 0}
table.works{width:100%;border-collapse:collapse;margin:8px 0;font-size:11pt}
table.works th,table.works td{border:1px solid #000;padding:4px 6px}
table.works th{text-align:center;font-weight:bold;background:#f0f0f0}
table.req{width:100%;border-collapse:collapse;margin-top:6px}
table.req td{vertical-align:top;width:50%;padding-right:12px;font-size:11pt}
.req-title{font-weight:bold;margin-bottom:3px}
@media print{body{padding:1cm 1.5cm}}
</style></head><body>

<p class="c">ДОГОВОР СТРОИТЕЛЬНОГО ПОДРЯДА №${d.num}</p>
<div class="sp"></div>
<div class="hdr"><span>г. ${d.city}</span><span>«${d.day}» ${d.month} ${d.year} г.</span></div>
<div class="sp"></div>

<p class="body b">${d.clientFull}, именуемое в дальнейшем «Заказчик», в лице ${d.dirLine}, действующего на основании ${d.authority}, с одной стороны, и Общество с ограниченной ответственностью «МСК Релайбл», именуемое в дальнейшем «Подрядчик», в лице директора Хурс В.И., действующего на основании Устава, с другой стороны, совместно именуемые в дальнейшем «Стороны», в соответствии с Гражданским кодексом Республики Беларусь, Законом Республики Беларусь от 05.07.2004 г. №&nbsp;300-З «Об архитектурной, градостроительной и строительной деятельности в Республике Беларусь», Правилами заключения и исполнения договоров строительного подряда (в дальнейшем – «Правила»), утвержденными Постановлением Совета Министров Республики Беларусь от 15.09.1998 г. №&nbsp;1450 (с изменениями и дополнениями), заключили настоящий договор (далее – Договор) о нижеследующем:</p>
<div class="sp"></div>

<!-- 1. ПРЕДМЕТ ДОГОВОРА -->
<p class="sh">1. ПРЕДМЕТ ДОГОВОРА</p>
<p class="body">1.1. Подрядчик обязуется своими силами выполнить комплекс строительно-монтажных работ (далее - Работ) на объекте: «${d.objectName}» (далее – Объект) в соответствии с проектной документацией и Ведомостью объемов и стоимости работ (Приложение №1), являющимися неотъемлемой частью настоящего Договора, и сдать их Заказчику, а Заказчик обязуется создать Подрядчику необходимые условия для выполнения работ, принять результаты работ и уплатить обусловленную Договором цену.</p>
<p class="body">1.2. Наименования работ, подлежащих выполнению по настоящему Договору, их объемы, стоимость и график производства работ содержатся в приложениях:</p>
<p class="list">Приложение №1 Ведомость объемов и стоимости работ;</p>
<p class="list">Приложение №2 Протокол согласования договорной цены;</p>
<p class="list">Приложение №3 График строительства (производства работ);</p>
<p class="list">Приложение №4 График платежей при строительстве (выполнении работ).</p>
<p class="body">Указанные приложения являются неотъемлемыми частями настоящего Договора.</p>
<p class="body">1.3. Объект – объект строительства «${d.objectName}».</p>
<p class="body">1.4. Работы должны быть выполнены в соответствии с разрешительной документацией, проектной документацией, Договором и его приложениями, действующим законодательством Республики Беларусь, в том числе ТНПА, действующими в Республике Беларусь на момент выполнения работ.</p>
<div class="sp"></div>

<!-- 2. СРОКИ -->
<p class="sh">2. СРОКИ И ПОРЯДОК ВЫПОЛНЕНИЯ РАБОТ</p>
<p class="body">2.1. Сроки выполнения Работ, предусмотренных в п. 1.1. Договора:</p>
<p class="list">начало выполнения Работ – ${d.startDate} года</p>
<p class="list">окончание выполнения Работ – ${d.endDate} года</p>
<p class="body">2.2. Сроки выполнения строительно-монтажных Работ (как начальный, так и конечный) могут изменяться Сторонами в случаях:</p>
<p class="list">нарушения Заказчиком установленных договором сроков передачи проектной документации;</p>
<p class="list">существенного нарушения установленного договором порядка расчетов (Графика финансирования, приложение № 4);</p>
<p class="list">несвоевременной передачи Подрядчику фронта работ;</p>
<p class="list">по письменному соглашению Сторон;</p>
<p class="list">выявления в ходе выполнения строительно-монтажных Работ, дополнительных объемов строительных работ, не предусмотренных проектной документацией и влияющих на своевременное исполнение подрядчиком своих договорных обязательств;</p>
<p class="list">вследствие обстоятельств непреодолимой силы.</p>
<p class="body">2.3. Срок строительства продлевается по соглашению сторон в установленном настоящем порядке и Правилами с учетом продолжительности действия обстоятельств, препятствующих исполнению обязательств по договору, путем подписания дополнительного соглашения к Договору.</p>
<p class="body">2.4. Сроки выполнения Работ по договору не продлеваются в случае вины Подрядчика в приостановлении Работ, а также в иных случаях, предусмотренных настоящим Договором. Все затраты, связанные с приостановкой строительства по указанному основанию, относятся на результаты хозяйственной и финансовой деятельности Подрядчика и Заказчиком не компенсируются.</p>
<p class="body">К приостановлению Работ по вине Подрядчика относятся в том числе: запрещение (приостановление) работ на Объекте по решению органов (организаций) или лиц, осуществляющих технический, авторский, санитарно-эпидемиологический, экологический надзор, другие виды контроля за строительством с оформлением соответствующих предписаний, актов и иных документов в которых будет указана вина Подрядчика, а также неисполнение (несвоевременное исполнение) Подрядчиком своих обязательств по Договору и (или) договорами с третьими лицами, которые привели к приостановке работ на Объекте.</p>
<p class="body">2.5. Подрядчик выполняет Работы собственными силами без привлечения субподрядчиков.</p>
<p class="body">2.6. Основанием для заключения Договора является наличие следующих документов у Подрядчика:</p>
<p class="list">– документов, подтверждающих право Подрядчика на осуществление строительной деятельности в соответствии с требованиями законодательства;</p>
<p class="list">– документов, подтверждающих наличие в штате аттестованных специалистов для выполнения работ собственными силами Подрядчика.</p>
<p class="body">2.7. Для решения текущих вопросов, возникающих в ходе выполнения Работ, предусмотренных настоящим Договором, и строительства Объекта, Стороны вправе проводить производственные совещания с участием участвующих в строительстве лиц, результаты совещаний оформляются протоколом и являются обязательными для исполнения Сторонами настоящего Договора и всеми участниками строительства Объекта.</p>
<p class="body">2.8. Представителями Сторон при исполнении настоящего Договора признаются должностные лица органов управления, лица, уполномоченные доверенностью.</p>
<div class="sp"></div>

<!-- 3. ЦЕНА -->
<p class="sh">3. ЦЕНА ДОГОВОРА</p>
<p class="body">3.1. Цена Договора определена по соглашению Сторон в соответствии с Протоколом согласования договорной цены (Приложение №2) и Графиком строительства (производства работ) (Приложение 3). Цена договора включает в себя стоимость всего комплекса строительных работ согласно ведомости объемов и стоимости работ, включая все необходимые сопутствующие работы для получения результата, соответствующего требованиям технических нормативных актов и проектной документации; материалов; транспорта; эксплуатации машин и механизмов и иных затрат Подрядчика и составляет ${d.total} (${d.totalWords}) с учетом НДС ${d.vatRate}% - ${d.vatAmt} (${d.vatWords}).</p>
<p class="body">Цена Договора покрывает все расходы Подрядчика, необходимые для нормального функционирования и полного завершения строительных работ на Объекте, получения конечного продукта (результата работ), в том числе стоимость материальных ресурсов, затраты на транспортировку, а также пошлины, сборы, налоги.</p>
<p class="body">3.2. Цена договора, отраженная в протоколе согласования договорной цены, является неизменной до завершения выполнения работ и может быть изменена только в случаях:</p>
<p class="list">3.2.1. изменения по инициативе Заказчика проектной документации, за исключением ее изменения по причине возникновения дополнительных работ;</p>
<p class="list">3.2.2. налогового законодательства в части установления и (или) отмены налогов и отчислений в доходы соответствующих бюджетов, которые влияют на формирование неизменной цены Договора, изменения налоговых ставок и объектов налогообложения, установления и (или) отмены налоговых льгот;</p>
<p class="list">3.2.3. нормативных правовых актов, регулирующих отношения в сфере ценообразования в строительстве;</p>
<p class="list">3.2.4. полного или частичного отказа Заказчика от выполнения Работ с письменным уведомлением Подрядчика за 5 (пять) календарных дней до момента начала выполнения конкретных видов работ;</p>
<p class="list">3.2.5. выявления в ходе строительства дополнительных объемов работ, не предусмотренных проектной документацией.</p>
<p class="body">3.3. Стоимость работ, не предусмотренных настоящим Договором, выявленных Подрядчиком и необходимых для выполнения (дополнительные работы), не входит в цену настоящего Договора и подлежит оплате при условии предварительного согласования Сторонами необходимости их выполнения и их стоимости. Согласование необходимости выполнения дополнительных работ и их стоимости производится путем подписания уполномоченными представителями Подрядчика и Заказчика Акта на дополнительные работы и прилагаемой к нему сметы.</p>
<p class="body">Расчет стоимости дополнительных работ производится по Базе нормативов расхода ресурсов в натуральном выражении 2022 года (далее – НРР 2022г.) на основании Методических указаний по применению нормативов расхода ресурсов в натуральном выражении (НРР 8.01.104-2022).</p>
<p class="body">3.4. Изменение цены Договора оформляется путем подписания дополнительного соглашения к Договору.</p>
<p class="body">3.5. Источник финансирования – собственные средства Заказчика.</p>
<p class="body">3.6. Все расчеты по Договору осуществляются в белорусских рублях.</p>
<p class="body">3.7. При срыве по вине Подрядчика срока строительства Объекта (выполнения строительных работ), установленного Договором, строительные работы, выполненные после указанного срока, оплачиваются по ценам, действовавшим на установленную Договором дату их завершения.</p>
<div class="sp"></div>

<!-- 4. ПОРЯДОК РАСЧЕТОВ -->
<p class="sh">4. ПОРЯДОК РАСЧЕТОВ</p>
<p class="body">4.1. Заказчик производит платежи Подрядчику в соответствии с Графиком платежей (Приложение №4).</p>
<p class="body">4.2. Оплату за выполненные работы по настоящему Договору Заказчик производит в течение 10 (десяти) календарных дней с даты приемки выполненных этапов работ на основании справки о стоимости выполненных работ (форма С-3а) и акта сдачи-приемки выполненных работ (форма С-2б).</p>
<p class="body">Справки по форме С-3а, акты по форме С-2б и иные документы должны соответствовать формам, утвержденным Министерством архитектуры и строительства Республики Беларусь.</p>
<p class="body">4.3. Оплата за материалы производится Заказчиком путём перечисления денежных средств в течении 5 (пяти) календарных дней после предоставления акта на основании товарно-транспортных накладных за недельный период с обязательным нахождением материалов на объекте.</p>
<p class="body">4.4. Подрядчик обязан предоставить надлежащим образом оформленные акт сдачи-приемки выполненных работ и справку о стоимости выполненных работ не позднее 3 (трех) рабочих дней по окончании отчетного периода. Заказчик обязан в течение 3 (трёх) рабочих дней рассмотреть предоставленные Подрядчиком акт сдачи-приемки выполненных работ и справку о стоимости выполненных работ, подписать их и заверить печатью.</p>
<p class="body">4.5. Одновременно с актом сдачи-приемки работ Подрядчик обязан передать Заказчику следующую документацию:</p>
<p class="list">– надлежащим образом оформленную ведомость израсходованных материалов на производство работ в отчетном периоде;</p>
<p class="list">– надлежащим образом оформленную ведомость смонтированного оборудования за расчетный период;</p>
<p class="list">– исполнительную документацию, предусмотренную ТНПА;</p>
<p class="list">– копии сертификатов соответствия, паспорта, акты испытаний и иные документы на материалы, оборудование, конструкции и комплектующие изделия;</p>
<p class="list">– иные документы и документацию, имеющие отношение к выполнению работ.</p>
<p class="body">4.6. За расчетный период принимается календарный месяц.</p>
<p class="body">4.7. При отказе одной из Сторон от подписания акта сдачи-приемки работ в нем делается отметка об этом с указанием мотивов отказа, и акт подписывается другой Стороной.</p>
<div class="sp"></div>

<!-- 5. ОБЕСПЕЧЕНИЕ ПРОЕКТНОЙ ДОКУМЕНТАЦИЕЙ -->
<p class="sh">5. ОБЕСПЕЧЕНИЕ СТРОИТЕЛЬСТВА ПРОЕКТНОЙ ДОКУМЕНТАЦИЕЙ</p>
<p class="body">5.1. Заказчик обязан до начала выполнения строительно-монтажных работ, но не позднее трёх рабочих дней до начала работ передать полный комплект проектной документации в трёх экземплярах Подрядчику со штампом «к производству работ».</p>
<p class="body">5.2. Заказчик, при внесении в проектную документацию изменений, обязан в течении трёх рабочих дней передать Подрядчику не менее 3 (трёх) экземпляров измененной документации.</p>
<div class="sp"></div>

<!-- 6. ПРАВА И ОБЯЗАННОСТИ -->
<p class="sh">6. ПРАВА И ОБЯЗАННОСТИ СТОРОН</p>
<p class="body">6.1. Заказчик обязуется:</p>
<p class="list">6.1.1. надлежащим образом исполнять условия Договора;</p>
<p class="list">6.1.2. предоставить Подрядчику по двухстороннему акту строительную площадку (фронт работ) до начала производства работ;</p>
<p class="list">6.1.3. обеспечивать финансирование работ, принимать и своевременно оплачивать в установленном порядке надлежащим образом и качественно выполненные работы;</p>
<p class="list">6.1.4. незамедлительно письменно уведомлять Подрядчика о работах ненадлежащего качества и отступлениях от условий заключенного Договора;</p>
<p class="list">6.1.5. в пределах своей компетенции содействовать Подрядчику в выполнении работ, принимать меры по устранению препятствий в исполнении Договора;</p>
<p class="list">6.1.6. выплачивать неустойку Подрядчику, предусмотренную настоящим Договором, в случае неисполнения или ненадлежащего исполнения своих обязательств;</p>
<p class="list">6.1.7. обеспечить производство строительно-монтажных работ электрической энергией, водоснабжением и иными коммунальными услугами;</p>
<p class="list">6.1.8. принимать в установленном порядке надлежащим образом и качественно выполненные строительные работы;</p>
<p class="list">6.1.9. при выявлении работ ненадлежащего качества в период гарантийного срока оформить дефектный акт на гарантийный ремонт по форме С-23;</p>
<p class="list">6.1.10. назначить приказом из числа своих сотрудников ответственного исполнителя для подписания актов выполненных работ и исполнительной документации.</p>
<p class="body">6.2. Заказчик имеет право:</p>
<p class="list">6.2.1. инициировать внесение изменений в Договор, требовать его расторжения в случаях, предусмотренных законодательством;</p>
<p class="list">6.2.2. осуществлять контроль и технический надзор за ходом и качеством выполняемых работ, соблюдением сроков их выполнения;</p>
<p class="list">6.2.3. посещать Объект в течение всего периода выполнения работ и знакомиться с ходом выполнения работ;</p>
<p class="list">6.2.4. требовать от Подрядчика информацию о ходе производства работ, о намечаемых конкретных датах завершения работ;</p>
<p class="list">6.2.5. требовать за счет Подрядчика устранения результата работ ненадлежащего качества;</p>
<p class="list">6.2.6. отказаться от принятия результата Работ в случае выявления Работ ненадлежащего качества;</p>
<p class="list">6.2.7. взыскать с Подрядчика неустойку в случае нарушения настоящего Договора Подрядчиком.</p>
<p class="body">6.3. Подрядчик обязуется:</p>
<p class="list">6.3.1. исполнять условия Договора;</p>
<p class="list">6.3.2. выполнять Работы в соответствии с требованиями нормативных правовых актов, в том числе технических нормативных правовых актов;</p>
<p class="list">6.3.3. выполнять Работы в определенные Договором сроки;</p>
<p class="list">6.3.4. обеспечить поставку на Объект материалов, изделий, необходимых для выполнения работ;</p>
<p class="list">6.3.5. экономно использовать строительные материалы;</p>
<p class="list">6.3.6. обеспечивать надлежащее и безопасное складирование материалов, регулярную уборку помещения от строительных отходов и мусора;</p>
<p class="list">6.3.7. информировать Заказчика о ходе исполнения обязательств по Договору;</p>
<p class="list">6.3.8. своевременно устранять за свой счет результат Работ ненадлежащего качества;</p>
<p class="list">6.3.9. своевременно сообщать Заказчику о необходимости выполнения дополнительных Работ, непредусмотренных проектной документацией;</p>
<p class="list">6.3.10. передать Заказчику результат Работ в срок, предусмотренный п. 2.1 настоящего Договора;</p>
<p class="list">6.3.11. принимать необходимые меры по устранению обстоятельств, препятствующих надлежащему исполнению Договора;</p>
<p class="list">6.3.12. возмещать Заказчику расходы за потребленную электроэнергию и воду на основании показаний счетчиков;</p>
<p class="list">6.3.13. соблюдать действующее законодательство, регулирующее вопросы охраны труда, техники безопасности, производственной санитарии, пожарной безопасности;</p>
<p class="list">6.3.14. передать Заказчику исполнительную документацию не позднее 10 (десяти) календарных дней до приемки Объекта в эксплуатацию;</p>
<p class="list">6.3.15. по завершении работ освободить строительную площадку от строительных отходов, мусора, строительных машин и оборудования.</p>
<p class="body">6.4. Подрядчик вправе:</p>
<p class="list">6.4.1. получать плату за выполненные Работы в соответствии с Договором;</p>
<p class="list">6.4.2. приостанавливать выполнение Работ в случае неисполнения Заказчиком своих обязательств по Договору;</p>
<p class="list">6.4.3. инициировать внесение изменений в Договор, требовать его расторжения в случаях, предусмотренных Договором и законодательством;</p>
<p class="list">6.4.4. выполнять дополнительные работы при условии согласования их с Заказчиком;</p>
<p class="list">6.4.5. взыскать с Заказчика неустойку в случае нарушения настоящего Договора Заказчиком.</p>
<div class="sp"></div>

<!-- 7. СДАЧА-ПРИЕМКА -->
<p class="sh">7. ПОРЯДОК СДАЧИ-ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ</p>
<p class="body">7.1. Приемка в эксплуатацию Объекта осуществляется в соответствии с Положением о порядке приемки в эксплуатацию объектов строительства, утвержденным Постановлением Совета Министров Республики Беларусь от 06.06.2011 № 716.</p>
<p class="body">7.2. Заказчик, получивший сообщение Подрядчика о готовности к сдаче выполненных строительных работ, обязан в течение 5 (пяти) рабочих дней принять выполненные Работы либо отказаться от их приемки.</p>
<p class="body">При отказе одной из Сторон от подписания акта сдачи-приемки работ в нем делается отметка об этом с указанием мотивов отказа и акт подписывается другой Стороной.</p>
<p class="body">7.3. Риск случайной гибели или случайного повреждения результата выполненных работ до его приемки в установленном порядке Заказчиком несет Подрядчик.</p>
<div class="sp"></div>

<!-- 8. ГАРАНТИЙНЫЕ -->
<p class="sh">8. ГАРАНТИЙНЫЕ ОБЯЗАТЕЛЬСТВА</p>
<p class="body">8.1. Гарантийный срок на выполненные работы составляет 5 (пять) лет, за исключением технологического, инженерного, сантехнического, электротехнического и другого оборудования, материалов и изделий, гарантийный срок на которые устанавливается законодательством или изготовителем.</p>
<p class="body">8.2. Исчисление гарантийного срока начинается со дня приёмки Заказчиком всего объема выполненных Работ по настоящему Договору.</p>
<p class="body">8.3. Дефекты, выявленные в период гарантийного срока на выполненные Работы, устраняются за счет Подрядчика.</p>
<p class="body">8.4. Выявленные дефекты должны быть устранены Подрядчиком в срок, согласованный с Заказчиком. В случаях не устранения Подрядчиком ненадлежащего качества работ в указанный срок, Заказчик вправе привлекать для устранения выявленных недостатков третьих лиц с отнесением стоимости выполненных ими работ на счет Подрядчика.</p>
<p class="body">8.5. Исчисление гарантийного срока на выполненные работы прерывается на все время, на протяжении которого Объект не мог эксплуатироваться вследствие недостатков, за которые несет ответственность Подрядчик.</p>
<p class="body">8.6. Подрядчик не несет ответственности за обнаруженные в пределах гарантийного срока дефекты, если он докажет, что они произошли вследствие нормативного износа объекта, неправильной его эксплуатации, повреждения третьими лицами.</p>
<div class="sp"></div>

<!-- 9. ОТВЕТСТВЕННОСТЬ -->
<p class="sh">9. ОТВЕТСТВЕННОСТЬ СТОРОН</p>
<p class="body">9.1. Заказчик несет ответственность:</p>
<p class="list">9.1.1. за необоснованное уклонение от приемки выполненных работ – 0,2% от стоимости непринятых работ за каждый день просрочки, но не более стоимости этих работ;</p>
<p class="list">9.1.2. за несвоевременное проведение расчетов за выполненные и принятые в установленном порядке работы – 0,2% не перечисленной суммы за каждый день просрочки платежа, но не более этой суммы.</p>
<p class="body">9.2. Подрядчик несет ответственность за неисполнение или ненадлежащее исполнение обязательств, предусмотренных настоящим Договором, и уплачивает неустойку (пеню) Заказчику:</p>
<p class="list">9.2.1. за нарушение установленных в договоре сроков выполнения работ – 1% стоимости невыполненных работ за каждый день просрочки;</p>
<p class="list">9.2.2. за превышение по своей вине сроков передачи результата работ – 1% стоимости результата работ за каждый день просрочки;</p>
<p class="list">9.2.3. за несвоевременное устранение дефектов – 2% стоимости работ по устранению дефектов за каждый день просрочки, начиная со дня окончания указанного в дефектном акте срока.</p>
<p class="body">9.3. Подрядчик несет ответственность за несоблюдение норм техники безопасности, пожарной безопасности, производственной санитарии, охраны труда.</p>
<p class="body">9.4. Подрядчик, нарушивший настоящий Договор, возмещает Заказчику все убытки, причиненные вследствие нарушения Договора, не покрытые неустойкой.</p>
<p class="body">9.5. Окончание срока действия настоящего Договора не освобождает Стороны от ответственности за его нарушение.</p>
<div class="sp"></div>

<!-- 10. ОБЕСПЕЧЕНИЕ ИСПОЛНЕНИЯ -->
<p class="sh">10. ОБЕСПЕЧЕНИЕ ИСПОЛНЕНИЯ ОБЯЗАТЕЛЬСТВ ПОДРЯДЧИКОМ</p>
<p class="body">10.1. В целях обеспечения исполнения своих обязательств по устранению результата строительных работ ненадлежащего качества Заказчик удерживает у Подрядчика обеспечение в виде удержания 1 (одного) процента от выполненных работ в каждом отчётном периоде.</p>
<p class="body">10.2. Возврат Подрядчику обеспечения производится в следующем порядке: 50 (пятьдесят) процентов зарезервированных средств выплачиваются спустя год после завершения работ, оставшиеся 50 (пятьдесят) процентов ежегодно равными долями до истечения гарантийного срока.</p>
<p class="body">10.3. Исчисление срока резервирования средств начинается с первого дня гарантийного срока эксплуатации Объекта.</p>
<div class="sp"></div>

<!-- 11. ФОРС-МАЖОР -->
<p class="sh">11. ФОРС-МАЖОРНЫЕ ОБСТОЯТЕЛЬСТВА</p>
<p class="body">11.1. Ни одна из Сторон не несет ответственности за полное и частичное неисполнение любой из своих обязанностей, если неисполнение является следствием обстоятельств непреодолимой силы (чрезвычайных и непредотвратимых при данных условиях обстоятельств: война, гражданская война, стихийные бедствия, забастовки и другие обстоятельства непреодолимой силы), возникших после заключения Договора.</p>
<p class="body">11.2. Если любое из таких обстоятельств непосредственно повлияло на исполнение обязательств в срок, установленный в Договоре, то этот срок соразмерно отодвигается на время действия соответствующих обстоятельств.</p>
<p class="body">11.3. Сторона, для которой создалась невозможность исполнения обязательства, обязана уведомить в письменной форме другую Сторону о наступлении форс-мажорных обстоятельств не позднее 5 (пяти) дней с момента их наступления.</p>
<p class="body">11.4. Факты, изложенные в уведомлении, должны быть подтверждены Белорусской торгово-промышленной палатой.</p>
<div class="sp"></div>

<!-- 12. ИЗМЕНЕНИЕ И РАСТОРЖЕНИЕ -->
<p class="sh">12. ИЗМЕНЕНИЕ И РАСТОРЖЕНИЕ ДОГОВОРА, РАЗРЕШЕНИЕ СПОРОВ</p>
<p class="body">12.1. Изменения и дополнения в настоящий договор вносятся путём заключения Сторонами дополнительного соглашения в порядке, установленном пунктом 74 Правил.</p>
<p class="body">12.2. Настоящий договор может быть расторгнут в случаях, предусмотренных пунктом 76 Правил.</p>
<p class="body">12.3. Оформление расторжения договора осуществляется в порядке, предусмотренном пунктами 77-78 Правил.</p>
<p class="body">12.4. Сторона вправе отказаться от исполнения договора в случаях, предусмотренных пунктом 79 Правил.</p>
<div class="sp"></div>

<!-- 13. ЗАКЛЮЧИТЕЛЬНЫЕ -->
<p class="sh">13. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ</p>
<p class="body">13.1. Настоящий Договор, Приложения к нему составлены в 2 (двух) экземплярах, имеющих одинаковую юридическую силу, по одному экземпляру для каждой Стороны.</p>
<p class="body">13.2. Все Приложения к Договору являются его неотъемлемыми частями. При расхождении условий настоящего Договора с условиями, содержащимися в Приложениях к нему, приоритет имеют условия Договора.</p>
<p class="body">13.3. Договор вступает в силу с даты его подписания Сторонами и действует до полного исполнения Сторонами всех своих обязательств.</p>
<p class="body">13.4. Каждая из Сторон обязана в течение 3 (трех) рабочих дней известить другую Сторону об изменении банковских реквизитов, почтового, юридического адресов, иных событиях, влияющих на исполнение своих обязательств по Договору.</p>
<p class="body">13.5. Приложения к Договору:</p>
<p class="list">Приложение 1. Ведомость объемов и стоимости работ;</p>
<p class="list">Приложение 2. Протокол согласования договорной цены;</p>
<p class="list">Приложение 3. График строительства (производства работ);</p>
<p class="list">Приложение 4. График платежей при строительстве (выполнении работ);</p>
<p class="list">Приложение 5. Аттестат соответствия на выполняемые работы.</p>
<div class="sp"></div>

<!-- 14. РЕКВИЗИТЫ -->
<p class="sh">14. АДРЕСА, РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</p>
<div class="sp"></div>
<table class="req">
<tbody>
<tr>
<td>
<p class="req-title">ПОДРЯДЧИК:</p>
<p>ООО «МСК Релайбл»</p>
<p>Адрес: 220113, г. Минск, ул. Мележа, д. 4</p>
<p>УНП: 193607959</p>
<p>Текущий (расчетный): BY91ALFA30122B38250010270000 в BYN</p>
<p>в ЗАО «Альфа-Банк», БИК: ALFABY2X</p>
<p>220013, г. Минск, ул. Сурганова, 43-47</p>
<p>E-mail: MCK-Reliable@yandex.ru</p>
<p>тел.: +375444543857</p>
<br>
<p>Директор ___________&nbsp;В.И. Хурс</p>
</td>
<td>
<p class="req-title">ЗАКАЗЧИК:</p>
<p>${d.clName}</p>
<p>УНП: ${d.clUNP}${d.clOKPO ? `; ОКПО: ${d.clOKPO}` : ''}</p>
<p>${d.clAddr}</p>
<p>${d.clBank}</p>
<p>в ${d.clBankName}, БИК: ${d.clBankBIC}</p>
${d.clEmail ? `<p>E-mail: ${d.clEmail}</p>` : ''}
${d.clPhone ? `<p>тел.: ${d.clPhone}</p>` : ''}
<br>
<p>Директор ___________&nbsp;${d.clDirector}</p>
</td>
</tr>
</tbody>
</table>

</body></html>`;
}


// отправить push конкретному клиенту
async function sendPushToClient(clientUserID, payload) {
    try {
        const result = await pool.request()
            .input('UserID', sql.Int, clientUserID)
            .execute('sp_GetPushSubscriptionsByUser');

        const subs = result.recordset;
        if (!subs.length) return;

        const message = JSON.stringify(payload);

        for (const sub of subs) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.Endpoint, keys: { p256dh: sub.P256dh, auth: sub.Auth } },
                    message
                );
            } catch (err) {
                if (err.statusCode === 410) {
                    await pool.request()
                        .input('Endpoint', sql.NVarChar, sub.Endpoint)
                        .execute('sp_DeletePushSubscriptionByEndpoint');
                    console.log('Удалена протухшая подписка:', sub.Endpoint);
                }
            }
        }
    } catch (err) {
        console.error('Ошибка sendPushToClient:', err);
    }
}

connectToDB().then(() => {
    app.listen(PORT, () => {
        console.log('\n' + '='.repeat(60));
        console.log(' СЕРВЕР ЗАПУЩЕН');
        console.log('='.repeat(60));
        console.log(` Локальный адрес: http://localhost:${PORT}`);
        console.log(` Панель менеджера: http://localhost:${PORT}/manager`);
        console.log(` Админ-логин: http://localhost:${PORT}/admin/login`);
        console.log('='.repeat(60) + '\n');
    });
});

process.on('SIGINT', async () => {
    console.log('\nЗавершение работы сервера...');
    if (pool) await pool.close();
    process.exit(0);
})