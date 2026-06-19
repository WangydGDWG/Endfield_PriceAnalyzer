// ══════════════════════════════════════
// STORAGE
// ══════════════════════════════════════
function load(){ try{return JSON.parse(localStorage.getItem('ef5_data')||'{}')}catch{return{}} }
function save(d){ localStorage.setItem('ef5_data', JSON.stringify(d)) }
function getAccounts(){ return load().accounts||[] }
function saveAccounts(a){ const d=load(); d.accounts=a; save(d) }
function getAccountMeta(name){ const d=load(); return (d.accountMeta||{})[name]||{} }
function saveAccountMeta(name, meta){ const d=load(); if(!d.accountMeta)d.accountMeta={}; d.accountMeta[name]=meta; save(d) }
function getRecords(acc){ return (load().records||{})[acc]||[] }
function saveRecords(acc,recs){ const d=load(); if(!d.records)d.records={}; d.records[acc]=recs; save(d) }
