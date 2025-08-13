document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('user-list');
    const userForm = document.getElementById('user-form');
    const errorMessage = document.getElementById('error-message');

    const BASE_URL = 'https://fertiviltro-app-production.up.railway.app/api';

    const loggedInUser = JSON.parse(localStorage.getItem('user'));

    if (!loggedInUser || !loggedInUser.token || loggedInUser.user.role !== 'admin') {
        window.location.href = '/index.html';
    }

    // Funcionalidad de cerrar sesión
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            window.location.href = '/index.html';
        });
    }

    async function fetchUsers() {
        try {
            const response = await fetch(`${BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const users = await response.json();
                renderUsers(users);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar los usuarios.';
            }
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderUsers(users) {
        userList.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.role === 'admin' ? 'Administrador' : 'Cliente'}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.username}')">Eliminar</button>
                </td>
            `;
            userList.appendChild(row);
        });
    }

    window.deleteUser = async (username) => {
        if (confirm(`¿Estás seguro de que quieres eliminar al usuario ${username}?`)) {
            try {
                const response = await fetch(`${BASE_URL}/users/${username}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${loggedInUser.token}`
                    }
                });

                if (response.ok) {
                    fetchUsers(); // Recargar la lista de usuarios
                    
                } else {
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al eliminar el usuario.';
                }
            } catch (error) {
                console.error('Error al eliminar usuario:', error);
                errorMessage.textContent = 'Error de conexión con el servidor.';
            }
        }
    };

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = userForm.username.value;
        const password = userForm.password.value;
        const role = userForm.role.value;

        try {
            const response = await fetch(`${BASE_URL}/register-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({ username, password, role }),
            });

            if (response.ok) {
                fetchUsers();
                userForm.reset();
                
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al crear el usuario.';
            }
        } catch (error) {
            console.error('Error al crear usuario:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    fetchUsers();
});