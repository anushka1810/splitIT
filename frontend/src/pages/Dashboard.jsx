import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import GroupsSection from '../components/GroupsSection';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('Dashboard');

  const [stats, setStats] = useState({
    totalGroups: 0,
    totalExpenses: 0,
    netBalance: 0,
    recentActivity: []
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token) {
      navigate('/login');
      return;
    }
    if (userData) setUser(JSON.parse(userData));

    const fetchStats = async () => {
      try {
        const api = axios.create({
          baseURL: import.meta.env.VITE_API_URL || '/api',
          headers: { Authorization: `Bearer ${token}` }
        });
        const res = await api.get('/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'Groups':
        return <GroupsSection />;
      case 'Expenses':
        return (
          <div className="section_content">
            <header className="header">
              <h1>All Expenses</h1>
              <p>View all your transaction history across all groups.</p>
            </header>
            <div className="activity_placeholder">
              <p>Expense list will appear here.</p>
            </div>
          </div>
        );
      case 'Activity':
        return (
          <div className="section_content">
            <header className="header">
              <h1>Recent Activity</h1>
              <p>Track all the recent actions involving you.</p>
            </header>
            <div className="activity_placeholder">
              <p>Your recent transactions will appear here.</p>
            </div>
          </div>
        );
      case 'Dashboard':
      default:
        return (
          <div className="section_content">
            <header className="header">
              <h1>Welcome back, {user ? user.name.split(' ')[0] : 'User'}! 👋</h1>
              <p>Here's a summary of your split expenses.</p>
            </header>

            <div className="cards_container">
              <div className="card">
                <div className="card_icon group_icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <div className="card_info">
                  <h3>Total Groups</h3>
                  <p className="card_value">{loadingStats ? '...' : stats.totalGroups}</p>
                </div>
              </div>

              <div className="card">
                <div className="card_icon expense_icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                </div>
                <div className="card_info">
                  <h3>Total Expenses</h3>
                  <p className="card_value">{loadingStats ? '...' : `$${Math.abs(stats.totalExpenses).toFixed(2)}`}</p>
                </div>
              </div>

              <div className="card">
                <div className="card_icon settlement_icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <div className="card_info">
                  <h3>Net Balance</h3>
                  <p className="card_value" style={{ color: stats.netBalance < 0 ? '#DE5499' : (stats.netBalance > 0 ? '#1a7a4a' : '#264143') }}>
                    {loadingStats ? '...' : (stats.netBalance < 0 ? `-$${Math.abs(stats.netBalance).toFixed(2)}` : `+$${stats.netBalance.toFixed(2)}`)}
                  </p>
                </div>
              </div>
            </div>

            <div className="recent_activity">
              <h2>Recent Activity</h2>
              {loadingStats ? (
                <div className="activity_placeholder"><p>Loading activity...</p></div>
              ) : stats.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="activity_list">
                  {stats.recentActivity.map(act => (
                    <div key={act.id} className="activity_item">
                      <div className="activity_icon">{act.type === 'SETTLEMENT' ? '💸' : '🛒'}</div>
                      <div className="activity_details">
                        <h4>{act.description}</h4>
                        <p>{new Date(act.date).toLocaleDateString()} • {act.type === 'SETTLEMENT' ? 'Settlement' : `Paid by ${act.payer}`}</p>
                      </div>
                      <div className={`activity_amount ${act.impact > 0 ? 'positive' : act.impact < 0 ? 'negative' : 'neutral'}`}>
                        {act.impact > 0 ? '+' : ''}{act.impact.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="activity_placeholder">
                  <p>No recent activity found.</p>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <Wrapper>
      <div className="sidebar">
        <h2 className="logo">splitIT</h2>
        <nav className="nav_links">
          {['Dashboard', 'Groups', 'Expenses', 'Activity'].map((item) => (
            <a 
              key={item} 
              href="#" 
              className={activeSection === item ? "active" : ""}
              onClick={(e) => { e.preventDefault(); setActiveSection(item); }}
            >
              {item}
            </a>
          ))}
        </nav>
        <button className="logout_btn" onClick={handleLogout}>Logout</button>
      </div>
      
      <div className="main_content">
        {renderContent()}
      </div>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  /* Overrides to guarantee absolute full screen, breaking out of Vite's default App.css */
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  background: #fafafa;
  font-family: "Trebuchet MS", Arial, sans-serif;
  color: #264143;
  z-index: 1000;

  /* Explicitly setting text colors to override Vite dark mode defaults */
  h1, h2, h3, p {
    color: #264143;
  }

  /* Sidebar Styles */
  .sidebar {
    width: 250px;
    height: 100%;
    background-color: #EDDCD9;
    border-right: 2px solid #264143;
    display: flex;
    flex-direction: column;
    padding: 30px 20px;
    box-sizing: border-box;
  }

  .logo {
    font-size: 2em;
    font-weight: 900;
    color: #DE5499;
    margin-bottom: 40px;
    text-shadow: 2px 2px 0px #E99F4C;
  }

  .nav_links {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 15px;
  }

  .nav_links a {
    text-decoration: none;
    color: #264143;
    font-size: 1.1em;
    font-weight: 700;
    padding: 12px 15px;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .nav_links a:hover, .nav_links a.active {
    background-color: #264143;
    color: #fff;
    transform: translateX(5px);
    box-shadow: 2px 3px 0px 0px #E99F4C;
  }

  .logout_btn {
    padding: 12px;
    background: #fff;
    border: 2px solid #264143;
    border-radius: 8px;
    font-weight: 800;
    color: #264143;
    cursor: pointer;
    box-shadow: 2px 3px 0px 0px #E99F4C;
    transition: all 0.2s;
  }

  .logout_btn:hover {
    transform: translateY(2px);
    box-shadow: 1px 1px 0px 0px #E99F4C;
  }

  /* Main Content Styles */
  .main_content {
    flex: 1;
    height: 100%;
    padding: 50px;
    box-sizing: border-box;
    overflow-y: auto;
    background: #fafafa;
  }
  
  .section_content {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    margin-bottom: 40px;
    h1 {
      font-size: 2.2em;
      font-weight: 900;
      margin-bottom: 10px;
    }
    p {
      font-size: 1.1em;
      color: #555;
    }
  }

  /* Cards Grid */
  .cards_container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 25px;
    margin-bottom: 50px;
  }

  .card {
    background: #fff;
    border: 2px solid #264143;
    border-radius: 16px;
    padding: 25px;
    display: flex;
    align-items: center;
    box-shadow: 4px 5px 0px 1px #E99F4C;
    transition: transform 0.2s ease;
  }

  .card:hover {
    transform: translateY(-5px);
  }

  .card_icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 20px;
    border: 2px solid #264143;
  }

  .group_icon { background-color: #EDDCD9; color: #DE5499; }
  .expense_icon { background-color: #e0f2f1; color: #00897b; }
  .settlement_icon { background-color: #fff3e0; color: #fb8c00; }

  .card_info h3 {
    font-size: 1em;
    font-weight: 700;
    color: #555;
    margin-bottom: 5px;
  }

  .card_value {
    font-size: 1.8em;
    font-weight: 900;
    color: #264143;
  }

  /* Recent Activity Section */
  .recent_activity h2 {
    font-size: 1.5em;
    font-weight: 900;
    margin-bottom: 20px;
  }

  .activity_placeholder {
    background: #fff;
    border: 2px dashed #264143;
    border-radius: 16px;
    padding: 50px;
    text-align: center;
    color: #777;
    font-weight: 600;
  }

  .activity_list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .activity_item {
    background: #fff;
    border: 2px solid #264143;
    border-radius: 12px;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    box-shadow: 3px 3px 0px 0px #E99F4C;
  }

  .activity_icon {
    font-size: 24px;
    margin-right: 15px;
    background: #f0f0f0;
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    border: 1px solid #264143;
  }

  .activity_details {
    flex: 1;
  }

  .activity_details h4 {
    margin: 0 0 5px 0;
    color: #264143;
    font-weight: 700;
  }

  .activity_details p {
    margin: 0;
    font-size: 0.9em;
    color: #666;
  }

  .activity_amount {
    font-weight: 800;
    font-size: 1.1em;
  }

  .activity_amount.positive { color: #1a7a4a; }
  .activity_amount.negative { color: #d93025; }
  .activity_amount.neutral { color: #264143; }
`;

export default Dashboard;
