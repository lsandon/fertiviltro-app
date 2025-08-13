const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

const app = express();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const clientsFilePath = path.join(dataDir, 'clients.json');
const processesFilePath = path.join(dataDir, 'processes.json');
const reclamacionesFilePath = path.join(dataDir, 'reclamaciones.json');
const usersFilePath = path.join(dataDir, 'users.json');
const donadorasFilePath = path.join(dataDir, 'donadoras.json'); // New donadoras file
const receptorasFilePath = path.join(dataDir, 'receptoras.json'); // New receptoras file

// Helper functions for reading and writing JSON files
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Archivo no encontrado: ${filePath}. Devolviendo array vacío.`);
            return [];
        }
        console.error(`Error al leer el archivo ${filePath}:`, error);
        throw error;
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error al escribir en el archivo ${filePath}:`, error);
        throw error;
    }
}

// Helper function to calculate overall process status
function calculateProcessStatus(etapas) {
    if (etapas.some(e => e.estado === 'En Proceso')) {
        return 'En Proceso';
    }
    if (etapas.every(e => e.estado === 'Completada')) {
        return 'Completado';
    }
    if (etapas.some(e => e.estado === 'Cancelada')) {
        return 'Cancelado';
    }
    return 'Pendiente';
}

// Helper function to calculate overall client status
async function calculateClientStatus(clientId) {
    const allProcesses = await readJsonFile(processesFilePath);
    const clientProcesses = allProcesses.filter(p => p.cliente_id === clientId);

    if (clientProcesses.length === 0) {
        return 'Nuevo'; // Or 'Pendiente' if you prefer for clients with no processes yet
    }

    if (clientProcesses.some(p => calculateProcessStatus(p.etapas) === 'En Proceso')) {
        return 'En Proceso';
    }
    if (clientProcesses.every(p => calculateProcessStatus(p.etapas) === 'Completado')) {
        return 'Completado';
    }
    if (clientProcesses.some(p => calculateProcessStatus(p.etapas) === 'Cancelada')) {
        return 'Cancelado';
    }
    return 'Pendiente';
}

// Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));

// Sirve archivos estáticos desde el directorio raíz del proyecto
app.use(express.static(path.join(__dirname, '..')));

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ message: 'Access Denied: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.name, '-', err.message);
            return res.status(403).json({ message: 'Access Denied: Invalid token' });
        }
        req.user = user; // Attach user payload to the request
        next();
    });
};

// Middleware to verify admin role
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
    }
    next();
};

// --- User Authentication and Management ---

// Root route
app.get('/', (req, res) => {
    res.send('Backend de Fertilvitro funcionando con JSON!');
});

// --- User Authentication and Management ---

// POST /api/login - Authenticate user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await readJsonFile(usersFilePath);
        const user = users.find(u => u.username === username);

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign(
                { username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '1h' } // Token expira en 1 hora
            );
            res.json({ message: 'Login successful', user: { username: user.username, role: user.role }, token });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during login');
    }
});

