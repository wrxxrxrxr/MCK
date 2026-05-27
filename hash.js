const bcrypt = require('bcrypt');

// Для пароля админа
bcrypt.hash('admin987', 10).then(hash => {
    console.log('ADMIN_PASSWORD_HASH=' + hash);
});

// Для пароля менеджера 
bcrypt.hash('manager123', 10).then(hash => {
    console.log('MANAGER_PASSWORD_HASH=' + hash);
});