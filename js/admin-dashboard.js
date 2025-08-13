document.addEventListener('DOMContentLoaded', async () => {
    const totalClientsKpi = document.getElementById('total-clients-kpi');
    const activeProcessesKpi = document.getElementById('active-processes-kpi');
    const openClaimsKpi = document.getElementById('open-claims-kpi');
    const pendingProcessesKpi = document.getElementById('pending-processes-kpi');
    const inProgressProcessesKpi = document.getElementById('in-progress-processes-kpi');
    const completedProcessesKpi = document.getElementById('completed-processes-kpi');
    const cancelledProcessesKpi = document.getElementById('cancelled-processes-kpi');
    const processStatusChartCtx = document.getElementById('process-status-chart').getContext('2d');
    const errorMessage = document.getElementById('error-message');

    const BASE_URL = 'http://localhost:3000/api';

    const loggedInUser = JSON.parse(localStorage.getItem('user'));

    if (!loggedInUser || !loggedInUser.token || loggedInUser.user.role !== 'admin') {
        window.location.href = '/index.html';
    }

    const getAuthHeaders = () => ({
        'Authorization': `Bearer ${loggedInUser.token}`
    });

    async function fetchDashboardData() {
        try {
            // Obtener Clientes
            const clientsResponse = await fetch(`${BASE_URL}/clientes`, { headers: getAuthHeaders() });
            if (!clientsResponse.ok) throw new Error('Error al obtener clientes');
            const clients = await clientsResponse.json();
            totalClientsKpi.textContent = clients.length;

            // Obtener Procesos
            const processesResponse = await fetch(`${BASE_URL}/procesos`, { headers: getAuthHeaders() });
            if (!processesResponse.ok) throw new Error('Error al obtener procesos');
            const processes = await processesResponse.json();
            
            const activeProcesses = processes.filter(p => p.estado_proceso === 'En Proceso').length;
            activeProcessesKpi.textContent = activeProcesses;

            // Update new process status KPIs
            pendingProcessesKpi.textContent = processes.filter(p => p.estado_proceso === 'Pendiente').length;
            inProgressProcessesKpi.textContent = processes.filter(p => p.estado_proceso === 'En Proceso').length;
            completedProcessesKpi.textContent = processes.filter(p => p.estado_proceso === 'Completado').length;
            cancelledProcessesKpi.textContent = processes.filter(p => p.estado_proceso === 'Cancelado').length;

            // Calcular distribución de estado de procesos para el gráfico
            const statusCounts = {};
            processes.forEach(p => {
                statusCounts[p.estado_proceso] = (statusCounts[p.estado_proceso] || 0) + 1;
            });

            renderProcessStatusChart(statusCounts);

            // Obtener Reclamaciones
            const claimsResponse = await fetch(`${BASE_URL}/reclamaciones`, { headers: getAuthHeaders() });
            if (!claimsResponse.ok) throw new Error('Error al obtener reclamaciones');
            const claims = await claimsResponse.json();
            const openClaims = claims.filter(c => c.estado === 'Abierto' || c.estado === 'En Revisión').length;
            openClaimsKpi.textContent = openClaims;

        } catch (error) {
            console.error('Error al obtener datos del dashboard:', error);
            errorMessage.textContent = `Error al cargar el dashboard: ${error.message}`;
        }
    }

    function renderProcessStatusChart(statusCounts) {
        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);
        const backgroundColors = [
            'rgba(255, 99, 132, 0.7)', // Rojo
            'rgba(54, 162, 235, 0.7)', // Azul
            'rgba(255, 206, 86, 0.7)', // Amarillo
            'rgba(75, 192, 192, 0.7)', // Verde
            'rgba(153, 102, 255, 0.7)', // Morado
            'rgba(255, 159, 64, 0.7)'  // Naranja
        ];

        new Chart(processStatusChartCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // <--- Añadido para que no sobresalga
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false,
                        text: 'Distribución de Estado de Procesos'
                    }
                }
            }
        });
    }

    fetchDashboardData();

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user'); // Clear user data from local storage
            window.location.href = '/index.html'; // Redirect to login page
        });
    }
});