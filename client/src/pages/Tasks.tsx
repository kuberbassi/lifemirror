
import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import * as Icon from 'react-feather';
import { useApi } from '../services/api';
import { format } from 'date-fns';

interface Task {
    _id: string;
    text: string;
    date: string;
    priority: 'low' | 'medium' | 'high' | 'meeting' | 'holiday';
    completed: boolean;
    type: 'task' | 'meeting' | 'holiday';
}

const Tasks: React.FC = () => {
    const { request } = useApi();

    // TASK STATE
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskDate, setNewTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [newTaskPriority, setNewTaskPriority] = useState('medium');

    // HABIT STATE
    const [habits, setHabits] = useState<any[]>([]);
    const [habitName, setHabitName] = useState('');
    const [showHabitInput, setShowHabitInput] = useState(false);

    // FETCH DATA
    const fetchTasks = async () => {
        try {
            const data = await request('tasks');
            if (data) setTasks(data);
        } catch (error) {
            console.error("Failed to fetch tasks", error);
        }
    };

    const fetchHabits = async () => {
        try {
            const data = await request('habits');
            if (data) setHabits(data);
        } catch (error) {
            console.error("Failed to fetch habits", error);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchHabits();
    }, [request]);

    // TASK HANDLERS
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await request('tasks', {
                method: 'POST',
                body: JSON.stringify({
                    text: newTaskText,
                    date: newTaskDate,
                    priority: newTaskPriority,
                    type: newTaskPriority === 'meeting' ? 'meeting' : 'task'
                })
            });
            setIsModalOpen(false);
            setNewTaskText('');
            fetchTasks();
        } catch (error) {
            console.error("Failed to add task", error);
        }
    };

    const toggleTask = async (id: string, currentStatus: boolean) => {
        setTasks(tasks.map(t => t._id === id ? { ...t, completed: !currentStatus } : t));
        try {
            await request(`tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ completed: !currentStatus })
            });
        } catch (error) {
            console.error("Failed to update task", error);
            fetchTasks();
        }
    };

    const deleteTask = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        try {
            await request(`tasks/${id}`, { method: 'DELETE' });
            setTasks(tasks.filter(t => t._id !== id));
        } catch (error) {
            console.error("Failed to delete task", error);
        }
    };

    // HABIT HANDLERS
    const handleCreateHabit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await request('habits', {
                method: 'POST',
                body: JSON.stringify({ name: habitName })
            });
            setHabitName('');
            setShowHabitInput(false);
            fetchHabits();
        } catch (error) {
            console.error(error);
        }
    };

    const toggleHabitCheck = async (id: string) => {
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            // Optimistic Update
            setHabits(habits.map(h => {
                if (h._id === id) {
                    const isDone = h.completedDates.includes(today);
                    if (isDone) {
                        return { ...h, completedDates: h.completedDates.filter((d: string) => d !== today), streak: Math.max(0, h.streak - 1) };
                    } else {
                        return { ...h, completedDates: [...h.completedDates, today], streak: h.streak + 1 };
                    }
                }
                return h;
            }));

            await request(`habits/${id}/check`, {
                method: 'POST',
                body: JSON.stringify({ date: today })
            });
            fetchHabits();
        } catch (error) {
            console.error(error);
            fetchHabits();
        }
    };

    const deleteHabit = async (id: string) => {
        if (!confirm("Delete this habit?")) return;
        try {
            await request(`habits/${id}`, { method: 'DELETE' });
            setHabits(habits.filter(h => h._id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    // COMPUTED
    const upcomingTasks = tasks
        .filter(t => !t.completed)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const calendarEvents = tasks.map(t => ({
        id: t._id,
        title: t.text,
        date: t.date,
        color: t.completed ? '#e0e0e0' : (t.priority === 'high' ? '#c62828' : '#00c7a6'),
        textColor: t.completed ? '#999' : '#fff'
    }));

    return (
        <div className="page-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', height: '100%' }}>

            {/* Modal for adding tasks */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <h3>Add New Task</h3>
                        <form onSubmit={handleAddTask}>
                            <div className="modal-form-group">
                                <label>Task Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newTaskText}
                                    onChange={e => setNewTaskText(e.target.value)}
                                    placeholder="e.g. Finish Monthly Report"
                                />
                            </div>
                            <div className="modal-form-row">
                                <div className="modal-form-group">
                                    <label>Due Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newTaskDate}
                                        onChange={e => setNewTaskDate(e.target.value)}
                                    />
                                </div>
                                <div className="modal-form-group">
                                    <label>Priority</label>
                                    <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="meeting">Meeting</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                <button type="button" className="modal-button secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="modal-button primary">Create Task</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column' }}>
                <div className="card-header">
                    <h3>Task Calendar</h3>
                    <div className="header-actions">
                        <button className="add-task-button" onClick={() => setIsModalOpen(true)}>
                            <Icon.Plus size={16} /> Add Task
                        </button>
                    </div>
                </div>
                <div style={{ flexGrow: 1, marginTop: '20px', padding: '10px' }} className="fc-theme-standard">
                    <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,dayGridWeek'
                        }}
                        height="auto"
                        events={calendarEvents}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* HABIT TRACKER */}
                <div className="card">
                    <div className="card-header">
                        <h3>Habits</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-primary)' }} onClick={() => setShowHabitInput(!showHabitInput)}>
                            <Icon.Plus size={16} />
                        </button>
                    </div>

                    {showHabitInput && (
                        <form onSubmit={handleCreateHabit} style={{ marginBottom: '15px', display: 'flex', gap: '5px' }}>
                            <input
                                type="text"
                                value={habitName}
                                onChange={e => setHabitName(e.target.value)}
                                placeholder="New habit..."
                                style={{ flexGrow: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
                            />
                            <button type="submit" style={{ background: 'var(--c-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 10px' }}>Add</button>
                        </form>
                    )}

                    <ul className="task-list">
                        {habits.map(habit => {
                            const today = format(new Date(), 'yyyy-MM-dd');
                            const isDone = habit.completedDates?.includes(today);
                            return (
                                <li key={habit._id} className="task-item" style={{ justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <div
                                            onClick={() => toggleHabitCheck(habit._id)}
                                            style={{
                                                width: '20px', height: '20px',
                                                borderRadius: '50%',
                                                border: isDone ? 'none' : '2px solid #ddd',
                                                background: isDone ? 'var(--c-primary)' : 'transparent',
                                                marginRight: '10px',
                                                cursor: 'pointer',
                                                display: 'grid',
                                                placeItems: 'center'
                                            }}
                                        >
                                            {isDone && <Icon.Check size={12} color="#fff" />}
                                        </div>
                                        <span>{habit.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: '#ffa500' }}>
                                            <Icon.Zap size={12} fill="#ffa500" style={{ marginRight: '2px' }} />
                                            {habit.streak}
                                        </div>
                                        <Icon.X size={12} style={{ cursor: 'pointer', color: '#ccc' }} onClick={() => deleteHabit(habit._id)} />
                                    </div>
                                </li>
                            );
                        })}
                        {habits.length === 0 && <p style={{ color: '#999', fontSize: '13px', textAlign: 'center' }}>No habits tracked yet.</p>}
                    </ul>
                </div>

                {/* UPCOMING DEADLINES */}
                <div className="card" style={{ flexGrow: 1 }}>
                    <h3>Upcoming Deadlines</h3>
                    <ul className="task-list" style={{ overflowY: 'auto', flexGrow: 1 }}>
                        {upcomingTasks.slice(0, 5).map(task => (
                            <li key={task._id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                                <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                                    <input
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={() => toggleTask(task._id, task.completed)}
                                    />
                                    <div style={{ marginLeft: '12px' }}>
                                        <label style={{ display: 'block', cursor: 'pointer' }}>{task.text}</label>
                                        <span style={{ fontSize: '12px', color: '#999' }}>{format(new Date(task.date), 'MMM d')} • {task.priority}</span>
                                    </div>
                                </div>
                                <button onClick={() => deleteTask(task._id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc' }}>
                                    <Icon.Trash2 size={14} />
                                </button>
                            </li>
                        ))}
                        {upcomingTasks.length === 0 && (
                            <li className="task-item-empty">No upcoming tasks! Relax or add one.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Tasks;
