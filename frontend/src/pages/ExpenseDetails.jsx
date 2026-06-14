import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import AddExpenseModal from '../components/AddExpenseModal';

const ExpenseDetails = () => {
  const { expenseId } = useParams();
  const navigate = useNavigate();

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user'));

  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchExpenseDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/expenses/${expenseId}`);
      setExpense(res.data.expense);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch expense details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchExpenseDetails();
  }, [expenseId, navigate]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      try {
        await api.delete(`/expenses/${expenseId}`);
        navigate(`/groups/${expense.groupId}/expenses`);
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete expense.');
      }
    }
  };

  if (loading) return <Wrapper><div className="loading">Loading Expense Details...</div></Wrapper>;
  if (error) return <Wrapper><div className="error">{error}</div><button onClick={() => navigate(-1)}>Back</button></Wrapper>;
  if (!expense) return null;

  const canEdit = expense.createdBy === currentUser.id || expense.payerId === currentUser.id;

  return (
    <Wrapper>
      <header className="header">
        <button className="back_btn" onClick={() => navigate(`/groups/${expense.groupId}/expenses`)}>&larr; Back to Expenses</button>
        <div className="title_row">
            <div>
                <h1>{expense.description}</h1>
                <p className="meta">Paid by <strong>{expense.payer.name}</strong> on {new Date(expense.expenseDate).toLocaleDateString()}</p>
            </div>
            {canEdit && (
                <div className="actions">
                    <button className="icon_btn edit_btn" onClick={() => setIsEditModalOpen(true)}>Edit</button>
                    <button className="icon_btn delete_btn" onClick={handleDelete}>Delete</button>
                </div>
            )}
        </div>
      </header>

      <div className="content_grid">
        <div className="left_col">
            <section className="card">
                <h2>Expense Summary</h2>
                <div className="summary_grid">
                    <div className="summary_item">
                        <span className="label">Total Amount</span>
                        <span className="value highlight">{expense.amount.toFixed(2)} {expense.currency}</span>
                    </div>
                    <div className="summary_item">
                        <span className="label">Split Type</span>
                        <span className="value badge">{expense.splitType}</span>
                    </div>
                    <div className="summary_item">
                        <span className="label">Added By</span>
                        <span className="value">{expense.creator.name}</span>
                    </div>
                </div>
                {expense.notes && (
                    <div className="notes_box">
                        <strong>Notes:</strong>
                        <p>{expense.notes}</p>
                    </div>
                )}
            </section>
        </div>

        <div className="right_col">
            <section className="card">
                <h2>Participants & Shares</h2>
                <ul className="participant_list">
                    {expense.participants.map(p => {
                        let displayShare = '';
                        if (expense.splitType === 'EQUAL') {
                            displayShare = `${(expense.amount / expense.participants.length).toFixed(2)} ${expense.currency}`;
                        } else if (expense.splitType === 'EXACT') {
                            displayShare = `${parseFloat(p.shareValue).toFixed(2)} ${expense.currency}`;
                        } else if (expense.splitType === 'PERCENTAGE') {
                            const exactAmount = (expense.amount * (parseFloat(p.shareValue) / 100)).toFixed(2);
                            displayShare = `${p.shareValue}% (${exactAmount} ${expense.currency})`;
                        }

                        return (
                            <li key={p.id}>
                                <span className="name">{p.user.name}</span>
                                <span className="share">{displayShare}</span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
      </div>

      {isEditModalOpen && (
        <AddExpenseModal 
            groupId={expense.groupId} 
            existingExpense={expense}
            onClose={() => setIsEditModalOpen(false)} 
            onExpenseAdded={fetchExpenseDetails} 
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
  max-width: 1000px;
  margin: 0 auto;

  h1, h2, h3, p { color: #264143; margin-top: 0; }

  .header {
    margin-bottom: 40px;
    
    .title_row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 10px;
    }

    h1 { font-size: 2.5rem; margin-bottom: 5px; color: #DE5499; font-weight: 900; }
    .meta { font-size: 1.1rem; color: #555; }
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

  .actions {
    display: flex;
    gap: 10px;

    .icon_btn {
        background: #fff;
        border: 2px solid #264143;
        border-radius: 8px;
        padding: 8px 16px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 2px 3px 0px 0px #E99F4C;
        transition: transform 0.2s;
        &:hover { transform: translateY(-2px); }
    }
    .delete_btn { color: #d93025; }
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

  .summary_grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }

  .summary_item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid #eee;

    .label { font-weight: bold; color: #555; }
    .value { font-weight: 900; font-size: 1.1rem; }
    .highlight { color: #DE5499; font-size: 1.4rem; }
    .badge {
        background: #264143;
        color: #fff;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.85rem;
    }
  }

  .notes_box {
    background: #EDDCD9;
    padding: 15px;
    border-radius: 8px;
    p { margin: 5px 0 0 0; }
  }

  .participant_list {
    list-style: none;
    padding: 0;
    margin: 0;

    li {
        display: flex;
        justify-content: space-between;
        padding: 15px 0;
        border-bottom: 1px dashed #ccc;
        &:last-child { border-bottom: none; }
        
        .name { font-weight: bold; font-size: 1.1rem; }
        .share { font-weight: 900; color: #DE5499; }
    }
  }

  .loading, .error { text-align: center; margin-top: 50px; font-size: 1.2rem; font-weight: bold; }
  .error { color: #d93025; }
`;

export default ExpenseDetails;