// POST /api/register-user - Register a new user (for company use)
app.post('/api/register-user', authenticateToken, verifyAdmin, async (req, res) => {
    const { username, password, role } = req.body; // role could be 'admin', 'client', etc.
    try {
        const users = await readJsonFile(usersFilePath);
        if (users.some(u => u.username === username)) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10); // Hash password with salt rounds
        const newUser = { username, password: hashedPassword, role: role || 'client' };
        users.push(newUser);
        await writeJsonFile(usersFilePath, users);
        res.status(201).json({ message: 'User registered successfully', user: { username: newUser.username, role: newUser.role } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during user registration');
    }
});

// DELETE /api/users/:username - Delete a user (admin only)
app.delete('/api/users/:username', authenticateToken, verifyAdmin, async (req, res) => {
    const { username } = req.params;
    try {
        let users = await readJsonFile(usersFilePath);
        const initialLength = users.length;
        users = users.filter(u => u.username !== username);

        if (users.length === initialLength) {
            return res.status(404).json({ message: 'User not found' });
        }
        await writeJsonFile(usersFilePath, users);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error during user deletion');
    }
});

// --- Rutas para Clientes ---

// GET all users (admin only)
app.get('/api/users', authenticateToken, verifyAdmin, async (req, res) => {
    try {
        const users = await readJsonFile(usersFilePath);
        // We don't want to send back the passwords, even hashed
        const usersWithoutPasswords = users.map(u => ({
            username: u.username,
            role: u.role
        }));
        res.json(usersWithoutPasswords);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error while getting users');
    }
});

// GET all clients (or single client for client role)
app.get('/api/clientes', authenticateToken, async (req, res) => {
    try {
        const clients = await readJsonFile(clientsFilePath);
        if (req.user.role === 'admin') {
            return res.json(clients.sort((a, b) => b.id - a.id));
        } else if (req.user.role === 'client') {
            const client = clients.find(c => c.nombre === req.user.username); // Assuming client name matches username
            if (client) {
                return res.json([client]); // Return as an array for consistency
            } else {
                return res.status(404).json({ message: 'Client not found for this user' });
            }
        }
        res.status(403).json({ message: 'Forbidden: Invalid role' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener clientes');
    }
});

// GET a single client by ID
app.get('/api/clientes/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const clients = await readJsonFile(clientsFilePath);
        const client = clients.find(c => c.id === id);
        if (!client) {
            return res.status(404).json({ msg: 'Cliente no encontrado' });
        }
        res.json(client);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener cliente por ID');
    }
});

// POST create a new client
app.post('/api/clientes', authenticateToken, verifyAdmin, async (req, res) => {
    const { 
        nombre, 
        email, 
        telefono, 
        region, 
        municipio, 
        finca, 
        tipo_cliente, 
        embriones_deseados, 
        receptoras_disponibles, 
        observaciones 
    } = req.body;

    // Simple validation
    if (!nombre || !email || !telefono || !region || !municipio) {
        return res.status(400).json({ message: 'Por favor, complete todos los campos obligatorios.' });
    }

    try {
        const clients = await readJsonFile(clientsFilePath);
        const newId = clients.length > 0 ? Math.max(...clients.map(c => c.id)) + 1 : 1;
        const newClient = {
            id: newId,
            nombre,
            email,
            telefono,
            region,
            municipio,
            finca: finca || '',
            tipo_cliente: tipo_cliente || 'Individual',
            embriones_deseados: embriones_deseados || 0,
            receptoras_disponibles: receptoras_disponibles || 0,
            observaciones: observaciones || '',
            estado_proceso: 'Nuevo'
        };
        clients.push(newClient);
        await writeJsonFile(clientsFilePath, clients);
        res.status(201).json(newClient);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al crear cliente');
    }
});

// PUT update a client
app.put('/api/clientes/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { 
        nombre, 
        email, 
        telefono, 
        region, 
        municipio, 
        finca, 
        tipo_cliente, 
        embriones_deseados, 
        receptoras_disponibles, 
        observaciones
    } = req.body;
    try {
        let clients = await readJsonFile(clientsFilePath);
        const clientIndex = clients.findIndex(c => c.id === id);
        if (clientIndex === -1) {
            return res.status(404).json({ msg: 'Cliente no encontrado' });
        }
        const updatedClient = {
            ...clients[clientIndex],
            nombre: nombre !== undefined ? nombre : clients[clientIndex].nombre,
            email: email !== undefined ? email : clients[clientIndex].email,
            telefono: telefono !== undefined ? telefono : clients[clientIndex].telefono,
            region: region !== undefined ? region : clients[clientIndex].region,
            municipio: municipio !== undefined ? municipio : clients[clientIndex].municipio,
            finca: finca !== undefined ? finca : clients[clientIndex].finca,
            tipo_cliente: tipo_cliente !== undefined ? tipo_cliente : clients[clientIndex].tipo_cliente,
            embriones_deseados: embriones_deseados !== undefined ? embriones_deseados : clients[clientIndex].embriones_deseados,
            receptoras_disponibles: receptoras_disponibles !== undefined ? receptoras_disponibles : clients[clientIndex].receptoras_disponibles,
            observaciones: observaciones !== undefined ? observaciones : clients[clientIndex].observaciones
        };
        clients[clientIndex] = updatedClient;
        await writeJsonFile(clientsFilePath, clients);
        res.json(updatedClient);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al actualizar cliente');
    }
});

