// Countdown timer (24h, persists across reloads via localStorage)
(function(){
  const KEY = 'bg3d_v3_deadline';
  let deadline = localStorage.getItem(KEY);
  if(!deadline || Number(deadline) < Date.now()){
    deadline = Date.now() + 24*60*60*1000;
    localStorage.setItem(KEY, deadline);
  }
  deadline = Number(deadline);

  const hEl = document.getElementById('h');
  const mEl = document.getElementById('m');
  const sEl = document.getElementById('s');

  function pad(n){ return String(n).padStart(2,'0'); }

  function tick(){
    const diff = Math.max(0, deadline - Date.now());
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if(hEl) hEl.textContent = pad(hours);
    if(mEl) mEl.textContent = pad(mins);
    if(sEl) sEl.textContent = pad(secs);
  }
  tick();
  setInterval(tick, 1000);
})();

// FAQ accordion
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('.faq-q').addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if(!isOpen) item.classList.add('open');
  });
});
