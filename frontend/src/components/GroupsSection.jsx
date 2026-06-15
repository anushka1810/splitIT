import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const GroupsSection = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authenticated axios instance
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/groups');
      setGroups(response.data.groups);
    } catch (err) {
      setError('Failed to fetch groups. ' + (err.response?.data?.error || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setGroupName('');
    setIsModalOpen(true);
  };

  const openEditModal = (group) => {
    setModalMode('edit');
    setCurrentGroupId(group.id);
    setGroupName(group.name);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setGroupName('');
    setCurrentGroupId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    
    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api.post('/groups', { name: groupName });
      } else if (modalMode === 'edit') {
        await api.put(`/groups/${currentGroupId}`, { name: groupName });
      }
      closeModal();
      fetchGroups(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.error || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      try {
        await api.delete(`/groups/${id}`);
        fetchGroups();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete group.');
      }
    }
  };

  return (
    <SectionWrapper>
      <header className="header">
        <div className="header_top">
          <div>
            <h1>Your Groups</h1>
            <p>Manage your shared groups and see who owes what.</p>
          </div>
          <button className="primary_btn" onClick={openCreateModal}>+ Create Group</button>
        </div>
      </header>

      {error && <div className="error_msg">{error}</div>}

      {loading ? (
        <div className="placeholder"><p>Loading groups...</p></div>
      ) : groups.length === 0 ? (
        <div className="placeholder">
          <p>You aren't in any groups yet.</p>
          <button className="secondary_btn" onClick={openCreateModal}>Create your first group</button>
        </div>
      ) : (
        <div className="groups_grid">
          {groups.map((group) => {
            const isCreator = group.creator.id === user.id;
            return (
              <div 
                key={group.id} 
                className="group_card" 
                onClick={() => navigate(`/groups/${group.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="group_header">
                  <h3>{group.name}</h3>
                  {isCreator && (
                    <div className="actions" onClick={(e) => e.stopPropagation()}>
                      <button className="icon_btn edit_btn" onClick={(e) => { e.stopPropagation(); openEditModal(group); }}>Edit</button>
                      <button className="icon_btn delete_btn" onClick={(e) => { e.stopPropagation(); handleDelete(group.id); }}>Delete</button>
                    </div>
                  )}
                </div>
                <div className="group_details">
                  <p><strong>Created by:</strong> {isCreator ? 'You' : group.creator.name}</p>
                  <p><strong>Members:</strong> {group._count.members}</p>
                  <p className="date">Created on {new Date(group.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="modal_overlay">
          <div className="modal_content">
            <h2>{modalMode === 'create' ? 'Create New Group' : 'Edit Group Name'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form_group">
                <label htmlFor="groupName">Group Name</label>
                <input 
                  id="groupName"
                  type="text" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="E.g., Weekend Trip"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
              <div className="modal_actions">
                <button type="button" className="cancel_btn" onClick={closeModal} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className="save_btn" disabled={isSubmitting || !groupName.trim()}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SectionWrapper>
  );
};

const SectionWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;

  .header_top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }

  .primary_btn {
    background: #DE5499;
    color: #fff;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 800;
    font-size: 1rem;
    cursor: pointer;
    box-shadow: 2px 3px 0px 0px #E99F4C;
    transition: transform 0.2s;
  }
  .primary_btn:hover { transform: translateY(-2px); }

  .secondary_btn {
    background: #fff;
    color: #264143;
    border: 2px solid #264143;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 800;
    margin-top: 15px;
    cursor: pointer;
    box-shadow: 2px 3px 0px 0px #E99F4C;
  }

  .error_msg {
    color: #d93025;
    font-weight: bold;
    margin-bottom: 20px;
  }

  .placeholder {
    background: #fff;
    border: 2px dashed #264143;
    border-radius: 16px;
    padding: 60px;
    text-align: center;
    color: #555;
    font-weight: 600;
    font-size: 1.1rem;
  }

  .groups_grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .group_card {
    background: #fff;
    border: 2px solid #264143;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 3px 4px 0px 1px #E99F4C;
    transition: transform 0.2s;
  }
  .group_card:hover {
    transform: translateY(-3px);
  }

  .group_header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
    border-bottom: 1px solid #eee;
    padding-bottom: 10px;

    h3 {
      font-size: 1.3rem;
      margin: 0;
      color: #DE5499;
      font-weight: 900;
      word-break: break-word;
    }
  }

  .icon_btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 700;
    margin-left: 10px;
    text-decoration: underline;
  }
  .edit_btn { color: #264143; }
  .delete_btn { color: #d93025; }

  .group_details p {
    margin: 5px 0;
    font-size: 0.95rem;
    color: #333;
  }
  .date {
    font-size: 0.85rem;
    color: #888 !important;
    margin-top: 10px !important;
  }

  /* Modal Styles */
  .modal_overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(38, 65, 67, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  }

  .modal_content {
    background: #fff;
    padding: 30px;
    border-radius: 16px;
    width: 90%;
    max-width: 400px;
    border: 2px solid #264143;
    box-shadow: 4px 5px 0px 1px #E99F4C;

    h2 {
      margin-top: 0;
      color: #DE5499;
      font-weight: 900;
    }

    .form_group {
      display: flex;
      flex-direction: column;
      margin: 20px 0;

      label { font-weight: 700; margin-bottom: 8px; color: #264143; }
      input {
        padding: 12px;
        border: 2px solid #264143;
        border-radius: 6px;
        font-size: 1rem;
        outline: none;
      }
      input:focus { box-shadow: 2px 3px 0px 0px #E99F4C; }
    }

    .modal_actions {
      display: flex;
      justify-content: flex-end;
      gap: 15px;

      button {
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 800;
        cursor: pointer;
      }
      .cancel_btn {
        background: #eee;
        border: 2px solid #ccc;
        color: #555;
      }
      .save_btn {
        background: #264143;
        border: 2px solid #264143;
        color: #fff;
      }
      .save_btn:disabled { opacity: 0.6; cursor: not-allowed; }
    }
  }
`;

export default GroupsSection;
