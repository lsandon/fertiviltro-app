document.addEventListener('DOMContentLoaded', () => {
    const claimList = document.getElementById('claim-list');
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

    async function fetchClaims() {
        try {
            const response = await fetch(`${BASE_URL}/reclamaciones`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const claims = await response.json();
                renderClaims(claims);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar las reclamaciones.';
            }
        } catch (error) {
            console.error('Error al obtener reclamaciones:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderClaims(claims) {
        claimList.innerHTML = '';
        claims.forEach(claim => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${claim.id}</td>
                <td>${claim.cliente_nombre}</td>
                <td>${claim.asunto}</td>
                <td>${claim.estado}</td>
                <td>${new Date(claim.fecha_creacion).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm" onclick="viewClaimDetails(${claim.id})">Ver Detalles</button>
                </td>
            `;
            claimList.appendChild(row);
        });
    }

    window.viewClaimDetails = (id) => {
        window.location.href = `/admin-claim-details.html?id=${id}`;
    };

    fetchClaims();
});