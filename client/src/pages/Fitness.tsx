import React, { useEffect, useState } from 'react';
import * as Icon from 'react-feather';
import { useApi } from '../services/api';
import { format } from 'date-fns';


// ... imports

interface FitnessLog {
    _id: string;
    date: string;
    time: string;
    type: 'steps' | 'workout' | 'sleep' | 'calories_out' | 'water_intake' | 'weight';
    value: number;
    unit: string;
}

const Fitness: React.FC = () => {
    const { request } = useApi();
    const [logs, setLogs] = useState<FitnessLog[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [type, setType] = useState('steps');
    const [value, setValue] = useState('');

    const fetchLogs = async () => {
        try {
            const data = await request('fitness-logs');
            if (data) setLogs(data);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [request]);

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        const now = new Date();
        let unit = '';
        switch (type) {
            case 'steps': unit = 'steps'; break;
            case 'sleep': unit = 'hours'; break;
            case 'water_intake': unit = 'ml'; break;
            case 'workout': unit = 'mins'; break;
            case 'weight': unit = 'kg'; break;
            default: unit = 'kcal';
        }

        try {
            await request('fitness-logs', {
                method: 'POST',
                body: JSON.stringify({
                    date: format(now, 'yyyy-MM-dd'),
                    time: format(now, 'HH:mm'),
                    type,
                    value: Number(value),
                    unit
                })
            });
            setIsModalOpen(false);
            setValue('');
            fetchLogs();
        } catch (error) {
            console.error("Failed to add log", error);
        }
    };

    // Calculate today's totals
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = logs.filter(l => l.date === today);
    const totalSteps = todayLogs.filter(l => l.type === 'steps').reduce((acc, curr) => acc + curr.value, 0);
    const totalCalories = todayLogs.filter(l => l.type === 'calories_out').reduce((acc, curr) => acc + curr.value, 0);
    const totalSleep = todayLogs.filter(l => l.type === 'sleep').reduce((acc, curr) => acc + curr.value, 0);

    // Get latest weight
    const weightLogs = logs.filter(l => l.type === 'weight').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const currentWeight = weightLogs.length > 0 ? weightLogs[0].value : '--';

    return (
        <div className="page-grid">
            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <h3>Log Activity</h3>
                        <form onSubmit={handleAddLog}>
                            <div className="modal-form-group">
                                <label>Activity Type</label>
                                <select value={type} onChange={e => setType(e.target.value)}>
                                    <option value="steps">Steps</option>
                                    <option value="calories_out">Calories Burned</option>
                                    <option value="sleep">Sleep (Hours)</option>
                                    <option value="water_intake">Water Intake (ml)</option>
                                    <option value="workout">Workout (Minutes)</option>
                                    <option value="weight">Body Weight (kg)</option>
                                </select>
                            </div>
                            <div className="modal-form-group">
                                <label>Value</label>
                                <input type="number" step="0.1" required value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 75.5" />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                <button type="button" className="modal-button secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="modal-button primary">Log Activity</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Steps Today</h3> <Icon.Activity />
                </div>
                <p className="kpi-value">{totalSteps.toLocaleString()}</p>
                <p className="kpi-label">Goal: 10,000</p>
            </div>
            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Calories Burned</h3> <Icon.Zap />
                </div>
                <p className="kpi-value">{totalCalories}</p>
                <p className="kpi-label">kcal</p>
            </div>
            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Current Weight</h3> <Icon.User />
                </div>
                <p className="kpi-value">{currentWeight}kg</p>
                <p className="kpi-label">Body Metric</p>
            </div>

            <div className="card" style={{ gridColumn: 'span 3' }}>
                <div className="card-header">
                    <h3>Activity Log</h3>
                    <button className="add-new-button" onClick={() => setIsModalOpen(true)}>
                        <Icon.Plus size={16} /> Log Activity
                    </button>
                </div>
                <ul className="log-list">
                    {logs.slice(0, 10).map(log => (
                        <li key={log._id} className="log-item">
                            <div>
                                <span className="time">{format(new Date(`${log.date} ${log.time}`), 'MMM d, h:mm a')}</span>
                                <strong style={{ textTransform: 'capitalize', marginLeft: '10px' }}>{log.type.replace('_', ' ')}</strong>
                            </div>
                            <span className="value">{log.value} {log.unit}</span>
                        </li>
                    ))}
                    {logs.length === 0 && <li className="log-item">No activities logged yet.</li>}
                </ul>
            </div>
        </div>
    );
};

export default Fitness;

