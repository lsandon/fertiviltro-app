document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    const BASE_URL = 'https://fertiviltro-app-production.up.railway.app/api'; // URL base de tu API backend

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        try {
            const response = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                
                localStorage.setItem('user', JSON.stringify(data));
                if (data.user.role === 'admin') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/app.html';
                }
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Usuario o contraseña incorrectos.';
            }
        } catch (error) {
            console.error('Error during login:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });
});