document.addEventListener('DOMContentLoaded', () => {
    const processList = document.getElementById('process-list');
    const errorMessage = document.getElementById('error-message');

    const createProcessBtn = document.getElementById('create-process-btn');
    const createProcessModal = document.getElementById('create-process-modal');
    const closeProcessModalBtn = createProcessModal.querySelector('.close-button');
    const createProcessForm = document.getElementById('create-process-form');
    const processClientSelect = document.getElementById('process-client');

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

    async function fetchProcesses() {
        try {
            const response = await fetch(`${BASE_URL}/procesos`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const processes = await response.json();
                renderProcesses(processes);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar los procesos.';
            }
        } catch (error) {
            console.error('Error al obtener procesos:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderProcesses(processes) {
        processList.innerHTML = '';
        processes.forEach(process => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${process.id}</td>
                <td>${process.cliente_nombre}</td>
                <td>${process.estado_proceso}</td>
                <td>
                    <button class="btn btn-sm" onclick="viewProcessDetails(${process.id})">Ver Detalles</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProcess(${process.id})">Eliminar</button>
                </td>
            `;
            processList.appendChild(row);
        });
    }

    window.deleteProcess = async (id) => {
        if (confirm(`¿Estás seguro de que quieres eliminar el proceso ${id}?`)) {
            try {
                const response = await fetch(`${BASE_URL}/procesos/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${loggedInUser.token}`
                    }
                });

                if (response.ok) {
                    fetchProcesses(); // Recargar la lista de procesos
                    
                } else {
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al eliminar el proceso.';
                }
            } catch (error) {
                console.error('Error al eliminar proceso:', error);
                errorMessage.textContent = 'Error de conexión con el servidor.';
            }
        }
    };

    window.viewProcessDetails = (id) => {
        window.location.href = `/admin-process-details.html?id=${id}`;
    };

    // Lógica para el modal de creación de proceso
    createProcessBtn.addEventListener('click', async () => {
        // Cargar clientes en el select
        try {
            const response = await fetch(`${BASE_URL}/clientes`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const clients = await response.json();
                processClientSelect.innerHTML = clients.map(client => 
                    `<option value="${client.id}">${client.nombre}</option>`
                ).join('');
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar clientes para el proceso.';
            }
        } catch (error) {
            console.error('Error al cargar clientes para la creación de procesos:', error);
            errorMessage.textContent = 'Error de conexión al cargar clientes.';
        }
        createProcessModal.style.display = 'block';
    });

    closeProcessModalBtn.addEventListener('click', () => {
        createProcessModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === createProcessModal) {
            createProcessModal.style.display = 'none';
        }
    });

    createProcessForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cliente_id = processClientSelect.value;

        try {
            const response = await fetch(`${BASE_URL}/procesos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({ cliente_id: parseInt(cliente_id) }),
            });

            if (response.ok) {
                createProcessModal.style.display = 'none';
                createProcessForm.reset();
                fetchProcesses(); // Recargar la lista de procesos
                
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al crear el proceso.';
            }
        } catch (error) {
            console.error('Error al crear proceso:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    fetchProcesses();
});