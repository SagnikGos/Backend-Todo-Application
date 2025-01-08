const express = require('express');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const filePath = path.join(__dirname, "todo.json");

// Middleware to parse JSON bodies
app.use(express.json());

// Validation middleware
const validateTodo = (req, res, next) => {
    const { todo } = req.body;
    
    if (!req.body || !todo) {
        return res.status(400).json({ 
            error: 'Request body must contain a todo property' 
        });
    }

    if (typeof todo !== 'string' || todo.trim().length === 0) {
        return res.status(400).json({ 
            error: 'Todo must be a non-empty string' 
        });
    }
    
    req.body.todo = todo.trim();
    next();
};

// File operations
async function initializeFile() {
    try {
        try {
            await fs.access(filePath);
            // Check if file is empty or malformed
            const data = await fs.readFile(filePath, 'utf8');
            try {
                JSON.parse(data);
            } catch (parseError) {
                // If JSON is malformed, reset the file
                await fs.writeFile(filePath, JSON.stringify([], null, 2));
                console.log('Reset malformed todo.json file');
            }
        } catch (error) {
            // File doesn't exist, create it
            await fs.writeFile(filePath, JSON.stringify([], null, 2));
            console.log('Created new todo.json file');
        }
    } catch (error) {
        console.error('Error initializing file:', error);
        throw error;
    }
}

async function readTodos() {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If there's any error, reinitialize the file
        await initializeFile();
        return [];
    }
}

async function writeTodos(todos) {
    await fs.writeFile(filePath, JSON.stringify(todos, null, 2));
}

// Routes
app.get('/todo', async (req, res) => {
    try {
        const todos = await readTodos();
        res.json(todos);
    } catch (error) {
        console.error('Error reading todos:', error);
        res.status(500).json({ error: 'Failed to retrieve todos' });
    }
});

app.post('/todo', validateTodo, async (req, res) => {
    try {
        const { todo } = req.body;

        const newTodo = {
            id: uuidv4(),
            todo,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        const todos = await readTodos();
        todos.push(newTodo);
        await writeTodos(todos);
        
        res.status(201).json(newTodo);
    } catch (error) {
        console.error('Error adding todo:', error);
        res.status(500).json({ error: 'Failed to add todo' });
    }
});

app.put('/todo/:id', validateTodo, async (req, res) => {
    try {
        const { id } = req.params;
        const { todo, status } = req.body;

        const todos = await readTodos();
        const todoIndex = todos.findIndex(t => t.id === id);
        
        if (todoIndex === -1) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        todos[todoIndex] = {
            ...todos[todoIndex],
            todo: todo || todos[todoIndex].todo,
            status: status || todos[todoIndex].status,
            updatedAt: new Date().toISOString()
        };

        await writeTodos(todos);
        res.json(todos[todoIndex]);
    } catch (error) {
        console.error('Error updating todo:', error);
        res.status(500).json({ error: 'Failed to update todo' });
    }
});

app.delete('/todo/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const todos = await readTodos();
        
        const todoIndex = todos.findIndex(t => t.id === id);
        if (todoIndex === -1) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        todos.splice(todoIndex, 1);
        await writeTodos(todos);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting todo:', error);
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

// Initialize the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    try {
        await initializeFile();
        console.log(`Server running on http://localhost:${PORT}`);
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
});