document.addEventListener('DOMContentLoaded', () => {
    const claimInfo = document.getElementById('claim-info');
    const responseForm = document.getElementById('response-form');
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

    const urlParams = new URLSearchParams(window.location.search);
    const claimId = urlParams.get('id');

    async function fetchClaimDetails() {
        try {
            const response = await fetch(`${BASE_URL}/reclamaciones/${claimId}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const claim = await response.json();
                renderClaimDetails(claim);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar los detalles del reclamo.';
            }
        } catch (error) {
            console.error('Error al obtener detalles del reclamo:', error);
            showNotification('Error de conexión con el servidor.', 'error');
        }
    }

    function renderClaimDetails(claim) {
        claimInfo.innerHTML = `
            <p><strong>Cliente:</strong> ${claim.cliente_nombre}</p>
            <p><strong>Asunto:</strong> ${claim.asunto}</p>
            <p><strong>Estado:</strong> ${claim.estado}</p>
            <p><strong>Descripción:</strong> ${claim.observaciones}</p>
        `;
    }

    responseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const response = responseForm.response.value;

        try {
            const res = await fetch(`${BASE_URL}/reclamaciones/${claimId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({ respuesta: response, estado: 'Respondido' })
            });

            if (res.ok) {
                fetchClaimDetails();
                
            } else {
                const errorData = await res.json();
                errorMessage.textContent = errorData.message || 'Error al enviar la respuesta.';
            }
        } catch (error) {
            console.error('Error al enviar respuesta:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    fetchClaimDetails();
});
