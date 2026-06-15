import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const ImportExpenses = () => {
    const { id: groupId } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState('');
    const [groupMembers, setGroupMembers] = useState([]);

    // TIER 0 State
    const [sessionId, setSessionId] = useState(null);
    const [csvMembers, setCsvMembers] = useState([]);
    const [memberResolutions, setMemberResolutions] = useState({}); // { [csvName]: { type, resolvedUserId } }
    
    // TIER 1-4 State
    const [analysis, setAnalysis] = useState(null);
    const [resolvedValid, setResolvedValid] = useState([]);
    const [resolvedSettlements, setResolvedSettlements] = useState([]);
    const [tier1, setTier1] = useState([]);
    const [tier2, setTier2] = useState([]);
    const [tier2Dismissed, setTier2Dismissed] = useState(false);
    const [tier2UndoMode, setTier2UndoMode] = useState(false);
    const [tier2CustomCurrency, setTier2CustomCurrency] = useState('USD');
    const [tier3, setTier3] = useState({ unknownNames: [], foreignCurrency: [] });
    const [tier4, setTier4] = useState({
        missingPayer: [], settlements: [], deposits: [], percentageIssues: [],
        guests: [], exactDuplicates: [], conflictingDuplicates: [],
        negativeAmounts: [], zeroAmounts: [], ambiguousDates: [], memberAfterLeave: [],
        missingCurrency: []
    });

    const token = localStorage.getItem('token');
    const api = axios.create({ baseURL: '/api', headers: { Authorization: `Bearer ${token}` } });

    useEffect(() => {
        api.get(`/groups/${groupId}/members`).then(res => {
            setGroupMembers(res.data.currentMembers.map(m => m.user));
        }).catch(err => console.error(err));
    }, [groupId]);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length > 0) validateAndSetFile(e.dataTransfer.files[0]);
    };

    const validateAndSetFile = (selectedFile) => {
        if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
            setFile(selectedFile);
            setError('');
        } else {
            setError('Please upload a valid .csv file.');
        }
    };

    // --- STEP 1: Upload to Session (Tier 0 Start) ---
    const handleUpload = async () => {
        if (!file) return;
        setError('');
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post(`/groups/${groupId}/imports/session`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total))
            });

            setSessionId(res.data.sessionId);
            setCsvMembers(res.data.csvMembers);
            // Default mappings based on exact string match
            const initialMap = {};
            res.data.csvMembers.forEach(csvName => {
                const normCsv = csvName.toLowerCase();
                
                // 1. Exact Match ONLY (ignore trailing spaces in DB)
                let match = res.data.existingGroupMembers.find(m => m.name.trim().toLowerCase() === normCsv.trim());
                
                if (match) {
                    initialMap[csvName] = { type: 'MAP_EXISTING', resolvedUserId: match.id, exactMatch: true };
                } else {
                    initialMap[csvName] = { type: '', resolvedUserId: null, exactMatch: false };
                }
            });
            setMemberResolutions(initialMap);
            setFile(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Upload failed.');
        }
    };

    // --- STEP 2: Resolve Members (Tier 0 Submit) ---
    const handleResolutionChange = (csvName, type, val) => {
        setMemberResolutions(prev => ({
            ...prev,
            [csvName]: { type, resolvedUserId: type === 'MAP_EXISTING' ? parseInt(val) : null }
        }));
    };

    const isTier0Resolved = csvMembers.every(m => memberResolutions[m] && memberResolutions[m].type !== '');

    const submitMemberResolutions = async () => {
        if (!isTier0Resolved) return alert('Please resolve all CSV members.');
        
        const resolutions = csvMembers.map(csvName => ({
            csvMemberName: csvName,
            resolutionType: memberResolutions[csvName].type,
            resolvedUserId: memberResolutions[csvName].resolvedUserId
        }));

        try {
            await api.post(`/imports/${sessionId}/member-resolutions`, { resolutions });
            
            // Now run analysis (Tier 1-4)
            const analysisRes = await api.post(`/groups/${groupId}/imports/${sessionId}/analyze`);
            const data = analysisRes.data.analysis;
            
            setAnalysis(data);
            setTier1(data.tier1);
            setTier2(data.tier2);
            setTier3(data.tier3);
            setTier4(data.tier4);
            setResolvedValid(data.clean);

            // Re-fetch members to include new ones
            const memRes = await api.get(`/groups/${groupId}/members`);
            setGroupMembers(memRes.data.currentMembers.map(m => m.user));

        } catch (err) {
            setError(err.response?.data?.error || 'Failed to resolve members.');
        }
    };

    // --- TIER 2-4 RESOLVERS ---
    const findUserId = (nameStr) => {
        if (!nameStr) return null;
        if (nameStr.startsWith('Guest: ')) return null; // Let it fall back to creator or handled differently
        const match = groupMembers.find(m => m.name.toLowerCase() === String(nameStr).toLowerCase());
        return match ? match.id : null;
    };

    const handleUndoTier2Click = () => {
        setTier2UndoMode(true);
    };

    const saveTier2CustomCurrency = () => {
        // Update in resolvedValid if they are there
        setResolvedValid(prev => prev.map(r => {
            const inTier2 = tier2.find(tr => tr.id === r.id);
            if (inTier2) return { ...r, currency: tier2CustomCurrency };
            return r;
        }));
        
        // Also update in tier4 if they are stuck there
        setTier4(prev => {
            const newT4 = { ...prev };
            Object.keys(newT4).forEach(key => {
                newT4[key] = newT4[key].map(r => {
                    const inTier2 = tier2.find(tr => tr.id === r.id);
                    if (inTier2) return { ...r, currency: tier2CustomCurrency };
                    return r;
                });
            });
            return newT4;
        });
        
        setTier2Dismissed(true);
    };

    const [bulkExchangeRate, setBulkExchangeRate] = useState(83.5);
    const applyBulkExchangeRate = () => {
        const resolved = tier3.foreignCurrency.map(row => {
            row.amount = row.amount * bulkExchangeRate;
            row.currency = 'INR';
            return row;
        });
        setResolvedValid(prev => [...prev, ...resolved]);
        setTier3(prev => ({ ...prev, foreignCurrency: [] }));
    };

    const resolveUnknownName = (rowId, mappedPayerName) => {
        const row = tier3.unknownNames.find(r => r.id === rowId);
        row.payer = mappedPayerName;
        setResolvedValid(prev => [...prev, row]);
        setTier3(prev => ({ ...prev, unknownNames: prev.unknownNames.filter(r => r.id !== rowId) }));
    };

    const resolveToValid = (category, rowId, modifications = {}) => {
        const row = tier4[category].find(r => r.id === rowId);
        const updatedRow = { ...row, ...modifications };
        setResolvedValid(prev => [...prev, updatedRow]);
        setTier4(prev => ({ ...prev, [category]: prev[category].filter(r => r.id !== rowId) }));
    };

    const handleBulkGuestResolve = (guestStr, replacementName) => {
        setTier4(prev => {
            const newGuestsList = [];
            const newlyResolvedRows = [];
            
            prev.guests.forEach(r => {
                if (r.guests.includes(guestStr)) {
                    // Update splitWith string for UI accuracy (though backend handleCommit ignores it)
                    const newSplitWith = r.splitWith.replace(guestStr, replacementName);
                    // Remove from guests array
                    const remainingGuests = r.guests.filter(g => g !== guestStr);
                    
                    const updatedRow = { ...r, splitWith: newSplitWith, guests: remainingGuests };
                    
                    if (remainingGuests.length === 0) {
                        newlyResolvedRows.push(updatedRow);
                    } else {
                        newGuestsList.push(updatedRow);
                    }
                } else {
                    newGuestsList.push(r);
                }
            });
            
            if (newlyResolvedRows.length > 0) {
                setResolvedValid(rv => [...rv, ...newlyResolvedRows]);
            }
            
            return { ...prev, guests: newGuestsList };
        });
    };

    const resolveToSettlement = (category, rowId, payerId, receiverId) => {
        const row = tier4[category].find(r => r.id === rowId);
        row.mappedPayerId = payerId;
        row.mappedReceiverId = receiverId;
        setResolvedSettlements(prev => [...prev, row]);
        setTier4(prev => ({ ...prev, [category]: prev[category].filter(r => r.id !== rowId) }));
    };

    const skipRow = (category, rowId) => {
        setTier4(prev => ({ ...prev, [category]: prev[category].filter(r => r.id !== rowId) }));
    };

    const isReadyToCommit = () => {
        if (tier3.unknownNames.length > 0 || tier3.foreignCurrency.length > 0) return false;
        return Object.values(tier4).every(arr => arr.length === 0);
    };

    const handleCommit = async () => {
        if (!isReadyToCommit()) return alert("Please resolve all anomalies.");

        const expensesToCreate = resolvedValid.map(r => {
            const pId = findUserId(r.payer) || groupMembers[0]?.id;
            const participantIds = groupMembers
                .filter(m => !(r.excludedMembers || []).includes(m.name))
                .map(m => m.id);

            let finalParticipants = [];
            if (r.participantDetails) {
                finalParticipants = r.participantDetails.map(pd => {
                    const id = findUserId(pd.member) || groupMembers.find(m => m.name === pd.member)?.id;
                    return { userId: id, shareValue: pd.exactAmount !== undefined ? pd.exactAmount : (pd.percentage !== undefined ? pd.percentage : null) };
                }).filter(p => p.userId);
            } else {
                finalParticipants = participantIds.map(id => ({ userId: id, shareValue: null }));
            }

            return {
                description: r.description,
                amount: Math.abs(r.amount),
                currency: 'INR',
                expenseDate: r.date || new Date(),
                payerId: pId,
                splitType: r.splitType && ['EQUAL', 'EXACT', 'PERCENTAGE'].includes(r.splitType.toUpperCase()) ? r.splitType.toUpperCase() : 'EQUAL',
                participants: finalParticipants
            };
        });

        const settlementsToCreate = resolvedSettlements.map(r => ({
            amount: Math.abs(r.amount),
            settlementDate: r.date || new Date(),
            notes: r.description,
            payerId: r.mappedPayerId,
            receiverId: r.mappedReceiverId
        }));

        try {
            await api.post(`/groups/${groupId}/imports/commit`, { expensesToCreate, settlementsToCreate });
            alert('Import successful!');
            navigate(`/groups/${groupId}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to commit import.');
        }
    };

    return (
        <Wrapper>
            <header className="header">
                <button className="back_btn" onClick={() => navigate(`/groups/${groupId}`)}>&larr; Back to Group</button>
                <h1>CSV Anomaly Resolver</h1>
                <p>Ensure your shared expenses are perfectly accurate before importing.</p>
            </header>

            {!sessionId ? (
                <div className="upload_section">
                    <div 
                        className={`dropzone ${isDragging ? 'dragging' : ''}`}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={e => validateAndSetFile(e.target.files[0])} />
                        <div className="icon">📁</div>
                        <h3>Drop expenses_export.csv here</h3>
                        <p>Our Tier 0 engine will extract members before anomaly scanning.</p>
                    </div>
                    {error && <div className="error">{error}</div>}
                    {file && (
                        <div className="card file_card">
                            <strong>{file.name}</strong>
                            {uploadProgress > 0 && <div className="progress" style={{ width: `${uploadProgress}%` }}></div>}
                            <button className="btn cta" onClick={handleUpload}>Parse & Extract Members</button>
                        </div>
                    )}
                </div>
            ) : !analysis ? (
                <div className="tier0_section">
                    <h2>Tier 0: Member Resolution</h2>
                    <p>Before proceeding, tell us who these people from the CSV are in your group.</p>
                    
                    <div className="progress_status">
                        Resolved: {Object.keys(memberResolutions).filter(m => memberResolutions[m].type !== '').length} / {csvMembers.length}
                        {csvMembers.filter(m => memberResolutions[m].exactMatch).length > 0 && 
                            <span style={{marginLeft: '15px', color: '#666', fontWeight: 'normal'}}>
                                ({csvMembers.filter(m => memberResolutions[m].exactMatch).length} exact matches auto-resolved)
                            </span>
                        }
                    </div>

                    {csvMembers.filter(m => !memberResolutions[m].exactMatch).length > 0 ? (
                        <table className="resolution_table">
                            <thead>
                                <tr>
                                    <th>Unrecognized Name</th>
                                    <th>Resolution</th>
                                </tr>
                            </thead>
                            <tbody>
                                {csvMembers.filter(m => !memberResolutions[m].exactMatch).map(name => {
                                    const res = memberResolutions[name] || {};
                                    return (
                                        <tr key={name}>
                                            <td><strong>{name}</strong></td>
                                            <td>
                                                <div className="resolution_actions">
                                                    <select 
                                                        value={res.type === 'MAP_EXISTING' ? res.resolvedUserId : ''} 
                                                        onChange={e => {
                                                            if(e.target.value) handleResolutionChange(name, 'MAP_EXISTING', e.target.value);
                                                        }}
                                                    >
                                                        <option value="">-- Map to Existing Member --</option>
                                                        {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                    </select>
                                                    <button 
                                                        className={`btn ${res.type === 'CREATE_NEW_MEMBER' ? 'primary' : 'outline'}`}
                                                        onClick={() => handleResolutionChange(name, 'CREATE_NEW_MEMBER')}
                                                    >Create Member</button>
                                                    <button 
                                                        className={`btn ${res.type === 'CREATE_GUEST' ? 'primary' : 'outline'}`}
                                                        onClick={() => handleResolutionChange(name, 'CREATE_GUEST')}
                                                    >Mark as Guest</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{padding: '20px', background: '#e8f5e9', borderRadius: '8px', marginBottom: '20px'}}>
                            ✅ All members perfectly matched existing group members!
                        </div>
                    )}

                    <button className="btn cta" onClick={submitMemberResolutions} disabled={!isTier0Resolved}>
                        Submit Resolutions & Run Anomaly Check
                    </button>
                    {error && <div className="error" style={{marginTop: '10px'}}>{error}</div>}
                </div>
            ) : (
                <div className="resolution_dashboard">
                    {/* TIER 1: Auto-Fixed Summary */}
                    {tier1.length > 0 && (
                        <details className="tier1_summary">
                            <summary><strong>✅ Tier 1: {tier1.length} Auto-Fixed Anomalies</strong> (Click to view)</summary>
                            <ul>
                                {tier1.map(r => (
                                    <li key={r.id}>Row {r.id}: {r.logs.join(' | ')}</li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {/* TIER 2: Aggregated Toast */}
                    {tier2.length > 0 && !tier2Dismissed && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#1f1f2e',
                            color: '#ffffff',
                            padding: '12px 20px',
                            borderRadius: '8px',
                            borderLeft: '6px solid #f59e0b',
                            marginBottom: '24px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#f59e0b', fontSize: '1.2rem' }}>⚠️</span>
                                <span>
                                    <strong>{tier2.length} row{tier2.length > 1 ? 's' : ''}</strong> had missing currency — defaulted to <strong>INR</strong>.
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {tier2UndoMode ? (
                                    <>
                                        <select 
                                            value={tier2CustomCurrency} 
                                            onChange={e => setTier2CustomCurrency(e.target.value)}
                                            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #4b5563', backgroundColor: '#374151', color: '#fff' }}
                                        >
                                            {['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'CHF', 'JPY', 'CNY', 'NZD', 'HKD', 'ZAR', 'BRL', 'RUB', 'KRW'].map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <button 
                                            onClick={saveTier2CustomCurrency}
                                            style={{
                                                backgroundColor: '#10b981', color: '#ffffff', border: 'none',
                                                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                                            }}
                                        >
                                            Save
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={handleUndoTier2Click}
                                        style={{
                                            backgroundColor: '#f59e0b', color: '#ffffff', border: 'none',
                                            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                                        }}
                                    >
                                        Undo
                                    </button>
                                )}
                                <button 
                                    onClick={() => setTier2Dismissed(true)}
                                    style={{
                                        backgroundColor: 'transparent', color: '#9ca3af', border: '1px solid #4b5563',
                                        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TIER 3: Bulk Reviews */}
                    {(tier3.unknownNames.length > 0 || tier3.foreignCurrency.length > 0) && (
                        <div className="tier3_section">
                            <h2 className="tier_title">Tier 3: Bulk Review</h2>
                            
                            {tier3.foreignCurrency.length > 0 && (
                                <div className="card anomaly_card">
                                    <h3>{tier3.foreignCurrency.length} Foreign Currency Rows (USD)</h3>
                                    <p>Apply one exchange rate to convert all USD trip expenses to INR.</p>
                                    <div className="actions form_row">
                                        <input type="number" value={bulkExchangeRate} onChange={e => setBulkExchangeRate(e.target.value)} step="0.1" />
                                        <button className="btn primary" onClick={applyBulkExchangeRate}>Apply to All</button>
                                    </div>
                                </div>
                            )}

                            {tier3.unknownNames.length > 0 && (
                                <div className="card anomaly_card">
                                    <h3>Unknown Payers Detected</h3>
                                    {tier3.unknownNames.map(row => {
                                        let selectedName = groupMembers[0]?.name;
                                        return (
                                            <div key={row.id} className="row_item" style={{display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px'}}>
                                                <span>Map <strong>"{row.unknownPayer}"</strong> to:</span>
                                                <select onChange={e => selectedName = e.target.value}>
                                                    {groupMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                                </select>
                                                <button className="btn outline" onClick={() => resolveUnknownName(row.id, selectedName)}>Save Mapping</button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TIER 4: Individual Reviews */}
                    <h2 className="tier_title">Tier 4: Individual Review Required</h2>
                    <div className="tier4_grid">
                        
                        {/* A11 & A21: Settlements and Deposits */}
                        {[...tier4.settlements, ...tier4.deposits].map(row => {
                            let pId = findUserId(row.payer) || groupMembers[0]?.id;
                            let rId = findUserId(row.suggestedReceiver) || groupMembers[1]?.id;
                            const isDeposit = tier4.deposits.includes(row);
                            return (
                                <div key={row.id} className="card anomaly_card">
                                    <h3>{isDeposit ? '🏠 Deposit Payment' : '🤝 Disguised Settlement'}</h3>
                                    <p className="desc">{row.description} - ₹{row.amount}</p>
                                    <p className="note">
                                        This looks like a direct payment, not a shared expense. Reclassify it to prevent double-counting.
                                        {row.missingSplitType ? " (Also missing split_type)" : ""}
                                    </p>
                                    <div className="actions">
                                        <select defaultValue={pId} onChange={e => pId = parseInt(e.target.value)}>
                                            <option disabled>Payer</option>
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <select defaultValue={rId} onChange={e => rId = parseInt(e.target.value)}>
                                            <option disabled>Receiver</option>
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <button className="btn primary" onClick={() => resolveToSettlement(isDeposit ? 'deposits' : 'settlements', row.id, pId, rId)}>Record as Direct Payment</button>
                                        <button className="btn outline" onClick={() => resolveToValid(isDeposit ? 'deposits' : 'settlements', row.id)}>Keep as Expense</button>
                                        <button className="btn danger" onClick={() => skipRow(isDeposit ? 'deposits' : 'settlements', row.id)}>Discard Row</button>
                                    </div>
                                </div>
                            )
                        })}

                        {/* A15: Exact Duplicates */}
                        {tier4.exactDuplicates.map(row => {
                            const originalHasNote = !!row.conflictRef?.row?.notes;
                            const thisHasNote = !!row.notes;
                            let recommendation = "Review carefully.";
                            let recommendedAction = null;
                            if (originalHasNote && !thisHasNote) {
                                recommendation = "Keep Original (it has more info in notes) and delete this one.";
                                recommendedAction = 'skip';
                            } else if (thisHasNote && !originalHasNote) {
                                recommendation = "Keep This Version (it has more info in notes) and delete the original.";
                                recommendedAction = 'keep';
                            }

                            return (
                            <div key={row.id} className="card anomaly_card duplicate">
                                <h3>⚠️ Exact Duplicate</h3>
                                <p className="desc">{row.description} - ₹{row.amount}</p>
                                <p className="note">This row has the exact same fingerprint as a previously parsed row.</p>
                                <p className="note" style={{ color: '#0056b3', fontWeight: 'bold' }}>💡 Policy Recommendation: {recommendation}</p>
                                <div className="actions">
                                    <button className={`btn ${recommendedAction === 'skip' ? 'primary' : 'outline'}`} onClick={() => skipRow('exactDuplicates', row.id)}>
                                        {recommendedAction === 'skip' ? '(Recommended) Delete This Duplicate' : 'Delete This Duplicate'}
                                    </button>
                                    <button className={`btn ${recommendedAction === 'keep' ? 'primary' : 'outline'}`} onClick={() => resolveToValid('exactDuplicates', row.id)}>
                                        {recommendedAction === 'keep' ? '(Recommended) Keep This (Delete Original)' : 'Keep This (Delete Original)'}
                                    </button>
                                    <button className="btn danger" onClick={() => {
                                        setResolvedValid(prev => prev.filter(r => r.description !== row.description || r.amount !== row.amount));
                                        skipRow('exactDuplicates', row.id);
                                    }}>Skip Both</button>
                                </div>
                            </div>
                            )
                        })}

                        {/* A24 & A25: Conflicting Duplicates */}
                        {tier4.conflictingDuplicates.map(row => {
                            const noteText = (row.notes || '').toLowerCase();
                            const refNoteText = (row.conflictRef?.row?.notes || '').toLowerCase();
                            
                            let recommendation = "Review both versions.";
                            let recommendedAction = null;

                            if (noteText.includes('wrong') || noteText.includes('mistake')) {
                                recommendation = "Trust the note author. This row explicitly mentions an error in the other log. Keep this version.";
                                recommendedAction = 'keep';
                            } else if (refNoteText.includes('wrong') || refNoteText.includes('mistake')) {
                                recommendation = "Trust the note author. The original row explicitly mentions an error in this log. Discard this version.";
                                recommendedAction = 'skip';
                            }

                            return (
                            <div key={row.id} className="card anomaly_card duplicate conflict">
                                <h3>⚠️ Conflicting Duplicate</h3>
                                <p className="desc">{row.description} - ₹{row.amount} (Paid by {row.payer})</p>
                                <p className="note">Diff: {row.conflictDiff}</p>
                                <p className="note">Note on this row: {row.notes || 'None'}</p>
                                <p className="note">Note on original row: {row.conflictRef?.row?.notes || 'None'}</p>
                                <p className="note" style={{ color: '#0056b3', fontWeight: 'bold' }}>💡 Policy Recommendation: {recommendation}</p>
                                <div className="actions">
                                    <button className={`btn ${recommendedAction === 'keep' ? 'primary' : 'outline'}`} onClick={() => {
                                        setResolvedValid(prev => prev.filter(r => r.id !== row.conflictRef?.row?.id));
                                        resolveToValid('conflictingDuplicates', row.id);
                                    }}>
                                        {recommendedAction === 'keep' ? '(Recommended) Keep This Version' : 'Keep This Version'}
                                    </button>
                                    <button className={`btn ${recommendedAction === 'skip' ? 'primary' : 'outline'}`} onClick={() => skipRow('conflictingDuplicates', row.id)}>
                                        {recommendedAction === 'skip' ? '(Recommended) Keep Original (Discard This)' : 'Keep Original (Discard This)'}
                                    </button>
                                </div>
                            </div>
                            )
                        })}

                        {/* A20: Member After Leave */}
                        {tier4.memberAfterLeave.map(row => (
                            <div key={row.id} className="card anomaly_card">
                                <h3>📅 Membership Conflict</h3>
                                <p className="desc">{row.description} on {new Date(row.date).toLocaleDateString()}</p>
                                <p className="note">Includes members who were not active: {row.conflictingMembers?.join(', ')}</p>
                                <div className="actions">
                                    <button className="btn primary" onClick={() => resolveToValid('memberAfterLeave', row.id, { excludedMembers: row.conflictingMembers })}>Remove {row.conflictingMembers?.join(', ')} (Added by mistake)</button>
                                    <button className="btn outline" onClick={() => resolveToValid('memberAfterLeave', row.id)}>Still split with {row.conflictingMembers?.join(', ')}</button>
                                </div>
                            </div>
                        ))}

                        {/* A10: Missing Payer */}
                        {tier4.missingPayer.map(row => {
                            let pId = groupMembers[0]?.id;
                            return (
                                <div key={row.id} className="card anomaly_card">
                                    <h3>❓ Missing Payer</h3>
                                    <p className="desc">{row.description} - ₹{row.amount}</p>
                                    <p className="note">Can't remember who paid? You must pick a payer or skip.</p>
                                    <div className="actions">
                                        <select defaultValue={pId} onChange={e => pId = parseInt(e.target.value)}>
                                            {groupMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <button className="btn primary" onClick={() => resolveToValid('missingPayer', row.id, { payer: groupMembers.find(m=>m.id===pId)?.name })}>Set Payer</button>
                                        <button className="btn outline" onClick={() => skipRow('missingPayer', row.id)}>Skip Expense</button>
                                    </div>
                                </div>
                            )
                        })}

                        {/* A23: Guests / Unrecognised Member */}
                        {tier4.guests?.map(row => {
                            let selectedMember = groupMembers[0]?.name;
                            return (
                                <div key={row.id} className="card anomaly_card">
                                    <h3>⚠️ Unrecognised Member in Split</h3>
                                    <p className="desc">{row.description} - ₹{row.amount}</p>
                                    <p className="note">"{row.guests.join(', ')}" is not a group member.</p>
                                    <div className="actions form_row">
                                        <select onChange={e => selectedMember = e.target.value}>
                                            {groupMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                                        </select>
                                        <button className="btn primary" onClick={() => handleBulkGuestResolve(row.guests[0], selectedMember)}>Assign guest's share to someone</button>
                                        <button className="btn outline" onClick={async () => {
                                            const guestStr = row.guests[0];
                                            const email = prompt(`Enter ${guestStr.replace('Guest: ', '')}'s registered email to add them to the group:`);
                                            if (!email) return;
                                            try {
                                                const BASE_URL = import.meta.env.VITE_API_URL || '/api';
                                                const response = await axios.post(`${BASE_URL}/groups/${groupId}/members`, { email }, {
                                                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                                });
                                                const newUser = response.data.member.user;
                                                setGroupMembers(prev => [...prev, newUser]);
                                                handleBulkGuestResolve(guestStr, newUser.name);
                                            } catch (err) {
                                                alert(err.response?.data?.error || "Failed to add member.");
                                            }
                                        }}>Add {row.guests[0].replace('Guest: ', '')} to Group</button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* A12: Percentage Issues */}
                        {tier4.percentageIssues?.map(row => (
                            <PercentageResolverCard key={row.id} row={row} onResolve={(mods) => resolveToValid('percentageIssues', row.id, mods)} />
                        ))}

                        {/* A24: Share Issues */}
                        {tier4.shareIssues?.map(row => (
                            <ShareResolverCard key={row.id} row={row} onResolve={(mods) => resolveToValid('shareIssues', row.id, mods)} />
                        ))}

                        {/* A18: Zero Amount */}
                        {tier4.zeroAmounts?.map(row => {
                            let newAmt = 0;
                            return (
                                <div key={row.id} className="card anomaly_card">
                                    <h3>⚠️ Zero Amount Expense</h3>
                                    <p className="desc">{row.description}</p>
                                    <p className="note">Note: {row.notes}</p>
                                    <div className="actions form_row">
                                        <input type="number" defaultValue={0} onChange={e => newAmt = parseFloat(e.target.value)} style={{width:'80px', padding:'6px'}} />
                                        <button className="btn primary" onClick={() => resolveToValid('zeroAmounts', row.id, { amount: newAmt })}>Update Amount</button>
                                        <button className="btn outline" onClick={() => skipRow('zeroAmounts', row.id)}>Skip</button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* A17: Negative Amount */}
                        {tier4.negativeAmounts?.map(row => {
                            let newAmt = Math.abs(row.amount);
                            return (
                                <div key={row.id} className="card anomaly_card">
                                    <h3>⚠️ Negative Amount</h3>
                                    <p className="desc">{row.description} - ₹{row.amount}</p>
                                    <p className="note">Context: {row.notes}</p>
                                    <div className="actions form_row">
                                        <button className="btn primary" onClick={() => resolveToValid('negativeAmounts', row.id)}>Confirm Refund</button>
                                        <input type="number" defaultValue={newAmt} onChange={e => newAmt = parseFloat(e.target.value)} style={{width:'80px', padding:'6px'}} />
                                        <button className="btn outline" onClick={() => resolveToValid('negativeAmounts', row.id, { amount: newAmt })}>Correct to Positive</button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* A19: Ambiguous Date */}
                        {tier4.ambiguousDates?.map(row => (
                            <div key={row.id} className="card anomaly_card">
                                <h3>📅 Ambiguous Date</h3>
                                <p className="desc">{row.description}</p>
                                <p className="note">{row.notes || "Format could be DD-MM or MM-DD."}</p>
                                <div className="actions">
                                    <button className="btn primary" onClick={() => resolveToValid('ambiguousDates', row.id, { date: row.dateOptionsIso[0] })}>{row.dateOptions[0]}</button>
                                    <button className="btn outline" onClick={() => resolveToValid('ambiguousDates', row.id, { date: row.dateOptionsIso[1] })}>{row.dateOptions[1]}</button>
                                </div>
                            </div>
                        ))}

                    </div>
                    <div className="commit_section" style={{marginTop: '40px'}}>
                        <button className="btn cta" onClick={handleCommit} disabled={!isReadyToCommit()}>
                            Import Approved Data ({resolvedValid.length} Clean, {resolvedSettlements.length} Settlements)
                        </button>
                    </div>
                </div>
            )}
        </Wrapper>
    );
};

const ShareResolverCard = ({ row, onResolve }) => {
    const totalShares = row.totalShares;
    const amount = row.amount;

    const exactBreakdown = row.shareBreakdown.map(b => ({
        member: b.member,
        exactAmount: parseFloat(((b.shares / totalShares) * amount).toFixed(2))
    }));

    const handleSave = () => {
        onResolve({ 
            splitType: 'EXACT', 
            participantDetails: exactBreakdown 
        });
    };

    return (
        <div className="card anomaly_card">
            <h3>⚠️ Share-Based Split</h3>
            <p className="desc">{row.description} - ₹{row.amount}</p>
            <p className="note">Split IT doesn't support shares natively. We calculated EXACT amounts.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '5px', marginBottom: '15px' }}>
                {exactBreakdown.map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', background: '#f5f5f5', borderRadius: '4px' }}>
                        <span>{b.member} ({row.shareBreakdown[i].shares} shares)</span>
                        <strong>₹{b.exactAmount}</strong>
                    </div>
                ))}
            </div>
            <div className="actions">
                <button className="btn primary" onClick={handleSave}>Convert to EXACT</button>
                <button className="btn outline" onClick={() => onResolve({ splitType: 'EQUAL' })}>Force EQUAL</button>
            </div>
        </div>
    );
};