// DELETE a client
app.delete('/api/clientes/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        let clients = await readJsonFile(clientsFilePath);
        const initialLength = clients.length;
        clients = clients.filter(c => c.id !== id);
        if (clients.length === initialLength) {
            return res.status(404).json({ msg: 'Cliente no encontrado' });
        }
        await writeJsonFile(clientsFilePath, clients);

        // Also delete associated processes and reclamaciones
        let processes = await readJsonFile(processesFilePath);
        processes = processes.filter(p => p.cliente_id !== id);
        await writeJsonFile(processesFilePath, processes);

        let reclamaciones = await readJsonFile(reclamacionesFilePath);
        reclamaciones = reclamaciones.filter(r => r.cliente_id !== id);
        await writeJsonFile(reclamacionesFilePath, reclamaciones);

        res.json({ msg: 'Cliente eliminado' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al eliminar cliente');
    }
});

// --- Rutas para Donadoras ---

// GET all donadoras (admin only, or by client_id for client role)
app.get('/api/donadoras', authenticateToken, async (req, res) => {
    try {
        const allDonadoras = await readJsonFile(donadorasFilePath);
        const clients = await readJsonFile(clientsFilePath);
        let donadorasToReturn = [];

        const filterClientId = req.query.cliente_id ? parseInt(req.query.cliente_id) : null;

        if (req.user.role === 'admin') {
            donadorasToReturn = allDonadoras;
        } else if (req.user.role === 'client') {
            const client = clients.find(c => c.nombre === req.user.username);
            if (client) {
                donadorasToReturn = allDonadoras.filter(d => d.cliente_id === client.id);
            } else {
                return res.status(404).json({ message: 'Client not found for this user' });
            }
        }

        const donadorasWithClientNames = donadorasToReturn.map(d => {
            const client = clients.find(c => c.id === d.cliente_id);
            return {
                ...d,
                cliente_nombre: client ? client.nombre : 'Desconocido'
            };
        }).sort((a, b) => b.id - a.id);
        res.json(donadorasWithClientNames);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener donadoras');
    }
});

// GET a single donadora by ID
app.get('/api/donadoras/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const donadoras = await readJsonFile(donadorasFilePath);
        const donadora = donadoras.find(d => d.id === id);
        if (!donadora) {
            return res.status(404).json({ msg: 'Donadora no encontrada' });
        }
        res.json(donadora);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener donadora por ID');
    }
});

// POST create a new donadora
app.post('/api/donadoras', authenticateToken, verifyAdmin, async (req, res) => {
    const { cliente_id, codigo, raza, edad, historial } = req.body;

    if (!cliente_id || !codigo || !raza || !edad) {
        return res.status(400).json({ message: 'Por favor, complete todos los campos obligatorios para la donadora.' });
    }

    try {
        const donadoras = await readJsonFile(donadorasFilePath);
        const newId = donadoras.length > 0 ? Math.max(...donadoras.map(d => d.id)) + 1 : 1;
        const newDonadora = {
            id: newId,
            cliente_id: parseInt(cliente_id),
            codigo,
            raza,
            edad: parseInt(edad),
            historial: historial || ''
        };
        donadoras.push(newDonadora);
        await writeJsonFile(donadorasFilePath, donadoras);
        res.status(201).json(newDonadora);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al crear donadora');
    }
});

// PUT update a donadora
app.put('/api/donadoras/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { cliente_id, codigo, raza, edad, historial } = req.body;
    try {
        let donadoras = await readJsonFile(donadorasFilePath);
        const donadoraIndex = donadoras.findIndex(d => d.id === id);
        if (donadoraIndex === -1) {
            return res.status(404).json({ msg: 'Donadora no encontrada' });
        }
        const updatedDonadora = {
            ...donadoras[donadoraIndex],
            cliente_id: cliente_id !== undefined ? parseInt(cliente_id) : donadoras[donadoraIndex].cliente_id,
            codigo: codigo || donadoras[donadoraIndex].codigo,
            raza: raza || donadoras[donadoraIndex].raza,
            edad: edad !== undefined ? parseInt(edad) : donadoras[donadoraIndex].edad,
            historial: historial || donadoras[donadoraIndex].historial
        };
        donadoras[donadoraIndex] = updatedDonadora;
        await writeJsonFile(donadorasFilePath, donadoras);
        res.json(updatedDonadora);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al actualizar donadora');
    }
});





