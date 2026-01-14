
import React, { useEffect, useState } from 'react';
import * as Icon from 'react-feather';
import { useApi } from '../services/api';
import { format } from 'date-fns';

interface Bill {
    _id: string;
    name: string;
    amount: number;
    dueDate: string;
    frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
    category: string;
    paid: boolean;
}

const Finance: React.FC = () => {
    const { request } = useApi();

    // BILL STATE
    const [bills, setBills] = useState<Bill[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [frequency, setFrequency] = useState('monthly');
    const [category, setCategory] = useState('Subscription');

    // SAVINGS STATE
    const [goals, setGoals] = useState<any[]>([]);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [goalName, setGoalName] = useState('');
    const [goalTarget, setGoalTarget] = useState('');
    const [goalDeadline, setGoalDeadline] = useState('');

    // FETCH DATA
    const fetchBills = async () => {
        try {
            const data = await request('bills');
            if (data) setBills(data);
        } catch (error) {
            console.error("Failed to fetch bills", error);
        }
    };

    const fetchGoals = async () => {
        try {
            const data = await request('savings');
            if (data) setGoals(data);
        } catch (error) {
            console.error("Failed to fetch goals", error);
        }
    };

    useEffect(() => {
        fetchBills();
        fetchGoals();
    }, [request]);

    // BILL HANDLERS
    const handleAddBill = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await request('bills', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    amount: Number(amount),
                    dueDate,
                    frequency,
                    category
                })
            });
            setIsModalOpen(false);
            setName('');
            setAmount('');
            fetchBills();
        } catch (error) {
            console.error("Failed to add bill", error);
        }
    };

    const togglePaid = async (id: string, currentStatus: boolean) => {
        setBills(bills.map(b => b._id === id ? { ...b, paid: !currentStatus } : b));
        try {
            await request(`bills/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ paid: !currentStatus })
            });
        } catch (error) {
            fetchBills();
        }
    };

    const deleteBill = async (id: string) => {
        if (!confirm("Delete this bill?")) return;
        try {
            await request(`bills/${id}`, { method: 'DELETE' });
            setBills(bills.filter(b => b._id !== id));
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    // SAVINGS HANDLERS
    const handleAddGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await request('savings', {
                method: 'POST',
                body: JSON.stringify({
                    name: goalName,
                    targetAmount: Number(goalTarget),
                    deadline: goalDeadline
                })
            });
            setShowGoalModal(false);
            setGoalName('');
            setGoalTarget('');
            setGoalDeadline('');
            fetchGoals();
        } catch (error) {
            console.error(error);
        }
    };

    const addFunds = async (id: string) => {
        const amount = prompt("Enter amount to add:");
        if (!amount) return;
        try {
            await request(`savings/${id}/add`, {
                method: 'PUT',
                body: JSON.stringify({ amount })
            });
            fetchGoals();
        } catch (error) {
            console.error(error);
        }
    };

    const deleteGoal = async (id: string) => {
        if (!confirm("Delete this goal?")) return;
        try {
            await request(`savings/${id}`, { method: 'DELETE' });
            setGoals(goals.filter(g => g._id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    // COMPUTED
    const totalDue = bills.filter(b => !b.paid).reduce((acc, curr) => acc + curr.amount, 0);
    const monthlySubs = bills
        .filter(b => b.frequency === 'monthly')
        .reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="page-grid">

            {/* GOAL MODAL */}
            {showGoalModal && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <h3>Create Savings Goal</h3>
                        <form onSubmit={handleAddGoal}>
                            <div className="modal-form-group">
                                <label>Goal Name</label>
                                <input type="text" required value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g. Vacation" />
                            </div>
                            <div className="modal-form-row">
                                <div className="modal-form-group">
                                    <label>Target Amount (₹)</label>
                                    <input type="number" required value={goalTarget} onChange={e => setGoalTarget(e.target.value)} />
                                </div>
                                <div className="modal-form-group">
                                    <label>Deadline (Optional)</label>
                                    <input type="date" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                <button type="button" className="modal-button secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
                                <button type="submit" className="modal-button primary">Create Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BILL MODAL */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <h3>Add New Bill / Subscription</h3>
                        <form onSubmit={handleAddBill}>
                            <div className="modal-form-group">
                                <label>Name</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Netflix" />
                            </div>
                            <div className="modal-form-row">
                                <div className="modal-form-group">
                                    <label>Amount (₹)</label>
                                    <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} />
                                </div>
                                <div className="modal-form-group">
                                    <label>Due Date</label>
                                    <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="modal-form-row">
                                <div className="modal-form-group">
                                    <label>Frequency</label>
                                    <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="annually">Annually</option>
                                        <option value="one-time">One-Time</option>
                                    </select>
                                </div>
                                <div className="modal-form-group">
                                    <label>Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="Subscription">Subscription</option>
                                        <option value="Utility">Utility</option>
                                        <option value="Rent">Rent</option>
                                        <option value="Loan">Loan</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                <button type="button" className="modal-button secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="modal-button primary">Add Bill</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Total Due</h3> <Icon.CreditCard />
                </div>
                <p className="kpi-value">₹{totalDue.toLocaleString()}</p>
                <p className="kpi-label">Outstanding</p>
            </div>
            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Monthly Subs</h3> <Icon.RefreshCw />
                </div>
                <p className="kpi-value">₹{monthlySubs.toLocaleString()}</p>
                <p className="kpi-label">Fixed Expenses</p>
            </div>
            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Financial Score</h3> <Icon.TrendingUp />
                </div>
                <p className="kpi-value">{totalDue === 0 ? 'Excellent' : 'Good'}</p>
                <p className="kpi-label">{totalDue === 0 ? 'All bills paid!' : 'Manage your dues.'}</p>
            </div>

            {/* SAVINGS GOALS SECTION */}
            <div className="card" style={{ gridColumn: 'span 3', marginBottom: '20px' }}>
                <div className="card-header">
                    <h3>Savings Goals</h3>
                    <button className="add-new-button" onClick={() => setShowGoalModal(true)}>
                        <Icon.Plus size={16} /> New Goal
                    </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '15px' }}>
                    {goals.map(goal => {
                        const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                        return (
                            <div key={goal._id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', background: '#fafafa' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: 0 }}>{goal.name}</h4>
                                    <Icon.Trash2 size={14} style={{ cursor: 'pointer', color: '#ccc' }} onClick={() => deleteGoal(goal._id)} />
                                </div>
                                <div style={{ margin: '10px 0', fontSize: '24px', fontWeight: 'bold', color: 'var(--c-primary)' }}>
                                    ₹{goal.currentAmount.toLocaleString()}
                                    <span style={{ fontSize: '14px', color: '#999', fontWeight: 'normal' }}> / ₹{goal.targetAmount.toLocaleString()}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--c-primary)', transition: 'width 0.3s' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', color: '#999' }}>{goal.deadline ? `By ${format(new Date(goal.deadline), 'MMM yyyy')}` : 'No deadline'}</span>
                                    <button onClick={() => addFunds(goal._id)} style={{ border: '1px solid var(--c-primary)', background: 'white', color: 'var(--c-primary)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                                        + Add Funds
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {goals.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999' }}>No savings goals yet. Set a target!</p>}
                </div>
            </div>

            {/* BILLS LIST */}
            <div className="card" style={{ gridColumn: 'span 3' }}>
                <div className="card-header">
                    <h3>Bills & Subscriptions</h3>
                    <button className="add-new-button" onClick={() => setIsModalOpen(true)}>
                        <Icon.Plus size={16} /> Add Bill
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee', color: '#555' }}>
                            <th style={{ padding: '12px' }}>Name</th>
                            <th style={{ padding: '12px' }}>Amount</th>
                            <th style={{ padding: '12px' }}>Due Date</th>
                            <th style={{ padding: '12px' }}>Frequency</th>
                            <th style={{ padding: '12px' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bills.map(bill => (
                            <tr key={bill._id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                <td style={{ padding: '12px', fontWeight: 500 }}>{bill.name} <br /> <span style={{ fontSize: '12px', color: '#999' }}>{bill.category}</span></td>
                                <td style={{ padding: '12px' }}>₹{bill.amount.toLocaleString()}</td>
                                <td style={{ padding: '12px' }}>{format(new Date(bill.dueDate), 'd MMM yyyy')}</td>
                                <td style={{ padding: '12px', textTransform: 'capitalize' }}>{bill.frequency}</td>
                                <td style={{ padding: '12px' }}>
                                    {bill.paid ? (
                                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Paid</span>
                                    ) : (
                                        <span style={{ background: '#ffebee', color: '#c62828', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Due</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    {!bill.paid && <button className="remedy-button" style={{ marginRight: '10px' }} onClick={() => togglePaid(bill._id, false)}>Mark Paid</button>}
                                    {bill.paid && <button className="remedy-button" style={{ marginRight: '10px', background: '#eee', color: '#555' }} onClick={() => togglePaid(bill._id, true)}>Undo</button>}
                                    <button onClick={() => deleteBill(bill._id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc' }}>
                                        <Icon.Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {bills.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>No bills added yet.</p>}
            </div>
        </div>
    );
};

export default Finance;
