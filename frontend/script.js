// Config
const API = 'http://localhost:3000/api';

// Helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function fmtDate(d){ if(!d) return ''; const dt=new Date(d); return isNaN(dt)? String(d).slice(0,10): dt.toISOString().slice(0,10); }
async function jfetch(url, opts={}){
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
function setApiStatus(ok){ const el=$('#apiStatus'); if(el) el.textContent = ok ? 'API: online' : 'API: offline'; }
function flash(msg,type='ok'){ console.log(msg); }

// Página atual
const PAGE = document.body.dataset.page || 'home';

document.addEventListener('DOMContentLoaded', async () => {
  // ping API
  try { const h = await jfetch(`${API}/health`); setApiStatus(h.ok); } catch { setApiStatus(false); }

  if (PAGE === 'home') initHome();
  if (PAGE === 'doadores') initDonors();
  if (PAGE === 'instituicoes') initInstitutions();
  if (PAGE === 'itens') initItems();
  if (PAGE === 'doacoes') initDonations();
  if (PAGE === 'entregas') initDeliveries();
  if (PAGE === 'estoque') initStock();
  if (PAGE === 'relatorios') initReports();
});

/* HOME */
async function initHome(){
  try{
    // estoque para KPIs
    const stock = await jfetch(`${API}/stock`);
    $('#kpiExp').textContent = stock.filter(x => x.days_to_expiry <= 15).length;

    // doadores/insts para KPI simples
    const insts = await jfetch(`${API}/institutions`);
    $('#kpiInst').textContent = insts.length;

    const end = new Date(); const start = new Date(); start.setDate(end.getDate()-15);
    const dons = await jfetch(`${API}/reports/donations?start=${fmtDate(start)}&end=${fmtDate(end)}`);
    $('#kpiDonations').textContent = dons.length;

    // tabelas
    fillTable('#tblSoon', stock.slice(0,10).map(s => [s.lot_id, s.item_name, fmtDate(s.expires_at), s.days_to_expiry, s.quantity]));
    const last = dons.slice(-10).reverse();
    fillTable('#tblLastDonations', last.map(x => [x.donation_id, (x.received_at||'').replace('T',' ').slice(0,16), x.item_name, x.quantity]));
  }catch(e){ flash(e.message,'err'); }
}

/* DOADORES */
function initDonors(){
  $('#formDonor').addEventListener('submit', async (e)=>{
    e.preventDefault();
    await jfetch(`${API}/donors`, {method:'POST', body:JSON.stringify({
      name: $('#dnome').value.trim(),
      document: $('#ddoc').value.trim(),
      contact: $('#dcont').value.trim()
    })});
    e.target.reset();
    loadDonors();
  });
  loadDonors();
}
async function loadDonors(){
  const rows = await jfetch(`${API}/donors`);
  fillTable('#donorsTable', rows.map(r => [r.id, r.name, r.contact || '']));
}

/* INSTITUIÇÕES */
function initInstitutions(){
  $('#formInst').addEventListener('submit', async (e)=>{
    e.preventDefault();
    await jfetch(`${API}/institutions`, {method:'POST', body:JSON.stringify({
      name: $('#inome').value.trim(),
      cnpj: $('#icnpj').value.trim(),
      contact: $('#icont').value.trim()
    })});
    e.target.reset();
    loadInstitutions();
  });
  loadInstitutions();
}
async function loadInstitutions(){
  const rows = await jfetch(`${API}/institutions`);
  fillTable('#instTable', rows.map(r => [r.id, r.name, r.contact || '']));
}

/* ITENS */
function initItems(){
  $('#formItem').addEventListener('submit', async (e)=>{
    e.preventDefault();
    await jfetch(`${API}/items`, {method:'POST', body:JSON.stringify({
      name: $('#iname').value.trim(),
      category: $('#icat').value.trim(),
      unit: $('#iunit').value.trim() || 'kg'
    })});
    e.target.reset();
    loadItems();
  });
  loadItems();
}
async function loadItems(){
  const rows = await jfetch(`${API}/items`);
  fillTable('#itemsTable', rows.map(r => [r.id, r.name, r.unit]));
}

/* DOAÇÕES */
function initDonations(){
  $('#formDonation').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      donor_id: Number($('#donorId').value),
      received_at: $('#recvAt').value || new Date().toISOString(),
      items: [{
        item_id: Number($('#dItemId').value),
        lot_code: $('#dLot').value.trim(),
        expires_at: $('#dExp').value,
        quantity: Number($('#dQty').value)
      }]
    };
    await jfetch(`${API}/donations`, {method:'POST', body:JSON.stringify(payload)});
    loadDonStock();
    e.target.reset();
  });
  $('#donReload').addEventListener('click', loadDonStock);
  loadDonStock();
}
async function loadDonStock(){
  const rows = await jfetch(`${API}/stock`);
  fillTable('#donStock', rows.map(s => [s.lot_id, s.item_name, fmtDate(s.expires_at), s.days_to_expiry, s.quantity]));
}

/* ENTREGAS */
function initDeliveries(){
  $('#formDelivery').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      institution_id: Number($('#instId').value),
      delivered_at: $('#delivAt').value || new Date().toISOString(),
      items: [{ lot_id: Number($('#lotId').value), quantity: Number($('#eQty').value) }]
    };
    try{
      await jfetch(`${API}/deliveries`, {method:'POST', body:JSON.stringify(payload)});
      loadDelivStock();
      e.target.reset();
    }catch(err){ alert('Erro: ' + err.message); }
  });
  $('#delivReload').addEventListener('click', loadDelivStock);
  loadDelivStock();
}
async function loadDelivStock(){
  const rows = await jfetch(`${API}/stock`);
  fillTable('#delivStock', rows.map(s => [s.lot_id, s.item_name, fmtDate(s.expires_at), s.days_to_expiry, s.quantity]));
}

/* ESTOQUE */
function initStock(){
  let cache = [];
  const draw = (rows) => fillTable('#stockTable', rows.map(s => [s.lot_id, s.item_name, fmtDate(s.expires_at), s.days_to_expiry, s.quantity]));
  const load = async () => { cache = await jfetch(`${API}/stock`); draw(cache); };
  $('#stReload').addEventListener('click', load);
  $('#stFilter').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    draw(cache.filter(r => (r.item_name||'').toLowerCase().includes(q)));
  });
  load();
}

/* RELATÓRIOS */
function initReports(){
  $('#rpGo').addEventListener('click', async ()=>{
    const start = $('#rStart').value || '2000-01-01';
    const end   = $('#rEnd').value   || '2100-01-01';
    const rows = await jfetch(`${API}/reports/donations?start=${start}&end=${end}`);
    fillTable('#repTable', rows.map(x => [x.donation_id, (x.received_at||'').replace('T',' ').slice(0,16), x.item_name, x.quantity]));
    const total = rows.reduce((s,r)=> s + Number(r.quantity||0), 0);
    $('#rpTotal').innerHTML = `<strong>Total:</strong> ${total}`;
  });
}

/* util comum de tabela */
function fillTable(selector, rows){
  const table = $(selector);
  if (!table) return;
  const tbody = table.tBodies[0] || table.createTBody();
  tbody.innerHTML = rows.map(r =>
    `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`
  ).join('');
}
