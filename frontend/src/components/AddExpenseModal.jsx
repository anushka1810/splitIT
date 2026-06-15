import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const AddExpenseModal = ({ groupId, onClose, onExpenseAdded, existingExpense = null }) => {
  const [description, setDescription] = useState(existingExpense?.description || '');
  const [amount, setAmount] = useState(existingExpense?.amount || '');
  const [currency, setCurrency] = useState(existingExpense?.currency || 'USD');
  const [expenseDate, setExpenseDate] = useState(
    existingExpense?.expenseDate 
      ? new Date(existingExpense.expenseDate).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
  );
  const [splitType, setSplitType] = useState(existingExpense?.splitType || 'EQUAL');
  const [notes, setNotes] = useState(existingExpense?.notes || '');
  const [payerId, setPayerId] = useState(existingExpense?.payerId || '');

  const [groupMembers, setGroupMembers] = useState([]);
  const [participants, setParticipants] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = localStorage.getItem('token');
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    // Fetch group members to populate dropdowns
    const fetchMembers = async () => {
      try {
        const res = await api.get(`/groups/${groupId}/members`);
        const members = res.data.currentMembers.map(m => m.user);
        setGroupMembers(members);
        
        if (!payerId && members.length > 0) {
          setPayerId(members[0].id);
        }

        if (existingExpense) {
            setParticipants(existingExpense.participants.map(p => ({
                userId: p.userId,
                selected: true,
                shareValue: p.shareValue || ''
            })));
        } else {
            // Default all members selected for EQUAL
            setParticipants(members.map(m => ({
                userId: m.id,
                selected: true,
                shareValue: ''
            })));
        }
      } catch (err) {
        console.error('Failed to load members', err);
      }
    };
    fetchMembers();
  }, [groupId]);

  const handleParticipantToggle = (userId) => {
    setParticipants(prev => prev.map(p => 
      p.userId === userId ? { ...p, selected: !p.selected } : p
    ));
  };

  const handleShareValueChange = (userId, value) => {
    setParticipants(prev => prev.map(p => 
      p.userId === userId ? { ...p, shareValue: value } : p
    ));
  };

  const calculateTotalShare = () => {
    return participants
        .filter(p => p.selected)
        .reduce((sum, p) => sum + (parseFloat(p.shareValue) || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter to only selected participants
    const selectedParticipants = participants.filter(p => p.selected);
    if (selectedParticipants.length === 0) {
        return alert("Please select at least one participant.");
    }

    // Prepare payload
    const payload = {
        description,
        amount: parseFloat(amount),
        currency,
        expenseDate,
        splitType,
        notes,
        payerId: parseInt(payerId),
        participants: selectedParticipants.map(p => ({
            userId: p.userId,
            shareValue: splitType === 'EQUAL' ? null : parseFloat(p.shareValue)
        }))
    };

    setIsSubmitting(true);
    try {
        if (existingExpense) {
            await api.put(`/expenses/${existingExpense.id}`, payload);
        } else {
            await api.post(`/groups/${groupId}/expenses`, payload);
        }
        onExpenseAdded();
        onClose();
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to save expense.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const totalAmount = parseFloat(amount) || 0;
  const currentShareSum = calculateTotalShare();

  return (
    <ModalOverlay>
      <ModalContent>
        <h2>{existingExpense ? 'Edit Expense' : 'Add New Expense'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form_row">
            <div className="form_group flex_2">
              <label>Description</label>
              <input type="text" required value={description} onChange={e => setDescription(e.target.value)} placeholder="E.g., Dinner at Mario's" />
            </div>
            <div className="form_group flex_1">
              <label>Amount</label>
              <input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form_group flex_1">
              <label>Currency</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="form_row">
            <div className="form_group flex_1">
              <label>Date</label>
              <input type="date" required value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
            </div>
            <div className="form_group flex_1">
              <label>Paid By</label>
              <select value={payerId} onChange={e => setPayerId(e.target.value)}>
                {groupMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form_group">
            <label>Split Type</label>
            <div className="split_tabs">
              {['EQUAL', 'EXACT', 'PERCENTAGE'].map(type => (
                <button 
                  type="button" 
                  key={type} 
                  className={splitType === type ? 'active' : ''}
                  onClick={() => setSplitType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="participants_area">
            <h4>Participants & Shares</h4>
            {splitType === 'EXACT' && (
                <div className="validation_hint">
                    Total: {currentShareSum.toFixed(2)} / {totalAmount.toFixed(2)} 
                    {Math.abs(currentShareSum - totalAmount) > 0.01 ? ' ❌ (Must match)' : ' ✅'}
                </div>
            )}
            {splitType === 'PERCENTAGE' && (
                <div className="validation_hint">
                    Total: {currentShareSum.toFixed(2)}% / 100% 
                    {Math.abs(currentShareSum - 100) > 0.01 ? ' ❌ (Must equal 100)' : ' ✅'}
                </div>
            )}

            <div className="participant_list">
              {groupMembers.map(member => {
                const p = participants.find(part => part.userId === member.id);
                if (!p) return null;

                return (
                  <div key={member.id} className="participant_row">
                    <label className="checkbox_label">
                      <input 
                        type="checkbox" 
                        checked={p.selected} 
                        onChange={() => handleParticipantToggle(member.id)} 
                      />
                      {member.name}
                    </label>
                    
                    {p.selected && splitType !== 'EQUAL' && (
                      <div className="input_wrapper">
                        {splitType === 'EXACT' && <span className="symbol">{currency}</span>}
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0"
                          placeholder="0"
                          value={p.shareValue}
                          onChange={(e) => handleShareValueChange(member.id, e.target.value)}
                          required={splitType !== 'EQUAL'}
                        />
                        {splitType === 'PERCENTAGE' && <span className="symbol">%</span>}
                      </div>
                    )}

                    {p.selected && splitType === 'EQUAL' && (
                        <div className="calculated_share">
                            ≈ {(totalAmount / participants.filter(x=>x.selected).length).toFixed(2)} {currency}
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form_group">
            <label>Notes (Optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional details..." />
          </div>

          <div className="modal_actions">
            <button type="button" className="cancel_btn" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="save_btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Expense'}
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
  overflow-y: auto;
  padding: 20px;
`;

const ModalContent = styled.div`
  background: #fff;
  padding: 30px;
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  border: 2px solid #264143;
  box-shadow: 4px 5px 0px 1px #E99F4C;
  font-family: "Trebuchet MS", Arial, sans-serif;
  color: #264143;

  h2 { margin-top: 0; color: #DE5499; font-weight: 900; border-bottom: 2px solid #EDDCD9; padding-bottom: 10px; margin-bottom: 20px; }

  .form_row { display: flex; gap: 15px; margin-bottom: 15px; }
  .form_group { display: flex; flex-direction: column; margin-bottom: 15px; }
  .flex_1 { flex: 1; }
  .flex_2 { flex: 2; }

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

  .split_tabs {
    display: flex;
    border: 2px solid #264143;
    border-radius: 8px;
    overflow: hidden;

    button {
      flex: 1;
      padding: 10px;
      background: #fff;
      border: none;
      border-right: 2px solid #264143;
      font-weight: 700;
      color: #264143;
      cursor: pointer;
      &:last-child { border-right: none; }
      &.active { background: #264143; color: #fff; }
    }
  }

  .participants_area {
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;

    h4 { margin: 0 0 10px 0; }
    .validation_hint { font-weight: bold; margin-bottom: 15px; color: #555; }
  }

  .participant_list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .participant_row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 6px;

    .checkbox_label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      cursor: pointer;
    }

    .input_wrapper {
      display: flex;
      align-items: center;
      gap: 5px;

      input { width: 80px; padding: 6px; }
      .symbol { font-weight: bold; }
    }

    .calculated_share { font-weight: bold; color: #888; }
  }

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
    .save_btn { background: #DE5499; border: 2px solid #264143; color: #fff; box-shadow: 2px 3px 0px 0px #E99F4C; }
    .save_btn:hover:not(:disabled) { transform: translateY(-2px); }
    .save_btn:disabled { opacity: 0.6; cursor: not-allowed; }
  }
`;

export default AddExpenseModal;
