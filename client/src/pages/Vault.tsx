import React, { useEffect, useState } from 'react';
import * as Icon from 'react-feather';
import { useApi } from '../services/api';

interface Asset {
    _id: string;
    name: string;
    type: 'password' | 'link' | 'credential' | 'note';
    username?: string;
    password?: string;
    url?: string;
    category: string;
}

const Vault: React.FC = () => {
    const { request } = useApi();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState('link');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [url, setUrl] = useState('');
    const [category, setCategory] = useState('Social');
    const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});

    const fetchAssets = async () => {
        try {
            const data = await request('assets');
            if (data) setAssets(data);
        } catch (error) {
            console.error("Failed to fetch assets", error);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, [request]);

    const handleAddAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await request('assets', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    type,
                    username: type === 'password' ? username : undefined,
                    password: type === 'password' ? password : undefined,
                    url: type === 'link' || type === 'password' ? url : undefined,
                    category
                })
            });
            setIsModalOpen(false);
            setName('');
            setUsername('');
            setPassword('');
            setUrl('');
            fetchAssets();
        } catch (error) {
            console.error("Failed to add asset", error);
        }
    };

    const deleteAsset = async (id: string) => {
        if (!confirm("Delete this item?")) return;
        try {
            await request(`assets/${id}`, { method: 'DELETE' });
            setAssets(assets.filter(a => a._id !== id));
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const groupedAssets = assets.reduce((acc, curr) => {
        if (!acc[curr.category]) acc[curr.category] = [];
        acc[curr.category].push(curr);
        return acc;
    }, {} as { [key: string]: Asset[] });

    return (
        <div className="page-grid">

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <h3>Add New Item</h3>
                        <form onSubmit={handleAddAsset}>
                            <div className="modal-form-group">
                                <label>Name</label>
                                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. GitHub" />
                            </div>
                            <div className="modal-form-row">
                                <div className="modal-form-group">
                                    <label>Type</label>
                                    <select value={type} onChange={e => setType(e.target.value)}>
                                        <option value="link">Link/Bookmark</option>
                                        <option value="password">Password</option>
                                        <option value="credential">Credential</option>
                                        <option value="note">Note</option>
                                    </select>
                                </div>
                                <div className="modal-form-group">
                                    <label>Category</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="Social">Social</option>
                                        <option value="Work">Work</option>
                                        <option value="Shopping">Shopping</option>
                                        <option value="Finance">Finance</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            {(type === 'link' || type === 'password') && (
                                <div className="modal-form-group">
                                    <label>URL</label>
                                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" />
                                </div>
                            )}
                            {type === 'password' && (
                                <>
                                    <div className="modal-form-group">
                                        <label>Username</label>
                                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
                                    </div>
                                    <div className="modal-form-group">
                                        <label>Password</label>
                                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                                    </div>
                                </>
                            )}
                            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                                <button type="button" className="modal-button secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="modal-button primary">Add to Vault</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="card" style={{ gridColumn: 'span 3' }}>
                <div className="card-header">
                    <h3><Icon.Lock size={20} style={{ marginRight: '10px', verticalAlign: 'middle' }} /> Digital Vault</h3>
                    <button className="add-new-button" onClick={() => setIsModalOpen(true)}>
                        <Icon.Plus size={16} /> Add Item
                    </button>
                </div>

                {Object.keys(groupedAssets).map(category => (
                    <div key={category} style={{ marginTop: '20px' }}>
                        <h4 style={{ fontSize: '16px', color: 'var(--c-text-muted)', marginBottom: '10px' }}>{category}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {groupedAssets[category].map(asset => (
                                <li key={asset._id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    borderBottom: '1px solid #f0f0f0',
                                    background: '#fafafa',
                                    marginBottom: '8px',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ flexGrow: 1 }}>
                                        <strong>{asset.name}</strong>
                                        <span style={{ marginLeft: '10px', fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>{asset.type}</span>
                                        {asset.url && (
                                            <div style={{ fontSize: '12px', color: 'var(--c-primary)', marginTop: '5px' }}>
                                                <a href={asset.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                                                    {asset.url}
                                                </a>
                                            </div>
                                        )}
                                        {asset.username && (
                                            <div style={{ fontSize: '12px', color: '#555', marginTop: '5px' }}>
                                                <Icon.User size={12} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                                {asset.username}
                                            </div>
                                        )}
                                        {asset.password && (
                                            <div style={{ fontSize: '12px', color: '#555', marginTop: '5px' }}>
                                                <Icon.Key size={12} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                                                {showPassword[asset._id] ? asset.password : '••••••••'}
                                                <button
                                                    onClick={() => setShowPassword({ ...showPassword, [asset._id]: !showPassword[asset._id] })}
                                                    style={{ marginLeft: '10px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-primary)' }}
                                                >
                                                    {showPassword[asset._id] ? <Icon.EyeOff size={14} /> : <Icon.Eye size={14} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => deleteAsset(asset._id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc' }}>
                                        <Icon.Trash2 size={16} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                {assets.length === 0 && <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Your vault is empty. Add passwords, links, or notes.</p>}
            </div>
        </div>
    );
};

export default Vault;
