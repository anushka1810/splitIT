import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const AddSettlementModal = ({ groupId, onClose, onSettlementAdded, existingSettlement = null }) => {
  const [amount, setAmount] = useState(existingSettlement?.amount || '');
  const [settlementDate, setSettlementDate] = useState(
    existingSettlement?.settlementDate 
      ? new Date(existingSettlement.settlementDate).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(existingSettlement?.notes || '');
  const [payerId, setPayerId] = useState(existingSettlement?.payerId || '');
  const [receiverId, setReceiverId] = useState(existingSettlement?.receiverId || '');

  const [groupMembers, setGroupMembers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await api.get(`/groups/${groupId}/members`);
        const members = res.data.currentMembers.map(m => m.user);
        setGroupMembers(members);
        
        if (!payerId && members.length > 0) {
          setPayerId(members[0].id);
        }
        if (!receiverId && members.length > 1) {
          setReceiverId(members[1].id);
        }
      } catch (err) {
        console.error('Failed to load members', err);
      }
    };
    fetchMembers();
  }, [groupId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (payerId === receiverId) {
        return alert("Payer and receiver cannot be the same person.");
    }

    const payload = {
        amount: parseFloat(amount),
        settlementDate,
        notes,
        payerId: parseInt(payerId),
        receiverId: parseInt(receiverId)
    };

    setIsSubmitting(true);
    try {
        if (existingSettlement) {
            await api.put(`/settlements/${existingSettlement.id}`, payload);
        } else {
            await api.post(`/groups/${groupId}/settlements`, payload);
        }
        onSettlementAdded();
        onClose();
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to save settlement.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <ModalOverlay>
      <ModalContent>
        <h2>{existingSettlement ? 'Edit Settlement' : 'Record a Payment'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form_row">
            <div className="form_group flex_1">
              <label>Who Paid?</label>
              <select value={payerId} onChange={e => setPayerId(e.target.value)}>
                {groupMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            
            <div className="arrow_icon">&rarr;</div>

            <div className="form_group flex_1">
              <label>Who Received?</label>
              <select value={receiverId} onChange={e => setReceiverId(e.target.value)}>
                {groupMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form_row">
            <div className="form_group flex_1">
              <label>Amount</label>
              <input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form_group flex_1">
              <label>Date</label>
              <input type="date" required value={settlementDate} onChange={e => setSettlementDate(e.target.value)} />
            </div>
          </div>

          <div className="form_group">
            <label>Notes (Optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="E.g., Venmo transfer for the weekend trip..." />
          </div>

          <div className="modal_actions">
            <button type="button" className="cancel_btn" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="save_btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </ModalContent>
    </ModalOverlay>
  );
};

const ModalOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(38, 65, 67, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: #fff;
  padding: 30px;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  border: 2px solid #264143;
  box-shadow: 4px 5px 0px 1px #E99F4C;
  font-family: "Trebuchet MS", Arial, sans-serif;
  color: #264143;

  h2 { margin-top: 0; color: #DE5499; font-weight: 900; border-bottom: 2px solid #EDDCD9; padding-bottom: 10px; margin-bottom: 20px; }

  .form_row { display: flex; gap: 15px; margin-bottom: 15px; align-items: flex-end; }
  .form_group { display: flex; flex-direction: column; margin-bottom: 15px; width: 100%; }
  .flex_1 { flex: 1; }

  .arrow_icon {
      font-size: 2rem;
      color: #DE5499;
      font-weight: bold;
      margin-bottom: 20px;
  }

  label { font-weight: 700; margin-bottom: 8px; color: #264143; }
  input, select, textarea {
    padding: 10px 12px;
    border: 2px solid #264143;
    border-radius: 6px;
    font-size: 1rem;
    outline: none;
    font-family: inherit;
    &:focus { box-shadow: 2px 3px 0px 0px #E99F4C; }
  }
  textarea { resize: vertical; min-height: 80px; }

  .modal_actions {
    display: flex;
    justify-content: flex-end;
    gap: 15px;
    margin-top: 20px;

    button {
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
    }
    .cancel_btn { background: #eee; border: 2px solid #ccc; color: #555; }
    .save_btn { background: #E99F4C; border: 2px solid #264143; color: #264143; box-shadow: 2px 3px 0px 0px #DE5499; }
    .save_btn:hover:not(:disabled) { transform: translateY(-2px); }
    .save_btn:disabled { opacity: 0.6; cursor: not-allowed; }
  }
`;

export default AddSettlementModal;
