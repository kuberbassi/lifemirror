import React from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const Insights: React.FC = () => {
    const data = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
            {
                label: 'Productivity',
                data: [65, 59, 80, 81, 56, 55, 40],
                fill: false,
                borderColor: '#00c7a6',
                tension: 0.1
            }
        ]
    };

    const options = {
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        }
    };

    return (
        <div className="page-grid">
            <div className="card" style={{ gridColumn: 'span 3', height: '400px' }}>
                <h3>Weekly Trends</h3>
                <div className="chart-container" style={{ position: 'relative', height: '100%', width: '100%' }}>
                    <Line data={data} options={options} />
                </div>
            </div>
        </div>
    );
};

export default Insights;
