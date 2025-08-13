document.addEventListener('DOMContentLoaded', () => {
    const clientName = document.getElementById('client-name');
    const clientInfo = document.getElementById('client-info');
    const processList = document.getElementById('process-list');
    const donadorasList = document.getElementById('donadoras-list');
    const receptorasList = document.getElementById('receptoras-list');
    const errorMessage = document.getElementById('error-message');

    const addDonadoraBtn = document.getElementById('add-donadora-btn');
    const donadoraModal = document.getElementById('donadora-modal');
    const donadoraModalTitle = document.getElementById('donadora-modal-title');
    const donadoraForm = document.getElementById('donadora-form');
    const donadoraIdInput = document.getElementById('donadora-id');
    const donadoraCodigoInput = document.getElementById('donadora-codigo');
    const donadoraRazaInput = document.getElementById('donadora-raza');
    const donadoraEdadInput = document.getElementById('donadora-edad');
    const donadoraHistorialInput = document.getElementById('donadora-historial');
    const closeDonadoraModalBtn = donadoraModal.querySelector('.close-button');

    const addReceptoraBtn = document.getElementById('add-receptora-btn');
    const receptoraModal = document.getElementById('receptora-modal');
    const receptoraModalTitle = document.getElementById('receptora-modal-title');
    const receptoraForm = document.getElementById('receptora-form');
    const receptoraIdInput = document.getElementById('receptora-id');
    const receptoraCodigoInput = document.getElementById('receptora-codigo');
    const receptoraObservacionesInput = document.getElementById('receptora-observaciones');
    const closeReceptoraModalBtn = receptoraModal.querySelector('.close-button');

    const BASE_URL = 'http://localhost:3000/api';

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
    const clientId = urlParams.get('id');

    async function fetchClientDetails() {
        try {
            const response = await fetch(`${BASE_URL}/clientes/${clientId}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const client = await response.json();
                renderClientDetails(client);
                fetchDonadoras(clientId);
                fetchReceptoras(clientId);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar los detalles del cliente.';
            }
        } catch (error) {
            console.error('Error al obtener detalles del cliente:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderClientDetails(client) {
        clientName.textContent = client.nombre;
        clientInfo.innerHTML = `
            <p><strong>Email:</strong> ${client.email}</p>
            <p><strong>Teléfono:</strong> ${client.telefono}</p>
            <p><strong>Región:</strong> ${client.region}</p>
            <p><strong>Municipio:</strong> ${client.municipio}</p>
            <p><strong>Finca:</strong> ${client.finca || 'N/A'}</p>
            <p><strong>Tipo de Cliente:</strong> ${client.tipo_cliente}</p>
            <p><strong>Embriones Deseados:</strong> ${client.embriones_deseados}</p>
            <p><strong>Receptoras Disponibles:</strong> ${client.receptoras_disponibles}</p>
            <p><strong>Observaciones:</strong> ${client.observaciones || 'N/A'}</p>
            <p><strong>Estado del Proceso:</strong> ${client.estado_proceso}</p>
        `;
    }

    async function fetchProcesses() {
        try {
            const response = await fetch(`${BASE_URL}/procesos?cliente_id=${clientId}`, {
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
                <td>${process.estado_proceso}</td>
                <td>
                    <button class="btn btn-sm" onclick="viewProcess(${process.id})">Ver</button>
                </td>
            `;
            processList.appendChild(row);
        });
    }

    // --- Funciones para Donadoras ---
    async function fetchDonadoras(clientId) {
        try {
            const response = await fetch(`${BASE_URL}/donadoras?cliente_id=${clientId}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const donadoras = await response.json();
                renderDonadoras(donadoras);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar las donadoras.';
            }
        } catch (error) {
            console.error('Error al obtener donadoras:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderDonadoras(donadoras) {
        donadorasList.innerHTML = '';
        if (donadoras.length === 0) {
            donadorasList.innerHTML = '<tr><td colspan="5">No hay donadoras registradas para este cliente.</td></tr>';
            return;
        }
        donadoras.forEach(donadora => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${donadora.codigo}</td>
                <td>${donadora.raza}</td>
                <td>${donadora.edad}</td>
                <td>${donadora.historial || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm" onclick="editDonadora(${donadora.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDonadora(${donadora.id})">Eliminar</button>
                </td>
            `;
            donadorasList.appendChild(row);
        });
    }

    // --- Funciones para Receptoras ---
    async function fetchReceptoras(clientId) {
        try {
            const response = await fetch(`${BASE_URL}/receptoras?cliente_id=${clientId}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const receptoras = await response.json();
                renderReceptoras(receptoras);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar las receptoras.';
            }
        } catch (error) {
            console.error('Error al obtener receptoras:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderReceptoras(receptoras) {
        receptorasList.innerHTML = '';
        if (receptoras.length === 0) {
            receptorasList.innerHTML = '<tr><td colspan="3">No hay receptoras registradas para este cliente.</td></tr>';
            return;
        }
        receptoras.forEach(receptora => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${receptora.codigo}</td>
                <td>${receptora.observaciones || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm" onclick="editReceptora(${receptora.id})">Editar</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReceptora(${receptora.id})">Eliminar</button>
                </td>
            `;
            receptorasList.appendChild(row);
        });
    }

    // --- Lógica de Modales y Formularios ---

    // Donadora Modal
    addDonadoraBtn.addEventListener('click', () => {
        donadoraModalTitle.textContent = 'Añadir Donadora';
        donadoraForm.reset();
        donadoraIdInput.value = '';
        donadoraModal.style.display = 'block';
    });

    closeDonadoraModalBtn.addEventListener('click', () => {
        donadoraModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === donadoraModal) {
            donadoraModal.style.display = 'none';
        }
    });

    donadoraForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = donadoraIdInput.value;
        const codigo = donadoraCodigoInput.value;
        const raza = donadoraRazaInput.value;
        const edad = donadoraEdadInput.value;
        const historial = donadoraHistorialInput.value;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${BASE_URL}/donadoras/${id}` : `${BASE_URL}/donadoras`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({ cliente_id: clientId, codigo, raza, edad, historial }),
            });

            if (response.ok) {
                donadoraModal.style.display = 'none';
                fetchDonadoras(clientId);
                
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al guardar la donadora.';
            }
        } catch (error) {
            console.error('Error al guardar donadora:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    window.editDonadora = async (id) => {
        try {
            const response = await fetch(`${BASE_URL}/donadoras/${id}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const donadora = await response.json();
                donadoraModalTitle.textContent = 'Editar Donadora';
                donadoraIdInput.value = donadora.id;
                donadoraCodigoInput.value = donadora.codigo;
                donadoraRazaInput.value = donadora.raza;
                donadoraEdadInput.value = donadora.edad;
                donadoraHistorialInput.value = donadora.historial;
                donadoraModal.style.display = 'block';
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar la donadora para editar.';
            }
        } catch (error) {
            console.error('Error al cargar donadora para editar:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    };

    window.deleteDonadora = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar esta donadora?')) {
            try {
                const response = await fetch(`${BASE_URL}/donadoras/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${loggedInUser.token}`
                    }
                });

                if (response.ok) {
                    fetchDonadoras(clientId);
                    
                } else {
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al eliminar la donadora.';
                }
            } catch (error) {
                console.error('Error al eliminar donadora:', error);
                errorMessage.textContent = 'Error de conexión con el servidor.';
            }
        }
    };

    // Receptora Modal
    addReceptoraBtn.addEventListener('click', () => {
        receptoraModalTitle.textContent = 'Añadir Receptora';
        receptoraForm.reset();
        receptoraIdInput.value = '';
        receptoraModal.style.display = 'block';
    });

    closeReceptoraModalBtn.addEventListener('click', () => {
        receptoraModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === receptoraModal) {
            receptoraModal.style.display = 'none';
        }
    });

    receptoraForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = receptoraIdInput.value;
        const codigo = receptoraCodigoInput.value;
        const observaciones = receptoraObservacionesInput.value;

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${BASE_URL}/receptoras/${id}` : `${BASE_URL}/receptoras`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({ cliente_id: clientId, codigo, observaciones }),
            });

            if (response.ok) {
                receptoraModal.style.display = 'none';
                fetchReceptoras(clientId);
                
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al guardar la receptora.';
            }
        } catch (error) {
            console.error('Error al guardar receptora:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    window.editReceptora = async (id) => {
        try {
            const response = await fetch(`${BASE_URL}/receptoras/${id}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                const receptora = await response.json();
                receptoraModalTitle.textContent = 'Editar Receptora';
                receptoraIdInput.value = receptora.id;
                receptoraCodigoInput.value = receptora.codigo;
                receptoraObservacionesInput.value = receptora.observaciones;
                receptoraModal.style.display = 'block';
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar la receptora para editar.';
            }
        } catch (error) {
            console.error('Error al cargar receptora para editar:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    };

    window.deleteReceptora = async (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar esta receptora?')) {
            try {
                const response = await fetch(`${BASE_URL}/receptoras/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${loggedInUser.token}`
                    }
                });

                if (response.ok) {
                    fetchReceptoras(clientId);
                    
                } else {
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al eliminar la receptora.';
                }
            } catch (error) {
                console.error('Error al eliminar receptora:', error);
                errorMessage.textContent = 'Error de conexión con el servidor.';
            }
        }
    };

    window.viewProcess = (id) => {
        window.location.href = `/admin-process-details.html?id=${id}`;
    };

    fetchClientDetails();
    fetchProcesses();
});