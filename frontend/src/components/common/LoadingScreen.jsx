export default function LoadingScreen() {
  return (
    <div style={{ height:'100vh', background:'var(--bg-darker)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px' }}>
      <div style={{ position:'relative', width:'72px', height:'72px' }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid var(--accent)', opacity:0.2 }} />
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid var(--accent)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        <div style={{ position:'absolute', inset:'12px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>
          💬
        </div>
      </div>
      <div style={{ textAlign:'center' }}>
        <p style={{ color:'#fff', fontWeight:700, fontSize:'18px', marginBottom:'4px' }}>Chatterbox</p>
        <p style={{ color:'var(--text-muted)', fontSize:'14px' }}>Loading your workspace…</p>
      </div>
    </div>
  );
}
