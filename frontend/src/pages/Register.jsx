import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../context/authStore';

export default function Register() {
  const [form, setForm]       = useState({ username:'', displayName:'', email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const register = useAuthStore(s => s.register);
  const navigate = useNavigate();
  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const pwStrength = () => {
    const p = form.password;
    if (!p) return { label:'', color:'', width:'0%' };
    if (p.length < 6) return { label:'Weak', color:'var(--red)', width:'25%' };
    if (p.length < 8 || !/[A-Z]/.test(p) || !/\d/.test(p)) return { label:'Fair', color:'var(--yellow)', width:'50%' };
    if (p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p)) return { label:'Strong', color:'var(--green)', width:'100%' };
    return { label:'Good', color:'var(--accent)', width:'75%' };
  };

  const strength = pwStrength();

  const onSubmit = async e => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.username, form.displayName, form.email, form.password);
      toast.success('Welcome to Chatterbox! 🎉');
      navigate('/channels/@me');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const fields = [
    { name:'displayName', label:'Display Name', type:'text', placeholder:'John Doe' },
    { name:'username',    label:'Username',     type:'text', placeholder:'johndoe123' },
    { name:'email',       label:'Email',        type:'email', placeholder:'john@example.com' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-darker)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'480px', background:'var(--bg-dark)', borderRadius:'8px', padding:'32px', boxShadow:'var(--shadow)', animation:'slideUp 0.25s ease' }}>

        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ fontSize:'40px', marginBottom:'8px' }}>💬</div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:'#fff', marginBottom:'6px' }}>Create an account</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>Join thousands of people on Chatterbox</p>
        </div>

        <form onSubmit={onSubmit}>
          {fields.map(({ name, label, type, placeholder }) => (
            <div key={name} style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', marginBottom:'8px' }}>
                {label} <span style={{ color:'var(--red)' }}>*</span>
              </label>
              <input name={name} type={type} value={form[name]} onChange={onChange} placeholder={placeholder} required
                className="auth-input" style={{ width:'100%' }} />
            </div>
          ))}

          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', fontSize:'12px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', color:'var(--text-muted)', marginBottom:'8px' }}>
              Password <span style={{ color:'var(--red)' }}>*</span>
            </label>
            <div style={{ position:'relative' }}>
              <input name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={onChange}
                placeholder="Min 8 chars, uppercase & number" required className="auth-input" style={{ width:'100%', paddingRight:'44px' }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:'16px' }}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop:'8px' }}>
                <div style={{ height:'3px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:strength.width, background:strength.color, transition:'width 0.3s, background 0.3s', borderRadius:'2px' }} />
                </div>
                <p style={{ fontSize:'12px', color:strength.color, marginTop:'4px' }}>{strength.label}</p>
              </div>
            )}
          </div>

          <p style={{ fontSize:'12px', color:'var(--text-muted)', lineHeight:1.6, marginBottom:'20px' }}>
            By registering, you agree to our{' '}
            <span style={{ color:'var(--accent)', cursor:'pointer' }}>Terms of Service</span> and{' '}
            <span style={{ color:'var(--accent)', cursor:'pointer' }}>Privacy Policy</span>.
          </p>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width:'100%', padding:'12px', fontSize:'16px', borderRadius:'4px' }}>
            {loading ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
              <span style={{ width:'16px', height:'16px', border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block' }} className="animate-spin" /> Creating account…
            </span> : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop:'16px', fontSize:'14px', color:'var(--text-muted)', textAlign:'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'var(--accent)' }}>Log In</Link>
        </p>
      </div>
    </div>
  );
}
