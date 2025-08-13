document.addEventListener('DOMContentLoaded', () => {
    const clientList = document.getElementById('client-list');
    const clientForm = document.getElementById('client-form');
    const errorMessage = document.getElementById('error-message');
    const searchInput = document.getElementById('search');

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

    let allClients = [];

    async function fetchClients() {
        try {
            const response = await fetch(`${BASE_URL}/clientes`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                allClients = await response.json();
                renderClients(allClients);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar los clientes.';
            }
        } catch (error) {
            console.error('Error al obtener clientes:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderClients(clients) {
        clientList.innerHTML = '';
        clients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${client.nombre}</td>
                <td>${client.region}, ${client.municipio}</td>
                <td>${client.estado_proceso}</td>
                <td>
                    <button class="btn btn-sm" onclick="viewClient(${client.id})">Ver</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteClient(${client.id})">Eliminar</button>
                </td>
            `;
            clientList.appendChild(row);
        });
    }

    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = clientForm.name.value;
        const email = clientForm.email.value;
        const phone = clientForm.phone.value;
        const region = clientForm.region.value;
        const municipality = clientForm.municipality.value;

        try {
            const response = await fetch(`${BASE_URL}/clientes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({ 
                    nombre: name, 
                    email: email, 
                    telefono: phone, 
                    region: region, 
                    municipio: municipality
                }),
            });

            if (response.ok) {
                fetchClients();
                clientForm.reset();
                
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al crear el cliente.';
            }
        } catch (error) {
            console.error('Error al crear cliente:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredClients = allClients.filter(client => client.nombre.toLowerCase().includes(searchTerm));
        renderClients(filteredClients);
    });

    window.viewClient = (id) => {
        // Redirigir a la página de detalles del cliente
        window.location.href = `/admin-client-details.html?id=${id}`;
    };

    window.deleteClient = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            try {
                const response = await fetch(`${BASE_URL}/clientes/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${loggedInUser.token}`
                    }
                });

                if (response.ok) {
                    fetchClients();
                    
                } else {
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al eliminar el cliente.';
                }
            } catch (error) {
                console.error('Error al eliminar cliente:', error);
                errorMessage.textContent = 'Error de conexión con el servidor.';
            }
        }
    };

    fetchClients();
});