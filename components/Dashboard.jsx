import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import './Dashboard.css';

function Dashboard() {
    const { user } = useUserAuth();
    const navigate = useNavigate();

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Dashboard</h1>
                <button className="back-button" onClick={() => navigate('/')}>
                    Back to Home
                </button>
            </header>
            <main className="dashboard-content">
                <div className="welcome-card">
                    <h2>Welcome, {user?.email}</h2>
                    <p>This is your private dashboard. You can only see this because you're logged in.</p>
                </div>
                <div className="dashboard-grid">
                    <div className="dashboard-card">
                        <h3>Route Planning</h3>
                        <p>Plan and optimize your tram routes</p>
                    </div>
                    <div className="dashboard-card">
                        <h3>Simulation</h3>
                        <p>Run simulations of your tram network</p>
                    </div>
                    <div className="dashboard-card">
                        <h3>Analytics</h3>
                        <p>View detailed analytics and reports</p>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Dashboard; 