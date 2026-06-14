import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const GroupBalances = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [balances, setBalances] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [breakdown, setBreakdown] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchBalances = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/groups/${groupId}/balances`);
        setBalances(res.data.members);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch balances.');
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [groupId, navigate]);

  const handleSelectUser = async (userId) => {
    setSelectedUser(userId);
    setLoadingBreakdown(true);
    setBreakdown(null); // clear old

    try {
      const res = await api.get(`/groups/${groupId}/balances/${userId}`);
      setBreakdown(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch detailed breakdown.');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  if (loading) return <Wrapper><div className="loading">Calculating Balances...</div></Wrapper>;
  if (error) return <Wrapper><div className="error">{error}</div><button onClick={() => navigate(`/groups/${groupId}`)}>Back</button></Wrapper>;

  return (
    <Wrapper>
      <header className="header">
        <button className="back_btn" onClick={() => navigate(`/groups/${groupId}`)}>&larr; Back to Group</button>
        <h1>Group Balances</h1>
        <p>A high-level summary of who owes whom.</p>
      </header>

      <div className="content_grid">
        <div className="left_col">
          <section className="card">
            <h2>Group Summary</h2>
            {balances.length === 0 ? (
                <p className="empty">No active members.</p>
            ) : (
                <div className="balance_list">
                    {balances.map(member => {
                        const isPositive = member.netBalance > 0.01;
                        const isNegative = member.netBalance < -0.01;
                        
                        let displayClass = 'settled';
                        let displayText = 'Settled';
                        
                        if (isPositive) {
                            displayClass = 'positive';
                            displayText = `Should receive ${member.netBalance.toFixed(2)}`;
                        } else if (isNegative) {
                            displayClass = 'negative';
                            displayText = `Owes ${Math.abs(member.netBalance).toFixed(2)}`;
                        }

                        const isSelected = selectedUser === member.userId;

                        return (
                            <div 
                                key={member.userId} 
                                className={`balance_card ${displayClass} ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectUser(member.userId)}
                            >
                                <div className="member_name">{member.name}</div>
                                <div className="member_status">{displayText}</div>
                            </div>
                        );
                    })}
                </div>
            )}
          </section>
        </div>

        <div className="right_col">
          {selectedUser === null ? (
              <div className="empty_state">Select a member to see their detailed breakdown.</div>
          ) : loadingBreakdown ? (
              <div className="loading">Loading breakdown...</div>
          ) : breakdown ? (
              <section className="card details_card">
                  <h2>{breakdown.user.name}'s Breakdown</h2>
                  
                  <div className="stats_row">
                      <div className="stat_box">
                          <span className="label">Total Paid</span>
                          <span className="value">{breakdown.totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="stat_box">
                          <span className="label">Total Owed</span>
                          <span className="value">{breakdown.totalOwed.toFixed(2)}</span>
                      </div>
                      <div className="stat_box highlight">
                          <span className="label">Net Balance</span>
                          <span className="value">{breakdown.netBalance.toFixed(2)}</span>
                      </div>
                  </div>

                  <h3>Expense History</h3>
                  {breakdown.breakdown.length === 0 ? (
                      <p className="empty">No expenses found for this user.</p>
                  ) : (
                      <ul className="history_list">
                          {breakdown.breakdown.map(item => {
                              const isPositiveImpact = item.impact > 0;
                              const isNegativeImpact = item.impact < 0;
                              let impactClass = 'neutral';
                              if (isPositiveImpact) impactClass = 'pos';
                              if (isNegativeImpact) impactClass = 'neg';

                              return (
                                  <li key={item.expenseId}>
                                      <div className="item_info">
                                          <strong>{item.description}</strong>
                                          <span>Total: {item.amount.toFixed(2)} (Paid by {item.payer})</span>
                                          <span>Their Share: {item.userShare.toFixed(2)}</span>
                                      </div>
                                      <div className={`item_impact ${impactClass}`}>
                                          {item.impact > 0 ? '+' : ''}{item.impact.toFixed(2)}
                                      </div>
                                  </li>
                              );
                          })}
                      </ul>
                  )}
              </section>
          ) : null}
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
  max-width: 1000px;
  margin: 0 auto;

  h1, h2, h3, p { color: #264143; margin-top: 0; }

  .header {
    margin-bottom: 40px;
    h1 { font-size: 2.5rem; margin-bottom: 5px; color: #DE5499; font-weight: 900; }
    p { font-size: 1.1rem; color: #555; }
  }

  .back_btn {
    background: none;
    border: none;
    color: #264143;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 20px;
    text-decoration: underline;
  }

  .content_grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }

  .card {
    background: #fff;
    border: 2px solid #264143;
    border-radius: 16px;
    padding: 25px;
    box-shadow: 4px 5px 0px 1px #E99F4C;
    h2 { border-bottom: 2px solid #EDDCD9; padding-bottom: 10px; margin-bottom: 20px; }
  }

  .balance_list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .balance_card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border: 2px solid #eee;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover { transform: translateY(-2px); box-shadow: 2px 3px 0px 0px rgba(0,0,0,0.1); }
    &.selected { border-color: #264143; box-shadow: 3px 4px 0px 1px #264143; }

    .member_name { font-weight: 900; font-size: 1.1rem; }
    .member_status { font-weight: bold; }

    &.positive .member_status { color: #0d8a43; }
    &.negative .member_status { color: #d93025; }
    &.settled .member_status { color: #888; }
  }

  .empty_state {
    text-align: center;
    padding: 50px;
    border: 2px dashed #ccc;
    border-radius: 16px;
    color: #777;
    font-size: 1.2rem;
  }

  .stats_row {
    display: flex;
    gap: 15px;
    margin-bottom: 25px;

    .stat_box {
        flex: 1;
        background: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;

        .label { font-size: 0.9rem; color: #555; margin-bottom: 5px; font-weight: bold; }
        .value { font-size: 1.5rem; font-weight: 900; color: #264143; }

        &.highlight {
            background: #EDDCD9;
            border-color: #DE5499;
            .value { color: #DE5499; }
        }
    }
  }

  .history_list {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 0;
        border-bottom: 1px dashed #ccc;
        &:last-child { border-bottom: none; }
    }

    .item_info {
        display: flex;
        flex-direction: column;
        strong { font-size: 1.1rem; margin-bottom: 3px; }
        span { font-size: 0.85rem; color: #666; }
    }

    .item_impact {
        font-weight: 900;
        font-size: 1.2rem;
        &.pos { color: #0d8a43; }
        &.neg { color: #d93025; }
        &.neutral { color: #888; }
    }
  }

  .loading, .error { text-align: center; margin-top: 50px; font-size: 1.2rem; font-weight: bold; }
  .error { color: #d93025; }
`;

export default GroupBalances;
