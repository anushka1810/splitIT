import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [emailToAdd, setEmailToAdd] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user'));

  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch group details
      const groupRes = await api.get(`/groups/${id}`);
      setGroup(groupRes.data.group);

      // Fetch members and timeline
      const membersRes = await api.get(`/groups/${id}/members`);
      setTimelineData(membersRes.data);
    } catch (err) {
      setError('Failed to load group details. ' + (err.response?.data?.error || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [id, navigate]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!emailToAdd.trim()) return;

    setIsAdding(true);
    try {
      await api.post(`/groups/${id}/members`, { email: emailToAdd });
      setEmailToAdd('');
      fetchData(); // Refresh data
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (window.confirm(`Are you sure you want to remove ${userName} from the group?`)) {
      try {
        await api.patch(`/groups/${id}/members/${userId}/remove`);
        fetchData();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to remove member.');
      }
    }
  };

  if (loading) return <Wrapper><div className="loading">Loading...</div></Wrapper>;
  if (error) return <Wrapper><div className="error">{error}</div><button onClick={() => navigate('/dashboard')}>Back to Dashboard</button></Wrapper>;
  if (!group || !timelineData) return <Wrapper><div>Group not found.</div></Wrapper>;

  const { currentMembers, formerMembers, membershipHistory } = timelineData;
  const isCreator = group.createdBy === currentUser.id;

  return (
    <Wrapper>
      <header className="header">
        <button className="back_btn" onClick={() => navigate('/dashboard')}>&larr; Back to Dashboard</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <h1>{group.name}</h1>
                <p>Created by {group.creator.name} on {new Date(group.createdAt).toLocaleDateString()}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                    className="view_expenses_btn" 
                    onClick={() => navigate(`/groups/${id}/expenses`)}
                >
                    View Expenses &rarr;
                </button>
                <button 
                    className="view_settlements_btn" 
                    onClick={() => navigate(`/groups/${id}/settlements`)}
                >
                    Settlements &rarr;
                </button>
                <button 
                    className="view_balances_btn" 
                    onClick={() => navigate(`/groups/${id}/balances`)}
                >
                    Balances &rarr;
                </button>
                <button 
                    className="import_csv_btn" 
                    onClick={() => navigate(`/groups/${id}/import`)}
                >
                    Import CSV &rarr;
                </button>
            </div>
        </div>
      </header>

      <div className="content_grid">
        <div className="left_col">
          
          <section className="card add_member_section">
            <h2>Add Member</h2>
            <form onSubmit={handleAddMember}>
              <input 
                type="email" 
                placeholder="User's email address" 
                value={emailToAdd}
                onChange={(e) => setEmailToAdd(e.target.value)}
                disabled={isAdding}
                required
              />
              <button type="submit" disabled={isAdding || !emailToAdd.trim()}>
                {isAdding ? 'Adding...' : 'Add'}
              </button>
            </form>
          </section>

          <section className="card members_section">
            <h2>Current Members ({currentMembers.length})</h2>
            {currentMembers.length === 0 ? (
              <p className="empty">No current members.</p>
            ) : (
              <ul className="member_list">
                {currentMembers.map((m) => (
                  <li key={m.id}>
                    <div className="member_info">
                      <span className="name">{m.user.name} {m.user.id === currentUser.id ? '(You)' : ''}</span>
                      <span className="date">Joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                    </div>
                    {(isCreator || m.user.id === currentUser.id) && (
                      <button className="remove_btn" onClick={() => handleRemoveMember(m.user.id, m.user.name)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card members_section">
            <h2>Former Members ({formerMembers.length})</h2>
            {formerMembers.length === 0 ? (
              <p className="empty">No former members.</p>
            ) : (
              <ul className="member_list">
                {formerMembers.map((m) => (
                  <li key={m.id}>
                    <div className="member_info">
                      <span className="name">{m.user.name}</span>
                      <span className="date">Joined {new Date(m.joinedAt).toLocaleDateString()} • Left {new Date(m.leftAt).toLocaleDateString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>

        <div className="right_col">
          <section className="card timeline_section">
            <h2>Membership Timeline</h2>
            {membershipHistory.length === 0 ? (
              <p className="empty">No history available.</p>
            ) : (
              <div className="timeline">
                {membershipHistory.map((event, index) => (
                  <div key={index} className={`timeline_item ${event.type}`}>
                    <div className="timeline_icon"></div>
                    <div className="timeline_content">
                      <p className="message">{event.message}</p>
                      <p className="date">{new Date(event.date).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  min-height: 100vh;
  background: #fafafa;
  font-family: "Trebuchet MS", Arial, sans-serif;
  color: #264143;
  padding: 40px;

  h1, h2, h3, p { color: #264143; margin-top: 0; }

  .header {
    margin: 0 auto 40px auto;
    max-width: 1200px;
    h1 { font-size: 2.5rem; margin-bottom: 5px; color: #DE5499; font-weight: 900; }
    p { font-size: 1.1rem; color: #555; }
  }

  .view_expenses_btn, .view_balances_btn, .view_settlements_btn, .import_csv_btn {
    background: #264143;
    color: #fff;
    border: 2px solid #264143;
    border-radius: 8px;
    padding: 10px 20px;
    font-weight: 800;
    font-size: 1.1rem;
    cursor: pointer;
    box-shadow: 3px 4px 0px 1px #E99F4C;
    transition: transform 0.2s;
    &:hover { transform: translateY(-2px); }
  }

  .view_balances_btn {
    background: #DE5499;
    border-color: #DE5499;
  }

  .view_settlements_btn {
    background: #E99F4C;
    border-color: #E99F4C;
    color: #264143;
  }
  
  .import_csv_btn {
    background: #0d8a43;
    border-color: #0d8a43;
  }

  .back_btn {
    background: none;
    border: none;
    color: #264143;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    margin-bottom: 20px;
    padding: 0;
    text-decoration: underline;
    display: block;
  }

  .content_grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .card {
    background: #fff;
    border: 2px solid #264143;
    border-radius: 16px;
    padding: 25px;
    box-shadow: 4px 5px 0px 1px #E99F4C;
    margin-bottom: 30px;

    h2 { border-bottom: 2px solid #EDDCD9; padding-bottom: 10px; margin-bottom: 20px; }
  }

  /* Add Member Form */
  .add_member_section form {
    display: flex;
    gap: 10px;

    input {
      flex: 1;
      padding: 12px;
      border: 2px solid #264143;
      border-radius: 8px;
      font-size: 1rem;
      outline: none;
      &:focus { box-shadow: 2px 3px 0px 0px #E99F4C; }
    }

    button {
      background: #DE5499;
      color: #fff;
      border: 2px solid #264143;
      border-radius: 8px;
      padding: 0 20px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 2px 3px 0px 0px #E99F4C;
      transition: transform 0.2s;

      &:disabled { opacity: 0.6; cursor: not-allowed; }
      &:hover:not(:disabled) { transform: translateY(-2px); }
    }
  }

  /* Member Lists */
  .member_list {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
      &:last-child { border-bottom: none; }
    }

    .member_info {
      display: flex;
      flex-direction: column;
      
      .name { font-weight: 800; font-size: 1.1rem; }
      .date { font-size: 0.85rem; color: #777; margin-top: 4px; }
    }

    .remove_btn {
      background: #fff;
      color: #d93025;
      border: 2px solid #d93025;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover { background: #d93025; color: #fff; }
    }
  }

  /* Timeline */
  .timeline {
    position: relative;
    padding-left: 20px;
  }

  .timeline::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #EDDCD9;
  }

  .timeline_item {
    position: relative;
    margin-bottom: 25px;

    .timeline_icon {
      position: absolute;
      left: -20px;
      top: 5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #DE5499;
      border: 2px solid #fff;
      box-shadow: 0 0 0 2px #264143;
    }

    &.left .timeline_icon { background: #d93025; }

    .timeline_content {
      background: #f9f9f9;
      padding: 12px 15px;
      border-radius: 8px;
      border: 1px solid #eee;

      .message { font-weight: 700; margin-bottom: 5px; }
      .date { font-size: 0.8rem; color: #888; margin: 0; }
    }
  }

  .empty { color: #888; font-style: italic; }
  .loading, .error { text-align: center; margin-top: 50px; font-size: 1.2rem; font-weight: bold; }
  .error { color: #d93025; }
`;

export default GroupDetails;
