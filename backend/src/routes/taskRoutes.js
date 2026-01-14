const express = require('express');
const Task = require('../models/Task');
const router = express.Router();

// =========================================================
// 1. GET: Fetch all tasks for the authenticated user
//    Endpoint: /api/tasks
// =========================================================
router.get('/', async (req, res) => {
    try {
        // The authenticated user's unique Auth0 ID is available in req.auth.payload.sub
        const auth0Id = req.auth.sub;
        
        // Fetch all tasks belonging to this user
        const tasks = await Task.find({ auth0Id: auth0Id })
            .select('-auth0Id -__v') // Exclude internal MongoDB and Auth0 IDs from response
            .sort({ date: 1, priority: -1 }); // Sort by date ascending, then priority descending

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// =========================================================
// 2. POST: Create a new task
//    Endpoint: /api/tasks
// =========================================================
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const { text, priority, date, type, completed = false } = req.body;

        const newTask = new Task({
            auth0Id,
            text,
            priority: priority || 'medium',
            date,
            type: type || 'task',
            completed
        });

        await newTask.save();
        res.status(201).json({ 
            message: 'Task created successfully', 
            task: { ...newTask.toObject(), auth0Id: undefined, __v: undefined } // Cleaned response
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(400).json({ message: 'Invalid task data or missing fields' });
    }
});

// =========================================================
// 3. PUT: Update an existing task (e.g., mark completed)
//    Endpoint: /api/tasks/:id
// =========================================================
router.put('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const taskId = req.params.id;
        const updateData = req.body;

        const updatedTask = await Task.findOneAndUpdate(
            // CRITICAL: Ensure we only update a document owned by the authenticated user
            { _id: taskId, auth0Id: auth0Id },
            updateData,
            { new: true, runValidators: true } // Return the new document and run schema validation
        ).select('-auth0Id -__v');

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        res.status(200).json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(400).json({ message: 'Invalid update data' });
    }
});

// =========================================================
// 4. DELETE: Delete a task
//    Endpoint: /api/tasks/:id
// =========================================================
router.delete('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const taskId = req.params.id;

        const result = await Task.findOneAndDelete({ 
            _id: taskId, 
            auth0Id: auth0Id 
        });

        if (!result) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


module.exports = router;