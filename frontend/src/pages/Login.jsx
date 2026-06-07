import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const login    = useAuthStore(s => s.login);
  const navigate = useNavigate();

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/channels/@me');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-darker)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'780px', background:'var(--bg-dark)', borderRadius:'8px', boxShadow:'var(--shadow)', display:'flex', overflow:'hidden', animation:'slideUp 0.25s ease' }}>

        {/* Left – form */}
        <div style={{ flex:1, padding:'40px 32px' }}>
          <h1 style={{ fontSize:'24px', fontWeight:700, color:'#fff', textAlign:'center', marginBottom:'8px' }}>Welcome back!</h1>
          <p style={{ color:'var(--text-muted)', textAlign:'center', marginBottom:'24px', fontSize:'14px' }}>We're so excited to see you again!</p>

          <form onSubmit={onSubmit}>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', marginBottom:'8px' }}>
                Email or Phone Number <span style={{ color:'var(--red)' }}>*</span>
              </label>
              <input name="email" type="email" value={form.email} onChange={onChange} required autoComplete="email"
                className="auth-input" style={{ width:'100%' }} />
            </div>

            <div style={{ marginBottom:'4px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', marginBottom:'8px' }}>
                Password <span style={{ color:'var(--red)' }}>*</span>
              </label>
              <div style={{ position:'relative' }}>
                <input name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={onChange} required
                  className="auth-input" style={{ width:'100%', paddingRight:'44px' }} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'18px', background:'none', border:'none', cursor:'pointer' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <Link to="/forgot-password" style={{ display:'block', fontSize:'13px', color:'var(--accent)', marginBottom:'20px', marginTop:'6px' }}>
              Forgot your password?
            </Link>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width:'100%', padding:'12px', fontSize:'16px', borderRadius:'4px' }}>
              {loading ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                <span style={{ width:'16px', height:'16px', border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block' }} className="animate-spin" /> Logging in…
              </span> : 'Log In'}
            </button>
          </form>

          <p style={{ marginTop:'16px', fontSize:'14px', color:'var(--text-muted)' }}>
            Need an account?{' '}
            <Link to="/register" style={{ color:'var(--accent)' }}>Register</Link>
          </p>
        </div>

        {/* Right – branding */}
        <div style={{ width:'260px', background:'linear-gradient(135deg, var(--accent) 0%, #7289da 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', padding:'40px 24px', flexShrink:0 }}>
          <div style={{ fontSize:'56px' }}>💬</div>
          <h2 style={{ color:'#fff', fontSize:'22px', fontWeight:800, textAlign:'center', lineHeight:1.3 }}>Chatterbox</h2>
          <p style={{ color:'rgba(255,255,255,0.75)', textAlign:'center', fontSize:'14px', lineHeight:1.6 }}>
            Real-time chat, voice, and video — all in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
