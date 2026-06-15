import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import AddExpenseModal from '../components/AddExpenseModal';

const GroupExpenses = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [splitFilter, setSplitFilter] = useState('ALL');

  const token = localStorage.getItem('token');
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/expenses`);
      setExpenses(res.data.expenses);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchExpenses();
  }, [groupId, navigate]);

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = splitFilter === 'ALL' || exp.splitType === splitFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) return <Wrapper><div className="loading">Loading Expenses...</div></Wrapper>;
  if (error) return <Wrapper><div className="error">{error}</div><button onClick={() => navigate(`/groups/${groupId}`)}>Back</button></Wrapper>;

  return (
    <Wrapper>
      <header className="header">
        <button className="back_btn" onClick={() => navigate(`/groups/${groupId}`)}>&larr; Back to Group</button>
        <div className="title_row">
            <h1>Group Expenses</h1>
            <button className="add_btn" onClick={() => setIsModalOpen(true)}>+ Add Expense</button>
        </div>
      </header>

      <div className="controls">
        <input 
          type="text" 
          placeholder="Search by description..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="search_bar"
        />
        <select value={splitFilter} onChange={(e) => setSplitFilter(e.target.value)} className="filter_dropdown">
            <option value="ALL">All Split Types</option>
            <option value="EQUAL">Equal</option>
            <option value="EXACT">Exact</option>
            <option value="PERCENTAGE">Percentage</option>
        </select>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="empty_state">No expenses found matching your criteria.</div>
      ) : (
        <div className="expenses_list">
          {filteredExpenses.map(exp => (
            <div key={exp.id} className="expense_card" onClick={() => navigate(`/expenses/${exp.id}`)}>
              <div className="exp_date">
                <span className="month">{new Date(exp.expenseDate).toLocaleString('default', { month: 'short' })}</span>
                <span className="day">{new Date(exp.expenseDate).getDate()}</span>
              </div>
              <div className="exp_info">
                <h3>{exp.description}</h3>
                <p>Paid by {exp.payer.name}</p>
              </div>
              <div className="exp_amount">
                <span className="amount">{exp.amount.toFixed(2)} {exp.currency}</span>
                <span className="type badge">{exp.splitType}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <AddExpenseModal 
            groupId={groupId} 
            onClose={() => setIsModalOpen(false)} 
            onExpenseAdded={fetchExpenses} 
        />
      )}
    </Wrapper>
  );
};

const Wrapper = styled.div`
  min-height: 100vh;
  background: #fafafa;
  font-family: "Trebuchet MS", Arial, sans-serif;
  color: #264143;
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;

  h1, h2, h3, p { color: #264143; margin-top: 0; }

  .header {
    margin-bottom: 30px;
    
    .title_row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
    }

    h1 { font-size: 2.5rem; margin-bottom: 0; color: #DE5499; font-weight: 900; }
  }

  .back_btn {
    background: none;
    border: none;
    color: #264143;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  .add_btn {
    background: #DE5499;
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

  .controls {
    display: flex;
    gap: 15px;
    margin-bottom: 30px;

    .search_bar {
        flex: 1;
        padding: 12px;
        border: 2px solid #264143;
        border-radius: 8px;
        font-size: 1rem;
        outline: none;
        &:focus { box-shadow: 2px 3px 0px 0px #E99F4C; }
    }

    .filter_dropdown {
        padding: 12px;
        border: 2px solid #264143;
        border-radius: 8px;
        font-size: 1rem;
        outline: none;
        font-weight: bold;
    }
  }

  .empty_state {
    text-align: center;
    padding: 50px;
    border: 2px dashed #ccc;
    border-radius: 16px;
    color: #777;
    font-size: 1.2rem;
  }

  .expenses_list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .expense_card {
    display: flex;
    align-items: center;
    background: #fff;
    border: 2px solid #264143;
    border-radius: 12px;
    padding: 15px 20px;
    box-shadow: 3px 4px 0px 1px #E99F4C;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover { transform: translateY(-3px); }

    .exp_date {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #EDDCD9;
        border-radius: 8px;
        padding: 10px;
        min-width: 60px;
        margin-right: 20px;
        
        .month { font-size: 0.85rem; font-weight: bold; text-transform: uppercase; color: #d93025; }
        .day { font-size: 1.5rem; font-weight: 900; }
    }

    .exp_info {
        flex: 1;
        h3 { margin-bottom: 5px; font-size: 1.3rem; }
        p { margin: 0; color: #666; font-size: 0.95rem; }
    }

    .exp_amount {
        display: flex;
        flex-direction: column;
        align-items: flex-end;

        .amount { font-size: 1.5rem; font-weight: 900; color: #DE5499; }
        .badge {
            background: #264143;
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: bold;
            margin-top: 5px;
        }
    }
  }

  .loading, .error { text-align: center; margin-top: 50px; font-size: 1.2rem; font-weight: bold; }
  .error { color: #d93025; }
`;

export default GroupExpenses;