// --- Rutas para Receptoras ---

// GET all receptoras (admin only, or by client_id for client role)
app.get('/api/receptoras', authenticateToken, async (req, res) => {
    try {
        const allReceptoras = await readJsonFile(receptorasFilePath);
        const clients = await readJsonFile(clientsFilePath);
        let receptorasToReturn = [];

        const filterClientId = req.query.cliente_id ? parseInt(req.query.cliente_id) : null;

        if (req.user.role === 'admin') {
            receptorasToReturn = allReceptoras;
        } else if (req.user.role === 'client') {
            const client = clients.find(c => c.nombre === req.user.username);
            if (client) {
                receptorasToReturn = allReceptoras.filter(r => r.cliente_id === client.id);
            } else {
                return res.status(404).json({ message: 'Client not found for this user' });
            }
        }

        const receptorasWithClientNames = receptorasToReturn.map(r => {
            const client = clients.find(c => c.id === r.cliente_id);
            return {
                ...r,
                cliente_nombre: client ? client.nombre : 'Desconocido'
            };
        }).sort((a, b) => b.id - a.id);
        res.json(receptorasWithClientNames);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener receptoras');
    }
});

// GET a single receptora by ID
app.get('/api/receptoras/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const receptoras = await readJsonFile(receptorasFilePath);
        const receptora = receptoras.find(r => r.id === id);
        if (!receptora) {
            return res.status(404).json({ msg: 'Receptora no encontrada' });
        }
        res.json(receptora);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener receptora por ID');
    }
});

// POST create a new receptora
app.post('/api/receptoras', authenticateToken, verifyAdmin, async (req, res) => {
    const { cliente_id, codigo, observaciones } = req.body;

    if (!cliente_id || !codigo) {
        return res.status(400).json({ message: 'Por favor, complete todos los campos obligatorios para la receptora.' });
    }

    try {
        const receptoras = await readJsonFile(receptorasFilePath);
        const newId = receptoras.length > 0 ? Math.max(...receptoras.map(r => r.id)) + 1 : 1;
        const newReceptora = {
            id: newId,
            cliente_id: parseInt(cliente_id),
            codigo,
            observaciones: observaciones || ''
        };
        receptoras.push(newReceptora);
        await writeJsonFile(receptorasFilePath, receptoras);
        res.status(201).json(newReceptora);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al crear receptora');
    }
});

// PUT update a receptora
app.put('/api/receptoras/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { cliente_id, codigo, observaciones } = req.body;
    try {
        let receptoras = await readJsonFile(receptorasFilePath);
        const receptoraIndex = receptoras.findIndex(r => r.id === id);
        if (receptoraIndex === -1) {
            return res.status(404).json({ msg: 'Receptora no encontrada' });
        }
        const updatedReceptora = {
            ...receptoras[receptoraIndex],
            cliente_id: cliente_id !== undefined ? parseInt(cliente_id) : receptoras[receptoraIndex].cliente_id,
            codigo: codigo || receptoras[receptoraIndex].codigo,
            observaciones: observaciones || receptoras[receptoraIndex].observaciones
        };
        receptoras[receptoraIndex] = updatedReceptora;
        await writeJsonFile(receptorasFilePath, receptoras);
        res.json(updatedReceptora);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al actualizar receptora');
    }
});

// DELETE a receptora
app.delete('/api/receptoras/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        let receptoras = await readJsonFile(receptorasFilePath);
        const initialLength = receptoras.length;
        receptoras = receptoras.filter(r => r.id !== id);
        if (receptoras.length === initialLength) {
            return res.status(404).json({ msg: 'Receptora no encontrada' });
        }
        await writeJsonFile(receptorasFilePath, receptoras);
        res.json({ msg: 'Receptora eliminada' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al eliminar receptora');
    }
});

