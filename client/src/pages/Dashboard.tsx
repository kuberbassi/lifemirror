import React, { useEffect, useState } from 'react';
import * as Icon from 'react-feather';
import { useApi } from '../services/api';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { format } from 'date-fns';

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

const Dashboard: React.FC = () => {
    const { request } = useApi();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    // Default KPI values
    const [lifeScore, setLifeScore] = useState(0);
    const [taskScore, setTaskScore] = useState(0);
    const [financeScore, setFinanceScore] = useState(0);
    const [fitnessScore, setFitnessScore] = useState(0);
    const [moodScore, setMoodScore] = useState(0);
    const [digitalScore, setDigitalScore] = useState(0);

    const fetchData = async () => {
        try {
            const result = await request('dashboard/all');
            if (result) {
                setData(result);
                calculateScores(result);
            }
        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateScores = (d: any) => {
        // Simple logic to calculate score (0-10) for Radar Chart

        // 1. Tasks: Based on completion rate of recent tasks
        const totalTasks = d.tasks.length;
        const completedTasks = d.tasks.filter((t: any) => t.completed).length;
        const tScore = totalTasks > 0 ? (completedTasks / totalTasks) * 10 : 5;
        setTaskScore(Math.round(tScore));

        // 2. Finance: Based on unpaid bills
        const unpaidBills = d.bills.filter((b: any) => !b.paid).length;
        const fScore = Math.max(0, 10 - (unpaidBills * 2));
        setFinanceScore(Math.round(fScore));

        // 3. Fitness: Based on having logs for today
        const today = format(new Date(), 'yyyy-MM-dd');
        const hasActivity = d.fitnessLogs.some((l: any) => l.date === today);
        const fitScore = hasActivity ? 8 : 4;
        setFitnessScore(fitScore);

        // 4. Mood: Based on today's mood (0-4 scale -> map to 0-10)
        const todayMood = d.moodLogs.find((l: any) => l.date === today);
        const mScore = todayMood ? (todayMood.mood / 4) * 10 : 5;
        setMoodScore(Math.round(mScore));

        // 5. Digital: Simple count
        const dScore = Math.min(10, d.assets.length);
        setDigitalScore(dScore);

        // Total Life Score (Weighted Average)
        // Tasks 25%, Finance 20%, Fitness 20%, Mood 20%, Digital 15%
        const total = (tScore * 2.5) + (fScore * 2.0) + (fitScore * 2.0) + (mScore * 2.0) + (dScore * 1.5);
        setLifeScore(Math.round(total));
    };

    useEffect(() => {
        fetchData();
    }, [request]);

    // Radar Chart Data
    const radarData = {
        labels: ['Tasks', 'Finance', 'Fitness', 'Mood', 'Digital'],
        datasets: [
            {
                label: 'Life Balance',
                data: [taskScore, financeScore, fitnessScore, moodScore, digitalScore],
                backgroundColor: 'rgba(0, 199, 166, 0.2)',
                borderColor: '#00c7a6',
                borderWidth: 2,
                pointBackgroundColor: '#00c7a6',
            },
        ],
    };

    const options = {
        scales: {
            r: {
                angleLines: { color: 'rgba(0,0,0,0.1)' },
                grid: { color: 'rgba(0,0,0,0.05)' },
                pointLabels: {
                    font: { size: 12, family: 'Inter' },
                    color: '#555'
                },
                suggestedMin: 0,
                suggestedMax: 10,
                ticks: { display: false }
            },
        },
        plugins: {
            legend: { display: false }
        },
        maintainAspectRatio: false
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading Dashboard...</div>;

    // Derived Data for UI
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const upcomingTasks = data?.tasks?.filter((t: any) => !t.completed).slice(0, 3) || [];
    const unpaidBills = data?.bills?.filter((b: any) => !b.paid) || [];
    const totalDue = unpaidBills.reduce((acc: number, curr: any) => acc + curr.amount, 0);
    const todayMood = data?.moodLogs?.find((l: any) => l.date === todayStr);
    const todaySteps = data?.fitnessLogs?.filter((l: any) => l.date === todayStr && l.type === 'steps')
        .reduce((acc: number, c: any) => acc + c.value, 0) || 0;
    const moodEmojis = ['😔', '😞', '😐', '😊', '🤩'];
    const moodLabels = ['Awful', 'Sad', 'Neutral', 'Happy', 'Great'];

    return (
        <section className="dashboard-grid" id="dashboard-grid">

            <div className="card life-score">
                <div className="card-header">
                    <h3>Life Score</h3>
                    <span className="card-metric">{lifeScore}</span>
                </div>
                <div className="life-score-content">
                    <div className="chart-container" style={{ position: 'relative', height: '240px', width: '100%' }}>
                        <Radar data={radarData} options={options} />
                    </div>
                    <ul className="score-weights">
                        <li>Tasks (25%): {taskScore}/10</li>
                        <li>Financial (20%): {financeScore}/10</li>
                        <li>Fitness (20%): {fitnessScore}/10</li>
                        <li>Mood (20%): {moodScore}/10</li>
                        <li>Digital (15%): {digitalScore}/10</li>
                    </ul>
                </div>
            </div>

            <div className="card ai-remedies">
                <h3>Actions for Today</h3>
                <ul className="remedy-list">
                    {unpaidBills.slice(0, 2).map((bill: any) => (
                        <li key={bill._id} className="remedy-item" data-status="finance">
                            <Icon.CreditCard size={16} />
                            <p>Pay {bill.name}</p>
                            <button className="remedy-button">₹{bill.amount}</button>
                        </li>
                    ))}
                    {upcomingTasks.map((task: any) => (
                        <li key={task._id} className="remedy-item" data-status="task">
                            <Icon.CheckSquare size={16} />
                            <p>{task.text}</p>
                            <span style={{ fontSize: '12px', color: '#666' }}>Due {format(new Date(task.date), 'MMM d')}</span>
                        </li>
                    ))}
                    {unpaidBills.length === 0 && upcomingTasks.length === 0 && (
                        <p style={{ color: '#999', marginTop: '10px' }}>All caught up! Great job.</p>
                    )}
                </ul>
            </div>

            <div className="card tasks-schedule">
                <h3>Today's Schedule</h3>
                <ul className="task-list">
                    {upcomingTasks.length > 0 ? upcomingTasks.map((task: any) => (
                        <li key={task._id} className="task-item">
                            <Icon.Circle size={14} style={{ marginRight: '10px', color: '#00c7a6' }} />
                            <label>{task.text}</label>
                        </li>
                    )) : (
                        <li className="task-item" style={{ color: '#999' }}>No pending tasks for today.</li>
                    )}
                </ul>
            </div>

            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Mood Snapshot</h3><Icon.Smile />
                </div>
                <p className="kpi-value" style={{ fontSize: '2rem' }}>
                    {todayMood ? moodEmojis[todayMood.mood] : '❓'}
                </p>
                <p className="kpi-label">
                    {todayMood ? moodLabels[todayMood.mood] : 'Not logged yet'}
                </p>
                {todayMood && <p className="kpi-label">Stress: {todayMood.stress}%</p>}
            </div>

            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Health Today</h3><Icon.Heart />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <Icon.Activity size={24} style={{ marginRight: '8px', color: 'var(--c-primary)' }} />
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{todaySteps.toLocaleString()}</span>
                    <span className="kpi-steps-label" style={{ fontSize: '14px', marginLeft: '5px' }}>steps</span>
                </div>
            </div>

            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Finance Health</h3><Icon.CreditCard />
                </div>
                <p className="kpi-value">₹{totalDue}</p>
                <p className="kpi-label">Outstanding Bills</p>
            </div>

            <div className="card kpi-card digital-assets">
                <div className="card-header">
                    <h3>Social Hub</h3><Icon.Lock />
                </div>
                <p className="kpi-value">{data?.assets?.length || 0} Items</p>
                <p className="kpi-label">In Vault</p>
            </div>

        </section>
    );
};

export default Dashboard;
