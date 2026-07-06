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
// 公告系统：读取 announce.txt，按版本号决定是否强制弹出
// ══════════════════════════════════════
const ANNOUNCE_STORAGE_KEY = 'ef5_announce_dismissed_version';
let _announceCurrentVersion = null;

function initAnnounce() {
  fetch('announce.txt', { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('announce.txt not found');
      return res.text();
    })
    .then(raw => {
      const parsed = parseAnnounceText(raw);
      if (!parsed) return;
      _announceCurrentVersion = parsed.version;
      const dismissedVersion = localStorage.getItem(ANNOUNCE_STORAGE_KEY);
      if (dismissedVersion === parsed.version) return; // 该版本已被用户选择不再提示
      showAnnounceModal(parsed.content);
    })
    .catch(err => {
      console.warn('公告加载失败：', err);
    });
}

function parseAnnounceText(raw) {
  const sepIndex = raw.indexOf('---');
  if (sepIndex === -1) return null;
  const head = raw.slice(0, sepIndex);
  const versionMatch = head.match(/VERSION:\s*(.+)/i);
  if (!versionMatch) return null;
  const version = versionMatch[1].trim();
  const content = raw.slice(sepIndex + 3).replace(/^\r?\n/, '').trimEnd();
  return { version, content };
}

function showAnnounceModal(content) {
  document.getElementById('announceModalText').textContent = content;
  document.getElementById('announceDontShow').checked = false;
  document.getElementById('announceModalOverlay').classList.add('open');
}

function closeAnnounceModal() {
  const dontShow = document.getElementById('announceDontShow').checked;
  if (dontShow && _announceCurrentVersion) {
    localStorage.setItem(ANNOUNCE_STORAGE_KEY, _announceCurrentVersion);
  }
  document.getElementById('announceModalOverlay').classList.remove('open');
}

initAnnounce();