// GET all processes (with their stages) (or client's processes for client role)
app.get('/api/procesos', authenticateToken, async (req, res) => {
    try {
        const allProcesses = await readJsonFile(processesFilePath);
        const clients = await readJsonFile(clientsFilePath);
        let processesToReturn = [];

        const filterClientId = req.query.cliente_id ? parseInt(req.query.cliente_id) : null;

        if (filterClientId) {
            // If a specific client_id is requested, filter by it
            processesToReturn = allProcesses.filter(p => p.cliente_id === filterClientId);
        } else if (req.user.role === 'admin') {
            // If no specific client_id and user is admin, return all processes
            processesToReturn = allProcesses;
        } else if (req.user.role === 'client') {
            // If no specific client_id and user is client, return only their processes
            const client = clients.find(c => c.nombre === req.user.username);
            if (client) {
                processesToReturn = allProcesses.filter(p => p.cliente_id === client.id);
            } else {
                return res.status(404).json({ message: 'Client not found for this user' });
            }
        } else {
            return res.status(403).json({ message: 'Forbidden: Invalid role or missing client ID' });
        }

        const processesWithClientNames = processesToReturn.map(p => {
            const client = clients.find(c => c.id === p.cliente_id);
            return {
                ...p,
                cliente_nombre: client ? client.nombre : 'Desconocido'
            };
        }).sort((a, b) => b.id - a.id); // Sort by ID descending
        res.json(processesWithClientNames);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener procesos');
    }
});

// GET a single process by ID (with its stages)
app.get('/api/procesos/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const processes = await readJsonFile(processesFilePath);
        const clients = await readJsonFile(clientsFilePath);
        const process = processes.find(p => p.id === id);
        if (!process) {
            return res.status(404).json({ msg: 'Proceso no encontrado' });
        }
        const client = clients.find(c => c.id === process.cliente_id);
        res.json({
            ...process,
            cliente_nombre: client ? client.nombre : 'Desconocido'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener proceso por ID');
    }
});

// POST create a new process (and its initial stages)
app.post('/api/procesos', authenticateToken, verifyAdmin, async (req, res) => {
    const { cliente_id } = req.body;
    try {
        const processes = await readJsonFile(processesFilePath);
        const newId = processes.length > 0 ? Math.max(...processes.map(p => p.id)) + 1 : 1;

        const initialEtapas = [
            { id: 1, nombre: 'Sincronización hormonal', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 2, nombre: 'Aspiración de ovocitos', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 3, nombre: 'Transporte al laboratorio', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 4, nombre: 'Maduración de ovocitos', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 5, nombre: 'Fertilización in vitro', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 6, nombre: 'Cultivo e incubación', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 7, nombre: 'Evaluación de embriones', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 8, nombre: 'Preparación de transporte', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 9, nombre: 'Transporte de embriones', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 10, nombre: 'Transferencia a receptoras', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 11, nombre: 'Ecografía día 45', estado: 'Pendiente', fecha_estimada: '', fecha_real: '', observaciones: '' },
            { id: 12, nombre: 'Ecografía día 90', estado: 'Pendiente', fecha_real: '', observaciones: '' },
        ];

        const newProcess = {
            id: newId,
            cliente_id: cliente_id,
            etapas: initialEtapas,
            estado_global_manual: 'Pendiente' // Nuevo campo
        };
        processes.push(newProcess);
        await writeJsonFile(processesFilePath, processes);
        res.status(201).json(newProcess);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al crear proceso');
    }
});

// PUT update a process (only if there are updatable fields in the processes table)
app.put('/api/procesos/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { cliente_id, estado_global_manual } = req.body; // Añadir estado_global_manual
    try {
        let processes = await readJsonFile(processesFilePath);
        const processIndex = processes.findIndex(p => p.id === id);
        if (processIndex === -1) {
            return res.status(404).json({ msg: 'Proceso no encontrado' });
        }
        const updatedProcess = {
            ...processes[processIndex],
            cliente_id: cliente_id || processes[processIndex].cliente_id,
            estado_global_manual: estado_global_manual || processes[processIndex].estado_global_manual // Actualizar el campo
        };
        processes[processIndex] = updatedProcess;
        await writeJsonFile(processesFilePath, processes);
        res.json(updatedProcess);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al actualizar proceso');
    }
});

