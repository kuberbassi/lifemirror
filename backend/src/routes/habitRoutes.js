const express = require('express');
const Habit = require('../models/Habit');
const router = express.Router();

// GET all habits
router.get('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const habits = await Habit.find({ auth0Id }).sort({ createdAt: -1 });
        res.status(200).json(habits);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST new habit
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const { name } = req.body;
        const newHabit = new Habit({ auth0Id, name });
        await newHabit.save();
        res.status(201).json(newHabit);
    } catch (error) {
        res.status(400).json({ message: 'Invalid data' });
    }
});

// POST toggle check for a date
router.post('/:id/check', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        const { date } = req.body; // 'YYYY-MM-DD'
        const habitId = req.params.id;

        const habit = await Habit.findOne({ _id: habitId, auth0Id });
        if (!habit) return res.status(404).json({ message: 'Habit not found' });

        const index = habit.completedDates.indexOf(date);

        if (index > -1) {
            // Already checked -> Uncheck it
            habit.completedDates.splice(index, 1);
            // Recalculate streak logic could be complex, for now simple decrement if it was today
            // A perfect streak calc would require sorting dates and checking contiguity.
            // For MVP, we just decrement current streak if it's greater than 0
            if (habit.streak > 0) habit.streak -= 1;
        } else {
            // Not checked -> Check it
            habit.completedDates.push(date);
            habit.streak += 1;
        }

        await habit.save();
        res.status(200).json(habit);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE habit
router.delete('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.sub;
        await Habit.findOneAndDelete({ _id: req.params.id, auth0Id });
        res.status(200).json({ message: 'Habit deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