const PercentageResolverCard = ({ row, onResolve }) => {
    const [breakdown, setBreakdown] = React.useState(row.percentageBreakdown || []);
    const sum = breakdown.reduce((acc, p) => acc + p.percentage, 0);

    const updatePct = (idx, val) => {
        const nb = [...breakdown];
        nb[idx].percentage = isNaN(val) ? 0 : val;
        setBreakdown(nb);
    };

    const handleSave = () => {
        if (sum !== 100) return;
        const newDetails = breakdown.map(p => `${p.percentage}%`).join(';');
        onResolve({ splitDetails: newDetails });
    };

    return (
        <div className="card anomaly_card">
            <h3>⚠️ Percentage Issue</h3>
            <p className="desc">{row.description} - ₹{row.amount}</p>
            <p className="note">Percentages sum to {sum}% (must be 100%).</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                {breakdown.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}>{b.member}:</span>
                        <input type="number" value={b.percentage} onChange={e => updatePct(i, parseInt(e.target.value))} style={{width: '60px'}} />%
                    </div>
                ))}
            </div>
            <div className="actions">
                <button className="btn primary" disabled={sum !== 100} onClick={handleSave}>Save Adjusted Percentages</button>
            </div>
        </div>
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

  .header {
    margin-bottom: 30px;
    h1 { font-size: 2.5rem; color: #0d8a43; margin-bottom: 5px; }
  }

  .back_btn { background: none; border: none; font-weight: bold; cursor: pointer; text-decoration: underline; margin-bottom: 20px; }

  .dropzone {
      border: 3px dashed #ccc; border-radius: 16px; padding: 60px 20px; text-align: center; background: #fff; cursor: pointer;
      &:hover { border-color: #0d8a43; background: #f0fdf4; }
      .icon { font-size: 4rem; margin-bottom: 15px; }
  }

  .card { background: #fff; border: 2px solid #264143; border-radius: 12px; padding: 20px; box-shadow: 3px 4px 0px 1px #E99F4C; margin-bottom: 20px; }
  
  .error { color: #d93025; font-weight: bold; text-align: center; }

  .tier0_section {
      background: #fff; border: 2px solid #264143; border-radius: 12px; padding: 30px;
      .progress_status { font-weight: bold; margin: 20px 0; color: #0d8a43; }
      .resolution_table {
          width: 100%; text-align: left; border-collapse: collapse; margin-bottom: 20px;
          th, td { padding: 15px; border-bottom: 1px solid #eee; }
          .resolution_actions { display: flex; gap: 10px; align-items: center; }
          select { padding: 8px; border-radius: 4px; border: 1px solid #ccc; flex: 1; }
      }
  }

  .tier1_summary {
      background: #e8f5e9; padding: 15px; border-radius: 8px; border: 1px solid #0d8a43; margin-bottom: 20px;
      summary { cursor: pointer; font-size: 1.1rem; color: #0d8a43; }
      ul { margin-top: 10px; font-size: 0.9rem; color: #555; }
  }

  .toast {
      background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; border: 1px solid #ffeeba; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
      button { background: none; border: 1px solid currentColor; padding: 5px 10px; cursor: pointer; border-radius: 4px; }
  }

  .tier_title { border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-top: 30px; margin-bottom: 20px; color: #264143; }

  .tier4_grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  .anomaly_card {
      h3 { margin-top: 0; color: #d93025; font-size: 1.1rem; }
      .desc { font-weight: bold; margin-bottom: 5px; }
      .note { font-size: 0.9rem; color: #666; margin-bottom: 15px; }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; }
      select, input { padding: 8px; border-radius: 4px; border: 1px solid #ccc; }
  }

  .btn {
      padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; border: 2px solid transparent; transition: transform 0.1s;
      &:hover:not(:disabled) { transform: translateY(-2px); }
      &.primary { background: #264143; color: #fff; }
      &.danger { background: #fff; border-color: #d93025; color: #d93025; }
      &.outline { background: #fff; border-color: #ccc; color: #555; }
      &.cta { background: #0d8a43; color: #fff; width: 100%; padding: 15px; font-size: 1.2rem; }
      &:disabled { opacity: 0.5; cursor: not-allowed; background: #ccc; }
  }
`;

export default ImportExpenses;