// PUT update a specific stage of a process
app.put('/api/procesos/:procesoId/etapas/:etapaId', authenticateToken, verifyAdmin, async (req, res) => {
    const procesoId = parseInt(req.params.procesoId);
    const etapaId = parseInt(req.params.etapaId);
    const { nombre, estado, fecha_estimada, fecha_real, observaciones } = req.body;
    try {
        let processes = await readJsonFile(processesFilePath);
        const processIndex = processes.findIndex(p => p.id === procesoId);
        if (processIndex === -1) {
            return res.status(404).json({ msg: 'Proceso no encontrado' });
        }
        const process = processes[processIndex];
        const etapaIndex = process.etapas.findIndex(e => e.id === etapaId);
        if (etapaIndex === -1) {
            return res.status(404).json({ msg: 'Etapa no encontrada en el proceso' });
        }
        const updatedEtapa = {
            ...process.etapas[etapaIndex],
            nombre: nombre || process.etapas[etapaIndex].nombre,
            estado: estado || process.etapas[etapaIndex].estado,
            fecha_estimada: fecha_estimada || process.etapas[etapaIndex].fecha_estimada,
            fecha_real: fecha_real || process.etapas[etapaIndex].fecha_real,
            observaciones: observaciones || process.etapas[etapaIndex].observaciones
        };

        // Auto-set fecha_inicio if status changes to 'En Proceso' and it's not set
        if (updatedEtapa.estado === 'En Proceso' && !process.etapas[etapaIndex].fecha_inicio) {
            updatedEtapa.fecha_inicio = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        }

        // Auto-set fecha_real if status changes to 'Completada' and it's not set
        if (updatedEtapa.estado === 'Completada' && !process.etapas[etapaIndex].fecha_real) {
            updatedEtapa.fecha_real = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        }
        process.etapas[etapaIndex] = updatedEtapa;

        // Update overall process status
        process.estado_proceso = calculateProcessStatus(process.etapas);

        processes[processIndex] = process; // Update the process in the array
        await writeJsonFile(processesFilePath, processes);

        // Update associated client's status
        let clients = await readJsonFile(clientsFilePath);
        const clientIndex = clients.findIndex(c => c.id === process.cliente_id);
        if (clientIndex !== -1) {
            clients[clientIndex].estado_proceso = await calculateClientStatus(process.cliente_id);
            await writeJsonFile(clientsFilePath, clients);
        }

        res.json(updatedEtapa);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al actualizar etapa');
    }
});

// DELETE a process
app.delete('/api/procesos/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        let processes = await readJsonFile(processesFilePath);
        const initialLength = processes.length;
        processes = processes.filter(p => p.id !== id);
        if (processes.length === initialLength) {
            return res.status(404).json({ msg: 'Proceso no encontrado' });
        }
        await writeJsonFile(processesFilePath, processes);
        res.json({ msg: 'Proceso eliminado' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al eliminar proceso');
    }
});

// --- Rutas para Reclamaciones ---

// GET all reclamaciones (or client's reclamaciones for client role)
app.get('/api/reclamaciones', authenticateToken, async (req, res) => {
    try {
        const allReclamaciones = await readJsonFile(reclamacionesFilePath);
        const clients = await readJsonFile(clientsFilePath);
        let reclamacionesToReturn = [];

        if (req.user.role === 'admin') {
            reclamacionesToReturn = allReclamaciones;
        } else if (req.user.role === 'client') {
            const client = clients.find(c => c.nombre === req.user.username);
            if (client) {
                reclamacionesToReturn = allReclamaciones.filter(r => r.cliente_id === client.id);
            } else {
                return res.status(404).json({ message: 'Client not found for this user' });
            }
        }

        const reclamacionesWithClientNames = reclamacionesToReturn.map(r => {
            const client = clients.find(c => c.id === r.cliente_id);
            return {
                ...r,
                cliente_nombre: client ? client.nombre : 'Desconocido',
                respuesta: r.respuesta || '' // Asegurarse de que la respuesta siempre esté presente
            };
        }).sort((a, b) => b.id - a.id); // Sort by ID descending
        res.json(reclamacionesWithClientNames);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener reclamaciones');
    }
});

