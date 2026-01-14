import React, { useEffect, useState } from 'react';
import * as Icon from 'react-feather';
import { useApi } from '../services/api';
import { format } from 'date-fns';

interface MoodLog {
    _id: string;
    date: string;
    mood: number;
    note: string;
    stress: number;
}

const moodEmojis = ['😔', '😞', '😐', '😊', '🤩'];
const moodLabels = ['Awful', 'Sad', 'Neutral', 'Happy', 'Great'];

const Mood: React.FC = () => {
    const { request } = useApi();
    const [logs, setLogs] = useState<MoodLog[]>([]);
    const [todayMood, setTodayMood] = useState(2);
    const [todayNote, setTodayNote] = useState('');
    const [todayStress, setTodayStress] = useState(50);

    const fetchLogs = async () => {
        try {
            const data = await request('mood-logs');
            if (data) {
                setLogs(data);
                const today = format(new Date(), 'yyyy-MM-dd');
                const todayLog = data.find((l: MoodLog) => l.date === today);
                if (todayLog) {
                    setTodayMood(todayLog.mood);
                    setTodayNote(todayLog.note || '');
                    setTodayStress(todayLog.stress);
                }
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [request]);

    const handleSaveMood = async () => {
        try {
            await request('mood-logs', {
                method: 'POST',
                body: JSON.stringify({
                    date: format(new Date(), 'yyyy-MM-dd'),
                    mood: todayMood,
                    note: todayNote,
                    stress: todayStress,
                    isFinal: true
                })
            });
            fetchLogs();
        } catch (error) {
            console.error("Failed to save mood", error);
        }
    };

    return (
        <div className="page-grid">
            <div className="card" style={{ gridColumn: 'span 2' }}>
                <h3>How are you feeling today?</h3>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px', marginBottom: '20px' }}>
                    {moodEmojis.map((emoji, index) => (
                        <div
                            key={index}
                            onClick={() => setTodayMood(index)}
                            style={{
                                cursor: 'pointer',
                                fontSize: '48px',
                                opacity: todayMood === index ? 1 : 0.3,
                                transition: 'opacity 0.2s',
                                textAlign: 'center'
                            }}
                        >
                            <div>{emoji}</div>
                            <div style={{ fontSize: '12px', marginTop: '5px', color: todayMood === index ? 'var(--c-primary)' : '#999' }}>
                                {moodLabels[index]}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="modal-form-group">
                    <label>Stress Level: {todayStress}%</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={todayStress}
                        onChange={e => setTodayStress(Number(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div className="modal-form-group" style={{ marginTop: '20px' }}>
                    <label>Journal Entry (Optional)</label>
                    <textarea
                        value={todayNote}
                        onChange={e => setTodayNote(e.target.value)}
                        placeholder="How was your day? What made you feel this way?"
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: 'var(--c-border)',
                            fontFamily: 'var(--f-sans)',
                            fontSize: '14px',
                            resize: 'vertical'
                        }}
                    />
                </div>

                <button className="modal-button primary" onClick={handleSaveMood} style={{ marginTop: '20px' }}>
                    Save Today's Mood
                </button>
            </div>

            <div className="card kpi-card">
                <div className="card-header">
                    <h3>Current Mood</h3> <Icon.Smile />
                </div>
                <p className="kpi-value" style={{ fontSize: '64px' }}>{moodEmojis[todayMood]}</p>
                <p className="kpi-label">{moodLabels[todayMood]}</p>
            </div>

            <div className="card" style={{ gridColumn: 'span 3' }}>
                <h3>Mood History</h3>
                <ul className="log-list">
                    {logs.slice(0, 10).map(log => (
                        <li key={log._id} className="log-item">
                            <div>
                                <span className="time">{format(new Date(log.date), 'MMM d, yyyy')}</span>
                                <span style={{ marginLeft: '15px', fontSize: '24px' }}>{moodEmojis[log.mood]}</span>
                                <strong style={{ marginLeft: '10px' }}>{moodLabels[log.mood]}</strong>
                            </div>
                            <span className="value">Stress: {log.stress}%</span>
                        </li>
                    ))}
                    {logs.length === 0 && <li className="log-item">No mood logs yet. Start tracking today!</li>}
                </ul>
            </div>
        </div>
    );
};

export default Mood;
