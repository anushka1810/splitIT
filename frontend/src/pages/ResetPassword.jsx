import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/reset-password', { token, newPassword: password });
      setSuccess(response.data.message || 'Password reset successfully.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <StyledWrapper>
      <div className="container">
        <div className="form_area">
          <p className="title">NEW PASSWORD</p>
          <form onSubmit={handleSubmit}>
            
            {error && <div style={{ color: '#d93025', fontWeight: 'bold', margin: '10px 0', maxWidth: '360px' }}>{error}</div>}
            {success && <div style={{ color: '#1a7a4a', fontWeight: 'bold', margin: '10px 0', maxWidth: '360px' }}>{success}</div>}

            <div className="form_group">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <label className="sub_title" htmlFor="password">Enter New Password</label>
              </div>
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  placeholder="New password" 
                  id="password" 
                  className="form_style" 
                  style={{ paddingRight: '45px' }} // Make room for the eye icon
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !token || success}
                />
                <span 
                  onClick={() => setShowPassword(!showPassword)} 
                  style={{ 
                    position: 'absolute', 
                    right: '15px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#264143" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#264143" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </span>
              </div>
            </div>
            
            <div>
              <button className="btn" type="submit" disabled={loading || !token || success}>
                {loading ? 'PROCESSING...' : 'RESET PASSWORD'}
              </button>
            </div>
            
            <p style={{ fontSize: '15px', marginBottom: '10px' }}>
              <span 
                className="link" 
                style={{ cursor: 'pointer' }}
                onClick={() => navigate('/login')}
              >
                Back to Login
              </span>
            </p>
          </form>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  /* Overrides to guarantee absolute full screen, breaking out of Vite's default App.css */
  .container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
    background-color: #fafafa;
    z-index: 1000;
    overflow-y: auto;
  }

  .form_area {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    background-color: #EDDCD9;
    height: auto;
    width: auto;
    border: 2px solid #264143;
    border-radius: 24px;
    box-shadow: 4px 5px 0px 1px #E99F4C;
    padding: 35px 50px;
  }

  .title {
    color: #264143;
    font-weight: 900;
    font-size: 2.2em;
    margin-top: 10px;
    margin-bottom: 25px;
  }

  .sub_title {
    font-weight: 600;
    margin: 5px 0;
    font-size: 1.1em;
  }

  .form_group {
    display: flex;
    flex-direction: column;
    align-items: baseline;
    margin: 12px 10px;
  }

  .form_style {
    outline: none;
    border: 2px solid #264143;
    box-shadow: 3px 4px 0px 1px #E99F4C;
    width: 360px;
    padding: 16px 14px;
    border-radius: 6px;
    font-size: 16px;
    box-sizing: border-box;
    background-color: #fff;
    color: #264143;
  }

  .form_style:focus, .btn:focus {
    transform: translateY(4px);
    box-shadow: 1px 2px 0px 0px #E99F4C;
  }

  .btn {
    padding: 18px;
    margin: 30px 0px 15px 0px;
    width: 360px;
    font-size: 17px;
    background: #DE5499;
    border-radius: 10px;
    font-weight: 800;
    box-shadow: 3px 3px 0px 0px #E99F4C;
    cursor: pointer;
    border: none;
    color: #264143;
  }

  .btn:hover {
    opacity: .9;
  }
    
  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .link {
    font-weight: 800;
    color: #264143;
    padding: 5px;
    text-decoration: underline;
  }`;

export default ResetPassword;
