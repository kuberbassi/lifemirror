const express = require('express');
const SavingsGoal = require('../models/SavingsGoal');
const router = express.Router();

// GET all goals
router.get('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const goals = await SavingsGoal.find({ auth0Id }).sort({ createdAt: -1 });
        res.status(200).json(goals);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST new goal
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const { name, targetAmount, deadline } = req.body;
        const newGoal = new SavingsGoal({
            auth0Id,
            name,
            targetAmount,
            deadline
        });
        await newGoal.save();
        res.status(201).json(newGoal);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data' });
    }
});

// PUT add funds
router.put('/:id/add', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const { amount } = req.body;
        const goalId = req.params.id;

        const goal = await SavingsGoal.findOne({ _id: goalId, auth0Id });
        if (!goal) return res.status(404).json({ message: 'Goal not found' });

        goal.currentAmount += Number(amount);
        await goal.save();
        res.status(200).json(goal);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE goal
router.delete('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        await SavingsGoal.findOneAndDelete({ _id: req.params.id, auth0Id });
        res.status(200).json({ message: 'Goal deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
