import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import AddSettlementModal from '../components/AddSettlementModal';

const GroupSettlements = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState(null);

  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/groups/${groupId}/settlements`);
      setSettlements(res.data.settlements);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch settlements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchSettlements();
  }, [groupId, navigate]);

  const handleDelete = async (settlementId) => {
    if (window.confirm('Are you sure you want to delete this payment record? This will un-settle the balances.')) {
      try {
        await api.delete(`/settlements/${settlementId}`);
        fetchSettlements();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete settlement.');
      }
    }
  };

  const openEditModal = (settlement) => {
      setEditingSettlement(settlement);
      setIsModalOpen(true);
  };

  const handleCloseModal = () => {
      setEditingSettlement(null);
      setIsModalOpen(false);
  };

  if (loading) return <Wrapper><div className="loading">Loading Settlements...</div></Wrapper>;
  if (error) return <Wrapper><div className="error">{error}</div><button onClick={() => navigate(`/groups/${groupId}`)}>Back</button></Wrapper>;

  return (
    <Wrapper>
      <header className="header">
        <button className="back_btn" onClick={() => navigate(`/groups/${groupId}`)}>&larr; Back to Group</button>
        <div className="title_row">
            <h1>Settlements</h1>
            <button className="add_btn" onClick={() => setIsModalOpen(true)}>Record Payment</button>
        </div>
        <p>Record direct payments between members to settle debts.</p>
      </header>

      {settlements.length === 0 ? (
        <div className="empty_state">No settlements recorded yet.</div>
      ) : (
        <div className="settlements_list">
          {settlements.map(settlement => {
              const canEdit = settlement.createdBy === currentUser.id || settlement.payerId === currentUser.id || settlement.receiverId === currentUser.id;

              return (
                <div key={settlement.id} className="settlement_card">
                    <div className="set_date">
                        <span className="month">{new Date(settlement.settlementDate).toLocaleString('default', { month: 'short' })}</span>
                        <span className="day">{new Date(settlement.settlementDate).getDate()}</span>
                    </div>
                    <div className="set_info">
                        <h3>{settlement.payer.name} paid {settlement.receiver.name}</h3>
                        {settlement.notes && <p className="notes">"{settlement.notes}"</p>}
                    </div>
                    <div className="set_right">
                        <span className="amount">{settlement.amount.toFixed(2)}</span>
                        {canEdit && (
                            <div className="actions">
                                <button onClick={() => openEditModal(settlement)} className="edit_btn">Edit</button>
                                <button onClick={() => handleDelete(settlement.id)} className="delete_btn">Delete</button>
                            </div>
                        )}
                    </div>
                </div>
              )
          })}
        </div>
      )}

      {isModalOpen && (
        <AddSettlementModal 
            groupId={groupId} 
            existingSettlement={editingSettlement}
            onClose={handleCloseModal} 
            onSettlementAdded={fetchSettlements} 
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

    h1 { font-size: 2.5rem; margin-bottom: 0; color: #E99F4C; font-weight: 900; }
    p { margin-top: 5px; color: #666; }
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
    background: #E99F4C;
    color: #264143;
    border: 2px solid #264143;
    border-radius: 8px;
    padding: 10px 20px;
    font-weight: 800;
    font-size: 1.1rem;
    cursor: pointer;
    box-shadow: 3px 4px 0px 1px #DE5499;
    transition: transform 0.2s;

    &:hover { transform: translateY(-2px); }
  }

  .empty_state {
    text-align: center;
    padding: 50px;
    border: 2px dashed #ccc;
    border-radius: 16px;
    color: #777;
    font-size: 1.2rem;
  }

  .settlements_list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .settlement_card {
    display: flex;
    align-items: center;
    background: #fff;
    border: 2px solid #264143;
    border-radius: 12px;
    padding: 15px 20px;
    box-shadow: 3px 4px 0px 1px #E99F4C;

    .set_date {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #f0f0f0;
        border-radius: 8px;
        padding: 10px;
        min-width: 60px;
        margin-right: 20px;
        
        .month { font-size: 0.85rem; font-weight: bold; text-transform: uppercase; color: #E99F4C; }
        .day { font-size: 1.5rem; font-weight: 900; }
    }

    .set_info {
        flex: 1;
        h3 { margin-bottom: 5px; font-size: 1.3rem; color: #DE5499; }
        .notes { margin: 0; color: #666; font-size: 0.95rem; font-style: italic; }
    }

    .set_right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;

        .amount { font-size: 1.8rem; font-weight: 900; color: #0d8a43; }
        
        .actions {
            display: flex;
            gap: 10px;
            button {
                background: none; border: none; font-weight: bold; cursor: pointer; text-decoration: underline;
                &.edit_btn { color: #555; }
                &.delete_btn { color: #d93025; }
            }
        }
    }
  }

  .loading, .error { text-align: center; margin-top: 50px; font-size: 1.2rem; font-weight: bold; }
  .error { color: #d93025; }
`;

export default GroupSettlements;
