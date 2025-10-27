const express = require('express');
const Bill = require('../models/Bill');
const router = express.Router();

// GET all bills for the user
router.get('/', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const bills = await Bill.find({ auth0Id })
            .select('-auth0Id -__v')
            .sort({ dueDate: 1 });
        res.status(200).json(bills);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST a new bill
router.post('/', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const newBill = new Bill({
            ...req.body,
            auth0Id
        });
        await newBill.save();
        res.status(201).json({ 
            message: 'Bill created successfully', 
            bill: { ...newBill.toObject(), auth0Id: undefined, __v: undefined }
        });
    } catch (error) {
        res.status(400).json({ message: 'Invalid bill data' });
    }
});

// PUT (update) an existing bill
router.put('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const billId = req.params.id;
        const updateData = req.body;

        const updatedBill = await Bill.findOneAndUpdate(
            { _id: billId, auth0Id },
            updateData,
            { new: true, runValidators: true }
        ).select('-auth0Id -__v');

        if (!updatedBill) {
            return res.status(404).json({ message: 'Bill not found or unauthorized' });
        }
        res.status(200).json(updatedBill);
    } catch (error) {
        res.status(400).json({ message: 'Invalid update data' });
    }
});

// DELETE a bill
router.delete('/:id', async (req, res) => {
    try {
        const auth0Id = req.auth.payload.sub;
        const billId = req.params.id;

        const result = await Bill.findOneAndDelete({ _id: billId, auth0Id });

        if (!result) {
            return res.status(404).json({ message: 'Bill not found or unauthorized' });
        }
        res.status(200).json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;