import React from 'react';
import { NavLink } from 'react-router-dom';
import * as Icon from 'react-feather';

const Sidebar: React.FC = () => {
    return (
        <nav className="sidebar">
            <div className="sidebar-logo">
                <Icon.Feather />
            </div>

            <ul className="sidebar-menu" id="sidebar-menu">
                <li title="Dashboard">
                    <NavLink to="/" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.Grid />
                    </NavLink>
                </li>
                <li title="Tasks">
                    <NavLink to="/tasks" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.CheckSquare />
                    </NavLink>
                </li>
                <li title="Finance">
                    <NavLink to="/finance" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.CreditCard />
                    </NavLink>
                </li>
                <li title="Fitness">
                    <NavLink to="/fitness" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.Heart />
                    </NavLink>
                </li>
                <li title="Mood">
                    <NavLink to="/mood" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.Smile />
                    </NavLink>
                </li>
                <li title="Vault">
                    <NavLink to="/vault" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.Lock />
                    </NavLink>
                </li>
                <li title="Insights">
                    <NavLink to="/insights" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                        <Icon.BarChart2 />
                    </NavLink>
                </li>
            </ul>

            <div className="sidebar-footer">
                <NavLink to="/settings" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} title="Settings">
                    <Icon.Settings />
                </NavLink>
            </div>
        </nav>
    );
};

export default Sidebar;
