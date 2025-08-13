document.addEventListener('DOMContentLoaded', () => {
    const processInfo = document.getElementById('process-info');
    const stageList = document.getElementById('stage-list');
    const errorMessage = document.getElementById('error-message');

    const editStageModal = document.getElementById('edit-stage-modal');
    const closeStageModalBtn = editStageModal.querySelector('.close-button');
    const editStageForm = document.getElementById('edit-stage-form');
    const editStageProcessId = document.getElementById('edit-stage-process-id');
    const editStageId = document.getElementById('edit-stage-id');
    const editStageName = document.getElementById('edit-stage-name');
    const editStageStatus = document.getElementById('edit-stage-status');
    const editStageEstimatedDate = document.getElementById('edit-stage-estimated-date');
    const editStageRealDate = document.getElementById('edit-stage-real-date');
    const editStageObservations = document.getElementById('edit-stage-observations');

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
    const processId = urlParams.get('id');

    let currentProcess = null; // Para almacenar los detalles del proceso actual

    async function fetchProcessDetails() {
        try {
            const response = await fetch(`${BASE_URL}/procesos/${processId}`, {
                headers: {
                    'Authorization': `Bearer ${loggedInUser.token}`
                }
            });
            if (response.ok) {
                currentProcess = await response.json();
                renderProcessDetails(currentProcess);
                renderStages(currentProcess.etapas);
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al cargar los detalles del proceso.';
            }
        } catch (error) {
            console.error('Error al obtener detalles del proceso:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    }

    function renderProcessDetails(process) {
        processInfo.innerHTML = `
            <p><strong>Cliente:</strong> ${process.cliente_nombre}</p>
            <p><strong>Estado General (Automático):</strong> ${process.estado_proceso}</p>
            <div class="form-group">
                <label for="estado-global-manual">Estado General (Manual)</label>
                <select id="estado-global-manual">
                    <option value="Pendiente">Pendiente</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Completado">Completado</option>
                    <option value="Cancelado">Cancelado</option>
                </select>
                <button id="update-global-status-btn" class="btn btn-sm">Actualizar Estado Manual</button>
            </div>
        `;
        document.getElementById('estado-global-manual').value = process.estado_global_manual || 'Pendiente';

        document.getElementById('update-global-status-btn').addEventListener('click', async () => {
            const newGlobalStatus = document.getElementById('estado-global-manual').value;
            try {
                const response = await fetch(`${BASE_URL}/procesos/${processId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${loggedInUser.token}`
                    },
                    body: JSON.stringify({ estado_global_manual: newGlobalStatus }),
                });
                if (response.ok) {
                    
                    fetchProcessDetails(); // Recargar para reflejar el cambio
                } else {
                    const errorData = await response.json();
                    errorMessage.textContent = errorData.message || 'Error al actualizar el estado global manual.';
                }
            } catch (error) {
                console.error('Error al actualizar estado global manual:', error);
                errorMessage.textContent = 'Error de conexión al actualizar el estado global manual.';
            }
        });

        renderTimeline(process.etapas);
    }

    function renderTimeline(stages) {
        const timelineContainer = document.getElementById('timeline-container');
        timelineContainer.innerHTML = '';

        const statusToCssClass = {
            'Pendiente': 'pending',
            'En Proceso': 'in-progress',
            'Completada': 'completed',
            'Cancelada': 'cancelled'
        };

        stages.forEach(stage => {
            const step = document.createElement('div');
            step.className = 'timeline-step';
            const cssClass = statusToCssClass[stage.estado] || 'pending';
            step.classList.add(cssClass);

            const dot = document.createElement('div');
            dot.className = 'step-dot';

            const label = document.createElement('div');
            label.className = 'step-label';
            label.textContent = stage.nombre;

            step.appendChild(dot);
            step.appendChild(label);
            timelineContainer.appendChild(step);
        });
    }

    function renderStages(stages) {
        stageList.innerHTML = '';
        stages.forEach(stage => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stage.nombre}</td>
                <td>${stage.estado}</td>
                <td>${stage.fecha_estimada || 'N/A'}</td>
                <td>${stage.fecha_real || 'N/A'}</td>
                <td>${stage.observaciones || 'N/A'}</td>
                <td>
                    <button class="btn btn-sm" onclick="editStage(${stage.id})">Editar</button>
                </td>
            `;
            stageList.appendChild(row);
        });
    }

    window.editStage = (stageId) => {
        const stage = currentProcess.etapas.find(s => s.id === stageId);
        if (stage) {
            editStageProcessId.value = currentProcess.id;
            editStageId.value = stage.id;
            editStageName.value = stage.nombre;
            editStageStatus.value = stage.estado;
            editStageEstimatedDate.value = stage.fecha_estimada || '';
            editStageRealDate.value = stage.fecha_real || '';
            editStageObservations.value = stage.observaciones || '';
            editStageModal.style.display = 'block';
        }
    };

    closeStageModalBtn.addEventListener('click', () => {
        editStageModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === editStageModal) {
            editStageModal.style.display = 'none';
        }
    });

    editStageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const processIdToUpdate = editStageProcessId.value;
        const stageIdToUpdate = editStageId.value;
        const newStatus = editStageStatus.value;
        const newEstimatedDate = editStageEstimatedDate.value;
        const newRealDate = editStageRealDate.value;
        const newObservations = editStageObservations.value;

        try {
            const response = await fetch(`${BASE_URL}/procesos/${processIdToUpdate}/etapas/${stageIdToUpdate}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedInUser.token}`
                },
                body: JSON.stringify({
                    estado: newStatus,
                    fecha_estimada: newEstimatedDate,
                    fecha_real: newRealDate,
                    observaciones: newObservations
                }),
            });

            if (response.ok) {
                editStageModal.style.display = 'none';
                fetchProcessDetails(); // Recargar los detalles del proceso
                
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.message || 'Error al actualizar la etapa.';
            }
        } catch (error) {
            console.error('Error al actualizar etapa:', error);
            errorMessage.textContent = 'Error de conexión con el servidor.';
        }
    });

    fetchProcessDetails();
});