// GET a single reclamación by ID
app.get('/api/reclamaciones/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const reclamaciones = await readJsonFile(reclamacionesFilePath);
        const clients = await readJsonFile(clientsFilePath);
        const reclamacion = reclamaciones.find(r => r.id === id);
        if (!reclamacion) {
            return res.status(404).json({ msg: 'Reclamación no encontrada' });
        }
        const client = clients.find(c => c.id === reclamacion.cliente_id);
        res.json({
            ...reclamacion,
            cliente_nombre: client ? client.nombre : 'Desconocido'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al obtener reclamación por ID');
    }
});

// POST create a new reclamación
app.post('/api/reclamaciones', authenticateToken, async (req, res) => {
    const { cliente_id, asunto, motivo, estado, responsable, observaciones } = req.body;
    try {
        const reclamaciones = await readJsonFile(reclamacionesFilePath);
        const newId = reclamaciones.length > 0 ? Math.max(...reclamaciones.map(r => r.id)) + 1 : 1;
        const newReclamacion = {
            id: newId,
            cliente_id,
            asunto,
            motivo, // Nuevo campo
            estado: estado || 'Abierto',
            fecha_creacion: new Date().toISOString(), // Add creation date
            responsable,
            observaciones
        };
        reclamaciones.push(newReclamacion);
        await writeJsonFile(reclamacionesFilePath, reclamaciones);
        res.status(201).json(newReclamacion);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al crear reclamación');
    }
});

// PUT update a reclamación
app.put('/api/reclamaciones/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const { cliente_id, asunto, motivo, estado, responsable, observaciones, respuesta } = req.body;
    try {
        let reclamaciones = await readJsonFile(reclamacionesFilePath);
        const reclamacionIndex = reclamaciones.findIndex(r => r.id === id);
        if (reclamacionIndex === -1) {
            return res.status(404).json({ msg: 'Reclamación no encontrada' });
        }
        const updatedReclamacion = {
            ...reclamaciones[reclamacionIndex],
            cliente_id: cliente_id || reclamaciones[reclamacionIndex].cliente_id,
            asunto: asunto || reclamaciones[reclamacionIndex].asunto,
            motivo: motivo || reclamaciones[reclamacionIndex].motivo, // Nuevo campo
            estado: estado || reclamaciones[reclamacionIndex].estado,
            responsable: responsable || reclamaciones[reclamacionIndex].responsable,
            observaciones: observaciones || reclamaciones[reclamacionIndex].observaciones,
            respuesta: respuesta || reclamaciones[reclamacionIndex].respuesta // Asegurarse de guardar la respuesta
        };
        reclamaciones[reclamacionIndex] = updatedReclamacion;
        await writeJsonFile(reclamacionesFilePath, reclamaciones);
        res.json(updatedReclamacion);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al actualizar reclamación');
    }
});

// DELETE a reclamación
app.delete('/api/reclamaciones/:id', authenticateToken, verifyAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        let reclamaciones = await readJsonFile(reclamacionesFilePath);
        const initialLength = reclamaciones.length;
        reclamaciones = reclamaciones.filter(r => r.id !== id);
        if (reclamaciones.length === initialLength) {
            return res.status(404).json({ msg: 'Reclamación no encontrada' });
        }
        await writeJsonFile(reclamacionesFilePath, reclamaciones);
        res.json({ msg: 'Reclamación eliminada' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del servidor al eliminar reclamación');
    }
});

// Function to ensure default admin exists
async function ensureAdminUser() {
    const users = await readJsonFile(usersFilePath);
    const adminUser = users.find(u => u.username === 'admin');
    if (!adminUser) {
        console.log('Admin user not found, creating one...');
        const hashedPassword = await bcrypt.hash('admin', 10); // Default password is 'admin'
        users.push({ username: 'admin', password: hashedPassword, role: 'admin' });
        await writeJsonFile(usersFilePath, users);
        console.log('Admin user created with username: admin, password: admin');
    }
}

// Start the server and setup
app.listen(port, async () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
    await ensureAdminUser();
});