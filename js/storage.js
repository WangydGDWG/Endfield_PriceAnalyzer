//  __      __                                        __     
// /\ \  __/\ \                                      /\ \    
// \ \ \/\ \ \ \     __      ___      __    __  __   \_\ \   
//  \ \ \ \ \ \ \  /'__`\  /' _ `\  /'_ `\ /\ \/\ \  /'_` \  
//   \ \ \_/ \_\ \/\ \L\.\_/\ \/\ \/\ \L\ \\ \ \_\ \/\ \L\ \ 
//    \ `\___x___/\ \__/.\_\ \_\ \_\ \____ \\/`____ \ \___,_\
//     '\/__//__/  \/__/\/_/\/_/\/_/\/___L\ \`/___/> \/__,_ /
//                                    /\____/   /\___/       
//                                    \_/__/    \/__/         

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

// ══════════════════════════════════════
// ITEM ORDER (总览拖拽排序)
// ══════════════════════════════════════
function getItemOrder(acc){ return (load().itemOrder||{})[acc]||[] }
function saveItemOrder(acc, order){ const d=load(); if(!d.itemOrder)d.itemOrder={}; d.itemOrder[acc]=order; save(d) }

// ══════════════════════════════════════
// ITEM META (总览标签：适中/较大/极大)
// ══════════════════════════════════════
function getItemMeta(acc){ return (load().itemMeta||{})[acc]||{} }
function saveItemMeta(acc, meta){ const d=load(); if(!d.itemMeta)d.itemMeta={}; d.itemMeta[acc]=meta; save(d) }
function getItemTag(acc, item){ return (getItemMeta(acc)[item]||{}).size || null }
function setItemTag(acc, item, size){
  const meta = getItemMeta(acc);
  if (!meta[item]) meta[item] = {};
  meta[item].size = size;
  saveItemMeta(acc, meta);
}