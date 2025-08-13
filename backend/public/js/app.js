document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = JSON.parse(localStorage.getItem('user'));
    console.log('Logged in user object:', loggedInUser);
    console.log('Logged in username (from token):', loggedInUser.user.username);
    if (!loggedInUser || !loggedInUser.token) {
        window.location.href = 'index.html';
        return;
    }

    const processesContainer = document.getElementById('processes-container');
    const claimsContainer = document.getElementById('claims-container');
    const createClaimBtn = document.getElementById('create-claim-btn');
    const claimModal = document.getElementById('claim-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const claimForm = document.getElementById('claim-form');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const contentSections = document.querySelectorAll('.content-section');

    const BASE_URL = 'https://fertiviltro-app-production.up.railway.app/api';

    // Helper para añadir el encabezado de autorización
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loggedInUser.token}`
    });

    // Mostrar nombre de usuario
    usernameDisplay.textContent = loggedInUser.user.username;

    // Lógica de navegación
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.getAttribute('data-section');

            navLinks.forEach(link => link.classList.remove('active'));
            e.target.classList.add('active');

            contentSections.forEach(content => {
                content.style.display = content.id === `${section}-section` ? 'block' : 'none';
            });

            loadSectionContent(section);
        });
    });

    // Cargar contenido del dashboard por defecto al cargar la página
    loadSectionContent('dashboard');
    document.querySelector('[data-section="dashboard"]').classList.add('active');

    function loadSectionContent(section) {
        switch (section) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'procesos':
                fetchProcesses();
                break;
            case 'reclamaciones':
                fetchClaims();
                break;
        }
    }

    async function loadDashboard() {
        try {
            // 1. Obtener todos los datos necesarios en paralelo
            const [clientsResponse, processesResponse, claimsResponse] = await Promise.all([
                fetch(`${BASE_URL}/clientes`, { headers: getAuthHeaders() }),
                fetch(`${BASE_URL}/procesos`, { headers: getAuthHeaders() }),
                fetch(`${BASE_URL}/reclamaciones`, { headers: getAuthHeaders() })
            ]);

            const [clients, processes, claims] = await Promise.all([
                clientsResponse.json(),
                processesResponse.json(),
                claimsResponse.json()
            ]);

            // 2. Renderizar cada componente del dashboard con los datos obtenidos
            renderKpiCards(processes, claims);
            renderDetailedProcessStatus(processes);
            renderActivityHistory(processes, claims);
            setupActionButtons();

        } catch (error) {
            console.error('Error al cargar el dashboard del cliente:', error);
            const dashboardSection = document.getElementById('dashboard-section');
            dashboardSection.innerHTML = '<p>Hubo un error al cargar tu información. Por favor, intenta más tarde.</p>';
        }
    }

    function renderKpiCards(processes, claims) {
        const container = document.getElementById('kpi-card-container');
        container.innerHTML = ''; // Limpiar contenedor

        const activeProcesses = processes.filter(p => p.estado_proceso === 'En Proceso').length;
        const completedProcesses = processes.filter(p => p.estado_proceso === 'Completado').length;
        const openClaims = claims.filter(c => c.estado === 'Abierto').length;

        let nextDueDate = 'N/A';
        const activeProcess = processes.find(p => p.estado_proceso === 'En Proceso');
        if (activeProcess) {
            const nextStage = activeProcess.etapas.find(e => e.estado === 'Pendiente');
            if (nextStage && nextStage.fecha_estimada) {
                nextDueDate = new Date(nextStage.fecha_estimada).toLocaleDateString('es-ES');
            }
        }

        const kpis = [
            { label: 'Procesos Activos', value: activeProcesses, icon: 'â±›' },
            { label: 'Procesos Completados', value: completedProcesses, icon: 'âœ…' },
            { label: 'Reclamaciones Abiertas', value: openClaims, icon: 'ðŸ“¢' },
            { label: 'Próxima Fecha Clave', value: nextDueDate, icon: 'ðŸ—“' }
        ];

        kpis.forEach(kpi => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${kpi.label}</h3>
                <p>${kpi.value}</p>
            `;
            container.appendChild(card);
        });
    }

    function renderDetailedProcessStatus(processes) {
        const container = document.getElementById('detailed-process-status');
        const activeProcess = processes.find(p => p.estado_proceso === 'En Proceso');

        if (!activeProcess) {
            container.innerHTML = '<h3>No tienes procesos activos en este momento.</h3>';
            return;
        }

        const completedStages = activeProcess.etapas.filter(e => e.estado === 'Completada').length;
        const totalStages = activeProcess.etapas.length;
        const progressPercentage = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;

        const currentStage = activeProcess.etapas.find(e => e.estado === 'En Proceso') || activeProcess.etapas.find(e => e.estado === 'Pendiente');
        const lastObservation = currentStage ? currentStage.observaciones : 'Sin observaciones recientes.';

        container.innerHTML = `
            <h3>Estado de tu Proceso Principal (#${activeProcess.id})</h3>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progressPercentage}%;">${Math.round(progressPercentage)}%</div>
            </div>
            <div class="status-details">
                <p><strong>Etapa Actual:</strong> ${currentStage ? currentStage.nombre : 'Inicio del proceso'}</p>
                <p><strong>Última Actualización:</strong> ${lastObservation || 'Sin observaciones recientes.'}</p>
            </div>
        `;
    }

    function renderActivityHistory(processes, claims) {
        const list = document.getElementById('activity-history-list');
        list.innerHTML = '';

        let history = [];

        // Añadir eventos de procesos
        processes.forEach(p => {
            p.etapas.forEach(e => {
                if (e.estado === 'Completada' && e.fecha_real) {
                    history.push({ date: new Date(e.fecha_real), text: `Etapa '${e.nombre}' completada.` });
                }
            });
        });

        // Añadir eventos de reclamos
        claims.forEach(c => {
            if (c.respuesta) {
                history.push({ date: new Date(c.fecha_creacion), text: `Tu reclamo '${c.asunto}' fue respondido.` });
            }
        });

        // Ordenar y mostrar los últimos 3
        history.sort((a, b) => b.date - a.date);
        const recentHistory = history.slice(0, 3);

        if (recentHistory.length === 0) {
            list.innerHTML = '<li>No hay actividad reciente.</li>';
            return;
        }

        recentHistory.forEach(item => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span class="date">${item.date.toLocaleDateString('es-ES')}</span> ${item.text}`;
            list.appendChild(listItem);
        });
    }

    function setupActionButtons() {
        const container = document.getElementById('action-buttons');
        container.innerHTML = `
            <button id="view-processes-btn" class="btn">Ver Mis Procesos</button>
            <button id="create-claim-action-btn" class="btn btn-secondary">Hacer un Reclamo</button>
        `;

        document.getElementById('view-processes-btn').addEventListener('click', () => {
            document.querySelector('[data-section="procesos"]').click();
        });

        document.getElementById('create-claim-action-btn').addEventListener('click', () => {
            createClaimBtn.click();
        });
    }

    // --- Funciones para Procesos ---
    async function fetchProcesses() {
        try {
            const clientsResponse = await fetch(`${BASE_URL}/clientes`, { headers: getAuthHeaders() });
            if (!clientsResponse.ok) {
                const errorData = await clientsResponse.json();
                throw new Error(`Error al obtener clientes: ${errorData.message || clientsResponse.statusText}`);
            }
            const allClients = await clientsResponse.json();
            const client = allClients.find(c => c.nombre === loggedInUser.user.username);

            if (!client) {
                processesContainer.innerHTML = '<p>No se encontró un cliente asociado a este usuario.</p>';
                return;
            }

            const response = await fetch(`${BASE_URL}/procesos?cliente_id=${client.id}`, { headers: getAuthHeaders() });
            const processes = await response.json();
            renderProcesses(processes);
        } catch (error) {
            console.error('Error al obtener procesos:', error);
            processesContainer.innerHTML = '<p>Error al cargar los procesos.</p>';
        }
    }

    function renderProcesses(processes) {
        if (processes.length === 0) {
            processesContainer.innerHTML = '<p>No tienes procesos activos.</p>';
            return;
        }

        processesContainer.innerHTML = '';
        processes.forEach(process => {
            const processCard = document.createElement('div');
            processCard.className = 'process-card';
            processCard.innerHTML = `
                <h3>Proceso #${process.id}</h3>
                <div class="timeline">
                    ${renderStages(process.etapas)}
                </div>
            `;
            processesContainer.appendChild(processCard);
        });
    }

    function renderStages(stages) {
        return stages.map(stage => `
            <div class="timeline-item" data-status="${stage.estado.toLowerCase()}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <h4>${stage.nombre}</h4>
                    <p>Estado: ${stage.estado}</p>
                    <p>Inicio: ${stage.fecha_inicio || 'N/A'}</p>
                    <p>Fin: ${stage.fecha_real || 'N/A'}</p>
                    <p>Observaciones: ${stage.observaciones || 'N/A'}</p>
                </div>
            </div>
        `).join('');
    }

    // --- Funciones para Reclamos ---
    async function fetchClaims() {
        try {
            console.log('Fetching clients for claims...');
            const clientsResponse = await fetch(`${BASE_URL}/clientes`, { headers: getAuthHeaders() });
            const allClients = await clientsResponse.json();
            console.log('All clients from API (fetchClaims):', allClients);
            const client = allClients.find(c => c.nombre === loggedInUser.user.username);
            console.log('Found client (fetchClaims):', client);

            if (!client) {
                claimsContainer.innerHTML = '<p>No se encontró un cliente asociado a este usuario para reclamos.</p>';
                return;
            }

            console.log(`Fetching claims for client ID: ${client.id}`);
            const response = await fetch(`${BASE_URL}/reclamaciones?cliente_id=${client.id}`, { headers: getAuthHeaders() });
            const claims = await response.json();
            console.log('Claims received from API:', claims);
            renderClaims(claims);
        } catch (error) {
            console.error('Error al obtener reclamos:', error);
            claimsContainer.innerHTML = '<p>Error al cargar los reclamos.</p>';
        }
    }

    function renderClaims(claims) {
        if (claims.length === 0) {
            claimsContainer.innerHTML = '<p>No tienes reclamos.</p>';
            return;
        }

        claimsContainer.innerHTML = '';
        claims.forEach(claim => {
            const claimDiv = document.createElement('div');
            claimDiv.className = 'claim-item';

            let responseHtml = '';
            if (claim.respuesta) {
                responseHtml = `
                    <div class="claim-response">
                        <p><strong>Respuesta del Administrador:</strong></p>
                        <p>${claim.respuesta}</p>
                    </div>
                `;
            }

            claimDiv.innerHTML = `
                <div class="claim-header">
                    <h4>${claim.asunto}</h4>
                    <span class="claim-status ${claim.estado.toLowerCase()}">${claim.estado}</span>
                </div>
                <div class="claim-body">
                    <p>${claim.observaciones || ''}</p>
                    ${responseHtml}
                `;
            claimsContainer.appendChild(claimDiv);
        });
    }

    // --- Lógica del Modal de Reclamos ---
    createClaimBtn.addEventListener('click', () => {
        claimModal.style.display = 'block';
    });

    claimsContainer.addEventListener('click', (e) => {
        const header = e.target.closest('.claim-header');
        if (header) {
            const item = header.closest('.claim-item');
            item.classList.toggle('open');
        }
    });

    closeModalBtn.addEventListener('click', () => {
        claimModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === claimModal) {
            claimModal.style.display = 'none';
        }
    });

    claimForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('claim-subject').value;
        const description = document.getElementById('claim-description').value;
        
        const clientsResponse = await fetch(`${BASE_URL}/clientes`, { headers: getAuthHeaders() });
        const allClients = await clientsResponse.json();
        const client = allClients.find(c => c.nombre === loggedInUser.user.username);

        if (!client) {
            console.error('No se pudo encontrar tu ID de cliente.');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/reclamaciones`, {
                method: 'POST',
                headers: getAuthHeaders(), // Usamos el helper para el encabezado
                body: JSON.stringify({ 
                    cliente_id: client.id,
                    asunto: subject, 
                    motivo: subject, // Usamos el mismo valor para asunto y motivo
                    observaciones: description 
                }),
            });

            if (response.ok) {
                claimModal.style.display = 'none';
                claimForm.reset();
                fetchClaims(); // Recargar la lista de reclamos
                
            } else {
                const errorData = await response.json();
                console.error(errorData.message || 'Error al crear el reclamo.');
            }
        } catch (error) {
            console.error('Error de conexión al crear el reclamo.');
        }
    });

    // Lógica de cerrar sesión
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('user'); // Eliminar el token y datos del usuario
        window.location.href = 'index.html';
    });
});